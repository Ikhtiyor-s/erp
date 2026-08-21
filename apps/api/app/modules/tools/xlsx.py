"""
Excel (.xlsx) export — openpyxl based.

Supports:
- Multiple sheets per workbook
- Header row styled (bold, frozen)
- Auto column width (best-effort)
- Number/date/money formats
- Filter enabled
- Logo/title (optional)
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from typing import Any, Iterable

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
HEADER_FILL = PatternFill("solid", fgColor="047857")  # emerald-700
HEADER_ALIGN = Alignment(horizontal="center", vertical="center")


def _cell_value(v: Any) -> Any:
    if v is None:
        return ""
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime, date)):
        return v
    return v


def _autosize(ws, max_width: int = 60) -> None:
    """Best-effort column width based on max content length."""
    for col_cells in ws.columns:
        if not col_cells:
            continue
        first = col_cells[0]
        if not hasattr(first, "column_letter"):
            continue
        letter = first.column_letter
        longest = 0
        for cell in col_cells:
            v = cell.value
            if v is None:
                continue
            longest = max(longest, len(str(v)))
        ws.column_dimensions[letter].width = min(max(longest + 2, 10), max_width)


def make_sheet(wb: Workbook, name: str, headers: list[str], rows: Iterable[list[Any]],
               number_formats: dict[int, str] | None = None) -> None:
    """
    Add a sheet to workbook.
    number_formats: column index (0-based) → openpyxl format string
                    e.g. {3: "#,##0.00", 4: "yyyy-mm-dd hh:mm"}
    """
    ws = wb.create_sheet(title=name[:31])  # Excel max 31 chars

    # Header row
    for i, h in enumerate(headers, 1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.alignment = HEADER_ALIGN

    # Data rows
    for row_idx, row in enumerate(rows, 2):
        for col_idx, val in enumerate(row, 1):
            c = ws.cell(row=row_idx, column=col_idx, value=_cell_value(val))
            if number_formats and (col_idx - 1) in number_formats:
                c.number_format = number_formats[col_idx - 1]

    # Freeze header
    ws.freeze_panes = "A2"
    # Enable filter (Excel will show dropdown arrows on header)
    if ws.max_row > 1:
        ws.auto_filter.ref = ws.dimensions

    _autosize(ws)


def workbook_to_bytes(wb: Workbook) -> bytes:
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()


def new_workbook() -> Workbook:
    """Create workbook and remove the default empty sheet."""
    wb = Workbook()
    if wb.active and wb.active.title == "Sheet":
        wb.remove(wb.active)
    return wb
