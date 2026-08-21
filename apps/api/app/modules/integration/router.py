"""Integration endpoints — Telegram, online payments (Click/Payme)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_db
from app.modules.integration.telegram import test_connection, send_raw
from app.modules.integration.payments.click import handle_click_webhook
from app.modules.integration.payments.payme import handle_payme


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

    # Resolve org from code in URL
    org_res = await db.execute(
        text("SELECT id FROM organizations WHERE code = :c"),
        {"c": org_code.upper()},
    )
    row = org_res.first()
    if not row:
        return {"ok": True}
    org_id = str(row.id)

    msg = update.get("message") or update.get("edited_message") or {}
    chat = msg.get("chat", {})
    chat_id = chat.get("id")
    body = (msg.get("text") or "").strip()

    if not chat_id or not body:
        return {"ok": True}

    # Simple command handlers
    if body.startswith("/start"):
        await send_raw(
            db, org_id,
            "👋 <b>Aniq ERP — Telegram bot</b>\n\n"
            "Mavjud komandalar:\n"
            "  /balans — joriy kassalar qoldig'i\n"
            "  /sotuv &lt;raqam&gt; — sotuv tafsiloti\n"
            "  /yordam — yordam menyusi",
            chat_id=chat_id,
        )
    elif body.startswith("/balans"):
        cash_res = await db.execute(
            text("""
                SELECT c.name, c.balance, cur.code AS currency
                FROM cashboxes c
                LEFT JOIN currencies cur ON cur.id = c.currency_id
                WHERE c.organization_id = :o AND c.is_active = TRUE
                ORDER BY c.name
            """),
            {"o": org_id},
        )
        rows = list(cash_res)
        if not rows:
            await send_raw(db, org_id, "Kassalar topilmadi.", chat_id=chat_id)
        else:
            lines = ["💰 <b>Kassalar qoldig'i</b>", ""]
            for r in rows:
                lines.append(f"• <b>{r.name}</b>: {r.balance:,.2f} {r.currency or ''}")
            await send_raw(db, org_id, "\n".join(lines), chat_id=chat_id)
    elif body.startswith("/sotuv"):
        parts = body.split(maxsplit=1)
        doc_no = parts[1].strip() if len(parts) > 1 else ""
        if not doc_no:
            await send_raw(db, org_id, "Foydalanish: /sotuv 1234", chat_id=chat_id)
        else:
            sale_res = await db.execute(
                text("""
                    SELECT s.doc_number, s.total_amount, s.paid_amount, s.status,
                           c.name AS customer_name
                    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
                    WHERE s.organization_id = :o AND s.doc_number = :d
                    LIMIT 1
                """),
                {"o": org_id, "d": doc_no},
            )
            sale = sale_res.first()
            if not sale:
                await send_raw(db, org_id, f"Sotuv #{doc_no} topilmadi.", chat_id=chat_id)
            else:
                debt = float(sale.total_amount or 0) - float(sale.paid_amount or 0)
                await send_raw(
                    db, org_id,
                    f"🧾 <b>Sotuv #{sale.doc_number}</b>\n"
                    f"Mijoz: {sale.customer_name or '—'}\n"
                    f"Holat: {sale.status}\n"
                    f"Jami: {sale.total_amount:,.2f}\n"
                    f"To'langan: {sale.paid_amount:,.2f}\n"
                    f"Qarz: {debt:,.2f}",
                    chat_id=chat_id,
                )
    elif body.startswith("/yordam"):
        await send_raw(
            db, org_id,
            "ℹ️ <b>Yordam</b>\n\n"
            "Bu bot Aniq ERP tizimi bilan integratsiyalashgan.\n"
            "Sotuvlar avtomatik xabarnoma sifatida yuboriladi.\n\n"
            "Komandalar: /balans, /sotuv &lt;raqam&gt;, /yordam",
            chat_id=chat_id,
        )

    return {"ok": True}
