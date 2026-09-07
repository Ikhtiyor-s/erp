from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user_id, get_current_org_id
from app.modules.audit.logger import log_action
from app.modules.integration.telegram import notify_sale
from app.modules.rbac.deps import get_user_permissions
from app.modules.sale.pdf import render_sale_pdf, render_return_pdf
from app.modules.tools.xlsx import make_sheet, new_workbook, workbook_to_bytes
from app.modules.warehouse.service import explode_bom, _stock_apply




async def _verify_warehouse_in_org(db, warehouse_id, org_id):
    """HI-1: ensure warehouse belongs to caller org."""
    from sqlalchemy import text as _text
    res = await db.execute(
        _text("SELECT 1 FROM warehouses WHERE id = :w AND organization_id = :o"),
        {"w": warehouse_id, "o": org_id},
    )
    if not res.first():
        raise HTTPException(422, "warehouse_id does not belong to your organization")

async def _verify_products_in_org(db, product_ids, org_id):
    """HI-1: ensure ALL product_ids belong to caller org and are not archived (one query)."""
    from sqlalchemy import text as _text
    if not product_ids:
        return
    res = await db.execute(
        _text("SELECT id, is_archived FROM products WHERE id = ANY(CAST(:ids AS uuid[])) AND organization_id = :o"),
        {"ids": [str(x) for x in product_ids], "o": org_id},
    )
    rows = list(res)
    found = {str(r.id) for r in rows}
    missing = [str(pid) for pid in product_ids if str(pid) not in found]
    if missing:
        raise HTTPException(422, f"product_id does not belong to your organization: {missing[0]}")
    archived = [str(r.id) for r in rows if r.is_archived]
    if archived:
        raise HTTPException(422, "Mahsulot arxivda: yangi operatsiyaga qo'shib bo'lmaydi")

async def _verify_cashbox_in_org(db, cashbox_id, org_id):
    """HI-2/HI-3: ensure cashbox belongs to caller org."""
    from sqlalchemy import text as _text
    if cashbox_id is None:
        return
    res = await db.execute(
        _text("SELECT 1 FROM cashboxes WHERE id = :cb AND organization_id = :o"),
        {"cb": cashbox_id, "o": org_id},
    )
    if not res.first():
        raise HTTPException(422, "cashbox_id does not belong to your organization")

router = APIRouter(prefix="/sale", tags=["sale"])


# =========================================================
# SALES (basic CRUD)
# =========================================================

class SaleItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(gt=0)
    price: Decimal = Field(ge=0)
    discount: Decimal = Decimal("0")


class SaleCreate(BaseModel):
    customer_id: UUID | None = None
    warehouse_id: int | None = None
    cashbox_id: int | None = None
    currency_id: int
    rate: Decimal = Decimal("1")
    items: list[SaleItemIn] = Field(min_length=1)
    notes: str | None = None


@router.get("/sales")
async def list_sales(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    customer_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE s.organization_id = :o"
    params: dict = {"o": org_id, "lim": limit, "off": offset}
    if customer_id:
        where += " AND s.customer_id = :cu"
        params["cu"] = str(customer_id)
    if status_filter:
        where += " AND s.status = :st"
        params["st"] = status_filter
    if q:
        where += " AND (s.doc_number ILIKE :q OR c.name ILIKE :q OR c.phone ILIKE :q)"
        params["q"] = f"%{q}%"
    if date_from:
        where += " AND s.sale_date >= :df"
        params["df"] = date_from
    if date_to:
        where += " AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')"
        params["dt"] = date_to
    res = await db.execute(
        text(
            f"SELECT s.id, s.doc_number, "
            f"('A' || COALESCE(s.doc_number, SUBSTRING(s.id::text, 1, 8))) AS uuid_label, "
            f"s.customer_id, s.warehouse_id, s.sale_date, "
            f"s.total_amount, s.paid_amount, s.status, "
            f"s.notes, s.currency_id, "
            f"c.name AS customer_name, c.phone AS customer_phone, "
            f"o.name AS org_name, "
            f"w.name AS warehouse_name, "
            f"u.full_name AS created_by_name, "
            f"cur.code AS currency_code "
            f"FROM sales s "
            f"LEFT JOIN customers c ON c.id = s.customer_id "
            f"LEFT JOIN organizations o ON o.id = s.organization_id "
            f"LEFT JOIN warehouses w ON w.id = s.warehouse_id "
            f"LEFT JOIN users u ON u.id = s.created_by "
            f"LEFT JOIN currencies cur ON cur.id = s.currency_id "
            f"{where} ORDER BY s.sale_date DESC LIMIT :lim OFFSET :off"
        ),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/sales", status_code=status.HTTP_201_CREATED)
async def create_sale(
    p: SaleCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    # T-206: warehouse_id resolution
    # Case 1: no warehouse_id and no cashbox_id → 422
    if p.warehouse_id is None and p.cashbox_id is None:
        raise HTTPException(422, "warehouse_id yoki cashbox_id majburiy")

    resolved_warehouse_id: int
    if p.warehouse_id is not None and p.cashbox_id is not None:
        # Case 2: both provided → caller must have sale.change_warehouse
        perms = await get_user_permissions(user_id, org_id, db)
        if "sale.change_warehouse" not in perms:
            raise HTTPException(403, "Ombor almashtirish uchun ruxsat yo'q")
        resolved_warehouse_id = p.warehouse_id
    elif p.warehouse_id is None:
        # Case 3: only cashbox_id → resolve warehouse from cashbox
        cb_res = await db.execute(
            text("SELECT warehouse_id FROM cashboxes WHERE id = :cid AND organization_id = :o"),
            {"cid": p.cashbox_id, "o": org_id},
        )
        cb_row = cb_res.first()
        if not cb_row:
            raise HTTPException(422, "cashbox_id does not belong to your organization")
        if cb_row.warehouse_id is None:
            raise HTTPException(422, "Kassa omborga bog'lanmagan")
        resolved_warehouse_id = cb_row.warehouse_id
    else:
        # Case 4: only warehouse_id provided (legacy / direct)
        resolved_warehouse_id = p.warehouse_id

    # HI-1: verify resolved warehouse + all product_ids belong to caller org
    await _verify_warehouse_in_org(db, resolved_warehouse_id, org_id)
    await _verify_products_in_org(db, [it.product_id for it in p.items], org_id)

    sale_id = uuid4()
    total = sum(i.quantity * i.price - i.discount for i in p.items)

    await db.execute(
        text(
            "INSERT INTO sales (id, organization_id, customer_id, warehouse_id, currency_id, "
            "rate, total_amount, status, notes, created_by) "
            "VALUES (:id, :o, :cu, :wh, :cur, :r, :t, 'confirmed', :n, :u)"
        ),
        {"id": str(sale_id), "o": org_id,
         "cu": str(p.customer_id) if p.customer_id else None,
         "wh": resolved_warehouse_id, "cur": p.currency_id, "r": p.rate,
         "t": total, "n": p.notes, "u": user_id},
    )

    for it in p.items:
        item_res = await db.execute(
            text("INSERT INTO sale_items (sale_id, product_id, quantity, price, discount) "
                 "VALUES (:s, :p, :q, :pr, :d) RETURNING id"),
            {"s": str(sale_id), "p": str(it.product_id), "q": it.quantity,
             "pr": it.price, "d": it.discount},
        )
        sale_item_id = item_res.scalar()

        # Snapshot avg_cost before stock is deducted (FOR UPDATE locks the balance row).
        # Falls back to products.avg_cost if no balance row exists yet.
        cost_row = await db.execute(
            text("SELECT COALESCE(avg_cost, 0) FROM stock_balances "
                 "WHERE warehouse_id = :w AND product_id = :p FOR UPDATE"),
            {"w": resolved_warehouse_id, "p": str(it.product_id)},
        )
        cost_snapshot = Decimal(str(cost_row.scalar() or 0))
        if cost_snapshot == 0:
            fallback = await db.execute(
                text("SELECT COALESCE(purchase_price, 0) FROM products WHERE id = :p"),
                {"p": str(it.product_id)},
            )
            cost_snapshot = Decimal(str(fallback.scalar() or 0))

        await db.execute(
            text("UPDATE sale_items SET unit_cost = :c WHERE id = :sid"),
            {"c": cost_snapshot, "sid": sale_item_id},
        )

        # Check BOM before stock deduction: BOM parent products do not hold stock
        # themselves — their components do. Allow negative balance for BOM parents
        # since stock is tracked and deducted at the component level during pick.
        leaves = await explode_bom(db, org_id, str(it.product_id), Decimal(str(it.quantity)))
        is_bom_parent = bool(leaves)

        await _stock_apply(
            db,
            warehouse_id=resolved_warehouse_id,
            product_id=str(it.product_id),
            delta_qty=Decimal(str(-it.quantity)),
            cost=cost_snapshot,
            org_id=org_id,
            allow_negative=is_bom_parent,
            operation_type="sale",
            source_type="sale",
            source_id=str(sale_id),
            user_id=user_id,
        )

        # Pick workflow bootstrap: create pending pick items.
        # BOM products → one pick_item per leaf component (parent_product_id = sold product).
        # Non-BOM products → one pick_item for the product itself (parent_product_id NULL).
        if leaves:
            for leaf in leaves:
                await db.execute(
                    text(
                        "INSERT INTO order_pick_items "
                        "  (organization_id, order_id, item_id, parent_product_id,"
                        "   product_id, quantity, unit_id, status) "
                        "VALUES (:o, :oid, :iid, :parent, :cpid, :q, :u, 'pending') "
                        "ON CONFLICT (organization_id, order_id, item_id, product_id) DO NOTHING"
                    ),
                    {
                        "o": org_id,
                        "oid": str(sale_id),
                        "iid": sale_item_id,
                        "parent": str(it.product_id),
                        "cpid": leaf["component_id"],
                        "q": leaf["quantity"],
                        "u": leaf["unit_id"],
                    },
                )
        else:
            # Resolve unit_id from product table for individual items
            unit_res = await db.execute(
                text("SELECT unit_id FROM products WHERE id = :pid"),
                {"pid": str(it.product_id)},
            )
            unit_row = unit_res.first()
            unit_id = unit_row.unit_id if unit_row else None
            await db.execute(
                text(
                    "INSERT INTO order_pick_items "
                    "  (organization_id, order_id, item_id, parent_product_id,"
                    "   product_id, quantity, unit_id, status) "
                    "VALUES (:o, :oid, :iid, NULL, :pid, :q, :u, 'pending') "
                    "ON CONFLICT (organization_id, order_id, item_id, product_id) DO NOTHING"
                ),
                {
                    "o": org_id,
                    "oid": str(sale_id),
                    "iid": sale_item_id,
                    "pid": str(it.product_id),
                    "q": it.quantity,
                    "u": unit_id,
                },
            )

    await db.commit()

    await log_action(
        db, org_id, user_id, "create", "sales", str(sale_id),
        diff={"new": {"total_amount": float(total), "items": len(p.items),
                      "warehouse_id": resolved_warehouse_id,
                      "customer_id": str(p.customer_id) if p.customer_id else None}},
        request=request,
    )
    await db.commit()

    # Best-effort Telegram notification (errors swallowed inside)
    try:
        notify_payload = {
            "head": {
                "id": str(sale_id),
                "doc_number": None,
                "total_amount": float(total),
                "paid_amount": 0,
                "customer_name": None,
                "warehouse_name": None,
                "currency_code": "UZS",
            },
            "items": [
                {"product_name": str(it.product_id)[:8], "quantity": float(it.quantity),
                 "price": float(it.price)}
                for it in p.items
            ],
        }
        await notify_sale(db, org_id, notify_payload)
    except Exception:
        pass

    return {"id": str(sale_id), "total_amount": total}


@router.get("/sales/{sale_id}")
async def get_sale(
    sale_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, "
             "c.address AS customer_address, c.tin AS customer_tin, "
             "w.name AS warehouse_name, cur.code AS currency_code "
             "FROM sales s "
             "LEFT JOIN customers c ON c.id = s.customer_id "
             "LEFT JOIN warehouses w ON w.id = s.warehouse_id "
             "LEFT JOIN currencies cur ON cur.id = s.currency_id "
             "WHERE s.id = :id AND s.organization_id = :o"),
        {"id": str(sale_id), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale not found")
    items = await db.execute(
        text("SELECT si.id, si.product_id, p.name AS product_name, si.quantity, si.price, "
             "si.discount, si.amount, si.unit_cost "
             "FROM sale_items si LEFT JOIN products p ON p.id = si.product_id "
             "WHERE si.sale_id = :id"),
        {"id": str(sale_id)},
    )
    return {"head": dict(h._mapping), "items": [dict(r._mapping) for r in items]}


@router.get("/sales/{sale_id}/xlsx")
async def sale_xlsx(
    sale_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Export a single sale as multi-sheet xlsx (Head + Items + Payments)."""
    head = await db.execute(
        text("SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, "
             "c.tin AS customer_tin, w.name AS warehouse_name, "
             "cur.code AS currency_code, o.name AS org_name "
             "FROM sales s "
             "LEFT JOIN customers c ON c.id = s.customer_id "
             "LEFT JOIN warehouses w ON w.id = s.warehouse_id "
             "LEFT JOIN currencies cur ON cur.id = s.currency_id "
             "LEFT JOIN organizations o ON o.id = s.organization_id "
             "WHERE s.id = :id AND s.organization_id = :o"),
        {"id": str(sale_id), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale not found")

    items_res = await db.execute(
        text("SELECT si.product_id, p.name AS product_name, p.sku, "
             "si.quantity, si.price, si.discount, si.amount "
             "FROM sale_items si LEFT JOIN products p ON p.id = si.product_id "
             "WHERE si.sale_id = :id"),
        {"id": str(sale_id)},
    )
    payments_res = await db.execute(
        text("SELECT cm.amount, cm.created_at, cm.description, "
             "cb.name AS cashbox_name, pt.name AS payment_type "
             "FROM cash_movements cm "
             "LEFT JOIN cashboxes cb ON cb.id = cm.cashbox_id "
             "LEFT JOIN payment_types pt ON pt.id = cm.payment_type_id "
             "WHERE cm.sale_id = :id AND cm.direction = 'in' "
             "ORDER BY cm.created_at"),
        {"id": str(sale_id)},
    )

    wb = new_workbook()

    # Sheet 1: Sotuv ma'lumotlari (header)
    doc_no = h.doc_number or str(sale_id)[:8]
    make_sheet(wb, "Ma'lumot", ["Maydon", "Qiymat"], [
        ["Hujjat #", doc_no],
        ["Sana", h.sale_date.strftime("%Y-%m-%d %H:%M") if h.sale_date else ""],
        ["Tashkilot", h.org_name or ""],
        ["Mijoz", h.customer_name or "Chakana xaridor"],
        ["Telefon", h.customer_phone or ""],
        ["STIR", h.customer_tin or ""],
        ["Ombor", h.warehouse_name or ""],
        ["Valyuta", h.currency_code or "UZS"],
        ["Holat", {"draft": "Qoralama", "confirmed": "Tasdiqlangan",
                   "paid": "To'langan", "partial": "Qisman",
                   "cancelled": "Bekor qilingan"}.get(h.status, h.status or "")],
        ["Jami", float(h.total_amount or 0)],
        ["To'langan", float(h.paid_amount or 0)],
        ["Qarz", float((h.total_amount or 0) - (h.paid_amount or 0))],
        ["Izoh", h.notes or ""],
    ], number_formats={1: "#,##0.00"})

    # Sheet 2: Mahsulotlar
    items_rows = []
    for r in items_res:
        items_rows.append([
            r.sku or "", r.product_name or "", float(r.quantity or 0),
            float(r.price or 0), float(r.discount or 0), float(r.amount or 0),
        ])
    make_sheet(wb, "Mahsulotlar",
               ["SKU", "Mahsulot", "Miqdor", "Narx", "Chegirma", "Summa"],
               items_rows,
               number_formats={2: "#,##0.000", 3: "#,##0.00", 4: "#,##0.00", 5: "#,##0.00"})

    # Sheet 3: To'lovlar
    pay_rows = []
    for r in payments_res:
        pay_rows.append([
            r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            r.cashbox_name or "", r.payment_type or "",
            float(r.amount or 0), r.description or "",
        ])
    if not pay_rows:
        pay_rows = [["—", "—", "—", 0, "To'lov yo'q"]]
    make_sheet(wb, "To'lovlar",
               ["Vaqt", "Kassa", "Tur", "Summa", "Izoh"],
               pay_rows,
               number_formats={3: "#,##0.00"})

    data = workbook_to_bytes(wb)
    from fastapi.responses import Response
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="sotuv-{doc_no}.xlsx"'},
    )


@router.get("/sales/{sale_id}/pdf")
async def sale_pdf(
    sale_id: UUID,
    fmt: str = Query("a4", regex="^(a4|thermal_58|thermal_80)$"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Generate sale receipt as PDF (a4 / thermal_58 / thermal_80)."""
    head = await db.execute(
        text("SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, "
             "c.address AS customer_address, c.tin AS customer_tin, "
             "w.name AS warehouse_name, cur.code AS currency_code, "
             "o.name AS org_name, o.address AS org_address, o.tin AS org_tin "
             "FROM sales s "
             "LEFT JOIN customers c ON c.id = s.customer_id "
             "LEFT JOIN warehouses w ON w.id = s.warehouse_id "
             "LEFT JOIN currencies cur ON cur.id = s.currency_id "
             "LEFT JOIN organizations o ON o.id = s.organization_id "
             "WHERE s.id = :id AND s.organization_id = :o"),
        {"id": str(sale_id), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale not found")
    items = await db.execute(
        text("SELECT si.product_id, p.name AS product_name, si.quantity, si.price, "
             "si.discount, si.amount "
             "FROM sale_items si LEFT JOIN products p ON p.id = si.product_id "
             "WHERE si.sale_id = :id"),
        {"id": str(sale_id)},
    )
    head_dict = dict(h._mapping)
    sale_data = {
        "head": {k: v for k, v in head_dict.items()
                 if k not in ("org_name", "org_address", "org_tin")},
        "items": [dict(r._mapping) for r in items],
    }
    pdf_bytes = render_sale_pdf(
        sale_data,
        fmt=fmt,
        org_name=head_dict.get("org_name") or "",
        org_address=head_dict.get("org_address") or "",
        org_tin=head_dict.get("org_tin") or "",
    )
    doc_no = head_dict.get("doc_number") or str(sale_id)[:8]
    filename = f"sotuv-{doc_no}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# =========================================================
# PAY / CANCEL
# =========================================================

class PayIn(BaseModel):
    amount: Decimal = Field(gt=0)
    cashbox_id: int | None = None
    payment_type_id: int | None = None
    notes: str | None = None


@router.post("/sales/{sale_id}/pay")
async def pay_sale(
    sale_id: UUID, p: PayIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    head = await db.execute(
        text("SELECT total_amount, paid_amount, customer_id, status "
             "FROM sales WHERE id = :id AND organization_id = :o"),
        {"id": str(sale_id), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status == "cancelled":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Продажа отменена")

    # HI-2/HI-3: validate cashbox belongs to caller org before touching anything
    await _verify_cashbox_in_org(db, p.cashbox_id, org_id)

    new_paid = Decimal(str(row.paid_amount or 0)) + p.amount
    total = Decimal(str(row.total_amount or 0))
    new_status = "paid" if new_paid >= total else "partial"

    # HI-3: atomic sale-status update + cash_movements insert. Either both commit
    # together or both roll back. No partial state visible to other workers.
    await db.execute(
        text("UPDATE sales SET paid_amount = :pa, status = :st WHERE id = :id"),
        {"pa": new_paid, "st": new_status, "id": str(sale_id)},
    )
    await db.execute(
        text("INSERT INTO cash_movements (organization_id, cashbox_id, direction, "
             "amount, payment_type_id, customer_id, sale_id, description, created_by) "
             "VALUES (:o, :cb, 'in', :amt, :pt, :cu, :s, :d, :u)"),
        {"o": org_id, "cb": p.cashbox_id, "amt": p.amount, "pt": p.payment_type_id,
         "cu": str(row.customer_id) if row.customer_id else None,
         "s": str(sale_id),
         "d": f"Оплата продажи: {p.notes or ''}".strip(), "u": user_id},
    )
    if p.cashbox_id:
        await db.execute(
            text("UPDATE cashboxes SET balance = balance + :amt WHERE id = :cb"),
            {"amt": p.amount, "cb": p.cashbox_id},
        )
    await db.commit()

    await log_action(
        db, org_id, user_id, "pay", "sales", str(sale_id),
        diff={"amount": float(p.amount), "new_paid": float(new_paid),
              "new_status": new_status,
              "cashbox_id": p.cashbox_id, "payment_type_id": p.payment_type_id},
        request=request,
    )
    await db.commit()
    return {"paid_amount": float(new_paid), "status": new_status}


@router.post("/sales/{sale_id}/cancel")
async def cancel_sale(
    sale_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    head = await db.execute(
        text("SELECT warehouse_id, status FROM sales WHERE id = :id AND organization_id = :o"),
        {"id": str(sale_id), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status == "cancelled":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Уже отменено")

    items_res = await db.execute(
        text("SELECT product_id, quantity FROM sale_items WHERE sale_id = :id"),
        {"id": str(sale_id)},
    )
    for it in items_res:
        await _stock_apply(
            db,
            warehouse_id=row.warehouse_id,
            product_id=str(it.product_id),
            delta_qty=Decimal(str(it.quantity)),
            org_id=org_id,
            allow_negative=True,
            operation_type="sale_cancel",
            source_type="sale",
            source_id=str(sale_id),
            user_id=user_id,
        )

    await db.execute(
        text("UPDATE sales SET status = 'cancelled' WHERE id = :id"),
        {"id": str(sale_id)},
    )
    await db.commit()

    await log_action(
        db, org_id, user_id, "cancel", "sales", str(sale_id),
        diff={"new_status": "cancelled", "stock_returned": True},
        request=request,
    )
    await db.commit()
    return {"ok": True}


async def _bootstrap_pick_items(
    db: AsyncSession,
    org_id: str,
    sale_id: str,
    items: list[dict],
) -> None:
    """Insert order_pick_items for each sale_item, exploding BOM if applicable."""
    for it in items:
        leaves = await explode_bom(
            db, org_id, str(it["product_id"]), Decimal(str(it["quantity"]))
        )
        if leaves:
            for leaf in leaves:
                await db.execute(
                    text(
                        "INSERT INTO order_pick_items "
                        "  (organization_id, order_id, item_id, parent_product_id,"
                        "   product_id, quantity, unit_id, status) "
                        "VALUES (:o, :oid, :iid, :parent, :cpid, :q, :u, 'pending') "
                        "ON CONFLICT (organization_id, order_id, item_id, product_id) DO NOTHING"
                    ),
                    {
                        "o": org_id,
                        "oid": sale_id,
                        "iid": it["sale_item_id"],
                        "parent": str(it["product_id"]),
                        "cpid": leaf["component_id"],
                        "q": leaf["quantity"],
                        "u": leaf["unit_id"],
                    },
                )
        else:
            await db.execute(
                text(
                    "INSERT INTO order_pick_items "
                    "  (organization_id, order_id, item_id, parent_product_id,"
                    "   product_id, quantity, unit_id, status) "
                    "VALUES (:o, :oid, :iid, NULL, :pid, :q, :u, 'pending') "
                    "ON CONFLICT (organization_id, order_id, item_id, product_id) DO NOTHING"
                ),
                {
                    "o": org_id,
                    "oid": sale_id,
                    "iid": it["sale_item_id"],
                    "pid": str(it["product_id"]),
                    "q": it["quantity"],
                    "u": it["unit_id"],
                },
            )


@router.post("/sales/{sale_id}/duplicate", status_code=status.HTTP_201_CREATED)
async def duplicate_sale(
    sale_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    """Sotuvni nusxalash — yangi qoralama yaratiladi (status=draft, paid=0)."""
    head = await db.execute(
        text("""
            SELECT warehouse_id, customer_id, currency_id, total_amount, notes
            FROM sales WHERE id = :id AND organization_id = :o
        """),
        {"id": str(sale_id), "o": org_id},
    )
    src = head.first()
    if not src:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    new_id = await db.execute(
        text("""
            INSERT INTO sales (
                organization_id, warehouse_id, customer_id, currency_id,
                total_amount, paid_amount, status, notes, created_at
            ) VALUES (
                :o, :wh, :c, :cur, :total, 0, 'draft', :n, NOW()
            ) RETURNING id
        """),
        {
            "o": org_id, "wh": src.warehouse_id, "c": src.customer_id,
            "cur": src.currency_id, "total": src.total_amount, "n": src.notes,
        },
    )
    nid = new_id.scalar()

    new_items_res = await db.execute(
        text("""
            INSERT INTO sale_items (sale_id, product_id, quantity, price, discount)
            SELECT :nid, product_id, quantity, price, discount
            FROM sale_items WHERE sale_id = :src
            RETURNING id, product_id, quantity
        """),
        {"nid": str(nid), "src": str(sale_id)},
    )
    new_items = [dict(r._mapping) for r in new_items_res]

    # Resolve unit_id for each new item from products table
    unit_map: dict[str, int | None] = {}
    if new_items:
        prod_ids = list({str(r["product_id"]) for r in new_items})
        unit_res = await db.execute(
            text("SELECT id, unit_id FROM products WHERE id = ANY(CAST(:ids AS uuid[]))"),
            {"ids": prod_ids},
        )
        unit_map = {str(r.id): r.unit_id for r in unit_res}

    bootstrap_items = [
        {
            "sale_item_id": r["id"],
            "product_id": r["product_id"],
            "quantity": r["quantity"],
            "unit_id": unit_map.get(str(r["product_id"])),
        }
        for r in new_items
    ]
    await _bootstrap_pick_items(db, org_id, str(nid), bootstrap_items)
    await db.commit()

    await log_action(
        db, org_id, user_id, "duplicate", "sales", str(nid),
        diff={"source_id": str(sale_id)},
        request=request,
    )
    await db.commit()
    return {"id": str(nid)}


# =========================================================
# SALE RETURNS + REASONS
# =========================================================

class ReturnReasonIn(BaseModel):
    name: str
    code: str | None = None
    return_type: str = "valid"  # 'valid' | 'invalid'
    description: str | None = None


@router.get("/return-reasons")
async def list_return_reasons(
    return_type: str | None = Query(None),
    only_active: bool = Query(True),
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    where = "WHERE r.organization_id = :o"
    params: dict = {"o": org_id}
    if only_active:
        where += " AND r.is_active = TRUE"
    if return_type:
        where += " AND r.return_type = :rt"
        params["rt"] = return_type
    res = await db.execute(
        text(f"SELECT r.id, r.name, r.code, r.return_type, r.description, r.is_active, "
             f"u.full_name AS created_by_name "
             f"FROM sale_return_reasons r "
             f"LEFT JOIN users u ON u.id = r.created_by "
             f"{where} ORDER BY r.id"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/return-reasons", status_code=status.HTTP_201_CREATED)
async def create_return_reason(
    p: ReturnReasonIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    res = await db.execute(
        text("INSERT INTO sale_return_reasons "
             "(organization_id, name, code, return_type, description, created_by) "
             "VALUES (:o, :n, :c, :rt, :d, :u) RETURNING id"),
        {"o": org_id, "n": p.name, "c": p.code, "rt": p.return_type,
         "d": p.description, "u": user_id},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/return-reasons/{rid}")
async def update_return_reason(
    rid: int, p: ReturnReasonIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE sale_return_reasons SET name=:n, code=:c, return_type=:rt, description=:d "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": rid, "o": org_id, "n": p.name, "c": p.code,
         "rt": p.return_type, "d": p.description},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/return-reasons/{rid}")
async def delete_return_reason(
    rid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE sale_return_reasons SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": rid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


class ReturnItemIn(BaseModel):
    product_id: UUID
    unit_id: int | None = None
    warehouse_id: int | None = None
    quantity: Decimal = Field(gt=0)
    quantity_used: Decimal | None = None
    unit_ratio: Decimal = Decimal("1")
    returned_amount: Decimal = Decimal("0")
    price: Decimal = Field(ge=0)
    discount: Decimal = Decimal("0")
    tax_included: Decimal = Decimal("0")
    tax_added: Decimal = Decimal("0")
    extra_price: Decimal = Decimal("0")
    discount_per_unit: Decimal = Decimal("0")
    notes: str | None = None


class SaleReturnIn(BaseModel):
    sale_id: UUID | None = None
    warehouse_id: int
    reason_id: int | None = None
    reason: str | None = None
    responsible_id: UUID | None = None
    posrednik_id: UUID | None = None
    currency_id: int | None = None
    invoice_number: str | None = None
    status: str = "completed"
    notes: str | None = None
    sync_date: str | None = None  # ISO datetime
    paid_amount: Decimal = Decimal("0")
    items: list[ReturnItemIn] = Field(min_length=1)


@router.get("/returns")
async def list_returns(
    customer_id: UUID | None = Query(None),
    responsible_id: UUID | None = Query(None),
    reason_id: int | None = Query(None),
    return_type: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    where = "WHERE sr.organization_id = :o"
    params: dict = {"o": org_id}
    if customer_id:
        where += " AND s.customer_id = :cu"
        params["cu"] = str(customer_id)
    if responsible_id:
        where += " AND sr.responsible_id = :resp"
        params["resp"] = str(responsible_id)
    if reason_id:
        where += " AND sr.reason_id = :rid"
        params["rid"] = reason_id
    if return_type:
        where += " AND r.return_type = :rt"
        params["rt"] = return_type
    if date_from:
        where += " AND sr.return_date >= :df"
        params["df"] = date_from
    if date_to:
        where += " AND sr.return_date < (CAST(:dt AS date) + INTERVAL '1 day')"
        params["dt"] = date_to
    if q:
        where += " AND (sr.doc_number ILIKE :q OR c.name ILIKE :q OR c.phone ILIKE :q)"
        params["q"] = f"%{q}%"

    res = await db.execute(
        text(f"SELECT sr.id, sr.doc_number, "
             f"('A' || COALESCE(sr.doc_number, SUBSTRING(sr.id::text, 1, 8))) AS uuid_label, "
             f"sr.return_date, sr.total_amount, sr.status, "
             f"sr.sale_id, sr.invoice_number, sr.paid_amount, "
             f"s.doc_number AS sale_doc, "
             f"r.name AS reason_name, r.return_type, "
             f"o.name AS org_name, "
             f"e.full_name AS responsible_name, "
             f"u.full_name AS created_by_name, "
             f"c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone "
             f"FROM sale_returns sr "
             f"LEFT JOIN sales s ON s.id = sr.sale_id "
             f"LEFT JOIN customers c ON c.id = s.customer_id "
             f"LEFT JOIN sale_return_reasons r ON r.id = sr.reason_id "
             f"LEFT JOIN organizations o ON o.id = sr.organization_id "
             f"LEFT JOIN employees e ON e.id = sr.responsible_id "
             f"LEFT JOIN users u ON u.id = sr.created_by "
             f"{where} ORDER BY sr.return_date DESC LIMIT 200"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/returns", status_code=status.HTTP_201_CREATED)
async def create_return(
    p: SaleReturnIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    rid = uuid4()
    # Auto-calc totals
    total_amount = Decimal("0")
    total_discount = Decimal("0")
    tax_inc = Decimal("0")
    tax_add = Decimal("0")
    for it in p.items:
        line_total = it.quantity * it.price + it.extra_price - it.discount
        total_amount += line_total
        total_discount += it.discount + (it.discount_per_unit * it.quantity)
        tax_inc += it.tax_included
        tax_add += it.tax_added

    total_payable = total_amount + tax_add  # Added tax увеличивает к оплате
    sync_date_obj = (
        datetime.fromisoformat(p.sync_date)
        if p.sync_date else None
    )

    await db.execute(
        text("INSERT INTO sale_returns "
             "(id, organization_id, sale_id, warehouse_id, reason_id, reason, "
             " status, responsible_id, posrednik_id, currency_id, invoice_number, "
             " notes, sync_date, paid_amount, "
             " total_amount, total_cost, total_discount, total_payable, "
             " tax_excluded, tax_included, created_by) "
             "VALUES (:id, :o, :s, :w, :rid, :rs, "
             "        :st, :resp, :posr, :cur, :inv, "
             "        :nt, :sd, :pa, "
             "        :ta, :tc, :td, :tp, "
             "        :tx_ex, :tx_in, :u)"),
        {"id": str(rid), "o": org_id,
         "s": str(p.sale_id) if p.sale_id else None,
         "w": p.warehouse_id, "rid": p.reason_id, "rs": p.reason,
         "st": p.status,
         "resp": str(p.responsible_id) if p.responsible_id else None,
         "posr": str(p.posrednik_id) if p.posrednik_id else None,
         "cur": p.currency_id, "inv": p.invoice_number,
         "nt": p.notes, "sd": sync_date_obj, "pa": p.paid_amount,
         "ta": total_amount, "tc": total_amount, "td": total_discount,
         "tp": total_payable,
         "tx_ex": Decimal("0"), "tx_in": tax_inc,
         "u": user_id},
    )

    for it in p.items:
        await db.execute(
            text("INSERT INTO sale_return_items "
                 "(return_id, product_id, unit_id, warehouse_id, "
                 " quantity, quantity_used, unit_ratio, returned_amount, "
                 " price, discount, tax_included, tax_added, extra_price, "
                 " discount_per_unit, notes) "
                 "VALUES (:r, :p, :u, :w, "
                 "        :q, :qu, :ur, :ra, "
                 "        :pr, :d, :ti, :tx, :ep, "
                 "        :dpu, :n)"),
            {"r": str(rid), "p": str(it.product_id),
             "u": it.unit_id,
             "w": it.warehouse_id or p.warehouse_id,
             "q": it.quantity,
             "qu": it.quantity_used if it.quantity_used is not None else it.quantity,
             "ur": it.unit_ratio, "ra": it.returned_amount,
             "pr": it.price, "d": it.discount,
             "ti": it.tax_included, "tx": it.tax_added,
             "ep": it.extra_price, "dpu": it.discount_per_unit,
             "n": it.notes},
        )
        # Stock += qty (return to warehouse); allow_negative=True because positive delta cannot go negative
        wh = it.warehouse_id or p.warehouse_id
        await _stock_apply(
            db,
            warehouse_id=wh,
            product_id=str(it.product_id),
            delta_qty=Decimal(str(it.quantity)),
            org_id=org_id,
            allow_negative=True,
            operation_type="sale_return",
            source_type="sale_return",
            source_id=str(rid),
            user_id=user_id,
        )
    await db.commit()
    return {"id": str(rid), "total_amount": float(total_amount),
            "total_payable": float(total_payable)}


@router.get("/returns/{rid}")
async def get_return(
    rid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT sr.*, "
             "('A' || COALESCE(sr.doc_number, SUBSTRING(sr.id::text, 1, 8))) AS uuid_label, "
             "s.doc_number AS sale_doc, "
             "r.name AS reason_name, r.return_type, "
             "o.name AS org_name, "
             "e.full_name AS responsible_name, "
             "u.full_name AS created_by_name, "
             "c.id AS customer_id, c.name AS customer_name, "
             "c.phone AS customer_phone, c.address AS customer_address, c.tin AS customer_tin, "
             "pos.name AS posrednik_name, "
             "w.name AS warehouse_name, "
             "cur.code AS currency_code "
             "FROM sale_returns sr "
             "LEFT JOIN sales s ON s.id = sr.sale_id "
             "LEFT JOIN customers c ON c.id = s.customer_id "
             "LEFT JOIN customers pos ON pos.id = sr.posrednik_id "
             "LEFT JOIN sale_return_reasons r ON r.id = sr.reason_id "
             "LEFT JOIN organizations o ON o.id = sr.organization_id "
             "LEFT JOIN employees e ON e.id = sr.responsible_id "
             "LEFT JOIN users u ON u.id = sr.created_by "
             "LEFT JOIN warehouses w ON w.id = sr.warehouse_id "
             "LEFT JOIN currencies cur ON cur.id = sr.currency_id "
             "WHERE sr.id = :id AND sr.organization_id = :o"),
        {"id": str(rid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items = await db.execute(
        text("SELECT sri.*, "
             "p.name AS product_name, p.sku AS product_sku, "
             "un.short_name AS unit_name, "
             "w.name AS item_warehouse_name, "
             "(sri.quantity * sri.price + sri.extra_price - sri.discount) AS total_price "
             "FROM sale_return_items sri "
             "LEFT JOIN products p ON p.id = sri.product_id "
             "LEFT JOIN units un ON un.id = sri.unit_id "
             "LEFT JOIN warehouses w ON w.id = sri.warehouse_id "
             "WHERE sri.return_id = :id"),
        {"id": str(rid)},
    )
    return {"head": dict(h._mapping), "items": [dict(r._mapping) for r in items]}


@router.get("/returns/{rid}/pdf")
async def return_pdf(
    rid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Sale return as PDF."""
    head = await db.execute(
        text("""
            SELECT sr.*, s.doc_number AS sale_doc,
                   c.name AS customer_name,
                   r.name AS reason,
                   w.name AS warehouse_name,
                   o.name AS org_name, o.address AS org_address, o.tin AS org_tin
            FROM sale_returns sr
            LEFT JOIN sales s ON s.id = sr.sale_id
            LEFT JOIN customers c ON c.id = s.customer_id
            LEFT JOIN sale_return_reasons r ON r.id = sr.reason_id
            LEFT JOIN warehouses w ON w.id = sr.warehouse_id
            LEFT JOIN organizations o ON o.id = sr.organization_id
            WHERE sr.id = :id AND sr.organization_id = :o
        """),
        {"id": str(rid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items_res = await db.execute(
        text("""
            SELECT sri.product_id, p.name AS product_name,
                   sri.quantity, sri.price,
                   (sri.quantity * sri.price - COALESCE(sri.discount, 0)) AS amount
            FROM sale_return_items sri
            LEFT JOIN products p ON p.id = sri.product_id
            WHERE sri.return_id = :id
        """),
        {"id": str(rid)},
    )
    head_dict = dict(h._mapping)
    doc = {
        "head": {k: v for k, v in head_dict.items()
                 if k not in ("org_name", "org_address", "org_tin")},
        "items": [dict(r._mapping) for r in items_res],
    }
    pdf_bytes = render_return_pdf(
        doc,
        org_name=head_dict.get("org_name") or "",
        org_address=head_dict.get("org_address") or "",
        org_tin=head_dict.get("org_tin") or "",
    )
    doc_no = head_dict.get("doc_number") or str(rid)[:8]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="qaytarish-{doc_no}.pdf"'},
    )


# =========================================================
# DASHBOARD + CUSTOMER PAYMENTS
# =========================================================

@router.get("/dashboard")
async def sales_dashboard(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    today = date.today()
    tomorrow = today + timedelta(days=1)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    res = await db.execute(
        text("""
        SELECT
            COALESCE(SUM(CASE WHEN sale_date >= :td_start AND sale_date < :td_end THEN total_amount ELSE 0 END), 0) AS today_revenue,
            COUNT(*) FILTER (WHERE sale_date >= :td_start AND sale_date < :td_end) AS today_count,
            COALESCE(SUM(CASE WHEN sale_date >= :w THEN total_amount ELSE 0 END), 0) AS week_revenue,
            COUNT(*) FILTER (WHERE sale_date >= :w) AS week_count,
            COALESCE(SUM(CASE WHEN sale_date >= :m THEN total_amount ELSE 0 END), 0) AS month_revenue,
            COUNT(*) FILTER (WHERE sale_date >= :m) AS month_count,
            COALESCE(SUM(total_amount - paid_amount), 0) AS total_debt
        FROM sales
        WHERE organization_id = :o AND status <> 'cancelled'
        """),
        {"o": org_id, "td_start": today, "td_end": tomorrow, "w": week_ago, "m": month_ago},
    )
    kpi = dict(res.first()._mapping)

    top_customers = await db.execute(
        text("""
        SELECT c.id, c.name, COUNT(s.id) AS cnt, SUM(s.total_amount) AS revenue
        FROM sales s JOIN customers c ON c.id = s.customer_id
        WHERE s.organization_id = :o AND s.status <> 'cancelled'
          AND s.sale_date >= :m
        GROUP BY c.id, c.name
        ORDER BY revenue DESC LIMIT 5
        """),
        {"o": org_id, "m": month_ago},
    )

    top_products = await db.execute(
        text("""
        SELECT p.id, p.name, SUM(si.quantity) AS qty, SUM(si.amount) AS revenue
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.organization_id = :o AND s.status <> 'cancelled'
          AND s.sale_date >= :m
        GROUP BY p.id, p.name
        ORDER BY revenue DESC LIMIT 5
        """),
        {"o": org_id, "m": month_ago},
    )

    daily = await db.execute(
        text("""
        SELECT sale_date::date AS day, SUM(total_amount) AS revenue, COUNT(*) AS cnt
        FROM sales
        WHERE organization_id = :o AND status <> 'cancelled' AND sale_date >= :m
        GROUP BY 1 ORDER BY 1
        """),
        {"o": org_id, "m": month_ago},
    )

    return {
        "kpi": kpi,
        "top_customers": [dict(r._mapping) for r in top_customers],
        "top_products": [dict(r._mapping) for r in top_products],
        "daily": [dict(r._mapping) for r in daily],
    }


@router.get("/customer-payments")
async def customer_payments(
    customer_id: UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE cm.organization_id = :o AND cm.sale_id IS NOT NULL AND cm.direction = 'in'"
    params: dict = {"o": org_id, "lim": limit}
    if customer_id:
        where += " AND cm.customer_id = :c"
        params["c"] = str(customer_id)
    if date_from:
        where += " AND cm.movement_date >= :df"
        params["df"] = date_from
    if date_to:
        where += " AND cm.movement_date < (CAST(:dt AS date) + INTERVAL '1 day')"
        params["dt"] = date_to
    res = await db.execute(
        text(f"SELECT cm.id, cm.movement_date, cm.amount, cm.description, "
             f"c.name AS customer_name, c.id AS customer_id, "
             f"s.doc_number AS sale_doc, "
             f"s.id AS sale_id, s.total_amount AS sale_total "
             f"FROM cash_movements cm "
             f"LEFT JOIN customers c ON c.id = cm.customer_id "
             f"LEFT JOIN sales s ON s.id = cm.sale_id "
             f"{where} ORDER BY cm.movement_date DESC LIMIT :lim"),
        params,
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# CONTRACTS (b2b)
# =========================================================

class ContractIn(BaseModel):
    customer_id: UUID
    doc_number: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    total_amount: Decimal = Decimal("0")
    currency_id: int | None = None
    notes: str | None = None


@router.get("/contracts")
async def list_contracts(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT c.id, c.doc_number, c.start_date, c.end_date, c.total_amount, "
             "c.status, cu.name AS customer_name "
             "FROM contracts c LEFT JOIN customers cu ON cu.id = c.customer_id "
             "WHERE c.organization_id = :o "
             "ORDER BY c.created_at DESC LIMIT 200"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/contracts", status_code=status.HTTP_201_CREATED)
async def create_contract(
    p: ContractIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    cid = uuid4()
    await db.execute(
        text("INSERT INTO contracts (id, organization_id, customer_id, doc_number, "
             "start_date, end_date, total_amount, currency_id, status, notes, created_by) "
             "VALUES (:id, :o, :cu, :dn, :sd, :ed, :t, :cur, 'active', :n, :u)"),
        {"id": str(cid), "o": org_id, "cu": str(p.customer_id), "dn": p.doc_number,
         "sd": p.start_date, "ed": p.end_date, "t": p.total_amount,
         "cur": p.currency_id, "n": p.notes, "u": user_id},
    )
    await db.commit()
    return {"id": str(cid)}


@router.put("/contracts/{cid}")
async def update_contract(
    cid: UUID, p: ContractIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE contracts SET customer_id=:cu, doc_number=:dn, start_date=:sd, "
             "end_date=:ed, total_amount=:t, currency_id=:cur, notes=:n "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(cid), "o": org_id, "cu": str(p.customer_id), "dn": p.doc_number,
         "sd": p.start_date, "ed": p.end_date, "t": p.total_amount,
         "cur": p.currency_id, "n": p.notes},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/contracts/{cid}")
async def cancel_contract(
    cid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE contracts SET status = 'cancelled' "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(cid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# INVOICES
# =========================================================

class InvoiceIn(BaseModel):
    customer_id: UUID
    doc_number: str | None = None
    contract_id: UUID | None = None
    issue_date: str
    due_date: str | None = None
    total_amount: Decimal = Field(ge=0)
    currency_id: int | None = None


@router.get("/invoices")
async def list_invoices(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT i.id, i.doc_number, i.issue_date, i.due_date, i.total_amount, "
             "i.paid_amount, i.status, cu.name AS customer_name "
             "FROM invoices i LEFT JOIN customers cu ON cu.id = i.customer_id "
             "WHERE i.organization_id = :o "
             "ORDER BY i.issue_date DESC, i.created_at DESC LIMIT 200"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    p: InvoiceIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    iid = uuid4()
    await db.execute(
        text("INSERT INTO invoices (id, organization_id, customer_id, doc_number, "
             "contract_id, issue_date, due_date, total_amount, currency_id, status, created_by) "
             "VALUES (:id, :o, :cu, :dn, :ct, :is, :du, :t, :cur, 'draft', :u)"),
        {"id": str(iid), "o": org_id, "cu": str(p.customer_id), "dn": p.doc_number,
         "ct": str(p.contract_id) if p.contract_id else None,
         "is": p.issue_date, "du": p.due_date, "t": p.total_amount,
         "cur": p.currency_id, "u": user_id},
    )
    await db.commit()
    return {"id": str(iid)}


@router.put("/invoices/{iid}")
async def update_invoice(
    iid: UUID, p: InvoiceIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE invoices SET customer_id=:cu, doc_number=:dn, contract_id=:ct, "
             "issue_date=:is, due_date=:du, total_amount=:t, currency_id=:cur "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(iid), "o": org_id, "cu": str(p.customer_id), "dn": p.doc_number,
         "ct": str(p.contract_id) if p.contract_id else None,
         "is": p.issue_date, "du": p.due_date, "t": p.total_amount, "cur": p.currency_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/invoices/{iid}")
async def cancel_invoice(
    iid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE invoices SET status='cancelled' "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(iid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}
