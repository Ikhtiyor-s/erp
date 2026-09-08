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
