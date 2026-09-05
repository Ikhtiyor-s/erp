"""
Unit tests for T-002: new warehouse sub-resource permission codes.

These tests import permissions.py directly (no DB, no HTTP) to assert
catalog correctness and role grant rules independently of the running server.
"""
import importlib.util
import pathlib

import pytest


@pytest.fixture(scope="module")
def perms_module():
    path = pathlib.Path(__file__).parent.parent / "app" / "modules" / "rbac" / "permissions.py"
    spec = importlib.util.spec_from_file_location("permissions", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


EXPECTED_13 = [
    "warehouse.type.view", "warehouse.type.manage",
    "warehouse.rack.view", "warehouse.rack.manage",
    "warehouse.transfer.view", "warehouse.transfer.send",
    "warehouse.transfer.receive", "warehouse.transfer.cancel",
    "warehouse.request.view", "warehouse.request.create", "warehouse.request.approve",
    "warehouse.product.import", "warehouse.product.export",
]

LEGACY_BROAD = [
    "warehouse.view", "warehouse.create", "warehouse.update", "warehouse.delete",
    "warehouse.inventory", "warehouse.write_off", "warehouse.transfer",
    "warehouse.income", "warehouse.export",
]


def test_all_13_codes_in_catalog(perms_module):
    codes = {pm["code"] for pm in perms_module.ALL_PERMISSIONS}
    missing = [c for c in EXPECTED_13 if c not in codes]
    assert not missing, f"Missing from ALL_PERMISSIONS: {missing}"


def test_admin_gets_all_13(perms_module):
    admin = set(perms_module.ROLE_GRANTS["admin"])
    missing = [c for c in EXPECTED_13 if c not in admin]
    assert not missing, f"admin missing: {missing}"


def test_manager_has_send_not_cancel(perms_module):
    mgr = set(perms_module.ROLE_GRANTS["manager"])
    assert "warehouse.transfer.send" in mgr
    assert "warehouse.transfer.cancel" not in mgr


def test_manager_gets_12_of_13(perms_module):
    mgr = set(perms_module.ROLE_GRANTS["manager"])
    granted = [c for c in EXPECTED_13 if c in mgr]
    assert len(granted) == 12


def test_cashier_grants(perms_module):
    cashier = set(perms_module.ROLE_GRANTS["cashier"])
    assert "warehouse.request.create" in cashier
    assert "warehouse.transfer.view" in cashier
    assert "warehouse.request.view" in cashier
    assert "warehouse.transfer.cancel" not in cashier
    assert "warehouse.product.import" not in cashier


def test_accountant_grants(perms_module):
    acc = set(perms_module.ROLE_GRANTS["accountant"])
    assert "warehouse.product.export" in acc
    assert "warehouse.transfer.view" in acc
    assert "warehouse.request.view" in acc
    assert "warehouse.product.import" not in acc
    assert "warehouse.transfer.cancel" not in acc


def test_viewer_gets_view_codes_and_export(perms_module):
    viewer = set(perms_module.ROLE_GRANTS["viewer"])
    for code in EXPECTED_13:
        if code.endswith(".view"):
            assert code in viewer, f"viewer missing {code}"
    assert "warehouse.product.export" in viewer
    assert "warehouse.transfer.cancel" not in viewer


def test_legacy_broad_permissions_untouched(perms_module):
    codes = {pm["code"] for pm in perms_module.ALL_PERMISSIONS}
    for old in LEGACY_BROAD:
        assert old in codes, f"Legacy permission removed: {old}"
