"""Kiosk device-facing endpoints — device-token auth, no staff JWT.

`GET /session` is SC-2's. SC-3 (tickets/SC-3-kiosk-checkout-flow.md) adds the
catalog, checkout, and order-polling endpoints below.
"""
from __future__ import annotations
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.modules.kiosk import service as kiosk_service
from app.modules.kiosk.auth import get_current_kiosk_device


router = APIRouter(prefix="/kiosk", tags=["kiosk"])


@router.get("/session")
async def get_kiosk_session(
    device: dict = Depends(get_current_kiosk_device),
    db: AsyncSession = Depends(get_db),
):
    org_id = device["organization_id"]

    org_res = await db.execute(
        text("SELECT name FROM organizations WHERE id = :o"),
        {"o": org_id},
    )
    org_row = org_res.first()

    cb_res = await db.execute(
        text(
            "SELECT cb.name AS cashbox_name, cb.warehouse_id, w.name AS warehouse_name "
            "FROM cashboxes cb LEFT JOIN warehouses w ON w.id = cb.warehouse_id "
            "WHERE cb.id = :c AND cb.organization_id = :o"
        ),
        {"c": device["cashbox_id"], "o": org_id},
    )
    cb_row = cb_res.first()
    if not cb_row or cb_row.warehouse_id is None:
        # Same case/message as sale/router.py T-206 Case 3 — a cashbox not
        # bound to a warehouse cannot resolve stock for this kiosk.
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Kassa omborga bog'lanmagan")

    settings_res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'kiosk'"),
        {"o": org_id},
    )
    settings_row = settings_res.first()
    max_cart_amount = None
    if settings_row and settings_row.value:
        max_cart_amount = settings_row.value.get("max_cart_amount")

    return {
        "device_id": str(device["id"]),
        "device_name": device["name"],
        "organization_name": org_row.name if org_row else None,
        "cashbox_id": device["cashbox_id"],
        "cashbox_name": cb_row.cashbox_name,
        "warehouse_id": cb_row.warehouse_id,
        "warehouse_name": cb_row.warehouse_name,
        "max_cart_amount": max_cart_amount,
    }


# ---------------------------------------------------------------------------
# Catalog (SPEC Scenario 4, Talablar -> Katalog)
# ---------------------------------------------------------------------------
# Both routing shapes from the ticket are provided: a barcode-first lookup
# (the kiosk's primary, scan-driven interaction, SPEC SHOULD) and a plain
# list (useful for an initial browse/cache, SPEC MAY). Both share the exact
# same eligibility filter in kiosk/service.py, so neither can ever expose a
# product the other hides.

@router.get("/catalog")
async def kiosk_catalog(
    q: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    device: dict = Depends(get_current_kiosk_device),
    db: AsyncSession = Depends(get_db),
):
    org_id = str(device["organization_id"])
    warehouse_id = await kiosk_service.resolve_device_warehouse(db, org_id, device["cashbox_id"])
    return await kiosk_service.get_catalog(db, org_id, warehouse_id, q=q, limit=limit, offset=offset)


@router.get("/catalog/{barcode}")
async def kiosk_catalog_by_barcode(
    barcode: str,
    device: dict = Depends(get_current_kiosk_device),
    db: AsyncSession = Depends(get_db),
):
    org_id = str(device["organization_id"])
    warehouse_id = await kiosk_service.resolve_device_warehouse(db, org_id, device["cashbox_id"])
    product = await kiosk_service.get_product_by_barcode(db, org_id, warehouse_id, barcode)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mahsulot topilmadi")
    return product


# ---------------------------------------------------------------------------
# POST /kiosk/checkout (SPEC Scenario 1, 2, 5, 6, 7)
# ---------------------------------------------------------------------------
# No `price` field on the item schema below, deliberately: Pydantic's
# default "extra fields ignored" behavior means a client that adds `price`
# via devtools (Scenario 6) gets it silently dropped, not a 422 — checkout
# still succeeds, the server-computed price from kiosk_service.py is always
# what's used. No `customer`/phone field either: unlike the B2C storefront,
# a kiosk sale has no guest-identity concept in this SPEC.

class KioskCheckoutItemIn(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)


class KioskCheckoutIn(BaseModel):
    items: list[KioskCheckoutItemIn]


@router.post("/checkout", status_code=status.HTTP_201_CREATED)
async def kiosk_checkout(
    body: KioskCheckoutIn,
    request: Request,
    device: dict = Depends(get_current_kiosk_device),
    db: AsyncSession = Depends(get_db),
):
    lines = [
        kiosk_service.KioskCartLine(product_id=it.product_id, quantity=Decimal(str(it.quantity)))
        for it in body.items
    ]
    return await kiosk_service.checkout(db, request, device, lines)


# ---------------------------------------------------------------------------
# GET /kiosk/order/{sale_id} — blocking wait screen support
# ---------------------------------------------------------------------------
# SC-5 polling contract (frozen by this ticket — no other doc owns this, so
# it is spelled out here rather than left for SC-5 to guess, per the
# ticket's own instruction):
#
#   - Start polling this endpoint right after POST /kiosk/checkout's 201.
#   - Poll on a short interval (e.g. every 2-3s) for up to ~90 seconds total.
#   - `status` is the only field the polling loop needs to branch on:
#       "awaiting_payment" -> keep polling, payment not confirmed yet.
#       "paid"             -> STOP. Show "Tasdiqlandi, xayr" and release
#                             the kiosk for the next customer.
#       "cancelled"        -> STOP. Show a staff-cancelled message.
#       "payment_failed"   -> STOP. Show a retry/staff-escalation message.
#     "paid" / "cancelled" / "payment_failed" are all terminal for this
#     endpoint: once returned, a later poll of the same sale_id will never
#     return a different value.
#   - If still "awaiting_payment" after ~90s: STOP polling anyway and show
#     the same staff-escalation message "payment_failed" uses. This 90s
#     budget is a FRONTEND decision only — the backend sale stays in
#     "awaiting_payment" indefinitely; nothing on this side ever
#     auto-confirms it (test_kiosk_checkout.py::
#     test_unpaid_order_never_auto_confirms_after_timeout asserts exactly
#     this). A human must resolve it via the existing
#     POST /sale/sales/{id}/pay or POST /sale/sales/{id}/cancel.
#
# Cross-tenant: another org's sale_id -> 404, no existence/reason disclosed
# (Scenario 7, same convention every other kiosk/storefront endpoint uses).

@router.get("/order/{sale_id}")
async def kiosk_order_status(
    sale_id: UUID,
    device: dict = Depends(get_current_kiosk_device),
    db: AsyncSession = Depends(get_db),
):
    org_id = str(device["organization_id"])
    order = await kiosk_service.get_order_status(db, org_id, str(sale_id))
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Buyurtma topilmadi")
    return order
