"""Integration Hub router — /api/v1/integrations/* (DESIGN-3 Section 5, FROZEN).

Separate from the legacy /api/v1/integration/* router which handles
Click/Payme/Telegram webhooks and MUST NOT be touched.
"""
import json
import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_db
from app.core.rate_limit import limiter
from app.modules.integration.delivery.bts import BTSDeliveryIntegration
from app.modules.integration.delivery.yandex import YandexDeliveryIntegration
from app.modules.integration.registry import INTEGRATION_REGISTRY, get_integration
from app.modules.integration.marketplace import build_export_payload

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
# Marketplace sync (audit gap #3) — /integrations/marketplace/...
# Must come BEFORE /{code} catch-all.
# ---------------------------------------------------------------------------

@router.post("/marketplace/sync")
async def marketplace_sync(
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Export active products+stock to the configured marketplace endpoint.
    Always logs the attempt (success, http error, connection error, or
    skipped-not-configured) so staff can see what happened."""
    integration = get_integration("marketplace", db, org_id)
    cfg = await integration.get_raw_config()
    payload = await build_export_payload(db, org_id)

    if not cfg.get("enabled") or not cfg.get("api_url"):
        await db.execute(
            text("""
                INSERT INTO marketplace_sync_log (organization_id, direction, status, item_count, message)
                VALUES (:o, 'export_products', 'skipped', :c, 'Integratsiya sozlanmagan yoki o''chirilgan')
            """),
            {"o": org_id, "c": payload["count"]},
        )
        await db.commit()
        return {"status": "skipped", "message": "Integratsiya sozlanmagan yoki o'chirilgan", "item_count": payload["count"]}

    import httpx
    status_, message = "error", ""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                cfg["api_url"], json=payload,
                headers={"Authorization": f"Bearer {cfg.get('api_key', '')}", "X-Store-Id": str(cfg.get("store_id", ""))},
            )
        status_ = "success" if resp.status_code < 300 else "error"
        message = f"HTTP {resp.status_code}"
    except Exception as e:
        message = str(e)[:500]

    await db.execute(
        text("""
            INSERT INTO marketplace_sync_log (organization_id, direction, status, item_count, message)
            VALUES (:o, 'export_products', :s, :c, :m)
        """),
        {"o": org_id, "s": status_, "c": payload["count"], "m": message},
    )
    await db.commit()
    return {"status": status_, "message": message, "item_count": payload["count"]}


@router.get("/marketplace/sync-log")
async def marketplace_sync_log(
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("""
            SELECT id, direction, status, item_count, message, created_at
            FROM marketplace_sync_log WHERE organization_id = :o
            ORDER BY created_at DESC LIMIT 50
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/marketplace/orders")
async def marketplace_orders_list(
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("""
            SELECT id, external_order_id, customer_name, customer_phone, total_amount, status, received_at
            FROM marketplace_orders WHERE organization_id = :o
            ORDER BY received_at DESC LIMIT 100
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.put("/marketplace/orders/{order_id}/status")
async def marketplace_order_set_status(
    order_id: str,
    body: dict = Body(...),
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    new_status = body.get("status")
    if new_status not in ("new", "reviewed", "dismissed"):
        raise HTTPException(422, "Noto'g'ri status")
    res = await db.execute(
        text("UPDATE marketplace_orders SET status = :s WHERE id = :id AND organization_id = :o RETURNING id"),
        {"s": new_status, "id": order_id, "o": org_id},
    )
    if not res.first():
        raise HTTPException(404, "Buyurtma topilmadi")
    await db.commit()
    return {"ok": True}


@router.post("/marketplace/webhook/{org_code}")
@limiter.limit("60/minute")
async def marketplace_webhook(
    request: Request,
    org_code: str,
    db: AsyncSession = Depends(get_db),
):
    """Public webhook — receives an incoming order from the marketplace.
    No fixed payload contract is assumed (no real marketplace API confirmed
    yet); we store the raw body plus a best-effort parse of common field
    names so staff can review it manually (see /integrations/marketplace/orders)."""
    # Org codes aren't consistently-cased across the app (auto-generated ones are
    # lowercase, e.g. "org-8c68f7cd"; customer-portal-style ones are uppercase) —
    # match case-insensitively rather than assuming one convention.
    org_res = await db.execute(text("SELECT id FROM organizations WHERE UPPER(code) = UPPER(:c)"), {"c": org_code})
    org = org_res.first()
    if not org:
        raise HTTPException(404, "Tashkilot topilmadi")

    try:
        body = await request.json()
    except Exception:
        body = {}

    customer = body.get("customer") if isinstance(body.get("customer"), dict) else {}
    customer_name = body.get("customer_name") or customer.get("name")
    customer_phone = body.get("customer_phone") or body.get("phone") or customer.get("phone")

    await db.execute(
        text("""
            INSERT INTO marketplace_orders
                (organization_id, external_order_id, customer_name, customer_phone, total_amount, raw_payload)
            VALUES (:o, :ext, :cn, :cp, :amt, CAST(:raw AS JSONB))
        """),
        {
            "o": str(org.id),
            "ext": str(body.get("order_id") or body.get("id") or ""),
            "cn": customer_name,
            "cp": customer_phone,
            "amt": body.get("total_amount") or body.get("total") or 0,
            "raw": json.dumps(body),
        },
    )
    await db.commit()
    log.info("marketplace_webhook org=%s keys=%s", org_code, list(body.keys()))
    return {"ok": True}


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
