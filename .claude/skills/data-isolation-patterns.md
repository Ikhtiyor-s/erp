---
name: data-isolation-patterns
description: Data isolation patterns for multi-tenant SaaS, per-user data segregation, or hybrid systems. Covers WHERE-filter discipline, schema design, cross-isolation testing, and common leak vectors. Use when designing or auditing any feature that reads/writes domain data in a system with isolation requirements (per CLAUDE.md).
---

# Data isolation patterns

> Universal skill. Specific isolation key (`organization_id`, `tenant_id`, `user_id`, `workspace_id`, etc.) is defined in `CLAUDE.md`. This skill describes the PATTERNS.

## When this skill applies

Read `CLAUDE.md` "Data isolation" section. If the project has:
- **Multi-tenant SaaS** (organizations / workspaces / accounts) → strict isolation
- **Per-user data** (each user owns their data, no sharing by default) → user-level isolation
- **Hybrid** (shared org data + private per-user data) → both keys apply
- **No isolation** (single-tenant admin tool, internal tool with shared data) → this skill is N/A

## The 1 unbreakable rule

**Every read, write, update, and delete on isolated data MUST filter by the isolation key.**

No exceptions. Not for "admin queries". Not for "internal jobs". If the data has an isolation column, the query MUST filter on it.

The single most common cause of data leaks in SaaS is **forgetting one WHERE clause in one query**.

## Schema pattern

Every domain table has the isolation column:

```sql
-- SQL example (PostgreSQL)
CREATE TABLE things (
    id              <pk-type> PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- ... domain fields
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index — always include isolation key first
CREATE INDEX idx_things_tenant_status ON things (tenant_id, status);
```

For NoSQL: same principle. Document includes `tenantId` field; every query filter includes it.

## Endpoint pattern (canonical)

```
# Pseudocode (apply to any language)
function list_things(filter_q, tenant_id_from_auth):
    SELECT ... FROM things
    WHERE tenant_id = :tenant_id_from_auth  ← FIRST condition, always
    AND   ... (other filters with bound parameters)
```

The isolation key comes from the **authenticated context** (JWT claim, session, header), NEVER from the request body or URL parameter. A user requesting `?tenant_id=other-tenant` must be ignored.

## INSERT pattern

```
INSERT INTO things (tenant_id, ...) VALUES (:tenant_id_from_auth, ...)
```

The isolation column is **first**, value comes from auth context. Never default.

## Cross-isolation test (mandatory for every feature)

```pseudocode
def test_X_isolation_between_tenants():
    # Setup: 2 tenants, each with one user
    tenant_a = create_tenant("A")
    tenant_b = create_tenant("B")
    user_a = create_user(tenant_a, "admin")
    user_b = create_user(tenant_b, "admin")

    # User A creates a thing
    thing_id = api.post("/things", body={"name": "secret"}, auth=user_a).json()["id"]

    # User B tries to read it
    response = api.get(f"/things/{thing_id}", auth=user_b)
    assert response.status_code in (403, 404), "Cross-tenant data leak!"
```

**This test must exist for every domain feature.** Without it, you have no proof isolation works.

## Common leak vectors (where mistakes hide)

1. **JOIN without filter on child table**
   ```sql
   -- BAD: parent filtered, child not
   SELECT p.name, c.amount FROM payments p
   JOIN children c ON c.payment_id = p.id  -- c has its own tenant_id we forgot
   WHERE p.tenant_id = :t
   ```
   Fix: add `AND c.tenant_id = :t` to JOIN condition.

2. **Subquery in SELECT**
   ```sql
   SELECT name, (SELECT SUM(amount) FROM payments WHERE customer_id = c.id) AS total
   FROM customers c WHERE c.tenant_id = :t
   ```
   Subquery doesn't filter — leaks across tenants. Add `AND tenant_id = :t` in subquery.

3. **ORDER BY user input** — could leak via timing/error. Use allow-list.

4. **Aggregations without GROUP BY tenant** — `SELECT COUNT(*) FROM things` returns global count.

5. **"Admin" endpoint** that bypasses normal middleware — write isolation check explicitly.

6. **Background jobs / cron / queue workers** — easily forgotten. Same scoping.

7. **Search/full-text indexes** (Elasticsearch, Meilisearch) — must include tenant_id in queries, or separate index per tenant.

8. **Caches** — cache key MUST include tenant_id. Otherwise tenant A sees B's cached data.

9. **Logs** — sensitive per-tenant data shouldn't pool into shared log space without tagging.

## Shared / cross-tenant tables (rare, deliberate)

Some tables are intentionally global:
- System reference data (countries, currencies)
- System roles (if hybrid RBAC — see authorization-patterns)
- Audit log (often org-stamped but FK-less so logs survive tenant deletion)

Document these explicitly in `CLAUDE.md`. **Default: every table is isolated.** Justify globals in design.

## Defense in depth

- **Row-Level Security (RLS)** in PostgreSQL — database enforces isolation
- **Database-per-tenant** — hard isolation (heavyweight, unambiguous)
- **Repository wrappers** — never expose raw SQL; force every query through a scoped helper

## Tenant deletion / GDPR

- Soft-delete preferred (`deleted_at` column) — compliance/forensics
- Hard delete uses `ON DELETE CASCADE` — massive blast radius. Require explicit human gate.
- Audit log usually kept (with tenant_id) — but PII fields may need scrubbing.

## Checklist (for every PR that touches isolated data)

```
□ Every SELECT/UPDATE/DELETE on domain tables filters by isolation key?
□ Isolation key comes from auth context, NOT user-controllable input?
□ INSERTs set the isolation key from auth?
□ New table has the isolation column + composite index?
□ Cross-isolation test exists?
□ Caches (if any) include isolation key in their key?
□ Background jobs scoped properly?
□ Search indexes scoped?
```
