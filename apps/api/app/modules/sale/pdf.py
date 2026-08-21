"""
Sale receipt PDF generation.

Two formats:
- thermal: 58mm or 80mm thermal printer roll
- A4: standard invoice/document layout

Uses reportlab for canvas-based PDF generation.
"""
from __future__ import annotations

from decimal import Decimal
from io import BytesIO
from typing import Literal

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

try:
    import qrcode
    HAS_QR = True
except ImportError:
    HAS_QR = False


# Try to register a Unicode font (DejaVu) for Cyrillic/Uzbek support
# Fall back to Helvetica if not present
import os

_FONT_REGISTERED = None


def _register_font() -> str:
    global _FONT_REGISTERED
    if _FONT_REGISTERED is not None:
        return _FONT_REGISTERED
    # Try common Linux font paths
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("DejaVu", path))
                _FONT_REGISTERED = "DejaVu"
                return "DejaVu"
            except Exception:
                continue
    _FONT_REGISTERED = "Helvetica"
    return "Helvetica"


def _fmt_money(v) -> str:
    return f"{Decimal(str(v or 0)):,.2f}".replace(",", " ")


def render_thermal(sale: dict, width_mm: int = 80, org_name: str = "") -> bytes:
    """
    Render a thermal receipt (58mm or 80mm wide).
    sale dict expected keys:
      head: { id, doc_number, sale_date, total_amount, paid_amount,
              customer_name, warehouse_name, currency_code }
      items: [ { product_name, quantity, price, discount, amount } ]
    """
    font = _register_font()
    page_w = width_mm * mm
    # Estimate height: header (~50mm) + items (~6mm each) + totals (~30mm) + footer (~25mm)
    n_items = len(sale.get("items", []))
    page_h = (50 + n_items * 6 + 30 + 25) * mm

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))
    margin = 3 * mm
    y = page_h - margin

    # --- Header ---
    c.setFont(font, 10)
    c.drawCentredString(page_w / 2, y, org_name or "Aniq ERP")
    y -= 5 * mm

    head = sale["head"]
    c.setFont(font, 7)
    doc_no = head.get("doc_number") or str(head.get("id", ""))[:8]
    c.drawCentredString(page_w / 2, y, f"Chek № {doc_no}")
    y -= 3.5 * mm

    sd = head.get("sale_date") or ""
    if sd and len(str(sd)) > 16:
        sd = str(sd)[:16].replace("T", " ")
    c.drawCentredString(page_w / 2, y, f"Sana: {sd}")
    y -= 4 * mm

    # Divider
    c.line(margin, y, page_w - margin, y)
    y -= 3 * mm

    # Customer + Warehouse
    cust = head.get("customer_name") or "Chakana xaridor"
    c.drawString(margin, y, f"Mijoz: {cust[:30]}")
    y -= 3 * mm
    if head.get("warehouse_name"):
        c.drawString(margin, y, f"Ombor: {head['warehouse_name'][:30]}")
        y -= 3 * mm

    c.line(margin, y, page_w - margin, y)
    y -= 3 * mm

    # --- Items header ---
    c.setFont(font, 7)
    c.drawString(margin, y, "Nomi")
    c.drawRightString(page_w - margin, y, "Summa")
    y -= 3 * mm
    c.line(margin, y, page_w - margin, y)
    y -= 3 * mm

    # --- Items ---
    for it in sale.get("items", []):
        name = (it.get("product_name") or "")[:28]
        qty = it.get("quantity", 0)
        price = it.get("price", 0)
        amount = it.get("amount") or (Decimal(str(qty)) * Decimal(str(price)))

        c.drawString(margin, y, name)
        y -= 3 * mm
        c.setFont(font, 6)
        c.drawString(margin, y, f"  {qty} x {_fmt_money(price)}")
        c.drawRightString(page_w - margin, y, _fmt_money(amount))
        c.setFont(font, 7)
        y -= 4 * mm

    # --- Totals ---
    c.line(margin, y, page_w - margin, y)
    y -= 4 * mm
    cur = head.get("currency_code") or ""

    c.setFont(font, 9)
    c.drawString(margin, y, "JAMI:")
    c.drawRightString(page_w - margin, y, f"{_fmt_money(head['total_amount'])} {cur}")
    y -= 4 * mm

    if Decimal(str(head.get("paid_amount") or 0)) > 0:
        c.setFont(font, 7)
        c.drawString(margin, y, "To'langan:")
        c.drawRightString(page_w - margin, y, _fmt_money(head["paid_amount"]))
        y -= 3.5 * mm

        debt = Decimal(str(head["total_amount"])) - Decimal(str(head["paid_amount"]))
        if debt > 0:
            c.drawString(margin, y, "Qarz:")
            c.drawRightString(page_w - margin, y, _fmt_money(debt))
            y -= 3.5 * mm

    # --- Footer ---
    y -= 3 * mm
    c.line(margin, y, page_w - margin, y)
    y -= 4 * mm
    c.setFont(font, 6)
    c.drawCentredString(page_w / 2, y, "Xaridingiz uchun rahmat!")
    y -= 3 * mm
    c.drawCentredString(page_w / 2, y, "Aniq ERP")

    c.showPage()
    c.save()
    return buf.getvalue()


def render_a4(sale: dict, org_name: str = "", org_address: str = "", org_tin: str = "") -> bytes:
    """A4 invoice-style sale document."""
    font = _register_font()
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4
    margin = 20 * mm
    y = page_h - margin

    head = sale["head"]

    # --- Org header ---
    c.setFont(font, 14)
    c.drawString(margin, y, org_name or "Aniq ERP")
    y -= 5 * mm
    c.setFont(font, 9)
    if org_address:
        c.drawString(margin, y, org_address)
        y -= 4 * mm
    if org_tin:
        c.drawString(margin, y, f"STIR: {org_tin}")
        y -= 4 * mm

    # --- Document title ---
    y -= 8 * mm
    c.setFont(font, 16)
    doc_no = head.get("doc_number") or str(head.get("id", ""))[:8]
    c.drawString(margin, y, f"Hisob-chek № {doc_no}")
    y -= 6 * mm
    c.setFont(font, 9)
    sd = head.get("sale_date") or ""
    if sd:
        sd = str(sd)[:16].replace("T", " ")
    c.drawString(margin, y, f"Sana: {sd}")

    # Status badge on right
    status_map = {
        "draft": "Qoralama", "confirmed": "Tasdiqlangan",
        "paid": "To'langan", "partial": "Qisman", "cancelled": "Bekor qilingan",
    }
    status = status_map.get(head.get("status"), head.get("status") or "")
    c.drawRightString(page_w - margin, y, f"Holat: {status}")

    # --- Customer + warehouse block ---
    y -= 10 * mm
    c.line(margin, y, page_w - margin, y)
    y -= 6 * mm

    c.setFont(font, 8)
    c.setFillGray(0.4)
    c.drawString(margin, y, "MIJOZ:")
    c.drawString(page_w / 2, y, "OMBOR:")
    c.setFillGray(0)
    y -= 4 * mm

    c.setFont(font, 10)
    c.drawString(margin, y, head.get("customer_name") or "Chakana xaridor")
    c.drawString(page_w / 2, y, head.get("warehouse_name") or "—")
    y -= 4 * mm
    if head.get("customer_phone"):
        c.setFont(font, 9)
        c.drawString(margin, y, head["customer_phone"])
        y -= 4 * mm
    if head.get("customer_tin"):
        c.setFont(font, 9)
        c.drawString(margin, y, f"STIR: {head['customer_tin']}")
        y -= 4 * mm

    # --- Items table ---
    y -= 6 * mm
    c.line(margin, y, page_w - margin, y)
    y -= 5 * mm

    # Column positions
    col_n = margin
    col_name = margin + 10 * mm
    col_qty = page_w - margin - 75 * mm
    col_price = page_w - margin - 50 * mm
    col_disc = page_w - margin - 30 * mm
    col_total = page_w - margin

    c.setFont(font, 8)
    c.setFillGray(0.4)
    c.drawString(col_n, y, "#")
    c.drawString(col_name, y, "Mahsulot")
    c.drawRightString(col_qty, y, "Miqdor")
    c.drawRightString(col_price, y, "Narx")
    c.drawRightString(col_disc, y, "Chegirma")
    c.drawRightString(col_total, y, "Summa")
    c.setFillGray(0)
    y -= 2 * mm
    c.line(margin, y, page_w - margin, y)
    y -= 5 * mm

    c.setFont(font, 9)
    for i, it in enumerate(sale.get("items", []), 1):
        c.drawString(col_n, y, str(i))
        c.drawString(col_name, y, (it.get("product_name") or "")[:45])
        c.drawRightString(col_qty, y, str(it.get("quantity", 0)))
        c.drawRightString(col_price, y, _fmt_money(it.get("price", 0)))
        c.drawRightString(col_disc, y, _fmt_money(it.get("discount", 0)))
        amt = it.get("amount") or (Decimal(str(it.get("quantity", 0))) * Decimal(str(it.get("price", 0))))
        c.drawRightString(col_total, y, _fmt_money(amt))
        y -= 5 * mm

    # --- Totals box (right-aligned) ---
    y -= 5 * mm
    c.line(margin, y, page_w - margin, y)
    y -= 6 * mm

    cur = head.get("currency_code") or ""
    box_left = page_w - margin - 70 * mm

    c.setFont(font, 10)
    c.drawString(box_left, y, "Jami:")
    c.drawRightString(col_total, y, f"{_fmt_money(head['total_amount'])} {cur}")
    y -= 5 * mm

    c.setFont(font, 9)
    c.setFillGray(0.3)
    c.drawString(box_left, y, "To'langan:")
    c.drawRightString(col_total, y, _fmt_money(head.get("paid_amount", 0)))
    c.setFillGray(0)
    y -= 4 * mm

    debt = Decimal(str(head.get("total_amount", 0))) - Decimal(str(head.get("paid_amount", 0)))
    c.setFont(font, 11)
    if debt > 0:
        c.setFillColorRGB(0.7, 0, 0)
    elif debt < 0:
        c.setFillColorRGB(0, 0.5, 0)
    c.drawString(box_left, y, "Qarz:" if debt >= 0 else "Ortiqcha:")
    c.drawRightString(col_total, y, _fmt_money(abs(debt)))
    c.setFillGray(0)

    # --- QR code (sale verification) ---
    if HAS_QR:
        qr_data = f"sale:{str(head.get('id',''))}:{head.get('total_amount','')}"
        qr_img = qrcode.make(qr_data)
        qr_buf = BytesIO()
        qr_img.save(qr_buf, format="PNG")
        qr_buf.seek(0)
        from reportlab.lib.utils import ImageReader
        c.drawImage(ImageReader(qr_buf), margin, margin, width=30 * mm, height=30 * mm)
        c.setFont(font, 7)
        c.setFillGray(0.5)
        c.drawString(margin, margin - 3 * mm, "Chek tasdiqi")

    # --- Footer signature lines ---
    sig_y = margin + 10 * mm
    sig_w = 50 * mm
    c.setStrokeGray(0.5)
    c.line(page_w - margin - sig_w * 2 - 10 * mm, sig_y,
           page_w - margin - sig_w - 10 * mm, sig_y)
    c.line(page_w - margin - sig_w, sig_y,
           page_w - margin, sig_y)
    c.setFont(font, 8)
    c.setFillGray(0.5)
    c.drawString(page_w - margin - sig_w * 2 - 10 * mm, sig_y - 4 * mm, "Sotuvchi")
    c.drawString(page_w - margin - sig_w, sig_y - 4 * mm, "Xaridor")

    c.showPage()
    c.save()
    return buf.getvalue()


def render_sale_pdf(sale: dict, fmt: Literal["thermal_58", "thermal_80", "a4"] = "a4",
                    org_name: str = "", org_address: str = "", org_tin: str = "") -> bytes:
    if fmt == "thermal_58":
        return render_thermal(sale, width_mm=58, org_name=org_name)
    if fmt == "thermal_80":
        return render_thermal(sale, width_mm=80, org_name=org_name)
    return render_a4(sale, org_name=org_name, org_address=org_address, org_tin=org_tin)


# =========================================================================
# Generic A4 document — used for sale returns, inventory, write-offs, etc.
# =========================================================================

def render_generic_a4(doc: dict, doc_title: str,
                      item_columns: list[tuple[str, str]],
                      org_name: str = "", org_address: str = "",
                      org_tin: str = "",
                      totals: list[tuple[str, str]] | None = None) -> bytes:
    """
    Render an A4 document with header, items table and optional totals box.

    doc: { "head": {...}, "items": [...] }
    doc_title: text to print as the document title (e.g. "Qaytarish № 12")
    item_columns: list of (label, key) where key is the dict key in each item
    totals: optional list of (label, value_str) shown right-aligned at bottom
    """
    font = _register_font()
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4
    margin = 20 * mm
    y = page_h - margin

    head = doc.get("head", {})

    # Org header
    c.setFont(font, 14)
    c.drawString(margin, y, org_name or "Aniq ERP")
    y -= 5 * mm
    c.setFont(font, 9)
    if org_address:
        c.drawString(margin, y, org_address)
        y -= 4 * mm
    if org_tin:
        c.drawString(margin, y, f"STIR: {org_tin}")
        y -= 4 * mm

    # Document title
    y -= 6 * mm
    c.setFont(font, 16)
    c.drawString(margin, y, doc_title)
    y -= 6 * mm
    c.setFont(font, 9)
    sd = head.get("date") or head.get("created_at") or ""
    if sd:
        sd = str(sd)[:16].replace("T", " ")
        c.drawString(margin, y, f"Sana: {sd}")

    # Customer/warehouse/notes block
    y -= 10 * mm
    c.line(margin, y, page_w - margin, y)
    y -= 6 * mm

    info_pairs = []
    if head.get("customer_name"):
        info_pairs.append(("MIJOZ", head["customer_name"]))
    if head.get("supplier_name"):
        info_pairs.append(("YETKAZIB BERUVCHI", head["supplier_name"]))
    if head.get("warehouse_name"):
        info_pairs.append(("OMBOR", head["warehouse_name"]))
    if head.get("reason"):
        info_pairs.append(("SABAB", head["reason"]))
    if head.get("notes"):
        info_pairs.append(("IZOH", head["notes"]))

    for label, value in info_pairs:
        c.setFont(font, 8)
        c.setFillGray(0.4)
        c.drawString(margin, y, label + ":")
        c.setFillGray(0)
        c.setFont(font, 10)
        c.drawString(margin + 40 * mm, y, str(value))
        y -= 5 * mm

    # Items table
    y -= 4 * mm
    c.line(margin, y, page_w - margin, y)
    y -= 5 * mm

    col_count = len(item_columns)
    col_w = (page_w - 2 * margin) / col_count

    c.setFont(font, 8)
    c.setFillGray(0.4)
    for i, (label, _key) in enumerate(item_columns):
        align = "right" if i > 0 else "left"
        x = margin + col_w * i + (col_w - 2 if align == "right" else 2)
        if align == "right":
            c.drawRightString(x, y, label)
        else:
            c.drawString(x, y, label)
    c.setFillGray(0)
    y -= 2 * mm
    c.line(margin, y, page_w - margin, y)
    y -= 5 * mm

    c.setFont(font, 9)
    for it in doc.get("items", []):
        for i, (_label, key) in enumerate(item_columns):
            val = it.get(key, "")
            if isinstance(val, (int, float, Decimal)) and not isinstance(val, bool):
                val_str = _fmt_money(val)
            else:
                val_str = str(val)[:45]
            align = "right" if i > 0 else "left"
            x = margin + col_w * i + (col_w - 2 if align == "right" else 2)
            if align == "right":
                c.drawRightString(x, y, val_str)
            else:
                c.drawString(x, y, val_str)
        y -= 5 * mm
        if y < margin + 50 * mm:
            c.showPage()
            y = page_h - margin
            c.setFont(font, 9)

    # Totals box
    if totals:
        y -= 4 * mm
        c.line(margin, y, page_w - margin, y)
        y -= 6 * mm
        box_left = page_w - margin - 70 * mm
        for label, value in totals:
            c.setFont(font, 10)
            c.drawString(box_left, y, label)
            c.drawRightString(page_w - margin, y, value)
            y -= 5 * mm

    # Signature lines
    sig_y = margin + 10 * mm
    sig_w = 50 * mm
    c.setStrokeGray(0.5)
    c.line(page_w - margin - sig_w * 2 - 10 * mm, sig_y,
           page_w - margin - sig_w - 10 * mm, sig_y)
    c.line(page_w - margin - sig_w, sig_y, page_w - margin, sig_y)
    c.setFont(font, 8)
    c.setFillGray(0.5)
    c.drawString(page_w - margin - sig_w * 2 - 10 * mm, sig_y - 4 * mm, "Topshirdi")
    c.drawString(page_w - margin - sig_w, sig_y - 4 * mm, "Qabul qildi")

    c.showPage()
    c.save()
    return buf.getvalue()


def render_return_pdf(ret: dict, org_name: str = "", org_address: str = "",
                      org_tin: str = "") -> bytes:
    """Sale return document."""
    head = ret.get("head", {})
    doc_no = head.get("doc_number") or str(head.get("id", ""))[:8]
    title = f"Qaytarish № {doc_no}"
    columns = [
        ("Mahsulot", "product_name"),
        ("Miqdor", "quantity"),
        ("Narx", "price"),
        ("Summa", "amount"),
    ]
    total = head.get("total_amount") or 0
    totals = [("Jami qaytarish:", f"{_fmt_money(total)}")]
    # Add 'date' alias for the generic renderer
    head["date"] = head.get("return_date") or head.get("created_at")
    return render_generic_a4(ret, title, columns,
                             org_name=org_name, org_address=org_address,
                             org_tin=org_tin, totals=totals)


def render_inventory_pdf(inv: dict, org_name: str = "", org_address: str = "",
                          org_tin: str = "") -> bytes:
    """Inventory check / revision document."""
    head = inv.get("head", {})
    doc_no = head.get("doc_number") or str(head.get("id", ""))[:8]
    title = f"Inventarizatsiya № {doc_no}"
    columns = [
        ("Mahsulot", "product_name"),
        ("Hisobda", "system_qty"),
        ("Aslida", "actual_qty"),
        ("Farq", "diff"),
    ]
    head["date"] = head.get("created_at")
    return render_generic_a4(inv, title, columns,
                             org_name=org_name, org_address=org_address,
                             org_tin=org_tin)


def render_writeoff_pdf(wo: dict, org_name: str = "", org_address: str = "",
                         org_tin: str = "") -> bytes:
    """Write-off document."""
    head = wo.get("head", {})
    doc_no = head.get("doc_number") or str(head.get("id", ""))[:8]
    title = f"Hisobdan chiqarish № {doc_no}"
    columns = [
        ("Mahsulot", "product_name"),
        ("Miqdor", "quantity"),
        ("Tannarx", "cost"),
        ("Summa", "amount"),
    ]
    total = head.get("total_amount") or 0
    totals = [("Jami hisobdan chiqarildi:", _fmt_money(total))]
    head["date"] = head.get("write_off_date") or head.get("created_at")
    return render_generic_a4(wo, title, columns,
                             org_name=org_name, org_address=org_address,
                             org_tin=org_tin, totals=totals)
