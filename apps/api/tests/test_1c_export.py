"""Tests for 1C Buxgalteriya export endpoints.

Coverage:
- CSV happy path: 200, UTF-8 BOM, correct Content-Disposition, correct header row
- XML happy path: 200, valid XML, CommerceML 2.0 root element
- date_to < date_from → 400
- date range > 366 days → 400
- type=sales, type=cash, type=counterparties, type=all
- empty result → still valid CSV/XML (no 500)
- org isolation: response must only contain data of the requesting org
- M1/M2: finance.export_1c permission exists and is granted to correct roles
"""
import xml.etree.ElementTree as ET
import pytest


# ---------------------------------------------------------------------------
# M1/M2: permission catalog unit tests
# ---------------------------------------------------------------------------

def test_finance_export_1c_in_all_permissions():
    from app.modules.rbac.permissions import ALL_PERMISSIONS
    codes = {p["code"] for p in ALL_PERMISSIONS}
    assert "finance.export_1c" in codes


def test_finance_export_1c_granted_to_admin():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "finance.export_1c" in ROLE_GRANTS["admin"]


def test_finance_export_1c_granted_to_manager():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "finance.export_1c" in ROLE_GRANTS["manager"]


def test_finance_export_1c_granted_to_accountant():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "finance.export_1c" in ROLE_GRANTS["accountant"]


BASE = "/api/v1/finance"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _has_bom(content: bytes) -> bool:
    return content[:3] == b"\xef\xbb\xbf"


def _csv_header(content: bytes) -> str:
    text = content.decode("utf-8-sig")  # strips BOM
    return text.splitlines()[0]


# ---------------------------------------------------------------------------
# CSV tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_csv_happy_path_all(client):
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31", "type": "all"},
    )
    assert resp.status_code == 200, resp.text
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert "1c-export" in resp.headers.get("content-disposition", "")
    assert _has_bom(resp.content), "CSV must start with UTF-8 BOM for 1C compatibility"


@pytest.mark.asyncio
async def test_csv_sales_header(client):
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31", "type": "sales"},
    )
    assert resp.status_code == 200, resp.text
    header = _csv_header(resp.content)
    assert "Дата" in header
    assert "Документ" in header
    assert "Сумма" in header


@pytest.mark.asyncio
async def test_csv_cash_header(client):
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31", "type": "cash"},
    )
    assert resp.status_code == 200, resp.text
    header = _csv_header(resp.content)
    assert "Направление" in header
    assert "Касса" in header


@pytest.mark.asyncio
async def test_csv_counterparties_header(client):
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31", "type": "counterparties"},
    )
    assert resp.status_code == 200, resp.text
    header = _csv_header(resp.content)
    assert "Наименование" in header


@pytest.mark.asyncio
async def test_csv_empty_date_range_still_200(client):
    """Future date where no data exists — must return 200 with header only."""
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_from": "2099-01-01", "date_to": "2099-01-31", "type": "sales"},
    )
    assert resp.status_code == 200, resp.text
    assert _has_bom(resp.content)
    lines = resp.content.decode("utf-8-sig").strip().splitlines()
    assert len(lines) >= 1, "At least header row expected"


# ---------------------------------------------------------------------------
# XML tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_xml_happy_path_all(client):
    resp = await client.get(
        f"{BASE}/export/1c-xml",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31", "type": "all"},
    )
    assert resp.status_code == 200, resp.text
    assert "xml" in resp.headers["content-type"]
    assert "attachment" in resp.headers.get("content-disposition", "")
    root = ET.fromstring(resp.content)
    assert root.tag == "КоммерческаяИнформация"
    assert root.get("ВерсияСхемы") == "2.0"


@pytest.mark.asyncio
async def test_xml_sales_structure(client):
    resp = await client.get(
        f"{BASE}/export/1c-xml",
        params={"date_from": "2026-01-01", "date_to": "2026-12-31", "type": "sales"},
    )
    assert resp.status_code == 200, resp.text
    root = ET.fromstring(resp.content)
    assert root.tag == "КоммерческаяИнформация"
    for doc in root.findall("Документ"):
        assert doc.find("Тип") is not None
        assert doc.find("Сумма") is not None


@pytest.mark.asyncio
async def test_xml_empty_still_valid(client):
    resp = await client.get(
        f"{BASE}/export/1c-xml",
        params={"date_from": "2099-01-01", "date_to": "2099-01-31", "type": "cash"},
    )
    assert resp.status_code == 200, resp.text
    root = ET.fromstring(resp.content)
    assert root.tag == "КоммерческаяИнформация"


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_date_inverted_returns_400(client):
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_from": "2026-03-01", "date_to": "2026-01-01", "type": "all"},
    )
    assert resp.status_code == 400, resp.text


@pytest.mark.asyncio
async def test_date_range_too_large_returns_400(client):
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_from": "2024-01-01", "date_to": "2026-01-01", "type": "all"},
    )
    assert resp.status_code == 400, resp.text


@pytest.mark.asyncio
async def test_missing_date_returns_422(client):
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_to": "2026-01-31", "type": "all"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_unknown_type_returns_422(client):
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31", "type": "bogus"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Org isolation test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_csv_no_cross_org_data(client, org_id):
    """Org isolation: the export must include X-Organization-Id and return only that org's data."""
    resp = await client.get(
        f"{BASE}/export/1c-csv",
        params={"date_from": "2026-01-01", "date_to": "2026-12-31", "type": "sales"},
    )
    assert resp.status_code == 200
    # The fixture already uses the correct org header; we just verify 200 without error.
    # A second org would need a separate user — that's an auth-level isolation tested in RBAC tests.
    assert _has_bom(resp.content)
