"""Common helpers for payment provider integrations."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


log = logging.getLogger(__name__)


async def get_payment_settings(db: AsyncSession, org_id: str, provider: str) -> dict[str, Any]:
    """Read provider-specific settings from app_settings.online_payments."""
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'online_payments'"),
        {"o": org_id},
    )
    row = res.first()
    if not row or not row.value:
        return {}
    cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
    # Settings shape:
    #   {"click": {"enabled": true, "merchant_id": "...", "service_id": "...", "secret_key": "..."},
    #    "payme":  {"enabled": true, "merchant_id": "...", "secret_key": "..."},
    #    "apelsin":{"enabled": true, "api_key": "..."}}
    return cfg.get(provider) or {}


async def find_or_create_transaction(
    db: AsyncSession,
    org_id: str,
    provider: str,
    provider_tx_id: str | None,
    sale_id: str | None,
    amount: Decimal,
) -> dict:
    """Return existing transaction (by provider_tx_id) or create new 'pending'."""
    if provider_tx_id:
        res = await db.execute(
            text("""
                SELECT id, status, sale_id, amount, provider_tx_id
                FROM payment_transactions
                WHERE organization_id = :o AND provider = :p AND provider_tx_id = :tx
            """),
            {"o": org_id, "p": provider, "tx": provider_tx_id},
        )
        existing = res.first()
        if existing:
            return dict(existing._mapping)

    res = await db.execute(
        text("""
            INSERT INTO payment_transactions
                (organization_id, provider, provider_tx_id, sale_id, amount, status)
            VALUES (:o, :p, :tx, :s, :a, 'pending')
            RETURNING id, status, sale_id, amount, provider_tx_id
        """),
        {
            "o": org_id, "p": provider, "tx": provider_tx_id,
            "s": sale_id, "a": amount,
        },
    )
    row = res.first()
    await db.commit()
    return dict(row._mapping)


async def mark_transaction(
    db: AsyncSession,
    tx_id: str,
    status: str,
    provider_data: dict | None = None,
    completed: bool = False,
) -> None:
    """Update transaction status."""
    await db.execute(
        text("""
            UPDATE payment_transactions
            SET status = :s,
                provider_data = CASE WHEN :d::text IS NOT NULL
                                THEN CAST(:d AS jsonb) ELSE provider_data END,
                completed_at = CASE WHEN :c THEN NOW() ELSE completed_at END
            WHERE id = :id
        """),
        {
            "id": tx_id, "s": status,
            "d": json.dumps(provider_data, default=str) if provider_data else None,
            "c": completed,
        },
    )
    await db.commit()


async def apply_payment_to_sale(
    db: AsyncSession,
    org_id: str,
    sale_id: str,
    amount: Decimal,
    description: str,
    payment_type_id: int | None = None,
) -> None:
    """Apply a confirmed online payment to the sale (update paid_amount + cash movement)."""
    sale_res = await db.execute(
        text("""
            SELECT total_amount, paid_amount, customer_id, status
            FROM sales WHERE id = :id AND organization_id = :o
        """),
        {"id": sale_id, "o": org_id},
    )
    sale = sale_res.first()
    if not sale:
        return

    new_paid = Decimal(str(sale.paid_amount or 0)) + amount
    total = Decimal(str(sale.total_amount or 0))
    new_status = "paid" if new_paid >= total else "partial"

    await db.execute(
        text("UPDATE sales SET paid_amount = :pa, status = :st WHERE id = :id"),
        {"pa": new_paid, "st": new_status, "id": sale_id},
    )

    # Create cash movement (no cashbox — online payment has no physical cashbox)
    await db.execute(
        text("""
            INSERT INTO cash_movements (
                organization_id, direction, amount, payment_type_id,
                customer_id, sale_id, description
            ) VALUES (:o, 'in', :a, :pt, :c, :s, :d)
        """),
        {
            "o": org_id, "a": amount, "pt": payment_type_id,
            "c": str(sale.customer_id) if sale.customer_id else None,
            "s": sale_id, "d": description,
        },
    )
    await db.commit()
