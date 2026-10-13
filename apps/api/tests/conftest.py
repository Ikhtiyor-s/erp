"""
Shared pytest fixtures for Aniq ERP integration tests.

These tests run against a live API instance (default: http://localhost:8000
when run inside the container, or http://localhost:8001 when run from host).

Override via env vars:
  API_URL           - base URL (default: http://localhost:8000)
  TEST_PASSWORD     - password used for the self-registered QA admin (default: Qa12345!)
  TEST_ORG_CODE     - organization code the QA admin's org is pinned to (default: ANIQ)

Auth setup: the QA admin is NOT a pre-seeded user. The API's /auth/login now
takes {"phone", "password"} (moved off email+password in 81f7235), and no
seed script has ever created a login-capable user — so a fresh org+admin is
self-registered once per test session via the real phone+OTP /auth/register
flow (see _register_session_admin below), the same proven pattern already
used in test_ecommerce_idempotency.py. This makes the whole suite
reproducible against any fresh DB, with no manual one-off setup required.
"""
import os
import random
import uuid

import pytest
import pytest_asyncio
import httpx


API_URL = os.environ.get("API_URL", "http://localhost:8000")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "Qa12345!")
TEST_ORG_CODE = os.environ.get("TEST_ORG_CODE", "ANIQ")

_PG_DSN = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://erp:erp@erp-postgres:5432/erp",
)


_RATE_LIMIT_PATTERNS_TO_RESET = (
    "LIMITS:LIMITER/127.0.0.1//api/v1/auth/register/*",
    "LIMITS:LIMITER/127.0.0.1//api/v1/integration/telegram/bind/generate/*",
    "LIMITS:LIMITER/127.0.0.1//api/v1/customer-portal/auth/request-otp/*",
)


def _reset_test_rate_limits() -> None:
    """Delete per-endpoint rate-limit counters from Redis before each test session.

    Several endpoints have low per-hour limits (register: 5/h, bind: 3/h, otp: 3/min).
    Running the full test suite multiple times within one hour exhausts these limits.
    Only removes keys for 127.0.0.1 (the test IP) — no other data is affected.
    """
    try:
        import redis as _redis
        redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
        r = _redis.from_url(redis_url, socket_connect_timeout=2)
        for pattern in _RATE_LIMIT_PATTERNS_TO_RESET:
            keys = r.keys(pattern)
            if keys:
                r.delete(*keys)
    except Exception:
        pass


_CACHED_TOKEN: dict = {}


def _rand_phone() -> str:
    return "+998" + "".join(str(random.randint(0, 9)) for _ in range(9))


def _pin_org_code(org_id: str) -> str:
    """Point the freshly self-registered org's `code` at TEST_ORG_CODE.

    /auth/register always assigns a random lowercase code ("org-<hex>"). A
    handful of tests hardcode the literal org code (webhook URL path params,
    customer-portal OTP `org_code`) instead of resolving it dynamically, so
    this makes the session's org resolve under that literal too. Falls back
    to a TEST_ORG_CODE-prefixed random code if that code is already taken by
    another organization in this DB (e.g. a manually-run seed_demo.py) —
    `organizations.code` is globally UNIQUE, so stealing it outright would
    break whatever already owns it.
    """
    import asyncio
    import asyncpg

    async def _update(code: str) -> None:
        conn = await asyncpg.connect(_PG_DSN)
        try:
            await conn.execute("UPDATE organizations SET code = $1 WHERE id = $2", code, org_id)
        finally:
            await conn.close()

    try:
        asyncio.run(_update(TEST_ORG_CODE))
        return TEST_ORG_CODE
    except asyncpg.exceptions.UniqueViolationError:
        fallback = TEST_ORG_CODE + uuid.uuid4().hex[:8].upper()
        asyncio.run(_update(fallback))
        return fallback


def _register_session_admin() -> None:
    """Self-register a fresh org+admin via the real phone+OTP flow and cache
    the result for the whole pytest session.

    Idempotent: a no-op once _CACHED_TOKEN is populated, so it is safe to
    call both from pytest_sessionstart (the normal path, runs once before
    collection) and defensively from the auth_token fixture itself.
    """
    if "token" in _CACHED_TOKEN:
        return

    phone = _rand_phone()
    with httpx.Client(base_url=API_URL, timeout=10) as c:
        otp = c.post("/api/v1/auth/register/request-otp", json={"phone": phone})
        assert otp.status_code == 200, f"register/request-otp failed: {otp.text}"
        dev_code = otp.json()["dev_code"]

        verify = c.post(
            "/api/v1/auth/register/verify-otp",
            json={"phone": phone, "code": dev_code},
        )
        assert verify.status_code == 200, f"register/verify-otp failed: {verify.text}"
        ticket = verify.json()["ticket"]

        reg = c.post(
            "/api/v1/auth/register",
            json={
                "ticket": ticket,
                "phone": phone,
                "password": TEST_PASSWORD,
                "full_name": "QA Bot",
                "organization_name": "QA Test Org",
            },
        )
        assert reg.status_code == 201, f"register failed: {reg.text}"
        token = reg.json()["access_token"]

        orgs = c.get(
            "/api/v1/organizations/mine",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert orgs.status_code == 200, f"/organizations/mine: {orgs.text}"
        org_id = orgs.json()[0]["id"]

        # A handful of tests (e.g. test_cashbox_warehouse.py) fetch "any
        # existing product" generically and fail if none exists yet. Currency
        # and warehouse are already auto-provisioned by /auth/register's
        # onboarding seed, but products are not — create one so the session
        # org is self-sufficient regardless of which test file runs first.
        headers = {"Authorization": f"Bearer {token}", "X-Organization-Id": org_id}
        c.post(
            "/api/v1/warehouse/products",
            headers=headers,
            json={"name": "QA Seed Product", "sale_price": "10000"},
        )

    org_code = _pin_org_code(org_id)

    _CACHED_TOKEN["token"] = token
    _CACHED_TOKEN["org"] = org_id
    _CACHED_TOKEN["org_code"] = org_code


def pytest_sessionstart(session):
    _reset_test_rate_limits()
    _register_session_admin()


@pytest_asyncio.fixture
async def http_client():
    """Plain httpx async client (no auth)."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        yield c


@pytest_asyncio.fixture
async def auth_token():
    """Return the access token for the session's self-registered QA admin.

    Registration happens once in pytest_sessionstart (see
    _register_session_admin); this just reads the cache. The defensive call
    here covers the unlikely case of a test run that skips session hooks.
    """
    _register_session_admin()
    return _CACHED_TOKEN["token"]


@pytest_asyncio.fixture
async def org_id(http_client: httpx.AsyncClient, auth_token: str) -> str:
    """Return the session's self-registered organization UUID."""
    return _CACHED_TOKEN["org"]


@pytest_asyncio.fixture
async def client(http_client, auth_token, org_id):
    """Authenticated client with both Bearer and X-Organization-Id headers set."""
    http_client.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "X-Organization-Id": org_id,
    })
    return http_client


async def _wipe_integration_settings(org_id: str) -> None:
    """Remove integration config rows from app_settings for the given org.

    Uses a fresh asyncpg connection to avoid event-loop conflicts with the
    app's SQLAlchemy connection pool (which is tied to a different loop instance).
    """
    import asyncpg
    conn = await asyncpg.connect(_PG_DSN)
    try:
        await conn.execute(
            "DELETE FROM app_settings "
            "WHERE organization_id = $1 "
            "AND key IN ('integrations', 'crm', 'online_payments')",
            org_id,
        )
    finally:
        await conn.close()


@pytest_asyncio.fixture(autouse=True)
async def _clean_integrations(auth_token, org_id):
    """Wipe integration config in app_settings before and after every test.

    Prevents cross-test config pollution for all scaffold tests (Group A root cause).
    Uses a fresh asyncpg connection per call to avoid SQLAlchemy pool/loop conflicts.
    """
    await _wipe_integration_settings(org_id)
    yield
    await _wipe_integration_settings(org_id)
