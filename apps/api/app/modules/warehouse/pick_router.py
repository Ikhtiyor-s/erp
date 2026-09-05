"""
Pick workflow endpoints — T-025.

Routes (prefix /orders, registered at /api/v1):
  GET  /orders/{oid}/pick
  GET  /orders/pick-summary?ids=uuid1,uuid2,...
  PATCH /orders/{oid}/items/{iid}/pick
  GET  /orders/{oid}/pick/messages
  POST /orders/{oid}/pick/messages

sale_items.id is BIGSERIAL (integer); item_id throughout uses int.
order_pick_items.item_id is BIGINT.
"""
import time
from datetime import datetime, UTC
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user_id, get_current_org_id
from app.modules.rbac.deps import require_permission
from app.modules.warehouse.service import get_on_hand_batch

router = APIRouter(prefix="/orders", tags=["pick"])

# ---------------------------------------------------------------------------
# Idempotency cache (in-memory; 24h TTL per DESIGN requirement for writes)
# NOTE: process-local dict; not shared across gunicorn/uvicorn workers.
# For production multi-worker deploys, switch to Redis-backed idempotency store.
# ---------------------------------------------------------------------------
_idempotency_cache: dict[str, tuple[dict, float]] = {}
_IDEMPOTENCY_TTL_SECONDS = 86400
_CLEANUP_TTL_SECONDS = 300


def _cleanup_idem_cache() -> None:
    now = time.time()
    stale = [k for k, (_, ts) in _idempotency_cache.items() if now - ts > _IDEMPOTENCY_TTL_SECONDS]
    for k in stale:
        _idempotency_cache.pop(k, None)


def _cache_get(key: str) -> dict | None:
    _cleanup_idem_cache()
    entry = _idempotency_cache.get(key)
    if entry is None:
        return None
    payload, ts = entry
    if time.time() - ts > _IDEMPOTENCY_TTL_SECONDS:
        del _idempotency_cache[key]
        return None
    return payload


def _cache_set(key: str, payload: dict) -> None:
    _cleanup_idem_cache()
    _idempotency_cache[key] = (payload, time.time())


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PickItemOut(BaseModel):
    item_id: int
    product_id: str
    product_name: str | None
    quantity: str
    unit_name: str | None
    cell_code: str | None
    rack_name: str | None
    row_name: str | None
    warehouse_name: str | None
    pick_status: str
    on_hand: float | None = None
    parent_product_id: str | None = None
    parent_product_name: str | None = None
    is_bundle_component: bool = False


class PickListOut(BaseModel):
    order_id: str
    doc_number: str | None
    customer_name: str | None
    total_items: int
    picked_count: int
    not_found_count: int
    items: list[PickItemOut]


class PickSummaryItem(BaseModel):
    order_id: str
    picked_count: int
    total_items: int


class PickStatusIn(BaseModel):
    status: Literal["picked", "not_found"]
    notes: str | None = None
    product_id: UUID | None = None  # Per-leaf granularity for BOM components; None = all rows for item_id


class PickStatusOut(BaseModel):
    item_id: int
    pick_status: str
    picked_by: str | None
    picked_at: str | None
    order_totals: dict


class MessageIn(BaseModel):
    kind: Literal["message", "call"]
    body: str | None = None

    @field_validator("body")
    @classmethod
    def body_required_for_message(cls, v, info):
        if info.data.get("kind") == "message" and not v:
            raise ValueError("body required when kind is 'message'")
        return v


class MessageOut(BaseModel):
    id: str
    from_user_name: str | None
    kind: str
    body: str | None
    created_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_order(db: AsyncSession, order_id: str, org_id: str) -> dict:
    """Fetch sale header; raises 404 if not found in org."""
    res = await db.execute(
        text(
            "SELECT s.id, s.doc_number, s.warehouse_id, "
            "c.name AS customer_name "
            "FROM sales s "
            "LEFT JOIN customers c ON c.id = s.customer_id "
            "WHERE s.id = :id AND s.organization_id = :o"
        ),
        {"id": order_id, "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Buyurtma topilmadi")
    return dict(row._mapping)


async def _get_pick_totals(db: AsyncSession, order_id: str, org_id: str) -> dict:
    # When pick_items rows exist (bootstrapped orders), count directly from them.
    # This avoids the N-fold multiplication caused by BOM leaf components in the
    # legacy LEFT JOIN pattern (one sale_item → N pick_items for BOM products).
    res = await db.execute(
        text(
            "SELECT "
            "  COUNT(*) AS total_items, "
            "  COUNT(*) FILTER (WHERE status = 'picked') AS picked_count, "
            "  COUNT(*) FILTER (WHERE status = 'not_found') AS not_found_count "
            "FROM order_pick_items "
            "WHERE order_id = :oid AND organization_id = :o"
        ),
        {"oid": order_id, "o": org_id},
    )
    row = res.first()
    if row and (row.total_items or 0) > 0:
        return {
            "total_items": row.total_items,
            "picked_count": row.picked_count or 0,
            "not_found_count": row.not_found_count or 0,
        }

    # Legacy fallback: orders created before bootstrap deployment have no pick_items rows.
    # COUNT sale_items (not the pick rows) to get total; filter with JOIN for statuses.
    # JOIN sales ensures org isolation on the sale_items side.
    res = await db.execute(
        text(
            "SELECT COUNT(si.id) AS total_items, "
            "       COUNT(opi.id) FILTER (WHERE opi.status = 'picked') AS picked_count, "
            "       COUNT(opi.id) FILTER (WHERE opi.status = 'not_found') AS not_found_count "
            "FROM sale_items si "
            "JOIN sales s ON s.id = si.sale_id AND s.organization_id = :o "
            "LEFT JOIN order_pick_items opi ON opi.item_id = si.id "
            "  AND opi.order_id = :oid AND opi.organization_id = :o "
            "WHERE si.sale_id = :oid"
        ),
        {"oid": order_id, "o": org_id},
    )
    row = res.first()
    return {
        "total_items": row.total_items or 0,
        "picked_count": row.picked_count or 0,
        "not_found_count": row.not_found_count or 0,
    }


# ---------------------------------------------------------------------------
# GET /orders/pick-summary?ids=uuid1,uuid2,...
# Returns header-level aggregates only; no per-item detail (avoids N+1).
# ---------------------------------------------------------------------------

@router.get(
    "/pick-summary",
    response_model=list[PickSummaryItem],
    dependencies=[Depends(require_permission("order.pick.view"))],
)
async def get_pick_summary(
    ids: str = Query(..., description="Comma-separated order UUIDs, max 100"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    raw_ids = [s.strip() for s in ids.split(",") if s.strip()]
    if not raw_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ids parametri bo'sh")
    if len(raw_ids) > 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ids uchun maksimal 100 ta buyurtma")

    try:
        parsed_ids = [str(UUID(oid)) for oid in raw_ids]
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Noto'g'ri UUID format")

    res = await db.execute(
        text(
            "SELECT si.sale_id AS order_id, "
            "  COUNT(*) AS total_items, "
            "  COUNT(opi.id) FILTER (WHERE opi.status = 'picked') AS picked_count "
            "FROM sale_items si "
            "JOIN sales s ON s.id = si.sale_id AND s.organization_id = :o "
            "LEFT JOIN order_pick_items opi "
            "  ON opi.item_id = si.id "
            "  AND opi.order_id = si.sale_id "
            "  AND opi.organization_id = :o "
            "WHERE si.sale_id = ANY(CAST(:ids AS uuid[])) "
            "GROUP BY si.sale_id"
        ),
        {"o": org_id, "ids": parsed_ids},
    )
    rows = res.all()
    found_map = {str(r.order_id): r for r in rows}

    return [
        PickSummaryItem(
            order_id=oid,
            picked_count=int(found_map[oid].picked_count) if oid in found_map else 0,
            total_items=int(found_map[oid].total_items) if oid in found_map else 0,
        )
        for oid in parsed_ids
    ]


# ---------------------------------------------------------------------------
# GET /orders/{oid}/pick
# ---------------------------------------------------------------------------

@router.get(
    "/{oid}/pick",
    response_model=PickListOut,
    dependencies=[Depends(require_permission("order.pick.view"))],
)
async def get_pick_list(
    oid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    # TODO: upgrade to WebSocket push when admin progress dashboard moves to real-time
    order = await _get_order(db, str(oid), org_id)

    # When pick_items rows exist (post-bootstrap), read them directly — they carry
    # product_id/quantity/unit_id for BOM leaf components.  Fall back to sale_items
    # JOIN for orders created before the bootstrap was deployed.
    pick_rows_res = await db.execute(
        text(
            "SELECT opi.id AS pick_id, opi.item_id, opi.status AS pick_status, "
            "  opi.product_id AS pick_product_id, "
            "  opi.quantity AS pick_quantity, "
            "  opi.unit_id AS pick_unit_id, "
            "  opi.parent_product_id "
            "FROM order_pick_items opi "
            "WHERE opi.order_id = :oid AND opi.organization_id = :o "
            "ORDER BY opi.item_id, opi.id"
        ),
        {"oid": str(oid), "o": org_id},
    )
    pick_rows = [dict(r._mapping) for r in pick_rows_res]
    has_pick_rows = len(pick_rows) > 0

    if has_pick_rows:
        # Collect all product IDs needed (pick-level products + parent products)
        all_product_ids = list({
            str(r["pick_product_id"]) for r in pick_rows if r["pick_product_id"]
        } | {
            str(r["parent_product_id"]) for r in pick_rows if r["parent_product_id"]
        })
        prod_res = await db.execute(
            text(
                "SELECT p.id, p.name, u.name AS unit_name, "
                "  wc.code AS cell_code, wr.name AS rack_name, wrow.name AS row_name "
                "FROM products p "
                "LEFT JOIN units u ON u.id = p.unit_id "
                "LEFT JOIN warehouse_cells wc ON wc.id = p.default_cell_id "
                "LEFT JOIN warehouse_racks wr ON wr.id = wc.rack_id "
                "LEFT JOIN warehouse_rows wrow ON wrow.id = wr.row_id "
                "WHERE p.id = ANY(CAST(:ids AS uuid[]))"
            ),
            {"ids": all_product_ids},
        )
        prod_map = {str(r.id): dict(r._mapping) for r in prod_res}

        wh_res = await db.execute(
            text("SELECT name FROM warehouses WHERE id = :wid"),
            {"wid": order["warehouse_id"]},
        )
        wh_row = wh_res.first()
        warehouse_name = wh_row.name if wh_row else None

        raw_items = []
        for pr in pick_rows:
            pick_product_id = str(pr["pick_product_id"]) if pr["pick_product_id"] else None
            parent_product_id = str(pr["parent_product_id"]) if pr["parent_product_id"] else None
            prod_info = prod_map.get(pick_product_id, {}) if pick_product_id else {}
            parent_info = prod_map.get(parent_product_id, {}) if parent_product_id else {}
            raw_items.append({
                "item_id": pr["item_id"],
                "product_id": pick_product_id,
                "product_name": prod_info.get("name"),
                "quantity": pr["pick_quantity"],
                "unit_name": prod_info.get("unit_name"),
                "cell_code": prod_info.get("cell_code"),
                "rack_name": prod_info.get("rack_name"),
                "row_name": prod_info.get("row_name"),
                "warehouse_name": warehouse_name,
                "pick_status": pr["pick_status"] or "pending",
                "parent_product_id": parent_product_id,
                "parent_product_name": parent_info.get("name"),
            })
    else:
        # Legacy path: no pick rows yet, read from sale_items
        items_res = await db.execute(
            text(
                "SELECT "
                "  si.id AS item_id, "
                "  si.product_id, "
                "  p.name AS product_name, "
                "  si.quantity, "
                "  u.name AS unit_name, "
                "  wc.code AS cell_code, "
                "  wr.name AS rack_name, "
                "  wrow.name AS row_name, "
                "  w.name AS warehouse_name, "
                "  COALESCE(opi.status, 'pending') AS pick_status "
                "FROM sale_items si "
                "LEFT JOIN products p ON p.id = si.product_id "
                "LEFT JOIN units u ON u.id = p.unit_id "
                "LEFT JOIN warehouse_cells wc ON wc.id = p.default_cell_id "
                "LEFT JOIN warehouse_racks wr ON wr.id = wc.rack_id "
                "LEFT JOIN warehouse_rows wrow ON wrow.id = wr.row_id "
                "LEFT JOIN warehouses w ON w.id = :wid "
                "LEFT JOIN order_pick_items opi "
                "  ON opi.item_id = si.id "
                "  AND opi.order_id = :oid "
                "  AND opi.organization_id = :o "
                "WHERE si.sale_id = :oid "
                "ORDER BY si.id"
            ),
            {"oid": str(oid), "o": org_id, "wid": order["warehouse_id"]},
        )
        raw_items = []
        for r in items_res:
            m = dict(r._mapping)
            m["parent_product_id"] = None
            m["parent_product_name"] = None
            raw_items.append(m)

    product_ids = [str(r["product_id"]) for r in raw_items if r["product_id"]]
    on_hand_map = await get_on_hand_batch(db, order["warehouse_id"], product_ids)

    total_items = len(raw_items)
    picked_count = sum(1 for r in raw_items if r["pick_status"] == "picked")
    not_found_count = sum(1 for r in raw_items if r["pick_status"] == "not_found")

    items_out = [
        PickItemOut(
            item_id=r["item_id"],
            product_id=str(r["product_id"]) if r["product_id"] else "",
            product_name=r["product_name"],
            quantity=str(r["quantity"]),
            unit_name=r["unit_name"],
            cell_code=r["cell_code"],
            rack_name=r["rack_name"],
            row_name=r["row_name"],
            warehouse_name=r["warehouse_name"],
            pick_status=r["pick_status"],
            on_hand=float(on_hand_map.get(str(r["product_id"]), 0)) if r["product_id"] else None,
            parent_product_id=r.get("parent_product_id"),
            parent_product_name=r.get("parent_product_name"),
            is_bundle_component=r.get("parent_product_id") is not None,
        )
        for r in raw_items
    ]

    return PickListOut(
        order_id=str(oid),
        doc_number=order["doc_number"],
        customer_name=order["customer_name"],
        total_items=total_items,
        picked_count=picked_count,
        not_found_count=not_found_count,
        items=items_out,
    )


# ---------------------------------------------------------------------------
# PATCH /orders/{oid}/items/{iid}/pick
# ---------------------------------------------------------------------------

@router.patch(
    "/{oid}/items/{iid}/pick",
    response_model=PickStatusOut,
    dependencies=[Depends(require_permission("order.pick.execute"))],
)
async def update_pick_status(
    oid: UUID,
    iid: int,
    body: PickStatusIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    cache_key: str | None = None
    if idempotency_key:
        pid_part = str(body.product_id) if body.product_id else "all"
        cache_key = f"{oid}:{iid}:{pid_part}:{idempotency_key}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

    await _get_order(db, str(oid), org_id)

    item_check = await db.execute(
        text(
            "SELECT si.id FROM sale_items si "
            "JOIN sales s ON s.id = si.sale_id "
            "WHERE si.id = :iid AND si.sale_id = :oid AND s.organization_id = :o"
        ),
        {"iid": iid, "oid": str(oid), "o": org_id},
    )
    if not item_check.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Buyurtma topilmadi")

    now = datetime.now(UTC)
    # For bootstrapped orders (Sprint 3+), pick rows already exist — UPDATE them.
    # For legacy orders (no pick rows yet), INSERT one row per the old behavior.
    # Both paths are covered: UPDATE returns rowcount; if 0 rows updated, fall back to INSERT.
    if body.product_id:
        # Per-leaf update: only the single BOM component row matching product_id
        updated = await db.execute(
            text(
                "UPDATE order_pick_items "
                "  SET status = :st, picked_by = :by, picked_at = :at, notes = :notes "
                "WHERE organization_id = :o AND order_id = :oid "
                "  AND item_id = :iid AND product_id = :pid"
            ),
            {
                "o": org_id,
                "oid": str(oid),
                "iid": iid,
                "pid": str(body.product_id),
                "st": body.status,
                "by": user_id,
                "at": now,
                "notes": body.notes,
            },
        )
        if updated.rowcount == 0:
            # No pre-bootstrapped row found; upsert for this specific leaf
            await db.execute(
                text(
                    "INSERT INTO order_pick_items "
                    "  (organization_id, order_id, item_id, product_id, status, picked_by, picked_at, notes) "
                    "VALUES (:o, :oid, :iid, :pid, :st, :by, :at, :notes) "
                    "ON CONFLICT (organization_id, order_id, item_id, product_id) DO UPDATE "
                    "  SET status = :st, picked_by = :by, picked_at = :at, notes = :notes"
                ),
                {
                    "o": org_id,
                    "oid": str(oid),
                    "iid": iid,
                    "pid": str(body.product_id),
                    "st": body.status,
                    "by": user_id,
                    "at": now,
                    "notes": body.notes,
                },
            )
    else:
        # Legacy / individual item: mark all pick rows for this item_id (backward compat)
        updated = await db.execute(
            text(
                "UPDATE order_pick_items "
                "  SET status = :st, picked_by = :by, picked_at = :at, notes = :notes "
                "WHERE organization_id = :o AND order_id = :oid AND item_id = :iid"
            ),
            {
                "o": org_id,
                "oid": str(oid),
                "iid": iid,
                "st": body.status,
                "by": user_id,
                "at": now,
                "notes": body.notes,
            },
        )
        if updated.rowcount == 0:
            # Legacy path: no pick row exists yet; fetch product_id from sale_items for the INSERT
            prod_res = await db.execute(
                text("SELECT product_id FROM sale_items WHERE id = :iid"),
                {"iid": iid},
            )
            prod_row = prod_res.first()
            prod_id = str(prod_row.product_id) if prod_row and prod_row.product_id else None
            await db.execute(
                text(
                    "INSERT INTO order_pick_items "
                    "  (organization_id, order_id, item_id, product_id, status, picked_by, picked_at, notes) "
                    "VALUES (:o, :oid, :iid, :pid, :st, :by, :at, :notes) "
                    "ON CONFLICT (organization_id, order_id, item_id, product_id) DO UPDATE "
                    "  SET status = :st, picked_by = :by, picked_at = :at, notes = :notes"
                ),
                {
                    "o": org_id,
                    "oid": str(oid),
                    "iid": iid,
                    "pid": prod_id,
                    "st": body.status,
                    "by": user_id,
                    "at": now,
                    "notes": body.notes,
                },
            )
    await db.commit()

    totals = await _get_pick_totals(db, str(oid), org_id)

    result = PickStatusOut(
        item_id=iid,
        pick_status=body.status,
        picked_by=user_id,
        picked_at=now.isoformat(),
        order_totals=totals,
    )
    payload = result.model_dump()

    if cache_key:
        _cache_set(cache_key, payload)

    return payload


# ---------------------------------------------------------------------------
# GET /orders/{oid}/pick/messages
# ---------------------------------------------------------------------------

@router.get(
    "/{oid}/pick/messages",
    response_model=list[MessageOut],
    dependencies=[Depends(require_permission("order.pick.view"))],
)
async def list_pick_messages(
    oid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await _get_order(db, str(oid), org_id)

    res = await db.execute(
        text(
            "SELECT m.id, u.full_name AS from_user_name, m.kind, m.body, m.created_at "
            "FROM order_pick_messages m "
            "LEFT JOIN users u ON u.id = m.from_user_id "
            "WHERE m.order_id = :oid AND m.organization_id = :o "
            "ORDER BY m.created_at ASC"
        ),
        {"oid": str(oid), "o": org_id},
    )
    rows = res.all()
    return [
        MessageOut(
            id=str(r.id),
            from_user_name=r.from_user_name,
            kind=r.kind,
            body=r.body,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# POST /orders/{oid}/pick/messages
# ---------------------------------------------------------------------------

@router.post(
    "/{oid}/pick/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("order.pick.contact"))],
)
async def create_pick_message(
    oid: UUID,
    body: MessageIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    if idempotency_key:
        cached = _cache_get(idempotency_key)
        if cached is not None:
            return cached

    await _get_order(db, str(oid), org_id)

    msg_id = str(uuid4())
    now = datetime.now(UTC)

    await db.execute(
        text(
            "INSERT INTO order_pick_messages "
            "  (id, organization_id, order_id, from_user_id, kind, body, created_at) "
            "VALUES (:id, :o, :oid, :uid, :kind, :body, :now)"
        ),
        {
            "id": msg_id,
            "o": org_id,
            "oid": str(oid),
            "uid": user_id,
            "kind": body.kind,
            "body": body.body,
            "now": now,
        },
    )

    user_res = await db.execute(
        text("SELECT full_name FROM users WHERE id = :uid"),
        {"uid": user_id},
    )
    user_row = user_res.first()
    from_user_name = user_row.full_name if user_row else None

    await db.commit()

    result = MessageOut(
        id=msg_id,
        from_user_name=from_user_name,
        kind=body.kind,
        body=body.body,
        created_at=now.isoformat(),
    )
    payload = result.model_dump()

    if idempotency_key:
        _cache_set(idempotency_key, payload)

    return payload
