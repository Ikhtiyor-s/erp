"""
Telegram bot integration — sends notifications via Telegram Bot API.

Bot token and channel ID are stored per-org in app_settings under key 'crm'.
Reads settings JSONB and dispatches messages via httpx.

Public helpers:
    - notify_sale(db, org_id, sale_dict) — formatted sale notification
    - notify_low_stock(db, org_id, product_name, quantity) — low-stock alert
    - send_raw(db, org_id, text, chat_id=None) — raw text send

All calls are fire-and-forget: errors are logged but never propagate.
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


log = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"


async def _read_crm_settings(db: AsyncSession, org_id: str) -> dict[str, Any]:
    """Fetch CRM settings (bot token, channel ID, flags) from app_settings."""
    res = await db.execute(
        text("SELECT value FROM app_settings "
             "WHERE organization_id = :o AND key = 'crm'"),
        {"o": org_id},
    )
    row = res.first()
    if not row or not row.value:
        return {}
    return row.value if isinstance(row.value, dict) else json.loads(row.value)


async def _post(token: str, method: str, payload: dict) -> dict | None:
    """Call Telegram Bot API method. Returns response dict or None on error."""
    url = f"{TELEGRAM_API}/bot{token}/{method}"
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(url, json=payload)
            if r.status_code >= 400:
                log.warning("Telegram %s failed: %s %s", method, r.status_code, r.text[:200])
                return None
            return r.json()
    except Exception as e:
        log.warning("Telegram %s exception: %s", method, e)
        return None


def _fmt_money(v) -> str:
    return f"{Decimal(str(v or 0)):,.2f}".replace(",", " ")


async def send_raw(
    db: AsyncSession, org_id: str, text_body: str,
    chat_id: str | int | None = None,
    parse_mode: str = "HTML",
) -> bool:
    """Send arbitrary text to configured channel (or override chat_id)."""
    cfg = await _read_crm_settings(db, org_id)
    token = cfg.get("telegram_token") or cfg.get("bot_token")
    target = chat_id or cfg.get("telegram_channel_id") or cfg.get("channel_id")
    if not token or not target:
        return False
    result = await _post(token, "sendMessage", {
        "chat_id": target,
        "text": text_body,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    })
    return result is not None


async def notify_sale(db: AsyncSession, org_id: str, sale: dict) -> bool:
    """Format and send a sale notification."""
    cfg = await _read_crm_settings(db, org_id)
    if not cfg.get("notify_sale", True):
        return False  # disabled in settings

    head = sale.get("head", sale)
    items = sale.get("items", [])
    doc_no = head.get("doc_number") or str(head.get("id", ""))[:8]
    customer = head.get("customer_name") or "Chakana xaridor"
    warehouse = head.get("warehouse_name") or "—"
    total = head.get("total_amount", 0)
    paid = head.get("paid_amount", 0)
    cur = head.get("currency_code") or ""

    item_lines = []
    for it in items[:10]:  # cap at 10 items
        name = (it.get("product_name") or "")[:40]
        qty = it.get("quantity", 0)
        price = it.get("price", 0)
        item_lines.append(f"  • {name} — {qty} x {_fmt_money(price)}")
    if len(items) > 10:
        item_lines.append(f"  ... va yana {len(items) - 10} ta")

    body = (
        f"🧾 <b>Yangi sotuv № {doc_no}</b>\n"
        f"<i>Mijoz:</i> {customer}\n"
        f"<i>Ombor:</i> {warehouse}\n\n"
        + ("\n".join(item_lines) + "\n\n" if item_lines else "")
        + f"<b>Jami:</b> {_fmt_money(total)} {cur}\n"
        f"<b>To'langan:</b> {_fmt_money(paid)} {cur}\n"
        f"#sotuv #aniqerp"
    )
    return await send_raw(db, org_id, body)


async def notify_low_stock(
    db: AsyncSession, org_id: str, product_name: str,
    quantity, minimum,
) -> bool:
    cfg = await _read_crm_settings(db, org_id)
    if not cfg.get("notify_low_stock", True):
        return False
    body = (
        f"⚠️ <b>Past qoldiq:</b> {product_name}\n"
        f"Hozir: <b>{quantity}</b> dona (minimum: {minimum})\n"
        f"#qoldiq #ogohlantirish"
    )
    return await send_raw(db, org_id, body)


async def test_connection(db: AsyncSession, org_id: str) -> dict:
    """
    Test that the bot token works. Returns dict with success/error.
    Used by /integration/telegram/test endpoint.
    """
    cfg = await _read_crm_settings(db, org_id)
    token = cfg.get("telegram_token") or cfg.get("bot_token")
    if not token:
        return {"ok": False, "error": "Bot token sozlanmagan (Sozlamalar → CRM)"}

    result = await _post(token, "getMe", {})
    if not result or not result.get("ok"):
        return {"ok": False, "error": "Token noto'g'ri yoki bot mavjud emas"}

    bot = result.get("result", {})
    info = {
        "ok": True,
        "bot_username": bot.get("username"),
        "bot_name": bot.get("first_name"),
        "channel_id": cfg.get("telegram_channel_id") or cfg.get("channel_id"),
    }

    # Try sending a test message
    target = info["channel_id"]
    if target:
        test_msg = await send_raw(
            db, org_id,
            "✅ <b>Aniq ERP</b>\nTelegram ulanish muvaffaqiyatli sinaldi.",
        )
        info["test_sent"] = test_msg
    else:
        info["test_sent"] = False
        info["warning"] = "Channel ID sozlanmagan"

    return info
