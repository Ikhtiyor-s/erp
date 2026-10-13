"""Public B2C storefront — anonymous, no auth dependency. Prefix: /shop.

See tickets/DESIGN-ecommerce-b2c.md ("API kontrakti", FREEZE) for the exact
response shapes. GET /shop/categories and GET /shop/products are EC-5 scope;
POST /shop/checkout (EC-6) hands off to sale/service.py::create_sale_core()
for the real sale+stock+accounting write.
"""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.phone import normalize_phone
from app.core.rate_limit import limiter
from app.modules.audit.logger import log_action
from app.modules.integration.payments.base import (
    find_or_create_transaction,
    get_payment_settings,
)
from app.modules.sale import service as sale_service
from app.modules.sale.service import SaleLineInput
from app.modules.storefront.service import (
    find_or_create_guest_customer,
    get_catalog,
    get_categories,
    get_order,
    get_product,
    get_published_prices,
    resolve_org_by_code,
)

router = APIRouter(prefix="/shop", tags=["storefront"])

# Provider codes that store their settings under app_settings['online_payments']
# and are readable via integration/payments/base.py::get_payment_settings(). Same
# set click.py/payme.py already implement webhooks for — no new protocol here.
_GATEWAY_PROVIDERS = ("click", "payme")


async def _resolve_checkout_payment(
    db: AsyncSession, org_id: str, sale_id: str, total_amount: Decimal,
) -> tuple[str, str | None]:
    """Return (mode, provider) for the checkout response — "manual"/None when
    no provider is enabled (today's real state), or "gateway"/<code> once one
    is. When a provider is enabled, pre-create the pending payment_transactions
    row so it already exists for click.py's/payme.py's own webhook flow to
    find/update via apply_payment_to_sale — no provider protocol is written here.
    """
    for provider in _GATEWAY_PROVIDERS:
        cfg = await get_payment_settings(db, org_id, provider)
        if cfg.get("enabled"):
            await find_or_create_transaction(
                db, org_id, provider, None, sale_id, total_amount,
            )
            return "gateway", provider
    return "manual", None


@router.get("/categories")
@limiter.limit("60/minute")
async def list_categories(
    request: Request,
    org_code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    org_id = await resolve_org_by_code(db, org_code)
    return await get_categories(db, org_id)


@router.get("/products")
@limiter.limit("60/minute")
async def list_products(
    request: Request,
    org_code: str = Query(...),
    category_id: int | None = Query(None),
    q: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    org_id = await resolve_org_by_code(db, org_code)
    return await get_catalog(
        db, org_id, category_id=category_id, q=q, limit=limit, offset=offset,
    )


@router.get("/products/{product_id}")
@limiter.limit("60/minute")
async def get_product_detail(
    request: Request,
    product_id: UUID,
    org_code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    org_id = await resolve_org_by_code(db, org_code)
    product = await get_product(db, org_id, str(product_id))
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")
    return product


@router.get("/order/{sale_id}")
@limiter.limit("60/minute")
async def get_order_detail(
    request: Request,
    sale_id: UUID,
    org_code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    org_id = await resolve_org_by_code(db, org_code)
    order = await get_order(db, org_id, str(sale_id))
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Buyurtma topilmadi")
    return order


# ---------------------------------------------------------------------------
# POST /shop/checkout (EC-6)
# ---------------------------------------------------------------------------

class CheckoutCustomerIn(BaseModel):
    name: str
    phone: str


class CheckoutItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str
    quantity: float = Field(gt=0)


class CheckoutIn(BaseModel):
    org_code: str
    customer: CheckoutCustomerIn
    items: list[CheckoutItemIn]
    notes: str | None = None


async def _next_order_number(db: AsyncSession, org_id: str) -> str:
    year = datetime.now(timezone.utc).year
    res = await db.execute(
        text("SELECT COUNT(*) + 1 AS n FROM storefront_orders WHERE organization_id = :o"),
        {"o": org_id},
    )
    seq = res.scalar() or 1
    return f"SF-{year}-{seq:05d}"


@router.post("/checkout", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def checkout(
    body: CheckoutIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    org_id = await resolve_org_by_code(db, body.org_code)

    try:
        phone = normalize_phone(body.customer.phone)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e

    product_ids = [it.product_id for it in body.items]
    prices = await get_published_prices(db, org_id, product_ids)

    warehouse_id = await sale_service.get_online_warehouse_id(db, org_id)
    if warehouse_id is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "online_warehouse_id sozlanmagan — do'kon vaqtincha yopiq",
        )

    customer = await find_or_create_guest_customer(db, org_id, phone, body.customer.name)

    currency_res = await db.execute(text("SELECT id FROM currencies WHERE is_base = TRUE LIMIT 1"))
    currency_id = currency_res.scalar()

    sale_items = [
        SaleLineInput(
            product_id=it.product_id,
            quantity=Decimal(str(it.quantity)),
            price=prices[it.product_id],
        )
        for it in body.items
    ]

    result = await sale_service.create_sale_core(
        db,
        org_id=org_id,
        customer_id=customer["id"],
        warehouse_id=warehouse_id,
        currency_id=currency_id,
        rate=Decimal("1"),
        items=sale_items,
        notes=body.notes,
        user_id=None,
        source_type="sale_storefront",
    )

    payment_mode, payment_provider = await _resolve_checkout_payment(
        db, org_id, result.sale_id, result.total_amount,
    )

    order_number = await _next_order_number(db, org_id)
    await db.execute(
        text(
            "INSERT INTO storefront_orders "
            "  (organization_id, sale_id, customer_id, order_number, status, payment_mode, notes) "
            "VALUES (:o, :s, :c, :n, 'new', :pm, :nt)"
        ),
        {
            "o": org_id, "s": result.sale_id, "c": customer["id"], "n": order_number,
            "pm": payment_mode, "nt": body.notes,
        },
    )

    await log_action(
        db, org_id, user_id=None, action="create", entity="storefront_orders",
        entity_id=result.sale_id, diff={"order_number": order_number, "total_amount": str(result.total_amount)},
        request=request,
    )
    await db.commit()

    return {
        "sale_id": result.sale_id,
        "order_number": order_number,
        "status": "payment_pending",
        "total_amount": float(result.total_amount),
        "payment": {"mode": payment_mode, "provider": payment_provider, "payment_url": None},
    }
