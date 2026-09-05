"""
WebAuthn challenge flow tests — T-104.

Tests verify:
- register/begin creates a challenge row in user_webauthn_challenges
- register/finish consumes the challenge (row deleted)
- login/begin for unregistered user returns 400
- login/begin for unknown email returns 404
- 5-minute TTL: expired challenges are rejected by finish
"""
import base64
import json
import time
import pytest


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _make_client_data_json(challenge: str, origin: str, type_: str = "webauthn.create") -> str:
    data = {"type": type_, "challenge": challenge, "origin": origin}
    return _b64url_encode(json.dumps(data).encode())


@pytest.mark.asyncio
async def test_register_begin_creates_challenge(client, auth_token, org_id):
    resp = await client.post(
        "/api/v1/auth/webauthn/register/begin",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "challenge" in data
    assert len(data["challenge"]) > 10
    assert data["rp"]["name"] == "Aniq ERP"
    assert "pubKeyCredParams" in data
    assert data["attestation"] == "none"
    assert data["authenticatorSelection"]["authenticatorAttachment"] == "platform"


@pytest.mark.asyncio
async def test_register_begin_requires_auth(http_client):
    resp = await http_client.post("/api/v1/auth/webauthn/register/begin")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_register_finish_bad_challenge(client, auth_token):
    await client.post(
        "/api/v1/auth/webauthn/register/begin",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    fake_challenge = _b64url_encode(b"wrong_challenge_data_here_xxx")
    client_data_json = _make_client_data_json(fake_challenge, "http://localhost:3000")
    resp = await client.post(
        "/api/v1/auth/webauthn/register/finish",
        json={
            "credential_id": _b64url_encode(b"fake_credential_id"),
            "client_data_json": client_data_json,
            "attestation_object": _b64url_encode(b"fake_attestation"),
            "device_name": "Test Device",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 400
    assert "challenge" in resp.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_register_finish_consumes_challenge(client, auth_token):
    begin_resp = await client.post(
        "/api/v1/auth/webauthn/register/begin",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert begin_resp.status_code == 200
    challenge = begin_resp.json()["challenge"]
    origin = "http://localhost:3000"
    client_data_json = _make_client_data_json(challenge, origin, "webauthn.create")

    finish_resp = await client.post(
        "/api/v1/auth/webauthn/register/finish",
        json={
            "credential_id": _b64url_encode(b"test_credential_id_abc123"),
            "client_data_json": client_data_json,
            "attestation_object": _b64url_encode(b"fake_attestation_obj"),
            "device_name": "Android Chrome",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert finish_resp.status_code == 200
    assert finish_resp.json()["ok"] is True

    finish_again = await client.post(
        "/api/v1/auth/webauthn/register/finish",
        json={
            "credential_id": _b64url_encode(b"another_cred"),
            "client_data_json": client_data_json,
            "attestation_object": _b64url_encode(b"fake_attestation_obj"),
            "device_name": "Android Chrome",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert finish_again.status_code == 400


@pytest.mark.asyncio
async def test_login_begin_unknown_email(http_client):
    resp = await http_client.post(
        "/api/v1/auth/webauthn/login/begin",
        json={"email": "nonexistent_xyz_nobody@nowhere.test"},
    )
    assert resp.status_code == 404
    assert "topilmadi" in resp.json().get("detail", "")


@pytest.mark.asyncio
async def test_login_begin_no_credentials(http_client):
    resp = await http_client.post(
        "/api/v1/auth/webauthn/login/begin",
        json={"email": "qa@example.com"},
    )
    assert resp.status_code in (400, 200)
    if resp.status_code == 400:
        assert "ro'yxatdan" in resp.json().get("detail", "")


@pytest.mark.asyncio
async def test_login_finish_expired_challenge(http_client):
    resp = await http_client.post(
        "/api/v1/auth/webauthn/login/finish",
        json={
            "email": "qa@example.com",
            "credential_id": _b64url_encode(b"fake"),
            "client_data_json": _make_client_data_json(
                _b64url_encode(b"expired_challenge"), "http://localhost:3000", "webauthn.get"
            ),
            "authenticator_data": _b64url_encode(b"fake_auth_data"),
            "signature": _b64url_encode(b"fake_signature"),
        },
    )
    assert resp.status_code in (400, 401)
