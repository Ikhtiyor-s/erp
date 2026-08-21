"""
Demo seed — Aniq ERP test ma'lumotlari.

Idempotent: ON CONFLICT DO NOTHING orqali xavfsiz qayta ishga tushirish mumkin.

Yiqayotgan ma'lumotlar:
  - Aniq Demo organization (code='ANIQ')
  - Tayyor mahsulot va Xom ashyo omborlari
  - 30+ test mahsulot (CHUCHVARA, SOMSA, RAKUSHKA, va h.k.)
  - 50+ test mijoz (CHAROS, BEKZOD, FAYZ MARKET, ...)
  - Test sotuvlar va to'lovlar
"""
import asyncio
import os
import sys
from sqlalchemy import text

# Allow running standalone
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.db.session import engine  # noqa: E402

ORG_NAME = "Aniq Demo"
ORG_SLUG = "aniq"

WAREHOUSES = [
    ("Tayyor mahsulot", "finished"),
    ("Xom ashyo ombori", "raw"),
]

# Test mahsulotlar ro'yxati
PRODUCTS = [
    ("CHUCHVARA", "good", 18000),
    ("SOMSA", "good", 12000),
    ("RAKUSHKA", "good", 8000),
    ("LENTA", "good", 5000),
    ("TUMORCHA", "good", 7500),
    ("NAPALION", "good", 15000),
    ("MEDOVIK SHIKALAT", "good", 22000),
    ("KARTOSHKA", "good", 4000),
    ("QO'YMA SOMSA", "good", 14000),
    ("QATIQ 1L", "good", 12000),
    ("SUT 1L", "good", 10000),
    ("QAYMAQ 500G", "good", 25000),
    ("TVOROG 500G", "good", 28000),
    ("PISHIRGAN GO'SHT 1KG", "good", 95000),
    ("MOL GO'SHTI 1KG", "good", 110000),
    ("QO'Y GO'SHTI 1KG", "good", 130000),
    ("PIYOZ 1KG", "material", 5000),
    ("SABZI 1KG", "material", 6000),
    ("POMIDOR 1KG", "material", 12000),
    ("BODRING 1KG", "material", 8000),
    ("GUL KARAM 1KG", "material", 7000),
    ("OSH UCHUN", "good", 35000),
    ("MANTI", "good", 20000),
    ("LAGMON", "good", 25000),
    ("PALOV", "good", 30000),
    ("MOSHXO'RDA", "good", 18000),
    ("MASTAVA", "good", 22000),
    ("UN 1KG", "material", 8000),
    ("YOG' 1L", "material", 22000),
    ("TUZ 1KG", "material", 3000),
]

# Test mijozlar ro'yxati
CUSTOMERS = [
    "AL KAMOL TEMUROV", "CHAROS", "DILNOZA", "BOTIR AKA MILLIY",
    "BEKZOD", "CHIROQCHI KOPIKA", "E'ZOZ MARKET", "ERKIN AKA QAMASHI",
    "FAYZ MARKET", "FARRUX BOZOR", "GULNORA OPA", "HOJI AKA",
    "ISKANDAR AKA", "JAMSHID AKA", "KAMOLA", "LATIFA OPA",
    "MUNIRA", "NODIR AKA", "OYBEK BOZOR", "PARVINA",
    "QODIR AKA", "RAVSHAN MAGAZIN", "SARDOR MARKET", "TURSUNOY",
    "ULUG'BEK MARKET", "VAHID AKA", "XOLIDA OPA", "YODGOR AKA",
    "ZUHRA OPA", "ABDULLOH AKA", "BAHRIDDIN", "CHOLPON OPA",
    "DAVRON MAGAZIN", "ELYOR", "FIRUZA OPA", "G'AYRAT AKA",
    "HASAN", "ISLOMBEK", "JAHONGIR", "KOMRON",
    "LAYLO OPA", "MAQSUD AKA", "NIGORA OPA", "OMINA",
    "PARVIZ", "QOSIM AKA", "ROZIYA OPA", "SOBIR AKA",
    "TOSHKENT MARKET", "ULJON OPA",
]

PHONES = [
    "+998 90 123 45 67", "+998 91 234 56 78", "+998 93 345 67 89",
    "+998 94 456 78 90", "+998 95 567 89 01", "+998 97 678 90 12",
    "+998 99 789 01 23", "+998 88 890 12 34", "+998 33 901 23 45",
    "+998 71 012 34 56",
]


async def main():
    print("Aniq ERP — Demo ma'lumotlar seed")
    print("=" * 60)

    async with engine.begin() as conn:
        # 1) Organization (D'NOZA)
        org = await conn.execute(
            text("SELECT id FROM organizations WHERE code = :s"),
            {"s": ORG_SLUG},
        )
        row = org.first()
        if row:
            org_id = str(row.id)
            print(f"  Organization '{ORG_NAME}' exists: {org_id}")
        else:
            res = await conn.execute(
                text("""
                    INSERT INTO organizations (name, code, is_active)
                    VALUES (:n, :s, TRUE) RETURNING id
                """),
                {"n": ORG_NAME, "s": ORG_SLUG.upper()},
            )
            org_id = str(res.scalar())
            print(f"  Created organization '{ORG_NAME}': {org_id}")

        # 2) Warehouses
        wh_ids = {}
        for wh_name, wh_kind in WAREHOUSES:
            ex = await conn.execute(
                text("SELECT id FROM warehouses WHERE organization_id = :o AND name = :n"),
                {"o": org_id, "n": wh_name},
            )
            r = ex.first()
            if r:
                wh_ids[wh_name] = r.id
            else:
                res = await conn.execute(
                    text("""
                        INSERT INTO warehouses (organization_id, name, is_active)
                        VALUES (:o, :n, TRUE) RETURNING id
                    """),
                    {"o": org_id, "n": wh_name},
                )
                wh_ids[wh_name] = res.scalar()
        print(f"  Warehouses: {len(wh_ids)} ({list(wh_ids.keys())})")

        # 3) Products
        prod_ids = {}
        product_count = 0
        for name, kind, price in PRODUCTS:
            ex = await conn.execute(
                text("SELECT id FROM products WHERE organization_id = :o AND name = :n"),
                {"o": org_id, "n": name},
            )
            r = ex.first()
            if r:
                prod_ids[name] = str(r.id)
            else:
                res = await conn.execute(
                    text("""
                        INSERT INTO products (organization_id, name, kind, sale_price, purchase_price, is_active)
                        VALUES (:o, :n, :k, :p, :pp, TRUE) RETURNING id
                    """),
                    {"o": org_id, "n": name, "k": kind, "p": price, "pp": price * 0.7},
                )
                prod_ids[name] = str(res.scalar())
                product_count += 1
        print(f"  Products: {len(prod_ids)} total ({product_count} new)")

        # 4) Customers
        cust_ids = []
        cust_count = 0
        for i, name in enumerate(CUSTOMERS):
            phone = PHONES[i % len(PHONES)]
            ex = await conn.execute(
                text("SELECT id FROM customers WHERE organization_id = :o AND name = :n"),
                {"o": org_id, "n": name},
            )
            r = ex.first()
            if r:
                cust_ids.append(str(r.id))
            else:
                res = await conn.execute(
                    text("""
                        INSERT INTO customers (organization_id, name, phone, is_active)
                        VALUES (:o, :n, :p, TRUE) RETURNING id
                    """),
                    {"o": org_id, "n": name, "p": phone},
                )
                cust_ids.append(str(res.scalar()))
                cust_count += 1
        print(f"  Customers: {len(cust_ids)} total ({cust_count} new)")

        # 5) Stock balances — har mahsulotga 100 dona qoldiq berish
        finished_wh = wh_ids.get("Tayyor mahsulot")
        stock_count = 0
        for name, kind, price in PRODUCTS:
            if kind == "material":
                continue
            pid = prod_ids[name]
            ex = await conn.execute(
                text("""
                    SELECT 1 FROM stock_balances
                    WHERE warehouse_id = :wh AND product_id = :p
                """),
                {"wh": finished_wh, "p": pid},
            )
            if not ex.first():
                await conn.execute(
                    text("""
                        INSERT INTO stock_balances (warehouse_id, product_id, quantity, avg_cost)
                        VALUES (:wh, :p, 100, :c)
                    """),
                    {"wh": finished_wh, "p": pid, "c": price * 0.7},
                )
                stock_count += 1
        print(f"  Stock balances: {stock_count} new entries")

        # 6) Sample sales (5 ta sotuv)
        sales_count = 0
        for i in range(5):
            customer_id = cust_ids[i % len(cust_ids)]
            ex = await conn.execute(
                text("""
                    SELECT id FROM sales
                    WHERE organization_id = :o AND customer_id = :c
                    LIMIT 1
                """),
                {"o": org_id, "c": customer_id},
            )
            if ex.first():
                continue

            res = await conn.execute(
                text("""
                    INSERT INTO sales (
                        organization_id, warehouse_id, customer_id,
                        total_amount, paid_amount, status, created_at
                    )
                    VALUES (
                        :o, :wh, :c, :tot, :paid, 'paid', NOW() - (:days || ' days')::interval
                    ) RETURNING id
                """),
                {
                    "o": org_id, "wh": finished_wh, "c": customer_id,
                    "tot": 100000 + i * 25000, "paid": 100000 + i * 25000,
                    "days": str(i),
                },
            )
            sid = str(res.scalar())
            # 2-3 ta item
            items = list(PRODUCTS)[i * 3:(i + 1) * 3]
            for name, kind, price in items:
                if kind == "material":
                    continue
                pid = prod_ids[name]
                qty = 2
                await conn.execute(
                    text("""
                        INSERT INTO sale_items (
                            sale_id, product_id, quantity, price, discount
                        ) VALUES (
                            :s, :p, :q, :pr, 0
                        )
                    """),
                    {"s": sid, "p": pid, "q": qty, "pr": price},
                )
            sales_count += 1
        print(f"  Sales: {sales_count} new")

    print("=" * 60)
    print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(main())
