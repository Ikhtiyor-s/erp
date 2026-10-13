from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_active_session_id(db: AsyncSession, cashbox_id: int | None) -> str | None:
    """Resolve the currently-open cashbox_sessions row for a cashbox, if any.

    Used to stamp cash_movements.cashbox_session_id so that shift
    totals/reports and auto-inkassatsiya (mobile/router.py::close_session)
    can actually see the movements that happened during that shift —
    without this, cashbox_session_id was never populated by any caller
    and every session's computed totals were silently always zero.
    """
    if cashbox_id is None:
        return None
    res = await db.execute(
        text("SELECT id FROM cashbox_sessions WHERE cashbox_id = :c AND status = 'open' "
             "ORDER BY opened_at DESC LIMIT 1"),
        {"c": cashbox_id},
    )
    row = res.first()
    return str(row.id) if row else None
