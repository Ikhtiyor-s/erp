# Aniq ERP — Loyiha Rejasi

**Asos:** alohida ERP tizim, POS/OneUZ dan ajratilgan
**Til:** UZ / RU / EN (default UZ)

---

## 1. Modullar va submodullar

### 1.1. Finance (Финансы) — 25 sahifa
- Кассы, Транзакции, Счета-фактуры
- Установить баланс: кассы / клиента / сотрудника / поставщика / лица
- Валюты, Типы платежей, Дополнительные расходы, Договоры
- Баланс: клиента / сотрудника / поставщика / лица
- Оборот: кассы / клиента / сотрудника / поставщика / лица
- Статистика: баланса / денежного потока, ABC-анализ, Отклонение цены

### 1.2. Warehouse (Склад) — 19 sahifa
- Товары, Сырье, Полуфабрикаты, Услуги, Категории товаров
- Приходы, Инвентаризации, Списания, Причины списания
- Внутренние переводы, Склады, Типы складов
- Остатки товаров, Рекомендуемые остатки, Остаток на складе (отчет)
- Статистика товаров, Стоимость, Доход, Отчет списаний

### 1.3. Sale (Продажа) — 5 sahifa
- Контракты, Возвраты, Причины возврата
- Платежи клиентов, Панель управления продажами

### 1.4. Customer (Клиент) — 7 sahifa
- Клиенты, Заказы, Категории клиентов
- Местоположение клиента, ABC/XYZ-анализ, Аналитика клиентов
- Кэшбэк оборот

### 1.5. Supply (Снабжение) — 3 sahifa
- Покупки, Заказ на закуп, Поставщики

### 1.6. Manufacturing (Производство) — 4 sahifa
- Производство, Ингредиенты, Отчет состояния
- Производство по ответственному

### 1.7. HR — 4 sahifa
- Сотрудники, Роли, KPI, Профиль сотрудника

### 1.8. Statistics (Статистика) — 18 sahifa
- Панель управления, Продажи, Касса, Товары
- Продажи по: категориям / сотруднику / клиентам / типу оплаты
- Торговля товарами, Торговля клиентом, Продажи клиентом
- Активность клиента, Непроданные товары, Посредничество
- История остатков, Производство, По ответственному
- Рекомендуемое производство

### 1.9. Marketing (Маркетинг) — 2 sahifa
- Скидки, Ожидаемые товары

### 1.10. Reference (Справочник) — 3 sahifa
- Юридические лица, Физические лица, Прайс-листы

### 1.11. Tools (Инструменты) — 2 sahifa
- Установить цену, Центр экспорта

### 1.12. Tasks (Задачи) — 1 sahifa
- Список задач

### 1.13. Settings (Настройки) — 20+ sub-section
- CRM, Склад, Организации, Подписка, Общие
- Способ оплаты, Чек, SMS, Маркетинговые SMS
- Этикетка, Карта лояльности, Устройства
- Безопасность устройства, Открытые чеки, Продажа
- Весы, Валюты, Напоминание покупателей
- Онлайн-платежи, Шаблоны печати, Параметры расчёта, Marketplace

### 1.14. Dashboard, POS, Integration — 1-1 sahifa har biri

---

## 2. Fazalar (8 hafta)

### Faza 1 — Asos (1 hafta) ✅ KETMA-KET BAJARILYAPTI
- [x] Monorepo struktura (apps/api + apps/web + infra)
- [x] PostgreSQL 24 jadval + 3 view + seed
- [x] FastAPI 12 modul, JWT auth, multi-tenancy header
- [x] Next.js 15 (auth, dashboard, sidebar, 9 stub sahifa)
- [x] Docker Compose (postgres, redis, api, web, pgadmin)
- [x] To'liq menyu daraxti (100+ submenu)

### Faza 2 — Reference + Master Data (1 hafta) ✅ BAJARILDI
- [x] Currency (CRUD + manual rate + CBU.uz import)
- [x] Units (CRUD)
- [x] Payment Types (CRUD)
- [x] Locations (CRUD)
- [x] Product Categories (tree)
- [x] Customer Categories
- [x] Warehouses (CRUD)
- [x] Positions

### Faza 3 — Customer / Supplier (1 hafta) ✅ BAJARILDI
- [x] Customer CRUD + CSV import/export
- [x] Supplier CRUD
- [x] Customer balance + set-balance (cash_movement orqali)
- [x] Supplier balance + set-balance
- [x] Customer categories (Faza 2)
- [x] ABC analiz (80/15/5 sales bo'yicha)
- [x] Cashback turnover (sozlanadigan stavka)

### Faza 4 — Warehouse (2 hafta) ✅ BAJARILDI
- [x] Products full CRUD (barcode, SKU)
- [x] Categories tree
- [x] Stock balances per warehouse
- [x] Supply (purchase) → auto-increment stock (Faza 1)
- [x] Inventory (revision) — fact qiymat va diff stockka qo'llaniladi
- [x] Write-offs + write-off reasons (decrement stock)
- [x] Internal transfers (from warehouse → to warehouse, avg_cost ko'chiriladi)
- [x] Stock reports (in-stock-report, cost-of-goods, income)
- [x] Recommended stock (min/max + below-min ogohlantirish)
- [x] Cost of goods (umumiy ombor qiymati)
- [x] DB schema patches lifespan'da idempotent ishga tushadi

### Faza 5 — Sale (1.5 hafta) ✅ BAJARILDI
- [x] Sale create — auto-decrement stock (Faza 1)
- [x] Sale pay (cash_movement + paid_amount + status partial/paid)
- [x] Sale cancel (stock qaytariladi)
- [x] Sale returns + return reasons CRUD (stock +qty)
- [x] Customer payments tracking (sale-related cash_movements)
- [x] Sales dashboard (today/week/month KPI + top 5 + 30-day bars)
- [x] Contracts (b2b) CRUD
- [x] Invoice CRUD
- [x] Sale detail sahifa — HTML chek + window.print() (PDF brauzer orqali)

### Faza 6 — Finance (1 hafta) ✅ BAJARILDI
- [x] Cashboxes — full CRUD (create/update/close)
- [x] Cash movements — in/out + **transfer** (kassa→kassa, 2 yozuv)
- [x] Set balance: cashbox (full UI), customer/supplier (Faza 3), employee/person endpointlar
- [x] Extra costs — CRUD + avto cash_movement
- [x] Turnover reports: cashbox, customer, supplier, employee (umumiy TurnoverReport komponenti)
- [x] Cash flow statistics — daily + by payment type
- [x] Price deviation report — sale.price vs product.sale_price
- [x] Balance statistics — kassalar va klient balansi
- [x] ABC statistika ko'rinishi

### Faza 7 — Manufacturing + HR (1 hafta) ✅ BAJARILDI
- [x] BOM (retsept) — full CRUD with items
- [x] Production orders — CRUD + **start/finish** (raw stock − ingredients × multiplier, finished stock + qty bilan weighted avg cost)
- [x] Production by responsible (full_name bo'yicha + % выполнения)
- [x] Production state-report (status bo'yicha summary)
- [x] Employees CRUD + profile sahifa (balance, productions, KPI history)
- [x] Roles list (init.sql'da seed bor)
- [x] KPI tracking — kpi_entries jadval + UPSERT + plan/fakt/%

### Faza 8 — Statistics + Reports (0.5 hafta) ✅ BAJARILDI
- [x] Sales analytics: dashboard (KPI cards), kunlik dynamics, top mahsulot, top kategoriya
- [x] Sale breakdowns: by employee, by customer, by payment type
- [x] Product analytics: top, unsold goods, stock history
- [x] Customer activity (days_inactive bilan)
- [x] Manufacturing statistics: production по дням, по ответственному
- [x] Recommended production stock (BOM mavjud + qoldiq min'dan past)
- [x] CSV eksport — 8 ta hisobot uchun (universal /statistics/export/{report})
- [ ] Catch-all: product-trade, customer-trade, sale-customer, mediator (specifik, ehtiyojga ko'ra)

### Faza 9 — Settings + Integration (1 hafta) ✅ BAJARILDI
- [x] Organization edit form (PUT /settings/organization)
- [x] Universal JSONB settings store (app_settings) + GET/PUT /settings/key/{key}
- [x] CRM (Telegram bot config), SMS, Marketing SMS, Loyalty cards
- [x] Receipt format, Label/barcode format, Sale options, Payment method
- [x] Online payments (Click/Payme/Apelsin keys)
- [x] Device management — printer/scanner/scale CRUD
- [x] Print templates — receipt/label/invoice CRUD bilan default flag
- [x] Open receipts (draft sales)
- [x] Subscription page (4 ta tarif)
- [x] Device security, scale, customer reminders, calc params, marketplace, warehouse settings
- [x] Integration overview page (cards + links)
- [x] SettingsForm reusable komponenti (15+ sahifa shu komponentdan)

---

## 3. Texnik qarorlar

### Backend
- **Hozir:** raw SQL via SQLAlchemy `text()`
- **Keyingi:** SQLAlchemy 2 declarative ORM modellari + Alembic migrations
- **Async:** FastAPI + asyncpg
- **Auth:** JWT Bearer (access 60min + refresh 30d), keyinroq RBAC
- **Validation:** Pydantic v2

### Frontend
- **Next.js 15** App Router, Server Components keyinroq
- **State:** TanStack Query (server state) + Zustand (UI state)
- **Forms:** react-hook-form + zod
- **UI:** Tailwind + shadcn/ui pattern (custom components)
- **Tables:** dastlab oddiy HTML, keyinroq TanStack Table
- **Charts:** Recharts
- **i18n:** keyingi bosqichda next-intl (ru + uz + en)

### DB
- **Postgres 16** — multi-tenant via `organization_id`
- **Soft delete:** `is_active` boolean (yoki `deleted_at` keyinroq)
- **Audit:** har create/update `audit_log` ga yoziladi
- **Materialized views:** statistika uchun (cron orqali refresh)

### Background
- **Celery + Redis** — hisobotlar, SMS, PDF generate
- **Cron:** kunlik agregatsiyalar (sales_summary), valyuta kursi import

---

## 4. Menyu navigatsiya tuzilishi

### Sidebar (oddiy dastlabki)
**Asosiy bo'limlar (top-level):**
1. Главная (Dashboard)
2. Продажа (Sale) — kengaytirilgan
3. Касса (Finance) — kengaytirilgan
4. Склад (Warehouse) — kengaytirilgan
5. Клиенты (Customer) — kengaytirilgan
6. Снабжение (Supply) — kengaytirilgan
7. Производство (Manufacturing) — kengaytirilgan
8. Сотрудники (HR) — kengaytirilgan
9. Маркетинг (Marketing) — kengaytirilgan
10. Справочник (Reference) — kengaytirilgan
11. Статистика (Statistics) — kengaytirilgan
12. Инструменты (Tools) — kengaytirilgan
13. Задачи (Tasks)
14. Настройки (Settings) — kengaytirilgan

### URL strukturasi
- `/dashboard` — bosh sahifa
- `/finance/cash`, `/finance/transaction`, `/finance/invoice`, ...
- `/warehouse/products`, `/warehouse/material`, `/warehouse/income`, ...
- `/sale/contract`, `/sale/return`, `/sale/customer-payments`, ...
- va h.k.

---

## 5. MVP (Minimal mahsulot) — 4 hafta ichida

Quyidagi kombinatsiya MVP'ni tashkil etadi (mijozga ko'rsatish mumkin):

1. **Auth + Organization** ✅
2. **Reference:** currencies, units, payment types
3. **Warehouse:** products, warehouses, stock balances, supply (purchase)
4. **Sale:** simple sale (with cash payment), receipt PDF
5. **Customer:** basic CRUD
6. **Finance:** cashboxes, cash movements (manual)
7. **Statistics:** dashboard, sales summary, stock value

Bu MVP allaqachon ishlatib bo'ladi (kichik do'kon uchun).

---

## 6. Hozirgi holat

| Bosqich | Holat |
|---|---|
| Faza 1 (asos) | ✅ Bajarildi |
| Menyu tuzilishi | ✅ Aniqlandi (100+ submenu) |
| Sidebar kod | 🟡 Faqat 10 top-level (qayta yozilyapti) |
| Submenu sahifalari | 🟡 Catch-all placeholder yaratiladi |
| Backend submenu endpoint'lar | 🟡 12 modul prefix bor, har submenu uchun list/CRUD keyin |

---

## 7. Keyingi qadamlar (bugun)

1. ✅ `menu.config.ts` — 100+ submenu daraxti (Russian labels)
2. ✅ Sidebar — accordion bilan kengaytiriladigan
3. ✅ Catch-all sahifa `[...slug]/page.tsx` — hali yozilmagan sahifalar uchun "Coming soon" + menyu nomi ko'rsatadi
4. ⏳ Faza 2 boshlash (Reference modulini to'liq qilish)

Foydalanuvchi kerakli modulni tanlasin, men ketma-ket to'liq qilaman:
- **A)** Reference (currencies, units, payment types) — eng oson, asos
- **B)** Warehouse to'liq (products + supply + stock)
- **C)** Sale to'liq (oddiy chek + stock decrement)
- **D)** Finance to'liq (cashbox + harakatlar)
- **E)** Faza 2-8 ni ketma-ket avtomatik bajarish (lekin har birida tanlovlar bo'lishi mumkin)
