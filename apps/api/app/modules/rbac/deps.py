"""
FastAPI dependencies for permission enforcement.

Usage:
    @router.post("/sales", dependencies=[Depends(require_permission("sale.create"))])
    async def create_sale(...): ...
"""
from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_current_user_id, get_db


async def get_user_permissions(
    user_id: str,
    org_id: str,
    db: AsyncSession,
) -> set[str]:
    """Return all permission codes the user has in the given org.
    Returns empty set if user is blocked in this org (user_organizations.is_active = FALSE)."""
    res = await db.execute(
        text("""
            SELECT DISTINCT p.code
            FROM user_organizations uo
            JOIN role_permissions rp ON rp.role_id = uo.role_id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE uo.user_id = :u
              AND uo.organization_id = :o
              AND uo.is_active = TRUE
        """),
        {"u": user_id, "o": org_id},
    )
    return {r.code for r in res}


def require_permission(permission_code: str):
    """Dependency factory — raises 403 if user lacks permission."""

    async def _checker(
        user_id: str = Depends(get_current_user_id),
        org_id: str = Depends(get_current_org_id),
        db: AsyncSession = Depends(get_db),
    ):
        perms = await get_user_permissions(user_id, org_id, db)
        if permission_code not in perms:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=f"Sizda '{permission_code}' ruxsati yo'q",
            )
        return True

    return _checker


def require_any(*permission_codes: str):
    """User needs at least ONE of the listed permissions."""

    async def _checker(
        user_id: str = Depends(get_current_user_id),
        org_id: str = Depends(get_current_org_id),
        db: AsyncSession = Depends(get_db),
    ):
        perms = await get_user_permissions(user_id, org_id, db)
        if not any(c in perms for c in permission_codes):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=f"Ushbu amalga ruxsat yo'q. Kerakli: {', '.join(permission_codes)}",
            )
        return True

    return _checker
