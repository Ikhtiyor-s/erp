"""
Audit logger — helper to record user actions to the audit_log table.

Usage in router code:
    from app.modules.audit.logger import log_action
    await log_action(db, org_id, user_id, "create", "sales", str(sale_id),
                     diff={"new": {"total": 100000}}, request=request)
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def log_action(
    db: AsyncSession,
    org_id: str | None,
    user_id: str | None,
    action: str,
    entity: str,
    entity_id: str | None = None,
    diff: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """
    Insert an audit_log entry. Best-effort; swallows errors so audit failure
    never breaks the actual business operation.
    """
    try:
        ip = None
        ua = None
        if request:
            client = getattr(request, "client", None)
            if client:
                ip = client.host
            ua = request.headers.get("user-agent")

        await db.execute(
            text("""
                INSERT INTO audit_log
                    (organization_id, user_id, action, entity, entity_id, diff, ip, user_agent)
                VALUES
                    (:o, :u, :a, :e, :eid, CAST(:d AS jsonb), CAST(:ip AS inet), :ua)
            """),
            {
                "o": org_id,
                "u": user_id,
                "a": action[:50],
                "e": entity[:100],
                "eid": entity_id,
                "d": json.dumps(diff, default=str) if diff is not None else None,
                "ip": ip,
                "ua": ua,
            },
        )
    except Exception:
        # Don't let audit failures break business operations
        pass
