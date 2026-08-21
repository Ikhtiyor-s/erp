"""Customer-facing API endpoints (mijoz uchun)."""
import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.rate_limit import limiter
from app.modules.customer_portal.auth import (
    create_customer_token,
    generate_otp,
    get_current_customer,
    _normalize_phone,
)


log = logging.getLogger(__name__)

router = APIRouter(prefix="/customer-portal", tags=["customer-portal"])


# =========================================================================
# AUTH (OTP)
# =========================================================================

class RequestOtpIn(BaseModel):
    phone: str
    org_code: str  # which organization the customer belongs to


@router.post("/auth/request-otp")
@limiter.limit("3/minute")
async def request_otp(request: Request, p: RequestOtpIn = Body(...), db: AsyncSession = Depends(get_db)):
    """Generate a 6-digit OTP and (optionally) send via SMS.

    Sprint #2 HI-7: phone is normalized -> 422 on bad input. DB lookups
    use exact match on the normalized form (no LIKE prefix collisions).
    """
    try:
        phone = _normalize_phone(p.phone)
    except ValueError as ve:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Invalid phone number format") from ve

    # Resolve org
    org_res = await db.execute(
        text("SELECT id FROM organizations WHERE code = :c"),
        {"c": p.org_code.upper()},
    )
    org = org_res.first()
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tashkilot topilmadi")
    org_id = str(org.id)

    # HI-7: exact match on normalized phone (no LIKE prefix collision).
    cust_res = await db.execute(
        text("""
            SELECT id FROM customers
            WHERE organization_id = :o AND phone = :p AND is_active = TRUE
            LIMIT 1
        """),
        {"o": org_id, "p": phone},
    )
    cust = cust_res.first()
    if not cust:
        # Generic message to prevent phone enumeration
        return {"ok": True, "message": "Agar telefon raqamingiz ro'yxatga olingan bo'lsa, kod yuborildi."}

    # Generate OTP and store
    code = generate_otp(6)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    await db.execute(
        text("""
            INSERT INTO customer_otp_codes (organization_id, phone, code, expires_at)
            VALUES (:o, :p, :c, :e)
        """),
        {"o": org_id, "p": phone, "c": code, "e": expires_at},
    )

    # H11: send SMS BEFORE commit. If provider throws, rollback so no orphan code.
    # In dev (no provider configured), `sent` is False and we keep the code for dev display.
    try:
        sent = await _send_otp_sms(db, org_id, phone, code)
    except Exception as e:
        await db.rollback()
        log.error("OTP SMS provider raised for %s: %s", phone, e)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SMS yuborib bo'lmadi, birozdan keyin urinib ko'ring",
        )

    # If provider is configured (settings.sms.enabled) but returned False,
    # treat as failure and rollback. Dev mode (no provider) — keep the code.
    sms_configured = await _is_sms_configured(db, org_id)
    if sms_configured and not sent:
        await db.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SMS yuborib bo'lmadi, birozdan keyin urinib ko'ring",
        )

    await db.commit()

    response: dict = {"ok": True, "message": "Kod yuborildi"}
    if not sent:
        # Dev only — provider not configured at all
        response["dev_code"] = code
        response["dev_note"] = "SMS provayder sozlanmagan — bu maydon production'da ko'rinmaydi"
    return response


async def _is_sms_configured(db: AsyncSession, org_id: str) -> bool:
    """Returns True if org has a real SMS provider enabled."""
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'sms'"),
        {"o": org_id},
    )
    row = res.first()
    if not row or not row.value:
        return False
    cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
    return bool(cfg.get("enabled") and cfg.get("provider"))


class VerifyOtpIn(BaseModel):
    phone: str
    code: str
    org_code: str


@router.post("/auth/verify")
@limiter.limit("10/minute")
async def verify_otp(request: Request, p: VerifyOtpIn = Body(...), db: AsyncSession = Depends(get_db)):
    """Verify OTP and return a customer JWT.

    Sprint #2 HI-7: normalize phone or 422; lookup uses exact match.
    """
    try:
        phone = _normalize_phone(p.phone)
    except ValueError as ve:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Invalid phone number format") from ve

    org_res = await db.execute(
        text("SELECT id FROM organizations WHERE code = :c"),
        {"c": p.org_code.upper()},
    )
    org = org_res.first()
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tashkilot topilmadi")
    org_id = str(org.id)

    # Find a valid (unused, not expired) code matching
    code_res = await db.execute(
        text("""
            SELECT id, attempts
            FROM customer_otp_codes
            WHERE organization_id = :o AND phone = :p AND code = :c
              AND used = FALSE AND expires_at > NOW()
            ORDER BY id DESC LIMIT 1
        """),
        {"o": org_id, "p": phone, "c": p.code.strip()},
    )
    row = code_res.first()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kod noto'g'ri yoki muddati o'tgan")

    # Mark used + increment attempts on stale entries
    await db.execute(
        text("UPDATE customer_otp_codes SET used = TRUE WHERE id = :id"),
        {"id": row.id},
    )

    # HI-7: exact match on normalized phone.
    cust_res = await db.execute(
        text("""
            SELECT id, name, phone, address, email
            FROM customers
            WHERE organization_id = :o AND phone = :p AND is_active = TRUE
            LIMIT 1
        """),
        {"o": org_id, "p": phone},
    )
    cust = cust_res.first()
    if not cust:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mijoz topilmadi")

    await db.commit()

    token = create_customer_token(str(cust.id), org_id, phone)
    return {
        "access_token": token,
        "token_type": "bearer",
        "customer": {
            "id": str(cust.id),
            "name": cust.name,
            "phone": cust.phone,
            "address": cust.address,
            "email": cust.email,
        },
    }


# =========================================================================
# CUSTOMER-FACING DATA
# =========================================================================

@router.get("/me")
async def me(customer=Depends(get_current_customer)):
    """Profile + balance."""
    return {
        "id": str(customer["id"]),
        "name": customer["name"],
        "phone": customer["phone"],
        "address": customer["address"],
        "email": customer["email"],
        "tin": customer["tin"],
    }


@router.get("/me/balance")
async def my_balance(
    customer=Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """Current customer's debt + recent payments."""
    cid = str(customer["id"])
    oid = str(customer["organization_id"])

    # Aggregate sales and payments
    res = await db.execute(
        text("""
            SELECT
                COALESCE(SUM(s.total_amount), 0) AS total_purchases,
                COALESCE(SUM(s.paid_amount), 0) AS total_paid,
                COALESCE(SUM(s.total_amount - s.paid_amount), 0) AS debt,
                COUNT(*) AS sale_count
            FROM sales s
            WHERE s.organization_id = :o AND s.customer_id = :c
              AND s.status != 'cancelled'
        """),
        {"o": oid, "c": cid},
    )
    r = res.first()
    return {
        "total_purchases": float(r.total_purchases),
        "total_paid": float(r.total_paid),
        "debt": float(r.debt),
        "sale_count": r.sale_count,
    }


@router.get("/me/sales")
async def my_sales(
    customer=Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """List of this customer's sales."""
    cid = str(customer["id"])
    oid = str(customer["organization_id"])

    res = await db.execute(
        text("""
            SELECT s.id, s.doc_number, s.sale_date, s.total_amount,
                   s.paid_amount, s.status,
                   w.name AS warehouse_name,
                   cur.code AS currency
            FROM sales s
            LEFT JOIN warehouses w ON w.id = s.warehouse_id
            LEFT JOIN currencies cur ON cur.id = s.currency_id
            WHERE s.organization_id = :o AND s.customer_id = :c
            ORDER BY s.sale_date DESC
            LIMIT :lim
        """),
        {"o": oid, "c": cid, "lim": limit},
    )
    rows = []
    for r in res:
        rows.append({
            "id": str(r.id),
            "doc_number": r.doc_number,
            "date": r.sale_date.isoformat() if r.sale_date else None,
            "total": float(r.total_amount or 0),
            "paid": float(r.paid_amount or 0),
            "debt": float((r.total_amount or 0) - (r.paid_amount or 0)),
            "status": r.status,
            "warehouse": r.warehouse_name,
            "currency": r.currency,
        })
    return rows


@router.get("/me/sales/{sale_id}")
async def my_sale_detail(
    sale_id: UUID,
    customer=Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """Single sale with items — restricted to this customer's own sales."""
    cid = str(customer["id"])
    oid = str(customer["organization_id"])

    head = await db.execute(
        text("""
            SELECT s.*, w.name AS warehouse_name, cur.code AS currency_code
            FROM sales s
            LEFT JOIN warehouses w ON w.id = s.warehouse_id
            LEFT JOIN currencies cur ON cur.id = s.currency_id
            WHERE s.id = :id AND s.organization_id = :o AND s.customer_id = :c
        """),
        {"id": str(sale_id), "o": oid, "c": cid},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sotuv topilmadi")

    items = await db.execute(
        text("""
            SELECT si.product_id, p.name AS product_name,
                   si.quantity, si.price, si.discount, si.amount
            FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
            WHERE si.sale_id = :id
        """),
        {"id": str(sale_id)},
    )
    return {
        "head": dict(h._mapping),
        "items": [dict(r._mapping) for r in items],
    }


# =========================================================================
# CUSTOMER ORDER (mijoz alohida onlayn buyurtma yuboradi)
# =========================================================================

class OrderItemIn(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)
    note: str | None = None


class OrderIn(BaseModel):
    items: list[OrderItemIn]
    notes: str | None = None


@router.post("/me/orders", status_code=status.HTTP_201_CREATED)
async def create_order(
    p: OrderIn,
    customer=Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    cid = str(customer["id"])
    oid = str(customer["organization_id"])

    # Generate order number
    num_res = await db.execute(
        text("SELECT COUNT(*) + 1 AS n FROM customer_portal_orders WHERE organization_id = :o"),
        {"o": oid},
    )
    order_no = f"M{num_res.scalar() or 1:05d}"

    # Calculate total based on current product prices
    total = 0.0
    for it in p.items:
        pr = await db.execute(
            text("SELECT sale_price FROM products WHERE id = :p AND organization_id = :o"),
            {"p": it.product_id, "o": oid},
        )
        row = pr.first()
        if row:
            total += float(row.sale_price or 0) * it.quantity

    order_res = await db.execute(
        text("""
            INSERT INTO customer_portal_orders
                (organization_id, customer_id, order_number, status, notes, total_amount)
            VALUES (:o, :c, :n, 'new', :nt, :t)
            RETURNING id
        """),
        {"o": oid, "c": cid, "n": order_no, "nt": p.notes, "t": total},
    )
    order_id = str(order_res.scalar())

    for it in p.items:
        await db.execute(
            text("""
                INSERT INTO customer_portal_order_items (order_id, product_id, quantity, note)
                VALUES (:o, :p, :q, :n)
            """),
            {"o": order_id, "p": it.product_id, "q": it.quantity, "n": it.note},
        )
    await db.commit()
    return {"id": order_id, "order_number": order_no, "total": total, "status": "new"}


@router.get("/me/orders")
async def my_orders(
    customer=Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    cid = str(customer["id"])
    oid = str(customer["organization_id"])
    res = await db.execute(
        text("""
            SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
                   COUNT(i.id) AS item_count
            FROM customer_portal_orders o
            LEFT JOIN customer_portal_order_items i ON i.order_id = o.id
            WHERE o.organization_id = :o AND o.customer_id = :c
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT 50
        """),
        {"o": oid, "c": cid},
    )
    return [
        {
            "id": str(r.id), "order_number": r.order_number, "status": r.status,
            "total": float(r.total_amount or 0), "item_count": r.item_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in res
    ]


@router.get("/products")
async def list_products_for_customer(
    customer=Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
    q: str | None = None,
    limit: int = 100,
):
    """Customer-facing product catalog."""
    oid = str(customer["organization_id"])
    where = "WHERE organization_id = :o AND is_active = TRUE"
    params: dict = {"o": oid, "lim": limit}
    if q:
        where += " AND (name ILIKE :q OR sku ILIKE :q OR barcode ILIKE :q)"
        params["q"] = f"%{q}%"
    res = await db.execute(
        text(f"""
            SELECT id, sku, name, sale_price
            FROM products
            {where}
            ORDER BY name
            LIMIT :lim
        """),
        params,
    )
    return [
        {"id": str(r.id), "sku": r.sku, "name": r.name, "price": float(r.sale_price or 0)}
        for r in res
    ]


# =========================================================================
# SMS HELPER
# =========================================================================

async def _send_otp_sms(db: AsyncSession, org_id: str, phone: str, code: str) -> bool:
    """
    Send OTP via configured SMS provider. Returns True if sent.

    Reads SMS settings from app_settings under key 'sms'. Supported providers:
      - eskiz (eskiz.uz) — real integration
      - playmobile — TODO
      - none (returns False — caller will reveal code for dev)
    """
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'sms'"),
        {"o": org_id},
    )
    row = res.first()
    if not row or not row.value:
        log.info("OTP for %s: %s (no SMS provider configured)", phone, code)
        return False
    cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
    provider = cfg.get("provider")
    if not provider or not cfg.get("enabled"):
        log.info("OTP for %s: %s (SMS provider not enabled)", phone, code)
        return False

    message = f"Aniq ERP — tasdiqlash kodi: {code}. Hech kimga aytmang."

    if provider == "eskiz":
        from app.core.secret_box import decrypt
        email = cfg.get("eskiz_email") or cfg.get("email")
        # password may be Fernet-encrypted (fernet:...) or plain (legacy)
        password = decrypt(cfg.get("eskiz_password") or cfg.get("password"))
        sender = cfg.get("eskiz_sender") or cfg.get("sender") or "4546"
        if not email or not password:
            log.warning("Eskiz credentials missing or undecryptable for org %s", org_id)
            return False
        try:
            from app.modules.integration.sms.eskiz import send_sms
            await send_sms(email, password, phone, message, sender=sender)
            log.info("Eskiz SMS sent to %s for org %s", phone, org_id)
            return True
        except Exception as e:
            log.error("Eskiz send failed for %s: %s", phone, e)
            return False

    if provider == "playmobile":
        # TODO: implement PlayMobile when credentials available
        log.info("PlayMobile not implemented yet — OTP for %s: %s", phone, code)
        return False

    log.warning("Unknown SMS provider '%s' — OTP for %s: %s", provider, phone, code)
    return False
