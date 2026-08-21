"""
Standard permissions catalog for Aniq ERP.

Convention: permission code = "<module>.<action>"
Modules: sale, warehouse, finance, customer, supplier, hr,
         manufacturing, marketing, reference, settings, tools, audit, rbac, org
Actions: view, create, update, delete, export, approve, cancel, pay, refund
"""
from __future__ import annotations

from typing import TypedDict


class Permission(TypedDict):
    code: str
    module: str
    action: str


# Helper to build a permission dict
def p(module: str, action: str) -> Permission:
    return {"code": f"{module}.{action}", "module": module, "action": action}


# Master catalog — what permissions exist in the system
ALL_PERMISSIONS: list[Permission] = [
    # Sale
    p("sale", "view"), p("sale", "create"), p("sale", "update"),
    p("sale", "delete"), p("sale", "cancel"), p("sale", "pay"),
    p("sale", "refund"), p("sale", "export"), p("sale", "discount"),

    # Warehouse
    p("warehouse", "view"), p("warehouse", "create"), p("warehouse", "update"),
    p("warehouse", "delete"), p("warehouse", "inventory"), p("warehouse", "write_off"),
    p("warehouse", "transfer"), p("warehouse", "income"), p("warehouse", "export"),

    # Finance
    p("finance", "view"), p("finance", "create"), p("finance", "update"),
    p("finance", "delete"), p("finance", "cashbox_manage"),
    p("finance", "set_balance"), p("finance", "export"),

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
]


# Role → permission codes
ROLE_GRANTS: dict[str, list[str]] = {
    # Super admin — every permission (handled specially in seed)
    "superadmin": ["*"],

    # Admin — most things including RBAC management (except superadmin tweaks)
    "admin": [pm["code"] for pm in ALL_PERMISSIONS],

    # Manager — most operational things, no settings/rbac/billing
    "manager": [
        "sale.view", "sale.create", "sale.update", "sale.cancel",
        "sale.pay", "sale.refund", "sale.export", "sale.discount",
        "warehouse.view", "warehouse.create", "warehouse.update",
        "warehouse.inventory", "warehouse.transfer", "warehouse.income",
        "warehouse.export",
        "finance.view", "finance.create", "finance.update", "finance.export",
        "customer.view", "customer.create", "customer.update", "customer.export",
        "supplier.view", "supplier.create", "supplier.update", "supplier.export",
        "hr.view", "hr.create", "hr.update",
        "manufacturing.view", "manufacturing.create", "manufacturing.update",
        "manufacturing.approve",
        "marketing.view", "marketing.create", "marketing.update",
        "reference.view", "reference.create", "reference.update",
        "tools.view", "tools.export", "tools.price_bulk",
        "statistics.view", "audit.view",
    ],

    # Accountant — finance focus, read-only on others
    "accountant": [
        "sale.view", "sale.export", "sale.pay",
        "warehouse.view", "warehouse.export",
        "finance.view", "finance.create", "finance.update",
        "finance.cashbox_manage", "finance.set_balance", "finance.export",
        "customer.view", "customer.export",
        "supplier.view", "supplier.export",
        "hr.view", "hr.salary",
        "reference.view",
        "tools.view", "tools.export",
        "statistics.view", "audit.view",
    ],

    # Cashier — POS + create sale + pay only
    "cashier": [
        "sale.view", "sale.create", "sale.pay",
        "warehouse.view",
        "customer.view", "customer.create",
        "reference.view",
    ],

    # Viewer — read-only everywhere
    "viewer": [pm["code"] for pm in ALL_PERMISSIONS
               if pm["action"] in ("view",) and pm["module"] not in ("rbac",)],
}
