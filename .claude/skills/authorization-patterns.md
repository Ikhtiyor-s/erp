---
name: authorization-patterns
description: Authorization model patterns — RBAC (role-based), ABAC (attribute-based), ReBAC (relationship-based), and simple ownership. Permission catalog design, middleware vs explicit guards, escalation protections. Use when adding new endpoints, designing access control, or troubleshooting 403 errors.
---

# Authorization patterns

> Universal skill. The project's specific authz model is declared in `CLAUDE.md`. This skill describes how to design and audit access control.

## Choose your model (or recognize what's chosen)

| Model | Best for | Example |
|---|---|---|
| **Simple ownership** | Personal apps, small SaaS | "user can only edit rows where `owner_id = me`" |
| **RBAC** (role-based) | Multi-user business apps, predictable orgs | Admin, manager, employee with fixed permission sets |
| **ABAC** (attribute-based) | Complex policies, regulations | "Doctor can read patient record IF they're assigned to that patient AND consent is valid" |
| **ReBAC** (relationship-based) | Social/collaborative apps | "User can edit document IF they're a collaborator on it" |
| **Custom/hybrid** | Most real apps | RBAC for system roles + ownership for personal data |

`CLAUDE.md` declares which one(s). Don't mix models silently.

## RBAC pattern (most common in business apps)

### Permission code format
`<module>.<action>` is the universal convention.

- Modules: domain areas — `user`, `order`, `report`, `billing`, `admin`, ...
- Actions: verbs — `view`, `create`, `update`, `delete`, `export`, `approve`, ...

### Permission catalog (single source of truth)
One file lists all permissions and which role gets which:

```python
# Pseudocode — Python example, same idea in any language
ALL_PERMISSIONS = [
    "user.view", "user.create", "user.update", "user.delete",
    "order.view", "order.create", "order.refund",
    "billing.view", "billing.charge",
    # ...
]

ROLE_GRANTS = {
    "admin": ALL_PERMISSIONS,
    "manager": ["user.view", "order.view", "order.create"],
    "viewer": [p for p in ALL_PERMISSIONS if p.endswith(".view")],
}
```

### Auto-derivation (lazy authz)

Many frameworks let middleware derive the required permission from HTTP method + URL:

| HTTP | Action |
|---|---|
| GET | view |
| POST | create |
| PUT/PATCH | update |
| DELETE | delete |

URL's first segment → module. Example: `POST /api/v1/orders` → requires `order.create`.

**This is convenient but limited.** For unusual actions, use explicit declaration:

```pseudocode
@route.post("/orders/{id}/refund", requires_permission="order.refund")
def refund_order(...):
    ...
```

### Custom roles (per-tenant in SaaS)

If users can define custom roles:
- System roles are global (`tenant_id IS NULL`) — `admin`, `viewer`, etc.
- Custom roles are per-tenant (`tenant_id = X`)
- Unique constraint: `(tenant_id, code)` — Tenant A and Tenant B can both define `branch_manager`
- List query: `WHERE tenant_id IS NULL OR tenant_id = :current_tenant`
- Mutation queries: `WHERE tenant_id = :current_tenant` (can't edit system roles)

### Frontend menu/route gating

Every menu entry has a permission attached. Hide what the user can't access:

```ts
// Pseudocode
const menu = [
  { label: "Users", href: "/users", permission: "user.view" },
  { label: "Billing", href: "/billing", permission: "billing.view" },
];

// Filter at render time based on currentUser.permissions
```

Without this, users see links → click → 403 → bad UX. **Always permission-gate menus.**

## ABAC pattern (more flexible)

```
allow(user, action, resource) IF
  user.role == "doctor"
  AND resource.assigned_doctor_id == user.id
  AND resource.consent_status == "valid"
  AND time_within_business_hours()
```

Stored as policy rules (often using OPA, Cedar, Casbin). Decoupled from code.

Use ABAC when:
- Policies change frequently without code deploys
- Regulations require auditable rules
- RBAC creates explosion of roles ("manager-of-region-X-on-tuesdays-only")

## ReBAC pattern (social/collaborative)

Used by Google Drive, Notion, Figma. Implemented via Zanzibar (Google) / SpiceDB / Permify.

```
allow(user, "edit", doc) IF
  user is "owner" of doc
  OR user is "editor" of doc
  OR user is "member" of group_x AND group_x is "editor" of doc
```

## Escalation protection (RBAC-specific, universally important)

**Admins must not be able to escalate themselves or attack other admins.**

```pseudocode
function can_modify_user(caller, target):
    if target.role == "superadmin":
        return False  # Nobody touches superadmin
    if target.role == "admin" and caller.role != "superadmin":
        return False  # Only superadmin modifies admin
    if target.id == caller.id and action == "delete":
        return False  # Can't delete yourself (lockout risk)
    return True
```

Apply this check to:
- `set_user_role`
- `block_user` / `set_user_active`
- `delete_user`
- `change_password` (other users)
- `grant_permission`

## Authorization vs Authentication (don't confuse)

- **Authentication**: "who are you?" (login, JWT verify, session)
- **Authorization**: "what can you do?" (permission check)

These are separate steps. Authentication failure → 401 Unauthorized. Authorization failure → 403 Forbidden.

## Multi-tenancy interaction

Authz combines with data isolation:
1. Authentication establishes user identity
2. Tenant context established (header, JWT claim)
3. Authorization checks permission within that tenant
4. Data isolation filters every query

Example flow:
- User has JWT with `sub: "user_a"`
- Request header `X-Tenant-Id: tenant_b`
- Authz: does user_a have `order.view` in tenant_b? (check tenant-specific role)
- Data: `SELECT ... WHERE tenant_id = tenant_b ...`

## Audit logging

Every privileged action SHOULD be audit-logged (per `CLAUDE.md` audit policy):
- Who (user_id)
- What (action + resource)
- When (timestamp)
- Where (tenant_id)
- How (request body — with secrets redacted)

## Common authz mistakes

1. **Trusting client-side checks alone** — frontend hides button, but API still allows. Always re-check on server.

2. **Confusing object-level with type-level permissions**
   - Type-level: "user has `order.view`" → can call `GET /orders`
   - Object-level: "user can view THIS order" → check ownership/sharing on top
   - You usually need both.

3. **Missing permission on new endpoint** — middleware auto-derivation can miss unusual paths. Always declare explicitly.

4. **TOCTOU** (time-of-check time-of-use): check permission, then in same transaction the role gets revoked, then write happens. Mitigation: lock target row, re-check.

5. **Privilege escalation via role-change endpoint** — `set_user_role` without checking target's role can promote admin to superadmin.

6. **Default-allow vs default-deny** — middleware should default-deny unknown paths. Adding new module → must add to permission catalog.

## Checklist (every new endpoint)

```
□ Required permission code named (matching project's catalog)
□ Middleware auto-derivation OR explicit declaration in the route
□ For data mutations: also enforce object-level (ownership/sharing)
□ Privilege escalation guards on user/role mgmt endpoints
□ Audit log captures the action (with redaction of sensitive body fields)
□ Frontend menu/route entry has the permission declared
□ Test cases:
   - User with permission: ✓ succeeds
   - User without permission: ✗ 403
   - User in wrong tenant: ✗ 404 or 403
```
