import {
  LayoutDashboard, Wallet, Warehouse, ShoppingCart, Users, Truck,
  Factory, BarChart3, Settings, BookOpen, Calculator,
  Wrench, Terminal, Plug, Sparkles, Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MenuChild = {
  label: string;
  href: string;
  description?: string;
  i18nKey?: string;
  permission?: string | string[];
};

export type MenuGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: MenuChild[];
  permission?: string | string[];
};

export const menuTree: MenuGroup[] = [
  {
    key: "dashboard",
    label: "Главная",
    icon: LayoutDashboard,
    href: "/dashboard",
    permission: "statistics.view",
  },

  {
    key: "assistant",
    label: "AI assistent",
    icon: Sparkles,
    href: "/assistant",
    permission: "statistics.view",
  },

  // ============ POS ============
  {
    key: "pos",
    label: "POS-касса",
    icon: Terminal,
    permission: "sale.create",
    children: [
      { i18nKey: "pos_main",    label: "POS",             href: "/pos" },
      { i18nKey: "pos_tickets", label: "Открытые тикеты", href: "/pos/tickets" },
    ],
  },

  // ============ SALE ============
  {
    key: "sale",
    label: "Продажа",
    icon: ShoppingCart,
    permission: "sale.view",
    children: [
      { i18nKey: "sale_dashboard",         label: "Панель продаж",      href: "/sale/dashboard" },
      { i18nKey: "sale_contract",          label: "Контракты / Заказы", href: "/sale/contract" },
      { i18nKey: "sale_return",            label: "Возвраты",           href: "/sale/return",              permission: "sale.refund" },
      { i18nKey: "sale_return_reason",     label: "Причины возврата",   href: "/sale/return-reason",       permission: "sale.refund" },
      { i18nKey: "sale_customer_payments", label: "Платежи клиентов",   href: "/sale/customer-payments",   permission: "sale.pay" },
      { i18nKey: "sale_visits",            label: "Визиты",             href: "/sale/visits" },
      { i18nKey: "sale_distribution",      label: "Дистрибуция",        href: "/sale/distribution" },
    ],
  },

  // ============ FINANCE ============
  {
    key: "finance",
    label: "Финансы",
    icon: Wallet,
    permission: "finance.view",
    children: [
      { i18nKey: "finance_cash",             label: "Кассы",             href: "/finance/cash" },
      { i18nKey: "finance_cashbox_sessions", label: "Смены кассы",       href: "/finance/cashbox-sessions" },
      { i18nKey: "finance_transaction",      label: "Транзакции",         href: "/finance/transaction" },
      { i18nKey: "finance_invoice",          label: "Счета-фактуры",      href: "/finance/invoice" },
      { i18nKey: "finance_contract",         label: "Договоры",           href: "/finance/contract" },
      { i18nKey: "finance_balances",         label: "Balanslar",          href: "/finance/balances" },
      { i18nKey: "finance_turnover",         label: "Aylanmalar",         href: "/finance/turnover" },
      { i18nKey: "finance_set_balance",      label: "Balans o'rnatish",   href: "/finance/set-balance",    permission: "finance.set_balance" },
      { i18nKey: "finance_installments",     label: "Рассрочка",          href: "/finance/installments" },
      { i18nKey: "finance_extra_cost",       label: "Доп. расходы",       href: "/finance/extra-cost" },
    ],
  },

  // ============ ACCOUNTING ============
  {
    key: "accounting",
    label: "Buxgalteriya",
    icon: Calculator,
    permission: "accounting.view",
    children: [
      { i18nKey: "accounting_accounts", label: "Hisoblar rejasi", href: "/accounting/accounts" },
      { i18nKey: "accounting_journal",  label: "Jurnal",          href: "/accounting/journal" },
      { i18nKey: "accounting_trial_balance", label: "Aylanma-saldo", href: "/accounting/trial-balance" },
      { i18nKey: "accounting_pnl",           label: "Foyda-zarar",   href: "/accounting/pnl" },
      { i18nKey: "accounting_balance_sheet", label: "Balans",        href: "/accounting/balance-sheet" },
    ],
  },

  // ============ WAREHOUSE ============
  {
    key: "warehouse",
    label: "Склад",
    icon: Warehouse,
    permission: "warehouse.view",
    children: [
      { i18nKey: "warehouse_products",           label: "Товары",             href: "/warehouse/products" },
      { i18nKey: "warehouse_warehouses",         label: "Склады",             href: "/warehouse/warehouses" },
      { i18nKey: "warehouse_category",           label: "Категории",          href: "/warehouse/category" },
      { i18nKey: "warehouse_income",             label: "Приходы",            href: "/warehouse/income",             permission: "warehouse.income" },
      { i18nKey: "warehouse_internal_transfers", label: "Внутр. переводы",    href: "/warehouse/internal-transfers", permission: "warehouse.transfer.view" },
      { i18nKey: "warehouse_revision",           label: "Инвентаризации",     href: "/warehouse/revision",           permission: "warehouse.inventory" },
      { i18nKey: "warehouse_write_off",          label: "Списания",           href: "/warehouse/write-off",          permission: "warehouse.write_off" },
      { i18nKey: "warehouse_stock_in",           label: "Оприходование",      href: "/warehouse/stock-in",           permission: "warehouse.manage_stock_ins" },
      { i18nKey: "warehouse_requests",           label: "Заявки",             href: "/warehouse/requests",           permission: "warehouse.request.view" },
      { i18nKey: "warehouse_product_warehouses", label: "Остатки",            href: "/warehouse/product-warehouses" },
    ],
  },

  // ============ SUPPLY ============
  {
    key: "supply",
    label: "Снабжение",
    icon: Truck,
    permission: "supplier.view",
    children: [
      { i18nKey: "supply_purchases",      label: "Покупки",              href: "/supply/purchases" },
      { i18nKey: "supply_purchase_order", label: "Заказ на закуп",       href: "/supply/purchase-order" },
      { i18nKey: "supply_suppliers",      label: "Поставщики",           href: "/supplier/suppliers" },
      { i18nKey: "supply_returns",        label: "Возвраты поставщикам", href: "/supplier/returns", permission: "supplier.return.view" },
    ],
  },

  // ============ CUSTOMERS ============
  {
    key: "customer",
    label: "Клиенты",
    icon: Users,
    permission: "customer.view",
    children: [
      { i18nKey: "customer_customers", label: "Клиенты",       href: "/customer/customers" },
      { i18nKey: "customer_orders",    label: "Заказы",         href: "/customer/orders" },
      { i18nKey: "customer_portal_orders", label: "Marketplace buyurtmalari", href: "/customer/portal-orders" },
      { i18nKey: "customer_category",  label: "Категории",      href: "/customer/category" },
      { i18nKey: "customer_abc_xyz",   label: "ABC/XYZ-анализ", href: "/customer/abc-xyz-analysis" },
      { i18nKey: "customer_analytics", label: "Аналитика",      href: "/customer/customers-analytics-dashboard" },
    ],
  },

  // ============ OPERATIONS (HR + Manufacturing + Marketing) ============
  {
    key: "operations",
    label: "Xodimlar / Ishlab chiqarish",
    icon: Factory,
    permission: ["hr.view", "manufacturing.view"],
    children: [
      { i18nKey: "hr_employees",           label: "Сотрудники",       href: "/hr/employees" },
      { i18nKey: "hr_positions",           label: "Должности",        href: "/hr/positions" },
      { i18nKey: "hr_kpi",                 label: "KPI",              href: "/hr/kpi" },
      { i18nKey: "hr_courier",             label: "Курьеры",          href: "/hr/courier" },
      { i18nKey: "manufacturing_orders",   label: "Производство",     href: "/manufacturing/orders",    permission: "manufacturing.view" },
      { i18nKey: "manufacturing_ingredient", label: "Ингредиенты (BOM)", href: "/manufacturing/ingredient", permission: "manufacturing.view" },
      { i18nKey: "marketing_discount",     label: "Скидки",           href: "/marketing/discount",      permission: "marketing.view" },
      { i18nKey: "tasks_main",             label: "Задачи",           href: "/tasks" },
    ],
  },

  // ============ STATISTICS ============
  {
    key: "statistics",
    label: "Статистика",
    icon: BarChart3,
    permission: "statistics.view",
    children: [
      { i18nKey: "stats_dashboard",            label: "Панель",           href: "/statistics" },
      { i18nKey: "stats_sales",                label: "Продажи",          href: "/statistics/sales" },
      { i18nKey: "stats_sale_by_employee",     label: "По сотруднику",    href: "/statistics/sale-by-employee" },
      { i18nKey: "stats_sale_by_customer",     label: "По клиентам",      href: "/statistics/sale-by-customer" },
      { i18nKey: "stats_cashbox",              label: "Касса",            href: "/statistics/cashbox" },
      { i18nKey: "stats_products",             label: "Товары",           href: "/statistics/products" },
      { i18nKey: "stats_cogs_report",          label: "COGS",             href: "/statistics/cogs-report",             permission: "statistics.cogs.view" },
      { i18nKey: "stats_product_stock_history",label: "История остатков", href: "/statistics/product-stock-history" },
    ],
  },

  // ============ INTEGRATION ============
  {
    key: "integration",
    label: "Интеграции",
    icon: Plug,
    permission: "integrations.view",
    children: [
      { i18nKey: "integration_hub",          label: "Панель интеграций",   href: "/integration" },
      { i18nKey: "settings_online_payments", label: "Онлайн-платежи",      href: "/settings/online-payments",  permission: "settings.integration" },
      { i18nKey: "settings_didox",           label: "Didox e-faktura",      href: "/settings/didox" },
      { i18nKey: "settings_delivery",        label: "Yetkazib berish",      href: "/settings/delivery" },
      { i18nKey: "settings_sms",             label: "SMS",                  href: "/settings/sms",              permission: "settings.integration" },
      { i18nKey: "settings_crm",             label: "CRM (Telegram)",       href: "/settings/crm",              permission: "settings.integration" },
      { i18nKey: "settings_marketing_sms",   label: "Маркетинговые SMS",    href: "/settings/marketing-sms",    permission: "settings.integration" },
      { i18nKey: "settings_marketplace",     label: "Marketpleys",          href: "/settings/marketplace",      permission: "settings.integration" },
    ],
  },

  // ============ TOOLS ============
  {
    key: "tools",
    label: "Asboblar",
    icon: Wrench,
    permission: "tools.view",
    children: [
      { i18nKey: "tools_price",          label: "Установить цену",  href: "/tools/price",          permission: "tools.price_bulk" },
      { i18nKey: "tools_exports_center", label: "Центр экспорта",   href: "/tools/exports-center", permission: "tools.export" },
      { i18nKey: "tools_1c_export",      label: "1C eksport",       href: "/tools/1c-export",      permission: "finance.export_1c" },
      { i18nKey: "tools_label_print",    label: "Печать этикеток",  href: "/tools/label-print",    permission: "warehouse.product.export" },
    ],
  },

  // ============ ADMIN PANEL ============
  {
    key: "admin",
    label: "Admin panel",
    icon: Shield,
    permission: ["rbac.view", "org.manage_users"],
    children: [
      { i18nKey: "admin_users",        label: "Foydalanuvchilar", href: "/admin/users",        permission: "org.manage_users" },
      { i18nKey: "admin_roles",        label: "Rollar",           href: "/admin/roles",        permission: "rbac.view" },
      { i18nKey: "admin_organization", label: "Tashkilot",        href: "/admin/organization", permission: "org.update" },
      { i18nKey: "admin_audit_log",    label: "Audit jurnali",    href: "/admin/audit-log",    permission: "audit.view" },
    ],
  },

  // ============ REFERENCE ============
  {
    key: "reference",
    label: "Справочник",
    icon: BookOpen,
    permission: "reference.view",
    children: [
      { i18nKey: "reference_units",          label: "Единицы",        href: "/reference/units" },
      { i18nKey: "reference_locations",      label: "Локации",         href: "/reference/locations" },
      { i18nKey: "reference_legal_entity",   label: "Юр. лица",       href: "/reference/legal-entity" },
      { i18nKey: "reference_natural_person", label: "Физ. лица",      href: "/reference/natural-person" },
      { i18nKey: "reference_prices",         label: "Прайс-листы",    href: "/reference/prices" },
      { i18nKey: "finance_currency",         label: "Валюты",         href: "/finance/currency" },
      { i18nKey: "finance_payment_type",     label: "Типы платежей",  href: "/finance/payment-type" },
    ],
  },

  // ============ SETTINGS ============
  {
    key: "settings",
    label: "Настройки",
    icon: Settings,
    permission: "settings.view",
    children: [
      { i18nKey: "settings_org",            label: "Организация",       href: "/settings",                permission: "org.update" },
      { i18nKey: "settings_general",        label: "Общие",             href: "/settings/general" },
      { i18nKey: "settings_subscription",   label: "Подписка",          href: "/settings/subscription",   permission: "settings.subscription" },
      { i18nKey: "settings_devices",        label: "Устройства",        href: "/settings/devices" },
      { i18nKey: "settings_print_templates",label: "Шаблоны печати",    href: "/settings/print-templates" },
      { i18nKey: "settings_payment_method", label: "Способ оплаты",     href: "/settings/payment-method" },
      { i18nKey: "settings_warehouse",      label: "Склад (настройки)", href: "/settings/warehouse" },
    ],
  },

  // ============ LOGISTICS ============
  {
    key: "logistics",
    label: "Логистика",
    icon: Truck,
    href: "/logistics",
    permission: "sale.view",
  },
];
