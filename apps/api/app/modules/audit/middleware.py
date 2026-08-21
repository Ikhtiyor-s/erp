"""
Automatic audit logging middleware.

Captures all successful POST/PUT/DELETE/PATCH requests under /api/v1/ and
records them in audit_log. Inferring (action, entity, entity_id) from the
HTTP method and URL path.

Skipped paths: auth endpoints, audit endpoints themselves, the heavy /sales
which already self-logs.
"""
from __future__ import annotations

import json
import logging
import re

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.db.session import AsyncSessionLocal
from app.modules.audit.logger import log_action


log = logging.getLogger(__name__)


# Skip these to avoid double-logging or noise
SKIP_PATH_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/audit/",
    "/api/v1/rbac/me",
    "/api/v1/integration/telegram/webhook",  # external webhook, no user
    "/api/v1/sale/sales",      # self-logged with richer diff
)

# Map HTTP method → audit action
METHOD_ACTIONS = {
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


# /api/v1/<module>/<entity>[/<id>][/<verb>]
PATH_RE = re.compile(r"^/api/v1/(?P<module>[^/]+)/(?P<entity>[^/]+)(?:/(?P<id>[^/]+))?(?:/(?P<verb>[^/]+))?/?$")


def _entity_id_from_path(method: str, path: str) -> tuple[str, str | None, str | None]:
    """
    Extract (entity, entity_id, verb) from URL.
    Returns ("", None, None) if path doesn't match expected pattern.
    """
    m = PATH_RE.match(path)
    if not m:
        return "", None, None
    return m.group("entity") or "", m.group("id"), m.group("verb")


# Fields whose VALUES must never be persisted to audit_log.diff
SENSITIVE_KEYS = frozenset({
    "password", "initial_password", "new_password", "old_password",
    "password_hash", "passcode",
    "token", "access_token", "refresh_token", "api_key", "apikey",
    "secret", "secret_key", "client_secret", "private_key",
    "eskiz_password", "playmobile_password",
    "card_number", "cvv", "pan",
})


def _redact(obj):
    """Recursively replace any value whose key is in SENSITIVE_KEYS with '***'."""
    if isinstance(obj, dict):
        return {
            k: ("***" if k.lower() in SENSITIVE_KEYS else _redact(v))
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [_redact(x) for x in obj]
    return obj


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only audit mutating methods
        if request.method not in METHOD_ACTIONS:
            return await call_next(request)

        path = request.url.path
        if not path.startswith("/api/v1/"):
            return await call_next(request)
        if any(path.startswith(p) for p in SKIP_PATH_PREFIXES):
            return await call_next(request)

        # Capture body before passing on (we need to read it without consuming)
        body_bytes = await request.body()

        # Re-inject body for downstream handlers
        async def receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        request._receive = receive  # type: ignore[attr-defined]

        response = await call_next(request)

        # Only log successful mutations (2xx)
        if response.status_code >= 400:
            return response

        # Resolve user_id and org_id from headers/state
        org_id = request.headers.get("x-organization-id")
        user_id = getattr(request.state, "user_id", None)

        # If user_id wasn't injected by auth dep, try to decode from JWT
        if not user_id:
            user_id = _user_from_auth_header(request)

        entity, entity_id, verb = _entity_id_from_path(request.method, path)
        action = verb or METHOD_ACTIONS[request.method]

        # Build a small diff: request body (if JSON) — capped at 4 KB
        # Sensitive fields (password, token, secret, ...) are redacted to '***'
        diff: dict | None = None
        if body_bytes:
            try:
                if len(body_bytes) > 4096:
                    body_bytes_trunc = body_bytes[:4096]
                else:
                    body_bytes_trunc = body_bytes
                parsed = json.loads(body_bytes_trunc)
                diff = {"body": _redact(parsed)}
            except Exception:
                diff = {"body_raw_size": len(body_bytes)}

        # Open a fresh DB session for the log write
        try:
            async with AsyncSessionLocal() as db:
                await log_action(
                    db, org_id, user_id, action, entity, entity_id,
                    diff=diff, request=request,
                )
                await db.commit()
        except Exception as e:
            log.debug("Audit middleware swallowed: %s", e)

        return response


def _user_from_auth_header(request: Request) -> str | None:
    """Best-effort decode user_id from Authorization: Bearer <jwt>."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    try:
        from app.core.security import decode_token
        payload = decode_token(token)
        return payload.get("sub") if payload else None
    except Exception:
        return None
