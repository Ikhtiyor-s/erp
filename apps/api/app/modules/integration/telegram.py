"""
Telegram bot integration — sends notifications via Telegram Bot API.

Bot token and channel ID are stored per-org in app_settings under key 'crm'.
Reads settings JSONB and dispatches messages via httpx.

Public helpers:
    - notify_sale(db, org_id, sale_dict) — formatted sale notification
    - notify_low_stock(db, org_id, product_name, quantity) — low-stock alert
    - send_raw(db, org_id, text, chat_id=None) — raw text send
    - dispatch_command(db, org_id, update) — route inbound bot commands
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


async def _get_binding(db: AsyncSession, chat_id: int, org_id: str):
    """Return the active binding row for chat_id + org_id, or None."""
    res = await db.execute(
        text("""
            SELECT user_id, org_id
            FROM user_telegram_bindings
            WHERE chat_id = :c AND org_id = :o AND is_active = TRUE
        """),
        {"c": chat_id, "o": org_id},
    )
    return res.first()


async def _cmd_orders(db: AsyncSession, org_id: str, chat_id: int, token: str) -> None:
    """Reply with the last 5 sales for the org."""
    res = await db.execute(
        text("""
            SELECT s.doc_number, s.total_amount, s.created_at,
                   c.name AS customer_name
            FROM sales s
            LEFT JOIN customers c ON c.id = s.customer_id
            WHERE s.organization_id = :o
            ORDER BY s.created_at DESC
            LIMIT 5
        """),
        {"o": org_id},
    )
    rows = list(res)
    if not rows:
        await _send_with_token(token, chat_id, "📋 Hech qanday buyurtma topilmadi.")
        return
    lines = ["📋 <b>Oxirgi 5 ta buyurtma:</b>", ""]
    for r in rows:
        date_str = r.created_at.strftime("%d.%m.%Y") if r.created_at else "—"
        customer = r.customer_name or "Noma'lum"
        lines.append(
            f"• <b>#{r.doc_number}</b> — {customer} "
            f"| {r.total_amount:,.0f} | {date_str}"
        )
    await _send_with_token(token, chat_id, "\n".join(lines))


async def _cmd_stock(db: AsyncSession, org_id: str, chat_id: int, token: str) -> None:
    """Reply with top-5 products whose stock is at or below min_qty."""
    res = await db.execute(
        text("""
            SELECT p.name, rs.min_qty,
                   COALESCE(SUM(sb.quantity), 0) AS current_qty
            FROM recommended_stock rs
            JOIN products p ON p.id = rs.product_id
            LEFT JOIN stock_balances sb
                   ON sb.product_id = rs.product_id
                  AND sb.organization_id = :o
            WHERE rs.organization_id = :o
            GROUP BY p.name, rs.min_qty
            HAVING COALESCE(SUM(sb.quantity), 0) <= rs.min_qty
            ORDER BY (COALESCE(SUM(sb.quantity), 0) - rs.min_qty) ASC
            LIMIT 5
        """),
        {"o": org_id},
    )
    rows = list(res)
    if not rows:
        await _send_with_token(token, chat_id, "✅ Kam qolgan tovarlar yo'q.")
        return
    lines = ["⚠️ <b>Kam qolgan tovarlar (top-5):</b>", ""]
    for r in rows:
        lines.append(
            f"• <b>{r.name}</b> — qoldiq: {r.current_qty:.1f} "
            f"(min: {r.min_qty:.1f})"
        )
    await _send_with_token(token, chat_id, "\n".join(lines))


async def _cmd_balance(db: AsyncSession, org_id: str, chat_id: int, token: str) -> None:
    """Reply with all active cashbox balances."""
    res = await db.execute(
        text("""
            SELECT c.name, c.balance, cur.code AS currency
            FROM cashboxes c
            LEFT JOIN currencies cur ON cur.id = c.currency_id
            WHERE c.organization_id = :o AND c.is_active = TRUE
            ORDER BY c.name
        """),
        {"o": org_id},
    )
    rows = list(res)
    if not rows:
        await _send_with_token(token, chat_id, "💰 Kassalar topilmadi.")
        return
    lines = ["💰 <b>Kassalar qoldig'i:</b>", ""]
    for r in rows:
        lines.append(f"• <b>{r.name}</b>: {r.balance:,.2f} {r.currency or ''}")
    await _send_with_token(token, chat_id, "\n".join(lines))


async def _cmd_help(chat_id: int, token: str) -> None:
    body = (
        "ℹ️ <b>Aniq ERP Bot — Komandalar:</b>\n\n"
        "/buyurtma — oxirgi 5 ta sotuv\n"
        "/qoldiq — kam qolgan tovarlar\n"
        "/balans — kassalar qoldig'i\n"
        "/yordam — yordam menyusi\n"
        "/unbind — botdan uzish\n\n"
        "Botni ulash uchun: Sozlamalar → CRM → Telegramga ulash"
    )
    await _send_with_token(token, chat_id, body)


async def _send_with_token(token: str, chat_id: int, body: str) -> None:
    """Send a message directly via bot token (no DB lookup needed)."""
    await _post(token, "sendMessage", {
        "chat_id": chat_id,
        "text": body,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    })


async def dispatch_command(
    db: AsyncSession, org_id: str, update: dict,
) -> dict:
    """Route inbound Telegram bot commands to appropriate handlers.

    Called from the webhook endpoint. Returns {"ok": True} always so
    Telegram doesn't retry. Requires an active binding for authenticated
    commands; unauthenticated commands (/start, /yordam) work for anyone.
    """
    msg = update.get("message") or update.get("edited_message") or {}
    chat = msg.get("chat", {})
    chat_id = chat.get("id")
    body = (msg.get("text") or "").strip()
    from_username = (msg.get("from") or {}).get("username")

    if not chat_id or not body or not body.startswith("/"):
        return {"ok": True}

    cfg = await _read_crm_settings(db, org_id)
    token = cfg.get("telegram_token") or cfg.get("bot_token")
    if not token:
        return {"ok": True}

    if body.startswith("/start"):
        parts = body.split(None, 1)
        bind_token = parts[1].strip() if len(parts) > 1 else ""
        if bind_token:
            await _handle_bind(db, org_id, chat_id, from_username, bind_token, token)
        else:
            await _cmd_help(chat_id, token)
        return {"ok": True}

    if body.startswith("/yordam") or body.startswith("/help"):
        await _cmd_help(chat_id, token)
        return {"ok": True}

    binding = await _get_binding(db, chat_id, org_id)
    if not binding:
        await _send_with_token(
            token, chat_id,
            "🔒 Bu komanda uchun avval botni ulang.\n"
            "Sozlamalar → CRM → Telegramga ulash — havola oling va /start &lt;token&gt; yuboring.",
        )
        return {"ok": True}

    if body.startswith("/buyurtma"):
        await _cmd_orders(db, org_id, chat_id, token)
    elif body.startswith("/sotuv"):
        parts = body.split(maxsplit=1)
        doc_no = parts[1].strip() if len(parts) > 1 else ""
        if not doc_no:
            await _send_with_token(token, chat_id, "Foydalanish: /sotuv 1234")
        else:
            res = await db.execute(
                text("""
                    SELECT s.doc_number, s.total_amount, s.paid_amount, s.status,
                           c.name AS customer_name
                    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
                    WHERE s.organization_id = :o AND s.doc_number = :d
                    LIMIT 1
                """),
                {"o": org_id, "d": doc_no},
            )
            sale = res.first()
            if not sale:
                await _send_with_token(token, chat_id, f"Sotuv #{doc_no} topilmadi.")
            else:
                debt = float(sale.total_amount or 0) - float(sale.paid_amount or 0)
                await _send_with_token(
                    token, chat_id,
                    f"🧾 <b>Sotuv #{sale.doc_number}</b>\n"
                    f"Mijoz: {sale.customer_name or '—'}\n"
                    f"Holat: {sale.status}\n"
                    f"Jami: {sale.total_amount:,.2f}\n"
                    f"To'langan: {sale.paid_amount:,.2f}\n"
                    f"Qarz: {debt:,.2f}",
                )
    elif body.startswith("/qoldiq"):
        await _cmd_stock(db, org_id, chat_id, token)
    elif body.startswith("/balans"):
        await _cmd_balance(db, org_id, chat_id, token)
    elif body.startswith("/unbind"):
        await db.execute(
            text("""
                UPDATE user_telegram_bindings
                SET is_active = FALSE
                WHERE chat_id = :c AND org_id = :o
            """),
            {"c": chat_id, "o": org_id},
        )
        await db.commit()
        await _send_with_token(token, chat_id, "✅ Bot uzildi. Qayta ulash uchun /start &lt;token&gt; yuboring.")
    else:
        await _send_with_token(token, chat_id, "Noma'lum komanda. /yordam yozing.")

    return {"ok": True}


async def _handle_bind(
    db: AsyncSession,
    org_id: str,
    chat_id: int,
    telegram_username: str | None,
    bind_token: str,
    bot_token: str,
) -> None:
    """Process /start <token> — validate token and create binding."""
    res = await db.execute(
        text("""
            SELECT id FROM users
            WHERE tg_bind_token = :t
              AND tg_bind_token_at > NOW() - INTERVAL '15 minutes'
            LIMIT 1
        """),
        {"t": bind_token},
    )
    user_row = res.first()
    if not user_row:
        await _send_with_token(
            bot_token, chat_id,
            "❌ Token topilmadi yoki muddati o'tgan (15 daqiqa). "
            "Yangi token oling: Sozlamalar → CRM → Telegramga ulash.",
        )
        return

    user_id = str(user_row.id)

    existing = await db.execute(
        text("""
            SELECT id FROM user_telegram_bindings
            WHERE user_id = :u AND org_id = :o
        """),
        {"u": user_id, "o": org_id},
    )
    if existing.first():
        await db.execute(
            text("""
                UPDATE user_telegram_bindings
                SET chat_id = :c, telegram_username = :un,
                    bound_at = NOW(), is_active = TRUE
                WHERE user_id = :u AND org_id = :o
            """),
            {"c": chat_id, "un": telegram_username, "u": user_id, "o": org_id},
        )
    else:
        await db.execute(
            text("""
                INSERT INTO user_telegram_bindings
                    (user_id, org_id, chat_id, telegram_username)
                VALUES (:u, :o, :c, :un)
                ON CONFLICT (user_id, org_id) DO UPDATE
                    SET chat_id = EXCLUDED.chat_id,
                        telegram_username = EXCLUDED.telegram_username,
                        bound_at = NOW(),
                        is_active = TRUE
            """),
            {"u": user_id, "o": org_id, "c": chat_id, "un": telegram_username},
        )

    await db.execute(
        text("UPDATE users SET tg_bind_token = NULL, tg_bind_token_at = NULL WHERE id = :u"),
        {"u": user_id},
    )
    await db.commit()

    await _send_with_token(
        bot_token, chat_id,
        "✅ <b>Ulandi!</b>\n\n"
        "Endi quyidagi komandalardan foydalanishingiz mumkin:\n"
        "/buyurtma — oxirgi buyurtmalar\n"
        "/qoldiq — kam qolgan tovarlar\n"
        "/balans — kassa qoldig'i\n"
        "/yordam — barcha komandalar",
    )


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
