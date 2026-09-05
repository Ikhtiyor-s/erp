"""Tests for Sprint 4 integration seam fixes.

Covers:
  C1 — status import: HTTPException(status.HTTP_404_NOT_FOUND) in router.py
  C2 — new webhook paths skip RBAC middleware (no X-Organization-Id required)
  W1 — TelegramIntegration.save_config writes to key='crm', get_raw_config reads from 'crm'
  W2 — ClickIntegration/PaymeIntegration read/write key='online_payments' sub-key

Run:
  docker exec erp-api pytest apps/api/tests/test_integration_seam.py -v
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# C1 — `status` is importable from the router module (no NameError at runtime)
# ---------------------------------------------------------------------------

def test_c1_status_imported_from_router():
    """Importing router must not raise NameError for `status`."""
    from app.modules.integration import router as integration_router
    from fastapi import status as fastapi_status
    assert hasattr(fastapi_status, "HTTP_404_NOT_FOUND")
    # Verify the router module has `status` available in its namespace
    import sys
    mod = sys.modules.get("app.modules.integration.router")
    assert mod is not None
    assert hasattr(mod, "status"), "status not found in integration.router namespace"
    assert mod.status.HTTP_404_NOT_FOUND == 404


# ---------------------------------------------------------------------------
# C2 — RBAC middleware skips new payment webhook paths
# ---------------------------------------------------------------------------

def test_c2_alif_webhook_skipped():
    from app.modules.rbac.middleware import _is_skipped
    assert _is_skipped("/api/v1/integration/alif/webhook/test-org") is True


def test_c2_uzum_webhook_skipped():
    from app.modules.rbac.middleware import _is_skipped
    assert _is_skipped("/api/v1/integration/uzum/webhook/ORG123") is True


def test_c2_multicard_webhook_skipped():
    from app.modules.rbac.middleware import _is_skipped
    assert _is_skipped("/api/v1/integration/multicard/webhook/MYORG") is True


def test_c2_rahmat_webhook_skipped():
    from app.modules.rbac.middleware import _is_skipped
    assert _is_skipped("/api/v1/integration/rahmat/webhook/CORP") is True


def test_c2_legacy_paths_still_skipped():
    from app.modules.rbac.middleware import _is_skipped
    assert _is_skipped("/api/v1/integration/click/webhook/ORG") is True
    assert _is_skipped("/api/v1/integration/payme/webhook/ORG") is True
    assert _is_skipped("/api/v1/integration/telegram/webhook/ORG") is True


def test_c2_protected_paths_not_skipped():
    """Non-webhook integration paths must still require auth."""
    from app.modules.rbac.middleware import _is_skipped
    assert _is_skipped("/api/v1/integration/telegram/test") is False
    assert _is_skipped("/api/v1/integration/telegram/bind/generate") is False


# ---------------------------------------------------------------------------
# W1 — TelegramIntegration reads/writes key='crm'
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_w1_telegram_get_raw_config_reads_crm_key():
    """get_raw_config must query key='crm', not key='integrations'."""
    from app.modules.integration.registry import TelegramIntegration

    executed_queries = []

    async def fake_execute(query, params=None):
        executed_queries.append(str(query))
        mock_result = MagicMock()
        mock_result.first.return_value = None
        return mock_result

    db = AsyncMock()
    db.execute = fake_execute

    svc = TelegramIntegration(db=db, org_id="org-123")
    result = await svc.get_raw_config()

    assert result == {}
    assert any("'crm'" in q for q in executed_queries), (
        f"Expected query with key='crm', got: {executed_queries}"
    )
    assert not any("'integrations'" in q for q in executed_queries), (
        "TelegramIntegration must NOT query key='integrations'"
    )


@pytest.mark.asyncio
async def test_w1_telegram_save_config_writes_crm_key():
    """save_config must upsert into key='crm', merging with existing data."""
    from app.modules.integration.registry import TelegramIntegration

    existing_crm = {"notify_sale": True, "channel_id": "-100123456"}
    upserted_values = []

    async def fake_execute(query, params=None):
        q = str(query)
        if params and "v" in params:
            upserted_values.append((q, params))
        mock_result = MagicMock()
        # Return existing crm row on SELECT
        if "'crm'" in q and "SELECT" in q:
            row = MagicMock()
            row.value = existing_crm
            mock_result.first.return_value = row
        else:
            mock_result.first.return_value = None
        return mock_result

    db = AsyncMock()
    db.execute = fake_execute
    db.commit = AsyncMock()

    with patch("app.modules.integration.registry.secret_box.encrypt", side_effect=lambda v: f"enc:{v}"):
        svc = TelegramIntegration(db=db, org_id="org-123")
        await svc.save_config({"bot_token": "123:ABC", "enabled": True})

    assert upserted_values, "No upsert executed"
    upsert_q, upsert_p = upserted_values[-1]
    assert "'crm'" in upsert_q, f"Upsert must target key='crm', got: {upsert_q}"
    assert "online_payments" not in upsert_q, "Must NOT write to 'online_payments'"
    assert "integrations" not in upsert_q, "Must NOT write to 'integrations'"

    # Verify existing notify_sale flag is preserved after merge
    stored = json.loads(upsert_p["v"])
    assert stored.get("notify_sale") is True
    assert stored.get("channel_id") == "-100123456"
    assert stored.get("enabled") is True


# ---------------------------------------------------------------------------
# W2 — ClickIntegration reads/writes key='online_payments' sub-key 'click'
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_w2_click_get_raw_config_reads_online_payments():
    """ClickIntegration.get_raw_config must query key='online_payments'."""
    from app.modules.integration.registry import ClickIntegration

    executed_queries = []

    async def fake_execute(query, params=None):
        executed_queries.append(str(query))
        mock_result = MagicMock()
        mock_result.first.return_value = None
        return mock_result

    db = AsyncMock()
    db.execute = fake_execute

    svc = ClickIntegration(db=db, org_id="org-456")
    result = await svc.get_raw_config()

    assert result == {}
    assert any("'online_payments'" in q for q in executed_queries), (
        f"Expected query with key='online_payments', got: {executed_queries}"
    )
    assert not any("'integrations'" in q for q in executed_queries), (
        "ClickIntegration must NOT query key='integrations'"
    )


@pytest.mark.asyncio
async def test_w2_click_save_config_writes_online_payments_subkey():
    """ClickIntegration.save_config must write to 'online_payments'[click]."""
    from app.modules.integration.registry import ClickIntegration

    existing_blob = {
        "click": {"enabled": True, "service_id": "9999"},
        "payme": {"enabled": False},
    }
    upserted_values = []

    async def fake_execute(query, params=None):
        q = str(query)
        if params and "v" in params:
            upserted_values.append((q, params))
        mock_result = MagicMock()
        if "'online_payments'" in q and "SELECT" in q:
            row = MagicMock()
            row.value = existing_blob
            mock_result.first.return_value = row
        else:
            mock_result.first.return_value = None
        return mock_result

    db = AsyncMock()
    db.execute = fake_execute
    db.commit = AsyncMock()

    with patch("app.modules.integration.registry.secret_box.encrypt", side_effect=lambda v: f"enc:{v}"):
        svc = ClickIntegration(db=db, org_id="org-456")
        await svc.save_config({"merchant_id": "M001", "secret_key": "S001", "enabled": True})

    assert upserted_values, "No upsert executed"
    upsert_q, upsert_p = upserted_values[-1]
    assert "'online_payments'" in upsert_q, (
        f"Upsert must target key='online_payments', got: {upsert_q}"
    )

    stored = json.loads(upsert_p["v"])
    # Existing payme config must be preserved
    assert "payme" in stored, "Payme sub-key must survive click save"
    assert stored["payme"]["enabled"] is False
    # Click sub-key must be updated
    assert stored["click"]["enabled"] is True
    assert stored["click"].get("service_id") == "9999"  # preserved from existing


@pytest.mark.asyncio
async def test_w2_payme_save_config_writes_online_payments_subkey():
    """PaymeIntegration.save_config must write to 'online_payments'[payme]."""
    from app.modules.integration.registry import PaymeIntegration

    upserted_values = []

    async def fake_execute(query, params=None):
        q = str(query)
        if params and "v" in params:
            upserted_values.append((q, params))
        mock_result = MagicMock()
        mock_result.first.return_value = None
        return mock_result

    db = AsyncMock()
    db.execute = fake_execute
    db.commit = AsyncMock()

    with patch("app.modules.integration.registry.secret_box.encrypt", side_effect=lambda v: f"enc:{v}"):
        svc = PaymeIntegration(db=db, org_id="org-789")
        await svc.save_config({"merchant_id": "PM01", "secret_key": "SK01", "enabled": True})

    assert upserted_values
    upsert_q, upsert_p = upserted_values[-1]
    assert "'online_payments'" in upsert_q
    stored = json.loads(upsert_p["v"])
    assert "payme" in stored
    assert stored["payme"]["enabled"] is True
