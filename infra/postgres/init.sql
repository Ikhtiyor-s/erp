-- ============================================================
-- Aniq ERP — DDL (PostgreSQL 16)
-- Multi-organization, multi-currency, double-entry friendly
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================
-- CORE / AUTH
-- ============================================================

CREATE TABLE organizations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(200) NOT NULL,
    code         VARCHAR(50) UNIQUE NOT NULL,
    tin          VARCHAR(20),
    address      TEXT,
    phone        VARCHAR(20),
    logo_url     TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    username        VARCHAR(50) UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(200),
    avatar_url      TEXT,
    locale          VARCHAR(5) DEFAULT 'ru',
    is_active       BOOLEAN DEFAULT TRUE,
    is_superuser    BOOLEAN DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE permissions (
    id      SERIAL PRIMARY KEY,
    code    VARCHAR(100) UNIQUE NOT NULL,
    module  VARCHAR(50) NOT NULL,
    action  VARCHAR(50) NOT NULL
);

CREATE TABLE role_permissions (
    role_id       INT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_organizations (
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role_id         INT REFERENCES roles(id),
    is_default      BOOLEAN DEFAULT FALSE,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, organization_id)
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    organization_id UUID,
    user_id         UUID,
    action          VARCHAR(50),
    entity          VARCHAR(100),
    entity_id       TEXT,
    diff            JSONB,
    ip              INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_org ON audit_log(organization_id, created_at DESC);

-- ============================================================
-- REFERENCE (spravochniklar)
-- ============================================================

CREATE TABLE currencies (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(3) UNIQUE NOT NULL,
    name            VARCHAR(50) NOT NULL,
    symbol          VARCHAR(10),
    is_base         BOOLEAN DEFAULT FALSE,
    decimals        SMALLINT DEFAULT 2,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE currency_rates (
    id           BIGSERIAL PRIMARY KEY,
    currency_id  INT REFERENCES currencies(id),
    rate         NUMERIC(20,6) NOT NULL,
    rate_date    DATE NOT NULL,
    UNIQUE (currency_id, rate_date)
);

CREATE TABLE units (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(50) NOT NULL,
    short_name  VARCHAR(10)
);

CREATE TABLE payment_types (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    code            VARCHAR(50) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    is_cash         BOOLEAN DEFAULT TRUE,
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (organization_id, code)
);

CREATE TABLE locations (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    address         TEXT,
    phone           VARCHAR(20),
    is_active       BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- HR
-- ============================================================

CREATE TABLE positions (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT
);

CREATE TABLE employees (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id),
    full_name        VARCHAR(200) NOT NULL,
    position_id      INT REFERENCES positions(id),
    phone            VARCHAR(20),
    email            CITEXT,
    salary           NUMERIC(20,2),
    salary_currency  INT REFERENCES currencies(id),
    hire_date        DATE,
    fire_date        DATE,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMER / SUPPLIER (kontragentlar)
-- ============================================================

CREATE TABLE customer_categories (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    discount_pct    NUMERIC(5,2) DEFAULT 0
);

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    code            VARCHAR(50),
    name            VARCHAR(200) NOT NULL,
    category_id     INT REFERENCES customer_categories(id),
    location_id     INT REFERENCES locations(id),
    phone           VARCHAR(20),
    email           CITEXT,
    address         TEXT,
    tin             VARCHAR(20),
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, code)
);
CREATE INDEX idx_customers_org ON customers(organization_id);

CREATE TABLE suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    code            VARCHAR(50),
    name            VARCHAR(200) NOT NULL,
    phone           VARCHAR(20),
    email           CITEXT,
    address         TEXT,
    tin             VARCHAR(20),
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, code)
);

-- ============================================================
-- WAREHOUSE / PRODUCT
-- ============================================================

CREATE TABLE warehouses (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    address         TEXT,
    responsible_id  UUID REFERENCES employees(id),
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE product_categories (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id       INT REFERENCES product_categories(id),
    name            VARCHAR(100) NOT NULL,
    path            TEXT
);

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    sku             VARCHAR(50),
    barcode         VARCHAR(50),
    name            VARCHAR(200) NOT NULL,
    category_id     INT REFERENCES product_categories(id),
    unit_id         INT REFERENCES units(id),
    purchase_price  NUMERIC(20,2) DEFAULT 0,
    sale_price      NUMERIC(20,2) DEFAULT 0,
    currency_id     INT REFERENCES currencies(id),
    is_service      BOOLEAN DEFAULT FALSE,
    is_produced     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, sku),
    UNIQUE (organization_id, barcode)
);
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_cat ON products(category_id);

CREATE TABLE stock_balances (
    id            BIGSERIAL PRIMARY KEY,
    warehouse_id  INT REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity      NUMERIC(20,3) NOT NULL DEFAULT 0,
    avg_cost      NUMERIC(20,2) DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (warehouse_id, product_id)
);
CREATE INDEX idx_stock_wh ON stock_balances(warehouse_id);

-- Inventarizatsiya
CREATE TYPE inventory_status AS ENUM ('draft','in_progress','completed','cancelled');

CREATE TABLE inventories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id    INT REFERENCES warehouses(id),
    doc_number      VARCHAR(50),
    status          inventory_status DEFAULT 'draft',
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    responsible_id  UUID REFERENCES employees(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory_items (
    id              BIGSERIAL PRIMARY KEY,
    inventory_id    UUID REFERENCES inventories(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id),
    expected_qty    NUMERIC(20,3) NOT NULL DEFAULT 0,
    actual_qty      NUMERIC(20,3) NOT NULL DEFAULT 0,
    diff_qty        NUMERIC(20,3) GENERATED ALWAYS AS (actual_qty - expected_qty) STORED
);

-- Transfer (sklad orasi)
CREATE TYPE transfer_status AS ENUM ('draft','sent','received','cancelled');

CREATE TABLE transfers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number          VARCHAR(50),
    from_warehouse_id   INT REFERENCES warehouses(id),
    to_warehouse_id     INT REFERENCES warehouses(id),
    status              transfer_status DEFAULT 'draft',
    transfer_date       DATE NOT NULL,
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transfer_items (
    id           BIGSERIAL PRIMARY KEY,
    transfer_id  UUID REFERENCES transfers(id) ON DELETE CASCADE,
    product_id   UUID REFERENCES products(id),
    quantity     NUMERIC(20,3) NOT NULL,
    cost         NUMERIC(20,2)
);

-- ============================================================
-- WRITE-OFF (spisaniye)
-- ============================================================

CREATE TABLE write_off_reasons (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE write_offs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number      VARCHAR(50),
    warehouse_id    INT REFERENCES warehouses(id),
    reason_id       INT REFERENCES write_off_reasons(id),
    write_off_date  DATE NOT NULL,
    total_amount    NUMERIC(20,2) DEFAULT 0,
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE write_off_items (
    id           BIGSERIAL PRIMARY KEY,
    write_off_id UUID REFERENCES write_offs(id) ON DELETE CASCADE,
    product_id   UUID REFERENCES products(id),
    quantity     NUMERIC(20,3) NOT NULL,
    cost         NUMERIC(20,2) DEFAULT 0,
    amount       NUMERIC(20,2) GENERATED ALWAYS AS (quantity * cost) STORED
);

-- Tavsiya etiladigan qoldiqlar (min/max stock per product+warehouse)
CREATE TABLE recommended_stock (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id    INT REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
    min_qty         NUMERIC(20,3) NOT NULL DEFAULT 0,
    max_qty         NUMERIC(20,3),
    UNIQUE (warehouse_id, product_id)
);

-- ============================================================
-- SUPPLY (kirim / ta'minot)
-- ============================================================

CREATE TYPE supply_status AS ENUM ('draft','approved','received','cancelled');

CREATE TABLE supplies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number      VARCHAR(50),
    supplier_id     UUID REFERENCES suppliers(id),
    warehouse_id    INT REFERENCES warehouses(id),
    supply_date     DATE NOT NULL,
    currency_id     INT REFERENCES currencies(id),
    rate            NUMERIC(20,6) DEFAULT 1,
    total_amount    NUMERIC(20,2) DEFAULT 0,
    status          supply_status DEFAULT 'draft',
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE supply_items (
    id          BIGSERIAL PRIMARY KEY,
    supply_id   UUID REFERENCES supplies(id) ON DELETE CASCADE,
    product_id  UUID REFERENCES products(id),
    quantity    NUMERIC(20,3) NOT NULL,
    price       NUMERIC(20,2) NOT NULL,
    amount      NUMERIC(20,2) GENERATED ALWAYS AS (quantity * price) STORED
);

-- ============================================================
-- SALE (savdo)
-- ============================================================

CREATE TYPE sale_status AS ENUM ('draft','confirmed','paid','partial','cancelled');

CREATE TABLE sales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number      VARCHAR(50),
    customer_id     UUID REFERENCES customers(id),
    warehouse_id    INT REFERENCES warehouses(id),
    sale_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    currency_id     INT REFERENCES currencies(id),
    rate            NUMERIC(20,6) DEFAULT 1,
    total_amount    NUMERIC(20,2) DEFAULT 0,
    discount_amount NUMERIC(20,2) DEFAULT 0,
    paid_amount     NUMERIC(20,2) DEFAULT 0,
    status          sale_status DEFAULT 'draft',
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sales_org_date ON sales(organization_id, sale_date DESC);
CREATE INDEX idx_sales_customer ON sales(customer_id);

CREATE TABLE sale_items (
    id          BIGSERIAL PRIMARY KEY,
    sale_id     UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id  UUID REFERENCES products(id),
    quantity    NUMERIC(20,3) NOT NULL,
    price       NUMERIC(20,2) NOT NULL,
    discount    NUMERIC(20,2) DEFAULT 0,
    amount      NUMERIC(20,2) GENERATED ALWAYS AS (quantity * price - discount) STORED
);

-- Savdo qaytarish
CREATE TABLE sale_return_reasons (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    code            VARCHAR(50),
    return_type     VARCHAR(20) DEFAULT 'valid',  -- 'valid' (Действительный) | 'invalid' (Недействительный)
    description     TEXT,
    created_by      UUID REFERENCES users(id),
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE sale_returns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    sale_id         UUID REFERENCES sales(id),
    doc_number      VARCHAR(50),
    warehouse_id    INT REFERENCES warehouses(id),
    return_date     TIMESTAMPTZ DEFAULT NOW(),
    sync_date       TIMESTAMPTZ,
    reason_id       INT REFERENCES sale_return_reasons(id),
    reason          TEXT,
    status          VARCHAR(20) DEFAULT 'completed',  -- 'draft' | 'completed' | 'cancelled'
    device_id       UUID,
    responsible_id  UUID REFERENCES employees(id),
    posrednik_id    UUID REFERENCES customers(id),
    currency_id     INT REFERENCES currencies(id),
    invoice_number  VARCHAR(50),
    total_amount    NUMERIC(20,2) DEFAULT 0,
    total_cost      NUMERIC(20,2) DEFAULT 0,
    total_discount  NUMERIC(20,2) DEFAULT 0,
    total_payable   NUMERIC(20,2) DEFAULT 0,
    paid_amount     NUMERIC(20,2) DEFAULT 0,
    tax_excluded    NUMERIC(20,2) DEFAULT 0,
    tax_included    NUMERIC(20,2) DEFAULT 0,
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_return_items (
    id                  BIGSERIAL PRIMARY KEY,
    return_id           UUID REFERENCES sale_returns(id) ON DELETE CASCADE,
    product_id          UUID REFERENCES products(id),
    unit_id             INT REFERENCES units(id),
    warehouse_id        INT REFERENCES warehouses(id),
    quantity            NUMERIC(20,3) NOT NULL,
    quantity_used       NUMERIC(20,3),
    unit_ratio          NUMERIC(20,3) DEFAULT 1,
    returned_amount     NUMERIC(20,2) DEFAULT 0,
    price               NUMERIC(20,2) NOT NULL,
    discount            NUMERIC(20,2) DEFAULT 0,
    tax_included        NUMERIC(20,2) DEFAULT 0,
    tax_added           NUMERIC(20,2) DEFAULT 0,
    extra_price         NUMERIC(20,2) DEFAULT 0,
    discount_per_unit   NUMERIC(20,2) DEFAULT 0,
    notes               TEXT
);

-- Shartnoma (contract)
CREATE TYPE contract_status AS ENUM ('draft','active','closed','cancelled');

CREATE TABLE contracts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number      VARCHAR(50),
    customer_id     UUID REFERENCES customers(id),
    start_date      DATE,
    end_date        DATE,
    total_amount    NUMERIC(20,2) DEFAULT 0,
    currency_id     INT REFERENCES currencies(id),
    status          contract_status DEFAULT 'draft',
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Hisob-faktura (invoice)
CREATE TYPE invoice_status AS ENUM ('draft','sent','paid','overdue','cancelled');

CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number      VARCHAR(50),
    customer_id     UUID REFERENCES customers(id),
    contract_id     UUID REFERENCES contracts(id),
    issue_date      DATE NOT NULL,
    due_date        DATE,
    total_amount    NUMERIC(20,2) NOT NULL,
    paid_amount     NUMERIC(20,2) DEFAULT 0,
    currency_id     INT REFERENCES currencies(id),
    status          invoice_status DEFAULT 'draft',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FINANCE (kassa, balans, harakatlar)
-- ============================================================

CREATE TABLE cashboxes (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    currency_id     INT REFERENCES currencies(id),
    responsible_id  UUID REFERENCES employees(id),
    is_active       BOOLEAN DEFAULT TRUE,
    balance         NUMERIC(20,2) DEFAULT 0
);

-- Kassa harakatlari (universal)
CREATE TYPE cash_direction AS ENUM ('in','out','transfer');

CREATE TABLE cash_movements (
    id              BIGSERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    cashbox_id      INT REFERENCES cashboxes(id),
    direction       cash_direction NOT NULL,
    amount          NUMERIC(20,2) NOT NULL,
    currency_id     INT REFERENCES currencies(id),
    rate            NUMERIC(20,6) DEFAULT 1,
    payment_type_id INT REFERENCES payment_types(id),
    -- polymorphic: nimaga bog'liq
    customer_id     UUID REFERENCES customers(id),
    supplier_id     UUID REFERENCES suppliers(id),
    employee_id     UUID REFERENCES employees(id),
    sale_id         UUID REFERENCES sales(id),
    invoice_id      UUID REFERENCES invoices(id),
    supply_id       UUID REFERENCES supplies(id),
    --
    description     TEXT,
    movement_date   TIMESTAMPTZ DEFAULT NOW(),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cash_mov_org_date ON cash_movements(organization_id, movement_date DESC);
CREATE INDEX idx_cash_mov_cashbox ON cash_movements(cashbox_id);

-- Kassa balansini o'rnatish (set balance)
CREATE TABLE cashbox_set_balance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    cashbox_id      INT REFERENCES cashboxes(id),
    doc_number      VARCHAR(50),
    old_balance     NUMERIC(20,2),
    new_balance     NUMERIC(20,2) NOT NULL,
    reason          TEXT,
    start_date      TIMESTAMPTZ DEFAULT NOW(),
    created_by      UUID REFERENCES users(id),
    status          VARCHAR(20) DEFAULT 'completed',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Mijoz / xodim / ta'minotchi balansini o'rnatish (umumlashtirilgan)
CREATE TYPE balance_subject AS ENUM ('customer','supplier','employee','person');

CREATE TABLE entity_set_balance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    subject_type    balance_subject NOT NULL,
    subject_id      UUID NOT NULL,
    doc_number      VARCHAR(50),
    plan_amount     NUMERIC(20,2),
    fact_amount     NUMERIC(20,2),
    diff_amount     NUMERIC(20,2) GENERATED ALWAYS AS (fact_amount - plan_amount) STORED,
    currency_id     INT REFERENCES currencies(id),
    start_date      TIMESTAMPTZ DEFAULT NOW(),
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_entity_balance_subj ON entity_set_balance(subject_type, subject_id);

-- Qo'shimcha xarajatlar (extra cost)
CREATE TABLE extra_costs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number      VARCHAR(50),
    cost_date       DATE NOT NULL,
    category        VARCHAR(100),
    amount          NUMERIC(20,2) NOT NULL,
    currency_id     INT REFERENCES currencies(id),
    cashbox_id      INT REFERENCES cashboxes(id),
    description     TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Narx farqi (price deviation report uchun source)
CREATE TABLE price_history (
    id          BIGSERIAL PRIMARY KEY,
    product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
    old_price   NUMERIC(20,2),
    new_price   NUMERIC(20,2),
    change_date TIMESTAMPTZ DEFAULT NOW(),
    changed_by  UUID REFERENCES users(id)
);

-- ============================================================
-- MANUFACTURING (ishlab chiqarish)
-- ============================================================

CREATE TYPE production_status AS ENUM ('draft','in_progress','completed','cancelled');

CREATE TABLE bom (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id),
    name            VARCHAR(200),
    output_qty      NUMERIC(20,3) DEFAULT 1,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bom_items (
    id          BIGSERIAL PRIMARY KEY,
    bom_id      UUID REFERENCES bom(id) ON DELETE CASCADE,
    product_id  UUID REFERENCES products(id),
    quantity    NUMERIC(20,3) NOT NULL
);

CREATE TABLE production_orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number         VARCHAR(50),
    bom_id             UUID REFERENCES bom(id),
    product_id         UUID REFERENCES products(id),
    warehouse_id       INT REFERENCES warehouses(id),
    warehouse_from_id  INT REFERENCES warehouses(id),
    planned_qty        NUMERIC(20,3) NOT NULL,
    produced_qty       NUMERIC(20,3) DEFAULT 0,
    responsible_id     UUID REFERENCES employees(id),
    status             production_status DEFAULT 'draft',
    started_at         TIMESTAMPTZ,
    finished_at        TIMESTAMPTZ,
    notes              TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kpi_entries (
    id              BIGSERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
    period_month    DATE NOT NULL,
    metric          VARCHAR(50) NOT NULL,
    target_value    NUMERIC(20,2),
    actual_value    NUMERIC(20,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (employee_id, period_month, metric)
);

-- ============================================================
-- SETTINGS / DEVICES / TEMPLATES (Faza 9)
-- ============================================================

CREATE TABLE app_settings (
    id              BIGSERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    key             VARCHAR(100) NOT NULL,
    value           JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, key)
);

CREATE TABLE devices (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    kind            VARCHAR(50) NOT NULL,
    connection      VARCHAR(50),
    address         VARCHAR(200),
    is_active       BOOLEAN DEFAULT TRUE,
    config          JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE print_templates (
    id              SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    kind            VARCHAR(50) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    body            TEXT NOT NULL,
    is_default      BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STATISTICS / REPORTS — materialized view'lar uchun source
-- ============================================================

CREATE OR REPLACE VIEW v_sales_summary AS
SELECT
    s.organization_id,
    DATE_TRUNC('day', s.sale_date)::date AS day,
    COUNT(*)                              AS sales_count,
    SUM(s.total_amount)                   AS revenue,
    SUM(s.paid_amount)                    AS paid,
    SUM(s.total_amount - s.paid_amount)   AS debt
FROM sales s
WHERE s.status <> 'cancelled'
GROUP BY 1, 2;

CREATE OR REPLACE VIEW v_stock_value AS
SELECT
    p.organization_id,
    sb.warehouse_id,
    SUM(sb.quantity * sb.avg_cost) AS total_value,
    COUNT(*) FILTER (WHERE sb.quantity > 0) AS sku_in_stock
FROM stock_balances sb
JOIN products p ON p.id = sb.product_id
GROUP BY 1, 2;

CREATE OR REPLACE VIEW v_customer_balance AS
SELECT
    c.organization_id,
    c.id AS customer_id,
    c.name,
    COALESCE(SUM(CASE WHEN cm.direction = 'in' THEN cm.amount ELSE -cm.amount END), 0) AS balance
FROM customers c
LEFT JOIN cash_movements cm ON cm.customer_id = c.id
GROUP BY c.organization_id, c.id, c.name;

-- ============================================================
-- SEED — minimal boshlang'ich ma'lumotlar
-- ============================================================

INSERT INTO currencies (code, name, symbol, is_base, decimals) VALUES
('UZS', 'O''zbek so''m', 'so''m', TRUE, 0),
('USD', 'US Dollar', '$', FALSE, 2),
('RUB', 'Rossiya rubli', '₽', FALSE, 2),
('EUR', 'Euro', '€', FALSE, 2);

INSERT INTO units (code, name, short_name) VALUES
('pcs',  'Dona',       'dona'),
('kg',   'Kilogramm',  'kg'),
('g',    'Gramm',      'g'),
('l',    'Litr',       'l'),
('m',    'Metr',       'm'),
('box',  'Quti',       'quti'),
('pack', 'Upakovka',   'up');

INSERT INTO roles (code, name, description) VALUES
('superadmin', 'Super Admin', 'Hamma tashkilotlarni boshqaradi'),
('admin',      'Admin',       'Tashkilot administratori'),
('manager',    'Manager',     'Savdo / ombor boshqaruvchisi'),
('accountant', 'Hisobchi',    'Finance modullari'),
('cashier',    'Kassir',      'Faqat kassa'),
('viewer',     'Ko''ruvchi',  'Faqat o''qish');
