"""Seed standard permissions and role grants into the DB. Idempotent."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.modules.rbac.permissions import ALL_PERMISSIONS, ROLE_GRANTS


async def seed_permissions(conn: AsyncConnection) -> None:
    """Insert any missing permission rows."""
    for perm in ALL_PERMISSIONS:
        await conn.execute(
            text("""
                INSERT INTO permissions (code, module, action)
                VALUES (:c, :m, :a)
                ON CONFLICT (code) DO NOTHING
            """),
            {"c": perm["code"], "m": perm["module"], "a": perm["action"]},
        )


async def seed_role_grants(conn: AsyncConnection) -> None:
    """Link permissions to roles based on ROLE_GRANTS.

    Applies to EVERY role sharing the same code — the system role
    (organization_id IS NULL) plus every per-org role of that code.
    Otherwise per-org admin roles drift as new permissions are added.
    """
    res = await conn.execute(text("SELECT id, code FROM roles"))
    role_ids_by_code: dict[str, list[int]] = {}
    for r in res:
        role_ids_by_code.setdefault(r.code, []).append(r.id)

    res = await conn.execute(text("SELECT id, code FROM permissions"))
    perm_ids = {r.code: r.id for r in res}

    for role_code, perm_codes in ROLE_GRANTS.items():
        role_ids = role_ids_by_code.get(role_code, [])
        if not role_ids:
            continue

        codes = list(perm_ids.keys()) if perm_codes == ["*"] else perm_codes

        for role_id in role_ids:
            for code in codes:
                pid = perm_ids.get(code)
                if pid is None:
                    continue
                await conn.execute(
                    text("""
                        INSERT INTO role_permissions (role_id, permission_id)
                        VALUES (:r, :p)
                        ON CONFLICT (role_id, permission_id) DO NOTHING
                    """),
                    {"r": role_id, "p": pid},
                )


async def seed_all(conn: AsyncConnection) -> None:
    await seed_permissions(conn)
    await seed_role_grants(conn)
