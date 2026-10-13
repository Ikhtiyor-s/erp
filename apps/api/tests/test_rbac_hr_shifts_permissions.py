"""
Unit tests for RG-5: new HR shift-schedule / attendance permission codes.

Imports permissions.py directly (no DB, no HTTP) — same pattern as
test_rbac_warehouse_permissions.py.
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


EXPECTED = ["hr.shifts.manage", "hr.attendance.view"]


def test_new_codes_in_catalog(perms_module):
    codes = {pm["code"] for pm in perms_module.ALL_PERMISSIONS}
    missing = [c for c in EXPECTED if c not in codes]
    assert not missing, f"Missing from ALL_PERMISSIONS: {missing}"


def test_admin_gets_both(perms_module):
    admin = set(perms_module.ROLE_GRANTS["admin"])
    missing = [c for c in EXPECTED if c not in admin]
    assert not missing, f"admin missing: {missing}"


def test_manager_can_manage_shifts_and_view_attendance(perms_module):
    mgr = set(perms_module.ROLE_GRANTS["manager"])
    assert "hr.shifts.manage" in mgr
    assert "hr.attendance.view" in mgr


def test_accountant_can_view_attendance_not_manage_shifts(perms_module):
    acc = set(perms_module.ROLE_GRANTS["accountant"])
    assert "hr.attendance.view" in acc
    assert "hr.shifts.manage" not in acc


def test_cashier_has_neither(perms_module):
    cashier = set(perms_module.ROLE_GRANTS["cashier"])
    assert "hr.shifts.manage" not in cashier
    assert "hr.attendance.view" not in cashier


def test_viewer_gets_attendance_view_not_shifts_manage(perms_module):
    viewer = set(perms_module.ROLE_GRANTS["viewer"])
    assert "hr.attendance.view" in viewer
    assert "hr.shifts.manage" not in viewer


def test_legacy_hr_payroll_permissions_untouched(perms_module):
    codes = {pm["code"] for pm in perms_module.ALL_PERMISSIONS}
    assert "hr.payroll.approve" in codes
    assert "hr.payroll.pay" in codes
