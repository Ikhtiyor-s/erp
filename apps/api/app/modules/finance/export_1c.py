"""1C Buxgalteriya export — CSV va XML formatlar.

CSV: UTF-8 BOM (1C talab qiladi), semicolon separator.
XML: CommerceML 2.0 lite subset, UTF-8.
"""
import io
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

MAX_RANGE_DAYS = 366

ExportType = Literal["sales", "cash", "counterparties", "all"]


def _validate_date_range(date_from: date, date_to: date) -> None:
    if date_to < date_from:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "date_to must be >= date_from",
        )
    if (date_to - date_from).days > MAX_RANGE_DAYS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Date range exceeds maximum {MAX_RANGE_DAYS} days",
        )


# ---------------------------------------------------------------------------
# SQL queries
# ---------------------------------------------------------------------------

_SALES_SQL = text(
    "SELECT s.doc_number, s.created_at::date AS sale_date, "
    "c.name AS customer_name, "
    "w.name AS warehouse_name, "
    "s.total_amount, s.paid_amount, s.status "
    "FROM sales s "
    "LEFT JOIN customers c ON c.id = s.customer_id "
    "LEFT JOIN warehouses w ON w.id = s.warehouse_id "
    "WHERE s.organization_id = :o "
    "  AND s.created_at >= :df "
    "  AND s.created_at < (CAST(:dt AS date) + INTERVAL '1 day') "
    "ORDER BY s.created_at"
)

_CASH_SQL = text(
    "SELECT cm.id, cm.movement_date AS cash_date, "
    "cm.direction, cm.amount, "
    "cm.description, "
    "cb.name AS cashbox_name, "
    "COALESCE(cu.name, su.name, em.full_name) AS counterparty_name, "
    "pt.name AS payment_type "
    "FROM cash_movements cm "
    "LEFT JOIN cashboxes cb ON cb.id = cm.cashbox_id "
    "LEFT JOIN customers cu ON cu.id = cm.customer_id "
    "LEFT JOIN suppliers su ON su.id = cm.supplier_id "
    "LEFT JOIN employees em ON em.id = cm.employee_id "
    "LEFT JOIN payment_types pt ON pt.id = cm.payment_type_id "
    "WHERE cm.organization_id = :o "
    "  AND cm.movement_date >= :df "
    "  AND cm.movement_date < (CAST(:dt AS date) + INTERVAL '1 day') "
    "ORDER BY cm.movement_date"
)

_COUNTERPARTIES_SQL = text(
    "SELECT 'customer' AS type, id::text, name, phone "
    "FROM customers WHERE organization_id = :o "
    "UNION ALL "
    "SELECT 'supplier' AS type, id::text, name, phone "
    "FROM suppliers WHERE organization_id = :o "
    "ORDER BY type, name"
)


# ---------------------------------------------------------------------------
# CSV builders
# ---------------------------------------------------------------------------

def _bom_csv(lines: list[str]) -> bytes:
    content = "\n".join(lines) + "\n"
    return b"\xef\xbb\xbf" + content.encode("utf-8")


def _sales_csv(rows) -> bytes:
    lines = ["Дата;Документ;Контрагент;Склад;Сумма;Оплачено;Статус"]
    for r in rows:
        doc = r.doc_number or ""
        dt = str(r.sale_date) if r.sale_date else ""
        customer = (r.customer_name or "").replace(";", ",")
        warehouse = (r.warehouse_name or "").replace(";", ",")
        total = str(r.total_amount or 0)
        paid = str(r.paid_amount or 0)
        st = r.status or ""
        lines.append(f"{dt};{doc};{customer};{warehouse};{total};{paid};{st}")
    return _bom_csv(lines)


def _cash_csv(rows) -> bytes:
    lines = ["Дата;Направление;Сумма;Касса;Контрагент;Тип оплаты;Описание"]
    for r in rows:
        dt = str(r.cash_date) if r.cash_date else ""
        direction = r.direction or ""
        amount = str(r.amount or 0)
        cashbox = (r.cashbox_name or "").replace(";", ",")
        counterparty = (r.counterparty_name or "").replace(";", ",")
        ptype = (r.payment_type or "").replace(";", ",")
        desc = (r.description or "").replace(";", ",")
        lines.append(f"{dt};{direction};{amount};{cashbox};{counterparty};{ptype};{desc}")
    return _bom_csv(lines)


def _counterparties_csv(rows) -> bytes:
    lines = ["Тип;Ид;Наименование;Телефон"]
    for r in rows:
        ctype = r.type or ""
        cid = str(r.id)
        name = (r.name or "").replace(";", ",")
        phone = (r.phone or "").replace(";", ",")
        lines.append(f"{ctype};{cid};{name};{phone}")
    return _bom_csv(lines)


def _all_csv(sales_rows, cash_rows, cp_rows) -> bytes:
    """Combine all three sections into one file with a single leading BOM."""
    def _strip_bom(b: bytes) -> bytes:
        return b[3:] if b.startswith(b"\xef\xbb\xbf") else b

    body = (
        b"=== SALES ===\n"
        + _strip_bom(_sales_csv(sales_rows))
        + b"\n=== CASH MOVEMENTS ===\n"
        + _strip_bom(_cash_csv(cash_rows))
        + b"\n=== COUNTERPARTIES ===\n"
        + _strip_bom(_counterparties_csv(cp_rows))
    )
    return b"\xef\xbb\xbf" + body


# ---------------------------------------------------------------------------
# XML builders
# ---------------------------------------------------------------------------

def _new_root() -> ET.Element:
    return ET.Element(
        "КоммерческаяИнформация",
        {"ВерсияСхемы": "2.0", "ДатаФормирования": str(date.today())},
    )


def _append_sales(parent: ET.Element, rows) -> None:
    for r in rows:
        doc = ET.SubElement(parent, "Документ")
        ET.SubElement(doc, "Ид").text = r.doc_number or ""
        ET.SubElement(doc, "Номер").text = r.doc_number or ""
        ET.SubElement(doc, "Дата").text = str(r.sale_date) if r.sale_date else ""
        ET.SubElement(doc, "Тип").text = "Продажа"
        ET.SubElement(doc, "Контрагент").text = r.customer_name or ""
        ET.SubElement(doc, "Склад").text = r.warehouse_name or ""
        ET.SubElement(doc, "Сумма").text = str(r.total_amount or 0)
        ET.SubElement(doc, "Оплачено").text = str(r.paid_amount or 0)
        ET.SubElement(doc, "Статус").text = r.status or ""


def _append_cash(parent: ET.Element, rows) -> None:
    for r in rows:
        doc = ET.SubElement(parent, "Документ")
        ET.SubElement(doc, "Ид").text = str(r.id)
        ET.SubElement(doc, "Дата").text = str(r.cash_date) if r.cash_date else ""
        ET.SubElement(doc, "Тип").text = "ДвиженияДенежныхСредств"
        ET.SubElement(doc, "Направление").text = r.direction or ""
        ET.SubElement(doc, "Сумма").text = str(r.amount or 0)
        ET.SubElement(doc, "Касса").text = r.cashbox_name or ""
        ET.SubElement(doc, "Контрагент").text = r.counterparty_name or ""
        ET.SubElement(doc, "Описание").text = r.description or ""


def _append_counterparties(parent: ET.Element, rows) -> None:
    for r in rows:
        cp = ET.SubElement(parent, "Контрагент")
        ET.SubElement(cp, "Ид").text = str(r.id)
        ET.SubElement(cp, "Наименование").text = r.name or ""
        ET.SubElement(cp, "Тип").text = r.type or ""
        ET.SubElement(cp, "Телефон").text = r.phone or ""


def _sales_xml(rows) -> bytes:
    root = _new_root()
    _append_sales(root, rows)
    return _xml_bytes(root)


def _cash_xml(rows) -> bytes:
    root = _new_root()
    _append_cash(root, rows)
    return _xml_bytes(root)


def _counterparties_xml(rows) -> bytes:
    root = _new_root()
    _append_counterparties(root, rows)
    return _xml_bytes(root)


def _all_xml(sales_rows, cash_rows, cp_rows) -> bytes:
    root = _new_root()
    _append_sales(root, sales_rows)
    _append_cash(root, cash_rows)
    _append_counterparties(root, cp_rows)
    return _xml_bytes(root)


def _xml_bytes(root: ET.Element) -> bytes:
    buf = io.BytesIO()
    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(buf, encoding="utf-8", xml_declaration=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Public API — called by router
# ---------------------------------------------------------------------------

async def build_export(
    db: AsyncSession,
    org_id: str,
    date_from: date,
    date_to: date,
    export_type: ExportType,
    fmt: Literal["csv", "xml"],
) -> tuple[bytes, str, str]:
    """Return (content_bytes, content_type, filename)."""
    _validate_date_range(date_from, date_to)

    params = {"o": org_id, "df": date_from, "dt": date_to}

    if export_type == "sales" or export_type == "all":
        sales_res = await db.execute(_SALES_SQL, params)
        sales_rows = sales_res.fetchall()
    else:
        sales_rows = []

    if export_type == "cash" or export_type == "all":
        cash_res = await db.execute(_CASH_SQL, params)
        cash_rows = cash_res.fetchall()
    else:
        cash_rows = []

    if export_type == "counterparties" or export_type == "all":
        cp_res = await db.execute(_COUNTERPARTIES_SQL, {"o": org_id})
        cp_rows = cp_res.fetchall()
    else:
        cp_rows = []

    period = f"{date_from.strftime('%Y-%m')}"

    if fmt == "csv":
        if export_type == "sales":
            data = _sales_csv(sales_rows)
        elif export_type == "cash":
            data = _cash_csv(cash_rows)
        elif export_type == "counterparties":
            data = _counterparties_csv(cp_rows)
        else:
            data = _all_csv(sales_rows, cash_rows, cp_rows)
        ctype = "text/csv; charset=utf-8"
        filename = f"1c-export-{period}.csv"
    else:
        if export_type == "sales":
            data = _sales_xml(sales_rows)
        elif export_type == "cash":
            data = _cash_xml(cash_rows)
        elif export_type == "counterparties":
            data = _counterparties_xml(cp_rows)
        else:
            data = _all_xml(sales_rows, cash_rows, cp_rows)
        ctype = "application/xml; charset=utf-8"
        filename = f"1c-export-{period}.xml"

    return data, ctype, filename
