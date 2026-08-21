"""
Extended demo seed — kassalar, BOM retseptlar, ko'p sotuv, qaytarishlar.

Idempotent: avval mavjudligini tekshirib qo'shadi.
Run: docker exec erp-api python -m app.db.seed_extra
"""
import asyncio
import os
import random
import sys
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.db.session import engine  # noqa: E402


ORG_CODE = "ANIQ"


CASHBOXES = [
    ("Asosiy kassa", 0),
    ("POS terminal", 0),
    ("Telefon orqali", 0),
]


# BOM retseptlar — har biri yangi mahsulot uchun ingredient ro'yxati
RECIPES = [
    {
        "product": "CHUCHVARA",
        "output_qty": 1,  # 1 porsiya
        "ingredients": [
            ("MOL GO'SHTI 1KG", 0.15),
            ("UN 1KG", 0.2),
            ("PIYOZ 1KG", 0.05),
            ("TUZ 1KG", 0.005),
        ],
    },
    {
        "product": "SOMSA",
        "output_qty": 1,
        "ingredients": [
            ("MOL GO'SHTI 1KG", 0.12),
            ("UN 1KG", 0.15),
            ("PIYOZ 1KG", 0.06),
            ("YOG' 1L", 0.02),
        ],
    },
    {
        "product": "MANTI",
        "output_qty": 1,
        "ingredients": [
            ("QO'Y GO'SHTI 1KG", 0.18),
            ("UN 1KG", 0.18),
            ("PIYOZ 1KG", 0.07),
            ("TUZ 1KG", 0.005),
        ],
    },
    {
        "product": "PALOV",
        "output_qty": 1,
        "ingredients": [
            ("MOL GO'SHTI 1KG", 0.2),
            ("SABZI 1KG", 0.1),
            ("PIYOZ 1KG", 0.05),
            ("YOG' 1L", 0.05),
        ],
    },
    {
        "product": "LAGMON",
        "output_qty": 1,
        "ingredients": [
            ("MOL GO'SHTI 1KG", 0.15),
            ("UN 1KG", 0.12),
            ("POMIDOR 1KG", 0.1),
            ("PIYOZ 1KG", 0.08),
        ],
    },
    {
        "product": "MASTAVA",
        "output_qty": 1,
        "ingredients": [
            ("MOL GO'SHTI 1KG", 0.12),
            ("KARTOSHKA", 0.15),
            ("SABZI 1KG", 0.08),
            ("PIYOZ 1KG", 0.05),
        ],
    },
    {
        "product": "OSH UCHUN",
        "output_qty": 1,
        "ingredients": [
            ("QO'Y GO'SHTI 1KG", 0.25),
            ("SABZI 1KG", 0.15),
            ("PIYOZ 1KG", 0.05),
            ("YOG' 1L", 0.05),
        ],
    },
    {
        "product": "QO'YMA SOMSA",
        "output_qty": 1,
        "ingredients": [
            ("QO'Y GO'SHTI 1KG", 0.14),
            ("UN 1KG", 0.15),
            ("PIYOZ 1KG", 0.06),
        ],
    },
]


RETURN_REASONS = [
    ("Bracked tovar", "valid"),
    ("Muddati o'tgan", "valid"),
    ("Mijoz qaytardi", "valid"),
    ("Noto'g'ri buyurtma", "valid"),
    ("Sifati past", "valid"),
    ("Test qaytarish", "invalid"),
]


SALE_STATUSES = ["paid", "paid", "paid", "partial", "confirmed", "cancelled"]


async def main():
    print("Aniq ERP — kengaytirilgan demo seed")
    print("=" * 60)

    async with engine.begin() as conn:
        # Resolve org
        org_res = await conn.execute(
            text("SELECT id FROM organizations WHERE code = :c"),
            {"c": ORG_CODE},
        )
        row = org_res.first()
        if not row:
            print(f"❌ {ORG_CODE} tashkilot topilmadi. Avval seed_demo.py ishlatilsin.")
            return
        org_id = str(row.id)
        print(f"  Org: {ORG_CODE} ({org_id})")

        # Resolve UZS currency
        cur_res = await conn.execute(text("SELECT id FROM currencies WHERE code = 'UZS' LIMIT 1"))
        cur_row = cur_res.first()
        currency_id = cur_row.id if cur_row else None

        # ====================================================
        # 1. Cashboxes
        # ====================================================
        cb_count = 0
        for name, balance in CASHBOXES:
            ex = await conn.execute(
                text("SELECT id FROM cashboxes WHERE organization_id = :o AND name = :n"),
                {"o": org_id, "n": name},
            )
            if not ex.first():
                await conn.execute(
                    text("""
                        INSERT INTO cashboxes (organization_id, name, balance, currency_id, is_active)
                        VALUES (:o, :n, :b, :c, TRUE)
                    """),
                    {"o": org_id, "n": name, "b": balance, "c": currency_id},
                )
                cb_count += 1
        print(f"  Cashboxes: +{cb_count} (total: {len(CASHBOXES)})")

        # Pick the main cashbox for sales
        main_cb_res = await conn.execute(
            text("SELECT id FROM cashboxes WHERE organization_id = :o ORDER BY id LIMIT 1"),
            {"o": org_id},
        )
        main_cb = main_cb_res.scalar()

        # ====================================================
        # 2. Get product + customer + warehouse maps
        # ====================================================
        prod_res = await conn.execute(
            text("SELECT id, name, sale_price FROM products WHERE organization_id = :o"),
            {"o": org_id},
        )
        products = {r.name: (str(r.id), float(r.sale_price or 0)) for r in prod_res}

        cust_res = await conn.execute(
            text("SELECT id, name FROM customers WHERE organization_id = :o"),
            {"o": org_id},
        )
        customers = [str(r.id) for r in cust_res]

        wh_res = await conn.execute(
            text("SELECT id FROM warehouses WHERE organization_id = :o ORDER BY id"),
            {"o": org_id},
        )
        warehouses = [r.id for r in wh_res]
        finished_wh = warehouses[0] if warehouses else None
        raw_wh = warehouses[1] if len(warehouses) > 1 else finished_wh

        # ====================================================
        # 3. BOM recipes
        # ====================================================
        bom_count = 0
        for recipe in RECIPES:
            prod = products.get(recipe["product"])
            if not prod:
                continue
            pid, _price = prod
            ex = await conn.execute(
                text("SELECT id FROM bom WHERE organization_id = :o AND product_id = :p"),
                {"o": org_id, "p": pid},
            )
            if ex.first():
                continue
            bom_res = await conn.execute(
                text("""
                    INSERT INTO bom (organization_id, product_id, output_qty, is_active)
                    VALUES (:o, :p, :q, TRUE) RETURNING id
                """),
                {"o": org_id, "p": pid, "q": recipe["output_qty"]},
            )
            bom_id = bom_res.scalar()
            for ing_name, ing_qty in recipe["ingredients"]:
                ing = products.get(ing_name)
                if not ing:
                    continue
                await conn.execute(
                    text("""
                        INSERT INTO bom_items (bom_id, product_id, quantity)
                        VALUES (:b, :p, :q)
                    """),
                    {"b": bom_id, "p": ing[0], "q": ing_qty},
                )
            bom_count += 1
        print(f"  BOM retseptlar: +{bom_count} (total: {len(RECIPES)})")

        # ====================================================
        # 4. Sale return reasons
        # ====================================================
        rr_count = 0
        for name, rtype in RETURN_REASONS:
            ex = await conn.execute(
                text("SELECT id FROM sale_return_reasons WHERE organization_id = :o AND name = :n"),
                {"o": org_id, "n": name},
            )
            if not ex.first():
                await conn.execute(
                    text("""
                        INSERT INTO sale_return_reasons (organization_id, name, return_type, is_active)
                        VALUES (:o, :n, :t, TRUE)
                    """),
                    {"o": org_id, "n": name, "t": rtype},
                )
                rr_count += 1
        print(f"  Sale return reasons: +{rr_count}")

        # ====================================================
        # 5. Many sales — random over last 60 days
        # ====================================================
        existing_sales = await conn.execute(
            text("SELECT COUNT(*) FROM sales WHERE organization_id = :o"),
            {"o": org_id},
        )
        existing_count = existing_sales.scalar() or 0
        target_count = 100
        to_create = max(0, target_count - existing_count)
        print(f"  Sales: mavjud {existing_count}, qo'shiladi {to_create}")

        random.seed(42)
        good_products = [(n, *p) for n, p in products.items() if p[1] > 0]

        sale_ids: list[tuple[str, str]] = []  # (id, customer_id)
        for i in range(to_create):
            customer_id = random.choice(customers)
            days_ago = random.randint(0, 60)
            sale_date_offset = days_ago
            n_items = random.randint(1, 5)
            picked = random.sample(good_products, min(n_items, len(good_products)))

            total = sum(price * random.randint(1, 8) for _name, _id, price in picked)
            status = random.choice(SALE_STATUSES)
            paid = total if status == "paid" else (
                total * 0.5 if status == "partial" else (0 if status == "cancelled" else total)
            )

            sale_res = await conn.execute(
                text("""
                    INSERT INTO sales (
                        organization_id, warehouse_id, customer_id, currency_id,
                        total_amount, paid_amount, status, sale_date
                    ) VALUES (
                        :o, :wh, :c, :cur, :t, :p, :st,
                        NOW() - (:days || ' days')::interval - (random() * INTERVAL '8 hours')
                    ) RETURNING id
                """),
                {
                    "o": org_id, "wh": finished_wh, "c": customer_id, "cur": currency_id,
                    "t": total, "p": paid, "st": status, "days": str(sale_date_offset),
                },
            )
            sid = str(sale_res.scalar())
            sale_ids.append((sid, customer_id))

            for name, pid, price in picked:
                qty = random.randint(1, 8)
                await conn.execute(
                    text("""
                        INSERT INTO sale_items (sale_id, product_id, quantity, price, discount)
                        VALUES (:s, :p, :q, :pr, 0)
                    """),
                    {"s": sid, "p": pid, "q": qty, "pr": price},
                )

            # Add cash movement for paid sales
            if paid > 0 and main_cb:
                await conn.execute(
                    text("""
                        INSERT INTO cash_movements (
                            organization_id, cashbox_id, direction, amount,
                            customer_id, sale_id, description
                        ) VALUES (:o, :cb, 'in', :a, :c, :s, 'Sotuv to''lovi')
                    """),
                    {"o": org_id, "cb": main_cb, "a": paid, "c": customer_id, "s": sid},
                )

        if to_create:
            # Update cashbox total balance
            await conn.execute(
                text("""
                    UPDATE cashboxes SET balance = (
                        SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0)
                        FROM cash_movements WHERE cashbox_id = :cb
                    ) WHERE id = :cb
                """),
                {"cb": main_cb},
            )

        # ====================================================
        # 6. Sale returns — pick some 'paid' sales and refund
        # ====================================================
        if sale_ids:
            paid_sales = await conn.execute(
                text("""
                    SELECT id, customer_id, total_amount, warehouse_id
                    FROM sales
                    WHERE organization_id = :o AND status = 'paid'
                    ORDER BY random() LIMIT 25
                """),
                {"o": org_id},
            )
            paid_list = list(paid_sales)
            reason_res = await conn.execute(
                text("SELECT id FROM sale_return_reasons WHERE organization_id = :o ORDER BY id"),
                {"o": org_id},
            )
            reason_ids = [r.id for r in reason_res]

            existing_ret = await conn.execute(
                text("SELECT COUNT(*) FROM sale_returns WHERE organization_id = :o"),
                {"o": org_id},
            )
            ret_existing = existing_ret.scalar() or 0
            ret_added = 0
            for ps in paid_list:
                if ret_existing + ret_added >= 25:
                    break
                items = await conn.execute(
                    text("""
                        SELECT product_id, quantity, price FROM sale_items
                        WHERE sale_id = :s LIMIT 2
                    """),
                    {"s": str(ps.id)},
                )
                items_list = list(items)
                if not items_list:
                    continue
                ret_total = sum(float(it.price) * 1 for it in items_list)
                ret_res = await conn.execute(
                    text("""
                        INSERT INTO sale_returns (
                            organization_id, sale_id, warehouse_id, reason_id,
                            return_date, total_amount, status
                        ) VALUES (
                            :o, :s, :w, :r, NOW() - (random() * INTERVAL '30 days'),
                            :t, 'completed'
                        ) RETURNING id
                    """),
                    {
                        "o": org_id, "s": str(ps.id), "w": ps.warehouse_id,
                        "r": random.choice(reason_ids) if reason_ids else None,
                        "t": ret_total,
                    },
                )
                rid = str(ret_res.scalar())
                for it in items_list:
                    await conn.execute(
                        text("""
                            INSERT INTO sale_return_items (return_id, product_id, quantity, price)
                            VALUES (:r, :p, 1, :pr)
                        """),
                        {"r": rid, "p": str(it.product_id), "pr": it.price},
                    )
                ret_added += 1
            print(f"  Sale returns: +{ret_added}")

    print("=" * 60)
    print("Kengaytirish tugadi.")


if __name__ == "__main__":
    asyncio.run(main())
