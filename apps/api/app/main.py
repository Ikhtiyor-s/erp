import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.schema_patches import apply_patches
from app.db.session import engine


# --- Sentry error tracking (opt-in via SENTRY_DSN env var) ---
SENTRY_DSN = os.environ.get("SENTRY_DSN")
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=os.environ.get("ENV", "production"),
            release=os.environ.get("RELEASE", "aniq-erp@v1.0"),
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_RATE", "0.1")),
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            send_default_pii=False,  # privacy: don't send user PII
        )
    except ImportError:
        pass  # sentry-sdk not installed yet
from app.modules.auth.router import router as auth_router
from app.modules.organization.router import router as org_router
from app.modules.reference.router import router as ref_router
from app.modules.finance.router import router as finance_router
from app.modules.warehouse.router import router as warehouse_router
from app.modules.sale.router import router as sale_router
from app.modules.customer.router import router as customer_router
from app.modules.supplier.router import router as supplier_router
from app.modules.manufacturing.router import router as mfg_router
from app.modules.hr.router import router as hr_router
from app.modules.statistics.router import router as stats_router
from app.modules.settings.router import router as settings_router
from app.modules.marketing.router import router as marketing_router
from app.modules.tools.router import router as tools_router
from app.modules.tasks.router import router as tasks_router
from app.modules.audit.router import router as audit_router
from app.modules.audit.middleware import AuditMiddleware
from app.modules.rbac.middleware import PermissionMiddleware
from app.modules.rbac.router import router as rbac_router
from app.modules.rbac.seed import seed_all as seed_rbac
from app.modules.integration.router import router as integration_router
from app.modules.assistant.router import router as assistant_router
from app.modules.customer_portal.router import router as customer_portal_router
from app.modules.mobile.router import router as mobile_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await apply_patches()
    async with engine.begin() as conn:
        await seed_rbac(conn)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuditMiddleware)
app.add_middleware(PermissionMiddleware)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.ENV}


API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(org_router, prefix=API_PREFIX)
app.include_router(ref_router, prefix=API_PREFIX)
app.include_router(finance_router, prefix=API_PREFIX)
app.include_router(warehouse_router, prefix=API_PREFIX)
app.include_router(sale_router, prefix=API_PREFIX)
app.include_router(customer_router, prefix=API_PREFIX)
app.include_router(supplier_router, prefix=API_PREFIX)
app.include_router(mfg_router, prefix=API_PREFIX)
app.include_router(hr_router, prefix=API_PREFIX)
app.include_router(stats_router, prefix=API_PREFIX)
app.include_router(settings_router, prefix=API_PREFIX)
app.include_router(marketing_router, prefix=API_PREFIX)
app.include_router(tools_router, prefix=API_PREFIX)
app.include_router(tasks_router, prefix=API_PREFIX)
app.include_router(audit_router, prefix=API_PREFIX)
app.include_router(rbac_router, prefix=API_PREFIX)
app.include_router(integration_router, prefix=API_PREFIX)
app.include_router(assistant_router, prefix=API_PREFIX)
app.include_router(customer_portal_router, prefix=API_PREFIX)
app.include_router(mobile_router, prefix=API_PREFIX)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
