import json
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pyotp
from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user_id
from app.core.phone import normalize_phone, generate_otp
from app.core.rate_limit import limiter
from app.core.secret_box import encrypt, decrypt
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.modules.auth.otp import create_register_ticket, decode_register_ticket
from app.modules.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    RequestRegisterOtpIn,
    VerifyRegisterOtpIn,
    TokenPair,
    RefreshRequest,
    UserOut,
    TwoFASetupOut,
    TwoFAVerifyRequest,
    TwoFADisableRequest,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register/request-otp")
@limiter.limit("3/minute")
async def register_request_otp(request: Request, p: RequestRegisterOtpIn = Body(...), db: AsyncSession = Depends(get_db)):
    """Generate a registration OTP for a phone number.

    No SMS/bot delivery yet — the code is always returned as `dev_code`
    until a real provider is wired up (matches customer_portal's dev pattern).
    """
    try:
        phone = normalize_phone(p.phone)
    except ValueError as ve:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid phone number format") from ve

    exists = await db.execute(text("SELECT 1 FROM users WHERE phone = :p"), {"p": phone})
    if exists.scalar():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu telefon raqam allaqachon ro'yxatdan o'tgan")

    code = generate_otp(6)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.execute(
        text("INSERT INTO registration_otp_codes (phone, code, expires_at) VALUES (:p, :c, :e)"),
        {"p": phone, "c": code, "e": expires_at},
    )
    await db.commit()

    return {
        "ok": True,
        "message": "Kod yaratildi",
        "dev_code": code,
        "dev_note": "SMS/bot integratsiyasi hali ulanmagan — bu maydon production'da ko'rinmaydi",
    }


@router.post("/register/verify-otp")
@limiter.limit("10/minute")
async def register_verify_otp(request: Request, p: VerifyRegisterOtpIn = Body(...), db: AsyncSession = Depends(get_db)):
    try:
        phone = normalize_phone(p.phone)
    except ValueError as ve:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid phone number format") from ve

    code_res = await db.execute(
        text(
            "SELECT id FROM registration_otp_codes "
            "WHERE phone = :p AND code = :c AND used = FALSE AND expires_at > NOW() "
            "ORDER BY id DESC LIMIT 1"
        ),
        {"p": phone, "c": p.code.strip()},
    )
    row = code_res.first()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kod noto'g'ri yoki muddati o'tgan")

    await db.execute(text("UPDATE registration_otp_codes SET used = TRUE WHERE id = :id"), {"id": row.id})
    await db.commit()

    return {"verified": True, "ticket": create_register_ticket(phone)}


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def register(request: Request, req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        phone = normalize_phone(req.phone)
    except ValueError as ve:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid phone number format") from ve

    ticket_phone = decode_register_ticket(req.ticket)
    if not ticket_phone or ticket_phone != phone:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Telefon tasdiqlanmagan yoki muddati o'tgan — qaytadan OTP oling")

    exists = await db.execute(text("SELECT 1 FROM users WHERE phone = :p"), {"p": phone})
    if exists.scalar():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu telefon raqam allaqachon ro'yxatdan o'tgan")

    user_id = uuid4()
    org_id = uuid4()
    org_code = f"org-{str(org_id)[:8]}"

    await db.execute(
        text(
            "INSERT INTO organizations (id, name, code) VALUES (:id, :name, :code)"
        ),
        {"id": str(org_id), "name": req.organization_name, "code": org_code},
    )
    await db.execute(
        text(
            "INSERT INTO users (id, phone, password_hash, full_name) "
            "VALUES (:id, :ph, :p, :n)"
        ),
        {
            "id": str(user_id),
            "ph": phone,
            "p": hash_password(req.password),
            "n": req.full_name,
        },
    )
    # HI-5: clone the system admin role into a tenant-scoped row so that
    # one organisation editing the admin role NEVER bleeds into others.
    sys_admin_res = await db.execute(
        text("SELECT id FROM roles WHERE code = 'admin' AND organization_id IS NULL LIMIT 1"),
    )
    sys_admin_id = sys_admin_res.scalar()
    if sys_admin_id is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "System admin role not seeded")

    new_role_res = await db.execute(
        text(
            "INSERT INTO roles (code, name, description, organization_id) "
            "VALUES ('admin', 'Administrator', 'Tenant-scoped admin (auto-created on register)', :o) "
            "RETURNING id"
        ),
        {"o": str(org_id)},
    )
    new_role_id = new_role_res.scalar()

    # Copy permissions from the system admin template to the tenant admin
    await db.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT :new, permission_id FROM role_permissions WHERE role_id = :src "
            "ON CONFLICT DO NOTHING"
        ),
        {"new": new_role_id, "src": sys_admin_id},
    )

    await db.execute(
        text(
            "INSERT INTO user_organizations (user_id, organization_id, role_id, is_default) "
            "VALUES (:u, :o, :r, TRUE)"
        ),
        {"u": str(user_id), "o": str(org_id), "r": new_role_id},
    )

    # Onboarding seed — new org gets a working baseline so the user can start selling immediately
    uzs_res = await db.execute(text("SELECT id FROM currencies WHERE code = 'UZS' LIMIT 1"))
    uzs_id = uzs_res.scalar()
    if uzs_id is None:
        ins = await db.execute(
            text(
                "INSERT INTO currencies (code, name, symbol, is_base, decimals, is_active) "
                "VALUES ('UZS', 'O''zbek so''m', 'so''m', TRUE, 2, TRUE) RETURNING id"
            )
        )
        uzs_id = ins.scalar()

    await db.execute(
        text(
            "INSERT INTO warehouses (organization_id, name, is_active) "
            "VALUES (:o, 'Asosiy ombor', TRUE)"
        ),
        {"o": str(org_id)},
    )
    cashbox_res = await db.execute(
        text(
            "INSERT INTO cashboxes (organization_id, name, currency_id, is_active, balance) "
            "VALUES (:o, 'Asosiy kassa', :c, TRUE, 0) RETURNING id"
        ),
        {"o": str(org_id), "c": uzs_id},
    )
    cashbox_id = cashbox_res.scalar()
    await db.execute(
        text(
            "INSERT INTO payment_types (organization_id, code, name, is_cash, is_active) "
            "VALUES (:o, 'cash', 'Naqd', TRUE, TRUE), "
            "       (:o, 'card', 'Plastik karta', FALSE, TRUE), "
            "       (:o, 'transfer', 'O''tkazma', FALSE, TRUE) "
            "ON CONFLICT (organization_id, code) DO NOTHING"
        ),
        {"o": str(org_id)},
    )

    # Standard chart of accounts (accounting module, Phase 1) — same defaults
    # backfilled for pre-existing orgs in schema_patches.py.
    coa_res = await db.execute(
        text(
            "INSERT INTO accounts (organization_id, code, name, type, is_system) VALUES "
            "(:o, '1000', 'Kassa va bank', 'asset', TRUE), "
            "(:o, '1200', 'Mijozlar qarzi (debitorlik)', 'asset', TRUE), "
            "(:o, '1300', 'Tovar-moddiy zaxiralar', 'asset', TRUE), "
            "(:o, '2000', 'Yetkazib beruvchilar qarzi (kreditorlik)', 'liability', TRUE), "
            "(:o, '3000', 'Kapital / Taqsimlanmagan foyda', 'equity', TRUE), "
            "(:o, '4000', 'Sotuvdan tushum', 'income', TRUE), "
            "(:o, '5000', 'Sotilgan tovar tannarxi', 'expense', TRUE), "
            "(:o, '5100', 'Hisobdan chiqarish xarajati', 'expense', TRUE), "
            "(:o, '5200', 'Boshqa operatsion xarajatlar', 'expense', TRUE), "
            "(:o, '2100', 'Ish haqi bo''yicha qarzdorlik', 'liability', TRUE), "
            "(:o, '2200', 'Soliq bo''yicha qarz', 'liability', TRUE), "
            "(:o, '5300', 'Ish haqi xarajati', 'expense', TRUE) "
            "RETURNING id, code"
        ),
        {"o": str(org_id)},
    )
    cash_account_id = next(r.id for r in coa_res if r.code == "1000")
    await db.execute(
        text(
            "INSERT INTO accounts (organization_id, code, name, type, parent_id, linked_cashbox_id, is_system) "
            "VALUES (:o, :code, 'Asosiy kassa', 'asset', :parent, :cb, TRUE)"
        ),
        {"o": str(org_id), "code": f"1000-{cashbox_id}", "parent": cash_account_id, "cb": cashbox_id},
    )

    await db.commit()

    return TokenPair(
        access_token=create_access_token(str(user_id), {"org_id": str(org_id)}),
        refresh_token=create_refresh_token(str(user_id)),
    )


@router.post("/login", response_model=TokenPair)
@limiter.limit("10/minute")
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        phone = normalize_phone(req.phone)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong phone or password")

    res = await db.execute(
        text(
            "SELECT id, password_hash, twofa_enabled, twofa_secret, twofa_backup_codes "
            "FROM users WHERE phone = :p AND is_active = TRUE"
        ),
        {"p": phone},
    )
    row = res.first()
    if not row or not verify_password(req.password, row.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong phone or password")

    if row.twofa_enabled:
        if not req.twofa_code:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "2FA code required")
        code = req.twofa_code.replace(" ", "").replace("-", "")
        ok = False
        try:
            secret_plain = decrypt(row.twofa_secret) if row.twofa_secret else ""
            if secret_plain and pyotp.TOTP(secret_plain).verify(code, valid_window=1):
                ok = True
        except Exception:
            ok = False
        if not ok:
            backup = row.twofa_backup_codes or []
            if isinstance(backup, str):
                backup = json.loads(backup)
            if code.upper() in {str(b).upper() for b in backup}:
                remaining = [b for b in backup if str(b).upper() != code.upper()]
                await db.execute(
                    text("UPDATE users SET twofa_backup_codes = :b WHERE id = :u"),
                    {"b": json.dumps(remaining), "u": str(row.id)},
                )
                await db.commit()
                ok = True
        if not ok:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid 2FA code")

    org_res = await db.execute(
        text(
            "SELECT organization_id FROM user_organizations "
            "WHERE user_id = :u ORDER BY is_default DESC LIMIT 1"
        ),
        {"u": str(row.id)},
    )
    org_id = org_res.scalar()

    return TokenPair(
        access_token=create_access_token(str(row.id), {"org_id": str(org_id) if org_id else None}),
        refresh_token=create_refresh_token(str(row.id)),
    )


@router.post("/refresh", response_model=TokenPair)
@limiter.limit("30/minute")
async def refresh(request: Request, req: RefreshRequest):
    try:
        payload = decode_token(req.refresh_token)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not a refresh token")
    sub = payload["sub"]
    return TokenPair(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
    )


@router.get("/me", response_model=UserOut)
async def me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT id, phone, email, full_name, locale FROM users WHERE id = :u"),
        {"u": user_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return UserOut(id=str(row.id), phone=row.phone, email=row.email, full_name=row.full_name, locale=row.locale)


@router.post("/2fa/setup", response_model=TwoFASetupOut)
async def twofa_setup(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT email, phone, twofa_enabled FROM users WHERE id = :u"),
        {"u": user_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if row.twofa_enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, "2FA already enabled")

    secret = pyotp.random_base32()
    backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
    encrypted = encrypt(secret)

    await db.execute(
        text(
            "UPDATE users SET twofa_secret = :s, twofa_backup_codes = :b, twofa_enabled = FALSE "
            "WHERE id = :u"
        ),
        {"s": encrypted, "b": json.dumps(backup_codes), "u": user_id},
    )
    await db.commit()

    otpauth_url = pyotp.TOTP(secret).provisioning_uri(name=row.email or row.phone or user_id, issuer_name="Aniq ERP")
    return TwoFASetupOut(secret=secret, otpauth_url=otpauth_url, backup_codes=backup_codes)


@router.post("/2fa/verify")
async def twofa_verify(
    req: TwoFAVerifyRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT twofa_secret FROM users WHERE id = :u"),
        {"u": user_id},
    )
    row = res.first()
    if not row or not row.twofa_secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Setup 2FA first")
    secret_plain = decrypt(row.twofa_secret)
    code = req.code.replace(" ", "").replace("-", "")
    if not pyotp.TOTP(secret_plain).verify(code, valid_window=1):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid code")
    await db.execute(
        text("UPDATE users SET twofa_enabled = TRUE WHERE id = :u"),
        {"u": user_id},
    )
    await db.commit()
    return {"ok": True}


@router.post("/2fa/disable")
async def twofa_disable(
    req: TwoFADisableRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT password_hash FROM users WHERE id = :u"),
        {"u": user_id},
    )
    row = res.first()
    if not row or not verify_password(req.password, row.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong password")
    await db.execute(
        text(
            "UPDATE users SET twofa_enabled = FALSE, twofa_secret = NULL, "
            "twofa_backup_codes = '[]'::jsonb WHERE id = :u"
        ),
        {"u": user_id},
    )
    await db.commit()
    return {"ok": True}
