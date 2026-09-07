"""
Permission enforcement middleware.

Sprint #2 security hardening (CR-1, CR-2, CR-3):
- CR-1: fail-CLOSED on DB errors (was fail-OPEN). Returns 503 + audit log.
- CR-2: export/import/report suffixes derive explicit permissions
        (no GET -> module.view fallback for these actions).
- CR-3: SKIP_PATHS narrowed -- /api/v1/organizations wildcard removed;
        only bootstrap endpoints (list, mine, {id}/switch) are explicit.
"""
from __future__ import annotations

import json
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.db.session import AsyncSessionLocal
from app.modules.rbac.deps import get_user_permissions


log = logging.getLogger(__name__)


URL_MODULE = {
    "sale": "sale",
    "sales": "sale",
    "warehouse": "warehouse",
    "finance": "finance",
    "customer": "customer",
    "supplier": "supplier",
    "manufacturing": "manufacturing",
    "hr": "hr",
    "marketing": "marketing",
    "reference": "reference",
    "settings": "settings",
    "statistics": "statistics",
    "tools": "tools",
    "audit": "audit",
    "rbac": "rbac",
    "organizations": "org",
    "tasks": "manufacturing",
    "assistant": "statistics",
    "integration": "settings",
    "integrations": "integrations",
}

METHOD_ACTION = {
    "GET": "view",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}

SUFFIX_ACTION = {
    "export": "export",
    "import": "import",
    "report": "report",
    "reports": "report",
}

SKIP_PATHS_EXACT = frozenset({
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/health",
    "/api/v1/rbac/me",
    "/api/v1/rbac/me/permissions",
    "/api/v1/rbac/invitations/accept",
    "/api/v1/rbac/invitations/mine",
    "/api/v1/organizations/list",
    "/api/v1/organizations/mine",
})

SKIP_PATHS_PREFIX = (
    "/api/v1/auth/",
    "/api/v1/integration/telegram/webhook",
    "/api/v1/integration/click/webhook",
    "/api/v1/integration/payme/webhook",
    "/api/v1/integration/alif/webhook",
    "/api/v1/integration/uzum/webhook",
    "/api/v1/integration/multicard/webhook",
    "/api/v1/integration/rahmat/webhook",
    "/api/v1/integration/didox/webhook",
    "/api/v1/customer-portal/",
    # Didox e-invoice — endpoint-level require_permission("settings.integration") takes over;
    # middleware also checks settings.create (which admin has) as secondary gate.
    "/api/v1/integration/didox/invoice",
)


def _is_skipped(path: str) -> bool:
    if path in SKIP_PATHS_EXACT:
        return True
    if any(path.startswith(p) for p in SKIP_PATHS_PREFIX):
        return True
    if path.startswith("/api/v1/organizations/") and path.endswith("/switch"):
        return True
    # Delivery courier webhooks are public callbacks (no auth from courier side).
    if path.startswith("/api/v1/integrations/delivery/") and path.endswith("/webhook"):
        return True
    return False


def _action_from_path_method(method: str, path: str) -> str | None:
    p = path.split("?", 1)[0].rstrip("/")
    last = p.rsplit("/", 1)[-1].lower()
    if last in SUFFIX_ACTION:
        return SUFFIX_ACTION[last]
    if last.startswith("export-") or last.startswith("export_"):
        return "export"
    if last.startswith("import-") or last.startswith("import_"):
        return "import"
    if last.startswith("report-") or last.startswith("report_"):
        return "report"
    return METHOD_ACTION.get(method)


def required_permission(method: str, path: str) -> str | None:
    if _is_skipped(path):
        return None
    if not path.startswith("/api/v1/"):
        return None
    parts = path[len("/api/v1/"):].strip("/").split("/")
    if not parts:
        return None
    first = parts[0]
    module = URL_MODULE.get(first)
    if not module:
        return None
    action = _action_from_path_method(method, path)
    if not action:
        return None
    return f"{module}.{action}"


def _user_from_auth(request: Request) -> str | None:
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


async def _record_rbac_failure(
    user_id: str | None,
    org_id: str | None,
    method: str,
    path: str,
    error: str,
) -> None:
    """CR-1: audit log entry when RBAC check itself failed.

    Uses a fresh session because the original one may be poisoned.
    Swallows all exceptions; audit must never break the failure path.
    """
    try:
        from sqlalchemy import text
        async with AsyncSessionLocal() as db2:
            await db2.execute(
                text(
                    "INSERT INTO audit_log "
                    "(organization_id, user_id, action, entity, entity_id, diff) "
                    "VALUES (:o, :u, 'rbac_check_failed', :e, :eid, CAST(:d AS jsonb))"
                ),
                {
                    "o": org_id,
                    "u": user_id,
                    "e": "rbac",
                    "eid": path[:200],
                    "d": json.dumps({"method": method, "path": path, "error": error[:500]}),
                },
            )
            await db2.commit()
    except Exception:
        pass


class PermissionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/v1/"):
            return await call_next(request)

        perm_code = required_permission(request.method, request.url.path)
        if not perm_code:
            return await call_next(request)

        user_id = _user_from_auth(request)
        org_id = request.headers.get("x-organization-id")

        if not user_id:
            return JSONResponse(
                status_code=401,
                content={"detail": "Avtorizatsiya talab qilinadi"},
            )
        if not org_id:
            return JSONResponse(
                status_code=400,
                content={"detail": "X-Organization-Id header talab qilinadi"},
            )

        # CR-1: FAIL-CLOSED.
        try:
            async with AsyncSessionLocal() as db:
                perms = await get_user_permissions(user_id, org_id, db)
        except Exception as e:
            log.error(
                "RBAC permission check failed (fail-CLOSED) path=%s method=%s err=%s",
                request.url.path, request.method, e,
            )
            await _record_rbac_failure(
                user_id, org_id, request.method, request.url.path, str(e),
            )
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Service temporarily unavailable - authorization check failed",
                },
            )

        if perm_code not in perms:
            # CR-2: do NOT fall back to module.view for export/import/report.
            action = perm_code.rsplit(".", 1)[-1]
            if request.method == "GET" and action not in ("export", "import", "report"):
                module = perm_code.split(".", 1)[0]
                if f"{module}.view" in perms:
                    return await call_next(request)
            return JSONResponse(
                status_code=403,
                content={
                    "detail": f"Sizda '{perm_code}' ruxsati yoʼq",
                    "required_permission": perm_code,
                },
            )

        return await call_next(request)
