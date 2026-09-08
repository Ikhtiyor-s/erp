"""Double-entry journal posting — the single choke point every future
automatic-posting hook (Phase 2: sales, purchases, write-offs, ...) will
call. Validates that debit == credit (in base currency) before writing
anything; journal_entries/journal_lines are append-only (DB trigger).
"""
from __future__ import annotations

from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class JournalLine:
    def __init__(
        self,
        account_id: int,
        debit: float = 0,
        credit: float = 0,
        currency_id: int | None = None,
        rate: float = 1,
        counterparty_type: str | None = None,
        counterparty_id: str | None = None,
        description: str | None = None,
    ):
        self.account_id = account_id
        self.debit = debit
        self.credit = credit
        self.currency_id = currency_id
        self.rate = rate or 1
        self.counterparty_type = counterparty_type
        self.counterparty_id = counterparty_id
        self.description = description


async def post_journal_entry(
    db: AsyncSession,
    org_id: str,
    lines: list[JournalLine],
    source_type: str,
    source_id: str | None,
    description: str | None,
    user_id: str | None,
    entry_date: str | None = None,
) -> str:
    if len(lines) < 2:
        raise ValueError("A journal entry needs at least 2 lines")

    total_debit_base = sum(round(l.debit * l.rate, 2) for l in lines)
    total_credit_base = sum(round(l.credit * l.rate, 2) for l in lines)
    if abs(total_debit_base - total_credit_base) > 0.01:
        raise ValueError(
            f"Journal entry is not balanced: debit={total_debit_base} != credit={total_credit_base}"
        )
    for l in lines:
        if (l.debit and l.credit) or (not l.debit and not l.credit):
            raise ValueError("Each line must have exactly one of debit/credit set")

    num_res = await db.execute(
        text("SELECT COUNT(*) + 1 AS n FROM journal_entries WHERE organization_id = :o"),
        {"o": org_id},
    )
    entry_no = f"J{num_res.scalar() or 1:06d}"

    entry_id = str(uuid4())
    await db.execute(
        text("""
            INSERT INTO journal_entries
                (id, organization_id, entry_number, entry_date, description, source_type, source_id, created_by)
            VALUES (:id, :o, :n, COALESCE(CAST(:d AS DATE), CURRENT_DATE), :desc, :st, :sid, :u)
        """),
        {
            "id": entry_id, "o": org_id, "n": entry_no, "d": entry_date,
            "desc": description, "st": source_type, "sid": source_id, "u": user_id,
        },
    )

    for l in lines:
        amount_base = round((l.debit or l.credit) * l.rate, 2)
        await db.execute(
            text("""
                INSERT INTO journal_lines
                    (entry_id, account_id, debit, credit, currency_id, rate, amount_base,
                     counterparty_type, counterparty_id, description)
                VALUES (:e, :a, :dr, :cr, :cur, :r, :ab, :ct, :cid, :desc)
            """),
            {
                "e": entry_id, "a": l.account_id, "dr": l.debit, "cr": l.credit,
                "cur": l.currency_id, "r": l.rate, "ab": amount_base,
                "ct": l.counterparty_type, "cid": l.counterparty_id, "desc": l.description,
            },
        )

    return entry_id


async def post_journal_entry_or_422(db: AsyncSession, *args, **kwargs) -> str:
    """Same as post_journal_entry but raises HTTPException 422 on validation errors
    (for use directly inside a request handler)."""
    try:
        return await post_journal_entry(db, *args, **kwargs)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))


# =========================================================
# Phase 2 — helpers for automatic-posting hooks in other modules.
# Standard account codes, matching the seed in schema_patches.py /
# auth/router.py register(). Callers look these up by semantic name so
# they never hardcode a numeric account id.
# =========================================================

DEFAULT_ACCOUNT_CODES = {
    "cash": "1000",
    "ar": "1200",              # Mijozlar qarzi
    "inventory": "1300",       # Tovar-moddiy zaxiralar
    "ap": "2000",              # Yetkazib beruvchilar qarzi
    "equity": "3000",
    "revenue": "4000",         # Sotuvdan tushum
    "cogs": "5000",            # Sotilgan tovar tannarxi
    "write_off_expense": "5100",
    "other_expense": "5200",
    "payroll_payable": "2100",  # Ish haqi bo'yicha qarzdorlik
    "tax_payable": "2200",      # Soliq bo'yicha qarz (ushlab qolingan NDFL)
    "payroll_expense": "5300",  # Ish haqi xarajati
}


async def get_default_account_id(db: AsyncSession, org_id: str, key: str) -> int | None:
    code = DEFAULT_ACCOUNT_CODES[key]
    res = await db.execute(
        text("SELECT id FROM accounts WHERE organization_id = :o AND code = :c"),
        {"o": org_id, "c": code},
    )
    return res.scalar()


async def ensure_cashbox_account(db: AsyncSession, org_id: str, cashbox_id: int, cashbox_name: str) -> None:
    """Auto-create a linked ledger sub-account for a cashbox, if it doesn't
    have one yet. Called when a new cashbox is created after the org's
    chart of accounts already exists (registration/backfill only cover
    cashboxes that existed at that moment)."""
    exists = await db.execute(
        text("SELECT 1 FROM accounts WHERE organization_id = :o AND linked_cashbox_id = :cb"),
        {"o": org_id, "cb": cashbox_id},
    )
    if exists.scalar():
        return
    parent_id = await get_default_account_id(db, org_id, "cash")
    if parent_id is None:
        return  # org has no chart of accounts at all (shouldn't happen post-Phase-1) — skip silently
    await db.execute(
        text("""
            INSERT INTO accounts (organization_id, code, name, type, parent_id, linked_cashbox_id, is_system)
            VALUES (:o, :code, :n, 'asset', :p, :cb, TRUE)
            ON CONFLICT (organization_id, code) DO NOTHING
        """),
        {"o": org_id, "code": f"1000-{cashbox_id}", "n": cashbox_name, "p": parent_id, "cb": cashbox_id},
    )


async def get_cashbox_account_id(db: AsyncSession, org_id: str, cashbox_id: int | None) -> int | None:
    """The ledger sub-account linked to a specific cashbox, or the top-level
    'Kassa va bank' account if cashbox_id is None (e.g. online payments).
    Self-healing: if the cashbox exists but has no linked account yet
    (created via a code path that predates/skips ensure_cashbox_account),
    create one on the fly rather than silently posting against the generic
    parent account."""
    if cashbox_id is not None:
        res = await db.execute(
            text("SELECT id FROM accounts WHERE organization_id = :o AND linked_cashbox_id = :cb"),
            {"o": org_id, "cb": cashbox_id},
        )
        row = res.scalar()
        if row:
            return row
        cb = await db.execute(text("SELECT name FROM cashboxes WHERE id = :cb"), {"cb": cashbox_id})
        cb_row = cb.first()
        if cb_row:
            await ensure_cashbox_account(db, org_id, cashbox_id, cb_row.name)
            res2 = await db.execute(
                text("SELECT id FROM accounts WHERE organization_id = :o AND linked_cashbox_id = :cb"),
                {"o": org_id, "cb": cashbox_id},
            )
            row2 = res2.scalar()
            if row2:
                return row2
    return await get_default_account_id(db, org_id, "cash")
