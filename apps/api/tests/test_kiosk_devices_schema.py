"""SC-1 — kiosk_devices schema + RBAC permission-catalog tests.

Pure schema/permission tests (no endpoints — those are SC-2's scope).
DB-level checks use asyncpg directly, same loop-safe pattern as
test_db_schema_sprint3.py (avoids event-loop conflicts with the app's
SQLAlchemy engine singleton).
"""
import uuid

import asyncpg
import pytest
import pytest_asyncio

from app.core.config import settings
from app.modules.rbac.permissions import ALL_PERMISSIONS, ROLE_GRANTS


def _pg_dsn() -> str:
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


@pytest_asyncio.fixture
async def pgconn():
    conn = await asyncpg.connect(_pg_dsn())
    yield conn
    await conn.close()


# =========================================================
# DB schema: table + indexes exist
# =========================================================

KIOSK_INDEXES = [
    "uq_kiosk_devices_token_hash",
    "idx_kiosk_devices_org_status",
    "idx_kiosk_devices_cashbox",
]


@pytest.mark.asyncio
async def test_kiosk_devices_table_exists(pgconn):
    row = await pgconn.fetchrow(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_name = 'kiosk_devices' AND table_schema = 'public'"
    )
    assert row is not None, "kiosk_devices table not found"


@pytest.mark.asyncio
async def test_kiosk_devices_has_no_warehouse_id_column(pgconn):
    """DESIGN explicitly rejects a warehouse_id column — warehouse is always
    derived from cashboxes.warehouse_id at request time (T-206 Case 3)."""
    row = await pgconn.fetchrow(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'kiosk_devices' AND column_name = 'warehouse_id'"
    )
    assert row is None, "kiosk_devices must NOT have a warehouse_id column (architect decision)"


@pytest.mark.asyncio
@pytest.mark.parametrize("idx_name", KIOSK_INDEXES)
async def test_kiosk_devices_index_exists(pgconn, idx_name):
    row = await pgconn.fetchrow(
        "SELECT 1 FROM pg_indexes WHERE indexname = $1 AND tablename = 'kiosk_devices'",
        idx_name,
    )
    assert row is not None, f"Index '{idx_name}' not found on kiosk_devices"


@pytest.mark.asyncio
async def test_kiosk_devices_token_hash_unique_index_is_unique(pgconn):
    row = await pgconn.fetchrow(
        "SELECT indexdef FROM pg_indexes "
        "WHERE indexname = 'uq_kiosk_devices_token_hash' AND tablename = 'kiosk_devices'"
    )
    assert row is not None
    assert "UNIQUE" in row["indexdef"]


@pytest.mark.asyncio
async def test_kiosk_devices_cashbox_fk_is_restrict(pgconn):
    row = await pgconn.fetchrow(
        """
        SELECT confdeltype FROM pg_constraint
        WHERE conname = 'kiosk_devices_cashbox_id_fkey'
        """
    )
    assert row is not None, "cashbox_id FK constraint not found"
    # 'r' = ON DELETE RESTRICT (pg_constraint.confdeltype codes: a=no action,
    # r=restrict, c=cascade, n=set null, d=set default). asyncpg returns
    # Postgres "char" as a single-byte bytes object, not str.
    confdeltype = row["confdeltype"]
    if isinstance(confdeltype, bytes):
        confdeltype = confdeltype.decode()
    assert confdeltype == "r", (
        f"cashbox_id FK must be ON DELETE RESTRICT, got confdeltype={confdeltype!r}"
    )


# =========================================================
# FK RESTRICT behaviour: deleting a referenced cashbox must fail
# =========================================================

@pytest_asyncio.fixture
async def kiosk_fixture_row(pgconn):
    """Create a throwaway org + cashbox + kiosk_devices row inside a dedicated
    transaction-safe fixture, cleaned up afterwards regardless of test outcome."""
    org_id = str(uuid.uuid4())
    await pgconn.execute(
        "INSERT INTO organizations (id, name, code) VALUES ($1, $2, $3)",
        org_id, "SC1 Test Org", f"sc1-{uuid.uuid4().hex[:12]}",
    )
    cashbox_id = await pgconn.fetchval(
        "INSERT INTO cashboxes (organization_id, name) VALUES ($1, $2) RETURNING id",
        org_id, "SC1 Test Cashbox",
    )
    device_id = await pgconn.fetchval(
        """
        INSERT INTO kiosk_devices (organization_id, cashbox_id, name, token_hash, token_prefix)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
        """,
        org_id, cashbox_id, "SC1 Test Kiosk", "a" * 64, "kiosk_abc",
    )
    yield {"org_id": org_id, "cashbox_id": cashbox_id, "device_id": device_id}

    # Cleanup in FK-safe order; kiosk_devices first, then cashbox, then org.
    await pgconn.execute("DELETE FROM kiosk_devices WHERE id = $1", device_id)
    await pgconn.execute("DELETE FROM cashboxes WHERE id = $1", cashbox_id)
    await pgconn.execute("DELETE FROM organizations WHERE id = $1", org_id)


@pytest.mark.asyncio
async def test_delete_referenced_cashbox_raises_restrict(pgconn, kiosk_fixture_row):
    """Deleting a cashbox referenced by a live kiosk_devices row must raise
    (FK RESTRICT) — no cascade-delete of the kiosk device."""
    cashbox_id = kiosk_fixture_row["cashbox_id"]
    device_id = kiosk_fixture_row["device_id"]

    with pytest.raises(asyncpg.ForeignKeyViolationError):
        await pgconn.execute("DELETE FROM cashboxes WHERE id = $1", cashbox_id)

    # The kiosk device row must still exist — not orphaned, not cascade-deleted.
    row = await pgconn.fetchrow("SELECT 1 FROM kiosk_devices WHERE id = $1", device_id)
    assert row is not None, "kiosk_devices row must survive the blocked cashbox delete"

    row = await pgconn.fetchrow("SELECT 1 FROM cashboxes WHERE id = $1", cashbox_id)
    assert row is not None, "cashbox must still exist — the DELETE must have been rejected"


@pytest.mark.asyncio
async def test_delete_unreferenced_cashbox_succeeds(pgconn):
    """Sanity check: a cashbox with no kiosk device deletes fine (RESTRICT only
    blocks when a row actually references it)."""
    org_id = str(uuid.uuid4())
    await pgconn.execute(
        "INSERT INTO organizations (id, name, code) VALUES ($1, $2, $3)",
        org_id, "SC1 Test Org 2", f"sc1-{uuid.uuid4().hex[:12]}",
    )
    cashbox_id = await pgconn.fetchval(
        "INSERT INTO cashboxes (organization_id, name) VALUES ($1, $2) RETURNING id",
        org_id, "SC1 Unreferenced Cashbox",
    )
    await pgconn.execute("DELETE FROM cashboxes WHERE id = $1", cashbox_id)
    await pgconn.execute("DELETE FROM organizations WHERE id = $1", org_id)


# =========================================================
# RBAC: permission catalog + role grants
# =========================================================

KIOSK_CODES = {"kiosk.view", "kiosk.create", "kiosk.update", "kiosk.delete"}


def test_kiosk_permissions_in_all_permissions_catalog():
    codes = {pm["code"] for pm in ALL_PERMISSIONS}
    assert KIOSK_CODES.issubset(codes), f"Missing kiosk codes: {KIOSK_CODES - codes}"


def test_kiosk_permissions_granted_to_admin_only_in_role_grants():
    admin_codes = set(ROLE_GRANTS["admin"])
    assert KIOSK_CODES.issubset(admin_codes), "admin must have all 4 kiosk.* codes"

    for role in ("manager", "cashier", "accountant", "viewer"):
        role_codes = set(ROLE_GRANTS[role])
        leaked = KIOSK_CODES & role_codes
        assert not leaked, f"{role} must not be auto-granted kiosk.* — leaked: {leaked}"


@pytest.mark.asyncio
async def test_rbac_permissions_endpoint_includes_kiosk_codes(client):
    resp = await client.get("/api/v1/rbac/permissions")
    assert resp.status_code == 200
    codes = {p["code"] for p in resp.json()}
    assert KIOSK_CODES.issubset(codes), f"Missing from /rbac/permissions: {KIOSK_CODES - codes}"


@pytest.mark.asyncio
async def test_admin_has_kiosk_permissions_in_db(pgconn):
    """Seeded via seed_role_grants() on startup — admin role rows (every org,
    including organization_id IS NULL system role) must carry all 4 codes."""
    rows = await pgconn.fetch(
        """
        SELECT DISTINCT p.code
        FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.code = 'admin' AND p.module = 'kiosk'
        """
    )
    granted = {r["code"] for r in rows}
    assert KIOSK_CODES == granted, f"admin kiosk grants mismatch: {granted}"


@pytest.mark.asyncio
@pytest.mark.parametrize("role_code", ["manager", "cashier", "accountant", "viewer"])
async def test_other_roles_have_no_kiosk_permissions_in_db(pgconn, role_code):
    row = await pgconn.fetchrow(
        """
        SELECT 1
        FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.code = $1 AND p.module = 'kiosk'
        LIMIT 1
        """,
        role_code,
    )
    assert row is None, f"{role_code} must not have any kiosk.* permission granted in DB"
