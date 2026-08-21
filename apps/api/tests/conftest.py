"""
Shared pytest fixtures for Aniq ERP integration tests.

These tests run against a live API instance (default: http://localhost:8000
when run inside the container, or http://localhost:8001 when run from host).

Override via env vars:
  API_URL           - base URL (default: http://localhost:8000)
  TEST_EMAIL        - login email (default: qa@example.com)
  TEST_PASSWORD     - login password (default: Qa12345!)
  TEST_ORG_CODE     - organization code (default: ANIQ)
"""
import asyncio
import os
import pytest
import pytest_asyncio
import httpx


API_URL = os.environ.get("API_URL", "http://localhost:8000")
TEST_EMAIL = os.environ.get("TEST_EMAIL", "qa@example.com")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "Qa12345!")
TEST_ORG_CODE = os.environ.get("TEST_ORG_CODE", "ANIQ")


@pytest_asyncio.fixture
async def http_client():
    """Plain httpx async client (no auth)."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        yield c


_CACHED_TOKEN: dict = {}


@pytest_asyncio.fixture
async def auth_token():
    """Log in as the QA tester and return the access token.

    Sprint #2: cache across tests in this session. The login endpoint is rate
    limited to 10/min (login throttle is part of the security baseline); doing
    a fresh login per test triggers 429 once the suite has more than 10 tests.
    """
    if "token" in _CACHED_TOKEN:
        return _CACHED_TOKEN["token"]
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        resp = await c.post(
            "/api/v1/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    _CACHED_TOKEN["token"] = token
    return token


@pytest_asyncio.fixture
async def org_id(http_client: httpx.AsyncClient, auth_token: str) -> str:
    """Resolve the ANIQ organization UUID via /organizations/mine."""
    if "org" in _CACHED_TOKEN:
        return _CACHED_TOKEN["org"]
    resp = await http_client.get(
        "/api/v1/organizations/mine",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200, f"/organizations/mine: {resp.status_code} {resp.text[:200]}"
    orgs = resp.json()
    if not isinstance(orgs, list):
        pytest.fail(f"/organizations/mine returned non-list: {orgs}")
    for o in orgs:
        if o.get("code") == TEST_ORG_CODE:
            _CACHED_TOKEN["org"] = o["id"]
            return o["id"]
    pytest.skip(f"Test org {TEST_ORG_CODE} not found in user's orgs")


@pytest_asyncio.fixture
async def client(http_client, auth_token, org_id):
    """Authenticated client with both Bearer and X-Organization-Id headers set."""
    http_client.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "X-Organization-Id": org_id,
    })
    return http_client
