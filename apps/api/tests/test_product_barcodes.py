"""
Integration tests for T-203: product_barcodes CRUD + lookup.
Run inside container: docker exec erp-api pytest apps/api/tests/test_product_barcodes.py -v

T-3 (barcode-katalog integration) additions, below the T-203 tests:
- Client-level unit tests (always run) exercise `barcode_katalog_client`
  directly against a small in-process mock server (started by the
  `mock_shared_service` fixture) — no external process/container needed,
  since T-2's real service isn't runnable yet (DESIGN.md's frozen §5/§10
  contract is what's being mocked).
- End-to-end tests (suffixed `_e2e`) exercise the real HTTP endpoints
  against the already-running `erp-api` server process and are gated by
  `BARCODE_KATALOG_BASE_URL`/`BARCODE_KATALOG_API_KEY` being configured on
  that process's own environment (they can't be monkeypatched from this
  test process — different OS process) — skipped with a clear reason
  when unconfigured, matching this repo's default/until-T-5-deploys state.
"""
import asyncio
import json
import os
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL
from app.core.config import settings as erp_settings
from app.modules.warehouse import barcode_katalog_client

pytestmark = pytest.mark.asyncio

_BC_PREFIX = f"_TEST_BC_{secrets.token_hex(4)}_"


async def _ensure_product(client: httpx.AsyncClient, name: str) -> str:
    r = await client.get("/api/v1/warehouse/products", params={"q": name})
    assert r.status_code == 200
    for prod in r.json():
        if prod["name"] == name:
            return prod["id"]
    r = await client.post("/api/v1/warehouse/products", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.mark.asyncio
async def test_add_and_list_barcode(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_A")
    bc = f"{_BC_PREFIX}BC001"

    # Add barcode
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc, "is_primary": True})
    assert r.status_code == 201, r.text
    bid = r.json()["id"]
    assert isinstance(bid, int)

    # List — should contain our barcode
    r = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes")
    assert r.status_code == 200
    codes = [b["barcode"] for b in r.json()]
    assert bc in codes

    # Verify is_primary flag
    primary_rows = [b for b in r.json() if b["barcode"] == bc]
    assert primary_rows[0]["is_primary"] is True


@pytest.mark.asyncio
async def test_duplicate_active_barcode_409(client: httpx.AsyncClient):
    pid_a = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_DUP_A")
    pid_b = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_DUP_B")
    bc = f"{_BC_PREFIX}DUP001"

    # Add barcode to product A
    r = await client.post(f"/api/v1/warehouse/products/{pid_a}/barcodes",
                          json={"barcode": bc})
    assert r.status_code in (201, 409), r.text  # 409 if already exists from earlier run

    # Try to add same barcode to product B — must return 409
    r = await client.post(f"/api/v1/warehouse/products/{pid_b}/barcodes",
                          json={"barcode": bc})
    assert r.status_code == 409, r.text


@pytest.mark.asyncio
async def test_set_primary_single_primary(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_PRIMARY")
    bc1 = f"{_BC_PREFIX}PRI001"
    bc2 = f"{_BC_PREFIX}PRI002"

    r1 = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                           json={"barcode": bc1, "is_primary": True})
    assert r1.status_code in (201, 409), r1.text

    r2 = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                           json={"barcode": bc2, "is_primary": False})
    assert r2.status_code in (201, 409), r2.text
    if r2.status_code == 409:
        pytest.skip("Barcode already exists from earlier run; skipping set-primary test")
    bid2 = r2.json()["id"]

    # Set bc2 as primary
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes/{bid2}/set-primary")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # Now bc2 must be primary and bc1 must not
    r = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes",
                         params={"is_active": "true"})
    assert r.status_code == 200
    barcodes = r.json()
    primary_list = [b for b in barcodes if b["is_primary"]]
    assert len(primary_list) == 1, f"Expected 1 primary, got {primary_list}"
    assert primary_list[0]["barcode"] == bc2


@pytest.mark.asyncio
async def test_deactivate_barcode(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_DEACT")
    bc = f"{_BC_PREFIX}DEACT001"

    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc})
    if r.status_code == 409:
        # Already exists; get the id
        rl = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes")
        rows = [b for b in rl.json() if b["barcode"] == bc and b["is_active"]]
        if not rows:
            pytest.skip("Barcode already deactivated; cannot re-deactivate in this test")
        bid = rows[0]["id"]
    else:
        assert r.status_code == 201, r.text
        bid = r.json()["id"]

    # Deactivate
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes/{bid}/deactivate")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # Should not appear in active list
    r = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes",
                         params={"is_active": "true"})
    assert r.status_code == 200
    active_codes = [b["barcode"] for b in r.json()]
    assert bc not in active_codes

    # barcode-lookup must NOT find it
    r = await client.get("/api/v1/warehouse/barcode-lookup", params={"q": bc})
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_reactivate_barcode(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_REACT")
    bc = f"{_BC_PREFIX}REACT001"

    # Add then deactivate
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc})
    if r.status_code == 409:
        pytest.skip("Barcode active on another product; cannot test reactivate cleanly")
    assert r.status_code == 201, r.text
    bid = r.json()["id"]

    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes/{bid}/deactivate")
    assert r.status_code == 200

    # Reactivate
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes/{bid}/reactivate")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # Now should be active again
    r = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes",
                         params={"is_active": "true"})
    active_codes = [b["barcode"] for b in r.json()]
    assert bc in active_codes


@pytest.mark.asyncio
async def test_barcode_lookup_finds_product(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_LOOKUP")
    bc = f"{_BC_PREFIX}LOOK001"

    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc})
    assert r.status_code in (201, 409), r.text

    r = await client.get("/api/v1/warehouse/barcode-lookup", params={"q": bc})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["id"] == pid


@pytest.mark.asyncio
async def test_barcode_lookup_404_unknown(client: httpx.AsyncClient):
    r = await client.get("/api/v1/warehouse/barcode-lookup",
                         params={"q": f"{_BC_PREFIX}NONEXISTENT_XYZ_99999"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_cross_org_isolation(client: httpx.AsyncClient, org_id: str):
    """Verify that barcodes are scoped to org (test against own org endpoint only)."""
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_ORG_ISO")
    bc = f"{_BC_PREFIX}ORG_ISO001"

    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc})
    assert r.status_code in (201, 409), r.text

    # Lookup from same org — must find
    r = await client.get("/api/v1/warehouse/barcode-lookup", params={"q": bc})
    assert r.status_code == 200

    # Create a client with no org header — must get 422 or 403
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as bare:
        token = client.headers.get("Authorization", "")
        bare.headers["Authorization"] = token
        r2 = await bare.get("/api/v1/warehouse/barcode-lookup", params={"q": bc})
        assert r2.status_code in (400, 401, 403, 422), (
            f"Expected auth/org error without org header, got {r2.status_code}"
        )


# =========================================================
# T-3: barcode-katalog integration
# =========================================================

_MOCK_API_KEY = "test-mock-key"
_MOCK_HIT_BARCODE = "4780069000154"  # DESIGN.md §10's own worked example
_MOCK_SLOW_LOOKUP_BARCODE = "88888888"
_MOCK_SLOW_CONTRIBUTE_BARCODE = "99999999"


class _MockBarcodeKatalogHandler(BaseHTTPRequestHandler):
    """Mocks barcode-katalog's frozen v1 contract (DESIGN.md §5) for
    client-level unit tests. Magic barcodes simulate degraded conditions:
    slow lookup/contribute (both past ERP's own client-side timeouts)."""

    contributions: dict = {}

    def _send(self, code, body):
        data = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _check_key(self):
        return self.headers.get("X-API-Key") == _MOCK_API_KEY

    def do_GET(self):
        if self.path.startswith("/v1/lookup/"):
            barcode = self.path.rsplit("/", 1)[-1]
            if barcode == _MOCK_SLOW_LOOKUP_BARCODE:
                time.sleep(1.0)
            if not self._check_key():
                self._send(401, {"detail": "invalid_api_key"})
                return
            if barcode == _MOCK_HIT_BARCODE:
                self._send(200, {
                    "barcode": barcode, "name": "Coca-Cola Classic",
                    "brand": "Coca-Cola", "category": "Colas", "locale": None,
                    "image_url": None, "mxik_code": None, "mxik_name": None,
                    "source": "seed", "verified": True, "scan_count": 7,
                })
                return
            self._send(404, {"detail": "not_found"})
            return
        self._send(404, {"detail": "not_found"})

    def do_POST(self):
        if self.path == "/v1/contribute":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            barcode = body.get("barcode")
            if barcode == _MOCK_SLOW_CONTRIBUTE_BARCODE:
                time.sleep(3.0)
            if not self._check_key():
                self._send(401, {"detail": "invalid_api_key"})
                return
            self.contributions[barcode] = body
            self._send(200, {
                "barcode": barcode, "name": body.get("name"), "brand": None,
                "category": None, "locale": None, "image_url": None,
                "mxik_code": None, "mxik_name": None,
                "source": "erp-contributed", "verified": False,
                "scan_count": 0, "applied": True,
            })
            return
        self._send(404, {"detail": "not_found"})

    def log_message(self, format, *args):
        pass


@pytest.fixture(scope="module")
def mock_shared_service():
    """Self-contained in-process mock of barcode-katalog's v1 contract —
    no external process/container needed since T-2's real service isn't
    runnable yet; built directly against DESIGN.md's frozen contract."""
    server = ThreadingHTTPServer(("127.0.0.1", 0), _MockBarcodeKatalogHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()
    server.server_close()


@pytest.fixture
def configured_shared_service(mock_shared_service, monkeypatch):
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_BASE_URL", mock_shared_service)
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_API_KEY", _MOCK_API_KEY)
    return mock_shared_service


async def test_client_lookup_hit_returns_entry(configured_shared_service):
    result = await barcode_katalog_client.lookup(_MOCK_HIT_BARCODE)
    assert result is not None
    assert result["name"] == "Coca-Cola Classic"
    assert result["brand"] == "Coca-Cola"


async def test_client_lookup_miss_returns_none(configured_shared_service):
    result = await barcode_katalog_client.lookup("00000000")
    assert result is None


async def test_client_lookup_slow_service_times_out_to_none(configured_shared_service):
    start = time.monotonic()
    result = await barcode_katalog_client.lookup(_MOCK_SLOW_LOOKUP_BARCODE)
    elapsed = time.monotonic() - start
    assert result is None
    assert elapsed < 0.9, f"lookup() took {elapsed:.2f}s — 300ms client timeout not enforced"


async def test_client_lookup_unreachable_returns_none_fast(monkeypatch):
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_BASE_URL", "http://127.0.0.1:1")
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_API_KEY", "whatever")
    start = time.monotonic()
    result = await barcode_katalog_client.lookup(_MOCK_HIT_BARCODE)
    elapsed = time.monotonic() - start
    assert result is None
    assert elapsed < 1.0, f"lookup() took {elapsed:.2f}s against an unreachable host"


async def test_client_lookup_noop_when_not_configured(monkeypatch):
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_BASE_URL", "")
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_API_KEY", "")
    result = await barcode_katalog_client.lookup(_MOCK_HIT_BARCODE)
    assert result is None


async def test_client_contribute_delivers_payload(configured_shared_service):
    barcode = "4444444444444"
    _MockBarcodeKatalogHandler.contributions.pop(barcode, None)
    await barcode_katalog_client.contribute(barcode, "Test Lavash", "org_abc")
    assert _MockBarcodeKatalogHandler.contributions.get(barcode) == {
        "barcode": barcode, "name": "Test Lavash", "contributor_org_id": "org_abc",
    }


async def test_client_contribute_unreachable_swallows_error_and_logs(monkeypatch, caplog):
    """T-3 hard requirement, client level: an unreachable shared service
    must never raise, and the drop must be logged (DESIGN.md §9), not silent."""
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_BASE_URL", "http://127.0.0.1:1")
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_API_KEY", "whatever")
    start = time.monotonic()
    with caplog.at_level("WARNING"):
        await barcode_katalog_client.contribute(_MOCK_HIT_BARCODE, "Test", "org_test")
    elapsed = time.monotonic() - start
    assert elapsed < 1.0, f"contribute() took {elapsed:.2f}s against an unreachable host"
    assert any("barcode-katalog" in rec.message for rec in caplog.records)


async def test_client_contribute_noop_when_not_configured(monkeypatch):
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_BASE_URL", "")
    monkeypatch.setattr(erp_settings, "BARCODE_KATALOG_API_KEY", "")
    await barcode_katalog_client.contribute(_MOCK_HIT_BARCODE, "Test", "org_test")  # must not raise


# ---- End-to-end: real HTTP against the live erp-api server process -------
# Gated on the SERVER process's own env (can't be monkeypatched from this
# separate test process) — skipped until BARCODE_KATALOG_BASE_URL/
# BARCODE_KATALOG_API_KEY are configured (expected default until T-2/T-5
# deploy the real service; see T-3 report for a verification run against a
# mock pointed at by that env).

_SHARED_CATALOG_CONFIGURED = bool(os.environ.get("BARCODE_KATALOG_BASE_URL")) and bool(
    os.environ.get("BARCODE_KATALOG_API_KEY")
)
_SHARED_CATALOG_SKIP_REASON = (
    "BARCODE_KATALOG_BASE_URL/BARCODE_KATALOG_API_KEY not configured on the "
    "erp-api server process — expected until T-2/T-5 deploy barcode-katalog."
)


@pytest.mark.skipif(not _SHARED_CATALOG_CONFIGURED, reason=_SHARED_CATALOG_SKIP_REASON)
async def test_barcode_lookup_falls_back_to_shared_catalog_e2e(client: httpx.AsyncClient):
    barcode = _MOCK_HIT_BARCODE
    r = await client.get("/api/v1/warehouse/barcode-lookup", params={"q": barcode})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["id"] is None
    assert data["source"] == "shared_catalog"
    assert data["name"] == "Coca-Cola Classic"
    assert data["brand"] == "Coca-Cola"
    assert data["barcode"] == barcode
    for key in ("sku", "sale_price", "purchase_price", "unit_id", "unit_name", "mxik"):
        assert data[key] is None


@pytest.mark.skipif(not _SHARED_CATALOG_CONFIGURED, reason=_SHARED_CATALOG_SKIP_REASON)
async def test_barcode_lookup_local_hit_stays_authoritative_e2e(client: httpx.AsyncClient):
    """T-3 hard requirement: org-catalog hit must stay unchanged/authoritative
    even when the shared-service fallback is fully configured and reachable."""
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_LOCAL_PRIORITY")
    bc = f"{_BC_PREFIX}LOCALPRI001"
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes", json={"barcode": bc})
    assert r.status_code in (201, 409), r.text

    r = await client.get("/api/v1/warehouse/barcode-lookup", params={"q": bc})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["id"] == pid
    assert data["source"] == "local"


@pytest.mark.skipif(not _SHARED_CATALOG_CONFIGURED, reason=_SHARED_CATALOG_SKIP_REASON)
async def test_barcode_lookup_shared_service_slow_still_clean_404_e2e(client: httpx.AsyncClient):
    """Local miss + shared service slower than ERP's 300ms client timeout
    MUST still be a clean, fast 404 — not a hang, not a 5xx."""
    barcode = _MOCK_SLOW_LOOKUP_BARCODE
    start = time.monotonic()
    r = await client.get("/api/v1/warehouse/barcode-lookup", params={"q": barcode})
    elapsed = time.monotonic() - start
    assert r.status_code == 404, r.text
    assert r.json()["detail"] == "Mahsulot topilmadi"
    assert elapsed < 0.9, f"lookup took {elapsed:.2f}s — client timeout not enforced end-to-end"


@pytest.mark.skipif(not _SHARED_CATALOG_CONFIGURED, reason=_SHARED_CATALOG_SKIP_REASON)
async def test_create_product_contributes_to_shared_service_e2e(client: httpx.AsyncClient):
    barcode = "4780069999991"
    name = f"{_BC_PREFIX}CONTRIB_PRODUCT"
    r = await client.post("/api/v1/warehouse/products", json={"name": name, "barcode": barcode})
    assert r.status_code == 201, r.text

    mock_base = os.environ["BARCODE_KATALOG_BASE_URL"]
    seen = None
    async with httpx.AsyncClient(base_url=mock_base, timeout=5) as mock_client:
        for _ in range(20):
            resp = await mock_client.get(f"/_test/contributions/{barcode}")
            if resp.status_code == 200:
                seen = resp.json()
                break
            await asyncio.sleep(0.2)
    assert seen is not None, "contribution never arrived at the shared service"
    assert seen["name"] == name


@pytest.mark.skipif(not _SHARED_CATALOG_CONFIGURED, reason=_SHARED_CATALOG_SKIP_REASON)
async def test_create_product_not_slowed_by_slow_shared_service_e2e(client: httpx.AsyncClient):
    """T-3's single most important behavioral check: product creation must
    not block/slow on the shared service even when it's badly degraded."""
    barcode = _MOCK_SLOW_CONTRIBUTE_BARCODE
    name = f"{_BC_PREFIX}SLOW_CONTRIB_PRODUCT"
    start = time.monotonic()
    r = await client.post("/api/v1/warehouse/products", json={"name": name, "barcode": barcode})
    elapsed = time.monotonic() - start
    assert r.status_code == 201, r.text
    assert elapsed < 1.0, f"product creation took {elapsed:.2f}s — contribute call blocked the response"
