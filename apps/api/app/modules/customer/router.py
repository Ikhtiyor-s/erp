import csv
import io
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id, get_current_user_id


router = APIRouter(prefix="/customer", tags=["customer"])


# =========================================================
# CUSTOMER CATEGORIES
# =========================================================

class CategoryIn(BaseModel):
    name: str
    discount_pct: Decimal = Decimal("0")


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT cc.id, cc.name, cc.discount_pct, "
             "(SELECT COUNT(*) FROM customers c WHERE c.category_id = cc.id AND c.is_active = TRUE) AS customer_count "
             "FROM customer_categories cc "
             "WHERE cc.organization_id = :o ORDER BY cc.name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    p: CategoryIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO customer_categories (organization_id, name, discount_pct) "
             "VALUES (:o, :n, :d) RETURNING id"),
        {"o": org_id, "n": p.name, "d": p.discount_pct},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/categories/{cid}")
async def update_category(
    cid: int, p: CategoryIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE customer_categories SET name=:n, discount_pct=:d "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": cid, "o": org_id, "n": p.name, "d": p.discount_pct},
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
        text("DELETE FROM customer_categories WHERE id = :id AND organization_id = :o"),
        {"id": cid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# CUSTOMERS
# =========================================================

class CustomerIn(BaseModel):
    name: str
    code: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    tin: str | None = None
    category_id: int | None = None
    location_id: int | None = None
    notes: str | None = None


@router.get("/customers")
async def list_customers(
    q: str | None = Query(None),
    category_id: int | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE c.organization_id = :o AND c.is_active = TRUE"
    params: dict = {"o": org_id, "lim": limit, "off": offset}
    if q:
        where += " AND (c.name ILIKE :q OR c.phone ILIKE :q OR c.code ILIKE :q OR c.tin ILIKE :q)"
        params["q"] = f"%{q}%"
    if category_id:
        where += " AND c.category_id = :cat"
        params["cat"] = category_id
    res = await db.execute(
        text(f"SELECT c.id, c.code, "
             f"('A' || COALESCE(c.code, SUBSTRING(c.id::text, 1, 8))) AS uuid_label, "
             f"c.name, c.phone, c.email, c.tin, c.category_id, c.address, c.created_at, "
             f"cc.name AS category_name, "
             f"l.name AS location_name, "
             f"o.name AS org_name, "
             f"COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) "
             f"          FROM cash_movements WHERE customer_id = c.id), 0) AS balance "
             f"FROM customers c "
             f"LEFT JOIN customer_categories cc ON cc.id = c.category_id "
             f"LEFT JOIN locations l ON l.id = c.location_id "
             f"LEFT JOIN organizations o ON o.id = c.organization_id "
             f"{where} ORDER BY c.name LIMIT :lim OFFSET :off"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/customers", status_code=status.HTTP_201_CREATED)
async def create_customer(
    p: CustomerIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    cid = uuid4()
    await db.execute(
        text("INSERT INTO customers (id, organization_id, code, name, phone, email, address, "
             "tin, category_id, location_id, notes) "
             "VALUES (:id, :o, :c, :n, :ph, :e, :a, :t, :cat, :loc, :nt)"),
        {"id": str(cid), "o": org_id, "c": p.code, "n": p.name, "ph": p.phone,
         "e": p.email, "a": p.address, "t": p.tin, "cat": p.category_id,
         "loc": p.location_id, "nt": p.notes},
    )
    await db.commit()
    return {"id": str(cid)}


@router.put("/customers/{cid}")
async def update_customer(
    cid: UUID, p: CustomerIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE customers SET code=:c, name=:n, phone=:ph, email=:e, address=:a, "
             "tin=:t, category_id=:cat, location_id=:loc, notes=:nt "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(cid), "o": org_id, "c": p.code, "n": p.name, "ph": p.phone,
         "e": p.email, "a": p.address, "t": p.tin, "cat": p.category_id,
         "loc": p.location_id, "nt": p.notes},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/customers/{cid}")
async def delete_customer(
    cid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE customers SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(cid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.get("/balance")
async def customer_balances(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT customer_id, name, balance FROM v_customer_balance "
             "WHERE organization_id = :o ORDER BY name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/customers/{cid}")
async def customer_profile(
    cid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT c.id, c.code, c.name, c.phone, c.email, c.tin, c.address, "
             "c.created_at, c.is_active, "
             "('A' || COALESCE(c.code, SUBSTRING(c.id::text, 1, 8))) AS uuid_label, "
             "cc.name AS category_name, c.category_id, "
             "loc.name AS location_name "
             "FROM customers c "
             "LEFT JOIN customer_categories cc ON cc.id = c.category_id "
             "LEFT JOIN locations loc ON loc.id = c.location_id "
             "WHERE c.id = :id AND c.organization_id = :o"),
        {"id": str(cid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    balance = await db.execute(
        text("SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0) AS bal, "
             "COUNT(*) AS cnt FROM cash_movements WHERE customer_id = :id"),
        {"id": str(cid)},
    )

    sales = await db.execute(
        text("SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS total, "
             "COALESCE(SUM(paid_amount), 0) AS paid, "
             "MAX(sale_date) AS last_sale "
             "FROM sales WHERE customer_id = :id AND organization_id = :o "
             "AND status <> 'cancelled'"),
        {"id": str(cid), "o": org_id},
    )

    movements = await db.execute(
        text("SELECT cm.id, cm.direction, cm.amount, cm.description, cm.movement_date, "
             "cb.name AS cashbox_name, cur.code AS currency_code, "
             "pt.name AS payment_type_name "
             "FROM cash_movements cm "
             "LEFT JOIN cashboxes cb ON cb.id = cm.cashbox_id "
             "LEFT JOIN currencies cur ON cur.id = cm.currency_id "
             "LEFT JOIN payment_types pt ON pt.id = cm.payment_type_id "
             "WHERE cm.customer_id = :id "
             "ORDER BY cm.movement_date DESC LIMIT 50"),
        {"id": str(cid)},
    )

    recent_sales = await db.execute(
        text("SELECT s.id, s.doc_number, s.sale_date, s.total_amount, s.paid_amount, "
             "s.status, w.name AS warehouse_name "
             "FROM sales s LEFT JOIN warehouses w ON w.id = s.warehouse_id "
             "WHERE s.customer_id = :id AND s.organization_id = :o "
             "ORDER BY s.sale_date DESC LIMIT 30"),
        {"id": str(cid), "o": org_id},
    )

    return {
        "head": dict(h._mapping),
        "balance": dict(balance.first()._mapping),
        "sales": dict(sales.first()._mapping),
        "movements": [dict(r._mapping) for r in movements],
        "recent_sales": [dict(r._mapping) for r in recent_sales],
    }


@router.get("/customers/{cid}/balance")
async def customer_one_balance(
    cid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, "
             "COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) "
             "FROM cash_movements WHERE customer_id = c.id), 0) AS balance "
             "FROM customers c WHERE c.id = :id AND c.organization_id = :o"),
        {"id": str(cid), "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return dict(row._mapping)


# =========================================================
# SET-BALANCE (customer)
# =========================================================

class SetBalanceIn(BaseModel):
    new_balance: Decimal
    notes: str | None = None


@router.post("/customers/{cid}/set-balance", status_code=status.HTTP_201_CREATED)
async def set_customer_balance(
    cid: UUID, p: SetBalanceIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    cur = await db.execute(
        text("SELECT COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) "
             "FROM cash_movements WHERE customer_id = :id), 0) AS bal"),
        {"id": str(cid)},
    )
    cur_bal = Decimal(str(cur.scalar() or 0))
    diff = p.new_balance - cur_bal

    await db.execute(
        text("INSERT INTO entity_set_balance "
             "(organization_id, subject_type, subject_id, plan_amount, fact_amount, notes, created_by) "
             "VALUES (:o, 'customer', :s, :p, :f, :n, :u)"),
        {"o": org_id, "s": str(cid), "p": cur_bal, "f": p.new_balance,
         "n": p.notes, "u": user_id},
    )

    if diff != 0:
        await db.execute(
            text("INSERT INTO cash_movements "
                 "(organization_id, direction, amount, customer_id, description, created_by) "
                 "VALUES (:o, :dir, :amt, :c, :d, :u)"),
            {"o": org_id, "dir": "in" if diff > 0 else "out",
             "amt": abs(diff), "c": str(cid),
             "d": f"Корректировка баланса: {p.notes or ''}".strip(),
             "u": user_id},
        )

    await db.commit()
    return {"old_balance": float(cur_bal), "new_balance": float(p.new_balance),
            "diff": float(diff)}


# =========================================================
# IMPORT / EXPORT (CSV)
# =========================================================

@router.get("/customers/export")
async def export_customers(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT code, name, phone, email, tin, address FROM customers "
             "WHERE organization_id = :o AND is_active = TRUE ORDER BY name"),
        {"o": org_id},
    )
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["code", "name", "phone", "email", "tin", "address"])
    for row in res:
        writer.writerow([row.code or "", row.name, row.phone or "",
                         row.email or "", row.tin or "", row.address or ""])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=customers.csv"},
    )


@router.post("/customers/import")
async def import_customers(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Bulk-import customers from CSV.

    Sprint #2 HI-4: chunked 500 rows at a time, atomic (all-or-nothing),
    and the response pinpoints the first failing row so the user can fix
    the file. The previous implementation silently swallowed exceptions,
    which poisoned the session and corrupted later inserts.
    """
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw), delimiter=";")
    rows = list(reader)

    CHUNK = 500
    imported = 0
    errors = []
    buffered: list[dict] = []

    for idx, row in enumerate(rows, start=1):
        name = (row.get("name") or "").strip()
        if not name:
            errors.append({"row": idx, "error": "name is required"})
            continue
        buffered.append({
            "id": str(uuid4()),
            "o": org_id,
            "c": (row.get("code") or "").strip() or None,
            "n": name,
            "p": (row.get("phone") or "").strip() or None,
            "e": (row.get("email") or "").strip() or None,
            "t": (row.get("tin") or "").strip() or None,
            "a": (row.get("address") or "").strip() or None,
        })

        if len(buffered) >= CHUNK:
            try:
                for params in buffered:
                    await db.execute(
                        text("INSERT INTO customers (id, organization_id, code, name, phone, "
                             "email, tin, address) VALUES (:id, :o, :c, :n, :p, :e, :t, :a)"),
                        params,
                    )
                await db.commit()
                imported += len(buffered)
                buffered.clear()
            except Exception as e:
                await db.rollback()
                errors.append({"chunk_end": idx, "error": str(e)[:300]})
                buffered.clear()

    # Oxirgi qoldiq
    if buffered:
        try:
            for params in buffered:
                await db.execute(
                    text("INSERT INTO customers (id, organization_id, code, name, phone, "
                         "email, tin, address) VALUES (:id, :o, :c, :n, :p, :e, :t, :a)"),
                    params,
                )
            await db.commit()
            imported += len(buffered)
            buffered.clear()
        except Exception as e:
            await db.rollback()
            errors.append({"chunk_end": len(rows), "error": str(e)[:300]})

    return {"imported": imported, "errors": errors}


# =========================================================
# ABC ANALYSIS (revenue based)
# =========================================================

@router.get("/abc-analysis")
async def abc_analysis(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        WITH sales_by_cust AS (
            SELECT c.id, c.name,
                   COALESCE(SUM(s.total_amount), 0) AS revenue,
                   COUNT(s.id) AS sales_cnt
            FROM customers c
            LEFT JOIN sales s ON s.customer_id = c.id
                AND s.status <> 'cancelled'
                AND s.organization_id = :o
            WHERE c.organization_id = :o AND c.is_active = TRUE
            GROUP BY c.id, c.name
        ),
        ranked AS (
            SELECT *,
                SUM(revenue) OVER () AS total_rev,
                SUM(revenue) OVER (ORDER BY revenue DESC) AS cum_rev
            FROM sales_by_cust
            WHERE revenue > 0
        )
        SELECT id, name, revenue, sales_cnt,
            CASE
                WHEN total_rev = 0 THEN 'C'
                WHEN cum_rev <= total_rev * 0.80 THEN 'A'
                WHEN cum_rev <= total_rev * 0.95 THEN 'B'
                ELSE 'C'
            END AS abc_class,
            ROUND((revenue / NULLIF(total_rev,0) * 100)::numeric, 2) AS revenue_pct
        FROM ranked
        ORDER BY revenue DESC
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/cashback-turnover")
async def cashback_turnover(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT c.id, c.name,
               COALESCE(SUM(s.total_amount), 0) AS turnover,
               COUNT(s.id) AS sales_cnt,
               ROUND(COALESCE(SUM(s.total_amount) * 0.01, 0)::numeric, 2) AS cashback_1pct
        FROM customers c
        LEFT JOIN sales s ON s.customer_id = c.id
            AND s.status IN ('paid','partial','confirmed')
            AND s.organization_id = :o
        WHERE c.organization_id = :o AND c.is_active = TRUE
        GROUP BY c.id, c.name
        HAVING COALESCE(SUM(s.total_amount), 0) > 0
        ORDER BY turnover DESC
        LIMIT 200
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# CUSTOMER ORDERS (zakaz)
# =========================================================

class OrderItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal
    price: Decimal


class OrderIn(BaseModel):
    customer_id: UUID
    delivery_date: date | None = None
    notes: str | None = None
    items: list[OrderItemIn] = []


@router.get("/orders")
async def list_customer_orders(
    q: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE o.organization_id = :o"
    params: dict = {"o": org_id}
    if q:
        where += " AND (o.doc_number::text ILIKE :q OR c.name ILIKE :q)"
        params["q"] = f"%{q}%"
    if status_filter:
        where += " AND o.status = :st"
        params["st"] = status_filter
    res = await db.execute(
        text(f"SELECT o.id, o.doc_number, o.order_date, o.delivery_date, "
             f"o.status, o.total_amount, o.notes, "
             f"o.customer_id, c.name AS customer_name, c.phone AS customer_phone "
             f"FROM customer_orders o "
             f"LEFT JOIN customers c ON c.id = o.customer_id "
             f"{where} ORDER BY o.order_date DESC, o.created_at DESC LIMIT 200"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_customer_order(
    p: OrderIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    oid = uuid4()
    total = sum(Decimal(str(it.quantity)) * Decimal(str(it.price)) for it in p.items)
    await db.execute(
        text("INSERT INTO customer_orders (id, organization_id, customer_id, "
             "delivery_date, total_amount, notes, created_by) "
             "VALUES (:id, :o, :c, :d, :t, :n, :u)"),
        {"id": str(oid), "o": org_id, "c": str(p.customer_id),
         "d": p.delivery_date, "t": total, "n": p.notes, "u": user_id},
    )
    for it in p.items:
        await db.execute(
            text("INSERT INTO customer_order_items (order_id, product_id, quantity, price) "
                 "VALUES (:o, :p, :q, :pr)"),
            {"o": str(oid), "p": str(it.product_id), "q": it.quantity, "pr": it.price},
        )
    await db.commit()
    return {"id": str(oid), "total_amount": float(total)}


@router.put("/orders/{oid}/status")
async def update_order_status(
    oid: UUID, status_val: str = Query(..., alias="status"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if status_val not in ("new", "confirmed", "shipped", "delivered", "cancelled"):
        raise HTTPException(400, "Invalid status")
    res = await db.execute(
        text("UPDATE customer_orders SET status = :s "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(oid), "o": org_id, "s": status_val},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/orders/{oid}")
async def delete_customer_order(
    oid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM customer_orders WHERE id = :id AND organization_id = :o"),
        {"id": str(oid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# CUSTOMER ANALYTICS DASHBOARD
# =========================================================

@router.get("/analytics-dashboard")
async def customers_analytics_dashboard(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    totals = await db.execute(
        text("SELECT COUNT(*) AS cnt FROM customers WHERE organization_id = :o AND is_active = TRUE"),
        {"o": org_id},
    )
    new_30 = await db.execute(
        text("SELECT COUNT(*) AS cnt FROM customers "
             "WHERE organization_id = :o AND created_at > NOW() - INTERVAL '30 days'"),
        {"o": org_id},
    )
    active_30 = await db.execute(
        text("SELECT COUNT(DISTINCT customer_id) AS cnt FROM sales "
             "WHERE organization_id = :o AND sale_date > CURRENT_DATE - 30 "
             "AND customer_id IS NOT NULL"),
        {"o": org_id},
    )
    avg_check = await db.execute(
        text("SELECT COALESCE(AVG(total_amount), 0) AS avg_check "
             "FROM sales WHERE organization_id = :o AND status <> 'cancelled' "
             "AND sale_date > CURRENT_DATE - 30"),
        {"o": org_id},
    )
    top = await db.execute(
        text("SELECT c.id, c.name, COUNT(s.id) AS sales_cnt, "
             "COALESCE(SUM(s.total_amount), 0) AS revenue "
             "FROM customers c LEFT JOIN sales s ON s.customer_id = c.id "
             "AND s.status <> 'cancelled' "
             "WHERE c.organization_id = :o AND c.is_active = TRUE "
             "GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT 10"),
        {"o": org_id},
    )
    return {
        "total_customers": totals.scalar(),
        "new_30d": new_30.scalar(),
        "active_30d": active_30.scalar(),
        "avg_check_30d": float(avg_check.scalar() or 0),
        "top_customers": [dict(r._mapping) for r in top],
    }


# =========================================================
# CUSTOMER LOCATIONS (map data)
# =========================================================

@router.get("/locations-map")
async def customers_locations(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT loc.id, loc.name, loc.address, loc.phone, "
             "COUNT(c.id) AS customer_count "
             "FROM locations loc "
             "LEFT JOIN customers c ON c.location_id = loc.id AND c.is_active = TRUE "
             "WHERE loc.organization_id = :o AND loc.is_active = TRUE "
             "GROUP BY loc.id, loc.name, loc.address, loc.phone "
             "ORDER BY customer_count DESC"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# MARKETPLACE (customer self-service portal) ORDERS — staff view
# Orders placed by customers via /customer-portal/me/orders land in
# customer_portal_orders with status='new' and no staff-facing screen
# to review them. These endpoints give staff that view.
# =========================================================

PORTAL_ORDER_STATUSES = {"new", "confirmed", "cancelled", "delivered"}


@router.get("/portal-orders")
async def list_portal_orders(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "o.organization_id = :o"
    params: dict = {"o": org_id}
    if status:
        where += " AND o.status = :s"
        params["s"] = status

    res = await db.execute(
        text(f"""
            SELECT o.id, o.order_number, o.status, o.notes, o.total_amount, o.created_at,
                   c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
                   (SELECT COUNT(*) FROM customer_portal_order_items i WHERE i.order_id = o.id) AS item_count
            FROM customer_portal_orders o
            JOIN customers c ON c.id = o.customer_id
            WHERE {where}
            ORDER BY o.created_at DESC
        """),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.get("/portal-orders/{order_id}")
async def get_portal_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    order_res = await db.execute(
        text("""
            SELECT o.id, o.order_number, o.status, o.notes, o.total_amount, o.created_at,
                   c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
            FROM customer_portal_orders o
            JOIN customers c ON c.id = o.customer_id
            WHERE o.id = :id AND o.organization_id = :o
        """),
        {"id": str(order_id), "o": org_id},
    )
    order = order_res.first()
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Buyurtma topilmadi")

    items_res = await db.execute(
        text("""
            SELECT i.id, i.product_id, p.name AS product_name, p.sku,
                   i.quantity, i.note, p.sale_price AS unit_price,
                   (i.quantity * COALESCE(p.sale_price, 0)) AS line_total
            FROM customer_portal_order_items i
            JOIN products p ON p.id = i.product_id
            WHERE i.order_id = :id
        """),
        {"id": str(order_id)},
    )
    return {
        **dict(order._mapping),
        "items": [dict(r._mapping) for r in items_res],
    }


class PortalOrderStatusIn(BaseModel):
    status: str


@router.put("/portal-orders/{order_id}/status")
async def update_portal_order_status(
    order_id: UUID,
    body: PortalOrderStatusIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if body.status not in PORTAL_ORDER_STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Noto'g'ri status")

    res = await db.execute(
        text("""
            UPDATE customer_portal_orders SET status = :s
            WHERE id = :id AND organization_id = :o
            RETURNING id
        """),
        {"s": body.status, "id": str(order_id), "o": org_id},
    )
    if not res.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Buyurtma topilmadi")
    await db.commit()
    return {"ok": True, "status": body.status}

