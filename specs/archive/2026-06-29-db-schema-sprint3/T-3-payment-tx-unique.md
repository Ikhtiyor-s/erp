# T-3 — payment-tx-unique

## Goal

`payment_transactions` jadvalida `(provider, provider_tx_id)` juftligiga UNIQUE indeks qo'yish —
eski non-unique indeksni DROP qilib, yangi partial UNIQUE indeks yaratish orqali Click va Payme
webhook idempotencyni DB darajasida kafolatlash.

## Acceptance criteria

- `apps/api/app/db/schema_patches.py` `PATCHES` ro'yxatiga quyidagi idempotent PL/pgSQL bloki qo'shilgan:

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_tx_provider') THEN
    DROP INDEX idx_payment_tx_provider;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_payment_tx_provider') THEN
    CREATE UNIQUE INDEX uq_payment_tx_provider
      ON payment_transactions (provider, provider_tx_id)
      WHERE provider_tx_id IS NOT NULL;
  END IF;
END $$;
```

- `docker compose restart api` startup xatosiz tugaydi
- `pg_indexes` da `uq_payment_tx_provider` mavjud, `idx_payment_tx_provider` esa mavjud emas
- Bir xil `(provider, provider_tx_id)` juftligi ikki marta INSERT qilinganda PostgreSQL `unique_violation` xatosi qaytaradi
- `provider_tx_id IS NULL` bo'lgan bir nechta yozuv parallel INSERT qilinganda unique xatosi chiqmaydi

## Muhim eslatmalar

- **Duplikat tekshiruvi AVVAL**: implementatsiyadan oldin DB'da duplikat mavjudligini tekshiring:
  ```sql
  SELECT provider, provider_tx_id, COUNT(*)
  FROM payment_transactions
  WHERE provider_tx_id IS NOT NULL
  GROUP BY 1, 2
  HAVING COUNT(*) > 1;
  ```
  Agar duplikat topilsa — T-3 ni SKIP qiling va `schema_patches.py` da quyidagi izoh qoldiring:
  ```python
  # T-3 SKIP: payment_transactions da duplikat (provider, provider_tx_id) topildi.
  # Avval data cleanup sprint kerak. Tekshirildi: 2026-06-29.
  ```
  Keyin T-4 testida `uq_payment_tx_provider` indeksi mavjudligini tekshiruvchi test SKIP bo'lishi haqida izoh qoldiring.
- **`infra/postgres/init.sql` ga tegmang**: faqat `schema_patches.py` ga yozilsin.
- **T-2 dan keyin yoki parallel**: bu patch T-2 dagi boshqa patch'lardan mustaqil, lekin `PATCHES` ro'yxatida T-2 patch'lari DAN KEYIN joylashtirilsin (tartib qulaylik uchun).

## Files likely touched

- `apps/api/app/db/schema_patches.py`

## Owner role

`backend-dev`

## Depends on

`T-2` (mantiqan — bir fayl, ketma-ket patch qo'shish osonroq)

## Estimated effort

S (20 daqiqa)
