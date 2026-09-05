"""Integration endpoints — Telegram, online payments (Click/Payme), Didox."""
from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_current_user_id, get_db
from app.core.rate_limit import limiter
from app.modules.rbac.deps import require_permission
from app.modules.integration.didox import DidoxIntegration
from app.modules.integration.telegram import (
    test_connection, send_raw, dispatch_command, _read_crm_settings,
)
from app.modules.integration.payments.click import handle_click_webhook
from app.modules.integration.payments.multicard import MulticardService
from app.modules.integration.payments.payme import handle_payme
from app.modules.integration.payments.rahmat import RahmatService


log = logging.getLogger(__name__)

router = APIRouter(prefix="/integration", tags=["integration"])


@router.post("/telegram/test")
async def telegram_test(
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Test the Telegram bot connection for the current org."""
    return await test_connection(db, org_id)


@router.post("/telegram/send")
async def telegram_send(
    payload: dict,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Send a manual text message via the configured bot."""
    body = payload.get("text") or ""
    if not body:
        return {"ok": False, "error": "text required"}
    ok = await send_raw(db, org_id, body, chat_id=payload.get("chat_id"))
    return {"ok": ok}


@router.post("/click/webhook/{org_code}")
async def click_webhook(org_code: str, request: Request,
                        db: AsyncSession = Depends(get_db)):
    """
    Click Merchant webhook (Prepare + Complete in one URL).
    Configure your Click cabinet to call:
      https://<your-host>/api/v1/integration/click/webhook/<ORG_CODE>
    """
    # Click uses form-encoded body
    try:
        form = await request.form()
        payload = dict(form)
    except Exception:
        return {"error": -8, "error_note": "Bad request"}

    org_res = await db.execute(
        text("SELECT id FROM organizations WHERE code = :c"),
        {"c": org_code.upper()},
    )
    row = org_res.first()
    if not row:
        return {"error": -8, "error_note": "Organization not found"}
    return await handle_click_webhook(db, str(row.id), payload)


@router.post("/payme/webhook/{org_code}")
async def payme_webhook(org_code: str, request: Request,
                        db: AsyncSession = Depends(get_db)):
    """
    Payme Merchant JSON-RPC webhook.
    Configure Payme cabinet URL:
      https://<your-host>/api/v1/integration/payme/webhook/<ORG_CODE>
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    auth = request.headers.get("authorization", "")

    org_res = await db.execute(
        text("SELECT id FROM organizations WHERE code = :c"),
        {"c": org_code.upper()},
    )
    row = org_res.first()
    if not row:
        from app.modules.integration.payments.payme import _err, PaymeError
        return _err(body.get("id"), PaymeError.AUTH_FAILED, "Org topilmadi")
    return await handle_payme(db, str(row.id), auth, body)


@router.post("/multicard/webhook/{org_code}")
async def multicard_webhook(org_code: str, request: Request,
                            db: AsyncSession = Depends(get_db)):
    """
    Multicard payment webhook stub.
    Configure Multicard cabinet URL:
      https://<your-host>/api/v1/integration/multicard/webhook/<ORG_CODE>
    Real handling requires Multicard credentials — returns scaffold note until implemented.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    org_res = await db.execute(
        text("SELECT id FROM organizations WHERE code = :c"),
        {"c": org_code.upper()},
    )
    row = org_res.first()
    if not row:
        return {"ok": False, "error": "Organization not found"}
    org_id = str(row.id)

    svc = MulticardService(db=db, org_id=org_id)
    log.info("multicard_webhook org=%s body_keys=%s", org_code, list(body.keys()))
    return await svc.handle_webhook(body)


@router.post("/alif/webhook/{org_code}")
@limiter.limit("60/minute")
async def alif_webhook(org_code: str, request: Request,
                       db: AsyncSession = Depends(get_db)):
    """
    Alif Bank payment webhook stub.
    Configure Alif cabinet URL:
      https://<your-host>/api/v1/integration/alif/webhook/<ORG_CODE>
    Real HMAC signature verification deferred — credentials required.
    """
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    log.info("alif_webhook org=%s body_keys=%s", org_code, list(payload.keys()))
    # TODO: verify HMAC signature when Alif credentials are available
    # TODO: update payment status based on payload
    return {"status": "received", "note": "scaffold — credentials pending"}


@router.post("/uzum/webhook/{org_code}")
async def uzum_webhook(org_code: str, request: Request,
                       db: AsyncSession = Depends(get_db)):
    """
    Uzum Bank payment webhook stub.
    Configure Uzum cabinet URL:
      https://<your-host>/api/v1/integration/uzum/webhook/<ORG_CODE>
    Real handling requires Uzum credentials — returns scaffold note until implemented.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    log.info("uzum_webhook org=%s body_keys=%s", org_code, list(body.keys()))
    return {
        "ok": True,
        "stubbed": True,
        "note": "Uzum webhook scaffold — real implementation pending credentials",
    }


@router.post("/rahmat/webhook/{org_code}")
async def rahmat_webhook(org_code: str, request: Request,
                         db: AsyncSession = Depends(get_db)):
    """
    Rahmat loyalty/cashback webhook stub.
    Configure Rahmat cabinet URL:
      https://<your-host>/api/v1/integration/rahmat/webhook/<ORG_CODE>
    Real signature verification deferred — credentials required.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    org_res = await db.execute(
        text("SELECT id FROM organizations WHERE code = :c"),
        {"c": org_code.upper()},
    )
    row = org_res.first()
    if not row:
        return {"ok": False, "error": "Organization not found"}
    org_id = str(row.id)

    svc = RahmatService(db=db, org_id=org_id)
    log.info("rahmat_webhook org=%s body_keys=%s", org_code, list(body.keys()))
    return await svc.handle_webhook(body)


@router.post("/telegram/webhook/{org_code}")
async def telegram_webhook(org_code: str, request: Request,
                           db: AsyncSession = Depends(get_db)):
    """
    Receive Telegram bot updates. Configure your bot with:
        https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-host>/api/v1/integration/telegram/webhook/<ORG_CODE>
    """
    try:
        update = await request.json()
    except Exception:
        return {"ok": True}  # always return 200 so Telegram doesn't retry

    org_res = await db.execute(
        text("SELECT id FROM organizations WHERE code = :c"),
        {"c": org_code.upper()},
    )
    row = org_res.first()
    if not row:
        return {"ok": True}
    org_id = str(row.id)

    return await dispatch_command(db, org_id, update)


@router.post(
    "/telegram/bind/generate",
    dependencies=[Depends(require_permission("settings.integration"))],
)
@limiter.limit("3/hour")
async def telegram_bind_generate(
    request: Request,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    """Generate a one-time 15-minute bind token and return a Telegram deep-link."""
    bind_token = secrets.token_urlsafe(32)

    await db.execute(
        text("""
            UPDATE users
            SET tg_bind_token = :t, tg_bind_token_at = NOW()
            WHERE id = :u
        """),
        {"t": bind_token, "u": user_id},
    )
    await db.commit()

    cfg = await _read_crm_settings(db, org_id)
    bot_username = cfg.get("bot_username") or "aniqerp_bot"

    deep_link = f"https://t.me/{bot_username}?start={bind_token}"
    return {
        "token": bind_token,
        "bot_username": f"@{bot_username}",
        "deep_link": deep_link,
        "expires_in_seconds": 900,
    }


@router.get(
    "/telegram/bind/status",
    dependencies=[Depends(require_permission("settings.integration"))],
)
async def telegram_bind_status(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    """Return current Telegram binding status for the authenticated user."""
    res = await db.execute(
        text("""
            SELECT chat_id, telegram_username, bound_at
            FROM user_telegram_bindings
            WHERE user_id = :u AND org_id = :o AND is_active = TRUE
        """),
        {"u": user_id, "o": org_id},
    )
    row = res.first()
    if not row:
        return {"bound": False}
    return {
        "bound": True,
        "chat_id": row.chat_id,
        "telegram_username": row.telegram_username,
        "bound_at": row.bound_at.isoformat() if row.bound_at else None,
    }


@router.post(
    "/telegram/bind/unbind",
    dependencies=[Depends(require_permission("settings.integration"))],
)
async def telegram_bind_unbind(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    """Deactivate the Telegram binding for the authenticated user."""
    res = await db.execute(
        text("""
            UPDATE user_telegram_bindings
            SET is_active = FALSE
            WHERE user_id = :u AND org_id = :o AND is_active = TRUE
            RETURNING id
        """),
        {"u": user_id, "o": org_id},
    )
    await db.commit()
    if not res.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Faol bog'liqlik topilmadi")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Didox e-invoice endpoints (scaffold — T-120)
# All three action endpoints return a scaffold note until real credentials are
# provisioned and create_invoice / send_invoice / get_invoice_status are wired.
# ---------------------------------------------------------------------------

_SCAFFOLD_NOTE = {"note": "SCAFFOLD — credentials pending", "stubbed": True}


@router.post("/didox/invoice/create")
async def didox_create_invoice(
    payload: dict = Body(default={}),
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a Didox e-invoice from a sale (scaffold)."""
    svc = DidoxIntegration(db=db, org_id=org_id)
    if not await svc.is_enabled():
        raise HTTPException(status_code=400, detail="Didox integratsiyasi yoqilmagan")

    sale_id = payload.get("sale_id", "")
    if not sale_id:
        raise HTTPException(status_code=422, detail="sale_id majburiy")

    return {
        "invoice_id": "stub-123",
        "status": "draft",
        "sale_id": sale_id,
        **_SCAFFOLD_NOTE,
    }


@router.post("/didox/invoice/{invoice_id}/send")
async def didox_send_invoice(
    invoice_id: str,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Send a Didox e-invoice to the counterparty (scaffold)."""
    svc = DidoxIntegration(db=db, org_id=org_id)
    if not await svc.is_enabled():
        raise HTTPException(status_code=400, detail="Didox integratsiyasi yoqilmagan")

    return {"invoice_id": invoice_id, "status": "sent", **_SCAFFOLD_NOTE}


@router.get("/didox/invoice/{invoice_id}")
async def didox_get_invoice_status(
    invoice_id: str,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Get Didox invoice status (scaffold)."""
    svc = DidoxIntegration(db=db, org_id=org_id)
    if not await svc.is_enabled():
        raise HTTPException(status_code=400, detail="Didox integratsiyasi yoqilmagan")

    return {"invoice_id": invoice_id, "status": "unknown", **_SCAFFOLD_NOTE}


@router.post("/didox/webhook")
async def didox_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive Didox status-change callbacks (scaffold)."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    log.info("didox_webhook body_keys=%s", list(body.keys()))
    return {"ok": True, **_SCAFFOLD_NOTE}
