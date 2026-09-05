import base64
import json
import secrets
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db, get_current_user_id
from app.core.security import create_access_token, create_refresh_token
from app.modules.auth.schemas import TokenPair


router = APIRouter(prefix="/auth/webauthn", tags=["webauthn"])


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def _get_rp_id(request: Request) -> str:
    host = request.headers.get("origin", "")
    if host:
        parsed = urlparse(host)
        return parsed.hostname or "localhost"
    return "localhost"


def _get_origin(request: Request) -> str:
    return request.headers.get("origin", "")


class RegisterFinishRequest(BaseModel):
    credential_id: str
    client_data_json: str
    attestation_object: str
    device_name: str = "Unknown Device"


class LoginBeginRequest(BaseModel):
    email: EmailStr


class LoginFinishRequest(BaseModel):
    email: EmailStr
    credential_id: str
    client_data_json: str
    authenticator_data: str
    signature: str
    user_handle: str | None = None


async def _cleanup_expired_challenges(db: AsyncSession, user_id: str) -> None:
    await db.execute(
        text(
            "DELETE FROM user_webauthn_challenges "
            "WHERE user_id = :uid AND created_at < NOW() - INTERVAL '5 minutes'"
        ),
        {"uid": user_id},
    )


@router.post("/register/begin")
async def register_begin(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    await _cleanup_expired_challenges(db, user_id)

    user_row = await db.execute(
        text("SELECT id, email, full_name FROM users WHERE id = :uid"),
        {"uid": user_id},
    )
    user = user_row.first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    challenge = secrets.token_bytes(32)
    challenge_b64 = _b64url_encode(challenge)

    await db.execute(
        text(
            "INSERT INTO user_webauthn_challenges (user_id, challenge, purpose) "
            "VALUES (:uid, :ch, 'register')"
        ),
        {"uid": user_id, "ch": challenge},
    )
    await db.commit()

    rp_id = _get_rp_id(request)
    user_id_b64 = _b64url_encode(user_id.encode())

    return {
        "challenge": challenge_b64,
        "rp": {"name": "Aniq ERP", "id": rp_id},
        "user": {
            "id": user_id_b64,
            "name": user.email,
            "displayName": user.full_name or user.email,
        },
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},
            {"type": "public-key", "alg": -257},
        ],
        "timeout": 60000,
        "attestation": "none",
        "authenticatorSelection": {
            "authenticatorAttachment": "platform",
            "userVerification": "required",
        },
    }


@router.post("/register/finish")
async def register_finish(
    req: RegisterFinishRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    challenge_row = await db.execute(
        text(
            "SELECT challenge FROM user_webauthn_challenges "
            "WHERE user_id = :uid AND purpose = 'register' "
            "AND created_at > NOW() - INTERVAL '5 minutes' "
            "ORDER BY created_at DESC LIMIT 1"
        ),
        {"uid": user_id},
    )
    row = challenge_row.first()
    if not row:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Challenge topilmadi yoki muddati o'tgan")

    stored_challenge_bytes: bytes = bytes(row.challenge)

    try:
        client_data_raw = _b64url_decode(req.client_data_json)
        client_data = json.loads(client_data_raw)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verification xatosi: client_data_json parse xatosi")

    received_challenge = client_data.get("challenge", "")
    expected_challenge = _b64url_encode(stored_challenge_bytes)
    if received_challenge != expected_challenge:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verification xatosi: challenge mos kelmadi")

    received_origin = client_data.get("origin", "")
    expected_origin = _get_origin(request)
    if expected_origin and received_origin and received_origin != expected_origin:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verification xatosi: origin mos kelmadi")

    await db.execute(
        text(
            "DELETE FROM user_webauthn_challenges "
            "WHERE user_id = :uid AND purpose = 'register'"
        ),
        {"uid": user_id},
    )

    settings_row = await db.execute(
        text(
            "SELECT value FROM app_settings "
            "WHERE organization_id IS NULL AND key = 'webauthn_' || :uid"
        ),
        {"uid": user_id},
    )
    existing = settings_row.first()

    from datetime import datetime, timezone
    new_credential = {
        "credential_id": req.credential_id,
        "public_key": req.attestation_object,
        "sign_count": 0,
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "device_name": req.device_name,
    }

    if existing:
        creds = existing.value if isinstance(existing.value, list) else existing.value.get("credentials", [])
        creds = [c for c in creds if c.get("credential_id") != req.credential_id]
        creds.append(new_credential)
        await db.execute(
            text(
                "UPDATE app_settings SET value = :v, updated_at = NOW() "
                "WHERE organization_id IS NULL AND key = 'webauthn_' || :uid"
            ),
            {"v": json.dumps({"credentials": creds}), "uid": user_id},
        )
    else:
        await db.execute(
            text(
                "INSERT INTO app_settings (organization_id, key, value) "
                "VALUES (NULL, 'webauthn_' || :uid, :v)"
            ),
            {"v": json.dumps({"credentials": [new_credential]}), "uid": user_id},
        )

    await db.commit()
    return {"ok": True}


@router.post("/login/begin")
async def login_begin(
    req: LoginBeginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_row = await db.execute(
        text("SELECT id, email FROM users WHERE email = :e AND is_active = TRUE"),
        {"e": req.email},
    )
    user = user_row.first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foydalanuvchi topilmadi")

    user_id = str(user.id)

    settings_row = await db.execute(
        text(
            "SELECT value FROM app_settings "
            "WHERE organization_id IS NULL AND key = 'webauthn_' || :uid"
        ),
        {"uid": user_id},
    )
    existing = settings_row.first()
    credentials = []
    if existing:
        val = existing.value
        if isinstance(val, dict):
            credentials = val.get("credentials", [])
        elif isinstance(val, list):
            credentials = val

    if not credentials:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Biometric ro'yxatdan o'tilmagan")

    await _cleanup_expired_challenges(db, user_id)

    challenge = secrets.token_bytes(32)
    challenge_b64 = _b64url_encode(challenge)

    await db.execute(
        text(
            "INSERT INTO user_webauthn_challenges (user_id, challenge, purpose) "
            "VALUES (:uid, :ch, 'login')"
        ),
        {"uid": user_id, "ch": challenge},
    )
    await db.commit()

    rp_id = _get_rp_id(request)
    allow_credentials = [
        {
            "type": "public-key",
            "id": c["credential_id"],
            "transports": ["internal"],
        }
        for c in credentials
    ]

    return {
        "challenge": challenge_b64,
        "timeout": 60000,
        "rpId": rp_id,
        "allowCredentials": allow_credentials,
        "userVerification": "required",
    }


@router.post("/login/finish", response_model=TokenPair)
async def login_finish(
    req: LoginFinishRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_row = await db.execute(
        text("SELECT id, email FROM users WHERE email = :e AND is_active = TRUE"),
        {"e": req.email},
    )
    user = user_row.first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Biometric verification xatosi")

    user_id = str(user.id)

    challenge_row = await db.execute(
        text(
            "SELECT id, challenge FROM user_webauthn_challenges "
            "WHERE user_id = :uid AND purpose = 'login' "
            "AND created_at > NOW() - INTERVAL '5 minutes' "
            "ORDER BY created_at DESC LIMIT 1"
        ),
        {"uid": user_id},
    )
    challenge_record = challenge_row.first()
    if not challenge_record:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Challenge muddati o'tgan")

    stored_challenge_bytes: bytes = bytes(challenge_record.challenge)

    try:
        client_data_raw = _b64url_decode(req.client_data_json)
        client_data = json.loads(client_data_raw)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Biometric verification xatosi")

    received_challenge = client_data.get("challenge", "")
    expected_challenge = _b64url_encode(stored_challenge_bytes)
    if received_challenge != expected_challenge:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Biometric verification xatosi")

    received_origin = client_data.get("origin", "")
    expected_origin = _get_origin(request)
    if expected_origin and received_origin and received_origin != expected_origin:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Biometric verification xatosi")

    settings_row = await db.execute(
        text(
            "SELECT value FROM app_settings "
            "WHERE organization_id IS NULL AND key = 'webauthn_' || :uid"
        ),
        {"uid": user_id},
    )
    existing = settings_row.first()
    credentials = []
    if existing:
        val = existing.value
        if isinstance(val, dict):
            credentials = val.get("credentials", [])
        elif isinstance(val, list):
            credentials = val

    matched = next((c for c in credentials if c.get("credential_id") == req.credential_id), None)
    if not matched:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Biometric verification xatosi")

    stored_count = matched.get("sign_count", 0)
    matched["sign_count"] = stored_count + 1

    await db.execute(
        text(
            "UPDATE app_settings SET value = :v, updated_at = NOW() "
            "WHERE organization_id IS NULL AND key = 'webauthn_' || :uid"
        ),
        {"v": json.dumps({"credentials": credentials}), "uid": user_id},
    )

    await db.execute(
        text(
            "DELETE FROM user_webauthn_challenges "
            "WHERE user_id = :uid AND purpose = 'login'"
        ),
        {"uid": user_id},
    )
    await db.commit()

    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )
