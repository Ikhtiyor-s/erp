from datetime import date
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id, get_current_user_id


router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskIn(BaseModel):
    title: str
    description: str | None = None
    assignee_id: UUID | None = None
    priority: str = "normal"  # low | normal | high | urgent
    due_date: date | None = None


@router.get("")
async def list_tasks(
    q: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    assignee_id: UUID | None = Query(None),
    priority: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE t.organization_id = :o"
    params: dict = {"o": org_id}
    if q:
        where += " AND (t.title ILIKE :q OR t.description ILIKE :q)"
        params["q"] = f"%{q}%"
    if status_filter:
        where += " AND t.status = :st"
        params["st"] = status_filter
    if assignee_id:
        where += " AND t.assignee_id = :a"
        params["a"] = str(assignee_id)
    if priority:
        where += " AND t.priority = :p"
        params["p"] = priority
    res = await db.execute(
        text(f"SELECT t.id, t.title, t.description, t.status, t.priority, "
             f"t.due_date, t.completed_at, t.created_at, "
             f"t.assignee_id, e.full_name AS assignee_name, "
             f"u.full_name AS created_by_name "
             f"FROM tasks t "
             f"LEFT JOIN employees e ON e.id = t.assignee_id "
             f"LEFT JOIN users u ON u.id = t.created_by "
             f"{where} ORDER BY "
             f"CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 "
             f"WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, "
             f"t.due_date ASC NULLS LAST, t.created_at DESC"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    p: TaskIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    tid = uuid4()
    await db.execute(
        text("INSERT INTO tasks (id, organization_id, title, description, assignee_id, "
             "priority, due_date, created_by) "
             "VALUES (:id, :o, :t, :d, :a, :p, :du, :u)"),
        {"id": str(tid), "o": org_id, "t": p.title, "d": p.description,
         "a": str(p.assignee_id) if p.assignee_id else None,
         "p": p.priority, "du": p.due_date, "u": user_id},
    )
    await db.commit()
    return {"id": str(tid)}


@router.put("/{tid}")
async def update_task(
    tid: UUID, p: TaskIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE tasks SET title=:t, description=:d, assignee_id=:a, "
             "priority=:p, due_date=:du "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(tid), "o": org_id, "t": p.title, "d": p.description,
         "a": str(p.assignee_id) if p.assignee_id else None,
         "p": p.priority, "du": p.due_date},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.put("/{tid}/status")
async def update_status(
    tid: UUID, status_val: str = Query(..., alias="status"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if status_val not in ("todo", "in_progress", "done", "cancelled"):
        raise HTTPException(400, "Invalid status")
    completed_at = "NOW()" if status_val == "done" else "NULL"
    res = await db.execute(
        text(f"UPDATE tasks SET status = :s, completed_at = {completed_at} "
             f"WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(tid), "o": org_id, "s": status_val},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/{tid}")
async def delete_task(
    tid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM tasks WHERE id = :id AND organization_id = :o"),
        {"id": str(tid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}
