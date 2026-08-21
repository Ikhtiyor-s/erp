"""Sprint #3 DB schema smoke tests.

Tests:
  - C4: composite/partial index existence via pg_indexes
  - M3: payment_transactions unique constraint behaviour
  - C1: cast-fix regression (endpoints return 200/401/403, never 500)

DB-level tests use asyncpg directly to avoid event-loop conflicts with the
shared SQLAlchemy engine singleton (which is bound to the app's event loop).
"""
import asyncpg
import pytest
import pytest_asyncio

from app.core.config import settings


# =========================================================
# DB connection fixture (asyncpg — loop-safe)
# =========================================================

def _pg_dsn() -> str:
    """Convert SQLAlchemy asyncpg URL to plain asyncpg DSN."""
    # e.g. postgresql+asyncpg://erp:erp@localhost:5432/erp
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


@pytest_asyncio.fixture
async def pgconn():
    """Raw asyncpg connection for direct DB queries."""
    conn = await asyncpg.connect(_pg_dsn())
    yield conn
    await conn.close()


# =========================================================
# C4 — composite/partial index smoke tests
# =========================================================

INDEXES = [
    "ix_invoices_org_date",
    "ix_supplies_org_date",
    "ix_purchase_orders_org_date",
    "ix_customer_orders_org_date",
    "ix_transfers_org_date",
    "ix_sale_returns_org_date",
    "ix_contracts_org_start",
    "ix_inventories_org",
    "ix_tasks_org_open",
    "ix_tasks_assignee_open",
    "ix_refresh_tokens_user_active",
    "ix_refresh_tokens_expires",
    "ix_user_invitations_expires",
]


@pytest.mark.asyncio
@pytest.mark.parametrize("idx_name", INDEXES)
async def test_index_exists(pgconn, idx_name):
    """Every Sprint #3 composite/partial index must be present in pg_indexes."""
    row = await pgconn.fetchrow(
        "SELECT 1 FROM pg_indexes WHERE indexname = $1",
        idx_name,
    )
    assert row is not None, f"Index '{idx_name}' not found in pg_indexes"


# =========================================================
# M3 — payment_transactions unique constraint tests
# =========================================================

@pytest.mark.asyncio
async def test_uq_payment_tx_provider_exists(pgconn):
    """uq_payment_tx_provider UNIQUE index must exist after T-3 patch."""
    row = await pgconn.fetchrow(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'uq_payment_tx_provider'",
    )
    assert row is not None, (
        "uq_payment_tx_provider index not found — T-3 patch may have been skipped "
        "due to duplicate data or not applied yet"
    )


@pytest.mark.asyncio
async def test_payment_tx_unique_violation(pgconn):
    """Inserting the same (provider, provider_tx_id) twice must raise UniqueViolationError."""
    row = await pgconn.fetchrow("SELECT id FROM organizations LIMIT 1")
    if row is None:
        pytest.skip("No organizations in DB — cannot test payment_transactions insert")
    org_id = row["id"]

    provider = "test_click"
    tx_id = "tx-sprint3-dup-001"

    # Clean up any leftover from a previous failed run
    await pgconn.execute(
        "DELETE FROM payment_transactions WHERE provider = $1 AND provider_tx_id = $2",
        provider, tx_id,
    )

    # First insert — must succeed
    await pgconn.execute(
        "INSERT INTO payment_transactions "
        "(organization_id, provider, provider_tx_id, amount, status) "
        "VALUES ($1, $2, $3, 1000, 'created')",
        org_id, provider, tx_id,
    )

    # Second insert with same (provider, provider_tx_id) — must raise UniqueViolationError
    try:
        await pgconn.execute(
            "INSERT INTO payment_transactions "
            "(organization_id, provider, provider_tx_id, amount, status) "
            "VALUES ($1, $2, $3, 2000, 'created')",
            org_id, provider, tx_id,
        )
        pytest.fail(
            "Expected asyncpg.UniqueViolationError for duplicate "
            "(provider, provider_tx_id) — none raised"
        )
    except asyncpg.UniqueViolationError:
        pass  # expected
    finally:
        await pgconn.execute(
            "DELETE FROM payment_transactions WHERE provider = $1 AND provider_tx_id = $2",
            provider, tx_id,
        )


@pytest.mark.asyncio
async def test_payment_tx_null_provider_tx_id_allowed(pgconn):
    """Multiple rows with provider_tx_id=NULL must not violate the partial unique index."""
    row = await pgconn.fetchrow("SELECT id FROM organizations LIMIT 1")
    if row is None:
        pytest.skip("No organizations in DB — cannot test payment_transactions insert")
    org_id = row["id"]

    inserted_ids = []
    try:
        for i in range(3):
            pid = await pgconn.fetchval(
                "INSERT INTO payment_transactions "
                "(organization_id, provider, provider_tx_id, amount, status) "
                "VALUES ($1, 'test_null', NULL, $2, 'created') "
                "RETURNING id",
                org_id, 100 * (i + 1),
            )
            inserted_ids.append(pid)
    except asyncpg.UniqueViolationError:
        pytest.fail("NULL provider_tx_id rows should not trigger unique_violation")
    finally:
        for pid in inserted_ids:
            await pgconn.execute(
                "DELETE FROM payment_transactions WHERE id = $1", pid
            )


# =========================================================
# C1 — cast-fix regression: endpoints must not return 500
# =========================================================

@pytest.mark.asyncio
async def test_statistics_endpoint_no_date_cast_error(client):
    """Statistics products endpoint must return 200 (not 401/500) after cast fix.

    Uses the authenticated `client` fixture (Bearer + X-Organization-Id).
    A 401 here means the auth fixture is broken — fix conftest, not this test.
    A 500 means the asyncpg CAST error is still present.
    """
    resp = await client.get(
        "/api/v1/statistics/products",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31"},
    )
    assert resp.status_code != 500, (
        f"statistics/products returned 500 — asyncpg cast error still present: {resp.text[:300]}"
    )
    assert resp.status_code in (200, 422), (
        f"Expected 200/422 with authenticated client, got {resp.status_code}: {resp.text[:300]}"
    )


@pytest.mark.asyncio
async def test_finance_price_deviation_no_date_cast_error(client):
    """Finance price-deviation endpoint must return 200 (not 401/500) after cast fix.

    Uses the authenticated `client` fixture (Bearer + X-Organization-Id).
    """
    resp = await client.get(
        "/api/v1/finance/price-deviation",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31"},
    )
    assert resp.status_code != 500, (
        f"finance/price-deviation returned 500 — asyncpg cast error still present: {resp.text[:300]}"
    )
    assert resp.status_code in (200, 422), (
        f"Expected 200/422 with authenticated client, got {resp.status_code}: {resp.text[:300]}"
    )


@pytest.mark.asyncio
async def test_statistics_production_no_date_cast_error(client):
    """Statistics production endpoint must return 200 (not 401/500) after finished_at cast fix.

    Uses the authenticated `client` fixture (Bearer + X-Organization-Id).
    """
    resp = await client.get(
        "/api/v1/statistics/production",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31"},
    )
    assert resp.status_code != 500, (
        f"statistics/production returned 500 — asyncpg cast error still present: {resp.text[:300]}"
    )
    assert resp.status_code in (200, 422), (
        f"Expected 200/422 with authenticated client, got {resp.status_code}: {resp.text[:300]}"
    )
