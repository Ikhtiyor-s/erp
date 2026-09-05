import {
  LayoutDashboard, Wallet, Warehouse, ShoppingCart, Users, Truck,
  Factory, UserCog, BarChart3, Settings, Megaphone, BookOpen,
  Wrench, ListTodo, Terminal, Plug, Sparkles, Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MenuChild = {
  label: string;
  href: string;
  description?: string;
  i18nKey?: string;
  /** Permission code(s) required to see this item. If any is granted, item shows. */
  permission?: string | string[];
};

export type MenuGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: MenuChild[];
  /** Permission code(s) required to see this group. */
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

  // ============ SALE ============
  {
    key: "sale",
    label: "Продажа",
    icon: ShoppingCart,
    permission: "sale.view",
    children: [
      { i18nKey: "sale_dashboard",        label: "Панель продаж",       href: "/sale/dashboard" },
      { i18nKey: "sale_contract",         label: "Контракты / Заказы",  href: "/sale/contract" },
      { i18nKey: "sale_return",           label: "Возвраты",            href: "/sale/return",         permission: "sale.refund" },
      { i18nKey: "sale_return_reason",    label: "Причины возврата",    href: "/sale/return-reason",  permission: "sale.refund" },
      { i18nKey: "sale_customer_payments",label: "Платежи клиентов",    href: "/sale/customer-payments", permission: "sale.pay" },
      { i18nKey: "sale_distribution",     label: "Дистрибуция",         href: "/sale/distribution" },
      { i18nKey: "sale_visits",           label: "Визиты",              href: "/sale/visits" },
    ],
  },

  // ============ FINANCE ============
  {
    key: "finance",
    label: "Финансы",
    icon: Wallet,
    permission: "finance.view",
    children: [
      { i18nKey: "finance_cash",                 label: "Кассы",                 href: "/finance/cash" },
      { i18nKey: "finance_cashbox_sessions",     label: "Смены кассы",           href: "/finance/cashbox-sessions" },
      { i18nKey: "finance_installments",         label: "Рассрочка",             href: "/finance/installments" },
      { i18nKey: "finance_transaction",          label: "Транзакции",            href: "/finance/transaction" },
      { i18nKey: "finance_invoice",              label: "Счета-фактуры",         href: "/finance/invoice" },
      { i18nKey: "finance_contract",             label: "Договоры",              href: "/finance/contract" },
      { i18nKey: "finance_currency",             label: "Валюты",                href: "/finance/currency",                  permission: "reference.view" },
      { i18nKey: "finance_payment_type",         label: "Типы платежей",         href: "/finance/payment-type",              permission: "reference.view" },
      { i18nKey: "finance_extra_cost",           label: "Доп. расходы",          href: "/finance/extra-cost" },

      { i18nKey: "finance_set_cashbox",          label: "Установить — кассы",    href: "/finance/cashbox-set-balance",       permission: "finance.set_balance" },
      { i18nKey: "finance_set_customer",         label: "Установить — клиента",  href: "/finance/customer-set-balance",      permission: "finance.set_balance" },
      { i18nKey: "finance_set_employee",         label: "Установить — сотр.",    href: "/finance/employee-set-balance",      permission: "finance.set_balance" },
      { i18nKey: "finance_set_supplier",         label: "Установить — пост.",    href: "/finance/supplier-set-balance",      permission: "finance.set_balance" },
      { i18nKey: "finance_set_person",           label: "Установить — лица",     href: "/finance/person-set-balance",        permission: "finance.set_balance" },

      { i18nKey: "finance_customer_balance",     label: "Баланс клиента",        href: "/finance/customer-balance" },
      { i18nKey: "finance_employee_balance",     label: "Баланс сотрудника",     href: "/finance/employee-balance" },
      { i18nKey: "finance_supplier_balance",     label: "Баланс поставщика",     href: "/finance/supplier-balance" },
      { i18nKey: "finance_person_balance",       label: "Баланс лица",           href: "/finance/person-balance" },

      { i18nKey: "finance_cashbox_turnover",     label: "Оборот кассы",          href: "/finance/cashbox-turnover-report" },
      { i18nKey: "finance_customer_turnover",    label: "Оборот клиента",        href: "/finance/customer-turnover-report" },
      { i18nKey: "finance_employee_turnover",    label: "Оборот сотрудника",     href: "/finance/employee-turnover-report" },
      { i18nKey: "finance_supplier_turnover",    label: "Оборот поставщика",     href: "/finance/supplier-turnover-report" },
      { i18nKey: "finance_person_turnover",      label: "Оборот лица",           href: "/finance/person-turnover-report" },

      { i18nKey: "finance_stats_balance",        label: "Статистика баланса",    href: "/finance/statistics-balance" },
      { i18nKey: "finance_stats_cash_flow",      label: "Денежный поток",        href: "/finance/statistics-cash-flow" },
      { i18nKey: "finance_stats_abc",            label: "ABC-анализ",            href: "/finance/statistics-abc-analysis" },
      { i18nKey: "finance_price_deviation",      label: "Отклонение цены",       href: "/finance/price-deviation-report" },
    ],
  },

  // ============ WAREHOUSE ============
  {
    key: "warehouse",
    label: "Склад",
    icon: Warehouse,
    permission: "warehouse.view",
    children: [
      { i18nKey: "warehouse_products",            label: "Товары",                href: "/warehouse/products" },
      { i18nKey: "warehouse_material",            label: "Сырьё",                 href: "/warehouse/material" },
      { i18nKey: "warehouse_semi_product",        label: "Полуфабрикаты",         href: "/warehouse/semi-product" },
      { i18nKey: "warehouse_services",            label: "Услуги",                href: "/warehouse/services" },
      { i18nKey: "warehouse_category",            label: "Категории",             href: "/warehouse/category" },
      { i18nKey: "warehouse_warehouses",          label: "Склады",                href: "/warehouse/warehouses" },
      { i18nKey: "warehouse_types",               label: "Типы складов",          href: "/warehouse/types",              permission: "warehouse.type.view" },

      { i18nKey: "warehouse_income",              label: "Приходы",               href: "/warehouse/income",            permission: "warehouse.income" },
      { i18nKey: "warehouse_revision",            label: "Инвентаризации",        href: "/warehouse/revision",          permission: "warehouse.inventory" },
      { i18nKey: "warehouse_write_off",           label: "Списания",              href: "/warehouse/write-off",         permission: "warehouse.write_off" },
      { i18nKey: "warehouse_write_off_reason",    label: "Причины списания",      href: "/warehouse/write-off-reason",  permission: "warehouse.write_off" },
      { i18nKey: "warehouse_stock_in",            label: "Оприходование",         href: "/warehouse/stock-in",          permission: "warehouse.manage_stock_ins" },
      { i18nKey: "warehouse_stock_in_reason",     label: "Причины оприх.",        href: "/warehouse/stock-in-reason",   permission: "warehouse.manage_stock_ins" },
      { i18nKey: "warehouse_internal_transfers",  label: "Внутр. переводы",       href: "/warehouse/internal-transfers", permission: "warehouse.transfer.view" },
      { i18nKey: "warehouse_requests",            label: "Заявки на товар",        href: "/warehouse/requests",           permission: "warehouse.request.view" },

      { i18nKey: "warehouse_product_warehouses",  label: "Остатки товаров",       href: "/warehouse/product-warehouses" },
      { i18nKey: "warehouse_recommended_stock",   label: "Рекомендуемые остатки", href: "/warehouse/recommended-stock" },
      { i18nKey: "warehouse_in_stock_report",     label: "Отчет по остаткам",     href: "/warehouse/in-stock-report" },
      { i18nKey: "warehouse_product_statistic",   label: "Статистика товаров",    href: "/warehouse/product-statistic" },
      { i18nKey: "warehouse_cost_of_goods",       label: "Себестоимость",         href: "/warehouse/cost-of-goods" },
      { i18nKey: "warehouse_product_income",      label: "Доход товаров",         href: "/warehouse/product-income" },
      { i18nKey: "warehouse_write_off_report",    label: "Отчет списаний",        href: "/warehouse/write-off-report" },
    ],
  },

  // ============ CUSTOMER ============
  {
    key: "customer",
    label: "Клиенты",
    icon: Users,
    permission: "customer.view",
    children: [
      { i18nKey: "customer_customers",      label: "Клиенты",         href: "/customer/customers" },
      { i18nKey: "customer_orders",         label: "Заказы",          href: "/customer/orders" },
      { i18nKey: "customer_category",       label: "Категории",       href: "/customer/category" },
      { i18nKey: "customer_location",       label: "Местоположение",  href: "/customer/location-customer" },
      { i18nKey: "customer_abc_xyz",        label: "ABC/XYZ-анализ",  href: "/customer/abc-xyz-analysis" },
      { i18nKey: "customer_analytics",      label: "Аналитика",       href: "/customer/customers-analytics-dashboard" },
      { i18nKey: "customer_cashback",       label: "Кэшбэк оборот",   href: "/customer/cashback-turnover-report" },
    ],
  },

  // ============ SUPPLY ============
  {
    key: "supply",
    label: "Снабжение",
    icon: Truck,
    permission: "supplier.view",
    children: [
      { i18nKey: "supply_purchases",      label: "Покупки",               href: "/supply/purchases" },
      { i18nKey: "supply_purchase_order", label: "Заказ на закуп",        href: "/supply/purchase-order" },
      { i18nKey: "supply_suppliers",      label: "Поставщики",            href: "/supplier/suppliers" },
      { i18nKey: "supply_returns",        label: "Возвраты поставщикам",  href: "/supplier/returns", permission: "supplier.return.view" },
    ],
  },

  // ============ MANUFACTURING ============
  {
    key: "manufacturing",
    label: "Производство",
    icon: Factory,
    permission: "manufacturing.view",
    children: [
      { i18nKey: "manufacturing_orders",          label: "Производство",       href: "/manufacturing/orders" },
      { i18nKey: "manufacturing_ingredient",      label: "Ингредиенты (BOM)",  href: "/manufacturing/ingredient" },
      { i18nKey: "manufacturing_state",           label: "Отчет состояния",    href: "/manufacturing/state-report" },
      { i18nKey: "manufacturing_by_responsible",  label: "По ответственному",  href: "/manufacturing/production-by-responsible" },
    ],
  },

  // ============ HR ============
  {
    key: "hr",
    label: "Сотрудники",
    icon: UserCog,
    permission: "hr.view",
    children: [
      { i18nKey: "hr_employees",  label: "Сотрудники", href: "/hr/employees" },
      { i18nKey: "hr_positions",  label: "Должности",  href: "/hr/positions" },
      { i18nKey: "hr_role",       label: "Роли",       href: "/hr/role" },
      { i18nKey: "hr_kpi",        label: "KPI",        href: "/hr/kpi" },
      { i18nKey: "hr_courier",    label: "Курьеры",    href: "/hr/courier" },
    ],
  },

  // ============ MARKETING ============
  {
    key: "marketing",
    label: "Маркетинг",
    icon: Megaphone,
    permission: "marketing.view",
    children: [
      { i18nKey: "marketing_discount",          label: "Скидки",           href: "/marketing/discount" },
      { i18nKey: "marketing_expected_products", label: "Ожидаемые товары", href: "/marketing/expected-products" },
    ],
  },

  // ============ REFERENCE ============
  {
    key: "reference",
    label: "Справочник",
    icon: BookOpen,
    permission: "reference.view",
    children: [
      { i18nKey: "reference_units",          label: "Единицы измерения", href: "/reference/units" },
      { i18nKey: "reference_locations",      label: "Локации / филиалы", href: "/reference/locations" },
      { i18nKey: "reference_legal_entity",   label: "Юридические лица",  href: "/reference/legal-entity" },
      { i18nKey: "reference_natural_person", label: "Физические лица",   href: "/reference/natural-person" },
      { i18nKey: "reference_prices",         label: "Прайс-листы",       href: "/reference/prices" },
    ],
  },

  // ============ STATISTICS ============
  {
    key: "statistics",
    label: "Статистика",
    icon: BarChart3,
    permission: "statistics.view",
    children: [
      { i18nKey: "stats_dashboard",            label: "Панель",                 href: "/statistics" },
      { i18nKey: "stats_sales",                label: "Продажи",                href: "/statistics/sales" },
      { i18nKey: "stats_cashbox",              label: "Касса",                  href: "/statistics/cashbox" },
      { i18nKey: "stats_products",             label: "Товары",                 href: "/statistics/products" },
      { i18nKey: "stats_sale_categories",      label: "По категориям",          href: "/statistics/sale-categories" },
      { i18nKey: "stats_sale_by_employee",     label: "По сотруднику",          href: "/statistics/sale-by-employee" },
      { i18nKey: "stats_sale_by_customer",     label: "По клиентам",            href: "/statistics/sale-by-customer" },
      { i18nKey: "stats_sale_by_payment",      label: "По типу оплаты",         href: "/statistics/sale-by-payment-type" },
      { i18nKey: "stats_customer_activity",    label: "Активность клиента",     href: "/statistics/customer-activity" },
      { i18nKey: "stats_unsold_goods",         label: "Непроданные товары",     href: "/statistics/unsold-goods" },
      { i18nKey: "stats_product_stock_history",label: "История остатков",       href: "/statistics/product-stock-history" },
      { i18nKey: "stats_production",           label: "Производство",           href: "/statistics/statistics-production" },
      { i18nKey: "stats_by_responsible",       label: "По ответственному",      href: "/statistics/by-responsible" },
      { i18nKey: "stats_recommended",          label: "Рекомендуемое произв-во",href: "/statistics/recommended-production-stock" },
      { i18nKey: "stats_cogs_report",           label: "COGS va yalpi foyda",    href: "/statistics/cogs-report",                  permission: "statistics.cogs.view" },
    ],
  },

  // ============ TOOLS ============
  {
    key: "tools",
    label: "Инструменты",
    icon: Wrench,
    permission: ["tools.view", "audit.view"],
    children: [
      { i18nKey: "tools_price",          label: "Установить цену",   href: "/tools/price",          permission: "tools.price_bulk" },
      { i18nKey: "tools_exports_center", label: "Центр экспорта",   href: "/tools/exports-center", permission: "tools.export" },
      { i18nKey: "tools_1c_export",      label: "1C eksport",       href: "/tools/1c-export",      permission: "finance.export_1c" },
      { i18nKey: "tools_label_print",    label: "Печать этикеток",  href: "/tools/label-print",    permission: "warehouse.product.export" },
      { i18nKey: "tools_audit",          label: "Audit tarixi",     href: "/tools/audit",          permission: "audit.view" },
    ],
  },

  // ============ TASKS ============
  {
    key: "tasks",
    label: "Задачи",
    icon: ListTodo,
    href: "/tasks",
    permission: "manufacturing.view",
  },

  // ============ POS ============
  {
    key: "pos",
    label: "POS-касса",
    icon: Terminal,
    permission: "sale.create",
    children: [
      { i18nKey: "pos_main",    label: "POS",            href: "/pos" },
      { i18nKey: "pos_tickets", label: "Открытые тикеты", href: "/pos/tickets" },
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

  // ============ INTEGRATION ============
  {
    key: "integration",
    label: "Интеграции",
    icon: Plug,
    href: "/integration",
    permission: "integrations.view",
  },

  // ============ ADMIN PANEL ============
  {
    key: "admin",
    label: "Admin panel",
    icon: Shield,
    permission: ["rbac.view", "org.manage_users"],
    children: [
      { i18nKey: "admin_users",        label: "Foydalanuvchilar",      href: "/admin/users",      permission: "org.manage_users" },
      { i18nKey: "admin_roles",        label: "Rollar",                href: "/admin/roles",      permission: "rbac.view" },
      { i18nKey: "admin_permissions",  label: "Ruxsatlar matritsasi",  href: "/admin/permissions", permission: "rbac.manage" },
      { i18nKey: "admin_organization", label: "Tashkilot",             href: "/admin/organization", permission: "org.update" },
      { i18nKey: "admin_audit_log",    label: "Audit jurnali",         href: "/admin/audit-log",  permission: "audit.view" },
    ],
  },

  // ============ SETTINGS ============
  {
    key: "settings",
    label: "Настройки",
    icon: Settings,
    permission: "settings.view",
    children: [
      { i18nKey: "settings_org",              label: "Организация",       href: "/settings",                  permission: "org.update" },
      { i18nKey: "settings_tags",             label: "Теги",              href: "/settings/tags" },
      { i18nKey: "settings_custom_fields",    label: "Доп. поля",         href: "/settings/custom-fields" },
      { i18nKey: "settings_crm",              label: "CRM",               href: "/settings/crm",              permission: "settings.integration" },
      { i18nKey: "settings_warehouse",        label: "Склад (настройки)", href: "/settings/warehouse" },
      { i18nKey: "settings_subscription",     label: "Подписка",          href: "/settings/subscription",     permission: "settings.subscription" },
      { i18nKey: "settings_general",          label: "Общие",             href: "/settings/general" },
      { i18nKey: "settings_payment_method",   label: "Способ оплаты",     href: "/settings/payment-method" },
      { i18nKey: "settings_receipt",          label: "Чек",               href: "/settings/receipt" },
      { i18nKey: "settings_sms",              label: "SMS",               href: "/settings/sms",              permission: "settings.integration" },
      { i18nKey: "settings_marketing_sms",    label: "Маркетинговые SMS", href: "/settings/marketing-sms",    permission: "settings.integration" },
      { i18nKey: "settings_label",            label: "Этикетка",          href: "/settings/label" },
      { i18nKey: "settings_loyalty",          label: "Карта лояльности",  href: "/settings/loyalty" },
      { i18nKey: "settings_devices",          label: "Устройства",        href: "/settings/devices" },
      { i18nKey: "settings_device_security",  label: "Безопасность",      href: "/settings/device-security" },
      { i18nKey: "settings_open_receipts",    label: "Открытые чеки",     href: "/settings/open-receipts" },
      { i18nKey: "settings_sale_options",     label: "Продажа",           href: "/settings/sale-options" },
      { i18nKey: "settings_scale",            label: "Весы",              href: "/settings/scale" },
      { i18nKey: "settings_reminders",        label: "Напоминания",       href: "/settings/customer-reminders" },
      { i18nKey: "settings_online_payments",  label: "Онлайн-платежи",    href: "/settings/online-payments",  permission: "settings.integration" },
      { i18nKey: "settings_didox",           label: "Didox",              href: "/settings/didox",            permission: "settings.integration" },
      { i18nKey: "settings_print_templates",  label: "Шаблоны печати",    href: "/settings/print-templates" },
      { i18nKey: "settings_calc_params",      label: "Параметры расчёта", href: "/settings/calc-params" },
      { i18nKey: "settings_marketplace",      label: "Marketpleys",       href: "/settings/marketplace",      permission: "settings.integration" },
      { i18nKey: "settings_delivery",          label: "Yetkazib berish",   href: "/settings/delivery",         permission: "settings.integration" },
    ],
  },
];
