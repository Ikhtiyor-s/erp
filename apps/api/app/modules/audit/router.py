"""Audit log query endpoints."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_db


router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
async def list_logs(
    entity: str | None = Query(None, description="Filter by entity type (e.g. sales, products)"),
    entity_id: str | None = Query(None, description="Filter by specific entity ID"),
    action: str | None = Query(None, description="Filter by action (create, update, delete, ...)"),
    user_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    q: str | None = Query(None, description="Free-text search in diff JSON"),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Query audit log with filters."""
    where = ["a.organization_id = :o"]
    params: dict = {"o": org_id, "lim": limit, "off": offset}

    if entity:
        where.append("a.entity = :e")
        params["e"] = entity
    if entity_id:
        where.append("a.entity_id = :eid")
        params["eid"] = entity_id
    if action:
        where.append("a.action = :a")
        params["a"] = action
    if user_id:
        where.append("a.user_id = :u")
        params["u"] = user_id
    if date_from:
        where.append("a.created_at >= :df")
        params["df"] = date_from
    if date_to:
        where.append("a.created_at < (CAST(:dt AS date) + INTERVAL '1 day')")
        params["dt"] = date_to
    if q:
        where.append("a.diff::text ILIKE :q")
        params["q"] = f"%{q}%"

    where_sql = " AND ".join(where)

    rows_res = await db.execute(
        text(f"""
            SELECT a.id, a.action, a.entity, a.entity_id, a.diff,
                   a.ip::text AS ip, a.user_agent, a.created_at,
                   u.full_name AS user_name, u.email AS user_email
            FROM audit_log a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE {where_sql}
            ORDER BY a.created_at DESC
            LIMIT :lim OFFSET :off
        """),
        params,
    )
    rows = [dict(r._mapping) for r in rows_res]

    count_res = await db.execute(
        text(f"SELECT COUNT(*) AS n FROM audit_log a WHERE {where_sql}"),
        {k: v for k, v in params.items() if k not in ("lim", "off")},
    )
    total = count_res.scalar() or 0

    return {"rows": rows, "total": total, "limit": limit, "offset": offset}


@router.get("/entities")
async def list_entities(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Distinct entity types present in audit log (for filter dropdown)."""
    res = await db.execute(
        text("""
            SELECT entity, COUNT(*) AS n
            FROM audit_log
            WHERE organization_id = :o
            GROUP BY entity
            ORDER BY n DESC, entity
        """),
        {"o": org_id},
    )
    return [{"entity": r.entity, "count": r.n} for r in res]


@router.get("/actions")
async def list_actions(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Distinct actions present in audit log."""
    res = await db.execute(
        text("""
            SELECT action, COUNT(*) AS n
            FROM audit_log
            WHERE organization_id = :o
            GROUP BY action
            ORDER BY n DESC, action
        """),
        {"o": org_id},
    )
    return [{"action": r.action, "count": r.n} for r in res]
