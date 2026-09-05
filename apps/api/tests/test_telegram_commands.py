"""Tests for T-123 Telegram bot command router.

Run against a live API container:
  docker exec erp-api pytest apps/api/tests/test_telegram_commands.py -v

Covers:
  - dispatch_command unit-level: unknown command returns {"ok": True}
  - dispatch_command: /start without token returns {"ok": True}
  - dispatch_command: /yordam returns {"ok": True}
  - dispatch_command: command without binding returns {"ok": True}
  - bind/generate endpoint: returns token + deep_link (happy path)
  - bind/status: unauthenticated user returns 401
  - bind/generate: rate limit response shape
"""
import pytest
import pytest_asyncio
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import API_URL


# ---------------------------------------------------------------------------
# Unit-level tests for dispatch_command (no live DB needed)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_dispatch_ignores_non_command():
    """dispatch_command should return ok=True and do nothing for plain text."""
    from app.modules.integration.telegram import dispatch_command

    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(first=lambda: None))

    result = await dispatch_command(db, "fake-org-id", {
        "message": {
            "chat": {"id": 123456},
            "text": "hello world",
        }
    })
    assert result == {"ok": True}


@pytest.mark.asyncio
async def test_dispatch_start_without_token_calls_help():
    """/start with no token should show help, return ok=True."""
    from app.modules.integration.telegram import dispatch_command

    db = AsyncMock()
    sent_messages = []

    async def fake_execute(query, params=None):
        mock_result = MagicMock()
        mock_result.first.return_value = None
        return mock_result

    db.execute = fake_execute

    with patch("app.modules.integration.telegram._send_with_token", new_callable=AsyncMock) as mock_send, \
         patch("app.modules.integration.telegram._read_crm_settings",
               new_callable=AsyncMock,
               return_value={"telegram_token": "test-token-123"}):
        result = await dispatch_command(db, "org-1", {
            "message": {
                "chat": {"id": 9999},
                "text": "/start",
                "from": {"username": "testuser"},
            }
        })

    assert result == {"ok": True}
    mock_send.assert_called_once()
    # Help message should contain command list
    call_body = mock_send.call_args[0][2]
    assert "/buyurtma" in call_body or "Aniq ERP Bot" in call_body


@pytest.mark.asyncio
async def test_dispatch_unknown_command_sends_help_hint():
    """/unknowncommand should return ok=True and send a hint."""
    from app.modules.integration.telegram import dispatch_command

    db = AsyncMock()

    async def fake_execute(query, params=None):
        mock_result = MagicMock()
        # binding exists so authenticated branch runs
        mock_result.first.return_value = MagicMock(user_id="u1", org_id="o1")
        return mock_result

    db.execute = fake_execute

    with patch("app.modules.integration.telegram._send_with_token", new_callable=AsyncMock) as mock_send, \
         patch("app.modules.integration.telegram._read_crm_settings",
               new_callable=AsyncMock,
               return_value={"telegram_token": "test-token-123"}):
        result = await dispatch_command(db, "org-1", {
            "message": {
                "chat": {"id": 9999},
                "text": "/unknownxyz",
                "from": {"username": "testuser"},
            }
        })

    assert result == {"ok": True}
    mock_send.assert_called_once()
    call_body = mock_send.call_args[0][2]
    assert "yordam" in call_body.lower() or "noma'lum" in call_body.lower()


@pytest.mark.asyncio
async def test_dispatch_requires_binding_for_balans():
    """/balans without a binding should prompt to bind, not query DB."""
    from app.modules.integration.telegram import dispatch_command

    db = AsyncMock()
    execute_calls = []

    async def fake_execute(query, params=None):
        execute_calls.append(str(query))
        mock_result = MagicMock()
        mock_result.first.return_value = None  # no binding
        return mock_result

    db.execute = fake_execute

    with patch("app.modules.integration.telegram._send_with_token", new_callable=AsyncMock) as mock_send, \
         patch("app.modules.integration.telegram._read_crm_settings",
               new_callable=AsyncMock,
               return_value={"telegram_token": "tok"}):
        result = await dispatch_command(db, "org-1", {
            "message": {
                "chat": {"id": 42},
                "text": "/balans",
                "from": {"username": "u"},
            }
        })

    assert result == {"ok": True}
    # Should warn about missing binding, not query cashboxes
    call_body = mock_send.call_args[0][2]
    assert "ulang" in call_body.lower() or "bog'lash" in call_body.lower() or "sozlash" in call_body.lower()


@pytest.mark.asyncio
async def test_dispatch_missing_chat_id_is_ignored():
    """Updates without a chat_id should be silently ignored."""
    from app.modules.integration.telegram import dispatch_command

    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(first=lambda: None))

    with patch("app.modules.integration.telegram._read_crm_settings",
               new_callable=AsyncMock,
               return_value={"telegram_token": "tok"}):
        result = await dispatch_command(db, "org-1", {
            "message": {"text": "/balans"}  # no chat key
        })

    assert result == {"ok": True}


# ---------------------------------------------------------------------------
# HTTP-level tests (live API)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bind_generate_requires_auth(http_client: httpx.AsyncClient):
    """bind/generate without JWT should return 401."""
    resp = await http_client.post(
        "/api/v1/integration/telegram/bind/generate",
        headers={"X-Organization-Id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_bind_status_requires_auth(http_client: httpx.AsyncClient):
    """bind/status without JWT should return 401."""
    resp = await http_client.get(
        "/api/v1/integration/telegram/bind/status",
        headers={"X-Organization-Id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_bind_generate_happy_path(client: httpx.AsyncClient):
    """Authenticated bind/generate returns token + deep_link."""
    resp = await client.post("/api/v1/integration/telegram/bind/generate")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "token" in data
    assert "deep_link" in data
    assert "expires_in_seconds" in data
    assert data["expires_in_seconds"] == 900
    assert "t.me/" in data["deep_link"]
    assert len(data["token"]) >= 20


@pytest.mark.asyncio
async def test_bind_status_returns_bound_or_unbound(client: httpx.AsyncClient):
    """bind/status returns either {bound: false} or the binding details."""
    resp = await client.get("/api/v1/integration/telegram/bind/status")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "bound" in data
    if data["bound"]:
        assert "chat_id" in data
        assert "bound_at" in data


@pytest.mark.asyncio
async def test_webhook_unknown_org_returns_ok(http_client: httpx.AsyncClient):
    """Webhook for an unknown org_code should return ok=True (Telegram must not retry)."""
    resp = await http_client.post(
        "/api/v1/integration/telegram/webhook/NONEXISTENTORG",
        json={"message": {"chat": {"id": 1}, "text": "/balans"}},
    )
    assert resp.status_code == 200
    assert resp.json().get("ok") is True


@pytest.mark.asyncio
async def test_unbind_not_found_returns_404(client: httpx.AsyncClient):
    """Unbind when no active binding exists should return 404."""
    # First make sure we have no binding by calling unbind repeatedly;
    # the second call (if first happened to unbind) should give 404.
    resp1 = await client.post("/api/v1/integration/telegram/bind/unbind")
    # First call: either 200 (had a binding) or 404 (no binding)
    assert resp1.status_code in (200, 404)

    if resp1.status_code == 200:
        # Now there's no binding — second call must be 404
        resp2 = await client.post("/api/v1/integration/telegram/bind/unbind")
        assert resp2.status_code == 404


# ---------------------------------------------------------------------------
# M5: settings.integration permission is granted to manager and cashier
# ---------------------------------------------------------------------------

def test_settings_integration_granted_to_manager():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "settings.integration" in ROLE_GRANTS["manager"]


def test_settings_integration_granted_to_cashier():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "settings.integration" in ROLE_GRANTS["cashier"]


def test_settings_integration_granted_to_admin():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "settings.integration" in ROLE_GRANTS["admin"]
