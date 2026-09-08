"""
Idempotent DDL patches that extend init.sql for Faza 4+ tables.
Runs on every app startup (CREATE ... IF NOT EXISTS).
"""

from sqlalchemy import text

from app.db.session import engine


PATCHES = [
    # Sabablari (write-off, return)
    """
    CREATE TABLE IF NOT EXISTS write_off_reasons (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        is_active       BOOLEAN DEFAULT TRUE
    )
    """,
    # Spisaniye
    """
    CREATE TABLE IF NOT EXISTS write_offs (
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
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS write_off_items (
        id           BIGSERIAL PRIMARY KEY,
        write_off_id UUID REFERENCES write_offs(id) ON DELETE CASCADE,
        product_id   UUID REFERENCES products(id),
        quantity     NUMERIC(20,3) NOT NULL,
        cost         NUMERIC(20,2) DEFAULT 0,
        amount       NUMERIC(20,2) GENERATED ALWAYS AS (quantity * cost) STORED
    )
    """,
    # Tavsiya etiladigan qoldiqlar (min stock per product+warehouse)
    """
    CREATE TABLE IF NOT EXISTS recommended_stock (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        warehouse_id    INT REFERENCES warehouses(id) ON DELETE CASCADE,
        product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
        min_qty         NUMERIC(20,3) NOT NULL DEFAULT 0,
        max_qty         NUMERIC(20,3),
        UNIQUE (warehouse_id, product_id)
    )
    """,
    # Sale return reasons (Faza 5)
    """
    CREATE TABLE IF NOT EXISTS sale_return_reasons (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        is_active       BOOLEAN DEFAULT TRUE
    )
    """,
    """
    ALTER TABLE sale_returns
        ADD COLUMN IF NOT EXISTS reason_id INT REFERENCES sale_return_reasons(id)
    """,
    """
    ALTER TABLE sale_returns
        ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES warehouses(id)
    """,
    # Manufacturing — production_orders'ga responsible_id ko'rsatma (init.sql'da bor)
    """
    ALTER TABLE production_orders
        ADD COLUMN IF NOT EXISTS warehouse_from_id INT REFERENCES warehouses(id)
    """,
    """
    ALTER TABLE production_orders
        ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)
    """,
    # KPI entries (Faza 7)
    """
    CREATE TABLE IF NOT EXISTS kpi_entries (
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
    )
    """,
    # Settings (universal JSONB) — Faza 9
    """
    CREATE TABLE IF NOT EXISTS app_settings (
        id              BIGSERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        key             VARCHAR(100) NOT NULL,
        value           JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (organization_id, key)
    )
    """,
    # Devices
    """
    CREATE TABLE IF NOT EXISTS devices (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        kind            VARCHAR(50) NOT NULL,
        connection      VARCHAR(50),
        address         VARCHAR(200),
        is_active       BOOLEAN DEFAULT TRUE,
        config          JSONB DEFAULT '{}'::jsonb,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    # Print templates
    """
    CREATE TABLE IF NOT EXISTS print_templates (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        kind            VARCHAR(50) NOT NULL,
        name            VARCHAR(100) NOT NULL,
        body            TEXT NOT NULL,
        is_default      BOOLEAN DEFAULT FALSE,
        is_active       BOOLEAN DEFAULT TRUE,
        updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    # --- Sale returns full schema ---
    """ALTER TABLE sale_return_reasons ADD COLUMN IF NOT EXISTS code VARCHAR(50)""",
    """ALTER TABLE sale_return_reasons ADD COLUMN IF NOT EXISTS return_type VARCHAR(20) DEFAULT 'valid'""",
    """ALTER TABLE sale_return_reasons ADD COLUMN IF NOT EXISTS description TEXT""",
    """ALTER TABLE sale_return_reasons ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)""",

    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed'""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS device_id UUID""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES employees(id)""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS posrednik_id UUID REFERENCES customers(id)""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS sync_date TIMESTAMPTZ""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS currency_id INT REFERENCES currencies(id)""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS tax_excluded NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS tax_included NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS total_cost NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS total_payable NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS total_discount NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50)""",
    """ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS notes TEXT""",

    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS unit_id INT REFERENCES units(id)""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES warehouses(id)""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS quantity_used NUMERIC(20,3)""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS unit_ratio NUMERIC(20,3) DEFAULT 1""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS returned_amount NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS discount NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS tax_included NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS tax_added NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS extra_price NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS notes TEXT""",
    """ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS discount_per_unit NUMERIC(20,2) DEFAULT 0""",
    # --- Marketing (Faza 10) ---
    """
    CREATE TABLE IF NOT EXISTS marketing_discounts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(150) NOT NULL,
        discount_type   VARCHAR(20) NOT NULL,
        value           NUMERIC(20,2) NOT NULL,
        valid_from      DATE,
        valid_to        DATE,
        applies_to      VARCHAR(30) DEFAULT 'all',
        target_id       TEXT,
        notes           TEXT,
        is_active       BOOLEAN DEFAULT TRUE,
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS marketing_expected_products (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        product_id      UUID REFERENCES products(id),
        supplier_id     UUID REFERENCES suppliers(id),
        expected_qty    NUMERIC(20,3) NOT NULL,
        expected_date   DATE NOT NULL,
        status          VARCHAR(20) DEFAULT 'pending',
        notes           TEXT,
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    # --- Tasks (Faza 11) ---
    """
    CREATE TABLE IF NOT EXISTS tasks (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        title           VARCHAR(255) NOT NULL,
        description     TEXT,
        assignee_id     UUID REFERENCES employees(id),
        status          VARCHAR(20) DEFAULT 'todo',
        priority        VARCHAR(20) DEFAULT 'normal',
        due_date        DATE,
        completed_at    TIMESTAMPTZ,
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    # --- Warehouse types (Faza 12) ---
    """
    CREATE TABLE IF NOT EXISTS warehouse_types (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        description     TEXT,
        is_active       BOOLEAN DEFAULT TRUE
    )
    """,
    """ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS type_id INT REFERENCES warehouse_types(id)""",
    # --- Customer orders (Faza 4.4) ---
    """
    CREATE TABLE IF NOT EXISTS customer_orders (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        doc_number      SERIAL UNIQUE,
        customer_id     UUID REFERENCES customers(id),
        order_date      DATE DEFAULT CURRENT_DATE,
        delivery_date   DATE,
        status          VARCHAR(20) DEFAULT 'new',
        total_amount    NUMERIC(20,2) DEFAULT 0,
        notes           TEXT,
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS customer_order_items (
        id              BIGSERIAL PRIMARY KEY,
        order_id        UUID REFERENCES customer_orders(id) ON DELETE CASCADE,
        product_id      UUID REFERENCES products(id),
        quantity        NUMERIC(20,3) NOT NULL,
        price           NUMERIC(20,2) NOT NULL,
        amount          NUMERIC(20,2) GENERATED ALWAYS AS (quantity * price) STORED
    )
    """,
    # --- Supply purchase orders (Faza 5.4) ---
    """
    CREATE TABLE IF NOT EXISTS purchase_orders (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        doc_number      SERIAL UNIQUE,
        supplier_id     UUID REFERENCES suppliers(id),
        warehouse_id    INT REFERENCES warehouses(id),
        order_date      DATE DEFAULT CURRENT_DATE,
        expected_date   DATE,
        status          VARCHAR(20) DEFAULT 'new',
        total_amount    NUMERIC(20,2) DEFAULT 0,
        notes           TEXT,
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS purchase_order_items (
        id              BIGSERIAL PRIMARY KEY,
        order_id        UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id      UUID REFERENCES products(id),
        quantity        NUMERIC(20,3) NOT NULL,
        price           NUMERIC(20,2) NOT NULL,
        amount          NUMERIC(20,2) GENERATED ALWAYS AS (quantity * price) STORED
    )
    """,
    # --- Reference: legal entities + natural persons + price lists ---
    """
    CREATE TABLE IF NOT EXISTS legal_entities (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(255) NOT NULL,
        tin             VARCHAR(50),
        oked            VARCHAR(50),
        bank_account    VARCHAR(50),
        bank_name       VARCHAR(150),
        mfo             VARCHAR(50),
        address         TEXT,
        phone           VARCHAR(50),
        director        VARCHAR(150),
        accountant      VARCHAR(150),
        is_active       BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS natural_persons (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        full_name       VARCHAR(255) NOT NULL,
        passport        VARCHAR(50),
        pinfl           VARCHAR(20),
        phone           VARCHAR(50),
        address         TEXT,
        notes           TEXT,
        is_active       BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS price_lists (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        currency_id     INT REFERENCES currencies(id),
        is_default      BOOLEAN DEFAULT FALSE,
        is_active       BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS price_list_items (
        id              BIGSERIAL PRIMARY KEY,
        price_list_id   INT REFERENCES price_lists(id) ON DELETE CASCADE,
        product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
        price           NUMERIC(20,2) NOT NULL,
        UNIQUE (price_list_id, product_id)
    )
    """,
    # --- Add kind to products for filtering material/semi-product/service ---
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS kind VARCHAR(20) DEFAULT 'good'""",

    # --- Customer portal: OTP codes for SMS-based login ---
    """
    CREATE TABLE IF NOT EXISTS customer_otp_codes (
        id              BIGSERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        phone           VARCHAR(20) NOT NULL,
        code            VARCHAR(8) NOT NULL,
        attempts        INT DEFAULT 0,
        used            BOOLEAN DEFAULT FALSE,
        expires_at      TIMESTAMPTZ NOT NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_otp_phone ON customer_otp_codes(phone, organization_id, used)""",

    # --- Customer orders (for portal — basic structure) ---
    """
    CREATE TABLE IF NOT EXISTS customer_portal_orders (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
        order_number    VARCHAR(50),
        status          VARCHAR(20) DEFAULT 'new',
        notes           TEXT,
        total_amount    NUMERIC(20,2) DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS customer_portal_order_items (
        id           BIGSERIAL PRIMARY KEY,
        order_id     UUID REFERENCES customer_portal_orders(id) ON DELETE CASCADE,
        product_id   UUID REFERENCES products(id),
        quantity     NUMERIC(20,3) NOT NULL,
        note         TEXT
    )
    """,

    # --- Online payment transactions (Click, Payme, Apelsin) ---
    """
    CREATE TABLE IF NOT EXISTS payment_transactions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        provider        VARCHAR(20) NOT NULL,   -- 'click' | 'payme' | 'apelsin'
        provider_tx_id  VARCHAR(100),           -- merchant transaction ID
        sale_id         UUID REFERENCES sales(id) ON DELETE SET NULL,
        customer_id     UUID REFERENCES customers(id),
        amount          NUMERIC(20,2) NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'created',
                        -- 'created' | 'pending' | 'paid' | 'cancelled' | 'failed' | 'refunded'
        provider_data   JSONB,                  -- raw response from provider
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        completed_at    TIMESTAMPTZ
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_payment_tx_sale ON payment_transactions(sale_id, status)""",
    """CREATE INDEX IF NOT EXISTS idx_payment_tx_provider ON payment_transactions(provider, provider_tx_id)""",

    # =================================================================
    # Faza 13 — Bito feature parity (mobile-ready)
    # =================================================================

    # --- Products: extra flags + variants + marking ---
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS is_material BOOLEAN DEFAULT FALSE""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS is_semi_product BOOLEAN DEFAULT FALSE""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS is_marked BOOLEAN DEFAULT FALSE""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS is_variant BOOLEAN DEFAULT FALSE""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES products(id) ON DELETE SET NULL""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS has_expiration BOOLEAN DEFAULT FALSE""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS box_qty NUMERIC(20,3)""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS box_barcode VARCHAR(50)""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_length NUMERIC(10,2)""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_width NUMERIC(10,2)""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_height NUMERIC(10,2)""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS dim_weight NUMERIC(10,3)""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT""",
    """CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_id)""",

    # --- Product extra barcodes (one product can have many) ---
    """
    CREATE TABLE IF NOT EXISTS product_barcodes (
        id          BIGSERIAL PRIMARY KEY,
        product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
        barcode     VARCHAR(100) NOT NULL,
        type        VARCHAR(20) DEFAULT 'EAN13',
        UNIQUE (product_id, barcode)
    )
    """,

    # --- Product attribute types (Color, Size, ...) for variants ---
    """
    CREATE TABLE IF NOT EXISTS product_attributes (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        values          JSONB DEFAULT '[]'::jsonb,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS product_variant_attributes (
        id              BIGSERIAL PRIMARY KEY,
        product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
        attribute_id    INT REFERENCES product_attributes(id) ON DELETE CASCADE,
        value           VARCHAR(200) NOT NULL,
        UNIQUE (product_id, attribute_id)
    )
    """,

    # --- Universal tags ---
    """
    CREATE TABLE IF NOT EXISTS tags (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        color           VARCHAR(20) DEFAULT '#3393cb',
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (organization_id, name)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS entity_tags (
        id          BIGSERIAL PRIMARY KEY,
        tag_id      INT REFERENCES tags(id) ON DELETE CASCADE,
        entity_type VARCHAR(50) NOT NULL,  -- 'product', 'customer', 'supplier', 'employee', 'sale'
        entity_id   TEXT NOT NULL,
        UNIQUE (tag_id, entity_type, entity_id)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_entity_tags_lookup ON entity_tags(entity_type, entity_id)""",

    # --- Universal custom fields ---
    """
    CREATE TABLE IF NOT EXISTS custom_fields (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        entity_type     VARCHAR(50) NOT NULL,
        name            VARCHAR(100) NOT NULL,
        field_type      VARCHAR(20) NOT NULL DEFAULT 'text',  -- text|number|date|select|bool
        options         JSONB DEFAULT '[]'::jsonb,
        required        BOOLEAN DEFAULT FALSE,
        sort_order      INT DEFAULT 0,
        is_active       BOOLEAN DEFAULT TRUE,
        UNIQUE (organization_id, entity_type, name)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS custom_field_values (
        id              BIGSERIAL PRIMARY KEY,
        field_id        INT REFERENCES custom_fields(id) ON DELETE CASCADE,
        entity_type     VARCHAR(50) NOT NULL,
        entity_id       TEXT NOT NULL,
        value           TEXT,
        UNIQUE (field_id, entity_type, entity_id)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_cfv_lookup ON custom_field_values(entity_type, entity_id)""",

    # --- Installment plan (bo'lib to'lash) ---
    """
    CREATE TABLE IF NOT EXISTS installment_plans (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        sale_id         UUID REFERENCES sales(id) ON DELETE CASCADE,
        customer_id     UUID REFERENCES customers(id),
        total_amount    NUMERIC(20,2) NOT NULL,
        paid_amount     NUMERIC(20,2) DEFAULT 0,
        currency_id     INT REFERENCES currencies(id),
        months          INT NOT NULL,
        interest_pct    NUMERIC(6,2) DEFAULT 0,
        start_date      DATE NOT NULL,
        status          VARCHAR(20) DEFAULT 'active', -- active|completed|defaulted|cancelled
        notes           TEXT,
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS installment_schedules (
        id              BIGSERIAL PRIMARY KEY,
        plan_id         UUID REFERENCES installment_plans(id) ON DELETE CASCADE,
        due_date        DATE NOT NULL,
        amount          NUMERIC(20,2) NOT NULL,
        paid_amount     NUMERIC(20,2) DEFAULT 0,
        paid_at         TIMESTAMPTZ,
        status          VARCHAR(20) DEFAULT 'pending', -- pending|partial|paid|overdue
        UNIQUE (plan_id, due_date)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_inst_sched_due ON installment_schedules(due_date, status)""",

    # --- Loyalty card / extended cashback ---
    """ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_card VARCHAR(50)""",
    """ALTER TABLE customers ADD COLUMN IF NOT EXISTS cashback_balance NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_purchases NUMERIC(20,2) DEFAULT 0""",
    """ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date DATE""",
    """CREATE INDEX IF NOT EXISTS idx_customers_loyalty ON customers(organization_id, loyalty_card) WHERE loyalty_card IS NOT NULL""",

    """
    CREATE TABLE IF NOT EXISTS cashback_transactions (
        id              BIGSERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
        sale_id         UUID REFERENCES sales(id),
        kind            VARCHAR(20) NOT NULL, -- 'earn'|'spend'|'adjust'
        amount          NUMERIC(20,2) NOT NULL,
        balance_after   NUMERIC(20,2),
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_cashback_customer ON cashback_transactions(customer_id, created_at DESC)""",

    # --- Cashbox session (smena) full ---
    """
    CREATE TABLE IF NOT EXISTS cashbox_sessions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        cashbox_id      INT REFERENCES cashboxes(id) ON DELETE CASCADE,
        device_id       INT REFERENCES devices(id),
        opened_by       UUID REFERENCES users(id),
        opened_at       TIMESTAMPTZ DEFAULT NOW(),
        opened_balance  NUMERIC(20,2) DEFAULT 0,
        opened_diff     NUMERIC(20,2) DEFAULT 0,
        opened_note     TEXT,
        closed_by       UUID REFERENCES users(id),
        closed_at       TIMESTAMPTZ,
        closed_balance  NUMERIC(20,2),
        closed_diff     NUMERIC(20,2),
        closed_note     TEXT,
        total_income    NUMERIC(20,2) DEFAULT 0,
        total_expense   NUMERIC(20,2) DEFAULT 0,
        sale_count      INT DEFAULT 0,
        status          VARCHAR(20) DEFAULT 'open' -- open|closed
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_cashbox_session_open ON cashbox_sessions(cashbox_id, status) WHERE status = 'open'""",
    """ALTER TABLE sales ADD COLUMN IF NOT EXISTS cashbox_session_id UUID REFERENCES cashbox_sessions(id)""",
    """ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS cashbox_session_id UUID REFERENCES cashbox_sessions(id)""",

    # --- Open tickets (cafe/restaurant tables) ---
    """
    CREATE TABLE IF NOT EXISTS open_tickets (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        ticket_name     VARCHAR(100) NOT NULL,
        table_number    VARCHAR(20),
        guest_count     INT,
        cashbox_id      INT REFERENCES cashboxes(id),
        warehouse_id    INT REFERENCES warehouses(id),
        customer_id     UUID REFERENCES customers(id),
        responsible_id  UUID REFERENCES employees(id),
        notes           TEXT,
        status          VARCHAR(20) DEFAULT 'open', -- open|closed|cancelled
        total_amount    NUMERIC(20,2) DEFAULT 0,
        opened_at       TIMESTAMPTZ DEFAULT NOW(),
        closed_at       TIMESTAMPTZ,
        sale_id         UUID REFERENCES sales(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS open_ticket_items (
        id           BIGSERIAL PRIMARY KEY,
        ticket_id    UUID REFERENCES open_tickets(id) ON DELETE CASCADE,
        product_id   UUID REFERENCES products(id),
        quantity     NUMERIC(20,3) NOT NULL,
        price        NUMERIC(20,2) NOT NULL,
        discount     NUMERIC(20,2) DEFAULT 0,
        notes        TEXT,
        added_at     TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_open_tickets_status ON open_tickets(organization_id, status)""",

    # --- Predefined POS pages/categories (mobile POS UI) ---
    """
    CREATE TABLE IF NOT EXISTS pos_pages (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        color           VARCHAR(20) DEFAULT '#3393cb',
        sort_order      INT DEFAULT 0
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pos_page_items (
        id          BIGSERIAL PRIMARY KEY,
        page_id     INT REFERENCES pos_pages(id) ON DELETE CASCADE,
        product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
        sort_order  INT DEFAULT 0
    )
    """,

    # --- Distribution (sale routes) + Visits ---
    """
    CREATE TABLE IF NOT EXISTS distribution_routes (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(150) NOT NULL,
        employee_id     UUID REFERENCES employees(id),
        active_days     JSONB DEFAULT '[]'::jsonb,
        notes           TEXT,
        is_active       BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS planned_visits (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        route_id        UUID REFERENCES distribution_routes(id) ON DELETE SET NULL,
        customer_id     UUID REFERENCES customers(id),
        employee_id     UUID REFERENCES employees(id),
        visit_date      DATE NOT NULL,
        sort_order      INT DEFAULT 0,
        status          VARCHAR(20) DEFAULT 'planned' -- planned|in_progress|completed|skipped
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS visits (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        planned_visit_id UUID REFERENCES planned_visits(id) ON DELETE SET NULL,
        customer_id     UUID REFERENCES customers(id),
        employee_id     UUID REFERENCES employees(id),
        sale_id         UUID REFERENCES sales(id),
        check_in_at     TIMESTAMPTZ DEFAULT NOW(),
        check_in_lat    NUMERIC(10,7),
        check_in_lng    NUMERIC(10,7),
        check_out_at    TIMESTAMPTZ,
        check_out_lat   NUMERIC(10,7),
        check_out_lng   NUMERIC(10,7),
        comment         TEXT,
        status          VARCHAR(20) DEFAULT 'in_progress'
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_visits_emp_date ON visits(employee_id, check_in_at DESC)""",
    """
    CREATE TABLE IF NOT EXISTS visit_photos (
        id           BIGSERIAL PRIMARY KEY,
        visit_id     UUID REFERENCES visits(id) ON DELETE CASCADE,
        photo_url    TEXT NOT NULL,
        photo_type   VARCHAR(50),  -- 'before'|'after'|'product'|'general'
        notes        TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
    )
    """,

    # --- Courier / delivery tracking ---
    """
    CREATE TABLE IF NOT EXISTS courier_status (
        id              SERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
        is_online       BOOLEAN DEFAULT FALSE,
        last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
        last_lat        NUMERIC(10,7),
        last_lng        NUMERIC(10,7),
        UNIQUE (employee_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS courier_locations (
        id           BIGSERIAL PRIMARY KEY,
        employee_id  UUID REFERENCES employees(id) ON DELETE CASCADE,
        lat          NUMERIC(10,7) NOT NULL,
        lng          NUMERIC(10,7) NOT NULL,
        accuracy_m   NUMERIC(8,2),
        speed_kmh    NUMERIC(6,2),
        captured_at  TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_courier_loc_emp ON courier_locations(employee_id, captured_at DESC)""",
    """
    CREATE TABLE IF NOT EXISTS delivery_orders (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        order_number    VARCHAR(50),
        sale_id         UUID REFERENCES sales(id),
        customer_id     UUID REFERENCES customers(id),
        courier_id      UUID REFERENCES employees(id),
        delivery_address TEXT,
        delivery_lat    NUMERIC(10,7),
        delivery_lng    NUMERIC(10,7),
        scheduled_at    TIMESTAMPTZ,
        delivered_at    TIMESTAMPTZ,
        status          VARCHAR(20) DEFAULT 'new', -- new|assigned|picked_up|in_transit|delivered|failed
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_orders(organization_id, status)""",

    # --- FCM push notification tokens (web + mobile) ---
    """
    CREATE TABLE IF NOT EXISTS push_tokens (
        id              BIGSERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
        token           TEXT NOT NULL,
        platform        VARCHAR(20) DEFAULT 'web', -- web|android|ios
        device_label    VARCHAR(100),
        last_used_at    TIMESTAMPTZ DEFAULT NOW(),
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, token)
    )
    """,

    # --- Passcode + biometric (per device) ---
    """
    CREATE TABLE IF NOT EXISTS user_passcodes (
        id              BIGSERIAL PRIMARY KEY,
        user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
        passcode_hash   VARCHAR(255) NOT NULL,
        biometric_enabled BOOLEAN DEFAULT FALSE,
        device_id       VARCHAR(100),  -- web fingerprint
        last_used_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, device_id)
    )
    """,

    # --- File attachments (universal) ---
    """
    CREATE TABLE IF NOT EXISTS file_attachments (
        id              BIGSERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        entity_type     VARCHAR(50) NOT NULL,
        entity_id       TEXT NOT NULL,
        file_url        TEXT NOT NULL,
        file_name       VARCHAR(255),
        mime_type       VARCHAR(100),
        size_bytes      BIGINT,
        uploaded_by     UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_attachments_lookup ON file_attachments(entity_type, entity_id)""",

    # ============================================================
    # B1 — roles multi-tenant fix
    # System rollar (organization_id IS NULL) — barcha tashkilotda ko'rinadi
    # Tenant rollar (organization_id = <org>) — faqat o'sha tashkilotda
    # ============================================================
    """ALTER TABLE roles ADD COLUMN IF NOT EXISTS organization_id UUID
       REFERENCES organizations(id) ON DELETE CASCADE""",

    # Eski global UNIQUE(code) ni partial indekslar bilan almashtirish
    # (DROP CONSTRAINT idempotent emas — IF EXISTS bilan)
    """DO $$
       BEGIN
         IF EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conrelid = 'roles'::regclass AND conname = 'roles_code_key'
         ) THEN
           ALTER TABLE roles DROP CONSTRAINT roles_code_key;
         END IF;
       END $$""",

    """CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_code_system
       ON roles (code) WHERE organization_id IS NULL""",

    """CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_code_per_org
       ON roles (organization_id, code) WHERE organization_id IS NOT NULL""",

    """CREATE INDEX IF NOT EXISTS idx_roles_org
       ON roles (organization_id) WHERE organization_id IS NOT NULL""",

    # ============================================================
    # B4 — user_organizations.is_active (org-scoped block)
    # users.is_active is GLOBAL (login disabled everywhere).
    # user_organizations.is_active = blocks access to ONE org only.
    # ============================================================
    """ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS
       is_active BOOLEAN NOT NULL DEFAULT TRUE""",

    # ============================================================
    # C-2 — user_invitations (consent flow for existing users)
    # When admin invites an email that already has an account:
    #   - Don't silently add to user_organizations
    #   - Create an invitation; user must explicitly accept
    # token_hash = sha256(plain_token).hex() — never store plain
    # ============================================================
    """CREATE TABLE IF NOT EXISTS user_invitations (
        id              SERIAL PRIMARY KEY,
        token_hash      CHAR(64) NOT NULL,
        invited_email   CITEXT NOT NULL,
        invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        role_id         INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at      TIMESTAMPTZ NOT NULL,
        accepted_at     TIMESTAMPTZ,
        cancelled_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )""",
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_user_invitations_token
       ON user_invitations (token_hash)""",
    """CREATE INDEX IF NOT EXISTS idx_user_invitations_user
       ON user_invitations (invited_user_id)
       WHERE accepted_at IS NULL AND cancelled_at IS NULL""",
    """CREATE INDEX IF NOT EXISTS idx_user_invitations_org
       ON user_invitations (organization_id)
       WHERE accepted_at IS NULL AND cancelled_at IS NULL""",

    # ============================================================
    # H1 — Child-table FK indexes
    # Postgres does NOT auto-index FK columns. Without these, DELETE
    # CASCADE on parent triggers seq scan, and child lookup is slow.
    # NOTE: production with millions of rows should use CONCURRENTLY
    # via a separate alembic migration (CONCURRENTLY can't run in tx).
    # ============================================================
    """CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items (sale_id)""",
    """CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items (product_id)""",
    """CREATE INDEX IF NOT EXISTS idx_supply_items_supply ON supply_items (supply_id)""",
    """CREATE INDEX IF NOT EXISTS idx_supply_items_product ON supply_items (product_id)""",
    """CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items (transfer_id)""",
    """CREATE INDEX IF NOT EXISTS idx_write_off_items_wo ON write_off_items (write_off_id)""",
    """CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items (return_id)""",
    """CREATE INDEX IF NOT EXISTS idx_inventory_items_inv ON inventory_items (inventory_id)""",
    """CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON bom_items (bom_id)""",
    """CREATE INDEX IF NOT EXISTS idx_customer_order_items_order ON customer_order_items (order_id)""",
    """CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items (order_id)""",
    """CREATE INDEX IF NOT EXISTS idx_open_ticket_items_ticket ON open_ticket_items (ticket_id)""",
    """CREATE INDEX IF NOT EXISTS idx_installment_schedules_plan ON installment_schedules (plan_id)""",
    """CREATE INDEX IF NOT EXISTS idx_stock_balances_product ON stock_balances (product_id)""",
    """CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes (barcode)""",

    # ============================================================
    # H2 — cash_movements polymorphic FK indexes
    # Each row references AT MOST ONE of {customer, supplier, employee,
    # sale, invoice, supply}. Partial WHERE IS NOT NULL makes the index
    # 5-10x smaller and INSERT cost minimal.
    # ============================================================
    """CREATE INDEX IF NOT EXISTS idx_cash_mov_customer
       ON cash_movements (customer_id, movement_date DESC)
       WHERE customer_id IS NOT NULL""",
    """CREATE INDEX IF NOT EXISTS idx_cash_mov_supplier
       ON cash_movements (supplier_id, movement_date DESC)
       WHERE supplier_id IS NOT NULL""",
    """CREATE INDEX IF NOT EXISTS idx_cash_mov_employee
       ON cash_movements (employee_id, movement_date DESC)
       WHERE employee_id IS NOT NULL""",
    """CREATE INDEX IF NOT EXISTS idx_cash_mov_sale
       ON cash_movements (sale_id)
       WHERE sale_id IS NOT NULL""",
    """CREATE INDEX IF NOT EXISTS idx_cash_mov_invoice
       ON cash_movements (invoice_id)
       WHERE invoice_id IS NOT NULL""",
    """CREATE INDEX IF NOT EXISTS idx_cash_mov_supply
       ON cash_movements (supply_id)
       WHERE supply_id IS NOT NULL""",

    # ============================================================
    # H3 — pg_trgm extension + GIN indexes for ILIKE search
    # B-tree can't help `name ILIKE '%query%'` (leading wildcard).
    # GIN trigram makes substring search use index.
    # The planner combines (organization_id B-tree) + (name GIN) via
    # bitmap AND, so org filter still applies.
    # ============================================================
    """CREATE EXTENSION IF NOT EXISTS pg_trgm""",
    """CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
       ON customers USING GIN (name gin_trgm_ops)""",
    """CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
       ON customers USING GIN (phone gin_trgm_ops) WHERE phone IS NOT NULL""",
    """CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm
       ON suppliers USING GIN (name gin_trgm_ops)""",
    """CREATE INDEX IF NOT EXISTS idx_products_name_trgm
       ON products USING GIN (name gin_trgm_ops)""",
    """CREATE INDEX IF NOT EXISTS idx_employees_name_trgm
       ON employees USING GIN (full_name gin_trgm_ops)""",

    # T-1 — MXIK field: O'zbekiston Soliq qo'mitasi talabi (OFD pre-MVP blocker)
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik VARCHAR(20)""",

    # ============================================================
    # Sprint #3 — DB schema CRITICAL: composite/partial indexes (T-2)
    # All tables and columns verified 2026-06-29.
    # CONCURRENTLY is NOT used — lifespan runs inside a transaction.
    # ============================================================
    """CREATE INDEX IF NOT EXISTS ix_invoices_org_date ON invoices (organization_id, issue_date DESC)""",
    """CREATE INDEX IF NOT EXISTS ix_supplies_org_date ON supplies (organization_id, supply_date DESC)""",
    """CREATE INDEX IF NOT EXISTS ix_purchase_orders_org_date ON purchase_orders (organization_id, order_date DESC)""",
    """CREATE INDEX IF NOT EXISTS ix_customer_orders_org_date ON customer_orders (organization_id, order_date DESC)""",
    """CREATE INDEX IF NOT EXISTS ix_transfers_org_date ON transfers (organization_id, transfer_date DESC)""",
    """CREATE INDEX IF NOT EXISTS ix_sale_returns_org_date ON sale_returns (organization_id, return_date DESC)""",
    """CREATE INDEX IF NOT EXISTS ix_contracts_org_start ON contracts (organization_id, start_date DESC)""",
    """CREATE INDEX IF NOT EXISTS ix_inventories_org ON inventories (organization_id, created_at DESC)""",
    """CREATE INDEX IF NOT EXISTS ix_tasks_org_open ON tasks (organization_id, due_date) WHERE status NOT IN ('done', 'cancelled')""",
    """CREATE INDEX IF NOT EXISTS ix_tasks_assignee_open ON tasks (assignee_id, due_date) WHERE status NOT IN ('done', 'cancelled')""",
    """CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked = FALSE""",
    """CREATE INDEX IF NOT EXISTS ix_refresh_tokens_expires ON refresh_tokens (expires_at) WHERE revoked = FALSE""",
    """CREATE INDEX IF NOT EXISTS ix_user_invitations_expires ON user_invitations (expires_at) WHERE accepted_at IS NULL AND cancelled_at IS NULL""",

    # ============================================================
    # Sprint #3 — payment_transactions unique constraint (T-3)
    # Duplicate check performed 2026-06-29: no duplicates found.
    # Drops old non-unique idx_payment_tx_provider and creates
    # partial UNIQUE index on (provider, provider_tx_id) WHERE
    # provider_tx_id IS NOT NULL — NULL rows are not constrained.
    # ============================================================
    """
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_tx_provider') THEN
    DROP INDEX idx_payment_tx_provider;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_payment_tx_provider') THEN
    BEGIN
      CREATE UNIQUE INDEX uq_payment_tx_provider
        ON payment_transactions (provider, provider_tx_id)
        WHERE provider_tx_id IS NOT NULL;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Duplicate (provider, provider_tx_id) bor — UNIQUE index skipped, data cleanup kerak';
    END;
  END IF;
END $$
""",

    # ============================================================
    # Sprint #5 — 2FA TOTP support (per-user)
    # Stores encrypted TOTP secret + backup codes JSONB + enabled flag.
    # Secrets encrypted via app.core.secret_box.
    # ============================================================
    """ALTER TABLE users ADD COLUMN IF NOT EXISTS twofa_secret TEXT""",
    """ALTER TABLE users ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN DEFAULT FALSE""",
    """ALTER TABLE users ADD COLUMN IF NOT EXISTS twofa_backup_codes JSONB DEFAULT '[]'::jsonb""",

    # ============================================================
    # Sprint W1 — Warehouse Module Rebuild (T-001)
    # Rollback (reverse FK order):
    #   DROP TABLE IF EXISTS product_request_items;
    #   DROP TABLE IF EXISTS product_requests;
    #   DROP TABLE IF EXISTS internal_transfer_items;
    #   DROP TABLE IF EXISTS internal_transfers;
    #   DROP TABLE IF EXISTS document_sequences;
    #   ALTER TABLE products DROP COLUMN IF EXISTS default_rack_id;
    #   ALTER TABLE products DROP COLUMN IF EXISTS product_type;
    #   DROP TABLE IF EXISTS warehouse_racks;
    #   DROP TABLE IF EXISTS warehouse_rows;
    #   ALTER TABLE warehouses DROP COLUMN IF EXISTS type_id;  -- already exists from Faza 12
    #   -- warehouse_types already existed from Faza 12; only code column + unique index added
    # ============================================================

    # warehouse_types existed from Faza 12 but lacked `code` column and unique constraint
    """ALTER TABLE warehouse_types ADD COLUMN IF NOT EXISTS code VARCHAR(50)""",
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouse_types_org_name
       ON warehouse_types(organization_id, name)""",

    # warehouse_types lacked created_at; router queries SELECT created_at causes 500 without it
    # Rollback: ALTER TABLE warehouse_types DROP COLUMN IF EXISTS created_at;
    """ALTER TABLE warehouse_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()""",

    # Rows inside a warehouse
    """
    CREATE TABLE IF NOT EXISTS warehouse_rows (
        id              SERIAL PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        warehouse_id    INT  NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        sort_order      INT DEFAULT 0
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_warehouse_rows_wh
       ON warehouse_rows(warehouse_id)""",
    """CREATE INDEX IF NOT EXISTS idx_warehouse_rows_org
       ON warehouse_rows(organization_id, warehouse_id)""",

    # Racks inside a row
    """
    CREATE TABLE IF NOT EXISTS warehouse_racks (
        id              SERIAL PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        row_id          INT  NOT NULL REFERENCES warehouse_rows(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        sort_order      INT DEFAULT 0
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_warehouse_racks_row
       ON warehouse_racks(row_id)""",
    """CREATE INDEX IF NOT EXISTS idx_warehouse_racks_org
       ON warehouse_racks(organization_id, row_id)""",

    # Internal transfer header
    """
    CREATE TABLE IF NOT EXISTS internal_transfers (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        doc_number      VARCHAR(50),
        from_warehouse  INT  NOT NULL REFERENCES warehouses(id),
        to_warehouse    INT  NOT NULL REFERENCES warehouses(id),
        status          VARCHAR(20) NOT NULL DEFAULT 'draft',
        notes           TEXT,
        sent_at         TIMESTAMPTZ,
        received_at     TIMESTAMPTZ,
        sent_by         UUID REFERENCES users(id),
        received_by     UUID REFERENCES users(id),
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_internal_transfers_org
       ON internal_transfers(organization_id, status)""",

    # Internal transfer lines
    # unit_id references `units` (verified: table is named `units`, not `product_units`)
    """
    CREATE TABLE IF NOT EXISTS internal_transfer_items (
        id          BIGSERIAL PRIMARY KEY,
        transfer_id UUID         NOT NULL REFERENCES internal_transfers(id) ON DELETE CASCADE,
        product_id  UUID         NOT NULL REFERENCES products(id),
        qty         NUMERIC(20,4) NOT NULL,
        unit_id     INT          REFERENCES units(id),
        cost        NUMERIC(20,4) NOT NULL DEFAULT 0
    )
    """,
    # cost column guard — idempotent if table already existed without it
    """ALTER TABLE internal_transfer_items ADD COLUMN IF NOT EXISTS cost NUMERIC(20,4) NOT NULL DEFAULT 0""",

    # document_sequences — per-org sequential doc number counter (Variant B)
    """
    CREATE TABLE IF NOT EXISTS document_sequences (
        organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        doc_type        VARCHAR(20) NOT NULL,
        next_value      INT         NOT NULL DEFAULT 1,
        PRIMARY KEY (organization_id, doc_type)
    )
    """,

    # Product requests header
    """
    CREATE TABLE IF NOT EXISTS product_requests (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        doc_number      VARCHAR(50),
        from_warehouse  INT  NOT NULL REFERENCES warehouses(id),
        to_warehouse    INT  REFERENCES warehouses(id),
        status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        notes           TEXT,
        requested_by    UUID REFERENCES users(id),
        approved_by     UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_product_requests_org
       ON product_requests(organization_id, status)""",

    # Product request lines
    """
    CREATE TABLE IF NOT EXISTS product_request_items (
        id            BIGSERIAL PRIMARY KEY,
        request_id    UUID         NOT NULL REFERENCES product_requests(id) ON DELETE CASCADE,
        category_id   INT          REFERENCES product_categories(id),
        product_id    UUID         NOT NULL REFERENCES products(id),
        qty_requested NUMERIC(20,4) NOT NULL,
        qty_on_hand   NUMERIC(20,4) NOT NULL DEFAULT 0
    )
    """,

    # products: default rack location + product_type free-text field
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS default_rack_id INT REFERENCES warehouse_racks(id)""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(100)""",

    # ============================================================
    # Warehouse Sprint 2 — T-020: BOM + Cells + Pick tables
    # Rollback (reverse FK order):
    #   ALTER TABLE products DROP COLUMN IF EXISTS default_cell_id;
    #   DROP TABLE IF EXISTS order_pick_messages;
    #   DROP TABLE IF EXISTS order_pick_items;
    #   DROP TABLE IF EXISTS warehouse_cells;
    #   DROP TABLE IF EXISTS product_bom;
    # ============================================================

    # Bill of Materials
    """
    CREATE TABLE IF NOT EXISTS product_bom (
        id                   BIGSERIAL PRIMARY KEY,
        organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        parent_product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        component_product_id UUID NOT NULL REFERENCES products(id),
        quantity             NUMERIC(20,4) NOT NULL CHECK (quantity > 0),
        unit_id              INT REFERENCES units(id),
        notes                TEXT,
        UNIQUE (organization_id, parent_product_id, component_product_id)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_product_bom_org_parent
       ON product_bom(organization_id, parent_product_id)""",

    # Warehouse cells (lowest spatial unit under racks)
    """
    CREATE TABLE IF NOT EXISTS warehouse_cells (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        rack_id         INT  NOT NULL REFERENCES warehouse_racks(id) ON DELETE CASCADE,
        code            VARCHAR(30) NOT NULL,
        is_active       BOOLEAN DEFAULT TRUE,
        UNIQUE (organization_id, rack_id, code)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_warehouse_cells_org_rack
       ON warehouse_cells(organization_id, rack_id)""",

    # Pick workflow items
    # item_id is BIGINT (plain column, no FK) — sale_items.id is BIGSERIAL;
    # FK not enforced because sale_items rows may be deleted after pick.
    """
    CREATE TABLE IF NOT EXISTS order_pick_items (
        id              BIGSERIAL PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        order_id        UUID NOT NULL,
        item_id         BIGINT NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','picked','not_found')),
        picked_by       UUID REFERENCES users(id),
        picked_at       TIMESTAMPTZ,
        UNIQUE (organization_id, order_id, item_id)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_pick_items_org_order
       ON order_pick_items(organization_id, order_id)""",

    # Pick workflow messages (cashier <-> manager)
    """
    CREATE TABLE IF NOT EXISTS order_pick_messages (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        order_id        UUID NOT NULL,
        from_user_id    UUID REFERENCES users(id),
        kind            VARCHAR(10) NOT NULL CHECK (kind IN ('message','call')),
        body            TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_pick_messages_org_order
       ON order_pick_messages(organization_id, order_id)""",

    # Link a product to its default pick cell
    """ALTER TABLE products
       ADD COLUMN IF NOT EXISTS default_cell_id UUID REFERENCES warehouse_cells(id)""",

    # ============================================================
    # Warehouse Sprint 2 QA fixes
    # M4 — notes column for pick items (reason when not_found etc.)
    # Rollback: ALTER TABLE order_pick_items DROP COLUMN IF EXISTS notes;
    # ============================================================
    """ALTER TABLE order_pick_items ADD COLUMN IF NOT EXISTS notes TEXT""",

    # ============================================================
    # Sprint 3 — T-040/T-041: BOM explode + pick bootstrap
    # Rollback:
    #   ALTER TABLE order_pick_items DROP COLUMN IF EXISTS parent_product_id;
    #   ALTER TABLE order_pick_items DROP COLUMN IF EXISTS product_id;
    #   ALTER TABLE order_pick_items DROP COLUMN IF EXISTS quantity;
    #   ALTER TABLE order_pick_items DROP COLUMN IF EXISTS unit_id;
    #   DROP INDEX IF EXISTS idx_pick_items_parent;
    # ============================================================

    # parent_product_id: NULL = individual item; filled = BOM leaf component
    """ALTER TABLE order_pick_items ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES products(id)""",

    # product_id, quantity, unit_id stored directly on pick row (needed for BOM components
    # which have a different product than the sale_item's product)
    """ALTER TABLE order_pick_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id)""",
    """ALTER TABLE order_pick_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(18,4)""",
    """ALTER TABLE order_pick_items ADD COLUMN IF NOT EXISTS unit_id INT REFERENCES units(id)""",

    # Index for bundle grouping queries
    """CREATE INDEX IF NOT EXISTS idx_pick_items_parent ON order_pick_items(order_id, parent_product_id)""",

    # ============================================================
    # Sprint 3 QA fix B2: order_pick_items.product_id NOT NULL
    # Backfill rows created before product_id column existed.
    # Rollback: ALTER TABLE order_pick_items ALTER COLUMN product_id DROP NOT NULL;
    # ============================================================
    """
    UPDATE order_pick_items opi
    SET product_id = si.product_id
    FROM sale_items si
    WHERE opi.product_id IS NULL AND opi.item_id = si.id
    """,
    """
    DO $$ BEGIN
        ALTER TABLE order_pick_items ALTER COLUMN product_id SET NOT NULL;
    EXCEPTION WHEN others THEN NULL; END $$
    """,

    # Drop old UNIQUE that only allowed one pick row per item_id.
    # BOM explosion creates multiple rows per item_id (one per leaf component).
    # New unique: (org, order, item_id, product_id) — one pick row per component per sale line.
    """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'order_pick_items_organization_id_order_id_item_id_key'
        ) THEN
            ALTER TABLE order_pick_items
                DROP CONSTRAINT order_pick_items_organization_id_order_id_item_id_key;
        END IF;
    END$$
    """,

    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uq_pick_items_org_order_item_product'
        ) THEN
            ALTER TABLE order_pick_items
                ADD CONSTRAINT uq_pick_items_org_order_item_product
                UNIQUE (organization_id, order_id, item_id, product_id);
        END IF;
    END$$
    """,

    # ============================================================
    # Sprint 4A — T-101: MXIK product catalog (global reference table)
    # No organization_id — shared across all tenants (reference data).
    # Rollback:
    #   DROP INDEX IF EXISTS idx_mxik_name_ru;
    #   DROP INDEX IF EXISTS idx_mxik_name_uz;
    #   DROP TABLE IF EXISTS mxik_products;
    # ============================================================
    """
    CREATE TABLE IF NOT EXISTS mxik_products (
        code         VARCHAR(20) PRIMARY KEY,
        name_uz      TEXT NOT NULL,
        name_ru      TEXT,
        unit         VARCHAR(20),
        group_code   VARCHAR(10),
        group_name   TEXT,
        is_active    BOOLEAN DEFAULT TRUE,
        updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_mxik_name_uz
       ON mxik_products USING gin(to_tsvector('simple', name_uz))""",
    """CREATE INDEX IF NOT EXISTS idx_mxik_name_ru
       ON mxik_products USING gin(to_tsvector('simple', COALESCE(name_ru, '')))""",

    # ============================================================
    # Sprint 4A — T-104: WebAuthn challenge storage (Variant A)
    # TTL = 5 minutes, lazy cleanup on each begin call.
    # Rollback:
    #   DROP INDEX IF EXISTS idx_webauthn_challenges_user;
    #   DROP TABLE IF EXISTS user_webauthn_challenges;
    # ============================================================
    """
    CREATE TABLE IF NOT EXISTS user_webauthn_challenges (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        challenge   BYTEA NOT NULL,
        purpose     VARCHAR(20) NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user
       ON user_webauthn_challenges(user_id, created_at)""",

    # ============================================================
    # Sprint 4C — T-123: Telegram bot command auth (Variant B)
    # Bind token → user_telegram_bindings mapping.
    # Rollback:
    #   DROP INDEX IF EXISTS idx_tg_bindings_chat_org;
    #   DROP TABLE IF EXISTS user_telegram_bindings;
    #   ALTER TABLE users DROP COLUMN IF EXISTS tg_bind_token;
    #   ALTER TABLE users DROP COLUMN IF EXISTS tg_bind_token_at;
    # ============================================================
    """
    CREATE TABLE IF NOT EXISTS user_telegram_bindings (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        chat_id           BIGINT NOT NULL,
        telegram_username VARCHAR(100),
        bound_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_active         BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE (user_id, org_id),
        UNIQUE (chat_id, org_id)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_tg_bindings_chat_org
       ON user_telegram_bindings(chat_id, org_id)""",

    """ALTER TABLE users ADD COLUMN IF NOT EXISTS tg_bind_token   VARCHAR(64)""",
    """ALTER TABLE users ADD COLUMN IF NOT EXISTS tg_bind_token_at TIMESTAMPTZ""",

    # ============================================================
    # Sprint 4D — T-132: SMS debt reminder log
    # Rollback:
    #   DROP INDEX IF EXISTS idx_sms_debt_org_customer;
    #   DROP TABLE IF EXISTS sms_debt_reminders;
    # ============================================================
    """
    CREATE TABLE IF NOT EXISTS sms_debt_reminders (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        user_id             UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        phone               VARCHAR(20) NOT NULL,
        message             TEXT NOT NULL,
        status              VARCHAR(20) NOT NULL DEFAULT 'sent',
        provider_message_id VARCHAR(100),
        error               TEXT,
        sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_sms_debt_org_customer
       ON sms_debt_reminders(organization_id, customer_id, sent_at DESC)""",

    # ============================================================
    # Sprint 4 QA fix B1 — allow user_id to be NULL so ON DELETE SET NULL works.
    # The NOT NULL + ON DELETE SET NULL combination is rejected by PostgreSQL at
    # delete time; dropping NOT NULL lets the FK do its job without losing the row.
    # Rollback: ALTER TABLE sms_debt_reminders ALTER COLUMN user_id SET NOT NULL;
    # ============================================================
    """
    DO $$ BEGIN
        ALTER TABLE sms_debt_reminders ALTER COLUMN user_id DROP NOT NULL;
    EXCEPTION WHEN others THEN NULL; END $$
    """,

    # ============================================================
    # Sprint 5 — T-200: stock_movements immutable journal (FOUNDATION)
    # Append-only: DB trigger blocks UPDATE/DELETE at row level.
    # Rollback (manual):
    #   DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON stock_movements;
    #   DROP FUNCTION IF EXISTS stock_movements_immutable();
    #   DROP TABLE IF EXISTS stock_movements;
    #   DROP INDEX IF EXISTS idx_internal_transfers_correlation;
    #   ALTER TABLE internal_transfers DROP COLUMN IF EXISTS correlation_id;
    # ============================================================
    """
    CREATE TABLE IF NOT EXISTS stock_movements (
        id               BIGSERIAL PRIMARY KEY,
        organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        warehouse_id     INT  NOT NULL REFERENCES warehouses(id),
        product_id       UUID NOT NULL REFERENCES products(id),
        before_qty       NUMERIC(20,3) NOT NULL,
        change_qty       NUMERIC(20,3) NOT NULL,
        after_qty        NUMERIC(20,3) NOT NULL,
        unit_cost        NUMERIC(20,4),
        operation_type   VARCHAR(30) NOT NULL,
        source_type      VARCHAR(30),
        source_id        UUID,
        correlation_id   UUID,
        user_id          UUID REFERENCES users(id),
        external_id      VARCHAR(100),
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_sm_org_wh_product
       ON stock_movements (organization_id, warehouse_id, product_id)""",
    """CREATE INDEX IF NOT EXISTS idx_sm_org_created
       ON stock_movements (organization_id, created_at DESC)""",
    """CREATE INDEX IF NOT EXISTS idx_sm_source
       ON stock_movements (source_type, source_id)
       WHERE source_id IS NOT NULL""",
    """CREATE INDEX IF NOT EXISTS idx_sm_correlation
       ON stock_movements (correlation_id)
       WHERE correlation_id IS NOT NULL""",
    """CREATE INDEX IF NOT EXISTS idx_sm_operation_type
       ON stock_movements (organization_id, operation_type)""",

    """
    CREATE OR REPLACE FUNCTION stock_movements_immutable()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
        RAISE EXCEPTION 'stock_movements is append-only: UPDATE and DELETE are forbidden';
    END;
    $$
    """,

    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_stock_movements_immutable'
              AND tgrelid = 'stock_movements'::regclass
        ) THEN
            CREATE TRIGGER trg_stock_movements_immutable
                BEFORE UPDATE OR DELETE ON stock_movements
                FOR EACH ROW EXECUTE FUNCTION stock_movements_immutable();
        END IF;
    END $$
    """,

    # correlation_id on internal_transfers — links transfer_out + transfer_in movements
    """ALTER TABLE internal_transfers ADD COLUMN IF NOT EXISTS correlation_id UUID""",
    """CREATE INDEX IF NOT EXISTS idx_internal_transfers_correlation
       ON internal_transfers (correlation_id) WHERE correlation_id IS NOT NULL""",

    # ============================================================
    # Sprint 5 — T-207: sale_items.unit_cost (COGS snapshot)
    # Stores avg_cost from stock_balances at the moment of sale confirm.
    # NULL = sale created before this patch (historical; COGS = 0 for those rows).
    # Rollback:
    #   DROP INDEX IF EXISTS idx_sale_items_cost;
    #   ALTER TABLE sale_items DROP COLUMN IF EXISTS unit_cost;
    # ============================================================
    """ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(20,4)""",
    """CREATE INDEX IF NOT EXISTS idx_sale_items_cost
       ON sale_items(sale_id) WHERE unit_cost IS NOT NULL""",

    # ============================================================
    # Sprint 5 — T-206: cashboxes.warehouse_id (POS↔warehouse binding)
    # Each POS cashbox has a default warehouse. Sales auto-resolve
    # warehouse_id from cashbox_id when the client doesn't send one.
    # Nullable — existing cashboxes are migrated gradually.
    # Rollback:
    #   DROP INDEX IF EXISTS idx_cashboxes_warehouse;
    #   ALTER TABLE cashboxes DROP COLUMN IF EXISTS warehouse_id;
    # ============================================================
    """ALTER TABLE cashboxes ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES warehouses(id)""",
    """CREATE INDEX IF NOT EXISTS idx_cashboxes_warehouse
       ON cashboxes(organization_id, warehouse_id) WHERE warehouse_id IS NOT NULL""",

    # ============================================================
    # Sprint 5 — T-203: product_barcodes alohida jadval
    # Multi-barcode per product: is_primary + is_active + history.
    # Rollback:
    #   DROP INDEX IF EXISTS idx_product_barcodes_org_product;
    #   DROP INDEX IF EXISTS uq_product_barcodes_primary;
    #   DROP INDEX IF EXISTS uq_product_barcodes_org_active;
    #   DROP TABLE IF EXISTS product_barcodes;
    # ============================================================

    # Faza 13 created a minimal product_barcodes (no org/is_primary/is_active).
    # ADD COLUMN IF NOT EXISTS upgrades it safely.
    """ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS organization_id UUID
       REFERENCES organizations(id) ON DELETE CASCADE""",
    """ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE""",
    """ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE""",
    """ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()""",
    """ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)""",
    """ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ""",
    """ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES users(id)""",
    """ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS notes TEXT""",

    # Backfill organization_id for rows created before this patch
    """
    UPDATE product_barcodes pb
    SET organization_id = p.organization_id
    FROM products p
    WHERE pb.product_id = p.id AND pb.organization_id IS NULL
    """,

    # Partial unique: one active barcode per org (deactivated can be reused)
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_product_barcodes_org_active
       ON product_barcodes(organization_id, barcode) WHERE is_active = TRUE""",

    # Partial unique: one primary per product at a time
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_product_barcodes_primary
       ON product_barcodes(product_id) WHERE is_primary = TRUE AND is_active = TRUE""",

    # Composite index for org+product lookups
    """CREATE INDEX IF NOT EXISTS idx_product_barcodes_org_product
       ON product_barcodes(organization_id, product_id)""",

    # Migrate primary barcodes from products.barcode (idempotent: ON CONFLICT DO NOTHING)
    """
    INSERT INTO product_barcodes (organization_id, product_id, barcode, is_primary, is_active, created_at)
    SELECT organization_id, id, barcode, TRUE, TRUE, created_at
    FROM products
    WHERE barcode IS NOT NULL AND barcode != ''
    ON CONFLICT DO NOTHING
    """,

    # Migrate extra_barcodes JSONB array — EXECUTE makes it truly dynamic so
    # PostgreSQL does not validate column references at parse time.
    """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'products' AND column_name = 'extra_barcodes'
        ) THEN
            EXECUTE '
                INSERT INTO product_barcodes
                    (organization_id, product_id, barcode, is_primary, is_active, created_at)
                SELECT p.organization_id, p.id,
                       jsonb_array_elements_text(p.extra_barcodes),
                       FALSE, TRUE, p.created_at
                FROM products p
                WHERE p.extra_barcodes IS NOT NULL
                  AND jsonb_typeof(p.extra_barcodes) = ''array''
                  AND jsonb_array_length(p.extra_barcodes) > 0
                ON CONFLICT DO NOTHING
            ';
        END IF;
    END $$
    """,

    # ============================================================
    # Sprint 5 — T-208: Idempotency-Key middleware storage
    # Stores first 2xx response per (idempotency_key, organization_id) for 24h.
    # Lazy cleanup: middleware deletes expired rows probabilistically (1% chance).
    # Rollback:
    #   DROP INDEX IF EXISTS idx_idempotency_expires;
    #   DROP INDEX IF EXISTS idx_idempotency_org_key;
    #   DROP TABLE IF EXISTS idempotency_keys;
    # ============================================================
    """
    CREATE TABLE IF NOT EXISTS idempotency_keys (
        id              BIGSERIAL PRIMARY KEY,
        idempotency_key VARCHAR(128) NOT NULL,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
        method          VARCHAR(10) NOT NULL,
        path            VARCHAR(255) NOT NULL,
        request_hash    VARCHAR(64) NOT NULL,
        response_status INT NOT NULL,
        response_body   JSONB NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
        UNIQUE (idempotency_key, organization_id)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_idempotency_org_key
       ON idempotency_keys (organization_id, idempotency_key)""",
    """CREATE INDEX IF NOT EXISTS idx_idempotency_expires
       ON idempotency_keys (expires_at)""",

    # ============================================================
    # Sprint 5 — T-209: products.is_archived + default_supplier_id
    # TZ-03: soft-archive products without deleting history.
    # TZ-05: per-product default supplier for purchase pre-select.
    # Rollback:
    #   DROP INDEX IF EXISTS idx_products_default_supplier;
    #   DROP INDEX IF EXISTS idx_products_active_archived;
    #   ALTER TABLE products DROP COLUMN IF EXISTS default_supplier_id;
    #   ALTER TABLE products DROP COLUMN IF EXISTS archived_by;
    #   ALTER TABLE products DROP COLUMN IF EXISTS archived_at;
    #   ALTER TABLE products DROP COLUMN IF EXISTS is_archived;
    # ============================================================
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id)""",
    """ALTER TABLE products ADD COLUMN IF NOT EXISTS default_supplier_id UUID
       REFERENCES suppliers(id) ON DELETE SET NULL""",
    """CREATE INDEX IF NOT EXISTS idx_products_active_archived
       ON products(organization_id, is_archived) WHERE is_archived = FALSE""",
    """CREATE INDEX IF NOT EXISTS idx_products_default_supplier
       ON products(default_supplier_id) WHERE default_supplier_id IS NOT NULL""",

    # ============================================================
    # Sprint 5 — T-202: supplier_returns + supplier_return_items
    # Rollback (reverse FK order):
    #   DROP INDEX IF EXISTS idx_supplier_return_items_return;
    #   DROP INDEX IF EXISTS idx_supplier_returns_status;
    #   DROP INDEX IF EXISTS idx_supplier_returns_org_warehouse;
    #   DROP INDEX IF EXISTS idx_supplier_returns_org_supplier;
    #   DROP TABLE IF EXISTS supplier_return_items;
    #   DROP TABLE IF EXISTS supplier_returns;
    # ============================================================
    """
    CREATE TABLE IF NOT EXISTS supplier_returns (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        doc_number          VARCHAR(30),
        supplier_id         UUID NOT NULL REFERENCES suppliers(id),
        warehouse_id        INT  NOT NULL REFERENCES warehouses(id),
        original_purchase_id UUID REFERENCES supplies(id),
        reason              VARCHAR(500),
        notes               TEXT,
        status              VARCHAR(20) NOT NULL DEFAULT 'draft',
        refund_method       VARCHAR(20),
        refund_amount       NUMERIC(20,2) DEFAULT 0,
        created_by          UUID REFERENCES users(id),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_at        TIMESTAMPTZ,
        confirmed_by        UUID REFERENCES users(id)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_supplier_returns_org_supplier
       ON supplier_returns(organization_id, supplier_id, created_at DESC)""",
    """CREATE INDEX IF NOT EXISTS idx_supplier_returns_org_warehouse
       ON supplier_returns(organization_id, warehouse_id)""",
    """CREATE INDEX IF NOT EXISTS idx_supplier_returns_status
       ON supplier_returns(organization_id, status)""",

    """
    CREATE TABLE IF NOT EXISTS supplier_return_items (
        id                  BIGSERIAL PRIMARY KEY,
        supplier_return_id  UUID NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
        product_id          UUID NOT NULL REFERENCES products(id),
        quantity            NUMERIC(20,4) NOT NULL CHECK (quantity > 0),
        unit_cost           NUMERIC(20,4),
        total_amount        NUMERIC(20,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
        notes               TEXT
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_supplier_return_items_return
       ON supplier_return_items(supplier_return_id)""",

    # ============================================================
    # Sprint 5 — T-204: Inventory rich states + state machine
    # Rollback:
    #   DROP INDEX IF EXISTS idx_scan_events_inv_product;
    #   DROP INDEX IF EXISTS idx_scan_events_org_inv;
    #   DROP TABLE IF EXISTS inventory_scan_events;
    #   ALTER TABLE inventory_items DROP COLUMN IF EXISTS version;
    #   ALTER TABLE inventories DROP COLUMN IF EXISTS confirmed_by;
    #   ALTER TABLE inventories DROP COLUMN IF EXISTS confirmed_at;
    #   ALTER TABLE inventories DROP COLUMN IF EXISTS submitted_at;
    #   ALTER TABLE inventories DROP COLUMN IF EXISTS resumed_at;
    #   ALTER TABLE inventories DROP COLUMN IF EXISTS paused_at;
    #   ALTER TABLE inventories DROP COLUMN IF EXISTS lock_mode;
    #   ALTER TABLE inventories DROP COLUMN IF EXISTS blind_count;
    #   -- Drop new CHECK constraint if applied; enum rollback not possible without data migration
    # ============================================================

    # Extend CHECK constraint on inventories.status (DROP old, ADD new with extra values).
    # The column type is inventory_status ENUM; we cannot alter the ENUM inside a transaction
    # (handled via ENUM_PATCHES with AUTOCOMMIT). Here we only add extra columns.
    """ALTER TABLE inventories ADD COLUMN IF NOT EXISTS blind_count BOOLEAN NOT NULL DEFAULT FALSE""",
    """ALTER TABLE inventories ADD COLUMN IF NOT EXISTS lock_mode VARCHAR(20) NOT NULL DEFAULT 'none'""",
    """ALTER TABLE inventories ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ""",
    """ALTER TABLE inventories ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ""",
    """ALTER TABLE inventories ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ""",
    """ALTER TABLE inventories ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ""",
    """ALTER TABLE inventories ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id)""",

    """ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0""",

    """
    CREATE TABLE IF NOT EXISTS inventory_scan_events (
        id              BIGSERIAL PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        inventory_id    UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
        product_id      UUID NOT NULL REFERENCES products(id),
        quantity        NUMERIC(20,4) NOT NULL,
        barcode         VARCHAR(64),
        user_id         UUID NOT NULL REFERENCES users(id),
        device_id       VARCHAR(100),
        scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes           TEXT
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_scan_events_org_inv
       ON inventory_scan_events(organization_id, inventory_id, scanned_at)""",
    """CREATE INDEX IF NOT EXISTS idx_scan_events_inv_product
       ON inventory_scan_events(inventory_id, product_id)""",

    # ============================================================
    # Sprint 5 — T-205: is_voided for scan event rollback (soft delete)
    # Rollback:
    #   ALTER TABLE inventory_scan_events DROP COLUMN IF EXISTS is_voided;
    #   DROP INDEX IF EXISTS idx_scan_events_inv_product_active;
    # ============================================================
    """ALTER TABLE inventory_scan_events ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT FALSE""",
    """CREATE INDEX IF NOT EXISTS idx_scan_events_inv_product_active
       ON inventory_scan_events(inventory_id, product_id)
       WHERE is_voided = FALSE""",

    # ============================================================
    # Sprint 5 — T-210: stock_ins (oprihodovanie / stock-in posting)
    # Separate table from write_offs — different reasons, different sign.
    # Rollback (reverse FK order):
    #   DROP INDEX IF EXISTS idx_stock_in_items_si;
    #   DROP INDEX IF EXISTS idx_stock_ins_status;
    #   DROP INDEX IF EXISTS idx_stock_ins_org_wh;
    #   DROP TABLE IF EXISTS stock_in_items;
    #   DROP TABLE IF EXISTS stock_ins;
    # ============================================================
    """
    CREATE TABLE IF NOT EXISTS stock_ins (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        doc_number      VARCHAR(50),
        warehouse_id    INT  NOT NULL REFERENCES warehouses(id),
        reason          VARCHAR(500),
        notes           TEXT,
        status          VARCHAR(20) NOT NULL DEFAULT 'draft',
        created_by      UUID REFERENCES users(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_at    TIMESTAMPTZ,
        confirmed_by    UUID REFERENCES users(id)
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_stock_ins_org_wh
       ON stock_ins(organization_id, warehouse_id, created_at DESC)""",
    """CREATE INDEX IF NOT EXISTS idx_stock_ins_status
       ON stock_ins(organization_id, status)""",

    """
    CREATE TABLE IF NOT EXISTS stock_in_items (
        id           BIGSERIAL PRIMARY KEY,
        stock_in_id  UUID          NOT NULL REFERENCES stock_ins(id) ON DELETE CASCADE,
        product_id   UUID          NOT NULL REFERENCES products(id),
        quantity     NUMERIC(20,3) NOT NULL CHECK (quantity > 0),
        unit_cost    NUMERIC(20,4) DEFAULT 0,
        amount       NUMERIC(20,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED
    )
    """,
    """CREATE INDEX IF NOT EXISTS idx_stock_in_items_si
       ON stock_in_items(stock_in_id)""",

    # T-211: source_legacy_id tracking column for legacy transfers migration
    # Rollback: ALTER TABLE internal_transfers DROP COLUMN IF EXISTS source_legacy_id;
    """
    ALTER TABLE internal_transfers
        ADD COLUMN IF NOT EXISTS source_legacy_id UUID
    """,

    # T-211: One-time idempotent migration of legacy transfers → internal_transfers.
    # Runs on every startup but is a no-op if legacy table is empty or all rows are
    # already migrated (guarded by source_legacy_id NOT NULL check).
    # transfer_items.cost maps to internal_transfer_items.cost (both NUMERIC).
    # transfer_items has no unit_id — inserted as NULL.
    # Legacy transfers.status uses transfer_status enum; values match internal_transfers
    # VARCHAR(20) status: draft/sent/received/cancelled.
    # Rollback (removes only migrated rows):
    #   DELETE FROM internal_transfers WHERE source_legacy_id IS NOT NULL;
    """
    DO $$
    DECLARE
        leg RECORD;
        new_id UUID;
        new_doc VARCHAR(50);
    BEGIN
        IF EXISTS (SELECT 1 FROM transfers LIMIT 1) THEN
            FOR leg IN SELECT * FROM transfers LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM internal_transfers
                    WHERE source_legacy_id = leg.id
                ) THEN
                    new_doc := COALESCE(leg.doc_number, 'MIGRATED-' || leg.id::text);
                    INSERT INTO internal_transfers (
                        organization_id, doc_number, from_warehouse, to_warehouse,
                        status, notes, created_by, created_at, source_legacy_id
                    ) VALUES (
                        leg.organization_id, new_doc, leg.from_warehouse_id, leg.to_warehouse_id,
                        CASE leg.status::text
                            WHEN 'draft'      THEN 'draft'
                            WHEN 'sent'       THEN 'sent'
                            WHEN 'received'   THEN 'received'
                            WHEN 'cancelled'  THEN 'cancelled'
                            ELSE 'draft'
                        END,
                        leg.notes, leg.created_by, leg.created_at, leg.id
                    )
                    RETURNING id INTO new_id;

                    INSERT INTO internal_transfer_items (transfer_id, product_id, qty, unit_id, cost)
                    SELECT new_id, ti.product_id, ti.quantity, NULL, COALESCE(ti.cost, 0)
                    FROM transfer_items ti
                    WHERE ti.transfer_id = leg.id;
                END IF;
            END LOOP;
        END IF;
    END $$
    """,

    # Sprint 5 QA fix M1: stock_in_reasons table
    # Rollback: DROP TABLE IF EXISTS stock_in_reasons CASCADE;
    """
    CREATE TABLE IF NOT EXISTS stock_in_reasons (
        id              SERIAL PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(200) NOT NULL,
        code            VARCHAR(50),
        is_active       BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_in_reasons_org_name
        ON stock_in_reasons(organization_id, name)
    """,

    # Sprint 5 QA fix M1: link stock_ins to stock_in_reasons (backward-compat; reason_text stays)
    # Rollback: ALTER TABLE stock_ins DROP COLUMN IF EXISTS reason_id;
    """
    ALTER TABLE stock_ins
        ADD COLUMN IF NOT EXISTS reason_id INT REFERENCES stock_in_reasons(id)
    """,

    # Registration now collects phone instead of email (staff sign-up moved to phone+OTP).
    # No organization exists yet at OTP-request time, so this table has no org FK
    # (unlike customer_otp_codes). Rollback: DROP TABLE IF EXISTS registration_otp_codes CASCADE;
    """
    CREATE TABLE IF NOT EXISTS registration_otp_codes (
        id          BIGSERIAL PRIMARY KEY,
        phone       VARCHAR(20) NOT NULL,
        code        VARCHAR(8) NOT NULL,
        attempts    INT DEFAULT 0,
        used        BOOLEAN DEFAULT FALSE,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    # Email is no longer collected at registration; phone (already UNIQUE, nullable) is primary.
    # Rollback: ALTER TABLE users ALTER COLUMN email SET NOT NULL; -- only if no NULLs exist
    """
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL
    """,

    # ============================================================
    # Accounting module (Phase 1) — chart of accounts + double-entry journal.
    # journal_entries/journal_lines are append-only (immutable trigger, same
    # pattern as stock_movements) — corrections are posted as new reversing
    # entries, never edited/deleted.
    # Rollback:
    #   DROP TRIGGER IF EXISTS trg_journal_entries_immutable ON journal_entries;
    #   DROP FUNCTION IF EXISTS journal_entries_immutable();
    #   DROP TABLE IF EXISTS journal_lines, journal_entries, accounts CASCADE;
    # ============================================================
    """
    CREATE TABLE IF NOT EXISTS accounts (
        id               SERIAL PRIMARY KEY,
        organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        code             VARCHAR(20) NOT NULL,
        name             VARCHAR(200) NOT NULL,
        type             VARCHAR(20) NOT NULL,  -- asset|liability|equity|income|expense
        parent_id        INT REFERENCES accounts(id),
        linked_cashbox_id INT REFERENCES cashboxes(id),
        is_system        BOOLEAN DEFAULT FALSE,
        is_active        BOOLEAN DEFAULT TRUE,
        created_at       TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_org_code ON accounts(organization_id, code)
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_entries (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        entry_number     VARCHAR(50),
        entry_date       DATE NOT NULL DEFAULT CURRENT_DATE,
        description      TEXT,
        source_type      VARCHAR(30) NOT NULL DEFAULT 'manual',
        source_id        TEXT,
        created_by       UUID REFERENCES users(id),
        created_at       TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_journal_entries_org_date
        ON journal_entries(organization_id, entry_date)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_journal_entries_source
        ON journal_entries(source_type, source_id)
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_lines (
        id               BIGSERIAL PRIMARY KEY,
        entry_id         UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id       INT NOT NULL REFERENCES accounts(id),
        debit            NUMERIC(20,2) NOT NULL DEFAULT 0,
        credit           NUMERIC(20,2) NOT NULL DEFAULT 0,
        currency_id      INT REFERENCES currencies(id),
        rate             NUMERIC(20,6) DEFAULT 1,
        amount_base      NUMERIC(20,2) NOT NULL,
        counterparty_type VARCHAR(20),  -- customer|supplier|employee
        counterparty_id  UUID,
        description      TEXT
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_journal_lines_counterparty
        ON journal_lines(counterparty_type, counterparty_id) WHERE counterparty_id IS NOT NULL
    """,
    """
    CREATE OR REPLACE FUNCTION journal_entries_immutable()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
        RAISE EXCEPTION 'journal_entries/journal_lines are append-only: UPDATE and DELETE are forbidden';
    END;
    $$
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_journal_entries_immutable'
              AND tgrelid = 'journal_entries'::regclass
        ) THEN
            CREATE TRIGGER trg_journal_entries_immutable
                BEFORE UPDATE OR DELETE ON journal_entries
                FOR EACH ROW EXECUTE FUNCTION journal_entries_immutable();
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_journal_lines_immutable'
              AND tgrelid = 'journal_lines'::regclass
        ) THEN
            CREATE TRIGGER trg_journal_lines_immutable
                BEFORE UPDATE OR DELETE ON journal_lines
                FOR EACH ROW EXECUTE FUNCTION journal_entries_immutable();
        END IF;
    END $$
    """,

    # Backfill: seed the standard chart of accounts for every organization that
    # doesn't have one yet (existing orgs; new orgs get this from the register
    # endpoint instead). Idempotent — skips an org if it already has accounts.
    """
    DO $$
    DECLARE
        org RECORD;
        cb RECORD;
        cash_parent_id INT;
    BEGIN
        FOR org IN SELECT id FROM organizations LOOP
            IF EXISTS (SELECT 1 FROM accounts WHERE organization_id = org.id) THEN
                CONTINUE;
            END IF;

            INSERT INTO accounts (organization_id, code, name, type, is_system) VALUES
                (org.id, '1000', 'Kassa va bank', 'asset', TRUE),
                (org.id, '1200', 'Mijozlar qarzi (debitorlik)', 'asset', TRUE),
                (org.id, '1300', 'Tovar-moddiy zaxiralar', 'asset', TRUE),
                (org.id, '2000', 'Yetkazib beruvchilar qarzi (kreditorlik)', 'liability', TRUE),
                (org.id, '3000', 'Kapital / Taqsimlanmagan foyda', 'equity', TRUE),
                (org.id, '4000', 'Sotuvdan tushum', 'income', TRUE),
                (org.id, '5000', 'Sotilgan tovar tannarxi', 'expense', TRUE),
                (org.id, '5100', 'Hisobdan chiqarish xarajati', 'expense', TRUE),
                (org.id, '5200', 'Boshqa operatsion xarajatlar', 'expense', TRUE);

            SELECT id INTO cash_parent_id FROM accounts WHERE organization_id = org.id AND code = '1000';

            FOR cb IN SELECT id, name FROM cashboxes WHERE organization_id = org.id LOOP
                INSERT INTO accounts (organization_id, code, name, type, parent_id, linked_cashbox_id, is_system)
                VALUES (org.id, '1000-' || cb.id, cb.name, 'asset', cash_parent_id, cb.id, TRUE);
            END LOOP;
        END LOOP;
    END $$
    """,

    # Fix: source_id must accept any source table's PK format, not just UUID —
    # cash_movements.id (and others) are integers. Rollback: no safe rollback
    # (would require re-verifying every existing source_id is a valid UUID first).
    """
    ALTER TABLE journal_entries ALTER COLUMN source_id TYPE TEXT USING source_id::text
    """,
]

# Enum value additions — must run outside a transaction (AUTOCOMMIT).
# PG16 still forbids ALTER TYPE ... ADD VALUE inside an explicit transaction.
ENUM_PATCHES = [
    "ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'paused'",
    "ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'pending_confirmation'",
]


async def apply_patches() -> None:
    # Run enum patches first in AUTOCOMMIT (cannot be in a transaction)
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        for ddl in ENUM_PATCHES:
            try:
                await conn.execute(text(ddl))
            except Exception:
                pass  # already added — safe to ignore

    async with engine.begin() as conn:
        for ddl in PATCHES:
            await conn.execute(text(ddl))
