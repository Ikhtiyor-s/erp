"""
Tool catalog for the AI assistant.

These tools let the LLM query the ERP database (read-only) to answer
business questions like "this month's top customer" or "how much do
we owe suppliers".

Each tool has:
  - name: unique identifier
  - description: shown to the LLM
  - input_schema: JSON Schema for arguments
  - executor: async function (db, org_id, **args) -> JSON-serializable result
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Awaitable, Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


Executor = Callable[..., Awaitable[Any]]


# -------------------------------------------------------------------------
# Tool implementations
# -------------------------------------------------------------------------

async def get_sales_summary(db: AsyncSession, org_id: str,
                            date_from: str | None = None,
                            date_to: str | None = None) -> dict:
    """Return revenue and count for the given date range (default: last 30 days)."""
    df = date.fromisoformat(date_from) if date_from else date.today() - timedelta(days=30)
    dt = date.fromisoformat(date_to) if date_to else date.today()

    res = await db.execute(
        text("""
            SELECT COUNT(*) AS cnt,
                   COALESCE(SUM(total_amount), 0) AS revenue,
                   COALESCE(SUM(paid_amount), 0) AS paid,
                   COALESCE(SUM(total_amount - paid_amount), 0) AS debt
            FROM sales
            WHERE organization_id = :o
              AND sale_date >= :df
              AND sale_date < (CAST(:dt AS date) + INTERVAL '1 day')
              AND status != 'cancelled'
        """),
        {"o": org_id, "df": df, "dt": dt},
    )
    r = res.first()
    return {
        "period": f"{df.isoformat()} → {dt.isoformat()}",
        "sales_count": r.cnt,
        "revenue": float(r.revenue),
        "paid": float(r.paid),
        "debt": float(r.debt),
    }


async def get_top_customers(db: AsyncSession, org_id: str, limit: int = 5,
                            days: int = 30) -> list[dict]:
    """Top customers by revenue in the given period."""
    res = await db.execute(
        text("""
            SELECT c.id, c.name, COUNT(s.id) AS sale_count,
                   COALESCE(SUM(s.total_amount), 0) AS revenue
            FROM sales s JOIN customers c ON c.id = s.customer_id
            WHERE s.organization_id = :o
              AND s.sale_date >= NOW() - (:d || ' days')::interval
              AND s.status != 'cancelled'
            GROUP BY c.id, c.name
            ORDER BY revenue DESC
            LIMIT :lim
        """),
        {"o": org_id, "d": str(days), "lim": limit},
    )
    return [
        {"customer": r.name, "sales": r.sale_count, "revenue": float(r.revenue)}
        for r in res
    ]


async def get_top_products(db: AsyncSession, org_id: str, limit: int = 10,
                           days: int = 30) -> list[dict]:
    """Top selling products by quantity in the given period."""
    res = await db.execute(
        text("""
            SELECT p.id, p.name,
                   COALESCE(SUM(si.quantity), 0) AS qty,
                   COALESCE(SUM(si.amount), 0) AS revenue
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            WHERE s.organization_id = :o
              AND s.sale_date >= NOW() - (:d || ' days')::interval
              AND s.status != 'cancelled'
            GROUP BY p.id, p.name
            ORDER BY qty DESC
            LIMIT :lim
        """),
        {"o": org_id, "d": str(days), "lim": limit},
    )
    return [
        {"product": r.name, "quantity": float(r.qty), "revenue": float(r.revenue)}
        for r in res
    ]


async def get_low_stock(db: AsyncSession, org_id: str, limit: int = 20) -> list[dict]:
    """Products at or below minimum stock level."""
    res = await db.execute(
        text("""
            SELECT p.name, w.name AS warehouse, sb.quantity,
                   COALESCE(rs.min_qty, 0) AS minimum
            FROM stock_balances sb
            JOIN warehouses w ON w.id = sb.warehouse_id
            JOIN products p ON p.id = sb.product_id
            LEFT JOIN recommended_stock rs
                ON rs.product_id = sb.product_id AND rs.warehouse_id = sb.warehouse_id
            WHERE w.organization_id = :o
              AND sb.quantity <= COALESCE(rs.min_qty, 5)
            ORDER BY sb.quantity ASC
            LIMIT :lim
        """),
        {"o": org_id, "lim": limit},
    )
    return [
        {"product": r.name, "warehouse": r.warehouse,
         "quantity": float(r.quantity), "minimum": float(r.minimum)}
        for r in res
    ]


async def get_customer_debts(db: AsyncSession, org_id: str, limit: int = 20) -> list[dict]:
    """Customers with outstanding debts (sales not fully paid)."""
    res = await db.execute(
        text("""
            SELECT c.name, c.phone,
                   COUNT(s.id) AS unpaid_count,
                   COALESCE(SUM(s.total_amount - s.paid_amount), 0) AS total_debt
            FROM sales s JOIN customers c ON c.id = s.customer_id
            WHERE s.organization_id = :o
              AND s.status IN ('partial', 'confirmed')
              AND (s.total_amount - s.paid_amount) > 0
            GROUP BY c.id, c.name, c.phone
            HAVING COALESCE(SUM(s.total_amount - s.paid_amount), 0) > 0
            ORDER BY total_debt DESC
            LIMIT :lim
        """),
        {"o": org_id, "lim": limit},
    )
    return [
        {"customer": r.name, "phone": r.phone,
         "unpaid_sales": r.unpaid_count, "debt": float(r.total_debt)}
        for r in res
    ]


async def get_cashbox_balances(db: AsyncSession, org_id: str) -> list[dict]:
    """Current balance of all active cashboxes."""
    res = await db.execute(
        text("""
            SELECT c.name, c.balance, cur.code AS currency
            FROM cashboxes c
            LEFT JOIN currencies cur ON cur.id = c.currency_id
            WHERE c.organization_id = :o AND c.is_active = TRUE
            ORDER BY c.name
        """),
        {"o": org_id},
    )
    return [
        {"cashbox": r.name, "balance": float(r.balance), "currency": r.currency}
        for r in res
    ]


# -------------------------------------------------------------------------
# Tool catalog (LLM-facing)
# -------------------------------------------------------------------------

TOOLS: list[dict] = [
    {
        "name": "get_sales_summary",
        "description": "Get total sales revenue, count, paid amount and debt for a date range. "
                       "Default range is last 30 days.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date_from": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "ISO date YYYY-MM-DD"},
            },
        },
    },
    {
        "name": "get_top_customers",
        "description": "Top customers by revenue in last N days.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "default": 5},
                "days": {"type": "integer", "default": 30},
            },
        },
    },
    {
        "name": "get_top_products",
        "description": "Best-selling products by quantity in last N days.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "default": 10},
                "days": {"type": "integer", "default": 30},
            },
        },
    },
    {
        "name": "get_low_stock",
        "description": "Products at or below recommended minimum stock.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "default": 20}},
        },
    },
    {
        "name": "get_customer_debts",
        "description": "Customers with outstanding (unpaid) sale debts.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "default": 20}},
        },
    },
    {
        "name": "get_cashbox_balances",
        "description": "Current balances of all active cashboxes in the org.",
        "input_schema": {"type": "object", "properties": {}},
    },
]


EXECUTORS: dict[str, Executor] = {
    "get_sales_summary": get_sales_summary,
    "get_top_customers": get_top_customers,
    "get_top_products": get_top_products,
    "get_low_stock": get_low_stock,
    "get_customer_debts": get_customer_debts,
    "get_cashbox_balances": get_cashbox_balances,
}


async def execute_tool(name: str, db: AsyncSession, org_id: str, **args) -> Any:
    """Execute a tool by name with given args."""
    fn = EXECUTORS.get(name)
    if not fn:
        return {"error": f"Unknown tool: {name}"}
    try:
        return await fn(db, org_id, **args)
    except Exception as e:
        return {"error": str(e)}
