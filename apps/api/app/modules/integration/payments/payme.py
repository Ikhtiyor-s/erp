"""
Payme Merchant API integration (publicly documented JSON-RPC protocol).

Payme calls the merchant's webhook with these methods:
  - CheckPerformTransaction — verify sale exists and is payable
  - CreateTransaction       — reserve sale for payment
  - PerformTransaction      — finalize payment
  - CancelTransaction       — reverse if needed
  - CheckTransaction        — query state
  - GetStatement            — period summary (optional)

Authorization is Basic auth using the merchant's KEY (test or production).
Amounts are in tiyin (1 sum = 100 tiyin).
"""
from __future__ import annotations

import base64
import logging
import secrets
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.integration.payments.base import (
    apply_payment_to_sale,
    get_payment_settings,
)


log = logging.getLogger(__name__)


# Payme JSON-RPC error codes (per public spec)
class PaymeError:
    AUTH_FAILED = -32504
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    TRANSACTION_NOT_FOUND = -31003
    CANNOT_PERFORM = -31008
    INCORRECT_AMOUNT = -31001
    ACCOUNT_NOT_FOUND = -31050  # sale_id missing
    ACCOUNT_NOT_ACTIVE = -31051
    ALREADY_DONE = -31060
    OPERATION_NOT_ALLOWED = -31062


def _err(rpc_id, code: int, message_uz: str, data: str | None = None) -> dict:
    out = {
        "jsonrpc": "2.0",
        "id": rpc_id,
        "error": {
            "code": code,
            "message": {"uz": message_uz, "ru": message_uz, "en": message_uz},
        },
    }
    if data:
        out["error"]["data"] = data
    return out


def _check_basic_auth(auth_header: str, key: str) -> bool:
    if not auth_header.lower().startswith("basic "):
        return False
    try:
        decoded = base64.b64decode(auth_header.split(" ", 1)[1]).decode()
        # decoded is "Paycom:<KEY>" per Payme spec
        return decoded.endswith(f":{key}")
    except Exception:
        return False


async def _get_sale(db: AsyncSession, org_id: str, sale_id: str):
    res = await db.execute(
        text("SELECT id, total_amount, paid_amount, status, customer_id "
             "FROM sales WHERE id = :id AND organization_id = :o"),
        {"id": sale_id, "o": org_id},
    )
    return res.first()


async def handle_payme(
    db: AsyncSession,
    org_id: str,
    auth_header: str,
    body: dict[str, Any],
) -> dict:
    """Dispatch a Payme JSON-RPC request and return the response dict."""
    cfg = await get_payment_settings(db, org_id, "payme")
    if not cfg.get("enabled"):
        return _err(body.get("id"), PaymeError.AUTH_FAILED,
                    "Payme sozlanmagan")

    secret = cfg.get("secret_key") or ""
    if not _check_basic_auth(auth_header, secret):
        return _err(body.get("id"), PaymeError.AUTH_FAILED, "Auth muvaffaqiyatsiz")

    method = body.get("method")
    params = body.get("params") or {}
    rpc_id = body.get("id")

    if method == "CheckPerformTransaction":
        return await _check_perform(db, org_id, params, rpc_id)
    if method == "CreateTransaction":
        return await _create_tx(db, org_id, params, rpc_id)
    if method == "PerformTransaction":
        return await _perform_tx(db, org_id, params, rpc_id)
    if method == "CancelTransaction":
        return await _cancel_tx(db, org_id, params, rpc_id)
    if method == "CheckTransaction":
        return await _check_tx(db, org_id, params, rpc_id)
    if method == "GetStatement":
        return await _get_statement(db, org_id, params, rpc_id)

    return _err(rpc_id, PaymeError.METHOD_NOT_FOUND, f"Method noma'lum: {method}")


async def _check_perform(db, org_id, params, rpc_id):
    account = params.get("account") or {}
    sale_id = account.get("sale_id")
    amount_tiyin = params.get("amount")
    if not sale_id or amount_tiyin is None:
        return _err(rpc_id, PaymeError.INVALID_PARAMS, "Parametrlar yetishmaydi")
    sale = await _get_sale(db, org_id, sale_id)
    if not sale:
        return _err(rpc_id, PaymeError.ACCOUNT_NOT_FOUND, "Sotuv topilmadi",
                    data="sale_id")
    if sale.status == "cancelled":
        return _err(rpc_id, PaymeError.ACCOUNT_NOT_ACTIVE, "Sotuv bekor qilingan")

    debt_sum = Decimal(str(sale.total_amount)) - Decimal(str(sale.paid_amount))
    pay_sum = Decimal(amount_tiyin) / 100
    if pay_sum > debt_sum + Decimal("0.01"):
        return _err(rpc_id, PaymeError.INCORRECT_AMOUNT, "Summa qarzdan ko'p")

    return {"jsonrpc": "2.0", "id": rpc_id, "result": {"allow": True}}


async def _create_tx(db, org_id, params, rpc_id):
    payme_id = params.get("id")
    payme_time = params.get("time")  # ms
    amount_tiyin = params.get("amount")
    account = params.get("account") or {}
    sale_id = account.get("sale_id")

    if not all([payme_id, sale_id, amount_tiyin is not None]):
        return _err(rpc_id, PaymeError.INVALID_PARAMS, "Parametrlar yetishmaydi")

    sale = await _get_sale(db, org_id, sale_id)
    if not sale:
        return _err(rpc_id, PaymeError.ACCOUNT_NOT_FOUND, "Sotuv topilmadi")

    pay_sum = Decimal(amount_tiyin) / 100

    # Check if transaction exists
    tx_res = await db.execute(
        text("""
            SELECT id, status, created_at FROM payment_transactions
            WHERE organization_id = :o AND provider = 'payme' AND provider_tx_id = :tx
        """),
        {"o": org_id, "tx": payme_id},
    )
    tx = tx_res.first()
    if tx:
        if tx.status == "pending":
            return {
                "jsonrpc": "2.0", "id": rpc_id,
                "result": {
                    "create_time": int(tx.created_at.timestamp() * 1000),
                    "transaction": str(tx.id),
                    "state": 1,
                },
            }
        return _err(rpc_id, PaymeError.OPERATION_NOT_ALLOWED, "Tranzaksiya holati noto'g'ri")

    # Create new transaction
    res = await db.execute(
        text("""
            INSERT INTO payment_transactions
                (organization_id, provider, provider_tx_id, sale_id, amount, status)
            VALUES (:o, 'payme', :tx, :s, :a, 'pending')
            RETURNING id, created_at
        """),
        {"o": org_id, "tx": payme_id, "s": sale_id, "a": pay_sum},
    )
    row = res.first()
    await db.commit()
    return {
        "jsonrpc": "2.0", "id": rpc_id,
        "result": {
            "create_time": int(row.created_at.timestamp() * 1000),
            "transaction": str(row.id),
            "state": 1,
        },
    }


async def _perform_tx(db, org_id, params, rpc_id):
    payme_id = params.get("id")
    tx_res = await db.execute(
        text("""
            SELECT id, status, sale_id, amount, completed_at
            FROM payment_transactions
            WHERE organization_id = :o AND provider = 'payme' AND provider_tx_id = :tx
        """),
        {"o": org_id, "tx": payme_id},
    )
    tx = tx_res.first()
    if not tx:
        return _err(rpc_id, PaymeError.TRANSACTION_NOT_FOUND, "Tranzaksiya topilmadi")

    if tx.status == "paid":
        return {
            "jsonrpc": "2.0", "id": rpc_id,
            "result": {
                "perform_time": int(tx.completed_at.timestamp() * 1000),
                "transaction": str(tx.id),
                "state": 2,
            },
        }
    if tx.status != "pending":
        return _err(rpc_id, PaymeError.OPERATION_NOT_ALLOWED, "Holat noto'g'ri")

    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            UPDATE payment_transactions
            SET status = 'paid', completed_at = :t
            WHERE id = :id
        """),
        {"id": str(tx.id), "t": now},
    )
    await apply_payment_to_sale(
        db, org_id, str(tx.sale_id), Decimal(str(tx.amount)),
        description=f"Payme to'lov #{payme_id}",
    )

    return {
        "jsonrpc": "2.0", "id": rpc_id,
        "result": {
            "perform_time": int(now.timestamp() * 1000),
            "transaction": str(tx.id),
            "state": 2,
        },
    }


async def _cancel_tx(db, org_id, params, rpc_id):
    payme_id = params.get("id")
    reason = params.get("reason")
    tx_res = await db.execute(
        text("""
            SELECT id, status, sale_id, amount, completed_at
            FROM payment_transactions
            WHERE organization_id = :o AND provider = 'payme' AND provider_tx_id = :tx
        """),
        {"o": org_id, "tx": payme_id},
    )
    tx = tx_res.first()
    if not tx:
        return _err(rpc_id, PaymeError.TRANSACTION_NOT_FOUND, "Tranzaksiya topilmadi")

    new_state = -2 if tx.status == "paid" else -1
    await db.execute(
        text("""
            UPDATE payment_transactions
            SET status = 'cancelled', completed_at = COALESCE(completed_at, NOW())
            WHERE id = :id
        """),
        {"id": str(tx.id)},
    )
    await db.commit()
    return {
        "jsonrpc": "2.0", "id": rpc_id,
        "result": {
            "cancel_time": int(datetime.now(timezone.utc).timestamp() * 1000),
            "transaction": str(tx.id),
            "state": new_state,
        },
    }


async def _check_tx(db, org_id, params, rpc_id):
    payme_id = params.get("id")
    tx_res = await db.execute(
        text("""
            SELECT id, status, created_at, completed_at
            FROM payment_transactions
            WHERE organization_id = :o AND provider = 'payme' AND provider_tx_id = :tx
        """),
        {"o": org_id, "tx": payme_id},
    )
    tx = tx_res.first()
    if not tx:
        return _err(rpc_id, PaymeError.TRANSACTION_NOT_FOUND, "Topilmadi")

    state_map = {"pending": 1, "paid": 2, "cancelled": -1}
    return {
        "jsonrpc": "2.0", "id": rpc_id,
        "result": {
            "create_time": int(tx.created_at.timestamp() * 1000),
            "perform_time": int(tx.completed_at.timestamp() * 1000) if tx.completed_at else 0,
            "cancel_time": int(tx.completed_at.timestamp() * 1000) if tx.status == "cancelled" and tx.completed_at else 0,
            "transaction": str(tx.id),
            "state": state_map.get(tx.status, 0),
            "reason": None,
        },
    }


async def _get_statement(db, org_id, params, rpc_id):
    from_ms = params.get("from", 0)
    to_ms = params.get("to", int(time.time() * 1000))
    res = await db.execute(
        text("""
            SELECT id, provider_tx_id, amount, status, created_at, completed_at
            FROM payment_transactions
            WHERE organization_id = :o AND provider = 'payme'
              AND created_at >= to_timestamp(:f / 1000.0)
              AND created_at < to_timestamp(:t / 1000.0)
            ORDER BY created_at
        """),
        {"o": org_id, "f": from_ms, "t": to_ms},
    )
    state_map = {"pending": 1, "paid": 2, "cancelled": -1}
    transactions = []
    for r in res:
        transactions.append({
            "id": r.provider_tx_id,
            "time": int(r.created_at.timestamp() * 1000),
            "amount": int(float(r.amount) * 100),
            "transaction": str(r.id),
            "state": state_map.get(r.status, 0),
            "create_time": int(r.created_at.timestamp() * 1000),
            "perform_time": int(r.completed_at.timestamp() * 1000) if r.completed_at and r.status == "paid" else 0,
            "cancel_time": int(r.completed_at.timestamp() * 1000) if r.completed_at and r.status == "cancelled" else 0,
        })
    return {"jsonrpc": "2.0", "id": rpc_id, "result": {"transactions": transactions}}
