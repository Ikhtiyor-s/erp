import logging
from datetime import datetime, UTC
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


PRODUCT_TYPE_LABELS: dict[str | None, str] = {
    "finished": "Tayyor mahsulot",
    "raw": "Xom ashyo",
    "semi": "Yarim tayyor",
    "service": "Xizmat",
    None: "",
}


async def _stock_qty(db: AsyncSession, warehouse_id: int, product_id: str) -> Decimal:
    res = await db.execute(
        text(
            "SELECT COALESCE(quantity, 0) FROM stock_balances "
            "WHERE warehouse_id = :w AND product_id = :p"
        ),
        {"w": warehouse_id, "p": product_id},
    )
    val = res.scalar()
    return Decimal(str(val)) if val is not None else Decimal("0")


async def _stock_apply(
    db: AsyncSession,
    warehouse_id: int,
    product_id: str,
    delta_qty: Decimal,
    cost: Decimal | None = None,
    *,
    allow_negative: bool = False,
) -> None:
    """
    Apply +/- delta to stock_balances within the caller's transaction.
    Raises HTTPException(422) if allow_negative=False and resulting qty < 0.
    Callers MUST NOT commit inside this function; commit belongs to the caller.
    """
    if delta_qty == 0:
        return
    if not allow_negative and delta_qty < 0:
        current = await _stock_qty(db, warehouse_id, product_id)
        if current + delta_qty < 0:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Insufficient stock: warehouse={warehouse_id} "
                    f"product={product_id} on_hand={current} requested={-delta_qty}"
                ),
            )
    if delta_qty > 0 and cost is not None:
        await db.execute(
            text(
                "INSERT INTO stock_balances (warehouse_id, product_id, quantity, avg_cost) "
                "VALUES (:w, :p, :q, :c) "
                "ON CONFLICT (warehouse_id, product_id) DO UPDATE "
                "SET quantity = stock_balances.quantity + :q, "
                "    avg_cost = ((stock_balances.quantity * stock_balances.avg_cost) + (:q * :c)) "
                "             / NULLIF(stock_balances.quantity + :q, 0), "
                "    updated_at = NOW()"
            ),
            {"w": warehouse_id, "p": product_id, "q": delta_qty, "c": cost},
        )
    else:
        await db.execute(
            text(
                "INSERT INTO stock_balances (warehouse_id, product_id, quantity, avg_cost) "
                "VALUES (:w, :p, :q, 0) "
                "ON CONFLICT (warehouse_id, product_id) DO UPDATE "
                "SET quantity = stock_balances.quantity + :q, updated_at = NOW()"
            ),
            {"w": warehouse_id, "p": product_id, "q": delta_qty},
        )


async def get_on_hand_batch(
    db: AsyncSession,
    warehouse_id: int,
    product_ids: list[str],
) -> dict[str, Decimal]:
    """
    Returns {product_id: on_hand_qty} for all requested product_ids in one query.
    Missing rows return Decimal("0"). Never returns None values.
    Relies on warehouse_id belonging to the org (stock_balances has no org column).
    NOTE: idx_stock_wh(warehouse_id) is used; composite (warehouse_id, product_id)
          index missing — tracked as found-debt for future optimization.
    """
    if not product_ids:
        return {}
    res = await db.execute(
        text(
            "SELECT product_id, COALESCE(quantity, 0) AS qty "
            "FROM stock_balances "
            "WHERE warehouse_id = :w AND product_id = ANY(CAST(:ids AS uuid[]))"
        ),
        {"w": warehouse_id, "ids": product_ids},
    )
    result = {str(r.product_id): Decimal(str(r.qty)) for r in res}
    for pid in product_ids:
        result.setdefault(pid, Decimal("0"))
    return result


async def get_products_paginated(
    db: AsyncSession,
    org_id: str,
    warehouse_id: int,
    page: int,
    limit: int,
    q: str | None,
    category_id: int | None,
    product_type: str | None,
) -> dict[str, Any]:
    """
    Returns paginated product list with on_hand quantities for the given warehouse.

    on_hand is sourced from stock_balances via LEFT JOIN (single query, no N+1).
    idx_stock_wh(warehouse_id) is used for the join; composite (warehouse_id, product_id)
    index is missing — tracked as found-debt for future optimization.
    Org isolation: products filtered by organization_id; stock_balances joined via
    warehouse_id which itself belongs to the org (stock_balances has no org column — FOUND-DEBT-001).
    """
    where_clauses = ["p.organization_id = :o", "p.is_active = TRUE"]
    params: dict[str, Any] = {
        "o": org_id,
        "wid": warehouse_id,
        "lim": limit,
        "off": (page - 1) * limit,
    }

    if q:
        where_clauses.append("(p.name ILIKE :q OR p.sku ILIKE :q)")
        params["q"] = f"%{q}%"

    if category_id is not None:
        where_clauses.append("p.category_id = :cat")
        params["cat"] = category_id

    if product_type:
        where_clauses.append("p.product_type = :pt")
        params["pt"] = product_type

    where_sql = " AND ".join(where_clauses)

    count_res = await db.execute(
        text(
            f"SELECT COUNT(*) FROM products p WHERE {where_sql}"
        ),
        params,
    )
    total: int = count_res.scalar() or 0

    rows_res = await db.execute(
        text(
            f"SELECT p.id, p.name, p.sku, p.product_type, "
            f"p.category_id, p.unit_id, p.default_cell_id, "
            f"cat.name AS category_name, "
            f"un.short_name AS unit_name, "
            f"COALESCE(sb.quantity, 0) AS on_hand, "
            f"wc.code AS default_cell_code "
            f"FROM products p "
            f"LEFT JOIN stock_balances sb "
            f"       ON sb.warehouse_id = :wid AND sb.product_id = p.id "
            f"LEFT JOIN warehouse_cells wc ON wc.id = p.default_cell_id "
            f"LEFT JOIN product_categories cat ON cat.id = p.category_id "
            f"LEFT JOIN units un ON un.id = p.unit_id "
            f"WHERE {where_sql} "
            f"ORDER BY p.name "
            f"LIMIT :lim OFFSET :off"
        ),
        params,
    )

    items = []
    for r in rows_res:
        m = dict(r._mapping)
        pt = m.get("product_type")
        m["product_type_label"] = PRODUCT_TYPE_LABELS.get(pt, "")
        m["on_hand"] = float(m["on_hand"])
        m["id"] = str(m["id"])
        if m.get("default_cell_id") is not None:
            m["default_cell_id"] = str(m["default_cell_id"])
        items.append(m)

    return {"total": total, "page": page, "limit": limit, "items": items}


async def _bom_check_cycle(
    db: AsyncSession,
    org_id: str,
    parent_product_id: str,
    new_component_id: str,
    max_depth: int = 10,
) -> None:
    """
    Raises HTTPException(422) if adding new_component_id as a child of
    parent_product_id would create a cycle or exceed max_depth.

    Algorithm:
    1. Fast-path: self-loop check.
    2. Load BOM graph for this org (only nodes reachable from parent_product_id
       going UP via reverse edges, and DOWN via forward edges from new_component_id).
    3. Cycle detection: DFS forward from new_component_id. If parent_product_id is
       reachable, adding the edge would create a cycle.
    4. Depth check:
       - depth_above = max distance from any ancestor root to parent_product_id
         (measured via reverse BFS/DFS up the existing graph).
       - subtree_depth = max distance from new_component_id to any leaf in its
         existing subtree (forward DFS).
       - Total chain = depth_above + 1 + subtree_depth.
       - If total > max_depth → 422.
    """
    if new_component_id == parent_product_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mahsulot o'z-o'ziga komponent bo'la olmaydi",
        )

    res = await db.execute(
        text(
            "SELECT parent_product_id, component_product_id "
            "FROM product_bom WHERE organization_id = :o"
        ),
        {"o": org_id},
    )
    adjacency: dict[str, list[str]] = {}
    reverse: dict[str, list[str]] = {}
    for row in res:
        parent = str(row.parent_product_id)
        child = str(row.component_product_id)
        adjacency.setdefault(parent, []).append(child)
        reverse.setdefault(child, []).append(parent)

    # --- Cycle detection: can we reach parent_product_id from new_component_id? ---
    visited_cycle: set[str] = set()
    stack_cycle: list[str] = [new_component_id]
    while stack_cycle:
        node = stack_cycle.pop()
        if node == parent_product_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="BOM davriy bog'liqlik aniqlandi (cycle detected)",
            )
        if node in visited_cycle:
            continue
        visited_cycle.add(node)
        for child in adjacency.get(node, []):
            stack_cycle.append(child)

    # --- Depth above: max distance from any root to parent_product_id ---
    # BFS upward from parent_product_id using reverse edges.
    depth_above = 0
    bfs_up: list[tuple[str, int]] = [(parent_product_id, 0)]
    visited_up: set[str] = set()
    while bfs_up:
        node, d = bfs_up.pop(0)
        if node in visited_up:
            continue
        visited_up.add(node)
        if d > depth_above:
            depth_above = d
        for ancestor in reverse.get(node, []):
            bfs_up.append((ancestor, d + 1))

    # --- Subtree depth: max depth of new_component_id's existing descendants ---
    subtree_depth = 0
    stack_down: list[tuple[str, int]] = [(new_component_id, 0)]
    visited_down: set[str] = set()
    while stack_down:
        node, d = stack_down.pop()
        if node in visited_down:
            continue
        visited_down.add(node)
        if d > subtree_depth:
            subtree_depth = d
        for child in adjacency.get(node, []):
            stack_down.append((child, d + 1))

    total_depth = depth_above + 1 + subtree_depth
    if total_depth > max_depth:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="BOM darajasi chegarasi oshib ketdi (max depth 10)",
        )


async def _next_doc_number(
    db: AsyncSession,
    org_id: str,
    doc_type: str,
    prefix: str,
) -> str:
    """
    Atomically increments the per-org counter and returns a formatted doc number.
    MUST be called inside the same transaction that creates the document row.
    """
    year = datetime.now(UTC).year
    await db.execute(
        text(
            "INSERT INTO document_sequences (organization_id, doc_type, next_value) "
            "VALUES (:o, :t, 1) "
            "ON CONFLICT (organization_id, doc_type) DO NOTHING"
        ),
        {"o": org_id, "t": doc_type},
    )
    res = await db.execute(
        text(
            "SELECT next_value FROM document_sequences "
            "WHERE organization_id = :o AND doc_type = :t "
            "FOR UPDATE"
        ),
        {"o": org_id, "t": doc_type},
    )
    n = res.scalar()
    await db.execute(
        text(
            "UPDATE document_sequences SET next_value = next_value + 1 "
            "WHERE organization_id = :o AND doc_type = :t"
        ),
        {"o": org_id, "t": doc_type},
    )
    return f"{prefix}-{year}-{n:05d}"


async def explode_bom(
    db: AsyncSession,
    org_id: str,
    product_id: str,
    quantity: Decimal,
    max_depth: int = 10,
) -> list[dict]:
    """
    Recursively explode a product's BOM into leaf components using BFS.

    Returns list of {"component_id": str, "quantity": Decimal, "unit_id": int|None, "depth": int}.
    Only leaf components (products with no BOM children) are returned.
    Multipliers accumulate: A×2 → B×3 means C gets quantity*2*3.
    Returns [] when product_id has no BOM (caller treats it as individual).
    """
    res = await db.execute(
        text(
            "SELECT parent_product_id, component_product_id, quantity AS comp_qty, unit_id "
            "FROM product_bom WHERE organization_id = :o"
        ),
        {"o": org_id},
    )
    # Build adjacency: parent_id → list of (component_id, qty, unit_id)
    adjacency: dict[str, list[tuple[str, Decimal, int | None]]] = {}
    for row in res:
        parent = str(row.parent_product_id)
        child = str(row.component_product_id)
        adjacency.setdefault(parent, []).append((child, Decimal(str(row.comp_qty)), row.unit_id))

    if product_id not in adjacency:
        return []

    leaves: list[dict] = []
    queue_with_unit: list[tuple[str, Decimal, int | None, int]] = [
        (child_id, quantity * child_qty, u_id, 1)
        for child_id, child_qty, u_id in adjacency[product_id]
    ]
    visited_global: set[str] = set()

    while queue_with_unit:
        node, acc_qty, unit_id, depth = queue_with_unit.pop(0)
        if depth > max_depth:
            log.warning("BOM depth exceeded in org=%s at product=%s, skipping", org_id, node)
            continue
        if node in visited_global:
            log.warning("BOM cycle detected in org=%s at product=%s, skipping", org_id, node)
            continue
        visited_global.add(node)
        children = adjacency.get(node)
        if not children:
            leaves.append({
                "component_id": node,
                "quantity": acc_qty,
                "unit_id": unit_id,
                "depth": depth,
            })
        else:
            for child_id, child_qty, child_unit in children:
                queue_with_unit.append((child_id, acc_qty * child_qty, child_unit, depth + 1))

    return leaves
