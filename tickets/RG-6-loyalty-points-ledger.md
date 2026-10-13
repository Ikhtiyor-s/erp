# RG-6 — Mijoz loyalty/bonus ball tizimi (to'plash + sarflash)

**Spec**: `tickets/SPEC-regos-gap.md`

> ⚠️ Hozir `customers.loyalty_card VARCHAR(50)` ustuni bor, lekin **uni hech bir kod o'qimaydi/
> yozmaydi** (repo-wide tekshirildi — 0 natija). `/customer/cashback-turnover` endpoint ham
> HAQIQIY ledger emas — faqat "agar 1% cashback bo'lsa qancha bo'lardi" degan gipotetik hisobot
> (`apps/api/app/modules/customer/router.py:572-595`). Bu ticket haqiqiy earn/redeem ledger quradi.

## Goal

Mijoz har bir sotuvdan ball to'plasin (masalan sotuv summasining X%) va keyingi xaridda shu
ballarni chegirma sifatida sarflay olsin — bazada real balans bilan.

## Files likely touched

- `apps/api/app/db/schema_patches.py` — yangi `loyalty_ledger` jadvali (id, organization_id,
  customer_id, sale_id, direction `earn|redeem|adjust`, points, created_at) + `customers`ga
  `loyalty_balance` denormalized ustun (tezkor o'qish uchun, ledger — haqiqat manbasi)
- `apps/api/app/modules/customer/router.py` — `GET /customer/{id}/loyalty`, 
  `POST /customer/{id}/loyalty/adjust` (qo'lda tuzatish, admin uchun)
- `apps/api/app/modules/sale/router.py` — `create_sale`/`pay_sale`ga ixtiyoriy earn-on-pay va
  `redeem_points` parametri (checkout vaqtida ballarni chegirma sifatida qo'llash)
- `apps/api/app/modules/sale/router.py` — **MUHIM**: mavjud `cancel_sale` (477-qator) bilan
  integratsiya — sotuv bekor qilinsa, shu sotuvdan topilgan ballar avtomatik qaytarilsin
  (aks holda mijoz "bepul" ball bilan qolib ketadi — Risklar bo'limida eslatilgan)
- `apps/api/app/modules/rbac/permissions.py` — `customer.loyalty.manage`

## How we'll know it's done

- Sotuv to'langach (`pay_sale`), mijozga avtomatik ball yoziladi (`loyalty_ledger` + 
  `customers.loyalty_balance` yangilanadi) — org-darajadagi ball foizi `settings`da sozlanadi
- Checkout vaqtida mijoz o'z ballaridan foydalanib chegirma ola oladi, balansdan ortiq sarflab
  bo'lmaydi (422 agar yetarli ball bo'lmasa)
- Sotuv bekor qilinsa (`cancel_sale`) — shu sotuvdan kelgan ball avtomatik qaytariladi
  (`loyalty_ledger`ga `adjust` qatori)
- `organization_id` filter — boshqa org mijozining ball balansi ko'rinmaydi/o'zgartirilmaydi
- Eski `cashback-turnover` hisobot endpointi o'chirilmaydi (hali ham gipotetik ko'rsatkich
  sifatida foydali) — yangi ledger shunchaki haqiqiy balansni qo'shadi

## Owner role

`backend-dev` (frontend — mijoz kartochkasida balans ko'rsatish + checkout'da sarflash input —
shu ticket ichida kichik qo'shimcha, katta bo'lsa keyingi sprintda alohida ticket)

## Depends on

none
