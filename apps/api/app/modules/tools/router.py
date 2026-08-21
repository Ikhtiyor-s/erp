import csv
import io
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id
from app.modules.tools.xlsx import make_sheet, new_workbook, workbook_to_bytes


router = APIRouter(prefix="/tools", tags=["tools"])


# =========================================================
# BULK PRICE UPDATE
# =========================================================

class PriceItem(BaseModel):
    product_id: str
    sale_price: Decimal | None = None
    purchase_price: Decimal | None = None


class BulkPriceIn(BaseModel):
    items: list[PriceItem]


@router.post("/price/bulk-update")
async def bulk_update_prices(
    p: BulkPriceIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    updated = 0
    for it in p.items:
        sets = []
        params = {"id": it.product_id, "o": org_id}
        if it.sale_price is not None:
            sets.append("sale_price = :sp")
            params["sp"] = it.sale_price
        if it.purchase_price is not None:
            sets.append("purchase_price = :pp")
            params["pp"] = it.purchase_price
        if not sets:
            continue
        res = await db.execute(
            text(f"UPDATE products SET {', '.join(sets)} "
                 f"WHERE id = :id AND organization_id = :o RETURNING id"),
            params,
        )
        if res.scalar():
            updated += 1
    await db.commit()
    return {"updated": updated, "total": len(p.items)}


class PriceMarkupIn(BaseModel):
    category_id: int | None = None
    markup_pct: Decimal  # +10 means raise by 10%, -5 means decrease by 5%
    field: str = "sale_price"  # 'sale_price' | 'purchase_price'


@router.post("/price/markup")
async def apply_markup(
    p: PriceMarkupIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if p.field not in ("sale_price", "purchase_price"):
        raise HTTPException(400, "field must be sale_price or purchase_price")
    where = "WHERE organization_id = :o"
    params = {"o": org_id, "m": float(p.markup_pct) / 100.0}
    if p.category_id is not None:
        where += " AND category_id = :c"
        params["c"] = p.category_id
    res = await db.execute(
        text(f"UPDATE products SET {p.field} = {p.field} * (1 + :m) "
             f"{where} RETURNING id"),
        params,
    )
    rows = res.fetchall()
    await db.commit()
    return {"updated": len(rows)}


# =========================================================
# EXPORTS CENTER
# =========================================================

def _make_csv_response(headers: list, rows_iter, filename: str):
    """
    Build a CSV response Excel-friendly:
    - UTF-8 BOM so Excel detects encoding
    - Semicolon delimiter (Uzbek/Russian Excel locale uses ; not ,)
    - QUOTE_ALL so values containing ; or newlines stay intact
    """
    buf = io.StringIO()
    buf.write("﻿")  # UTF-8 BOM for Excel
    w = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    w.writerow(headers)
    for row in rows_iter:
        w.writerow(row)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _make_xlsx_response(sheet_name: str, headers: list, rows: list,
                        filename: str, number_formats: dict | None = None):
    """Build a native .xlsx response with formatted header + filter."""
    wb = new_workbook()
    make_sheet(wb, sheet_name, headers, rows, number_formats=number_formats)
    data = workbook_to_bytes(wb)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _dispatch(format: str, sheet_name: str, headers: list, rows_list: list,
              csv_filename: str, xlsx_filename: str, number_formats: dict | None = None):
    """CSV or XLSX based on ?format= query param."""
    if format == "xlsx":
        return _make_xlsx_response(sheet_name, headers, rows_list, xlsx_filename, number_formats)
    return _make_csv_response(headers, rows_list, csv_filename)


MONEY_FMT = "#,##0.00"
DATE_FMT = "yyyy-mm-dd hh:mm"


@router.get("/exports/products")
async def export_products(
    format: str = Query("csv", regex="^(csv|xlsx)$"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT sku, barcode, name, purchase_price, sale_price, is_service "
             "FROM products WHERE organization_id = :o ORDER BY name"),
        {"o": org_id},
    )
    headers = ["SKU", "Shtrix-kod", "Nomi", "Kelish narxi", "Sotuv narxi", "Xizmatmi"]
    rows = [
        [r.sku or "", r.barcode or "", r.name,
         r.purchase_price, r.sale_price, "Ha" if r.is_service else "Yo'q"]
        for r in res
    ]
    return _dispatch(format, "Mahsulotlar", headers, rows,
                     "mahsulotlar.csv", "mahsulotlar.xlsx",
                     number_formats={3: MONEY_FMT, 4: MONEY_FMT})


@router.get("/exports/customers")
async def export_customers(
    format: str = Query("csv", regex="^(csv|xlsx)$"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT code, name, phone, email, tin, address FROM customers "
             "WHERE organization_id = :o AND is_active = TRUE ORDER BY name"),
        {"o": org_id},
    )
    headers = ["Kod", "F.I.O.", "Telefon", "Email", "STIR", "Manzil"]
    rows = [
        [r.code or "", r.name, r.phone or "", r.email or "", r.tin or "", r.address or ""]
        for r in res
    ]
    return _dispatch(format, "Mijozlar", headers, rows,
                     "mijozlar.csv", "mijozlar.xlsx")


@router.get("/exports/suppliers")
async def export_suppliers(
    format: str = Query("csv", regex="^(csv|xlsx)$"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT code, name, phone, email, tin, address FROM suppliers "
             "WHERE organization_id = :o AND is_active = TRUE ORDER BY name"),
        {"o": org_id},
    )
    headers = ["Kod", "Nomi", "Telefon", "Email", "STIR", "Manzil"]
    rows = [
        [r.code or "", r.name, r.phone or "", r.email or "", r.tin or "", r.address or ""]
        for r in res
    ]
    return _dispatch(format, "Yetkazib beruvchilar", headers, rows,
                     "yetkazib_beruvchilar.csv", "yetkazib_beruvchilar.xlsx")


@router.get("/exports/sales")
async def export_sales(
    format: str = Query("csv", regex="^(csv|xlsx)$"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT s.doc_number, s.sale_date, s.total_amount, s.paid_amount, "
             "s.status, c.name AS customer_name, w.name AS warehouse_name "
             "FROM sales s "
             "LEFT JOIN customers c ON c.id = s.customer_id "
             "LEFT JOIN warehouses w ON w.id = s.warehouse_id "
             "WHERE s.organization_id = :o ORDER BY s.sale_date DESC"),
        {"o": org_id},
    )
    status_uz = {
        "draft": "Qoralama", "confirmed": "Tasdiqlandi",
        "paid": "To'langan", "partial": "Qisman", "cancelled": "Bekor qilingan",
    }
    headers = ["Hujjat №", "Sana", "Jami", "To'langan", "Holat", "Mijoz", "Ombor"]
    rows = []
    for r in res:
        if format == "xlsx":
            # Excel handles datetime natively
            sale_date = r.sale_date if r.sale_date else None
        else:
            sale_date = r.sale_date.strftime("%Y-%m-%d %H:%M") if r.sale_date else ""
        rows.append([
            r.doc_number or "", sale_date,
            r.total_amount, r.paid_amount,
            status_uz.get(r.status, r.status or ""),
            r.customer_name or "", r.warehouse_name or "",
        ])
    return _dispatch(format, "Sotuvlar", headers, rows,
                     "sotuvlar.csv", "sotuvlar.xlsx",
                     number_formats={1: DATE_FMT, 2: MONEY_FMT, 3: MONEY_FMT})


@router.get("/exports/stock")
async def export_stock(
    format: str = Query("csv", regex="^(csv|xlsx)$"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT w.name AS warehouse, p.sku, p.name AS product, "
             "sb.quantity, sb.avg_cost, (sb.quantity * sb.avg_cost) AS total_value "
             "FROM stock_balances sb "
             "JOIN warehouses w ON w.id = sb.warehouse_id "
             "JOIN products p ON p.id = sb.product_id "
             "WHERE w.organization_id = :o AND sb.quantity > 0 "
             "ORDER BY w.name, p.name"),
        {"o": org_id},
    )
    headers = ["Ombor", "SKU", "Tovar", "Miqdor", "O'rtacha tannarx", "Jami qiymat"]
    rows = [
        [r.warehouse, r.sku or "", r.product, r.quantity, r.avg_cost, r.total_value]
        for r in res
    ]
    return _dispatch(format, "Qoldiqlar", headers, rows,
                     "qoldiqlar.csv", "qoldiqlar.xlsx",
                     number_formats={3: "#,##0.000", 4: MONEY_FMT, 5: MONEY_FMT})
