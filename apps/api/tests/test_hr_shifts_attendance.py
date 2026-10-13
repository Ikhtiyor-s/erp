"""
Integration tests for RG-5: HR employee shift schedule + clock-in/out
attendance (distinct from cashbox_sessions, the cashier cash-handling shift).

Requires a running API with a seeded QA org (see conftest.py).
Run inside the container:
    docker exec erp-api python -m pytest tests/test_hr_shifts_attendance.py -v
"""
import os
import random
import secrets
from datetime import date, datetime, timedelta, timezone

import httpx
import pytest
import pytest_asyncio


pytestmark = pytest.mark.asyncio

_SUFFIX = secrets.token_hex(4)
API_URL = os.environ.get("API_URL", "http://localhost:8000")


def hr_url(path: str) -> str:
    return f"/api/v1/hr{path}"


def _parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _rand_phone() -> str:
    return "+998" + "".join(str(random.randint(0, 9)) for _ in range(9))


async def _register_org(org_name: str) -> dict:
    """Self-register a brand-new org + admin via the real phone+OTP flow.

    Used only by the cross-org isolation test below, which needs a second,
    genuinely separate organization (not the shared session org from
    conftest.py). Same pattern as test_ecommerce_idempotency.py.
    """
    phone = _rand_phone()
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        otp = await c.post("/api/v1/auth/register/request-otp", json={"phone": phone})
        assert otp.status_code == 200, otp.text
        dev_code = otp.json()["dev_code"]

        verify = await c.post(
            "/api/v1/auth/register/verify-otp", json={"phone": phone, "code": dev_code}
        )
        assert verify.status_code == 200, verify.text
        ticket = verify.json()["ticket"]

        reg = await c.post(
            "/api/v1/auth/register",
            json={
                "ticket": ticket,
                "phone": phone,
                "password": "TestPass123!",
                "full_name": "RG5 QA Bot",
                "organization_name": org_name,
            },
        )
        assert reg.status_code == 201, reg.text
        token = reg.json()["access_token"]

        orgs = await c.get(
            "/api/v1/organizations/mine", headers={"Authorization": f"Bearer {token}"}
        )
        assert orgs.status_code == 200, orgs.text
        org_id = orgs.json()[0]["id"]

    return {"headers": {"Authorization": f"Bearer {token}", "X-Organization-Id": org_id}}


@pytest_asyncio.fixture
async def employee(client: httpx.AsyncClient):
    resp = await client.post(
        hr_url("/employees"), json={"full_name": f"RG5 Test Employee {_SUFFIX}"}
    )
    assert resp.status_code == 201, resp.text
    eid = resp.json()["id"]
    yield eid
    await client.delete(hr_url(f"/employees/{eid}"))


# ---------------------------------------------------------------------------
# Shift schedule
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_assign_and_list_shift(client: httpx.AsyncClient, employee: str):
    today = date.today().isoformat()
    resp = await client.post(
        hr_url("/shifts"),
        json={
            "employee_id": employee,
            "work_date": today,
            "start_time": "09:00:00",
            "end_time": "18:00:00",
        },
    )
    assert resp.status_code == 201, resp.text
    shift_id = resp.json()["id"]

    lst = await client.get(hr_url("/shifts"), params={"employee_id": employee})
    assert lst.status_code == 200
    rows = lst.json()
    assert any(r["id"] == shift_id and r["work_date"] == today for r in rows)

    await client.delete(hr_url(f"/shifts/{shift_id}"))
    lst2 = await client.get(hr_url("/shifts"), params={"employee_id": employee})
    assert not any(r["id"] == shift_id for r in lst2.json())


@pytest.mark.asyncio
async def test_shift_invalid_time_range_rejected(client: httpx.AsyncClient, employee: str):
    resp = await client.post(
        hr_url("/shifts"),
        json={
            "employee_id": employee,
            "work_date": date.today().isoformat(),
            "start_time": "18:00:00",
            "end_time": "09:00:00",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_shift_same_day_upserts_not_duplicates(client: httpx.AsyncClient, employee: str):
    today = date.today().isoformat()
    r1 = await client.post(
        hr_url("/shifts"),
        json={"employee_id": employee, "work_date": today, "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    assert r1.status_code == 201
    sid1 = r1.json()["id"]

    r2 = await client.post(
        hr_url("/shifts"),
        json={"employee_id": employee, "work_date": today, "start_time": "10:00:00", "end_time": "19:00:00"},
    )
    assert r2.status_code == 201
    assert r2.json()["id"] == sid1

    lst = await client.get(hr_url("/shifts"), params={"employee_id": employee, "from": today, "to": today})
    rows = [r for r in lst.json() if r["employee_id"] == employee]
    assert len(rows) == 1
    assert rows[0]["start_time"] == "10:00:00"

    await client.delete(hr_url(f"/shifts/{sid1}"))


# ---------------------------------------------------------------------------
# Attendance: server-side-only timestamps
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_clock_in_ignores_client_supplied_timestamp(client: httpx.AsyncClient, employee: str):
    before = datetime.now(timezone.utc)
    fake_past = "2000-01-01T00:00:00Z"

    resp = await client.post(
        hr_url("/attendance/clock-in"),
        json={"employee_id": employee, "timestamp": fake_past, "clock_in": fake_past},
    )
    assert resp.status_code == 201, resp.text
    returned_clock_in = _parse_dt(resp.json()["clock_in"])
    after = datetime.now(timezone.utc)

    assert returned_clock_in.year > 2000
    assert before - timedelta(seconds=10) <= returned_clock_in <= after + timedelta(seconds=10)

    await client.post(hr_url("/attendance/clock-out"), json={"employee_id": employee})


@pytest.mark.asyncio
async def test_clock_out_ignores_client_supplied_timestamp(client: httpx.AsyncClient, employee: str):
    cin = await client.post(hr_url("/attendance/clock-in"), json={"employee_id": employee})
    assert cin.status_code == 201, cin.text

    before = datetime.now(timezone.utc)
    out = await client.post(
        hr_url("/attendance/clock-out"),
        json={"employee_id": employee, "timestamp": "2000-01-01T00:00:00Z"},
    )
    assert out.status_code == 200, out.text
    returned_clock_out = _parse_dt(out.json()["clock_out"])
    after = datetime.now(timezone.utc)

    assert returned_clock_out.year > 2000
    assert before - timedelta(seconds=10) <= returned_clock_out <= after + timedelta(seconds=10)


@pytest.mark.asyncio
async def test_double_clock_in_conflicts(client: httpx.AsyncClient, employee: str):
    first = await client.post(hr_url("/attendance/clock-in"), json={"employee_id": employee})
    assert first.status_code == 201, first.text

    second = await client.post(hr_url("/attendance/clock-in"), json={"employee_id": employee})
    assert second.status_code == 409

    await client.post(hr_url("/attendance/clock-out"), json={"employee_id": employee})


@pytest.mark.asyncio
async def test_clock_out_without_open_session_conflicts(client: httpx.AsyncClient, employee: str):
    resp = await client.post(hr_url("/attendance/clock-out"), json={"employee_id": employee})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_attendance_report_aggregates_hours_and_lateness(
    client: httpx.AsyncClient, employee: str
):
    today = date.today().isoformat()
    shift = await client.post(
        hr_url("/shifts"),
        json={"employee_id": employee, "work_date": today, "start_time": "09:00:00", "end_time": "18:00:00"},
    )
    assert shift.status_code == 201
    sid = shift.json()["id"]

    cin = await client.post(
        hr_url("/attendance/clock-in"), json={"employee_id": employee, "shift_id": sid}
    )
    assert cin.status_code == 201, cin.text
    cout = await client.post(hr_url("/attendance/clock-out"), json={"employee_id": employee})
    assert cout.status_code == 200, cout.text

    rep = await client.get(
        hr_url("/attendance"), params={"employee_id": employee, "from": today, "to": today}
    )
    assert rep.status_code == 200, rep.text
    data = rep.json()
    assert data["summary"]["days_present"] >= 1
    assert data["summary"]["total_worked_hours"] >= 0

    row = next(it for it in data["items"] if it["shift_id"] == sid)
    assert row["scheduled_start"] == "09:00:00"
    assert row["scheduled_end"] == "18:00:00"
    assert float(row["worked_hours"]) >= 0
    assert row["late_minutes"] is not None

    await client.delete(hr_url(f"/shifts/{sid}"))


# ---------------------------------------------------------------------------
# Cross-org isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cross_org_isolation(client: httpx.AsyncClient, employee: str):
    today = date.today().isoformat()
    shift = await client.post(
        hr_url("/shifts"),
        json={"employee_id": employee, "work_date": today, "start_time": "08:00:00", "end_time": "16:00:00"},
    )
    assert shift.status_code == 201
    sid = shift.json()["id"]

    cin = await client.post(hr_url("/attendance/clock-in"), json={"employee_id": employee})
    assert cin.status_code == 201

    org_b = await _register_org(f"RG5 Org B {_SUFFIX}")
    async with httpx.AsyncClient(base_url=API_URL, timeout=10, headers=org_b["headers"]) as c2:
        shifts_b = await c2.get(hr_url("/shifts"))
        assert shifts_b.status_code == 200
        assert not any(r["id"] == sid for r in shifts_b.json())

        att_b = await c2.get(hr_url("/attendance"))
        assert att_b.status_code == 200
        assert not any(it["employee_id"] == employee for it in att_b.json()["items"])

        # Org B cannot clock in / manage org A's employee or shift (404, not leaked)
        bad_clock = await c2.post(hr_url("/attendance/clock-in"), json={"employee_id": employee})
        assert bad_clock.status_code == 404

        bad_delete = await c2.delete(hr_url(f"/shifts/{sid}"))
        assert bad_delete.status_code == 404

    await client.post(hr_url("/attendance/clock-out"), json={"employee_id": employee})
    await client.delete(hr_url(f"/shifts/{sid}"))
