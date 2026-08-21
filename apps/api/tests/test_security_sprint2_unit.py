"""Sprint #2 security regression tests."""
import uuid
import pytest

def test_required_permission_export_action():
    from app.modules.rbac.middleware import required_permission
    assert required_permission("GET", "/api/v1/sale/export") == "sale.export"
    assert required_permission("GET", "/api/v1/customer/export") == "customer.export"
    assert required_permission("GET", "/api/v1/finance/report") == "finance.report"

def test_required_permission_skip_paths():
    from app.modules.rbac.middleware import required_permission
    assert required_permission("GET", "/api/v1/organizations/list") is None
    assert required_permission("GET", "/api/v1/organizations/mine") is None
    sw_path = "/api/v1/organizations/" + str(uuid.uuid4()) + "/switch"
    assert required_permission("POST", sw_path) is None
    se_path = "/api/v1/organizations/" + str(uuid.uuid4()) + "/settings"
    assert required_permission("GET", se_path) == "org.view"

def test_normalize_phone_variants():
    from app.modules.customer_portal.auth import _normalize_phone
    expected = "+998901234567"
    assert _normalize_phone("+998901234567") == expected
    assert _normalize_phone("998901234567") == expected
    assert _normalize_phone("0901234567") == expected
    assert _normalize_phone("+998 90 123-45-67") == expected

def test_normalize_phone_invalid_raises():
    from app.modules.customer_portal.auth import _normalize_phone
    with pytest.raises(ValueError):
        _normalize_phone("not-a-phone")
    with pytest.raises(ValueError):
        _normalize_phone("")
    with pytest.raises(ValueError):
        _normalize_phone(None)

