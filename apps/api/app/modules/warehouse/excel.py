"""
Excel import / export helpers for the warehouse products module.
All sheet generation and parsing lives here; router.py stays thin.
"""

import io
from datetime import date
from decimal import Decimal, InvalidOperation

import openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

IMPORT_COLUMNS = [
    "name",          # A — required
    "sku",           # B
    "barcode",       # C
    "category",      # D
    "product_type",  # E
    "unit",          # F
    "purchase_price",# G
    "sale_price",    # H
    "warehouse_name",# I
    "opening_qty",   # J
    "opening_cost",  # K
    "rack_name",     # L
]

EXPORT_HEADERS = [
    "Nomi",           # A — name
    "SKU",            # B
    "Shtrix-kod",     # C
    "Kategoriya",     # D
    "Tur",            # E
    "O'lchov",        # F
    "Tan narxi",      # G
    "Sotuv narxi",    # H
    "Ombor",          # I
    "Qoldiq",         # J
    "O'rtacha narx",  # K
    "Stellaj",        # L
]

MAX_FILE_BYTES = 5 * 1024 * 1024   # 5 MB
MAX_ROWS = 10_000

# ---------------------------------------------------------------------------
# Import parser
# ---------------------------------------------------------------------------


def parse_import_file(content: bytes) -> list[dict]:
    """
    Parse an .xlsx file and return a list of row dicts keyed by IMPORT_COLUMNS.
    Row numbers in returned dicts are 1-based (row 1 is the header).
    Raises ValueError on structural problems (wrong format, too many rows).
    """
    if len(content) > MAX_FILE_BYTES:
        raise ValueError(f"Fayl hajmi 5MB dan oshmasligi kerak")

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active

    rows = []
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if row_idx - 1 > MAX_ROWS:
            raise ValueError(f"Maksimal {MAX_ROWS} qator ruxsat etiladi")
        # Skip fully-blank rows
        if all(cell is None or str(cell).strip() == "" for cell in row):
            continue
        row_data = {"_row": row_idx}
        for col_idx, field in enumerate(IMPORT_COLUMNS):
            val = row[col_idx] if col_idx < len(row) else None
            row_data[field] = str(val).strip() if val is not None else ""
        rows.append(row_data)

    wb.close()
    return rows


def _to_decimal(raw: str, field: str) -> Decimal:
    """Parse a string to Decimal; raises ValueError with a human-readable message."""
    if raw == "":
        return Decimal("0")
    try:
        return Decimal(raw.replace(",", "."))
    except InvalidOperation:
        raise ValueError(f"{field} raqam emas: '{raw}'")


# ---------------------------------------------------------------------------
# Export builder
# ---------------------------------------------------------------------------


def build_export_workbook(rows: list[dict]) -> bytes:
    """
    Build an .xlsx workbook from a list of row dicts (from the DB query).
    Expected keys per row: name, sku, barcode, category_name, product_type,
    unit_name, purchase_price, sale_price, warehouse_name, qty, avg_cost, rack_name.
    Returns raw bytes ready for StreamingResponse.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Mahsulotlar"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1F7A4F")

    for col_idx, header in enumerate(EXPORT_HEADERS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill

    col_widths = [30, 15, 15, 20, 20, 12, 15, 15, 25, 12, 15, 20]
    for i, w in enumerate(col_widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    for row_idx, row in enumerate(rows, start=2):
        ws.cell(row=row_idx, column=1, value=row.get("name", ""))
        ws.cell(row=row_idx, column=2, value=row.get("sku", ""))
        ws.cell(row=row_idx, column=3, value=row.get("barcode", ""))
        ws.cell(row=row_idx, column=4, value=row.get("category_name", ""))
        ws.cell(row=row_idx, column=5, value=row.get("product_type", ""))
        ws.cell(row=row_idx, column=6, value=row.get("unit_name", ""))
        ws.cell(row=row_idx, column=7, value=float(row["purchase_price"]) if row.get("purchase_price") is not None else 0)
        ws.cell(row=row_idx, column=8, value=float(row["sale_price"]) if row.get("sale_price") is not None else 0)
        ws.cell(row=row_idx, column=9, value=row.get("warehouse_name", ""))
        ws.cell(row=row_idx, column=10, value=float(row["qty"]) if row.get("qty") is not None else 0)
        ws.cell(row=row_idx, column=11, value=float(row["avg_cost"]) if row.get("avg_cost") is not None else 0)
        ws.cell(row=row_idx, column=12, value=row.get("rack_name", ""))

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def build_import_template() -> bytes:
    """Return a blank .xlsx template with the import headers in row 1."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Import"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1F7A4F")

    human_headers = [
        "Nomi *",
        "SKU",
        "Shtrix-kod",
        "Kategoriya",
        "Mahsulot turi",
        "O'lchov birligi",
        "Tan narxi",
        "Sotuv narxi",
        "Ombor nomi",
        "Boshlang'ich qoldiq",
        "Boshlang'ich narx",
        "Stellaj nomi",
    ]

    col_widths = [30, 15, 15, 20, 20, 15, 15, 15, 25, 18, 18, 20]
    for col_idx, header in enumerate(human_headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        ws.column_dimensions[get_column_letter(col_idx)].width = col_widths[col_idx - 1]

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()
