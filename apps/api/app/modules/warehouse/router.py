from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user_id, get_current_org_id


async def _stock_qty(db: AsyncSession, warehouse_id: int, product_id: str) -> Decimal:
    res = await db.execute(
        text("SELECT COALESCE(quantity, 0) FROM stock_balances "
             "WHERE warehouse_id = :w AND product_id = :p"),
        {"w": warehouse_id, "p": product_id},
    )
    val = res.scalar()
    return Decimal(str(val)) if val is not None else Decimal("0")


async def _stock_apply(db: AsyncSession, warehouse_id: int, product_id: str,
                       delta_qty: Decimal, cost: Decimal | None = None) -> None:
    """Apply +/- to stock_balances. If cost provided and delta>0, weighted avg recalculated."""
    if delta_qty == 0:
        return
    if delta_qty > 0 and cost is not None:
        await db.execute(
            text("INSERT INTO stock_balances (warehouse_id, product_id, quantity, avg_cost) "
                 "VALUES (:w, :p, :q, :c) "
                 "ON CONFLICT (warehouse_id, product_id) DO UPDATE "
                 "SET quantity = stock_balances.quantity + :q, "
                 "    avg_cost = ((stock_balances.quantity * stock_balances.avg_cost) + (:q * :c)) "
                 "             / NULLIF(stock_balances.quantity + :q, 0), "
                 "    updated_at = NOW()"),
            {"w": warehouse_id, "p": product_id, "q": delta_qty, "c": cost},
        )
    else:
        await db.execute(
            text("INSERT INTO stock_balances (warehouse_id, product_id, quantity, avg_cost) "
                 "VALUES (:w, :p, :q, 0) "
                 "ON CONFLICT (warehouse_id, product_id) DO UPDATE "
                 "SET quantity = stock_balances.quantity + :q, updated_at = NOW()"),
            {"w": warehouse_id, "p": product_id, "q": delta_qty},
        )


router = APIRouter(prefix="/warehouse", tags=["warehouse"])


# =========================================================
# WAREHOUSES (sklady)
# =========================================================

class WarehouseIn(BaseModel):
    name: str
    address: str | None = None
    responsible_id: UUID | None = None


@router.get("/warehouses")
async def list_warehouses(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT w.id, w.name, w.address, w.responsible_id, "
             "e.full_name AS responsible_name, "
             "(SELECT COUNT(DISTINCT product_id) FROM stock_balances sb WHERE sb.warehouse_id = w.id AND sb.quantity > 0) AS product_count, "
             "(SELECT COALESCE(SUM(sb.quantity * sb.avg_cost), 0) FROM stock_balances sb WHERE sb.warehouse_id = w.id) AS stock_value "
             "FROM warehouses w "
             "LEFT JOIN employees e ON e.id = w.responsible_id "
             "WHERE w.organization_id = :o AND w.is_active = TRUE ORDER BY w.name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/warehouses", status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    p: WarehouseIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO warehouses (organization_id, name, address, responsible_id) "
             "VALUES (:o, :n, :a, :r) RETURNING id"),
        {"o": org_id, "n": p.name, "a": p.address,
         "r": str(p.responsible_id) if p.responsible_id else None},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/warehouses/{wid}")
async def update_warehouse(
    wid: int, p: WarehouseIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE warehouses SET name=:n, address=:a, responsible_id=:r "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": wid, "o": org_id, "n": p.name, "a": p.address,
         "r": str(p.responsible_id) if p.responsible_id else None},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/warehouses/{wid}")
async def delete_warehouse(
    wid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE warehouses SET is_active = FALSE WHERE id = :id AND organization_id = :o"),
        {"id": wid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# PRODUCT CATEGORIES (tree)
# =========================================================

class CategoryIn(BaseModel):
    name: str
    parent_id: int | None = None


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, parent_id, path FROM product_categories "
             "WHERE organization_id = :o ORDER BY parent_id NULLS FIRST, name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    p: CategoryIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO product_categories (organization_id, name, parent_id) "
             "VALUES (:o, :n, :p) RETURNING id"),
        {"o": org_id, "n": p.name, "p": p.parent_id},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/categories/{cid}")
async def update_category(
    cid: int, p: CategoryIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE product_categories SET name=:n, parent_id=:p "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": cid, "o": org_id, "n": p.name, "p": p.parent_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/categories/{cid}")
async def delete_category(
    cid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM product_categories WHERE id = :id AND organization_id = :o"),
        {"id": cid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# PRODUCTS
# =========================================================

class ProductIn(BaseModel):
    name: str = Field(min_length=1)
    sku: str | None = None
    barcode: str | None = None
    category_id: int | None = None
    unit_id: int | None = None
    purchase_price: Decimal = Decimal("0")
    sale_price: Decimal = Decimal("0")
    currency_id: int | None = None
    is_service: bool = False
    is_material: bool = False
    is_semi_product: bool = False
    is_marked: bool = False
    has_expiration: bool = False
    is_variant: bool = False
    parent_id: UUID | None = None
    image_url: str | None = None
    box_qty: Decimal | None = None
    box_barcode: str | None = None
    dim_length: Decimal | None = None
    dim_width: Decimal | None = None
    dim_height: Decimal | None = None
    dim_weight: Decimal | None = None
    description: str | None = None
    kind: str | None = None
    mxik: str | None = Field(
        default=None,
        pattern=r"^\d{10,17}$",
        description="MXIK (Mahsulot va Xizmatlar Identifikatsiya Kodi) — 10-17 raqam",
    )
    extra_barcodes: list[str] | None = None
    tag_ids: list[int] | None = None


@router.get("/products")
async def list_products(
    q: str | None = Query(None),
    category_id: int | None = Query(None),
    is_service: bool | None = Query(None),
    kind: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE p.organization_id = :o AND p.is_active = TRUE"
    params: dict = {"o": org_id, "lim": limit, "off": offset}
    if q:
        where += " AND (p.name ILIKE :q OR p.sku ILIKE :q OR p.barcode = :raw)"
        params["q"] = f"%{q}%"
        params["raw"] = q
    if category_id:
        where += " AND p.category_id = :cat"
        params["cat"] = category_id
    if is_service is not None:
        where += " AND p.is_service = :svc"
        params["svc"] = is_service
    if kind:
        where += " AND COALESCE(p.kind, 'good') = :k"
        params["k"] = kind
    res = await db.execute(
        text(f"SELECT p.id, p.sku, p.barcode, p.name, p.mxik, "
             f"p.sale_price, p.purchase_price, p.currency_id, "
             f"p.unit_id, p.category_id, p.is_service, p.is_produced, p.created_at, "
             f"cur.code AS currency_code, "
             f"un.short_name AS unit_name, "
             f"cat.name AS category_name, "
             f"COALESCE((SELECT SUM(quantity) FROM stock_balances WHERE product_id = p.id), 0) AS total_stock "
             f"FROM products p "
             f"LEFT JOIN currencies cur ON cur.id = p.currency_id "
             f"LEFT JOIN units un ON un.id = p.unit_id "
             f"LEFT JOIN product_categories cat ON cat.id = p.category_id "
             f"{where} ORDER BY p.name LIMIT :lim OFFSET :off"),
        params,
    )
    return [dict(r._mapping) for r in res]


_PRODUCT_FIELDS = """
    name=:n, sku=:sku, barcode=:bc, category_id=:cat, unit_id=:u,
    purchase_price=:pp, sale_price=:sp, currency_id=:cur,
    is_service=:svc, is_material=:mat, is_semi_product=:semi,
    is_marked=:mk, has_expiration=:exp, is_variant=:var, parent_id=:par,
    image_url=:img, box_qty=:bq, box_barcode=:bbc,
    dim_length=:dl, dim_width=:dw, dim_height=:dh, dim_weight=:dwg,
    description=:descr, kind=COALESCE(:knd, kind), mxik=:mxik
"""

def _product_params(p: ProductIn) -> dict:
    return {
        "n": p.name, "sku": p.sku, "bc": p.barcode, "cat": p.category_id,
        "u": p.unit_id, "pp": p.purchase_price, "sp": p.sale_price, "cur": p.currency_id,
        "svc": p.is_service, "mat": p.is_material, "semi": p.is_semi_product,
        "mk": p.is_marked, "exp": p.has_expiration, "var": p.is_variant,
        "par": str(p.parent_id) if p.parent_id else None,
        "img": p.image_url, "bq": p.box_qty, "bbc": p.box_barcode,
        "dl": p.dim_length, "dw": p.dim_width, "dh": p.dim_height, "dwg": p.dim_weight,
        "descr": p.description, "knd": p.kind, "mxik": p.mxik,
    }


async def _sync_product_extras(db: AsyncSession, org_id: str, pid: str, p: ProductIn) -> None:
    if p.extra_barcodes is not None:
        await db.execute(text("DELETE FROM product_barcodes WHERE product_id = :p"), {"p": pid})
        for bc in p.extra_barcodes:
            if bc:
                await db.execute(
                    text("INSERT INTO product_barcodes (product_id, barcode) VALUES (:p, :b) ON CONFLICT DO NOTHING"),
                    {"p": pid, "b": bc},
                )
    if p.tag_ids is not None:
        await db.execute(
            text("DELETE FROM entity_tags WHERE entity_type='product' AND entity_id=:e"),
            {"e": pid},
        )
        for tid in p.tag_ids:
            await db.execute(
                text("INSERT INTO entity_tags (tag_id, entity_type, entity_id) "
                     "VALUES (:t, 'product', :e) ON CONFLICT DO NOTHING"),
                {"t": tid, "e": pid},
            )


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(
    p: ProductIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    pid = uuid4()
    params = _product_params(p)
    params.update({"id": str(pid), "o": org_id})
    await db.execute(
        text(f"INSERT INTO products (id, organization_id, name, sku, barcode, category_id, "
             f"unit_id, purchase_price, sale_price, currency_id, is_service, is_material, "
             f"is_semi_product, is_marked, has_expiration, is_variant, parent_id, image_url, "
             f"box_qty, box_barcode, dim_length, dim_width, dim_height, dim_weight, description, kind, mxik) "
             f"VALUES (:id, :o, :n, :sku, :bc, :cat, :u, :pp, :sp, :cur, :svc, :mat, "
             f":semi, :mk, :exp, :var, :par, :img, :bq, :bbc, :dl, :dw, :dh, :dwg, :descr, COALESCE(:knd, 'good'), :mxik)"),
        params,
    )
    await _sync_product_extras(db, org_id, str(pid), p)
    await db.commit()
    return {"id": str(pid)}


@router.put("/products/{pid}")
async def update_product(
    pid: UUID, p: ProductIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    params = _product_params(p)
    params.update({"id": str(pid), "o": org_id})
    res = await db.execute(
        text(f"UPDATE products SET {_PRODUCT_FIELDS} "
             f"WHERE id = :id AND organization_id = :o RETURNING id"),
        params,
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await _sync_product_extras(db, org_id, str(pid), p)
    await db.commit()
    return {"ok": True}


@router.get("/products/{pid}/full")
async def product_full(
    pid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT p.*, cur.code AS currency_code, un.short_name AS unit_name, "
             "cat.name AS category_name "
             "FROM products p "
             "LEFT JOIN currencies cur ON cur.id = p.currency_id "
             "LEFT JOIN units un ON un.id = p.unit_id "
             "LEFT JOIN product_categories cat ON cat.id = p.category_id "
             "WHERE p.id = :id AND p.organization_id = :o"),
        {"id": str(pid), "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    product = dict(row._mapping)
    bcres = await db.execute(
        text("SELECT id, barcode, type FROM product_barcodes WHERE product_id = :p"),
        {"p": str(pid)},
    )
    product["extra_barcodes"] = [dict(r._mapping) for r in bcres]
    tagres = await db.execute(
        text("SELECT t.id, t.name, t.color FROM tags t "
             "JOIN entity_tags et ON et.tag_id = t.id "
             "WHERE et.entity_type='product' AND et.entity_id=:e"),
        {"e": str(pid)},
    )
    product["tags"] = [dict(r._mapping) for r in tagres]
    varres = await db.execute(
        text("SELECT id, name, sku, sale_price FROM products "
             "WHERE parent_id = :p AND organization_id = :o AND is_active"),
        {"p": str(pid), "o": org_id},
    )
    product["variants"] = [dict(r._mapping) for r in varres]
    return product


@router.delete("/products/{pid}")
async def delete_product(
    pid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE products SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(pid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# STOCK
# =========================================================

@router.get("/stock")
async def stock_balances(
    warehouse_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE p.organization_id = :o"
    params: dict = {"o": org_id}
    if warehouse_id is not None:
        where += " AND sb.warehouse_id = :wh"
        params["wh"] = warehouse_id
    res = await db.execute(
        text(f"SELECT sb.warehouse_id, sb.product_id, p.name, sb.quantity, sb.avg_cost "
             f"FROM stock_balances sb JOIN products p ON p.id = sb.product_id "
             f"{where} ORDER BY p.name"),
        params,
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# INVENTORY (revision / inventarizatsiya)
# =========================================================

class InventoryItemIn(BaseModel):
    product_id: UUID
    actual_qty: Decimal = Field(ge=0)


class InventoryIn(BaseModel):
    warehouse_id: int
    notes: str | None = None
    items: list[InventoryItemIn] = Field(default_factory=list)


@router.get("/inventories")
async def list_inventories(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT i.id, i.doc_number, i.status, i.started_at, i.finished_at, "
             "w.name AS warehouse_name "
             "FROM inventories i LEFT JOIN warehouses w ON w.id = i.warehouse_id "
             "WHERE i.organization_id = :o "
             "ORDER BY i.created_at DESC LIMIT 200"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/inventories", status_code=status.HTTP_201_CREATED)
async def create_inventory(
    p: InventoryIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    iid = uuid4()
    await db.execute(
        text("INSERT INTO inventories (id, organization_id, warehouse_id, status, started_at, notes) "
             "VALUES (:id, :o, :w, 'in_progress', NOW(), :n)"),
        {"id": str(iid), "o": org_id, "w": p.warehouse_id, "n": p.notes},
    )
    for it in p.items:
        expected = await _stock_qty(db, p.warehouse_id, str(it.product_id))
        await db.execute(
            text("INSERT INTO inventory_items (inventory_id, product_id, expected_qty, actual_qty) "
                 "VALUES (:i, :p, :e, :a)"),
            {"i": str(iid), "p": str(it.product_id), "e": expected, "a": it.actual_qty},
        )
    await db.commit()
    return {"id": str(iid)}


@router.get("/inventories/{iid}")
async def get_inventory(
    iid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT i.*, w.name AS warehouse_name FROM inventories i "
             "LEFT JOIN warehouses w ON w.id = i.warehouse_id "
             "WHERE i.id = :id AND i.organization_id = :o"),
        {"id": str(iid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items = await db.execute(
        text("SELECT ii.product_id, p.name, ii.expected_qty, ii.actual_qty, ii.diff_qty "
             "FROM inventory_items ii LEFT JOIN products p ON p.id = ii.product_id "
             "WHERE ii.inventory_id = :id"),
        {"id": str(iid)},
    )
    return {"head": dict(h._mapping), "items": [dict(r._mapping) for r in items]}


@router.post("/inventories/{iid}/finish")
async def finish_inventory(
    iid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT warehouse_id, status FROM inventories "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(iid), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status == "completed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Уже завершено")

    items = await db.execute(
        text("SELECT product_id, diff_qty FROM inventory_items WHERE inventory_id = :i"),
        {"i": str(iid)},
    )
    for it in items:
        await _stock_apply(db, row.warehouse_id, str(it.product_id),
                           Decimal(str(it.diff_qty)))

    await db.execute(
        text("UPDATE inventories SET status='completed', finished_at=NOW() WHERE id = :id"),
        {"id": str(iid)},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# INTERNAL TRANSFERS (sklad orasi ko'chirish)
# =========================================================

class TransferItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(gt=0)


class TransferIn(BaseModel):
    from_warehouse_id: int
    to_warehouse_id: int
    transfer_date: date
    notes: str | None = None
    items: list[TransferItemIn] = Field(min_length=1)


@router.get("/transfers")
async def list_transfers(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT t.id, t.doc_number, t.transfer_date, t.status, "
             "fw.name AS from_name, tw.name AS to_name "
             "FROM transfers t "
             "LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id "
             "LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id "
             "WHERE t.organization_id = :o "
             "ORDER BY t.transfer_date DESC, t.created_at DESC LIMIT 200"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/transfers", status_code=status.HTTP_201_CREATED)
async def create_transfer(
    p: TransferIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    if p.from_warehouse_id == p.to_warehouse_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Склады совпадают")

    tid = uuid4()
    await db.execute(
        text("INSERT INTO transfers (id, organization_id, from_warehouse_id, to_warehouse_id, "
             "transfer_date, status, notes, created_by) "
             "VALUES (:id, :o, :f, :t, :d, 'received', :n, :u)"),
        {"id": str(tid), "o": org_id, "f": p.from_warehouse_id, "t": p.to_warehouse_id,
         "d": p.transfer_date, "n": p.notes, "u": user_id},
    )
    for it in p.items:
        cost_res = await db.execute(
            text("SELECT avg_cost FROM stock_balances WHERE warehouse_id=:w AND product_id=:p"),
            {"w": p.from_warehouse_id, "p": str(it.product_id)},
        )
        cost = Decimal(str(cost_res.scalar() or 0))

        await db.execute(
            text("INSERT INTO transfer_items (transfer_id, product_id, quantity, cost) "
                 "VALUES (:t, :p, :q, :c)"),
            {"t": str(tid), "p": str(it.product_id), "q": it.quantity, "c": cost},
        )
        # Decrease from source
        await _stock_apply(db, p.from_warehouse_id, str(it.product_id), -it.quantity)
        # Increase target with same avg cost
        await _stock_apply(db, p.to_warehouse_id, str(it.product_id), it.quantity, cost)

    await db.commit()
    return {"id": str(tid)}


@router.get("/transfers/{tid}")
async def get_transfer(
    tid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT t.*, fw.name AS from_name, tw.name AS to_name FROM transfers t "
             "LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id "
             "LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id "
             "WHERE t.id = :id AND t.organization_id = :o"),
        {"id": str(tid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items = await db.execute(
        text("SELECT ti.product_id, p.name, ti.quantity, ti.cost FROM transfer_items ti "
             "LEFT JOIN products p ON p.id = ti.product_id WHERE ti.transfer_id = :id"),
        {"id": str(tid)},
    )
    return {"head": dict(h._mapping), "items": [dict(r._mapping) for r in items]}


# =========================================================
# WRITE-OFF REASONS
# =========================================================

class ReasonIn(BaseModel):
    name: str


@router.get("/write-off-reasons")
async def list_reasons(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name FROM write_off_reasons "
             "WHERE organization_id = :o AND is_active = TRUE ORDER BY name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/write-off-reasons", status_code=status.HTTP_201_CREATED)
async def create_reason(
    p: ReasonIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO write_off_reasons (organization_id, name) "
             "VALUES (:o, :n) RETURNING id"),
        {"o": org_id, "n": p.name},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/write-off-reasons/{rid}")
async def update_reason(
    rid: int, p: ReasonIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE write_off_reasons SET name=:n WHERE id=:id AND organization_id=:o RETURNING id"),
        {"id": rid, "o": org_id, "n": p.name},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/write-off-reasons/{rid}")
async def delete_reason(
    rid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE write_off_reasons SET is_active=FALSE WHERE id=:id AND organization_id=:o"),
        {"id": rid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# WRITE-OFFS (spisaniye)
# =========================================================

class WriteOffItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(gt=0)


class WriteOffIn(BaseModel):
    warehouse_id: int
    reason_id: int | None = None
    write_off_date: date
    notes: str | None = None
    items: list[WriteOffItemIn] = Field(min_length=1)


@router.get("/write-offs")
async def list_write_offs(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT wo.id, wo.doc_number, wo.write_off_date, wo.total_amount, "
             "w.name AS warehouse_name, r.name AS reason_name "
             "FROM write_offs wo "
             "LEFT JOIN warehouses w ON w.id = wo.warehouse_id "
             "LEFT JOIN write_off_reasons r ON r.id = wo.reason_id "
             "WHERE wo.organization_id = :o "
             "ORDER BY wo.write_off_date DESC, wo.created_at DESC LIMIT 200"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/write-offs", status_code=status.HTTP_201_CREATED)
async def create_write_off(
    p: WriteOffIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    wid = uuid4()
    total = Decimal("0")
    line_data = []

    for it in p.items:
        cost_res = await db.execute(
            text("SELECT avg_cost FROM stock_balances WHERE warehouse_id=:w AND product_id=:p"),
            {"w": p.warehouse_id, "p": str(it.product_id)},
        )
        cost = Decimal(str(cost_res.scalar() or 0))
        total += it.quantity * cost
        line_data.append((it.product_id, it.quantity, cost))

    await db.execute(
        text("INSERT INTO write_offs (id, organization_id, warehouse_id, reason_id, "
             "write_off_date, total_amount, notes, created_by) "
             "VALUES (:id, :o, :w, :r, :d, :t, :n, :u)"),
        {"id": str(wid), "o": org_id, "w": p.warehouse_id, "r": p.reason_id,
         "d": p.write_off_date, "t": total, "n": p.notes, "u": user_id},
    )

    for product_id, qty, cost in line_data:
        await db.execute(
            text("INSERT INTO write_off_items (write_off_id, product_id, quantity, cost) "
                 "VALUES (:w, :p, :q, :c)"),
            {"w": str(wid), "p": str(product_id), "q": qty, "c": cost},
        )
        await _stock_apply(db, p.warehouse_id, str(product_id), -qty)

    await db.commit()
    return {"id": str(wid), "total_amount": float(total)}


@router.get("/write-offs/{wid}")
async def get_write_off(
    wid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT wo.*, w.name AS warehouse_name, r.name AS reason_name FROM write_offs wo "
             "LEFT JOIN warehouses w ON w.id = wo.warehouse_id "
             "LEFT JOIN write_off_reasons r ON r.id = wo.reason_id "
             "WHERE wo.id = :id AND wo.organization_id = :o"),
        {"id": str(wid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items = await db.execute(
        text("SELECT woi.product_id, p.name, woi.quantity, woi.cost, woi.amount "
             "FROM write_off_items woi LEFT JOIN products p ON p.id = woi.product_id "
             "WHERE woi.write_off_id = :id"),
        {"id": str(wid)},
    )
    return {"head": dict(h._mapping), "items": [dict(r._mapping) for r in items]}


# =========================================================
# RECOMMENDED STOCK (min/max per product+warehouse)
# =========================================================

class RecommendedIn(BaseModel):
    warehouse_id: int
    product_id: UUID
    min_qty: Decimal = Decimal("0")
    max_qty: Decimal | None = None


@router.get("/recommended-stock")
async def list_recommended(
    warehouse_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE rs.organization_id = :o"
    params: dict = {"o": org_id}
    if warehouse_id is not None:
        where += " AND rs.warehouse_id = :w"
        params["w"] = warehouse_id
    res = await db.execute(
        text(f"SELECT rs.id, rs.warehouse_id, rs.product_id, rs.min_qty, rs.max_qty, "
             f"p.name AS product_name, w.name AS warehouse_name, "
             f"COALESCE(sb.quantity, 0) AS current_qty, "
             f"CASE WHEN COALESCE(sb.quantity,0) < rs.min_qty THEN TRUE ELSE FALSE END AS below_min "
             f"FROM recommended_stock rs "
             f"LEFT JOIN products p ON p.id = rs.product_id "
             f"LEFT JOIN warehouses w ON w.id = rs.warehouse_id "
             f"LEFT JOIN stock_balances sb ON sb.warehouse_id = rs.warehouse_id "
             f"AND sb.product_id = rs.product_id "
             f"{where} ORDER BY w.name, p.name"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/recommended-stock", status_code=status.HTTP_201_CREATED)
async def upsert_recommended(
    p: RecommendedIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO recommended_stock (organization_id, warehouse_id, product_id, min_qty, max_qty) "
             "VALUES (:o, :w, :p, :mn, :mx) "
             "ON CONFLICT (warehouse_id, product_id) DO UPDATE "
             "SET min_qty = EXCLUDED.min_qty, max_qty = EXCLUDED.max_qty "
             "RETURNING id"),
        {"o": org_id, "w": p.warehouse_id, "p": str(p.product_id),
         "mn": p.min_qty, "mx": p.max_qty},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.delete("/recommended-stock/{rid}")
async def delete_recommended(
    rid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM recommended_stock WHERE id = :id AND organization_id = :o"),
        {"id": rid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# REPORTS (cost of goods, in-stock on date — simple)
# =========================================================

@router.get("/cost-of-goods")
async def cost_of_goods(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT p.id, p.name, p.sku,
               COALESCE(SUM(sb.quantity), 0) AS total_qty,
               COALESCE(SUM(sb.quantity * sb.avg_cost), 0) AS total_cost
        FROM products p
        LEFT JOIN stock_balances sb ON sb.product_id = p.id
        WHERE p.organization_id = :o AND p.is_active = TRUE AND p.is_service = FALSE
        GROUP BY p.id, p.name, p.sku
        HAVING COALESCE(SUM(sb.quantity), 0) > 0
        ORDER BY total_cost DESC
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# PRODUCT STATISTICS (movement summary per product)
# =========================================================

@router.get("/product-statistic")
async def product_statistic(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT p.id, p.sku, p.name,
               COALESCE((SELECT SUM(si.quantity) FROM supply_items si
                         JOIN supplies s ON s.id = si.supply_id
                         WHERE si.product_id = p.id AND s.organization_id = :o), 0) AS purchased_qty,
               COALESCE((SELECT SUM(sli.quantity) FROM sale_items sli
                         JOIN sales sl ON sl.id = sli.sale_id
                         WHERE sli.product_id = p.id AND sl.organization_id = :o
                         AND sl.status <> 'cancelled'), 0) AS sold_qty,
               COALESCE((SELECT SUM(sb.quantity) FROM stock_balances sb
                         WHERE sb.product_id = p.id), 0) AS current_stock,
               p.sale_price
        FROM products p
        WHERE p.organization_id = :o AND p.is_active = TRUE
        ORDER BY sold_qty DESC LIMIT 200
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# PRODUCT INCOME (profit per product)
# =========================================================

@router.get("/product-income")
async def product_income(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT p.id, p.sku, p.name,
               SUM(si.quantity) AS sold_qty,
               SUM(si.quantity * si.price) AS revenue,
               SUM(si.quantity * COALESCE(p.purchase_price, 0)) AS cost,
               SUM(si.quantity * si.price) - SUM(si.quantity * COALESCE(p.purchase_price, 0)) AS profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.organization_id = :o AND s.status <> 'cancelled'
        GROUP BY p.id, p.sku, p.name
        HAVING SUM(si.quantity) > 0
        ORDER BY profit DESC LIMIT 200
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# WRITE-OFF REPORT (summary)
# =========================================================

@router.get("/write-off-report")
async def write_off_report(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    by_reason = await db.execute(
        text("""
        SELECT r.name AS reason, COUNT(wo.id) AS cnt, COALESCE(SUM(wo.total_amount), 0) AS total
        FROM write_offs wo
        LEFT JOIN write_off_reasons r ON r.id = wo.reason_id
        WHERE wo.organization_id = :o
        GROUP BY r.name ORDER BY total DESC
        """),
        {"o": org_id},
    )
    by_product = await db.execute(
        text("""
        SELECT p.id, p.name, SUM(wi.quantity) AS qty, SUM(wi.amount) AS total
        FROM write_off_items wi
        JOIN write_offs wo ON wo.id = wi.write_off_id
        JOIN products p ON p.id = wi.product_id
        WHERE wo.organization_id = :o
        GROUP BY p.id, p.name ORDER BY total DESC LIMIT 50
        """),
        {"o": org_id},
    )
    return {
        "by_reason": [dict(r._mapping) for r in by_reason],
        "by_product": [dict(r._mapping) for r in by_product],
    }
