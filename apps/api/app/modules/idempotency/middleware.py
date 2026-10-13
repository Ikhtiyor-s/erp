"""
IdempotencyMiddleware — T-208

Intercepts POST/PATCH/DELETE on whitelisted paths. When an Idempotency-Key
header is present:
  - HIT: returns the cached 2xx response (no downstream call).
  - CONFLICT: same key, different request body → 409.
  - MISS: forwards to handler, captures 2xx response, stores it.

Key is scoped per organization_id — cross-org isolation is guaranteed.
Entries expire after 24 h; lazy cleanup runs with ~1% probability per request.
"""
import hashlib
import json
import logging
import random

from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.db.session import AsyncSessionLocal


log = logging.getLogger(__name__)

# (method, path_prefix) pairs that opt in to idempotency protection.
# Only state-changing, non-idempotent paths are listed here.
_WHITELIST: tuple[tuple[str, str], ...] = (
    ("POST",   "/api/v1/sale/sales"),
    # No trailing slash above: startswith() already matches every POST
    # sub-resource under /sale/sales/{id}/... (pay, pay-split, cancel,
    # duplicate). The explicit trailing-slash entry below documents that
    # coverage so it survives a future tightening of the bare prefix above.
    ("POST",   "/api/v1/sale/sales/"),
    ("POST",   "/api/v1/sale/returns"),
    ("POST",   "/api/v1/warehouse/receipts"),
    ("POST",   "/api/v1/warehouse/write-offs"),
    ("POST",   "/api/v1/warehouse/transfers"),
    ("POST",   "/api/v1/warehouse/internal-transfers"),
    ("POST",   "/api/v1/warehouse/purchases"),
    ("POST",   "/api/v1/finance/cash-movements"),
    ("POST",   "/api/v1/warehouse/supplier-returns"),
    ("POST",   "/api/v1/sale-returns"),
    ("PATCH",  "/api/v1/sale/sales/"),
    ("DELETE", "/api/v1/sale/sales/"),
    ("POST",   "/api/v1/warehouse/stock-ins"),
    ("POST",   "/api/v1/warehouse/stock-in-reasons"),
    ("POST",   "/api/v1/warehouse/inventories/"),
    ("POST",   "/api/v1/warehouse/supplier-returns/"),
    ("POST",   "/api/v1/customer-portal/me/orders"),
    ("POST",   "/api/v1/shop/checkout"),
    ("POST",   "/api/v1/customer/customers/"),  # covers .../{cid}/loyalty/adjust (RG-6)
    ("POST",   "/api/v1/kiosk/checkout"),
)

# These whitelisted paths have no X-Organization-Id header to key on: the
# B2B portal derives org purely from the customer JWT, the B2C storefront is
# fully anonymous (org resolved from org_code in the body), and the kiosk
# path authenticates with a device bearer token instead of a staff JWT (no
# human RBAC at all on this path — SKIP_PATHS_PREFIX in rbac/middleware.py).
# Each needs a path-specific fallback to resolve a real organizations.id —
# the idempotency_keys.organization_id column is a NOT NULL FK, so anything
# else (e.g. keying by a synthetic value) would just fail the INSERT silently.
_PORTAL_ORDERS_PATH = "/api/v1/customer-portal/me/orders"
_SHOP_CHECKOUT_PATH = "/api/v1/shop/checkout"
_KIOSK_CHECKOUT_PATH = "/api/v1/kiosk/checkout"


def _resolve_portal_order_org(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    from app.modules.customer_portal.auth import decode_customer_token
    payload = decode_customer_token(token)
    if not payload:
        return None
    org = payload.get("org")
    return str(org) if org else None


async def _resolve_shop_checkout_org(db, body_bytes: bytes) -> str | None:
    try:
        payload = json.loads(body_bytes)
        code = payload.get("org_code")
    except Exception:
        return None
    if not code or not isinstance(code, str):
        return None
    res = await db.execute(
        text("SELECT id FROM organizations WHERE UPPER(code) = :c AND is_active = TRUE"),
        {"c": code.upper()},
    )
    row = res.first()
    return str(row.id) if row else None


async def _resolve_kiosk_checkout_org(db, request: Request) -> str | None:
    """Mirror of kiosk/auth.py::get_current_kiosk_device's own token lookup
    (parse Bearer, strip the cosmetic "kiosk_" prefix, SHA-256 hash, look up
    kiosk_devices.token_hash) — deliberately not imported from there, since
    that function needs a live Request/commits last_used_at; here we only
    need the organization_id, read-only, before the real dependency runs.
    Revoked/unknown tokens resolve to None here exactly like they 401 there —
    this middleware then just forwards to call_next() and lets the real
    get_current_kiosk_device() dependency reject the request normally.
    """
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip().removeprefix("kiosk_")
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    res = await db.execute(
        text(
            "SELECT organization_id FROM kiosk_devices "
            "WHERE token_hash = :h AND status = 'active'"
        ),
        {"h": token_hash},
    )
    row = res.first()
    return str(row.organization_id) if row else None


def _is_whitelisted(method: str, path: str) -> bool:
    for m, prefix in _WHITELIST:
        if method == m and path.startswith(prefix):
            return True
    return False


class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        ikey = request.headers.get("Idempotency-Key")
        if not ikey or not _is_whitelisted(request.method, request.url.path):
            return await call_next(request)

        # Body must be read (and re-injected) up front: the two auth-header-less
        # paths below resolve org_id from the body/JWT instead of a header.
        body_bytes = await request.body()

        async def _receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        request._receive = _receive  # type: ignore[attr-defined]

        # Both org_id and user_id must be present — auth middleware runs first (LIFO).
        path = request.url.path
        org_id = request.headers.get("X-Organization-Id")
        user_id = getattr(request.state, "user_id", None)
        if not org_id:
            if request.method == "POST" and path == _PORTAL_ORDERS_PATH:
                org_id = _resolve_portal_order_org(request)
            elif request.method == "POST" and path == _SHOP_CHECKOUT_PATH:
                async with AsyncSessionLocal() as db:
                    org_id = await _resolve_shop_checkout_org(db, body_bytes)
            elif request.method == "POST" and path == _KIOSK_CHECKOUT_PATH:
                async with AsyncSessionLocal() as db:
                    org_id = await _resolve_kiosk_checkout_org(db, request)
        if not org_id:
            # Let the auth/org middleware (or the endpoint itself) reject the
            # request normally — nothing mutates without a resolved org.
            return await call_next(request)

        # Validate key length (max 128 chars per contract).
        if len(ikey) > 128:
            return JSONResponse(
                status_code=422,
                content={"detail": "Idempotency-Key must be at most 128 characters"},
            )

        request_hash = hashlib.sha256(body_bytes).hexdigest()

        async with AsyncSessionLocal() as db:
            # Probabilistic lazy TTL cleanup (~1% per qualifying request).
            if random.random() < 0.01:
                try:
                    await db.execute(
                        text(
                            "DELETE FROM idempotency_keys"
                            " WHERE expires_at < NOW() AND organization_id = :o"
                        ),
                        {"o": org_id},
                    )
                    await db.commit()
                except Exception as exc:
                    log.debug("Idempotency TTL cleanup failed (non-fatal): %s", exc)

            res = await db.execute(
                text(
                    "SELECT response_status, response_body, request_hash"
                    " FROM idempotency_keys"
                    " WHERE idempotency_key = :k AND organization_id = :o"
                    "   AND expires_at > NOW()"
                ),
                {"k": ikey, "o": org_id},
            )
            existing = res.first()

        if existing:
            if existing.request_hash != request_hash:
                return JSONResponse(
                    status_code=409,
                    content={
                        "detail": "Idempotency-Key conflict: same key used with different request body",
                        "code": "IDEMPOTENCY_CONFLICT",
                    },
                    headers={
                        "Idempotency-Key": ikey,
                        "X-Idempotency-Replayed": "false",
                    },
                )
            return JSONResponse(
                status_code=existing.response_status,
                content=existing.response_body,
                headers={
                    "Idempotency-Key": ikey,
                    "X-Idempotency-Replayed": "true",
                },
            )

        # MISS — forward to the actual handler.
        response = await call_next(request)

        # Only cache successful (2xx) responses.
        if 200 <= response.status_code < 300:
            resp_body_bytes = b""
            async for chunk in response.body_iterator:
                resp_body_bytes += chunk

            try:
                resp_json = json.loads(resp_body_bytes)
            except Exception:
                resp_json = {"_raw": resp_body_bytes.decode(errors="replace")}

            try:
                async with AsyncSessionLocal() as db:
                    await db.execute(
                        text(
                            "INSERT INTO idempotency_keys"
                            " (idempotency_key, organization_id, user_id,"
                            "  method, path, request_hash, response_status, response_body)"
                            " VALUES (:k, :o, :u, :m, :p, :rh, :rs, :rb)"
                            " ON CONFLICT (idempotency_key, organization_id) DO NOTHING"
                        ),
                        {
                            "k": ikey,
                            "o": org_id,
                            "u": user_id,
                            "m": request.method,
                            "p": request.url.path,
                            "rh": request_hash,
                            "rs": response.status_code,
                            "rb": json.dumps(resp_json),
                        },
                    )
                    await db.commit()
            except Exception as exc:
                log.debug("Idempotency save failed (non-fatal): %s", exc)

            return JSONResponse(
                status_code=response.status_code,
                content=resp_json,
                headers={
                    "Idempotency-Key": ikey,
                    "X-Idempotency-Replayed": "false",
                },
            )

        return response
