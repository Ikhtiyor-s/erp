"""
Standard permissions catalog for Aniq ERP.

Convention: permission code = "<module>.<action>" (2-part)
            or "<module>.<sub>.<action>" (3-part for sub-resource actions)
Modules: sale, warehouse, finance, customer, supplier, hr,
         manufacturing, marketing, reference, settings, tools, audit, rbac, org
Actions: view, create, update, delete, export, approve, cancel, pay, refund,
         manage, send, receive, import
"""
from __future__ import annotations

from typing import TypedDict


class Permission(TypedDict):
    code: str
    module: str
    action: str


# Helper to build a 2-part permission dict
def p(module: str, action: str) -> Permission:
    return {"code": f"{module}.{action}", "module": module, "action": action}


# Helper to build a 3-part permission dict (module.sub.action).
# `action` stores the leaf action so viewer filter (action=="view") still works.
def p3(module: str, sub: str, action: str) -> Permission:
    return {"code": f"{module}.{sub}.{action}", "module": module, "action": action}


# Master catalog — what permissions exist in the system
ALL_PERMISSIONS: list[Permission] = [
    # Sale
    p("sale", "view"), p("sale", "create"), p("sale", "update"),
    p("sale", "delete"), p("sale", "cancel"), p("sale", "pay"),
    p("sale", "refund"), p("sale", "export"), p("sale", "discount"),
    p("sale", "change_warehouse"),  # override cashbox default warehouse at sale time

    # Warehouse (broad, legacy)
    p("warehouse", "view"), p("warehouse", "create"), p("warehouse", "update"),
    p("warehouse", "delete"), p("warehouse", "inventory"), p("warehouse", "write_off"),
    p("warehouse", "transfer"), p("warehouse", "income"), p("warehouse", "export"),

    # Warehouse — sub-resource permissions (3-part codes, endpoint-level enforcement)
    p3("warehouse", "type", "view"), p3("warehouse", "type", "manage"),
    p3("warehouse", "warehouse", "view"), p3("warehouse", "warehouse", "manage"),
    p3("warehouse", "rack", "view"), p3("warehouse", "rack", "manage"),
    p3("warehouse", "transfer", "view"), p3("warehouse", "transfer", "send"),
    p3("warehouse", "transfer", "receive"), p3("warehouse", "transfer", "cancel"),
    p3("warehouse", "request", "view"), p3("warehouse", "request", "create"),
    p3("warehouse", "request", "approve"),
    p3("warehouse", "product", "view"),
    p3("warehouse", "product", "import"), p3("warehouse", "product", "export"),
    p3("warehouse", "product", "barcode_view"), p3("warehouse", "product", "barcode_manage"),
    p3("warehouse", "product", "archive"),

    # Warehouse — BOM and cells (T-021)
    p3("warehouse", "bom", "view"), p3("warehouse", "bom", "manage"),
    p3("warehouse", "cell", "view"), p3("warehouse", "cell", "manage"),

    # Order — pick workflow (T-021)
    p3("order", "pick", "view"), p3("order", "pick", "execute"), p3("order", "pick", "contact"),

    # Finance
    p("finance", "view"), p("finance", "create"), p("finance", "update"),
    p("finance", "delete"), p("finance", "cashbox_manage"),
    p("finance", "set_balance"), p("finance", "export"),
    p("finance", "bill_payment"), p("finance", "send_sms"),

    # Customer
    p("customer", "view"), p("customer", "create"), p("customer", "update"),
    p("customer", "delete"), p("customer", "export"),

    # Supplier
    p("supplier", "view"), p("supplier", "create"), p("supplier", "update"),
    p("supplier", "delete"), p("supplier", "export"),

    # HR
    p("hr", "view"), p("hr", "create"), p("hr", "update"),
    p("hr", "delete"), p("hr", "salary"),

    # Manufacturing
    p("manufacturing", "view"), p("manufacturing", "create"),
    p("manufacturing", "update"), p("manufacturing", "delete"),
    p("manufacturing", "approve"),

    # Marketing
    p("marketing", "view"), p("marketing", "create"), p("marketing", "update"),
    p("marketing", "delete"),

    # Reference (catalogs: units, locations, currencies, categories)
    p("reference", "view"), p("reference", "create"),
    p("reference", "update"), p("reference", "delete"),

    # Settings
    p("settings", "view"), p("settings", "update"),
    p("settings", "subscription"), p("settings", "integration"),

    # Tools (price update, export center)
    p("tools", "view"), p("tools", "price_bulk"), p("tools", "export"),

    # Audit log
    p("audit", "view"),

    # RBAC management
    p("rbac", "view"), p("rbac", "manage"),
    p("rbac", "create"), p("rbac", "update"), p("rbac", "delete"),

    # Organization
    p("org", "view"), p("org", "update"), p("org", "manage_users"),
    p("org", "create"), p("org", "delete"),

    # Statistics / reports
    p("statistics", "view"),
    p3("statistics", "cogs", "view"),    # GET /statistics/cogs — finance-sensitive
    p3("statistics", "cogs", "export"),  # CSV export of COGS report

    # Integration Hub (T-100, DESIGN-3 §11)
    # Names match RBAC middleware derivation: GET→view, PUT→update, POST→create
    p("integrations", "view"),    # GET /integrations, GET /integrations/{code}
    p("integrations", "update"),  # PUT /integrations/{code}
    p("integrations", "create"),  # POST /integrations/{code}/test, /enable, /disable

    # Sprint 4 QA M2 — MXIK catalog search and 1C export
    p("mxik", "view"),          # GET /reference/mxik/search
    p("finance", "export_1c"),  # GET /finance/export/1c-csv, /finance/export/1c-xml

    # Sprint 5 — T-200: stock movements immutable journal
    p3("warehouse", "movements", "view"),   # GET /warehouse/movements

    # Sprint 5 — T-202: supplier returns workflow
    p3("supplier", "return", "view"),
    p3("supplier", "return", "create"),
    p3("supplier", "return", "confirm"),
    p3("supplier", "return", "cancel"),

    # Sprint 5 — T-204: inventory rich states + state machine
    p("warehouse", "manage_inventory_advanced"),

    # Sprint 5 — T-210: oprihodovanie (stock-in posting)
    p("warehouse", "manage_stock_ins"),
]


# Role → permission codes
ROLE_GRANTS: dict[str, list[str]] = {
    # Super admin — every permission (handled specially in seed)
    "superadmin": ["*"],

    # Admin — most things including RBAC management (except superadmin tweaks)
    "admin": [pm["code"] for pm in ALL_PERMISSIONS],
    # Note: ALL_PERMISSIONS now includes integrations.* — admin gets them automatically.

    # Manager — most operational things, no settings/rbac/billing
    "manager": [
        "sale.view", "sale.create", "sale.update", "sale.cancel",
        "sale.pay", "sale.refund", "sale.export", "sale.discount",
        "sale.change_warehouse",
        "warehouse.view", "warehouse.create", "warehouse.update",
        "warehouse.inventory", "warehouse.transfer", "warehouse.income",
        "warehouse.export",
        # Warehouse sub-resource — all except transfer.cancel (admin only)
        "warehouse.type.view", "warehouse.type.manage",
        "warehouse.warehouse.view", "warehouse.warehouse.manage",
        "warehouse.rack.view", "warehouse.rack.manage",
        "warehouse.transfer.view", "warehouse.transfer.send", "warehouse.transfer.receive",
        "warehouse.request.view", "warehouse.request.create", "warehouse.request.approve",
        "warehouse.product.view", "warehouse.product.import", "warehouse.product.export",
        "warehouse.product.barcode_view", "warehouse.product.barcode_manage",
        "warehouse.product.archive",
        "warehouse.bom.view", "warehouse.bom.manage",
        "warehouse.cell.view", "warehouse.cell.manage",
        "order.pick.view", "order.pick.execute", "order.pick.contact",
        "finance.view", "finance.create", "finance.update", "finance.export",
        "finance.export_1c", "finance.send_sms",
        "mxik.view",
        "customer.view", "customer.create", "customer.update", "customer.export",
        "supplier.view", "supplier.create", "supplier.update", "supplier.export",
        "hr.view", "hr.create", "hr.update",
        "manufacturing.view", "manufacturing.create", "manufacturing.update",
        "manufacturing.approve",
        "marketing.view", "marketing.create", "marketing.update",
        "reference.view", "reference.create", "reference.update",
        "tools.view", "tools.export", "tools.price_bulk",
        "statistics.view", "audit.view",
        "statistics.cogs.view",
        "settings.integration",
        "integrations.view",
        "integrations.update",
        "integrations.create",
        "warehouse.movements.view",
        "supplier.return.view", "supplier.return.create", "supplier.return.confirm",
        "supplier.return.cancel",
        "warehouse.manage_inventory_advanced",
        "warehouse.manage_stock_ins",
    ],

    # Accountant — finance focus, read-only on others
    "accountant": [
        "sale.view", "sale.export", "sale.pay",
        "warehouse.view", "warehouse.export",
        "warehouse.transfer.view", "warehouse.request.view",
        "warehouse.product.view", "warehouse.product.export",
        "warehouse.product.barcode_view",
        "finance.view", "finance.create", "finance.update",
        "finance.cashbox_manage", "finance.set_balance", "finance.export",
        "finance.export_1c", "finance.bill_payment",
        "mxik.view",
        "customer.view", "customer.export",
        "supplier.view", "supplier.export",
        "hr.view", "hr.salary",
        "reference.view",
        "tools.view", "tools.export",
        "statistics.view", "statistics.cogs.view", "statistics.cogs.export", "audit.view",
        "warehouse.movements.view",
        "supplier.return.view",
    ],

    # Cashier — POS + create sale + pay only
    "cashier": [
        "sale.view", "sale.create", "sale.pay",
        "warehouse.view",
        "warehouse.transfer.view", "warehouse.request.view", "warehouse.request.create",
        "warehouse.product.view", "warehouse.product.barcode_view",
        "customer.view", "customer.create",
        "reference.view",
        "order.pick.view", "order.pick.contact",
        "finance.bill_payment",
        "mxik.view",
        "settings.integration",
    ],

    # Viewer — read-only everywhere; also gets warehouse.product.export per ticket T-002
    "viewer": [pm["code"] for pm in ALL_PERMISSIONS
               if pm["action"] in ("view",) and pm["module"] not in ("rbac",)]
              + ["warehouse.product.export"],

    # Picker — warehouse pick execution (T-021; not a DB role yet, grants only)
    "picker": [
        "order.pick.view", "order.pick.execute", "order.pick.contact",
    ],
}
