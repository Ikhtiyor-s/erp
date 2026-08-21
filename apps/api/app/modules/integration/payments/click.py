"""
Click Merchant API integration (publicly documented protocol).

Click uses a two-stage webhook:
1. action=0 (prepare): merchant returns confirm/reject + merchant_prepare_id
2. action=1 (complete): merchant finalizes and returns merchant_confirm_id

Both stages require a SHA1 signature over a fixed parameter sequence using
the merchant's secret_key.
"""
from __future__ import annotations

import hashlib
import logging
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.modules.integration.payments.base import (
    apply_payment_to_sale,
    find_or_create_transaction,
    get_payment_settings,
    mark_transaction,
)


log = logging.getLogger(__name__)


def _sign_prepare(click_trans_id: str, service_id: str, secret: str,
                  merchant_trans_id: str, amount: str, action: str,
                  sign_time: str) -> str:
    raw = (
        f"{click_trans_id}{service_id}{secret}{merchant_trans_id}"
        f"{amount}{action}{sign_time}"
    )
    return hashlib.md5(raw.encode()).hexdigest()


def _sign_complete(click_trans_id: str, service_id: str, secret: str,
                   merchant_trans_id: str, merchant_prepare_id: str,
                   amount: str, action: str, sign_time: str) -> str:
    raw = (
        f"{click_trans_id}{service_id}{secret}{merchant_trans_id}"
        f"{merchant_prepare_id}{amount}{action}{sign_time}"
    )
    return hashlib.md5(raw.encode()).hexdigest()


# Click protocol error codes
class ClickError:
    SUCCESS = 0
    SIGN_CHECK_FAILED = -1
    INCORRECT_AMOUNT = -2
    ACTION_NOT_FOUND = -3
    ALREADY_PAID = -4
    USER_NOT_FOUND = -5
    TRANSACTION_NOT_FOUND = -6
    BAD_REQUEST = -8
    TRANSACTION_CANCELLED = -9


async def handle_click_webhook(
    db: AsyncSession,
    org_id: str,
    payload: dict[str, Any],
) -> dict:
    """
    Process a Click webhook (action=0 prepare, action=1 complete).

    payload keys (form-encoded):
      click_trans_id, service_id, click_paydoc_id,
      merchant_trans_id (= sale_id), amount, action, sign_time, sign_string
      merchant_prepare_id (only on action=1)
    """
    cfg = await get_payment_settings(db, org_id, "click")
    if not cfg.get("enabled"):
        return {"error": ClickError.BAD_REQUEST, "error_note": "Click sozlanmagan"}

    service_id = cfg.get("service_id") or ""
    secret = cfg.get("secret_key") or ""

    click_trans_id = str(payload.get("click_trans_id", ""))
    merchant_trans_id = str(payload.get("merchant_trans_id", ""))
    amount = str(payload.get("amount", ""))
    action = str(payload.get("action", ""))
    sign_time = str(payload.get("sign_time", ""))
    sign_string = str(payload.get("sign_string", ""))

    # ---- Sign verification ----
    if action == "0":
        expected = _sign_prepare(click_trans_id, service_id, secret,
                                  merchant_trans_id, amount, action, sign_time)
    else:
        merchant_prepare_id = str(payload.get("merchant_prepare_id", ""))
        expected = _sign_complete(click_trans_id, service_id, secret,
                                   merchant_trans_id, merchant_prepare_id,
                                   amount, action, sign_time)
    if expected.lower() != sign_string.lower():
        return {"error": ClickError.SIGN_CHECK_FAILED,
                "error_note": "Sign verification failed"}

    # ---- Resolve sale ----
    sale_res = await db.execute(
        text("SELECT id, total_amount, paid_amount, status FROM sales "
             "WHERE id = :id AND organization_id = :o"),
        {"id": merchant_trans_id, "o": org_id},
    )
    sale = sale_res.first()
    if not sale:
        return {"error": ClickError.USER_NOT_FOUND, "error_note": "Sotuv topilmadi"}

    if sale.status == "cancelled":
        return {"error": ClickError.TRANSACTION_CANCELLED,
                "error_note": "Sotuv bekor qilingan"}

    debt = Decimal(str(sale.total_amount)) - Decimal(str(sale.paid_amount))
    pay_amount = Decimal(amount)
    if pay_amount > debt + Decimal("0.01"):
        return {"error": ClickError.INCORRECT_AMOUNT,
                "error_note": "Summa qarzdan ko'p"}

    # ---- Action handler ----
    if action == "0":
        # Prepare — create pending transaction
        tx = await find_or_create_transaction(
            db, org_id, "click", click_trans_id,
            sale_id=merchant_trans_id, amount=pay_amount,
        )
        await mark_transaction(db, str(tx["id"]), "pending", payload)
        return {
            "click_trans_id": click_trans_id,
            "merchant_trans_id": merchant_trans_id,
            "merchant_prepare_id": str(tx["id"]),
            "error": ClickError.SUCCESS,
            "error_note": "Success",
        }
    elif action == "1":
        # Complete — finalize payment
        merchant_prepare_id = str(payload.get("merchant_prepare_id", ""))
        tx_res = await db.execute(
            text("SELECT id, status FROM payment_transactions WHERE id = :id"),
            {"id": merchant_prepare_id},
        )
        tx = tx_res.first()
        if not tx:
            return {"error": ClickError.TRANSACTION_NOT_FOUND,
                    "error_note": "Tranzaksiya topilmadi"}
        if tx.status == "paid":
            return {"error": ClickError.ALREADY_PAID, "error_note": "Allaqachon to'langan"}

        await mark_transaction(db, str(tx.id), "paid", payload, completed=True)
        await apply_payment_to_sale(
            db, org_id, merchant_trans_id, pay_amount,
            description=f"Click to'lov #{click_trans_id}",
        )
        return {
            "click_trans_id": click_trans_id,
            "merchant_trans_id": merchant_trans_id,
            "merchant_confirm_id": str(tx.id),
            "error": ClickError.SUCCESS,
            "error_note": "Success",
        }
    else:
        return {"error": ClickError.ACTION_NOT_FOUND,
                "error_note": "action 0 yoki 1 bo'lishi kerak"}
