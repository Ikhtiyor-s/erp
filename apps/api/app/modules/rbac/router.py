"""RBAC management endpoints."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_current_user_id, get_db
from app.core.security import hash_password
from app.modules.rbac.deps import get_user_permissions, require_permission


def _hash_invitation_token(plain: str) -> str:
    """SHA-256 of token bytes — same approach as session/email-verify tokens."""
    return hashlib.sha256(plain.encode("utf-8")).hexdigest()


router = APIRouter(prefix="/rbac", tags=["rbac"])


@router.get("/me/permissions")
async def my_permissions(
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Return current user's permission codes + role for the active org."""
    role_res = await db.execute(
        text("""
            SELECT r.code, r.name
            FROM user_organizations uo
            LEFT JOIN roles r ON r.id = uo.role_id
            WHERE uo.user_id = :u AND uo.organization_id = :o
        """),
        {"u": user_id, "o": org_id},
    )
    row = role_res.first()
    role_code = row.code if row else None
    role_name = row.name if row else None

    perms = await get_user_permissions(user_id, org_id, db)

    return {
        "role": {"code": role_code, "name": role_name},
        "permissions": sorted(perms),
        "is_superadmin": role_code == "superadmin",
    }


@router.get("/roles", dependencies=[Depends(require_permission("rbac.view"))])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Return system rollar (organization_id IS NULL) + faqat shu tashkilot rollari."""
    res = await db.execute(
        text("""
            SELECT r.id, r.code, r.name, r.description, r.organization_id,
                   (r.organization_id IS NULL) AS is_system,
                   COUNT(rp.permission_id) AS perm_count
            FROM roles r
            LEFT JOIN role_permissions rp ON rp.role_id = r.id
            WHERE r.organization_id IS NULL OR r.organization_id = :o
            GROUP BY r.id
            ORDER BY r.organization_id NULLS FIRST, r.id
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/permissions", dependencies=[Depends(require_permission("rbac.view"))])
async def list_permissions(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        text("SELECT id, code, module, action FROM permissions ORDER BY module, action")
    )
    return [dict(r._mapping) for r in res]


async def _ensure_role_accessible(role_id: int, org_id: str, db: AsyncSession) -> tuple[str, str | None]:
    """Verify role exists AND belongs to this org or is a system role.
    Returns (code, organization_id_or_None). Raises 404 if not visible."""
    row = await db.execute(
        text("SELECT code, organization_id FROM roles "
             "WHERE id = :r AND (organization_id IS NULL OR organization_id = :o)"),
        {"r": role_id, "o": org_id},
    )
    r = row.first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rol topilmadi")
    return r.code, (str(r.organization_id) if r.organization_id else None)


@router.get("/roles/{role_id}/permissions",
            dependencies=[Depends(require_permission("rbac.view"))])
async def role_permissions(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await _ensure_role_accessible(role_id, org_id, db)
    res = await db.execute(
        text("""
            SELECT p.id, p.code, p.module, p.action
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = :r
            ORDER BY p.module, p.action
        """),
        {"r": role_id},
    )
    return [dict(r._mapping) for r in res]


class RoleCreateIn(BaseModel):
    code: str
    name: str
    description: str | None = None
    permission_ids: list[int] = []
    copy_from_role_id: int | None = None  # optional: copy perms from another role


@router.post("/roles",
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("rbac.manage"))])
async def create_role(
    p: RoleCreateIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Create a tenant-scoped custom role. The code must be unique within this org
    and must not collide with system role codes."""
    if not p.code or not p.code.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code bo'sh bo'lmasligi kerak")
    code = p.code.strip().lower()
    if code in ("superadmin", "admin", "manager", "accountant", "cashier", "viewer"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Bu kod tizim rolida ishlatilgan, boshqasini tanlang")

    # Check duplication within this org (system roles also collide via uq_roles_code_system)
    exists = await db.execute(
        text("SELECT 1 FROM roles WHERE code = :c "
             "AND (organization_id IS NULL OR organization_id = :o)"),
        {"c": code, "o": org_id},
    )
    if exists.scalar():
        raise HTTPException(status.HTTP_409_CONFLICT, f"'{code}' rol mavjud")

    new_role = await db.execute(
        text("INSERT INTO roles (code, name, description, organization_id) "
             "VALUES (:c, :n, :d, :o) RETURNING id"),
        {"c": code, "n": p.name, "d": p.description, "o": org_id},
    )
    role_id = new_role.scalar()

    # Resolve permission set: either copied from another visible role, or explicit list
    perm_ids: list[int] = list(p.permission_ids)
    if p.copy_from_role_id:
        # Verify source role is visible to this org
        src_row = await db.execute(
            text("SELECT 1 FROM roles WHERE id = :r "
                 "AND (organization_id IS NULL OR organization_id = :o)"),
            {"r": p.copy_from_role_id, "o": org_id},
        )
        if not src_row.scalar():
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                "Nusxalanadigan rol topilmadi")
        src = await db.execute(
            text("SELECT permission_id FROM role_permissions WHERE role_id = :r"),
            {"r": p.copy_from_role_id},
        )
        perm_ids = [r[0] for r in src]

    for pid in perm_ids:
        await db.execute(
            text("INSERT INTO role_permissions (role_id, permission_id) "
                 "VALUES (:r, :p) ON CONFLICT DO NOTHING"),
            {"r": role_id, "p": pid},
        )
    await db.commit()
    return {"id": role_id, "code": code, "name": p.name, "perm_count": len(perm_ids)}


class RoleUpdateIn(BaseModel):
    name: str
    description: str | None = None


@router.put("/roles/{role_id}",
            dependencies=[Depends(require_permission("rbac.manage"))])
async def update_role(
    role_id: int,
    p: RoleUpdateIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    code, role_org = await _ensure_role_accessible(role_id, org_id, db)
    if role_org is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Tizim rolini o'zgartirib bo'lmaydi")
    await db.execute(
        text("UPDATE roles SET name = :n, description = :d "
             "WHERE id = :r AND organization_id = :o"),
        {"n": p.name, "d": p.description, "r": role_id, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.delete("/roles/{role_id}",
               dependencies=[Depends(require_permission("rbac.manage"))])
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    code, role_org = await _ensure_role_accessible(role_id, org_id, db)
    if role_org is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Tizim rolini o'chirib bo'lmaydi")
    # Check if any user has this role assigned (in this org — role belongs to one org)
    in_use = await db.execute(
        text("SELECT COUNT(*) FROM user_organizations WHERE role_id = :r"),
        {"r": role_id},
    )
    n = in_use.scalar()
    if n and n > 0:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"Bu rol {n} ta foydalanuvchiga biriktirilgan — avval almashtiring")
    await db.execute(text("DELETE FROM role_permissions WHERE role_id = :r"), {"r": role_id})
    await db.execute(
        text("DELETE FROM roles WHERE id = :r AND organization_id = :o"),
        {"r": role_id, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


class RolePermsIn(BaseModel):
    permission_ids: list[int]


@router.put("/roles/{role_id}/permissions",
            dependencies=[Depends(require_permission("rbac.manage"))])
async def update_role_permissions(
    role_id: int,
    p: RolePermsIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    caller_user_id: str = Depends(get_current_user_id),
):
    code, role_org = await _ensure_role_accessible(role_id, org_id, db)

    # HI-6: privilege-escalation guard. Caller may only grant permissions
    # they themselves possess. Superadmin is exempt (system-wide owner).
    # M3: superadmin check is org-agnostic — a superadmin in ANY org is exempt.
    caller_is_superadmin_q = await db.execute(
        text("""
            SELECT 1
            FROM user_organizations uo
            JOIN roles r ON r.id = uo.role_id
            WHERE uo.user_id = :u AND r.code = 'superadmin'
            LIMIT 1
        """),
        {"u": caller_user_id},
    )
    caller_is_superadmin = caller_is_superadmin_q.first() is not None
    if not caller_is_superadmin and p.permission_ids:
        # Resolve requested permission ids -> codes. Unknown ids are also
        # rejected (otherwise the downstream INSERT would 500 on FK violation).
        req_res = await db.execute(
            text("SELECT id, code FROM permissions WHERE id = ANY(:ids)"),
            {"ids": p.permission_ids},
        )
        rows = list(req_res)
        req_codes = {r.code for r in rows}
        found_ids = {r.id for r in rows}
        unknown_ids = sorted(set(p.permission_ids) - found_ids)
        if unknown_ids:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "Unknown permission_ids",
                    "unknown": unknown_ids,
                },
            )
        caller_codes = await get_user_permissions(caller_user_id, org_id, db)
        missing = sorted(req_codes - caller_codes)
        if missing:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail={
                    "detail": "You cannot grant permissions you do not have",
                    "missing": missing,
                },
            )
    if code == "superadmin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Super Admin ruxsatlarini o'zgartirib bo'lmaydi")
    if role_org is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Tizim rolining ruxsatlarini o'zgartirib bo'lmaydi")

    # Replace permissions
    await db.execute(
        text("DELETE FROM role_permissions WHERE role_id = :r"),
        {"r": role_id},
    )
    for pid in p.permission_ids:
        await db.execute(
            text("INSERT INTO role_permissions (role_id, permission_id) "
                 "VALUES (:r, :p) ON CONFLICT DO NOTHING"),
            {"r": role_id, "p": pid},
        )
    await db.commit()
    return {"ok": True, "count": len(p.permission_ids)}


@router.get("/users", dependencies=[Depends(require_permission("org.manage_users"))])
async def list_org_users(
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """List all users in the current organization with their roles.
    Returns `is_active` per-org (user_organizations.is_active) — global users.is_active
    is intentionally NOT exposed here to prevent confusion."""
    res = await db.execute(
        text("""
            SELECT u.id, u.email, u.full_name,
                   uo.is_active,
                   uo.role_id, r.code AS role_code, r.name AS role_name,
                   uo.is_default, uo.joined_at
            FROM user_organizations uo
            JOIN users u ON u.id = uo.user_id
            LEFT JOIN roles r ON r.id = uo.role_id
            WHERE uo.organization_id = :o
            ORDER BY u.full_name, u.email
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


class UserRoleIn(BaseModel):
    role_id: int


async def _target_user_role_code(user_id: str, org_id: str, db: AsyncSession) -> str | None:
    """Return target user's role code in this org (or None if not a member)."""
    row = await db.execute(
        text("SELECT r.code FROM user_organizations uo "
             "LEFT JOIN roles r ON r.id = uo.role_id "
             "WHERE uo.user_id = :u AND uo.organization_id = :o"),
        {"u": user_id, "o": org_id},
    )
    r = row.first()
    if not r:
        return None
    return r.code


async def _can_caller_manage_target(
    caller_user_id: str, target_role_code: str | None,
    org_id: str, db: AsyncSession,
) -> tuple[bool, str | None]:
    """Returns (allowed, reason). Caller can never modify superadmin.
    Only superadmin can modify admin. Otherwise caller with org.manage_users may proceed."""
    if target_role_code == "superadmin":
        return False, "Super Admin'ni o'zgartirib bo'lmaydi"
    if target_role_code == "admin":
        # Check if caller is also superadmin/admin
        caller_row = await db.execute(
            text("SELECT r.code FROM user_organizations uo "
                 "LEFT JOIN roles r ON r.id = uo.role_id "
                 "WHERE uo.user_id = :u AND uo.organization_id = :o"),
            {"u": caller_user_id, "o": org_id},
        )
        cr = caller_row.first()
        caller_code = cr.code if cr else None
        if caller_code != "superadmin":
            return False, "Admin'ni faqat Super Admin o'zgartira oladi"
    return True, None


@router.put("/users/{user_id}/role",
            dependencies=[Depends(require_permission("org.manage_users"))])
async def set_user_role(
    user_id: str,
    p: UserRoleIn,
    org_id: str = Depends(get_current_org_id),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Verify the role is visible to this org (system role OR own custom role)
    await _ensure_role_accessible(p.role_id, org_id, db)
    # Verify user is actually a member of this org
    target_code = await _target_user_role_code(user_id, org_id, db)
    if target_code is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            "Foydalanuvchi bu tashkilotda yo'q")
    # B6: protect superadmin/admin
    ok, reason = await _can_caller_manage_target(current_user_id, target_code, org_id, db)
    if not ok:
        raise HTTPException(status.HTTP_403_FORBIDDEN, reason)
    await db.execute(
        text("UPDATE user_organizations SET role_id = :r "
             "WHERE user_id = :u AND organization_id = :o"),
        {"r": p.role_id, "u": user_id, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


class UserInviteIn(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role_id: int
    # Required only when creating a NEW user account.
    # Ignored for existing users (they keep their current password).
    initial_password: str | None = None


@router.post("/users/invite",
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("org.manage_users"))])
async def invite_user(
    p: UserInviteIn,
    org_id: str = Depends(get_current_org_id),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Two paths:
    1) Email is NEW → create user account + add to org immediately (caller provides initial_password).
    2) Email already has an account → create an INVITATION; user must accept (C-2 fix).
    """
    # Verify the role is visible to this org
    await _ensure_role_accessible(p.role_id, org_id, db)

    existing = await db.execute(
        text("SELECT id FROM users WHERE email = :e"), {"e": p.email}
    )
    row = existing.first()

    # ===== Path 2: existing user → invitation =====
    if row:
        existing_user_id = str(row.id)
        # Already a member?
        in_org = await db.execute(
            text("SELECT 1 FROM user_organizations "
                 "WHERE user_id = :u AND organization_id = :o"),
            {"u": existing_user_id, "o": org_id},
        )
        if in_org.scalar():
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "Bu foydalanuvchi allaqachon tashkilotda")
        # Already invited (pending)?
        pending = await db.execute(
            text("SELECT id FROM user_invitations "
                 "WHERE invited_user_id = :u AND organization_id = :o "
                 "AND accepted_at IS NULL AND cancelled_at IS NULL "
                 "AND expires_at > NOW()"),
            {"u": existing_user_id, "o": org_id},
        )
        if pending.scalar():
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "Bu foydalanuvchiga aktiv taklif yuborilgan")

        plain_token = secrets.token_urlsafe(32)
        token_hash = _hash_invitation_token(plain_token)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.execute(
            text("""INSERT INTO user_invitations
                    (token_hash, invited_email, invited_user_id,
                     organization_id, role_id, invited_by, expires_at)
                    VALUES (:t, :e, :u, :o, :r, :by, :exp)"""),
            {"t": token_hash, "e": p.email, "u": existing_user_id,
             "o": org_id, "r": p.role_id, "by": current_user_id, "exp": expires_at},
        )
        await db.commit()
        # plain_token is returned ONCE here — caller delivers to invitee
        # (email, Telegram, copy link). Server never stores it.
        return {
            "ok": True,
            "invitation_token": plain_token,
            "expires_at": expires_at.isoformat(),
            "user_existed": True,
        }

    # ===== Path 1: new user — direct create + add =====
    if not p.initial_password or len(p.initial_password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Yangi foydalanuvchi uchun parol kamida 6 belgi bo'lsin")

    user_id = uuid4()
    await db.execute(
        text("INSERT INTO users (id, email, password_hash, full_name) "
             "VALUES (:id, :e, :p, :n)"),
        {"id": str(user_id), "e": p.email,
         "p": hash_password(p.initial_password), "n": p.full_name},
    )
    await db.execute(
        text("INSERT INTO user_organizations "
             "(user_id, organization_id, role_id, is_default) "
             "VALUES (:u, :o, :r, FALSE)"),
        {"u": str(user_id), "o": org_id, "r": p.role_id},
    )
    await db.commit()
    return {"ok": True, "user_id": str(user_id), "created_new": True}


# =========================================================================
# C-2 — Invitation flow: accept / list / cancel
# =========================================================================

class AcceptInviteIn(BaseModel):
    token: str


@router.post("/invitations/accept")
async def accept_invitation(
    p: AcceptInviteIn,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated user accepts an invitation by its token."""
    token_hash = _hash_invitation_token(p.token)
    res = await db.execute(
        text("""SELECT id, invited_user_id, organization_id, role_id, expires_at,
                       accepted_at, cancelled_at
                FROM user_invitations WHERE token_hash = :t"""),
        {"t": token_hash},
    )
    inv = res.first()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taklif topilmadi")
    if inv.accepted_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Taklif allaqachon qabul qilingan")
    if inv.cancelled_at is not None:
        raise HTTPException(status.HTTP_410_GONE, "Taklif bekor qilingan")
    if inv.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_410_GONE, "Taklif muddati o'tgan")
    if str(inv.invited_user_id) != current_user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Bu taklif sizga emas")

    # Add to org (or reactivate if previously removed)
    await db.execute(
        text("""INSERT INTO user_organizations
                (user_id, organization_id, role_id, is_default, is_active)
                VALUES (:u, :o, :r, FALSE, TRUE)
                ON CONFLICT (user_id, organization_id) DO UPDATE
                  SET role_id = EXCLUDED.role_id, is_active = TRUE"""),
        {"u": current_user_id, "o": str(inv.organization_id), "r": inv.role_id},
    )
    await db.execute(
        text("UPDATE user_invitations SET accepted_at = NOW() WHERE id = :i"),
        {"i": inv.id},
    )
    await db.commit()
    return {"ok": True, "organization_id": str(inv.organization_id)}


@router.get("/invitations/mine")
async def list_my_invitations(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Current user's pending invitations across all orgs."""
    res = await db.execute(
        text("""SELECT i.id, i.organization_id, o.name AS organization_name,
                       i.role_id, r.name AS role_name,
                       i.invited_by, u.full_name AS invited_by_name,
                       i.expires_at, i.created_at
                FROM user_invitations i
                JOIN organizations o ON o.id = i.organization_id
                JOIN roles r ON r.id = i.role_id
                LEFT JOIN users u ON u.id = i.invited_by
                WHERE i.invited_user_id = :u
                  AND i.accepted_at IS NULL
                  AND i.cancelled_at IS NULL
                  AND i.expires_at > NOW()
                ORDER BY i.created_at DESC"""),
        {"u": current_user_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/invitations",
            dependencies=[Depends(require_permission("org.manage_users"))])
async def list_org_invitations(
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Pending invitations sent FROM this org."""
    res = await db.execute(
        text("""SELECT i.id, i.invited_email, i.invited_user_id,
                       i.role_id, r.name AS role_name,
                       i.invited_by, u.full_name AS invited_by_name,
                       i.expires_at, i.created_at
                FROM user_invitations i
                JOIN roles r ON r.id = i.role_id
                LEFT JOIN users u ON u.id = i.invited_by
                WHERE i.organization_id = :o
                  AND i.accepted_at IS NULL
                  AND i.cancelled_at IS NULL
                  AND i.expires_at > NOW()
                ORDER BY i.created_at DESC"""),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.delete("/invitations/{invitation_id}",
               dependencies=[Depends(require_permission("org.manage_users"))])
async def cancel_invitation(
    invitation_id: int,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Org admin cancels a pending invitation."""
    res = await db.execute(
        text("UPDATE user_invitations SET cancelled_at = NOW() "
             "WHERE id = :i AND organization_id = :o "
             "AND accepted_at IS NULL AND cancelled_at IS NULL "
             "RETURNING id"),
        {"i": invitation_id, "o": org_id},
    )
    if not res.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            "Aktiv taklif topilmadi")
    await db.commit()
    return {"ok": True}


class UserActiveIn(BaseModel):
    is_active: bool


@router.put("/users/{user_id}/active",
            dependencies=[Depends(require_permission("org.manage_users"))])
async def set_user_active(
    user_id: str,
    p: UserActiveIn,
    org_id: str = Depends(get_current_org_id),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Block/activate user within THIS organization only (org-scoped, B4).
    The global users.is_active is intentionally NOT touched."""
    target_code = await _target_user_role_code(user_id, org_id, db)
    if target_code is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            "Foydalanuvchi bu tashkilotda yo'q")
    # B6: protect superadmin/admin
    ok, reason = await _can_caller_manage_target(current_user_id, target_code, org_id, db)
    if not ok:
        raise HTTPException(status.HTTP_403_FORBIDDEN, reason)
    if user_id == current_user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "O'zingizni bloklab bo'lmaydi")
    await db.execute(
        text("UPDATE user_organizations SET is_active = :a "
             "WHERE user_id = :u AND organization_id = :o"),
        {"a": p.is_active, "u": user_id, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}",
               dependencies=[Depends(require_permission("org.manage_users"))])
async def remove_user_from_org(
    user_id: str,
    org_id: str = Depends(get_current_org_id),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove user from current org (does not delete the user account)."""
    if user_id == current_user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "O'zingizni o'chirib bo'lmaydi")
    target_code = await _target_user_role_code(user_id, org_id, db)
    if target_code is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            "Foydalanuvchi bu tashkilotda yo'q")
    # B6: protect superadmin/admin
    ok, reason = await _can_caller_manage_target(current_user_id, target_code, org_id, db)
    if not ok:
        raise HTTPException(status.HTTP_403_FORBIDDEN, reason)
    await db.execute(
        text("DELETE FROM user_organizations "
             "WHERE user_id = :u AND organization_id = :o"),
        {"u": user_id, "o": org_id},
    )
    await db.commit()
    return {"ok": True}
