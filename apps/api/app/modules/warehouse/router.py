from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user_id, get_current_org_id
from app.modules.rbac.deps import require_permission, get_user_permissions
from app.modules.warehouse.service import (
    _stock_qty, _stock_apply, _next_doc_number, _bom_check_cycle,
    get_products_paginated,
)
from app.modules.warehouse.excel import (
    parse_import_file,
    build_export_workbook,
    build_import_template,
    _to_decimal,
)


router = APIRouter(prefix="/warehouse", tags=["warehouse"])


# =========================================================
# WAREHOUSES (sklady)
# =========================================================

class WarehouseIn(BaseModel):
    name: str
    address: str | None = None
    responsible_id: UUID | None = None
    type_id: int | None = None


@router.get("/warehouses", dependencies=[Depends(require_permission("warehouse.warehouse.view"))])
async def list_warehouses(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT w.id, w.name, w.address, w.responsible_id, "
             "e.full_name AS responsible_name, "
             "w.type_id, wt.name AS type_name, "
             "(SELECT COUNT(DISTINCT product_id) FROM stock_balances sb WHERE sb.warehouse_id = w.id AND sb.quantity > 0) AS product_count, "
             "(SELECT COALESCE(SUM(sb.quantity * sb.avg_cost), 0) FROM stock_balances sb WHERE sb.warehouse_id = w.id) AS stock_value "
             "FROM warehouses w "
             "LEFT JOIN employees e ON e.id = w.responsible_id "
             "LEFT JOIN warehouse_types wt ON wt.id = w.type_id "
             "WHERE w.organization_id = :o AND w.is_active = TRUE ORDER BY w.name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/warehouses", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("warehouse.warehouse.manage"))])
async def create_warehouse(
    p: WarehouseIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO warehouses (organization_id, name, address, responsible_id, type_id) "
             "VALUES (:o, :n, :a, :r, :tid) RETURNING id"),
        {"o": org_id, "n": p.name, "a": p.address,
         "r": str(p.responsible_id) if p.responsible_id else None,
         "tid": p.type_id},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/warehouses/{wid}", dependencies=[Depends(require_permission("warehouse.warehouse.manage"))])
async def update_warehouse(
    wid: int, p: WarehouseIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE warehouses SET name=:n, address=:a, responsible_id=:r, type_id=:tid "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": wid, "o": org_id, "n": p.name, "a": p.address,
         "r": str(p.responsible_id) if p.responsible_id else None,
         "tid": p.type_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/warehouses/{wid}", dependencies=[Depends(require_permission("warehouse.warehouse.manage"))])
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
    product_type: str | None = None
    mxik: str | None = Field(
        default=None,
        pattern=r"^\d{10,17}$",
        description="MXIK (Mahsulot va Xizmatlar Identifikatsiya Kodi) — 10-17 raqam",
    )
    extra_barcodes: list[str] | None = None
    tag_ids: list[int] | None = None
    default_cell_id: UUID | None = None
    default_supplier_id: UUID | None = None


@router.get("/products", dependencies=[Depends(require_permission("warehouse.product.view"))])
async def list_products(
    warehouse_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None),
    category_id: int | None = Query(None),
    product_type: str | None = Query(None),
    is_service: bool | None = Query(None),
    kind: str | None = Query(None),
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if warehouse_id is not None:
        # Verify the warehouse belongs to this org (cross-org isolation)
        wh_check = await db.execute(
            text("SELECT id FROM warehouses WHERE id = :wid AND organization_id = :o"),
            {"wid": warehouse_id, "o": org_id},
        )
        if not wh_check.scalar():
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ombor topilmadi")

        # Paginated mode with on_hand — capped at 100 per DESIGN-2 Section 5.4
        paged_limit = min(limit, 100)
        return await get_products_paginated(
            db=db,
            org_id=org_id,
            warehouse_id=warehouse_id,
            page=page,
            limit=paged_limit,
            q=q,
            category_id=category_id,
            product_type=product_type,
        )

    # Legacy flat list (backward compat — no warehouse_id)
    where = "WHERE p.organization_id = :o AND p.is_active = TRUE"
    if not include_archived:
        where += " AND p.is_archived = FALSE"
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
    if product_type:
        where += " AND p.product_type = :pt"
        params["pt"] = product_type
    res = await db.execute(
        text(f"SELECT p.id, p.sku, p.barcode, p.name, p.mxik, "
             f"p.sale_price, p.purchase_price, p.currency_id, "
             f"p.unit_id, p.category_id, p.is_service, p.is_produced, p.created_at, "
             f"cur.code AS currency_code, "
             f"un.short_name AS unit_name, "
             f"cat.name AS category_name, "
             f"COALESCE((SELECT SUM(quantity) FROM stock_balances WHERE product_id = p.id), 0) AS total_stock, "
             f"p.default_cell_id, "
             f"wc.code AS default_cell_code, "
             f"p.is_archived, p.archived_at, "
             f"p.default_supplier_id, "
             f"sup.name AS default_supplier_name "
             f"FROM products p "
             f"LEFT JOIN currencies cur ON cur.id = p.currency_id "
             f"LEFT JOIN units un ON un.id = p.unit_id "
             f"LEFT JOIN product_categories cat ON cat.id = p.category_id "
             f"LEFT JOIN warehouse_cells wc ON wc.id = p.default_cell_id "
             f"LEFT JOIN suppliers sup ON sup.id = p.default_supplier_id "
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
    description=:descr, kind=COALESCE(:knd, kind), mxik=:mxik,
    default_cell_id=:dcell, product_type=COALESCE(:ptype, product_type),
    default_supplier_id=:dsup
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
        "dcell": str(p.default_cell_id) if p.default_cell_id else None,
        "ptype": p.product_type,
        "dsup": str(p.default_supplier_id) if p.default_supplier_id else None,
    }


async def _validate_cell_org(db: AsyncSession, org_id: str, cell_id: UUID | None) -> None:
    """Raises 422 if cell_id is provided but does not belong to org_id."""
    if cell_id is None:
        return
    res = await db.execute(
        text("SELECT id FROM warehouse_cells WHERE id = :id AND organization_id = :o"),
        {"id": str(cell_id), "o": org_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Katak tashkilotga tegishli emas")


async def _sync_product_extras(db: AsyncSession, org_id: str, pid: str, p: ProductIn) -> None:
    if p.extra_barcodes is not None:
        await db.execute(
            text("DELETE FROM product_barcodes WHERE product_id = :p AND organization_id = :o"),
            {"p": pid, "o": org_id},
        )
        for bc in p.extra_barcodes:
            if bc:
                await db.execute(
                    text(
                        "INSERT INTO product_barcodes "
                        "(organization_id, product_id, barcode) "
                        "VALUES (:o, :p, :b) ON CONFLICT DO NOTHING"
                    ),
                    {"o": org_id, "p": pid, "b": bc},
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
    await _validate_cell_org(db, org_id, p.default_cell_id)
    pid = uuid4()
    params = _product_params(p)
    params.update({"id": str(pid), "o": org_id})
    await db.execute(
        text(f"INSERT INTO products (id, organization_id, name, sku, barcode, category_id, "
             f"unit_id, purchase_price, sale_price, currency_id, is_service, is_material, "
             f"is_semi_product, is_marked, has_expiration, is_variant, parent_id, image_url, "
             f"box_qty, box_barcode, dim_length, dim_width, dim_height, dim_weight, description, kind, mxik, "
             f"default_cell_id, product_type, default_supplier_id) "
             f"VALUES (:id, :o, :n, :sku, :bc, :cat, :u, :pp, :sp, :cur, :svc, :mat, "
             f":semi, :mk, :exp, :var, :par, :img, :bq, :bbc, :dl, :dw, :dh, :dwg, :descr, COALESCE(:knd, 'good'), :mxik, "
             f":dcell, :ptype, :dsup)"),
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
    await _validate_cell_org(db, org_id, p.default_cell_id)
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
             "cat.name AS category_name, "
             "wc.code AS default_cell_code, "
             "sup.name AS default_supplier_name "
             "FROM products p "
             "LEFT JOIN currencies cur ON cur.id = p.currency_id "
             "LEFT JOIN units un ON un.id = p.unit_id "
             "LEFT JOIN product_categories cat ON cat.id = p.category_id "
             "LEFT JOIN warehouse_cells wc ON wc.id = p.default_cell_id "
             "LEFT JOIN suppliers sup ON sup.id = p.default_supplier_id "
             "WHERE p.id = :id AND p.organization_id = :o"),
        {"id": str(pid), "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    product = dict(row._mapping)
    bcres = await db.execute(
        text("SELECT id, barcode, is_primary, is_active FROM product_barcodes WHERE product_id = :p AND organization_id = :o"),
        {"p": str(pid), "o": org_id},
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


class ProductPatchIn(BaseModel):
    default_supplier_id: UUID | None = None


@router.patch(
    "/products/{pid}",
    dependencies=[Depends(require_permission("warehouse.product.view"))],
)
async def patch_product(
    pid: UUID,
    p: ProductPatchIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(
            "UPDATE products SET default_supplier_id = :dsup "
            "WHERE id = :id AND organization_id = :o RETURNING id"
        ),
        {"id": str(pid), "o": org_id,
         "dsup": str(p.default_supplier_id) if p.default_supplier_id else None},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.post(
    "/products/{pid}/archive",
    dependencies=[Depends(require_permission("warehouse.product.archive"))],
)
async def archive_product(
    pid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    check = await db.execute(
        text("SELECT id, is_archived FROM products WHERE id = :id AND organization_id = :o"),
        {"id": str(pid), "o": org_id},
    )
    row = check.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")
    if row.is_archived:
        return {"ok": True}

    open_sale = await db.execute(
        text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM sale_items si "
            "  JOIN sales s ON s.id = si.sale_id "
            "  WHERE si.product_id = :pid "
            "  AND s.status IN ('draft', 'confirmed') "
            "  AND s.organization_id = :o"
            ")"
        ),
        {"pid": str(pid), "o": org_id},
    )
    if open_sale.scalar():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mahsulotni arxivlab bo'lmaydi: ochiq sotuv operatsiyalari mavjud",
        )

    open_supply = await db.execute(
        text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM supply_items si "
            "  JOIN supplies s ON s.id = si.supply_id "
            "  WHERE si.product_id = :pid "
            "  AND s.status != 'received' "
            "  AND s.organization_id = :o"
            ")"
        ),
        {"pid": str(pid), "o": org_id},
    )
    if open_supply.scalar():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mahsulotni arxivlab bo'lmaydi: ochiq xarid operatsiyalari mavjud",
        )

    await db.execute(
        text(
            "UPDATE products "
            "SET is_archived = TRUE, "
            "    archived_at = NOW(), "
            "    archived_by = :uid "
            "WHERE id = :id AND organization_id = :o"
        ),
        {"id": str(pid), "o": org_id, "uid": user_id},
    )
    await db.commit()
    return {"ok": True}


@router.post(
    "/products/{pid}/unarchive",
    dependencies=[Depends(require_permission("warehouse.product.archive"))],
)
async def unarchive_product(
    pid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    check = await db.execute(
        text("SELECT id FROM products WHERE id = :id AND organization_id = :o"),
        {"id": str(pid), "o": org_id},
    )
    if not check.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")
    await db.execute(
        text(
            "UPDATE products "
            "SET is_archived = FALSE, "
            "    archived_at = NULL, "
            "    archived_by = NULL "
            "WHERE id = :id AND organization_id = :o"
        ),
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
    blind_count: bool = False
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
        text("INSERT INTO inventories "
             "(id, organization_id, warehouse_id, status, started_at, notes, blind_count) "
             "VALUES (:id, :o, :w, 'draft', NOW(), :n, :bc)"),
        {"id": str(iid), "o": org_id, "w": p.warehouse_id, "n": p.notes, "bc": p.blind_count},
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


@router.post("/inventories/{iid}/finish", dependencies=[Depends(require_permission("warehouse.inventory"))])
async def finish_inventory(
    iid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
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
        await _stock_apply(
            db, row.warehouse_id, str(it.product_id),
            Decimal(str(it.diff_qty)), allow_negative=True,
            org_id=org_id, operation_type="inventory_adjust",
            source_type="inventory", source_id=str(iid),
            user_id=user_id,
        )

    await db.execute(
        text("UPDATE inventories SET status='completed', finished_at=NOW() WHERE id = :id"),
        {"id": str(iid)},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# INVENTORY RICH STATES — T-204
# State machine: draft→in_progress→paused→in_progress→pending_confirmation→completed
#                Any non-completed → cancelled
#                pending_confirmation → in_progress (reject)
# =========================================================

class ScanEventIn(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(gt=0)
    barcode: str | None = None
    device_id: str | None = None
    notes: str | None = None


_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"in_progress", "cancelled"},
    "in_progress": {"paused", "pending_confirmation", "cancelled"},
    "paused": {"in_progress"},
    "pending_confirmation": {"completed", "in_progress"},
    "completed": set(),
    "cancelled": set(),
}

_TRANSITION_TIMESTAMPS: dict[str, str] = {
    "paused": "paused_at",
    "pending_confirmation": "submitted_at",
    "completed": "confirmed_at",
    # in_progress is context-dependent: resume sets resumed_at, start sets started_at
    # handled inline in transition functions that need specific columns
}


async def _transition_inventory(
    db: AsyncSession,
    iid: str,
    org_id: str,
    from_status: str,
    to_status: str,
    user_id: str | None = None,
) -> None:
    ts_col = _TRANSITION_TIMESTAMPS.get(to_status)
    set_clause = f"status = :to, {ts_col} = NOW()" if ts_col else "status = :to"
    params: dict = {"to": to_status, "id": iid, "o": org_id, "from": from_status}
    if to_status == "completed" and user_id:
        set_clause += ", confirmed_by = :uid"
        params["uid"] = user_id
    result = await db.execute(
        text(
            f"UPDATE inventories SET {set_clause} "
            "WHERE id = :id AND organization_id = :o AND status = :from "
            "RETURNING id"
        ),
        params,
    )
    if not result.first():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid state transition: {from_status} -> {to_status} or inventory not found",
        )


async def _get_inventory_head(db: AsyncSession, iid: str, org_id: str):
    res = await db.execute(
        text("SELECT id, status, warehouse_id, blind_count FROM inventories "
             "WHERE id = :id AND organization_id = :o"),
        {"id": iid, "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inventory not found")
    return row


def _validate_transition(current_status: str, target_status: str) -> None:
    allowed = _ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid state transition: {current_status} → {target_status}",
        )


@router.post(
    "/inventories/{iid}/start",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def start_inventory(
    iid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await _get_inventory_head(db, str(iid), org_id)
    _validate_transition(row.status, "in_progress")
    result = await db.execute(
        text(
            "UPDATE inventories SET status = 'in_progress', started_at = NOW() "
            "WHERE id = :id AND organization_id = :o AND status = :from "
            "RETURNING id"
        ),
        {"id": str(iid), "o": org_id, "from": row.status},
    )
    if not result.first():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "State transition failed")
    await db.commit()
    return {"ok": True}


@router.post(
    "/inventories/{iid}/pause",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def pause_inventory(
    iid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await _get_inventory_head(db, str(iid), org_id)
    _validate_transition(row.status, "paused")
    await _transition_inventory(db, str(iid), org_id, row.status, "paused", user_id)
    await db.commit()
    return {"ok": True}


@router.post(
    "/inventories/{iid}/resume",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def resume_inventory(
    iid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await _get_inventory_head(db, str(iid), org_id)
    _validate_transition(row.status, "in_progress")
    result = await db.execute(
        text(
            "UPDATE inventories SET status = 'in_progress', resumed_at = NOW() "
            "WHERE id = :id AND organization_id = :o AND status = :from "
            "RETURNING id"
        ),
        {"id": str(iid), "o": org_id, "from": row.status},
    )
    if not result.first():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "State transition failed")
    await db.commit()
    return {"ok": True}


@router.post(
    "/inventories/{iid}/submit",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def submit_inventory(
    iid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await _get_inventory_head(db, str(iid), org_id)
    _validate_transition(row.status, "pending_confirmation")
    await _transition_inventory(db, str(iid), org_id, row.status, "pending_confirmation", user_id)
    await db.commit()
    return {"ok": True}


@router.post(
    "/inventories/{iid}/confirm",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def confirm_inventory(
    iid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await _get_inventory_head(db, str(iid), org_id)
    _validate_transition(row.status, "completed")

    items = await db.execute(
        text("SELECT product_id, expected_qty, actual_qty, diff_qty "
             "FROM inventory_items WHERE inventory_id = :i"),
        {"i": str(iid)},
    )
    correlation_id = str(uuid4())
    for it in items:
        variance = Decimal(str(it.diff_qty))
        if variance != 0:
            await _stock_apply(
                db, row.warehouse_id, str(it.product_id),
                delta_qty=variance,
                allow_negative=True,
                org_id=org_id,
                operation_type="inventory_adjust",
                source_type="inventory",
                source_id=str(iid),
                correlation_id=correlation_id,
                user_id=user_id,
                notes=f"Inventory adjust: expected={it.expected_qty}, actual={it.actual_qty}",
            )

    await _transition_inventory(db, str(iid), org_id, row.status, "completed", user_id)
    await db.commit()
    return {"ok": True}


@router.post(
    "/inventories/{iid}/reject",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def reject_inventory(
    iid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await _get_inventory_head(db, str(iid), org_id)
    _validate_transition(row.status, "in_progress")
    result = await db.execute(
        text(
            "UPDATE inventories SET status = 'in_progress', resumed_at = NOW() "
            "WHERE id = :id AND organization_id = :o AND status = :from "
            "RETURNING id"
        ),
        {"id": str(iid), "o": org_id, "from": row.status},
    )
    if not result.first():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "State transition failed")
    await db.commit()
    return {"ok": True}


@router.post(
    "/inventories/{iid}/cancel",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def cancel_inventory(
    iid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await _get_inventory_head(db, str(iid), org_id)
    _validate_transition(row.status, "cancelled")
    await _transition_inventory(db, str(iid), org_id, row.status, "cancelled", user_id)
    await db.commit()
    return {"ok": True}


@router.get(
    "/inventories/{iid}/items",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def get_inventory_items(
    iid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    row = await _get_inventory_head(db, str(iid), org_id)

    # Aggregate actual_qty from non-voided scan events; fall back to inventory_items if no events
    items = await db.execute(
        text(
            "SELECT ii.product_id, p.name AS product_name, "
            "       ii.expected_qty, "
            "       COALESCE("
            "           (SELECT SUM(se.quantity) FROM inventory_scan_events se "
            "            WHERE se.inventory_id = :iid AND se.product_id = ii.product_id "
            "              AND se.is_voided = FALSE), "
            "           ii.actual_qty"
            "       ) AS actual_qty, "
            "       ii.version "
            "FROM inventory_items ii "
            "LEFT JOIN products p ON p.id = ii.product_id "
            "WHERE ii.inventory_id = :iid"
        ),
        {"iid": str(iid)},
    )

    result = []
    for it in items:
        item = dict(it._mapping)
        if row.blind_count:
            item["expected_qty"] = None
        result.append(item)
    return result


@router.post(
    "/inventories/{iid}/scan-events",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def add_scan_event(
    iid: UUID,
    p: ScanEventIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await _get_inventory_head(db, str(iid), org_id)
    if row.status not in ("in_progress", "paused"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot scan in status '{row.status}'. Inventory must be in_progress or paused.",
        )

    # Verify product belongs to org
    prod_res = await db.execute(
        text("SELECT id FROM products WHERE id = :pid AND organization_id = :o"),
        {"pid": str(p.product_id), "o": org_id},
    )
    if not prod_res.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown product or product not in org")

    # Ensure inventory_items row exists for this product (upsert)
    await db.execute(
        text(
            "INSERT INTO inventory_items (inventory_id, product_id, expected_qty, actual_qty) "
            "VALUES (:iid, :pid, 0, 0) "
            "ON CONFLICT DO NOTHING"
        ),
        {"iid": str(iid), "pid": str(p.product_id)},
    )

    event_res = await db.execute(
        text(
            "INSERT INTO inventory_scan_events "
            "(organization_id, inventory_id, product_id, quantity, barcode, user_id, device_id, notes) "
            "VALUES (:o, :iid, :pid, :qty, :bc, :uid, :did, :notes) RETURNING id, scanned_at"
        ),
        {
            "o": org_id, "iid": str(iid), "pid": str(p.product_id),
            "qty": p.quantity, "bc": p.barcode, "uid": user_id,
            "did": p.device_id, "notes": p.notes,
        },
    )
    event_row = event_res.first()

    # Recompute actual_qty from non-voided scan events and bump version
    agg_res = await db.execute(
        text(
            "UPDATE inventory_items SET "
            "actual_qty = COALESCE("
            "    (SELECT SUM(quantity) FROM inventory_scan_events "
            "     WHERE inventory_id = :iid AND product_id = :pid AND is_voided = FALSE), 0"
            "), "
            "version = version + 1 "
            "WHERE inventory_id = :iid AND product_id = :pid "
            "RETURNING actual_qty, version"
        ),
        {"iid": str(iid), "pid": str(p.product_id)},
    )
    updated = agg_res.first()

    # Count non-voided events and get latest scanned_at for this product
    stats_res = await db.execute(
        text(
            "SELECT COUNT(*) AS scan_count, MAX(scanned_at) AS last_scanned_at "
            "FROM inventory_scan_events "
            "WHERE inventory_id = :iid AND product_id = :pid AND is_voided = FALSE"
        ),
        {"iid": str(iid), "pid": str(p.product_id)},
    )
    stats = stats_res.first()

    await db.commit()
    return {
        "scan_event_id": event_row.id,
        "product_id": str(p.product_id),
        "actual_qty": str(updated.actual_qty) if updated else str(p.quantity),
        "scan_count": stats.scan_count if stats else 1,
        "last_scanned_at": event_row.scanned_at.isoformat() if event_row.scanned_at else None,
    }


@router.get(
    "/inventories/{iid}/scan-events",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def list_scan_events(
    iid: UUID,
    product_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await _get_inventory_head(db, str(iid), org_id)

    where = "WHERE se.inventory_id = :iid AND se.organization_id = :o"
    params: dict = {"iid": str(iid), "o": org_id, "lim": limit, "off": (page - 1) * limit}
    if product_id is not None:
        where += " AND se.product_id = :pid"
        params["pid"] = str(product_id)

    count_res = await db.execute(
        text(f"SELECT COUNT(*) FROM inventory_scan_events se {where}"), params
    )
    total = count_res.scalar() or 0

    res = await db.execute(
        text(
            f"SELECT se.id, se.product_id, p.name AS product_name, "
            f"       se.quantity AS qty, se.user_id AS scanned_by, "
            f"       u.full_name AS scanned_by_name, "
            f"       se.scanned_at, se.device_id AS cell_id, "
            f"       se.barcode AS barcode_raw, se.is_voided "
            f"FROM inventory_scan_events se "
            f"LEFT JOIN products p ON p.id = se.product_id "
            f"LEFT JOIN users u ON u.id = se.user_id "
            f"{where} ORDER BY se.scanned_at DESC LIMIT :lim OFFSET :off"
        ),
        params,
    )
    items = []
    for r in res:
        row = dict(r._mapping)
        row["qty"] = str(row["qty"])
        items.append(row)
    return {"total": total, "items": items}


@router.delete(
    "/inventories/{iid}/scan-events/{event_id}",
    dependencies=[Depends(require_permission("warehouse.inventory"))],
)
async def void_scan_event(
    iid: UUID,
    event_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    inv_row = await _get_inventory_head(db, str(iid), org_id)
    if inv_row.status == "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Cannot void scan on completed inventory")

    # Fetch the event — verify it belongs to this inventory+org
    ev_res = await db.execute(
        text(
            "SELECT id, product_id, user_id, is_voided "
            "FROM inventory_scan_events "
            "WHERE id = :eid AND inventory_id = :iid AND organization_id = :o"
        ),
        {"eid": event_id, "iid": str(iid), "o": org_id},
    )
    ev = ev_res.first()
    if not ev:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Scan event not found")

    # Owner can always void their own event.
    # Non-owner requires manage_inventory_advanced (admin/manager level).
    is_owner = str(ev.user_id) == user_id
    if not is_owner:
        caller_perms = await get_user_permissions(user_id, org_id, db)
        if "warehouse.manage_inventory_advanced" not in caller_perms:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Faqat o'z scan eventingizni yoki admin sifatida boshqasini bekor qilishingiz mumkin",
            )

    # Soft delete
    await db.execute(
        text(
            "UPDATE inventory_scan_events SET is_voided = TRUE "
            "WHERE id = :eid AND organization_id = :o"
        ),
        {"eid": event_id, "o": org_id},
    )

    # Recompute actual_qty for this product
    agg_res = await db.execute(
        text(
            "UPDATE inventory_items SET "
            "actual_qty = COALESCE("
            "    (SELECT SUM(quantity) FROM inventory_scan_events "
            "     WHERE inventory_id = :iid AND product_id = :pid AND is_voided = FALSE), 0"
            "), "
            "version = version + 1 "
            "WHERE inventory_id = :iid AND product_id = :pid "
            "RETURNING actual_qty"
        ),
        {"iid": str(iid), "pid": str(ev.product_id)},
    )
    updated = agg_res.first()

    await db.commit()
    return {
        "ok": True,
        "product_id": str(ev.product_id),
        "actual_qty": str(updated.actual_qty) if updated else "0.000",
    }


@router.get(
    "/inventories/{iid}/progress",
    dependencies=[Depends(require_permission("warehouse.manage_inventory_advanced"))],
)
async def get_inventory_progress(
    iid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await _get_inventory_head(db, str(iid), org_id)

    # Total products in inventory_items for this inventory
    totals_res = await db.execute(
        text(
            "SELECT "
            "  COUNT(DISTINCT ii.product_id) AS total_products, "
            "  COUNT(DISTINCT CASE WHEN se_agg.scan_count > 0 THEN ii.product_id END) AS scanned_products "
            "FROM inventory_items ii "
            "LEFT JOIN ("
            "    SELECT product_id, COUNT(*) AS scan_count "
            "    FROM inventory_scan_events "
            "    WHERE inventory_id = :iid AND is_voided = FALSE "
            "    GROUP BY product_id"
            ") se_agg ON se_agg.product_id = ii.product_id "
            "WHERE ii.inventory_id = :iid"
        ),
        {"iid": str(iid)},
    )
    totals = totals_res.first()

    # Total scan count + last scan time
    events_res = await db.execute(
        text(
            "SELECT COUNT(*) AS total_scans, MAX(scanned_at) AS last_scan_at "
            "FROM inventory_scan_events "
            "WHERE inventory_id = :iid AND organization_id = :o AND is_voided = FALSE"
        ),
        {"iid": str(iid), "o": org_id},
    )
    events_agg = events_res.first()

    # Per-scanner stats
    scanners_res = await db.execute(
        text(
            "SELECT se.user_id, u.full_name AS name, COUNT(*) AS scan_count "
            "FROM inventory_scan_events se "
            "LEFT JOIN users u ON u.id = se.user_id "
            "WHERE se.inventory_id = :iid AND se.organization_id = :o AND se.is_voided = FALSE "
            "GROUP BY se.user_id, u.full_name "
            "ORDER BY scan_count DESC"
        ),
        {"iid": str(iid), "o": org_id},
    )
    scanners = [
        {
            "user_id": str(r.user_id),
            "name": r.name,
            "scan_count": r.scan_count,
        }
        for r in scanners_res
    ]

    last_scan_at = events_agg.last_scan_at
    return {
        "total_products": totals.total_products if totals else 0,
        "scanned_products": totals.scanned_products if totals else 0,
        "total_scans": events_agg.total_scans if events_agg else 0,
        "scanners": scanners,
        "last_scan_at": last_scan_at.isoformat() if last_scan_at else None,
    }


# =========================================================
# INTERNAL TRANSFERS — two-step workflow (draft→sent→received)
# =========================================================

class InternalTransferItemIn(BaseModel):
    product_id: UUID
    qty: Decimal = Field(gt=0)
    unit_id: int | None = None


class InternalTransferIn(BaseModel):
    from_warehouse: int
    to_warehouse: int
    notes: str | None = None
    items: list[InternalTransferItemIn] = Field(min_length=1)


@router.get("/transfers", dependencies=[Depends(require_permission("warehouse.transfer.view"))])
async def list_internal_transfers(
    transfer_status: str | None = Query(None, alias="status"),
    from_warehouse: int | None = Query(None),
    to_warehouse: int | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE t.organization_id = :o"
    params: dict = {"o": org_id, "lim": limit, "off": (page - 1) * limit}
    if transfer_status:
        where += " AND t.status = :st"
        params["st"] = transfer_status
    if from_warehouse is not None:
        where += " AND t.from_warehouse = :fw"
        params["fw"] = from_warehouse
    if to_warehouse is not None:
        where += " AND t.to_warehouse = :tw"
        params["tw"] = to_warehouse

    count_res = await db.execute(
        text(f"SELECT COUNT(*) FROM internal_transfers t {where}"), params
    )
    total = count_res.scalar() or 0

    res = await db.execute(
        text(
            f"SELECT t.id, t.doc_number, t.from_warehouse, fw.name AS from_name, "
            f"t.to_warehouse, tw.name AS to_name, t.status, "
            f"(SELECT COUNT(*) FROM internal_transfer_items WHERE transfer_id = t.id) AS item_count, "
            f"u.full_name AS created_by_name, t.created_at, t.sent_at, t.received_at "
            f"FROM internal_transfers t "
            f"LEFT JOIN warehouses fw ON fw.id = t.from_warehouse "
            f"LEFT JOIN warehouses tw ON tw.id = t.to_warehouse "
            f"LEFT JOIN users u ON u.id = t.created_by "
            f"{where} ORDER BY t.created_at DESC LIMIT :lim OFFSET :off"
        ),
        params,
    )
    return {
        "items": [dict(r._mapping) for r in res],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/transfers", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("warehouse.transfer.send"))])
async def create_internal_transfer(
    p: InternalTransferIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    if p.from_warehouse == p.to_warehouse:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="from_warehouse va to_warehouse bir xil bo'lishi mumkin emas")

    wh_check = await db.execute(
        text("SELECT id FROM warehouses WHERE id = ANY(:ids) AND organization_id = :o"),
        {"ids": [p.from_warehouse, p.to_warehouse], "o": org_id},
    )
    found_ids = {r[0] for r in wh_check}
    if p.from_warehouse not in found_ids or p.to_warehouse not in found_ids:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Bir yoki ikki ombor tashkilotga tegishli emas")

    product_ids = [str(it.product_id) for it in p.items]
    valid_res = await db.execute(
        text("SELECT id FROM products WHERE organization_id = :o AND id = ANY(:ids)"),
        {"o": org_id, "ids": product_ids},
    )
    valid_ids = {str(r[0]) for r in valid_res}
    missing = set(product_ids) - valid_ids
    if missing:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"Mahsulot topilmadi: {missing}")

    tid = uuid4()
    doc_number = await _next_doc_number(db, org_id, "transfer", "TRF")

    await db.execute(
        text(
            "INSERT INTO internal_transfers "
            "(id, organization_id, doc_number, from_warehouse, to_warehouse, notes, created_by) "
            "VALUES (:id, :o, :dn, :fw, :tw, :n, :u)"
        ),
        {"id": str(tid), "o": org_id, "dn": doc_number,
         "fw": p.from_warehouse, "tw": p.to_warehouse, "n": p.notes, "u": user_id},
    )
    for it in p.items:
        await db.execute(
            text(
                "INSERT INTO internal_transfer_items (transfer_id, product_id, qty, unit_id) "
                "VALUES (:t, :p, :q, :u)"
            ),
            {"t": str(tid), "p": str(it.product_id), "q": it.qty, "u": it.unit_id},
        )
    await db.commit()
    return {"id": str(tid), "doc_number": doc_number}


@router.get("/transfers/{tid}", dependencies=[Depends(require_permission("warehouse.transfer.view"))])
async def get_internal_transfer(
    tid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text(
            "SELECT t.id, t.doc_number, t.from_warehouse, fw.name AS from_name, "
            "t.to_warehouse, tw.name AS to_name, t.status, t.notes, "
            "t.created_at, t.sent_at, t.received_at, t.sent_by, t.received_by, "
            "COALESCE(us.full_name, us.username) AS sent_by_name, "
            "COALESCE(ur.full_name, ur.username) AS received_by_name "
            "FROM internal_transfers t "
            "LEFT JOIN warehouses fw ON fw.id = t.from_warehouse "
            "LEFT JOIN warehouses tw ON tw.id = t.to_warehouse "
            "LEFT JOIN users us ON us.id = t.sent_by "
            "LEFT JOIN users ur ON ur.id = t.received_by "
            "WHERE t.id = :id AND t.organization_id = :o"
        ),
        {"id": str(tid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items = await db.execute(
        text(
            "SELECT iti.product_id, p.name AS product_name, iti.qty, iti.unit_id, "
            "u.short_name AS unit_name "
            "FROM internal_transfer_items iti "
            "LEFT JOIN products p ON p.id = iti.product_id "
            "LEFT JOIN units u ON u.id = iti.unit_id "
            "WHERE iti.transfer_id = :id"
        ),
        {"id": str(tid)},
    )
    return {**dict(h._mapping), "items": [dict(r._mapping) for r in items]}


@router.post("/transfers/{tid}/send",
             dependencies=[Depends(require_permission("warehouse.transfer.send"))])
async def send_internal_transfer(
    tid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    head = await db.execute(
        text(
            "SELECT id, status, from_warehouse FROM internal_transfers "
            "WHERE id = :id AND organization_id = :o FOR UPDATE"
        ),
        {"id": str(tid), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Faqat draft holat yuborilishi mumkin")

    items = await db.execute(
        text(
            "SELECT iti.product_id, p.name AS product_name, iti.qty "
            "FROM internal_transfer_items iti "
            "JOIN products p ON p.id = iti.product_id "
            "WHERE iti.transfer_id = :id"
        ),
        {"id": str(tid)},
    )
    item_rows = items.fetchall()

    # Validate ALL items before applying any stock change
    for it in item_rows:
        on_hand = await _stock_qty(db, row.from_warehouse, str(it.product_id))
        if on_hand < Decimal(str(it.qty)):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{it.product_name}: mavjud {on_hand}, kerak {it.qty}",
            )

    transfer_correlation_id = str(uuid4())

    # Apply deductions and capture avg_cost for receive step
    for it in item_rows:
        cost_res = await db.execute(
            text("SELECT COALESCE(avg_cost, 0) FROM stock_balances "
                 "WHERE warehouse_id = :w AND product_id = :p"),
            {"w": row.from_warehouse, "p": str(it.product_id)},
        )
        avg_cost = Decimal(str(cost_res.scalar() or 0))
        await db.execute(
            text("UPDATE internal_transfer_items SET cost = :c "
                 "WHERE transfer_id = :t AND product_id = :p"),
            {"c": avg_cost, "t": str(tid), "p": str(it.product_id)},
        )
        await _stock_apply(
            db, row.from_warehouse, str(it.product_id),
            -Decimal(str(it.qty)), avg_cost, allow_negative=False,
            org_id=org_id, operation_type="transfer_out",
            source_type="internal_transfer", source_id=str(tid),
            correlation_id=transfer_correlation_id, user_id=user_id,
        )

    await db.execute(
        text(
            "UPDATE internal_transfers "
            "SET status='sent', sent_at=NOW(), sent_by=:u, correlation_id=:cid "
            "WHERE id = :id"
        ),
        {"u": user_id, "id": str(tid), "cid": transfer_correlation_id},
    )
    await db.commit()
    return {"ok": True}


@router.post("/transfers/{tid}/receive",
             dependencies=[Depends(require_permission("warehouse.transfer.receive"))])
async def receive_internal_transfer(
    tid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    head = await db.execute(
        text(
            "SELECT id, status, to_warehouse, correlation_id FROM internal_transfers "
            "WHERE id = :id AND organization_id = :o FOR UPDATE"
        ),
        {"id": str(tid), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status != "sent":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Faqat sent holat qabul qilinishi mumkin")

    recv_correlation_id = str(row.correlation_id) if row.correlation_id else None

    items = await db.execute(
        text("SELECT product_id, qty, cost FROM internal_transfer_items WHERE transfer_id = :id"),
        {"id": str(tid)},
    )
    for it in items.fetchall():
        await _stock_apply(
            db, row.to_warehouse, str(it.product_id),
            Decimal(str(it.qty)), cost=Decimal(str(it.cost)),
            org_id=org_id, operation_type="transfer_in",
            source_type="internal_transfer", source_id=str(tid),
            correlation_id=recv_correlation_id, user_id=user_id,
        )

    await db.execute(
        text("UPDATE internal_transfers SET status='received', received_at=NOW(), received_by=:u "
             "WHERE id = :id"),
        {"u": user_id, "id": str(tid)},
    )
    await db.commit()
    return {"ok": True}


@router.post("/transfers/{tid}/cancel",
             dependencies=[Depends(require_permission("warehouse.transfer.cancel"))])
async def cancel_internal_transfer(
    tid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    head = await db.execute(
        text(
            "SELECT id, status, from_warehouse FROM internal_transfers "
            "WHERE id = :id AND organization_id = :o FOR UPDATE"
        ),
        {"id": str(tid), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status == "received":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Qabul qilingan o'tkazmani bekor qilib bo'lmaydi")
    if row.status == "cancelled":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Allaqachon bekor qilingan")

    if row.status == "sent":
        items = await db.execute(
            text("SELECT product_id, qty FROM internal_transfer_items WHERE transfer_id = :id"),
            {"id": str(tid)},
        )
        for it in items.fetchall():
            await _stock_apply(
                db, row.from_warehouse, str(it.product_id),
                Decimal(str(it.qty)), allow_negative=False,
                org_id=org_id, operation_type="transfer_out",
                source_type="internal_transfer", source_id=str(tid),
                user_id=user_id,
                notes="cancel rollback",
            )

    await db.execute(
        text("UPDATE internal_transfers SET status='cancelled' WHERE id = :id"),
        {"id": str(tid)},
    )
    await db.commit()
    return {"ok": True}


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
        await _stock_apply(
            db, p.warehouse_id, str(product_id), -qty, allow_negative=True,
            org_id=org_id, operation_type="write_off",
            source_type="write_off", source_id=str(wid),
            user_id=user_id,
        )

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


# =========================================================
# WAREHOUSE TYPES
# =========================================================

class WarehouseTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str | None = Field(None, pattern=r'^(central|pos|transit|scrap|custom)$')


@router.get(
    "/types",
    dependencies=[Depends(require_permission("warehouse.type.view"))],
)
async def list_warehouse_types(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, code, is_active, created_at "
             "FROM warehouse_types "
             "WHERE organization_id = :o AND is_active = TRUE "
             "ORDER BY name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post(
    "/types",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouse.type.manage"))],
)
async def create_warehouse_type(
    p: WarehouseTypeIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    existing = await db.execute(
        text("SELECT id FROM warehouse_types WHERE organization_id = :o AND name = :n"),
        {"o": org_id, "n": p.name},
    )
    if existing.scalar():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Bu nom bilan tur allaqachon mavjud")
    res = await db.execute(
        text("INSERT INTO warehouse_types (organization_id, name, code) "
             "VALUES (:o, :n, :c) RETURNING id"),
        {"o": org_id, "n": p.name, "c": p.code},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put(
    "/types/{type_id}",
    dependencies=[Depends(require_permission("warehouse.type.manage"))],
)
async def update_warehouse_type(
    type_id: int,
    p: WarehouseTypeIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE warehouse_types SET name=:n, code=:c "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": type_id, "o": org_id, "n": p.name, "c": p.code},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tur topilmadi")
    await db.commit()
    return {"ok": True}


@router.delete(
    "/types/{type_id}",
    dependencies=[Depends(require_permission("warehouse.type.manage"))],
)
async def delete_warehouse_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE warehouse_types SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": type_id, "o": org_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tur topilmadi")
    await db.commit()
    return {"ok": True}


# =========================================================
# WAREHOUSE ROWS
# =========================================================

class WarehouseRowIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    sort_order: int = 0


@router.get(
    "/{wid}/rows",
    dependencies=[Depends(require_permission("warehouse.rack.view"))],
)
async def list_warehouse_rows(
    wid: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    wh = await db.execute(
        text("SELECT id FROM warehouses WHERE id = :id AND organization_id = :o AND is_active = TRUE"),
        {"id": wid, "o": org_id},
    )
    if not wh.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ombor topilmadi")
    res = await db.execute(
        text("SELECT wr.id, wr.warehouse_id, wr.name, wr.sort_order, "
             "COUNT(rack.id) AS rack_count "
             "FROM warehouse_rows wr "
             "LEFT JOIN warehouse_racks rack ON rack.row_id = wr.id "
             "WHERE wr.warehouse_id = :wid AND wr.organization_id = :o "
             "GROUP BY wr.id, wr.warehouse_id, wr.name, wr.sort_order "
             "ORDER BY wr.sort_order, wr.name"),
        {"wid": wid, "o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post(
    "/{wid}/rows",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouse.rack.manage"))],
)
async def create_warehouse_row(
    wid: int,
    p: WarehouseRowIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    wh = await db.execute(
        text("SELECT id FROM warehouses WHERE id = :id AND organization_id = :o AND is_active = TRUE"),
        {"id": wid, "o": org_id},
    )
    if not wh.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ombor topilmadi")
    res = await db.execute(
        text("INSERT INTO warehouse_rows (organization_id, warehouse_id, name, sort_order) "
             "VALUES (:o, :wid, :n, :s) RETURNING id"),
        {"o": org_id, "wid": wid, "n": p.name, "s": p.sort_order},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put(
    "/rows/{rid}",
    dependencies=[Depends(require_permission("warehouse.rack.manage"))],
)
async def update_warehouse_row(
    rid: int,
    p: WarehouseRowIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE warehouse_rows SET name=:n, sort_order=:s "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": rid, "o": org_id, "n": p.name, "s": p.sort_order},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Qator topilmadi")
    await db.commit()
    return {"ok": True}


@router.delete(
    "/rows/{rid}",
    dependencies=[Depends(require_permission("warehouse.rack.manage"))],
)
async def delete_warehouse_row(
    rid: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    row = await db.execute(
        text("SELECT id FROM warehouse_rows WHERE id = :id AND organization_id = :o"),
        {"id": rid, "o": org_id},
    )
    if not row.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Qator topilmadi")
    rack_count = await db.execute(
        text("SELECT COUNT(*) FROM warehouse_racks WHERE row_id = :rid"),
        {"rid": rid},
    )
    if rack_count.scalar() > 0:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Bu qatorda stellajlar mavjud")
    await db.execute(
        text("DELETE FROM warehouse_rows WHERE id = :id AND organization_id = :o"),
        {"id": rid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# WAREHOUSE RACKS
# =========================================================

class WarehouseRackIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    sort_order: int = 0


@router.get(
    "/rows/{rid}/racks",
    dependencies=[Depends(require_permission("warehouse.rack.view"))],
)
async def list_warehouse_racks(
    rid: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    row = await db.execute(
        text("SELECT id FROM warehouse_rows WHERE id = :id AND organization_id = :o"),
        {"id": rid, "o": org_id},
    )
    if not row.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Qator topilmadi")
    res = await db.execute(
        text("SELECT id, row_id, name, sort_order "
             "FROM warehouse_racks "
             "WHERE row_id = :rid AND organization_id = :o "
             "ORDER BY sort_order, name"),
        {"rid": rid, "o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post(
    "/rows/{rid}/racks",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouse.rack.manage"))],
)
async def create_warehouse_rack(
    rid: int,
    p: WarehouseRackIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    row = await db.execute(
        text("SELECT id FROM warehouse_rows WHERE id = :id AND organization_id = :o"),
        {"id": rid, "o": org_id},
    )
    if not row.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Qator topilmadi")
    res = await db.execute(
        text("INSERT INTO warehouse_racks (organization_id, row_id, name, sort_order) "
             "VALUES (:o, :rid, :n, :s) RETURNING id"),
        {"o": org_id, "rid": rid, "n": p.name, "s": p.sort_order},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put(
    "/racks/{rack_id}",
    dependencies=[Depends(require_permission("warehouse.rack.manage"))],
)
async def update_warehouse_rack(
    rack_id: int,
    p: WarehouseRackIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE warehouse_racks SET name=:n, sort_order=:s "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": rack_id, "o": org_id, "n": p.name, "s": p.sort_order},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Stellaj topilmadi")
    await db.commit()
    return {"ok": True}


@router.delete(
    "/racks/{rack_id}",
    dependencies=[Depends(require_permission("warehouse.rack.manage"))],
)
async def delete_warehouse_rack(
    rack_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    rack = await db.execute(
        text("SELECT id FROM warehouse_racks WHERE id = :id AND organization_id = :o"),
        {"id": rack_id, "o": org_id},
    )
    if not rack.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Stellaj topilmadi")
    linked = await db.execute(
        text("SELECT COUNT(*) FROM products WHERE default_rack_id = :rid AND organization_id = :o"),
        {"rid": rack_id, "o": org_id},
    )
    if linked.scalar() > 0:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Bu stellajga mahsulot bog'langan")
    await db.execute(
        text("DELETE FROM warehouse_racks WHERE id = :id AND organization_id = :o"),
        {"id": rack_id, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# WAREHOUSE CELLS (lowest spatial unit under racks)
# =========================================================

class CellIn(BaseModel):
    code: str = Field(min_length=1, max_length=30)


class CellPatchIn(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    is_active: bool | None = None


@router.get(
    "/racks/{rack_id}/cells",
    dependencies=[Depends(require_permission("warehouse.cell.view"))],
)
async def list_cells(
    rack_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    rack = await db.execute(
        text("SELECT id FROM warehouse_racks WHERE id = :id AND organization_id = :o"),
        {"id": rack_id, "o": org_id},
    )
    if not rack.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Stellaj topilmadi")
    res = await db.execute(
        text("SELECT id, code, is_active FROM warehouse_cells "
             "WHERE rack_id = :rid AND organization_id = :o "
             "ORDER BY code"),
        {"rid": rack_id, "o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post(
    "/racks/{rack_id}/cells",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouse.cell.manage"))],
)
async def create_cell(
    rack_id: int,
    p: CellIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    rack = await db.execute(
        text("SELECT id FROM warehouse_racks WHERE id = :id AND organization_id = :o"),
        {"id": rack_id, "o": org_id},
    )
    if not rack.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Stellaj topilmadi")
    existing = await db.execute(
        text("SELECT id FROM warehouse_cells "
             "WHERE organization_id = :o AND rack_id = :rid AND code = :c"),
        {"o": org_id, "rid": rack_id, "c": p.code},
    )
    if existing.scalar():
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Bu kod ushbu rackda allaqachon mavjud")
    res = await db.execute(
        text("INSERT INTO warehouse_cells (organization_id, rack_id, code) "
             "VALUES (:o, :rid, :c) RETURNING id, code, is_active"),
        {"o": org_id, "rid": rack_id, "c": p.code},
    )
    await db.commit()
    row = res.first()
    return {"id": str(row.id), "code": row.code, "is_active": row.is_active}


@router.patch(
    "/racks/{rack_id}/cells/{cid}",
    dependencies=[Depends(require_permission("warehouse.cell.manage"))],
)
async def update_cell(
    rack_id: int,
    cid: UUID,
    p: CellPatchIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    cell = await db.execute(
        text("SELECT id, code, is_active FROM warehouse_cells "
             "WHERE id = :id AND organization_id = :o AND rack_id = :rid"),
        {"id": str(cid), "o": org_id, "rid": rack_id},
    )
    row = cell.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Katak topilmadi")

    new_code = p.code if p.code is not None else row.code
    new_active = p.is_active if p.is_active is not None else row.is_active

    if p.code is not None and p.code != row.code:
        conflict = await db.execute(
            text("SELECT id FROM warehouse_cells "
                 "WHERE organization_id = :o AND rack_id = :rid AND code = :c AND id != :id"),
            {"o": org_id, "rid": rack_id, "c": p.code, "id": str(cid)},
        )
        if conflict.scalar():
            raise HTTPException(status.HTTP_409_CONFLICT,
                                detail="Bu kod ushbu rackda allaqachon mavjud")

    await db.execute(
        text("UPDATE warehouse_cells SET code = :c, is_active = :a "
             "WHERE id = :id AND organization_id = :o"),
        {"c": new_code, "a": new_active, "id": str(cid), "o": org_id},
    )
    await db.commit()
    return {"id": str(cid), "code": new_code, "is_active": new_active}


@router.delete(
    "/racks/{rack_id}/cells/{cid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("warehouse.cell.manage"))],
)
async def delete_cell(
    rack_id: int,
    cid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    cell = await db.execute(
        text("SELECT id FROM warehouse_cells "
             "WHERE id = :id AND organization_id = :o AND rack_id = :rid"),
        {"id": str(cid), "o": org_id, "rid": rack_id},
    )
    if not cell.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Katak topilmadi")
    linked = await db.execute(
        text("SELECT COUNT(*) FROM products "
             "WHERE default_cell_id = :cid AND organization_id = :o"),
        {"cid": str(cid), "o": org_id},
    )
    if linked.scalar() > 0:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Bu katakka mahsulot bog'langan")
    await db.execute(
        text("UPDATE warehouse_cells SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(cid), "o": org_id},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =========================================================
# STOCK ON-HAND (real-time balances for cascade select)
# =========================================================

@router.get("/stock/on-hand", dependencies=[Depends(require_permission("warehouse.request.view"))])
async def stock_on_hand(
    warehouse_id: int = Query(...),
    product_id: UUID | None = Query(None),
    category_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """
    Returns live stock balances filtered by warehouse. When product_id is given and has
    no balance row, returns a zero-qty synthetic row (never 404).
    """
    where = "WHERE p.organization_id = :o AND sb.warehouse_id = :wh"
    params: dict = {"o": org_id, "wh": warehouse_id}
    if product_id is not None:
        where += " AND p.id = :pid"
        params["pid"] = str(product_id)
    if category_id is not None:
        where += " AND p.category_id = :cat"
        params["cat"] = category_id

    res = await db.execute(
        text(
            f"SELECT p.id AS product_id, p.name AS product_name, sb.warehouse_id, "
            f"COALESCE(sb.quantity, 0) AS qty, COALESCE(sb.avg_cost, 0) AS avg_cost, "
            f"u.short_name AS unit_name "
            f"FROM products p "
            f"LEFT JOIN stock_balances sb ON sb.product_id = p.id AND sb.warehouse_id = :wh "
            f"LEFT JOIN units u ON u.id = p.unit_id "
            f"{where} ORDER BY p.name"
        ),
        params,
    )
    rows = [dict(r._mapping) for r in res]

    # Guarantee zero-qty row when product_id specified but no balance exists
    if product_id is not None and not rows:
        pres = await db.execute(
            text(
                "SELECT p.id AS product_id, p.name AS product_name, u.short_name AS unit_name "
                "FROM products p LEFT JOIN units u ON u.id = p.unit_id "
                "WHERE p.id = :pid AND p.organization_id = :o"
            ),
            {"pid": str(product_id), "o": org_id},
        )
        pr = pres.first()
        if pr:
            rows = [{
                "product_id": str(product_id),
                "product_name": pr.product_name,
                "warehouse_id": warehouse_id,
                "qty": Decimal("0"),
                "avg_cost": Decimal("0"),
                "unit_name": pr.unit_name,
            }]
    return rows


# =========================================================
# PRODUCT REQUESTS
# =========================================================

class ProductRequestItemIn(BaseModel):
    product_id: UUID
    category_id: int | None = None
    qty_requested: Decimal = Field(gt=0)


class ProductRequestIn(BaseModel):
    from_warehouse: int
    to_warehouse: int | None = None
    notes: str | None = None
    items: list[ProductRequestItemIn] = Field(min_length=1)


@router.get("/requests", dependencies=[Depends(require_permission("warehouse.request.view"))])
async def list_product_requests(
    request_status: str | None = Query(None, alias="status"),
    from_warehouse: int | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE pr.organization_id = :o"
    params: dict = {"o": org_id, "lim": limit, "off": (page - 1) * limit}
    if request_status:
        where += " AND pr.status = :st"
        params["st"] = request_status
    if from_warehouse is not None:
        where += " AND pr.from_warehouse = :fw"
        params["fw"] = from_warehouse

    count_res = await db.execute(
        text(f"SELECT COUNT(*) FROM product_requests pr {where}"), params
    )
    total = count_res.scalar() or 0

    res = await db.execute(
        text(
            f"SELECT pr.id, pr.doc_number, pr.from_warehouse, fw.name AS from_name, "
            f"pr.to_warehouse, tw.name AS to_name, pr.status, "
            f"(SELECT COUNT(*) FROM product_request_items WHERE request_id = pr.id) AS item_count, "
            f"u.full_name AS requested_by_name, pr.created_at "
            f"FROM product_requests pr "
            f"LEFT JOIN warehouses fw ON fw.id = pr.from_warehouse "
            f"LEFT JOIN warehouses tw ON tw.id = pr.to_warehouse "
            f"LEFT JOIN users u ON u.id = pr.requested_by "
            f"{where} ORDER BY pr.created_at DESC LIMIT :lim OFFSET :off"
        ),
        params,
    )
    return {
        "items": [dict(r._mapping) for r in res],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/requests/{rid}", dependencies=[Depends(require_permission("warehouse.request.view"))])
async def get_product_request(
    rid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text(
            "SELECT pr.id, pr.doc_number, pr.from_warehouse, fw.name AS from_name, "
            "pr.to_warehouse, tw.name AS to_name, pr.status, pr.notes, pr.created_at, "
            "u.full_name AS requested_by_name "
            "FROM product_requests pr "
            "LEFT JOIN warehouses fw ON fw.id = pr.from_warehouse "
            "LEFT JOIN warehouses tw ON tw.id = pr.to_warehouse "
            "LEFT JOIN users u ON u.id = pr.requested_by "
            "WHERE pr.id = :id AND pr.organization_id = :o"
        ),
        {"id": str(rid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items = await db.execute(
        text(
            "SELECT pri.product_id, p.name AS product_name, "
            "pri.category_id, cat.name AS category_name, "
            "pri.qty_requested, pri.qty_on_hand, "
            "u.short_name AS unit_name "
            "FROM product_request_items pri "
            "LEFT JOIN products p ON p.id = pri.product_id "
            "LEFT JOIN product_categories cat ON cat.id = pri.category_id "
            "LEFT JOIN units u ON u.id = p.unit_id "
            "WHERE pri.request_id = :id"
        ),
        {"id": str(rid)},
    )
    return {**dict(h._mapping), "items": [dict(r._mapping) for r in items]}


@router.post("/requests", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("warehouse.request.create"))])
async def create_product_request(
    p: ProductRequestIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    if not p.items:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="items bo'sh bo'lishi mumkin emas")

    req_product_ids = [str(it.product_id) for it in p.items]
    valid_prods = await db.execute(
        text("SELECT id FROM products WHERE organization_id = :o AND id = ANY(:ids)"),
        {"o": org_id, "ids": req_product_ids},
    )
    valid_prod_ids = {str(r[0]) for r in valid_prods}
    missing_prods = set(req_product_ids) - valid_prod_ids
    if missing_prods:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"Mahsulot topilmadi: {missing_prods}")

    rid = uuid4()
    doc_number = await _next_doc_number(db, org_id, "request", "REQ")

    await db.execute(
        text(
            "INSERT INTO product_requests "
            "(id, organization_id, doc_number, from_warehouse, to_warehouse, notes, requested_by) "
            "VALUES (:id, :o, :dn, :fw, :tw, :n, :u)"
        ),
        {"id": str(rid), "o": org_id, "dn": doc_number,
         "fw": p.from_warehouse, "tw": p.to_warehouse, "n": p.notes, "u": user_id},
    )

    for it in p.items:
        on_hand = await _stock_qty(db, p.from_warehouse, str(it.product_id))
        if it.qty_requested > on_hand:
            # Rollback by raising — the transaction will be rolled back by FastAPI exception handler
            pname_res = await db.execute(
                text("SELECT name FROM products WHERE id = :id AND organization_id = :o"),
                {"id": str(it.product_id), "o": org_id},
            )
            pname = pname_res.scalar() or str(it.product_id)
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{pname}: mavjud {on_hand}, so'rov {it.qty_requested}",
            )
        await db.execute(
            text(
                "INSERT INTO product_request_items "
                "(request_id, product_id, category_id, qty_requested, qty_on_hand) "
                "VALUES (:r, :p, :c, :q, :qoh)"
            ),
            {"r": str(rid), "p": str(it.product_id), "c": it.category_id,
             "q": it.qty_requested, "qoh": on_hand},
        )

    await db.commit()
    return {"id": str(rid), "doc_number": doc_number}


@router.post("/requests/{rid}/approve",
             dependencies=[Depends(require_permission("warehouse.request.approve"))])
async def approve_product_request(
    rid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await db.execute(
        text("SELECT id, status FROM product_requests "
             "WHERE id = :id AND organization_id = :o FOR UPDATE"),
        {"id": str(rid), "o": org_id},
    )
    r = row.first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if r.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Faqat pending holat tasdiqlash mumkin")
    await db.execute(
        text("UPDATE product_requests SET status='approved', approved_by=:u, updated_at=NOW() "
             "WHERE id = :id"),
        {"u": user_id, "id": str(rid)},
    )
    await db.commit()
    return {"ok": True}


@router.post("/requests/{rid}/reject",
             dependencies=[Depends(require_permission("warehouse.request.approve"))])
async def reject_product_request(
    rid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    row = await db.execute(
        text("SELECT id, status FROM product_requests "
             "WHERE id = :id AND organization_id = :o FOR UPDATE"),
        {"id": str(rid), "o": org_id},
    )
    r = row.first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if r.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Faqat pending holat rad etish mumkin")
    await db.execute(
        text("UPDATE product_requests SET status='rejected', approved_by=:u, updated_at=NOW() "
             "WHERE id = :id"),
        {"u": user_id, "id": str(rid)},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# EXCEL IMPORT / EXPORT (T-006)
# =========================================================

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get(
    "/products/import/template",
    dependencies=[Depends(require_permission("warehouse.product.export"))],
)
async def download_import_template():
    """Return blank .xlsx template with column headers."""
    data = build_import_template()
    return Response(
        content=data,
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": "attachment; filename=import-template.xlsx"},
    )


@router.post(
    "/products/import",
    dependencies=[Depends(require_permission("warehouse.product.import"))],
)
async def import_products(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Faqat .xlsx format qabul qilinadi",
        )

    content = await file.read()
    try:
        rows = parse_import_file(content)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))

    created = 0
    updated = 0
    skipped = 0
    errors: list[dict] = []

    for row in rows:
        row_num = row["_row"]
        try:
            name = row["name"]
            if not name:
                errors.append({"row": row_num, "message": "name (Nomi) majburiy"})
                continue

            purchase_price = _to_decimal(row["purchase_price"], "purchase_price")
            sale_price = _to_decimal(row["sale_price"], "sale_price")
            opening_qty = _to_decimal(row["opening_qty"], "opening_qty")
            opening_cost = _to_decimal(row["opening_cost"], "opening_cost")

            # Category: match by name within org, create if missing
            category_id = None
            if row["category"]:
                cat_res = await db.execute(
                    text(
                        "SELECT id FROM product_categories "
                        "WHERE organization_id = :o AND name = :n"
                    ),
                    {"o": org_id, "n": row["category"]},
                )
                cat_id = cat_res.scalar()
                if cat_id:
                    category_id = cat_id
                else:
                    ins = await db.execute(
                        text(
                            "INSERT INTO product_categories (organization_id, name) "
                            "VALUES (:o, :n) RETURNING id"
                        ),
                        {"o": org_id, "n": row["category"]},
                    )
                    category_id = ins.scalar()

            # Unit: match by short_name within org (units table, not product_units)
            unit_id = None
            if row["unit"]:
                unit_res = await db.execute(
                    text(
                        "SELECT id FROM units "
                        "WHERE organization_id = :o AND short_name = :n"
                    ),
                    {"o": org_id, "n": row["unit"]},
                )
                unit_id = unit_res.scalar()

            sku = row["sku"] or None
            barcode = row["barcode"] or None
            product_type = row["product_type"] or None

            # Upsert product on (organization_id, name)
            existing = await db.execute(
                text(
                    "SELECT id FROM products "
                    "WHERE organization_id = :o AND name = :n"
                ),
                {"o": org_id, "n": name},
            )
            pid_val = existing.scalar()

            if pid_val:
                await db.execute(
                    text(
                        "UPDATE products SET "
                        "sku = COALESCE(:sku, sku), "
                        "barcode = COALESCE(:bc, barcode), "
                        "category_id = COALESCE(:cat, category_id), "
                        "unit_id = COALESCE(:u, unit_id), "
                        "purchase_price = :pp, "
                        "sale_price = :sp, "
                        "product_type = COALESCE(:pt, product_type) "
                        "WHERE id = :id AND organization_id = :o"
                    ),
                    {
                        "id": pid_val, "o": org_id,
                        "sku": sku, "bc": barcode, "cat": category_id, "u": unit_id,
                        "pp": purchase_price, "sp": sale_price, "pt": product_type,
                    },
                )
                pid = pid_val
                updated += 1
            else:
                new_pid = str(uuid4())
                await db.execute(
                    text(
                        "INSERT INTO products "
                        "(id, organization_id, name, sku, barcode, category_id, unit_id, "
                        " purchase_price, sale_price, product_type, kind) "
                        "VALUES (:id, :o, :n, :sku, :bc, :cat, :u, :pp, :sp, :pt, 'good')"
                    ),
                    {
                        "id": new_pid, "o": org_id, "n": name,
                        "sku": sku, "bc": barcode, "cat": category_id, "u": unit_id,
                        "pp": purchase_price, "sp": sale_price, "pt": product_type,
                    },
                )
                pid = new_pid
                created += 1

            # Rack resolution — silent skip if rack not found
            if row["rack_name"]:
                rack_res = await db.execute(
                    text(
                        "SELECT wr.id FROM warehouse_racks wr "
                        "WHERE wr.organization_id = :o AND wr.name = :n LIMIT 1"
                    ),
                    {"o": org_id, "n": row["rack_name"]},
                )
                rack_id = rack_res.scalar()
                if rack_id:
                    await db.execute(
                        text("UPDATE products SET default_rack_id = :rid WHERE id = :pid"),
                        {"rid": rack_id, "pid": pid},
                    )

            # Opening balance — only if warehouse exists and current stock is 0
            if row["warehouse_name"] and opening_qty > 0:
                wh_res = await db.execute(
                    text(
                        "SELECT id FROM warehouses "
                        "WHERE organization_id = :o AND name = :n AND is_active = TRUE"
                    ),
                    {"o": org_id, "n": row["warehouse_name"]},
                )
                wh_id = wh_res.scalar()
                if wh_id:
                    current_qty = await _stock_qty(db, wh_id, str(pid))
                    if current_qty == 0:
                        cost = opening_cost if opening_cost > 0 else purchase_price
                        await _stock_apply(
                            db, wh_id, str(pid), opening_qty, cost or None,
                            org_id=org_id, operation_type="opening_balance",
                            source_type="import",
                        )
                    else:
                        skipped += 1

            await db.commit()

        except ValueError as exc:
            await db.rollback()
            errors.append({"row": row_num, "message": str(exc)})
        except SQLAlchemyError:
            await db.rollback()
            errors.append({"row": row_num, "message": "Bazaga yozishda xatolik"})
        except Exception as exc:
            await db.rollback()
            errors.append({"row": row_num, "message": str(exc)[:200]})

    return {"created": created, "updated": updated, "skipped": skipped, "errors": errors}


@router.get(
    "/products/export",
    dependencies=[Depends(require_permission("warehouse.product.export"))],
)
async def export_products(
    warehouse_id: int | None = Query(None),
    category_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    today = date.today().isoformat()

    where_parts = [
        "p.organization_id = :o",
        "sb.quantity > 0",
    ]
    params: dict = {"o": org_id}

    if warehouse_id is not None:
        where_parts.append("sb.warehouse_id = :wh")
        params["wh"] = warehouse_id

    if category_id is not None:
        where_parts.append("p.category_id = :cat")
        params["cat"] = category_id

    where_sql = " AND ".join(where_parts)

    res = await db.execute(
        text(
            "SELECT p.name, p.sku, p.barcode, "
            "cat.name AS category_name, p.product_type, "
            "un.short_name AS unit_name, "
            "p.purchase_price, p.sale_price, "
            "w.name AS warehouse_name, sb.quantity AS qty, sb.avg_cost, "
            "rack.name AS rack_name "
            "FROM stock_balances sb "
            "JOIN products p ON p.id = sb.product_id "
            "JOIN warehouses w ON w.id = sb.warehouse_id "
            "LEFT JOIN product_categories cat ON cat.id = p.category_id "
            "LEFT JOIN units un ON un.id = p.unit_id "
            "LEFT JOIN warehouse_racks rack ON rack.id = p.default_rack_id "
            f"WHERE {where_sql} "
            "ORDER BY p.name, w.name"
        ),
        params,
    )
    export_rows = [dict(r._mapping) for r in res]

    data = build_export_workbook(export_rows)
    return Response(
        content=data,
        media_type=_XLSX_MIME,
        headers={
            "Content-Disposition": f'attachment; filename="products-export-{today}.xlsx"'
        },
    )


# =========================================================
# STOCK MOVEMENTS JOURNAL — T-200
# =========================================================

_VALID_OPERATION_TYPES = frozenset({
    "sale", "sale_return", "supply", "supply_return",
    "transfer_out", "transfer_in", "write_off", "posting",
    "inventory_adjust", "opening_balance", "manufacturing_in",
    "manufacturing_out", "manual",
    "oprihodovanie",
    "purchase_return", "purchase_return_cancel",
})


@router.get(
    "/movements",
    dependencies=[Depends(require_permission("warehouse.movements.view"))],
)
async def list_stock_movements(
    warehouse_id: int | None = Query(None),
    product_id: UUID | None = Query(None),
    operation_type: str | None = Query(None),
    source_type: str | None = Query(None),
    source_id: UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if operation_type and operation_type not in _VALID_OPERATION_TYPES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid operation_type. Allowed: {sorted(_VALID_OPERATION_TYPES)}",
        )

    where_parts = ["sm.organization_id = :o"]
    params: dict = {"o": org_id, "lim": limit, "off": (page - 1) * limit}

    if warehouse_id is not None:
        where_parts.append("sm.warehouse_id = :wh")
        params["wh"] = warehouse_id

    if product_id is not None:
        where_parts.append("sm.product_id = :pid")
        params["pid"] = str(product_id)

    if operation_type is not None:
        where_parts.append("sm.operation_type = :ot")
        params["ot"] = operation_type

    if source_type is not None:
        where_parts.append("sm.source_type = :st")
        params["st"] = source_type

    if source_id is not None:
        where_parts.append("sm.source_id = :sid")
        params["sid"] = str(source_id)

    if date_from is not None:
        where_parts.append("sm.created_at >= :df")
        params["df"] = date_from

    if date_to is not None:
        where_parts.append("sm.created_at < (:dt::date + INTERVAL '1 day')")
        params["dt"] = date_to

    where_sql = " AND ".join(where_parts)

    count_res = await db.execute(
        text(f"SELECT COUNT(*) FROM stock_movements sm WHERE {where_sql}"),
        params,
    )
    total: int = count_res.scalar() or 0

    rows_res = await db.execute(
        text(
            f"SELECT sm.id, sm.organization_id, sm.warehouse_id, "
            f"w.name AS warehouse_name, "
            f"sm.product_id, p.name AS product_name, "
            f"sm.before_qty, sm.change_qty, sm.after_qty, sm.unit_cost, "
            f"sm.operation_type, sm.source_type, sm.source_id, "
            f"sm.correlation_id, sm.user_id, "
            f"COALESCE(u.full_name, u.username) AS user_name, "
            f"sm.notes, sm.created_at "
            f"FROM stock_movements sm "
            f"LEFT JOIN warehouses w ON w.id = sm.warehouse_id "
            f"LEFT JOIN products p ON p.id = sm.product_id "
            f"LEFT JOIN users u ON u.id = sm.user_id "
            f"WHERE {where_sql} "
            f"ORDER BY sm.created_at DESC "
            f"LIMIT :lim OFFSET :off"
        ),
        params,
    )

    items = []
    for r in rows_res:
        m = dict(r._mapping)
        for f in ("organization_id", "product_id", "source_id", "correlation_id", "user_id"):
            if m.get(f) is not None:
                m[f] = str(m[f])
        for f in ("before_qty", "change_qty", "after_qty"):
            if m.get(f) is not None:
                m[f] = str(m[f])
        if m.get("unit_cost") is not None:
            m["unit_cost"] = str(m["unit_cost"])
        if m.get("created_at") is not None:
            m["created_at"] = m["created_at"].isoformat()
        items.append(m)

    return {"total": total, "page": page, "limit": limit, "items": items}


# =========================================================
# BOM (Bill of Materials) — T-022
# =========================================================

class BOMItemIn(BaseModel):
    component_product_id: UUID
    quantity: Decimal = Field(gt=0)
    unit_id: int | None = None
    notes: str | None = None


class BOMItemPatchIn(BaseModel):
    quantity: Decimal | None = Field(default=None, gt=0)
    unit_id: int | None = None
    notes: str | None = None


async def _get_bom_row(db: AsyncSession, bom_id: int, org_id: str) -> dict:
    res = await db.execute(
        text(
            "SELECT b.id, b.component_product_id, p.name AS component_name, "
            "b.quantity, b.unit_id, u.short_name AS unit_name, b.notes "
            "FROM product_bom b "
            "JOIN products p ON p.id = b.component_product_id "
            "LEFT JOIN units u ON u.id = b.unit_id "
            "WHERE b.id = :bid AND b.organization_id = :o"
        ),
        {"bid": bom_id, "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")
    return dict(row._mapping)


@router.get(
    "/products/{pid}/bom",
    dependencies=[Depends(require_permission("warehouse.bom.view"))],
)
async def list_bom(
    pid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    parent_res = await db.execute(
        text("SELECT id FROM products WHERE id = :pid AND organization_id = :o"),
        {"pid": str(pid), "o": org_id},
    )
    if not parent_res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")

    res = await db.execute(
        text(
            "SELECT b.id, b.component_product_id, p.name AS component_name, "
            "b.quantity, b.unit_id, u.short_name AS unit_name, b.notes "
            "FROM product_bom b "
            "JOIN products p ON p.id = b.component_product_id "
            "LEFT JOIN units u ON u.id = b.unit_id "
            "WHERE b.parent_product_id = :pid AND b.organization_id = :o "
            "ORDER BY b.id"
        ),
        {"pid": str(pid), "o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post(
    "/products/{pid}/bom",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouse.bom.manage"))],
)
async def add_bom_component(
    pid: UUID,
    body: BOMItemIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    # Verify parent product belongs to org
    parent_res = await db.execute(
        text("SELECT id FROM products WHERE id = :pid AND organization_id = :o"),
        {"pid": str(pid), "o": org_id},
    )
    if not parent_res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")

    # Verify component product belongs to org
    comp_res = await db.execute(
        text("SELECT id FROM products WHERE id = :cid AND organization_id = :o"),
        {"cid": str(body.component_product_id), "o": org_id},
    )
    if not comp_res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")

    await _bom_check_cycle(db, org_id, str(pid), str(body.component_product_id))

    try:
        res = await db.execute(
            text(
                "INSERT INTO product_bom "
                "(organization_id, parent_product_id, component_product_id, quantity, unit_id, notes) "
                "VALUES (:o, :par, :comp, :qty, :unit, :notes) RETURNING id"
            ),
            {
                "o": org_id,
                "par": str(pid),
                "comp": str(body.component_product_id),
                "qty": body.quantity,
                "unit": body.unit_id,
                "notes": body.notes,
            },
        )
        new_id = res.scalar()
        await db.commit()
    except Exception as exc:
        await db.rollback()
        err = str(exc)
        if "unique" in err.lower() or "duplicate" in err.lower():
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Bu komponent allaqachon mavjud")
        raise

    return await _get_bom_row(db, new_id, org_id)


@router.patch(
    "/products/{pid}/bom/{bom_id}",
    dependencies=[Depends(require_permission("warehouse.bom.manage"))],
)
async def update_bom_component(
    pid: UUID,
    bom_id: int,
    body: BOMItemPatchIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    existing = await db.execute(
        text(
            "SELECT id, quantity, unit_id, notes FROM product_bom "
            "WHERE id = :bid AND parent_product_id = :pid AND organization_id = :o"
        ),
        {"bid": bom_id, "pid": str(pid), "o": org_id},
    )
    row = existing.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")

    new_qty = body.quantity if body.quantity is not None else row.quantity
    new_unit = body.unit_id if body.unit_id is not None else row.unit_id
    new_notes = body.notes if body.notes is not None else row.notes

    await db.execute(
        text(
            "UPDATE product_bom SET quantity=:qty, unit_id=:unit, notes=:notes "
            "WHERE id = :bid AND organization_id = :o"
        ),
        {"qty": new_qty, "unit": new_unit, "notes": new_notes, "bid": bom_id, "o": org_id},
    )
    await db.commit()
    return await _get_bom_row(db, bom_id, org_id)


@router.delete(
    "/products/{pid}/bom/{bom_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("warehouse.bom.manage"))],
)
async def delete_bom_component(
    pid: UUID,
    bom_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(
            "DELETE FROM product_bom "
            "WHERE id = :bid AND parent_product_id = :pid AND organization_id = :o RETURNING id"
        ),
        {"bid": bom_id, "pid": str(pid), "o": org_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =========================================================
# PRODUCT BARCODES (T-203)
# =========================================================

class BarcodeIn(BaseModel):
    barcode: str = Field(min_length=1, max_length=64)
    is_primary: bool = False
    notes: str | None = None


async def _assert_product_in_org(db: AsyncSession, pid: str, org_id: str) -> None:
    res = await db.execute(
        text("SELECT id FROM products WHERE id = :pid AND organization_id = :o"),
        {"pid": pid, "o": org_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")


@router.get(
    "/products/{pid}/barcodes",
    dependencies=[Depends(require_permission("warehouse.product.barcode_view"))],
)
async def list_product_barcodes(
    pid: UUID,
    is_active: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await _assert_product_in_org(db, str(pid), org_id)
    where = "WHERE pb.product_id = :pid AND pb.organization_id = :o"
    params: dict = {"pid": str(pid), "o": org_id}
    if is_active is not None:
        where += " AND pb.is_active = :active"
        params["active"] = is_active
    res = await db.execute(
        text(
            "SELECT pb.id, pb.barcode, pb.is_primary, pb.is_active, "
            "pb.created_at, pb.created_by, pb.deactivated_at, pb.deactivated_by, pb.notes "
            f"FROM product_barcodes pb {where} ORDER BY pb.is_primary DESC, pb.created_at"
        ),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post(
    "/products/{pid}/barcodes",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouse.product.barcode_manage"))],
)
async def add_product_barcode(
    pid: UUID,
    p: BarcodeIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    await _assert_product_in_org(db, str(pid), org_id)

    dup = await db.execute(
        text(
            "SELECT id FROM product_barcodes "
            "WHERE organization_id = :o AND barcode = :bc AND is_active = TRUE"
        ),
        {"o": org_id, "bc": p.barcode},
    )
    if dup.scalar():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"{p.barcode!r} barcode ushbu tashkilotda allaqachon faol",
        )

    if p.is_primary:
        await db.execute(
            text(
                "UPDATE product_barcodes SET is_primary = FALSE "
                "WHERE product_id = :pid AND is_primary = TRUE AND is_active = TRUE"
            ),
            {"pid": str(pid)},
        )

    res = await db.execute(
        text(
            "INSERT INTO product_barcodes "
            "(organization_id, product_id, barcode, is_primary, is_active, created_by, notes) "
            "VALUES (:o, :pid, :bc, :ip, TRUE, :u, :notes) RETURNING id"
        ),
        {
            "o": org_id, "pid": str(pid), "bc": p.barcode,
            "ip": p.is_primary, "u": user_id, "notes": p.notes,
        },
    )
    new_id = res.scalar()
    await db.commit()
    return {"id": new_id}


@router.post(
    "/products/{pid}/barcodes/{bid}/deactivate",
    dependencies=[Depends(require_permission("warehouse.product.barcode_manage"))],
)
async def deactivate_product_barcode(
    pid: UUID,
    bid: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    await _assert_product_in_org(db, str(pid), org_id)
    res = await db.execute(
        text(
            "UPDATE product_barcodes "
            "SET is_active = FALSE, is_primary = FALSE, "
            "deactivated_at = NOW(), deactivated_by = :u "
            "WHERE id = :bid AND product_id = :pid AND organization_id = :o "
            "AND is_active = TRUE RETURNING id"
        ),
        {"bid": bid, "pid": str(pid), "o": org_id, "u": user_id},
    )
    if not res.scalar():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Barcode topilmadi yoki allaqachon deaktivatsiya qilingan",
        )
    await db.commit()
    return {"ok": True}


@router.post(
    "/products/{pid}/barcodes/{bid}/reactivate",
    dependencies=[Depends(require_permission("warehouse.product.barcode_manage"))],
)
async def reactivate_product_barcode(
    pid: UUID,
    bid: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await _assert_product_in_org(db, str(pid), org_id)

    row = await db.execute(
        text(
            "SELECT barcode FROM product_barcodes "
            "WHERE id = :bid AND product_id = :pid AND organization_id = :o AND is_active = FALSE"
        ),
        {"bid": bid, "pid": str(pid), "o": org_id},
    )
    bc_row = row.first()
    if not bc_row:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Barcode topilmadi yoki allaqachon faol",
        )

    conflict = await db.execute(
        text(
            "SELECT id FROM product_barcodes "
            "WHERE organization_id = :o AND barcode = :bc AND is_active = TRUE"
        ),
        {"o": org_id, "bc": bc_row.barcode},
    )
    if conflict.scalar():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"{bc_row.barcode!r} boshqa mahsulotda allaqachon faol",
        )

    await db.execute(
        text(
            "UPDATE product_barcodes "
            "SET is_active = TRUE, deactivated_at = NULL, deactivated_by = NULL "
            "WHERE id = :bid AND product_id = :pid AND organization_id = :o"
        ),
        {"bid": bid, "pid": str(pid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.post(
    "/products/{pid}/barcodes/{bid}/set-primary",
    dependencies=[Depends(require_permission("warehouse.product.barcode_manage"))],
)
async def set_primary_barcode(
    pid: UUID,
    bid: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await _assert_product_in_org(db, str(pid), org_id)

    check = await db.execute(
        text(
            "SELECT id FROM product_barcodes "
            "WHERE id = :bid AND product_id = :pid AND organization_id = :o AND is_active = TRUE"
        ),
        {"bid": bid, "pid": str(pid), "o": org_id},
    )
    if not check.scalar():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Barcode topilmadi yoki faol emas",
        )

    await db.execute(
        text(
            "UPDATE product_barcodes SET is_primary = FALSE "
            "WHERE product_id = :pid AND is_primary = TRUE AND is_active = TRUE"
        ),
        {"pid": str(pid)},
    )
    await db.execute(
        text("UPDATE product_barcodes SET is_primary = TRUE WHERE id = :bid"),
        {"bid": bid},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# BARCODE LOOKUP (POS)
# =========================================================

@router.get(
    "/barcode-lookup",
    dependencies=[Depends(require_permission("warehouse.product.barcode_view"))],
)
async def barcode_lookup(
    q: str = Query(..., min_length=1, description="Barcode qiymati"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(
            "SELECT p.id, p.name, p.sku, p.barcode, p.sale_price, p.purchase_price, "
            "p.unit_id, u.name AS unit_name "
            "FROM products p "
            "JOIN product_barcodes pb ON pb.product_id = p.id "
            "LEFT JOIN units u ON u.id = p.unit_id "
            "WHERE pb.barcode = :bc AND pb.is_active = TRUE AND pb.organization_id = :o "
            "AND p.is_active = TRUE LIMIT 1"
        ),
        {"bc": q, "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mahsulot topilmadi")
    return dict(row._mapping)


# =========================================================
# STOCK-INS (oprihodovanie — kirim tuzatish)
# T-210: separate table, positive delta, status machine
# Permission: warehouse.manage_stock_ins (manager + admin)
# =========================================================

class StockInItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(gt=0)
    unit_cost: Decimal | None = None


class StockInIn(BaseModel):
    warehouse_id: int
    reason: str | None = None
    notes: str | None = None
    items: list[StockInItemIn] = Field(min_length=1)


class StockInPatchIn(BaseModel):
    warehouse_id: int | None = None
    reason: str | None = None
    notes: str | None = None
    items: list[StockInItemIn] | None = None


@router.get(
    "/stock-ins",
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def list_stock_ins(
    warehouse_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where_parts = ["si.organization_id = :o"]
    params: dict = {"o": org_id, "limit": limit, "offset": (page - 1) * limit}
    if warehouse_id is not None:
        where_parts.append("si.warehouse_id = :w")
        params["w"] = warehouse_id
    if status_filter is not None:
        where_parts.append("si.status = :s")
        params["s"] = status_filter
    if date_from is not None:
        where_parts.append("si.created_at >= :df")
        params["df"] = date_from
    if date_to is not None:
        where_parts.append("si.created_at < (:dt::date + INTERVAL '1 day')")
        params["dt"] = date_to
    where_sql = " AND ".join(where_parts)
    count_res = await db.execute(
        text(f"SELECT COUNT(*) FROM stock_ins si WHERE {where_sql}"),
        params,
    )
    total = count_res.scalar()
    res = await db.execute(
        text(
            f"SELECT si.id, si.doc_number, si.warehouse_id, w.name AS warehouse_name, "
            f"si.reason, si.status, si.created_at, si.confirmed_at, "
            f"COALESCE((SELECT SUM(sii.quantity * COALESCE(sii.unit_cost, 0)) "
            f"          FROM stock_in_items sii WHERE sii.stock_in_id = si.id), 0) AS total_amount "
            f"FROM stock_ins si "
            f"LEFT JOIN warehouses w ON w.id = si.warehouse_id "
            f"WHERE {where_sql} "
            f"ORDER BY si.created_at DESC "
            f"LIMIT :limit OFFSET :offset"
        ),
        params,
    )
    return {
        "items": [dict(r._mapping) for r in res],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/stock-ins",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def create_stock_in(
    p: StockInIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    wh_check = await db.execute(
        text("SELECT id FROM warehouses WHERE id = :w AND organization_id = :o AND is_active = TRUE"),
        {"w": p.warehouse_id, "o": org_id},
    )
    if not wh_check.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ombor topilmadi")

    doc_number = await _next_doc_number(db, org_id, "stock_in", "SI")
    sid = uuid4()
    await db.execute(
        text(
            "INSERT INTO stock_ins "
            "(id, organization_id, doc_number, warehouse_id, reason, notes, status, created_by) "
            "VALUES (:id, :o, :dn, :w, :r, :n, 'draft', :u)"
        ),
        {
            "id": str(sid), "o": org_id, "dn": doc_number,
            "w": p.warehouse_id, "r": p.reason, "n": p.notes, "u": user_id,
        },
    )
    for it in p.items:
        await db.execute(
            text(
                "INSERT INTO stock_in_items (stock_in_id, product_id, quantity, unit_cost) "
                "VALUES (:si, :p, :q, :c)"
            ),
            {
                "si": str(sid), "p": str(it.product_id),
                "q": it.quantity,
                "c": it.unit_cost if it.unit_cost is not None else Decimal("0"),
            },
        )
    await db.commit()
    return {"id": str(sid), "doc_number": doc_number}


@router.get(
    "/stock-ins/{sid}",
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def get_stock_in(
    sid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text(
            "SELECT si.*, w.name AS warehouse_name "
            "FROM stock_ins si "
            "LEFT JOIN warehouses w ON w.id = si.warehouse_id "
            "WHERE si.id = :id AND si.organization_id = :o"
        ),
        {"id": str(sid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items = await db.execute(
        text(
            "SELECT sii.id, sii.product_id, p.name AS product_name, "
            "sii.quantity, sii.unit_cost, sii.amount "
            "FROM stock_in_items sii "
            "LEFT JOIN products p ON p.id = sii.product_id "
            "WHERE sii.stock_in_id = :id"
        ),
        {"id": str(sid)},
    )
    return {"head": dict(h._mapping), "items": [dict(r._mapping) for r in items]}


@router.patch(
    "/stock-ins/{sid}",
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def patch_stock_in(
    sid: UUID,
    p: StockInPatchIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    check = await db.execute(
        text("SELECT status FROM stock_ins WHERE id = :id AND organization_id = :o"),
        {"id": str(sid), "o": org_id},
    )
    row = check.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status != "draft":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Faqat 'draft' holati tahrirlash mumkin",
        )
    if p.warehouse_id is not None or p.reason is not None or p.notes is not None:
        await db.execute(
            text(
                "UPDATE stock_ins SET "
                "warehouse_id = COALESCE(:w, warehouse_id), "
                "reason = COALESCE(:r, reason), "
                "notes = COALESCE(:n, notes) "
                "WHERE id = :id AND organization_id = :o"
            ),
            {"w": p.warehouse_id, "r": p.reason, "n": p.notes, "id": str(sid), "o": org_id},
        )
    if p.items is not None:
        await db.execute(
            text("DELETE FROM stock_in_items WHERE stock_in_id = :id"),
            {"id": str(sid)},
        )
        for it in p.items:
            await db.execute(
                text(
                    "INSERT INTO stock_in_items (stock_in_id, product_id, quantity, unit_cost) "
                    "VALUES (:si, :p, :q, :c)"
                ),
                {
                    "si": str(sid), "p": str(it.product_id),
                    "q": it.quantity,
                    "c": it.unit_cost if it.unit_cost is not None else Decimal("0"),
                },
            )
    await db.commit()
    return {"ok": True}


@router.post(
    "/stock-ins/{sid}/confirm",
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def confirm_stock_in(
    sid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    head = await db.execute(
        text(
            "SELECT id, status, warehouse_id FROM stock_ins "
            "WHERE id = :id AND organization_id = :o FOR UPDATE"
        ),
        {"id": str(sid), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status != "draft":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Faqat 'draft' holati tasdiqlanishi mumkin",
        )

    items = await db.execute(
        text(
            "SELECT sii.product_id, sii.quantity, sii.unit_cost "
            "FROM stock_in_items sii "
            "WHERE sii.stock_in_id = :id"
        ),
        {"id": str(sid)},
    )
    item_rows = items.fetchall()
    if not item_rows:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Kirim hujjati bo'sh — mahsulot qo'shing",
        )

    correlation_id = str(uuid4())
    for it in item_rows:
        await _stock_apply(
            db,
            row.warehouse_id,
            str(it.product_id),
            Decimal(str(it.quantity)),
            Decimal(str(it.unit_cost)) if it.unit_cost else None,
            allow_negative=True,
            org_id=org_id,
            operation_type="oprihodovanie",
            source_type="stock_in",
            source_id=str(sid),
            correlation_id=correlation_id,
            user_id=user_id,
        )

    await db.execute(
        text(
            "UPDATE stock_ins SET status = 'confirmed', confirmed_at = NOW(), confirmed_by = :u "
            "WHERE id = :id"
        ),
        {"u": user_id, "id": str(sid)},
    )
    await db.commit()
    return {"ok": True}


@router.post(
    "/stock-ins/{sid}/cancel",
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def cancel_stock_in(
    sid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    head = await db.execute(
        text(
            "SELECT id, status, warehouse_id FROM stock_ins "
            "WHERE id = :id AND organization_id = :o FOR UPDATE"
        ),
        {"id": str(sid), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status == "cancelled":
        return {"ok": True}
    if row.status == "confirmed":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tasdiqlangan kirim hujjatini bekor qilib bo'lmaydi",
        )
    await db.execute(
        text("UPDATE stock_ins SET status = 'cancelled' WHERE id = :id"),
        {"id": str(sid)},
    )
    await db.commit()
    return {"ok": True}


@router.delete(
    "/stock-ins/{sid}",
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def delete_stock_in(
    sid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    check = await db.execute(
        text("SELECT status FROM stock_ins WHERE id = :id AND organization_id = :o"),
        {"id": str(sid), "o": org_id},
    )
    row = check.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status != "draft":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Faqat 'draft' holati o'chirilishi mumkin",
        )
    await db.execute(
        text("DELETE FROM stock_ins WHERE id = :id AND organization_id = :o"),
        {"id": str(sid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}

# =========================================================
# SUPPLIER RETURNS — T-202
# =========================================================

class SupplierReturnItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(gt=0)
    unit_cost: Decimal | None = None
    notes: str | None = None


class SupplierReturnIn(BaseModel):
    supplier_id: UUID
    warehouse_id: int
    original_purchase_id: UUID | None = None
    reason: str | None = Field(None, max_length=500)
    notes: str | None = None
    refund_method: str | None = Field(None, pattern=r"^(cash_refund|supplier_balance|replacement)$")
    items: list[SupplierReturnItemIn] = Field(min_length=1)


class SupplierReturnPatchIn(BaseModel):
    reason: str | None = Field(None, max_length=500)
    notes: str | None = None
    refund_method: str | None = Field(None, pattern=r"^(cash_refund|supplier_balance|replacement)$")


@router.get(
    "/supplier-returns",
    dependencies=[Depends(require_permission("supplier.return.view"))],
)
async def list_supplier_returns(
    supplier_id: UUID | None = Query(None),
    warehouse_id: int | None = Query(None),
    return_status: str | None = Query(None, alias="status"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where_parts = ["sr.organization_id = :o"]
    params: dict = {"o": org_id, "lim": limit, "off": (page - 1) * limit}

    if supplier_id is not None:
        where_parts.append("sr.supplier_id = :sid")
        params["sid"] = str(supplier_id)
    if warehouse_id is not None:
        where_parts.append("sr.warehouse_id = :wid")
        params["wid"] = warehouse_id
    if return_status is not None:
        where_parts.append("sr.status = :st")
        params["st"] = return_status
    if date_from is not None:
        where_parts.append("sr.created_at >= :df")
        params["df"] = date_from
    if date_to is not None:
        where_parts.append("sr.created_at < (:dt::date + INTERVAL '1 day')")
        params["dt"] = date_to

    where_sql = " AND ".join(where_parts)

    count_res = await db.execute(
        text(f"SELECT COUNT(*) FROM supplier_returns sr WHERE {where_sql}"), params
    )
    total: int = count_res.scalar() or 0

    rows_res = await db.execute(
        text(
            f"SELECT sr.id, sr.doc_number, sr.supplier_id, s.name AS supplier_name, "
            f"sr.warehouse_id, w.name AS warehouse_name, "
            f"sr.status, sr.refund_method, sr.refund_amount, sr.created_at, "
            f"(SELECT COUNT(*) FROM supplier_return_items WHERE supplier_return_id = sr.id) AS item_count "
            f"FROM supplier_returns sr "
            f"LEFT JOIN suppliers s ON s.id = sr.supplier_id "
            f"LEFT JOIN warehouses w ON w.id = sr.warehouse_id "
            f"WHERE {where_sql} "
            f"ORDER BY sr.created_at DESC LIMIT :lim OFFSET :off"
        ),
        params,
    )
    items = []
    for r in rows_res:
        m = dict(r._mapping)
        m["id"] = str(m["id"])
        m["supplier_id"] = str(m["supplier_id"])
        if m.get("refund_amount") is not None:
            m["refund_amount"] = str(m["refund_amount"])
        items.append(m)

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post(
    "/supplier-returns",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("supplier.return.create"))],
)
async def create_supplier_return(
    p: SupplierReturnIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    sup_check = await db.execute(
        text("SELECT id FROM suppliers WHERE id = :sid AND organization_id = :o"),
        {"sid": str(p.supplier_id), "o": org_id},
    )
    if not sup_check.scalar():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="supplier_id bu tashkilotga tegishli emas")

    wh_check = await db.execute(
        text("SELECT id FROM warehouses WHERE id = :wid AND organization_id = :o AND is_active = TRUE"),
        {"wid": p.warehouse_id, "o": org_id},
    )
    if not wh_check.scalar():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="warehouse_id bu tashkilotga tegishli emas")

    if p.original_purchase_id is not None:
        pur_check = await db.execute(
            text("SELECT id FROM supplies WHERE id = :pid AND organization_id = :o"),
            {"pid": str(p.original_purchase_id), "o": org_id},
        )
        if not pur_check.scalar():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="original_purchase_id bu tashkilotga tegishli emas")

    doc_number = await _next_doc_number(db, org_id, "supplier_return", "SR")

    ret_res = await db.execute(
        text(
            "INSERT INTO supplier_returns "
            "(organization_id, doc_number, supplier_id, warehouse_id, original_purchase_id, "
            " reason, notes, status, refund_method, created_by) "
            "VALUES (:o, :dn, :sid, :wid, :pid, :reason, :notes, 'draft', :rm, :uid) "
            "RETURNING id"
        ),
        {
            "o": org_id, "dn": doc_number,
            "sid": str(p.supplier_id), "wid": p.warehouse_id,
            "pid": str(p.original_purchase_id) if p.original_purchase_id else None,
            "reason": p.reason, "notes": p.notes, "rm": p.refund_method, "uid": user_id,
        },
    )
    return_id = ret_res.scalar()

    for item in p.items:
        await db.execute(
            text(
                "INSERT INTO supplier_return_items "
                "(supplier_return_id, product_id, quantity, unit_cost, notes) "
                "VALUES (:rid, :pid, :qty, :uc, :n)"
            ),
            {
                "rid": str(return_id), "pid": str(item.product_id),
                "qty": item.quantity, "uc": item.unit_cost, "n": item.notes,
            },
        )

    await db.commit()
    return {"id": str(return_id), "doc_number": doc_number}


@router.get(
    "/supplier-returns/{rid}",
    dependencies=[Depends(require_permission("supplier.return.view"))],
)
async def get_supplier_return(
    rid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text(
            "SELECT sr.id, sr.doc_number, sr.supplier_id, s.name AS supplier_name, "
            "sr.warehouse_id, w.name AS warehouse_name, "
            "sr.original_purchase_id, sr.reason, sr.notes, sr.status, "
            "sr.refund_method, sr.refund_amount, "
            "sr.created_by, sr.created_at, sr.confirmed_at, sr.confirmed_by "
            "FROM supplier_returns sr "
            "LEFT JOIN suppliers s ON s.id = sr.supplier_id "
            "LEFT JOIN warehouses w ON w.id = sr.warehouse_id "
            "WHERE sr.id = :id AND sr.organization_id = :o"
        ),
        {"id": str(rid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    items_res = await db.execute(
        text(
            "SELECT sri.id, sri.product_id, p.name AS product_name, "
            "sri.quantity, sri.unit_cost, sri.total_amount, sri.notes "
            "FROM supplier_return_items sri "
            "LEFT JOIN products p ON p.id = sri.product_id "
            "WHERE sri.supplier_return_id = :rid"
        ),
        {"rid": str(rid)},
    )
    items = []
    for r in items_res:
        m = dict(r._mapping)
        m["product_id"] = str(m["product_id"])
        for f in ("quantity", "unit_cost", "total_amount"):
            if m.get(f) is not None:
                m[f] = str(m[f])
        items.append(m)

    result = dict(h._mapping)
    result["id"] = str(result["id"])
    result["supplier_id"] = str(result["supplier_id"])
    if result.get("original_purchase_id"):
        result["original_purchase_id"] = str(result["original_purchase_id"])
    if result.get("refund_amount") is not None:
        result["refund_amount"] = str(result["refund_amount"])
    result["items"] = items
    return result


@router.patch(
    "/supplier-returns/{rid}",
    dependencies=[Depends(require_permission("supplier.return.create"))],
)
async def update_supplier_return(
    rid: UUID,
    p: SupplierReturnPatchIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    row = await db.execute(
        text("SELECT id, status FROM supplier_returns "
             "WHERE id = :id AND organization_id = :o FOR UPDATE"),
        {"id": str(rid), "o": org_id},
    )
    r = row.first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if r.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Faqat draft holat tahrirlash mumkin")

    await db.execute(
        text(
            "UPDATE supplier_returns SET reason=:reason, notes=:notes, refund_method=:rm "
            "WHERE id = :id AND organization_id = :o"
        ),
        {"reason": p.reason, "notes": p.notes, "rm": p.refund_method,
         "id": str(rid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.post(
    "/supplier-returns/{rid}/confirm",
    dependencies=[Depends(require_permission("supplier.return.confirm"))],
)
async def confirm_supplier_return(
    rid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    # Lock the row first without JOIN (FOR UPDATE + LEFT JOIN not allowed in PostgreSQL)
    head = await db.execute(
        text(
            "SELECT id, status, warehouse_id, refund_method, supplier_id "
            "FROM supplier_returns "
            "WHERE id = :id AND organization_id = :o FOR UPDATE"
        ),
        {"id": str(rid), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Faqat draft holat tasdiqlanishi mumkin")

    sup_res = await db.execute(
        text("SELECT name FROM suppliers WHERE id = :sid"),
        {"sid": str(row.supplier_id)},
    )
    supplier_name = (sup_res.scalar() or "")

    items_res = await db.execute(
        text(
            "SELECT sri.product_id, p.name AS product_name, sri.quantity, sri.unit_cost "
            "FROM supplier_return_items sri "
            "LEFT JOIN products p ON p.id = sri.product_id "
            "WHERE sri.supplier_return_id = :rid"
        ),
        {"rid": str(rid)},
    )
    item_rows = items_res.fetchall()
    if not item_rows:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Qaytarish elementlari yo'q")

    correlation_id = str(uuid4())
    total_refund = Decimal("0")

    for item in item_rows:
        qty = Decimal(str(item.quantity))
        uc = Decimal(str(item.unit_cost)) if item.unit_cost is not None else None

        await _stock_apply(
            db, row.warehouse_id, str(item.product_id),
            -qty, allow_negative=False,
            org_id=org_id, operation_type="purchase_return",
            source_type="supplier_return", source_id=str(rid),
            correlation_id=correlation_id, user_id=user_id,
            notes=f"Return to supplier {supplier_name}",
        )

        if uc is not None:
            total_refund += qty * uc

    refund_method = row.refund_method

    if refund_method == "cash_refund":
        await db.execute(
            text(
                "INSERT INTO cash_movements "
                "(organization_id, cashbox_id, direction, amount, supplier_id, "
                " description, created_by) "
                "VALUES (:o, NULL, 'in', :amt, :sup, :note, :uid)"
            ),
            {
                "o": org_id, "amt": total_refund,
                "sup": str(row.supplier_id),
                "note": f"Refund from supplier {supplier_name} (SR {rid})",
                "uid": user_id,
            },
        )
    elif refund_method == "supplier_balance":
        # Supplier balance is derived from cash_movements where supplier_id is set.
        # direction='in' means the supplier owes us money (our receivable increases).
        await db.execute(
            text(
                "INSERT INTO cash_movements "
                "(organization_id, cashbox_id, direction, amount, supplier_id, "
                " description, created_by) "
                "VALUES (:o, NULL, 'in', :amt, :sup, :note, :uid)"
            ),
            {
                "o": org_id, "amt": total_refund,
                "sup": str(row.supplier_id),
                "note": f"Supplier balance credit from return (SR {rid})",
                "uid": user_id,
            },
        )
    # refund_method == "replacement" or None: stock deducted, no finance movement

    await db.execute(
        text(
            "UPDATE supplier_returns "
            "SET status='confirmed', refund_amount=:amt, confirmed_at=NOW(), confirmed_by=:uid "
            "WHERE id = :id AND organization_id = :o"
        ),
        {"amt": total_refund, "uid": user_id, "id": str(rid), "o": org_id},
    )
    await db.commit()
    return {"ok": True, "refund_amount": str(total_refund)}


@router.post(
    "/supplier-returns/{rid}/cancel",
    dependencies=[Depends(require_permission("supplier.return.cancel"))],
)
async def cancel_supplier_return(
    rid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    head = await db.execute(
        text(
            "SELECT id, status, warehouse_id FROM supplier_returns "
            "WHERE id = :id AND organization_id = :o FOR UPDATE"
        ),
        {"id": str(rid), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status == "cancelled":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Allaqachon bekor qilingan")
    if row.status not in ("draft", "confirmed"):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Faqat draft yoki confirmed holat bekor qilish mumkin")

    if row.status == "confirmed":
        items_res = await db.execute(
            text(
                "SELECT product_id, quantity, unit_cost "
                "FROM supplier_return_items WHERE supplier_return_id = :rid"
            ),
            {"rid": str(rid)},
        )
        rollback_correlation_id = str(uuid4())
        for item in items_res.fetchall():
            qty = Decimal(str(item.quantity))
            uc = Decimal(str(item.unit_cost)) if item.unit_cost is not None else None
            await _stock_apply(
                db, row.warehouse_id, str(item.product_id),
                qty, uc, allow_negative=False,
                org_id=org_id, operation_type="purchase_return_cancel",
                source_type="supplier_return", source_id=str(rid),
                correlation_id=rollback_correlation_id, user_id=user_id,
                notes="cancel rollback",
            )

    await db.execute(
        text("UPDATE supplier_returns SET status='cancelled' WHERE id = :id AND organization_id = :o"),
        {"id": str(rid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.delete(
    "/supplier-returns/{rid}",
    dependencies=[Depends(require_permission("supplier.return.cancel"))],
)
async def delete_supplier_return(
    rid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    row = await db.execute(
        text("SELECT id, status FROM supplier_returns "
             "WHERE id = :id AND organization_id = :o FOR UPDATE"),
        {"id": str(rid), "o": org_id},
    )
    r = row.first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if r.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Faqat draft holat o'chirish mumkin")

    await db.execute(
        text("DELETE FROM supplier_return_items WHERE supplier_return_id = :rid"),
        {"rid": str(rid)},
    )
    await db.execute(
        text("DELETE FROM supplier_returns WHERE id = :id AND organization_id = :o"),
        {"id": str(rid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# STOCK IN REASONS — Sprint 5 QA fix M1
# =========================================================

class StockInReasonIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str | None = Field(None, max_length=50)
    is_active: bool = True


class StockInReasonPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    code: str | None = Field(None, max_length=50)
    is_active: bool | None = None


@router.get(
    "/stock-in-reasons",
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def list_stock_in_reasons(
    is_active: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(
            "SELECT id, name, code, is_active, created_at "
            "FROM stock_in_reasons "
            "WHERE organization_id = :o AND is_active = :a "
            "ORDER BY name"
        ),
        {"o": org_id, "a": is_active},
    )
    return [dict(r._mapping) for r in res]


@router.post(
    "/stock-in-reasons",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def create_stock_in_reason(
    body: StockInReasonIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    try:
        res = await db.execute(
            text(
                "INSERT INTO stock_in_reasons (organization_id, name, code, is_active) "
                "VALUES (:o, :n, :c, :a) RETURNING id"
            ),
            {"o": org_id, "n": body.name, "c": body.code, "a": body.is_active},
        )
        new_id = res.scalar_one()
        await db.commit()
    except Exception as exc:
        await db.rollback()
        if "uq_stock_in_reasons_org_name" in str(exc):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Bu nomli sabab allaqachon mavjud")
        raise
    return {"id": new_id}


@router.patch(
    "/stock-in-reasons/{rid}",
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def update_stock_in_reason(
    rid: int,
    body: StockInReasonPatch,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.code is not None:
        updates["code"] = body.code
    if body.is_active is not None:
        updates["is_active"] = body.is_active
    if not updates:
        return {"ok": True}

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    params = {"id": rid, "o": org_id, **updates}
    res = await db.execute(
        text(
            f"UPDATE stock_in_reasons SET {set_clause} "
            "WHERE id = :id AND organization_id = :o RETURNING id"
        ),
        params,
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete(
    "/stock-in-reasons/{rid}",
    dependencies=[Depends(require_permission("warehouse.manage_stock_ins"))],
)
async def delete_stock_in_reason(
    rid: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(
            "UPDATE stock_in_reasons SET is_active = FALSE "
            "WHERE id = :id AND organization_id = :o RETURNING id"
        ),
        {"id": rid, "o": org_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}
