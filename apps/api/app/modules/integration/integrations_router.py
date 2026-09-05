"""Integration Hub router — /api/v1/integrations/* (DESIGN-3 Section 5, FROZEN).

Separate from the legacy /api/v1/integration/* router which handles
Click/Payme/Telegram webhooks and MUST NOT be touched.
"""
import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_db
from app.core.rate_limit import limiter
from app.modules.integration.delivery.bts import BTSDeliveryIntegration
from app.modules.integration.delivery.yandex import YandexDeliveryIntegration
from app.modules.integration.registry import INTEGRATION_REGISTRY, get_integration

log = logging.getLogger(__name__)

# Maps short provider alias used in delivery URL paths to integration classes.
_DELIVERY_PROVIDERS: dict[str, type] = {
    "yandex": YandexDeliveryIntegration,
    "bts": BTSDeliveryIntegration,
}

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ---------------------------------------------------------------------------
# GET /integrations  — list all providers
# ---------------------------------------------------------------------------

@router.get("")
async def list_integrations(
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    result = []
    for code, cls in INTEGRATION_REGISTRY.items():
        integration = cls(db=db, org_id=org_id)
        status = await integration.get_status()
        configured = await integration.is_configured()
        result.append({
            "code": code,
            "name": cls.name,
            "category": cls.category,
            "description": getattr(cls, "description", ""),
            "enabled": await integration.is_enabled(),
            "credentials_required": cls.credentials_required,
            "configured": configured,
            "status": status,
        })
    return result


# ---------------------------------------------------------------------------
# GET /integrations/status — lightweight status map for Integration Hub (T-130)
# Must come BEFORE /{code} to avoid "status" being treated as {code}.
# ---------------------------------------------------------------------------

@router.get("/status")
async def integrations_status(
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    result = {}
    for code, cls in INTEGRATION_REGISTRY.items():
        integration = cls(db=db, org_id=org_id)
        result[code] = await integration.get_status()
    return result


# ---------------------------------------------------------------------------
# Delivery sub-router: /integrations/delivery/{provider}/...
# provider = "yandex" | "bts"
# All endpoints are scaffold — real calls require credentials.
# Must come BEFORE /{code} catch-all.
# ---------------------------------------------------------------------------

def _get_delivery(provider: str, db: AsyncSession, org_id: str):
    cls = _DELIVERY_PROVIDERS.get(provider)
    if cls is None:
        raise HTTPException(status_code=404, detail=f"Delivery provider '{provider}' topilmadi. yandex yoki bts ishlating")
    return cls(db=db, org_id=org_id)


@router.post("/delivery/{provider}/estimate")
async def delivery_estimate(
    provider: str,
    payload: dict = Body(default={}),
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Estimate delivery cost — stub until credentials are configured."""
    svc = _get_delivery(provider, db, org_id)
    if hasattr(svc, "estimate"):
        return await svc.estimate(
            address=payload.get("address", {}),
            items=payload.get("items", []),
        )
    return {"status": "stub", "message": "credentials_required", "stubbed": True}


@router.post("/delivery/{provider}/shipment/create")
async def delivery_create_shipment(
    provider: str,
    payload: dict = Body(default={}),
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Create courier shipment — stub until credentials are configured."""
    _get_delivery(provider, db, org_id)
    log.info("delivery_create_shipment provider=%s (stub)", provider)
    return {"status": "stub", "message": "credentials_required", "stubbed": True}


@router.get("/delivery/{provider}/shipment/{tracking_id}")
async def delivery_track_shipment(
    provider: str,
    tracking_id: str,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Track shipment status — stub until credentials are configured."""
    _get_delivery(provider, db, org_id)
    log.info("delivery_track_shipment provider=%s tracking_id=%s (stub)", provider, tracking_id)
    return {"status": "stub", "tracking_id": tracking_id, "message": "credentials_required", "stubbed": True}


@router.post("/delivery/{provider}/shipment/{tracking_id}/cancel")
async def delivery_cancel_shipment(
    provider: str,
    tracking_id: str,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel shipment — stub until credentials are configured."""
    _get_delivery(provider, db, org_id)
    log.info("delivery_cancel_shipment provider=%s tracking_id=%s (stub)", provider, tracking_id)
    return {"status": "stub", "tracking_id": tracking_id, "message": "credentials_required", "stubbed": True}


@router.post("/delivery/{provider}/webhook")
@limiter.limit("120/minute")
async def delivery_webhook(
    request: Request,
    provider: str,
    db: AsyncSession = Depends(get_db),
):
    """Receive courier status callback — scaffold, no auth required (public webhook)."""
    cls = _DELIVERY_PROVIDERS.get(provider)
    if cls is None:
        raise HTTPException(status_code=404, detail=f"Delivery provider '{provider}' topilmadi")
    try:
        body = await request.json()
    except Exception:
        body = {}
    log.info("delivery_webhook provider=%s keys=%s", provider, list(body.keys()))
    return {"ok": True, "stubbed": True, "provider": provider, "note": f"{provider} webhook scaffold — real implementation pending credentials"}


# ---------------------------------------------------------------------------
# GET /integrations/{code} — single provider config (secrets sensored)
# ---------------------------------------------------------------------------

@router.get("/{code}")
async def get_integration_config(
    code: str,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration(code, db, org_id)
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration topilmadi")

    cls = INTEGRATION_REGISTRY[code]
    public_cfg = await integration.get_public_config()
    configured = await integration.is_configured()

    return {
        "code": code,
        "name": cls.name,
        "category": cls.category,
        "enabled": await integration.is_enabled(),
        "credentials_required": cls.credentials_required,
        "configured": configured,
        "config": public_cfg,
    }


# ---------------------------------------------------------------------------
# PUT /integrations/{code} — save config (encrypt secrets)
# Idempotency-Key header accepted; PUT is naturally idempotent so
# we honor it without a separate cache (same payload → same DB state).
# ---------------------------------------------------------------------------

@router.put("/{code}")
async def save_integration_config(
    code: str,
    payload: dict = Body(default={}),
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration(code, db, org_id)
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration topilmadi")

    await integration.save_config(payload)
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /integrations/{code}/test — connection test
# ---------------------------------------------------------------------------

@router.post("/{code}/test")
async def test_integration(
    code: str,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration(code, db, org_id)
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration topilmadi")

    configured = await integration.is_configured()
    if integration.credentials_required and not configured:
        raise HTTPException(status_code=400, detail="Konfiguratsiya toʻliq emas")

    return await integration.test_connection()


# ---------------------------------------------------------------------------
# POST /integrations/{code}/enable
# ---------------------------------------------------------------------------

@router.post("/{code}/enable")
async def enable_integration(
    code: str,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration(code, db, org_id)
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration topilmadi")

    configured = await integration.is_configured()
    if integration.credentials_required and not configured:
        raise HTTPException(
            status_code=400,
            detail="Konfiguratsiya toʻliq emas — avval sozlang",
        )

    await integration.set_enabled(True)
    return {"ok": True, "enabled": True}


# ---------------------------------------------------------------------------
# POST /integrations/{code}/disable
# ---------------------------------------------------------------------------

@router.post("/{code}/disable")
async def disable_integration(
    code: str,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration(code, db, org_id)
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration topilmadi")

    await integration.set_enabled(False)
    return {"ok": True, "enabled": False}
