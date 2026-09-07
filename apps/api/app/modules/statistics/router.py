import csv
import io
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id
from app.modules.rbac.deps import require_permission


router = APIRouter(prefix="/statistics", tags=["statistics"])


# =========================================================
# CORE DASHBOARD
# =========================================================

@router.get("/dashboard")
async def dashboard(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    today = await db.execute(
        text("SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS revenue "
             "FROM sales WHERE organization_id = :o "
             "AND sale_date >= CURRENT_DATE AND status <> 'cancelled'"),
        {"o": org_id},
    )
    today_row = today.first()

    month = await db.execute(
        text("SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS revenue "
             "FROM sales WHERE organization_id = :o "
             "AND sale_date >= DATE_TRUNC('month', CURRENT_DATE) AND status <> 'cancelled'"),
        {"o": org_id},
    )
    month_row = month.first()

    cashboxes = await db.execute(
        text("SELECT COALESCE(SUM(balance),0) AS total FROM cashboxes WHERE organization_id = :o"),
        {"o": org_id},
    )

    debt = await db.execute(
        text("SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS d "
             "FROM sales WHERE organization_id = :o AND status <> 'cancelled'"),
        {"o": org_id},
    )

    stock_val = await db.execute(
        text("SELECT COALESCE(SUM(total_value), 0) AS v FROM v_stock_value "
             "WHERE organization_id = :o"),
        {"o": org_id},
    )

    return {
        "today_sales": today_row.cnt,
        "today_revenue": float(today_row.revenue or 0),
        "month_sales": month_row.cnt,
        "month_revenue": float(month_row.revenue or 0),
        "cash_total": float(cashboxes.scalar() or 0),
        "total_debt": float(debt.scalar() or 0),
        "stock_value": float(stock_val.scalar() or 0),
    }


@router.get("/daily-revenue")
async def daily_revenue(
    days: int = Query(14, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Last N days revenue + count per day (for dashboard sparkline/bar chart)."""
    rows = await db.execute(
        text("""
            SELECT
                sale_date::date AS date,
                COUNT(*) AS count,
                COALESCE(SUM(total_amount), 0) AS revenue
            FROM sales
            WHERE organization_id = :o
              AND sale_date >= CURRENT_DATE - (:days * INTERVAL '1 day')
              AND status <> 'cancelled'
            GROUP BY 1
            ORDER BY 1
        """),
        {"o": org_id, "days": days},
    )
    return [
        {"date": str(r.date), "count": r.count, "revenue": float(r.revenue or 0)}
        for r in rows
    ]


@router.get("/sales-summary")
async def sales_summary(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT day, sales_count, revenue, paid, debt FROM v_sales_summary "
             "WHERE organization_id = :o AND day BETWEEN :df AND :dt ORDER BY day"),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


@router.get("/stock-value")
async def stock_value(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT warehouse_id, total_value, sku_in_stock FROM v_stock_value "
             "WHERE organization_id = :o"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# CASHBOX STATS
# =========================================================

@router.get("/cashbox")
async def cashbox_stats(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT movement_date::date AS day, "
             "SUM(CASE WHEN direction='in' THEN amount ELSE 0 END) AS inflow, "
             "SUM(CASE WHEN direction='out' THEN amount ELSE 0 END) AS outflow, "
             "COUNT(*) AS cnt "
             "FROM cash_movements WHERE organization_id = :o "
             "  AND movement_date >= :df "
             "  AND movement_date < (CAST(:dt AS date) + INTERVAL '1 day') "
             "GROUP BY 1 ORDER BY 1"),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# PRODUCT STATS
# =========================================================

@router.get("/products")
async def top_products(
    date_from: date = Query(...),
    date_to: date = Query(...),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(f"SELECT p.id, p.name, p.sku, "
             f"SUM(si.quantity) AS qty, SUM(si.amount) AS revenue, "
             f"COUNT(DISTINCT s.id) AS sales_cnt "
             f"FROM sale_items si JOIN sales s ON s.id = si.sale_id "
             f"JOIN products p ON p.id = si.product_id "
             f"WHERE s.organization_id = :o AND s.status <> 'cancelled' "
             f"AND s.sale_date >= :df AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day') "
             f"GROUP BY p.id, p.name, p.sku "
             f"ORDER BY revenue DESC LIMIT :lim"),
        {"o": org_id, "df": date_from, "dt": date_to, "lim": limit},
    )
    return [dict(r._mapping) for r in res]


@router.get("/unsold-goods")
async def unsold_goods(
    days: int = Query(30),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(f"""
        SELECT p.id, p.name, p.sku, p.sale_price,
               COALESCE(SUM(sb.quantity), 0) AS stock_qty,
               (SELECT MAX(s.sale_date) FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                WHERE si.product_id = p.id) AS last_sale
        FROM products p
        LEFT JOIN stock_balances sb ON sb.product_id = p.id
        WHERE p.organization_id = :o AND p.is_active = TRUE AND p.is_service = FALSE
        GROUP BY p.id, p.name, p.sku, p.sale_price
        HAVING COALESCE(SUM(sb.quantity), 0) > 0
        AND (
            (SELECT MAX(s.sale_date) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.product_id = p.id)
            IS NULL
            OR
            (SELECT MAX(s.sale_date) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.product_id = p.id)
            < NOW() - INTERVAL '{days} days'
        )
        ORDER BY stock_qty DESC LIMIT 200
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/product-stock-history")
async def stock_history(
    product_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    # Derived from sales (- qty) and supplies (+ qty), since no audit table.
    where_p = "AND si.product_id = :p" if product_id else ""
    where_p_sup = "AND supi.product_id = :p" if product_id else ""
    params: dict = {"o": org_id}
    if product_id:
        params["p"] = product_id

    res = await db.execute(
        text(f"""
        WITH movements AS (
            SELECT s.sale_date::date AS day, si.product_id, -si.quantity AS qty
            FROM sale_items si JOIN sales s ON s.id = si.sale_id
            WHERE s.organization_id = :o AND s.status <> 'cancelled' {where_p}
            UNION ALL
            SELECT su.supply_date AS day, supi.product_id, supi.quantity AS qty
            FROM supply_items supi JOIN supplies su ON su.id = supi.supply_id
            WHERE su.organization_id = :o {where_p_sup}
        )
        SELECT day, product_id, SUM(qty) AS net_change
        FROM movements
        GROUP BY day, product_id
        ORDER BY day DESC
        LIMIT 500
        """),
        params,
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# SALE BREAKDOWNS
# =========================================================

@router.get("/sale-by-category")
async def sale_by_category(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT COALESCE(pc.name, '— без категории —') AS category,
               COUNT(DISTINCT s.id) AS sales_cnt,
               SUM(si.quantity) AS qty,
               SUM(si.amount) AS revenue
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        WHERE s.organization_id = :o AND s.status <> 'cancelled'
          AND s.sale_date >= :df AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')
        GROUP BY pc.name
        ORDER BY revenue DESC
        """),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


@router.get("/sale-by-employee")
async def sale_by_employee(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT COALESCE(u.full_name, '— не указан —') AS employee,
               COUNT(s.id) AS sales_cnt,
               SUM(s.total_amount) AS revenue,
               AVG(s.total_amount) AS avg_check
        FROM sales s LEFT JOIN users u ON u.id = s.created_by
        WHERE s.organization_id = :o AND s.status <> 'cancelled'
          AND s.sale_date >= :df AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')
        GROUP BY u.full_name
        ORDER BY revenue DESC
        """),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


@router.get("/sale-by-customer")
async def sale_by_customer(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT COALESCE(c.name, '— розничный —') AS customer,
               COUNT(s.id) AS sales_cnt,
               SUM(s.total_amount) AS revenue,
               SUM(s.paid_amount) AS paid,
               SUM(s.total_amount - s.paid_amount) AS debt
        FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.organization_id = :o AND s.status <> 'cancelled'
          AND s.sale_date >= :df AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')
        GROUP BY c.name
        ORDER BY revenue DESC LIMIT 200
        """),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


@router.get("/sale-by-payment-type")
async def sale_by_payment_type(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT COALESCE(pt.name, '— не указан —') AS payment_type,
               COUNT(cm.id) AS payments_cnt,
               SUM(cm.amount) AS total
        FROM cash_movements cm
        LEFT JOIN payment_types pt ON pt.id = cm.payment_type_id
        WHERE cm.organization_id = :o AND cm.direction = 'in'
          AND cm.sale_id IS NOT NULL
          AND cm.movement_date >= :df
          AND cm.movement_date < (CAST(:dt AS date) + INTERVAL '1 day')
        GROUP BY pt.name
        ORDER BY total DESC
        """),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


@router.get("/customer-activity")
async def customer_activity(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT c.id, c.name,
               MAX(s.sale_date) AS last_sale,
               COUNT(s.id) AS sales_cnt,
               COALESCE(SUM(s.total_amount), 0) AS revenue,
               (CURRENT_DATE - MAX(s.sale_date)::date) AS days_inactive
        FROM customers c
        LEFT JOIN sales s ON s.customer_id = c.id AND s.status <> 'cancelled'
        WHERE c.organization_id = :o AND c.is_active = TRUE
        GROUP BY c.id, c.name
        ORDER BY last_sale DESC NULLS LAST
        LIMIT 200
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# PRODUCTION STATS
# =========================================================

@router.get("/production")
async def production_stats(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT DATE_TRUNC('day', finished_at)::date AS day,
               COUNT(*) AS orders_cnt,
               SUM(produced_qty) AS produced
        FROM production_orders
        WHERE organization_id = :o AND status = 'completed'
          AND finished_at >= :df AND finished_at < (CAST(:dt AS date) + INTERVAL '1 day')
        GROUP BY 1 ORDER BY 1
        """),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


@router.get("/recommended-production")
async def recommended_production(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Mahsulotlar, qaysiki BOM bor va stock minimumdan past."""
    res = await db.execute(
        text("""
        SELECT p.id, p.name, p.sku,
               COALESCE(SUM(sb.quantity), 0) AS current_qty,
               COALESCE(MIN(rs.min_qty), 0) AS min_qty,
               (COALESCE(MIN(rs.min_qty), 0) - COALESCE(SUM(sb.quantity), 0)) AS need_to_produce
        FROM products p
        JOIN bom b ON b.product_id = p.id AND b.is_active = TRUE
        LEFT JOIN stock_balances sb ON sb.product_id = p.id
        LEFT JOIN recommended_stock rs ON rs.product_id = p.id
        WHERE p.organization_id = :o AND p.is_active = TRUE
        GROUP BY p.id, p.name, p.sku
        HAVING COALESCE(SUM(sb.quantity), 0) < COALESCE(MIN(rs.min_qty), 0)
        ORDER BY (COALESCE(MIN(rs.min_qty), 0) - COALESCE(SUM(sb.quantity), 0)) DESC
        LIMIT 200
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# COGS REPORT
# =========================================================

@router.get("/cogs", dependencies=[Depends(require_permission("statistics.cogs.view"))])
async def cogs_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    warehouse_id: int | None = Query(None),
    category_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """COGS (Cost of Goods Sold) + gross profit report by product and category."""
    where = (
        "s.organization_id = :o "
        "AND s.status IN ('confirmed', 'paid', 'partial') "
        "AND s.sale_date >= :df "
        "AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')"
    )
    params: dict = {"o": org_id, "df": date_from, "dt": date_to}

    if warehouse_id is not None:
        where += " AND s.warehouse_id = :wh"
        params["wh"] = warehouse_id

    category_join = ""
    if category_id is not None:
        category_join = "JOIN products p2 ON p2.id = si.product_id AND p2.category_id = :cat"
        params["cat"] = category_id

    by_product_sql = f"""
        SELECT
            p.id::text AS product_id,
            p.name AS product_name,
            SUM(si.quantity) AS sold_qty,
            SUM(si.quantity * si.price) AS revenue,
            SUM(si.quantity * COALESCE(si.unit_cost, 0)) AS cogs,
            SUM(si.quantity * si.price - si.quantity * COALESCE(si.unit_cost, 0)) AS profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        {category_join}
        WHERE {where}
        GROUP BY p.id, p.name
        ORDER BY profit DESC
    """

    by_category_sql = f"""
        SELECT
            pc.id AS category_id,
            COALESCE(pc.name, '— kategoriyasiz —') AS category_name,
            SUM(si.quantity * si.price) AS revenue,
            SUM(si.quantity * COALESCE(si.unit_cost, 0)) AS cogs,
            SUM(si.quantity * si.price - si.quantity * COALESCE(si.unit_cost, 0)) AS profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        WHERE {where}
        GROUP BY pc.id, pc.name
        ORDER BY profit DESC
    """

    by_warehouse_sql = f"""
        SELECT
            w.id AS warehouse_id,
            w.name AS warehouse_name,
            SUM(si.quantity * si.price) AS revenue,
            SUM(si.quantity * COALESCE(si.unit_cost, 0)) AS cogs,
            SUM(si.quantity * si.price - si.quantity * COALESCE(si.unit_cost, 0)) AS profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN warehouses w ON w.id = s.warehouse_id
        WHERE {where}
        GROUP BY w.id, w.name
        ORDER BY profit DESC
    """

    prod_res = await db.execute(text(by_product_sql), params)
    cat_res = await db.execute(text(by_category_sql), params)
    wh_res = await db.execute(text(by_warehouse_sql), params)

    by_product = []
    total_revenue = Decimal("0")
    total_cogs = Decimal("0")
    for r in prod_res:
        rev = Decimal(str(r.revenue or 0))
        cogs = Decimal(str(r.cogs or 0))
        profit = Decimal(str(r.profit or 0))
        margin = float(round(profit / rev * 100, 2)) if rev else 0.0
        total_revenue += rev
        total_cogs += cogs
        by_product.append({
            "product_id": r.product_id,
            "product_name": r.product_name,
            "sold_qty": float(r.sold_qty or 0),
            "revenue": str(rev),
            "cogs": str(cogs),
            "profit": str(profit),
            "margin_pct": margin,
        })

    total_gross_profit = total_revenue - total_cogs
    gross_margin_pct = float(round(total_gross_profit / total_revenue * 100, 2)) if total_revenue else 0.0

    by_category = []
    for r in cat_res:
        rev = Decimal(str(r.revenue or 0))
        cogs = Decimal(str(r.cogs or 0))
        profit = Decimal(str(r.profit or 0))
        by_category.append({
            "category_id": r.category_id,
            "category_name": r.category_name,
            "revenue": str(rev),
            "cogs": str(cogs),
            "profit": str(profit),
            "margin_pct": float(round(profit / rev * 100, 2)) if rev else 0.0,
        })

    by_warehouse = []
    for r in wh_res:
        rev = Decimal(str(r.revenue or 0))
        cogs = Decimal(str(r.cogs or 0))
        profit = Decimal(str(r.profit or 0))
        by_warehouse.append({
            "warehouse_id": r.warehouse_id,
            "warehouse_name": r.warehouse_name,
            "revenue": str(rev),
            "cogs": str(cogs),
            "profit": str(profit),
            "margin_pct": float(round(profit / rev * 100, 2)) if rev else 0.0,
        })

    return {
        "period": {"from": str(date_from), "to": str(date_to)},
        "total_revenue": str(total_revenue),
        "total_cogs": str(total_cogs),
        "gross_profit": str(total_gross_profit),
        "gross_margin_pct": gross_margin_pct,
        "by_product": by_product,
        "by_category": by_category,
        "by_warehouse": by_warehouse,
    }


# =========================================================
# CSV EXPORT
# =========================================================

VALID_REPORTS = {
    "products", "sale-by-category", "sale-by-employee",
    "sale-by-customer", "sale-by-payment-type",
    "customer-activity", "unsold-goods", "recommended-production",
    "cogs",
}


@router.get("/export/{report}")
async def export_report(
    report: str,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Universal CSV eksport for tracked reports."""
    if report not in VALID_REPORTS:
        raise HTTPException(400, f"Unknown report: {report}")

    # Build query per report
    if report == "products":
        sql = """SELECT p.name, p.sku, SUM(si.quantity) AS qty, SUM(si.amount) AS revenue
                 FROM sale_items si JOIN sales s ON s.id = si.sale_id
                 JOIN products p ON p.id = si.product_id
                 WHERE s.organization_id = :o AND s.status <> 'cancelled'
                   AND s.sale_date >= :df AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')
                 GROUP BY p.name, p.sku ORDER BY revenue DESC"""
        params = {"o": org_id, "df": date_from, "dt": date_to}
    elif report == "sale-by-category":
        sql = """SELECT COALESCE(pc.name, 'без категории') AS category,
                        SUM(si.quantity) AS qty, SUM(si.amount) AS revenue
                 FROM sale_items si JOIN sales s ON s.id = si.sale_id
                 JOIN products p ON p.id = si.product_id
                 LEFT JOIN product_categories pc ON pc.id = p.category_id
                 WHERE s.organization_id = :o AND s.status <> 'cancelled'
                   AND s.sale_date >= :df AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')
                 GROUP BY pc.name ORDER BY revenue DESC"""
        params = {"o": org_id, "df": date_from, "dt": date_to}
    elif report == "sale-by-employee":
        sql = """SELECT COALESCE(u.full_name, '—') AS employee,
                        COUNT(s.id) AS sales, SUM(s.total_amount) AS revenue
                 FROM sales s LEFT JOIN users u ON u.id = s.created_by
                 WHERE s.organization_id = :o AND s.status <> 'cancelled'
                   AND s.sale_date >= :df AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')
                 GROUP BY u.full_name ORDER BY revenue DESC"""
        params = {"o": org_id, "df": date_from, "dt": date_to}
    elif report == "sale-by-customer":
        sql = """SELECT COALESCE(c.name, 'розничный') AS customer,
                        COUNT(s.id) AS sales, SUM(s.total_amount) AS revenue,
                        SUM(s.total_amount - s.paid_amount) AS debt
                 FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
                 WHERE s.organization_id = :o AND s.status <> 'cancelled'
                   AND s.sale_date >= :df AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')
                 GROUP BY c.name ORDER BY revenue DESC"""
        params = {"o": org_id, "df": date_from, "dt": date_to}
    elif report == "sale-by-payment-type":
        sql = """SELECT COALESCE(pt.name, '—') AS payment_type,
                        COUNT(cm.id) AS cnt, SUM(cm.amount) AS total
                 FROM cash_movements cm LEFT JOIN payment_types pt ON pt.id = cm.payment_type_id
                 WHERE cm.organization_id = :o AND cm.direction = 'in' AND cm.sale_id IS NOT NULL
                   AND cm.movement_date >= :df
                   AND cm.movement_date < (CAST(:dt AS date) + INTERVAL '1 day')
                 GROUP BY pt.name ORDER BY total DESC"""
        params = {"o": org_id, "df": date_from, "dt": date_to}
    elif report == "customer-activity":
        sql = """SELECT c.name, MAX(s.sale_date) AS last_sale, COUNT(s.id) AS sales,
                        COALESCE(SUM(s.total_amount), 0) AS revenue
                 FROM customers c LEFT JOIN sales s ON s.customer_id = c.id AND s.status <> 'cancelled'
                 WHERE c.organization_id = :o AND c.is_active = TRUE
                 GROUP BY c.name ORDER BY last_sale DESC NULLS LAST"""
        params = {"o": org_id}
    elif report == "unsold-goods":
        sql = """SELECT p.name, p.sku, COALESCE(SUM(sb.quantity), 0) AS stock_qty,
                        (SELECT MAX(s.sale_date) FROM sale_items si JOIN sales s ON s.id = si.sale_id
                         WHERE si.product_id = p.id) AS last_sale
                 FROM products p LEFT JOIN stock_balances sb ON sb.product_id = p.id
                 WHERE p.organization_id = :o AND p.is_active = TRUE AND p.is_service = FALSE
                 GROUP BY p.id, p.name, p.sku
                 HAVING COALESCE(SUM(sb.quantity), 0) > 0
                 ORDER BY last_sale ASC NULLS FIRST"""
        params = {"o": org_id}
    elif report == "cogs":
        sql = """SELECT p.name AS product_name, p.sku,
                        SUM(si.quantity) AS sold_qty,
                        SUM(si.quantity * si.price) AS revenue,
                        SUM(si.quantity * COALESCE(si.unit_cost, 0)) AS cogs,
                        SUM(si.quantity * si.price - si.quantity * COALESCE(si.unit_cost, 0)) AS profit
                 FROM sale_items si
                 JOIN sales s ON s.id = si.sale_id
                 JOIN products p ON p.id = si.product_id
                 WHERE s.organization_id = :o
                   AND s.status IN ('confirmed', 'paid', 'partial')
                   AND s.sale_date >= :df AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')
                 GROUP BY p.id, p.name, p.sku
                 ORDER BY profit DESC"""
        params = {"o": org_id, "df": date_from, "dt": date_to}
    else:  # recommended-production
        sql = """SELECT p.name, p.sku,
                        COALESCE(SUM(sb.quantity), 0) AS current_qty,
                        COALESCE(MIN(rs.min_qty), 0) AS min_qty
                 FROM products p JOIN bom b ON b.product_id = p.id AND b.is_active = TRUE
                 LEFT JOIN stock_balances sb ON sb.product_id = p.id
                 LEFT JOIN recommended_stock rs ON rs.product_id = p.id
                 WHERE p.organization_id = :o AND p.is_active = TRUE
                 GROUP BY p.id, p.name, p.sku
                 HAVING COALESCE(SUM(sb.quantity), 0) < COALESCE(MIN(rs.min_qty), 0)"""
        params = {"o": org_id}

    res = await db.execute(text(sql), params)
    rows = list(res)

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    if rows:
        writer.writerow(rows[0]._mapping.keys())
        for r in rows:
            writer.writerow([v if v is not None else "" for v in r._mapping.values()])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={report}.csv"},
    )
