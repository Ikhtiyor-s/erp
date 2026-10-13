# DESIGN — Self-checkout kiosk: device-credential auth modeli (FREEZE)

> Architect tomonidan yoziladi. SPEC: `tickets/SPEC-self-checkout.md`.
> Bu hujjat faqat **kiosk qurilmasini autentifikatsiya qilish modelini** muzlatadi — bu
> boshqa har qanday qarordan oldin hal qilinishi shart bo'lgan markaziy savol (vazifa
> ta'rifida alohida talab qilingan). Qolgan hamma narsa (katalog, checkout, to'lov, UI)
> `SPEC-self-checkout.md`da.
>
> Kod bazasida o'qilgan haqiqiy holat (taxmin emas): `apps/api/app/modules/storefront/`,
> `apps/api/app/modules/customer_portal/auth.py`, `apps/api/app/modules/rbac/`,
> `apps/api/app/modules/sale/service.py::create_sale_core()`, `apps/api/app/modules/rbac/router.py`
> (`secrets.token_urlsafe` + SHA-256 `_hash_invitation_token` — taklif tokeni naqshi),
> `apps/api/app/db/schema_patches.py` (`cashboxes`, `cashbox_sessions`, `devices`,
> `storefront_orders`, `payment_transactions` jadvallari).

## YAKUNIY QAROR: kiosk — "device credential", storefront'ning anonim modeli EMAS

Kiosk o'ziga xos **to'rtinchi** auth modeli bo'ladi (mavjud uchtasidan farqli):

| # | Model | Qayerda | Kim/nima | Revoke qanday |
|---|---|---|---|---|
| 1 | Staff JWT + RBAC | `core/security.py`, `rbac/middleware.py` | login qilgan xodim | parol/sessiya, role o'chirish |
| 2 | Customer-portal JWT | `customer_portal/auth.py` | OTP bilan login qilgan B2B mijoz | JWT exp (30 kun), customer.is_active |
| 3 | Anonim (token yo'q) | `storefront/router.py` (`/shop/*`) | **har qanday** anonim brauzer, `org_code` orqali | — (tokensiz, revoke tushunchasi yo'q) |
| **4 (yangi)** | **Device credential** | `kiosk/auth.py` (yangi) | **bitta jismoniy kiosk**, admin tomonidan oldindan ro'yxatdan o'tgan | admin "Revoke" bosadi → shu zahoti o'ladi |

### Nega storefront'ning anonim modeli mos emas (markaziy savol — rad etish sababi)

Storefront (`/shop/*`) ataylab **hech qanday identifikatsiyasiz** ishlaydi: `org_code` so'rov
parametrida ochiq yuboriladi, kataloг faqat `is_published_online=TRUE` mahsulotlar bilan
cheklanadi, sotuv har doim bitta sozlangan `online_warehouse_id`ga yoziladi, to'lov mijoz hozir
bo'lmagani uchun kechiktirilgan (webhook/redirect). Bu model **"istalgan brauzer istalgan joydan"**
uchun to'g'ri — chunki ombordan zaxira yo'q, mijoz jismonan yo'q, va noto'g'ri ishlatilishining
yagona oqibati "soxta buyurtma" (to'lanmagan, hech narsa yo'qolmaydi).

Kiosk esa:
1. **Bitta jismoniy joyga bog'langan** — do'konning haqiqiy sotuv omboridan (xodimlar POS
   ishlatadigan AYNI ombordan, "online" emas) real vaqtda zaxira kamayadi.
2. **Mijoz jismonan hozir** — mahsulot allaqachon qo'lida, kassaga yaqin. Token o'g'irlansa/
   nusxalansa, zarar "bir soxta buyurtma" emas — **haqiqiy tovar haqiqiy do'kondan chiqib ketishi**
   mumkin.
3. Shuning uchun token **"istalgan joydan ishlaydigan" bo'lmasligi SHART** — faqat shu bitta
   qurilmaga tegishli, darhol bekor qilinadigan, bitta kassaga (demak bitta omborga, T-206
   bog'lanishi orqali) qayd etilgan bo'lishi kerak.

**Xulosa**: storefront'ning anonim-hamma-joydan modeli bu yerda **noto'g'ri** — zarar profili
butunlay boshqacha (jismoniy tovar yo'qolishi vs soxta onlayn buyurtma). Kiosk token —
**qurilma-bog'langan, administrator chiqargan, darhol bekor qilinadigan** maxfiy qiymat bo'lishi
shart.

### Nega yangi "kiosk_devices" jadvali — mavjud `devices` jadvali EMAS

`schema_patches.py:112` da allaqachon `devices` jadvali bor (`kind`, `connection`, `address`,
`config JSONB` — printer/tarozi kabi jismoniy uskunalarni belgilash uchun, `cashbox_sessions.
device_id` orqali ishlatiladi). Bu jadvaldan **token_hash/status(revoked) ustunlarini qo'shib
foydalanish** ko'rib chiqildi va **rad etildi**:
- `devices` bugun **xavfsizlik chegarasi emas** — u faqat kosmetik/hisobot metadatasi (qaysi
  kompyuterda smena ochilgan). Unga maxfiy `token_hash` qo'shish ikki butunlay boshqa
  tashvishni (uskuna-yorlig'i vs autentifikatsiya hujjati) bitta jadvalga aralashtiradi.
- `devices` CRUD'i bugun istalgan `warehouse.*`/`finance.*` ruxsatiga ega xodim tomonidan
  o'zgartirilishi mumkin (umumiy sozlama sifatida) — kiosk kredensiali esa alohida, tor
  (`kiosk.*`) ruxsat bilan himoyalangan bo'lishi SHART (pastda RBAC bo'limi).

Shuning uchun **yangi, maqsadli `kiosk_devices` jadvali** — mavjud `devices`dan mustaqil.

### Token formati — SHA-256 hash, bcrypt EMAS (mavjud naqshni aniq takrorlash)

`rbac/router.py:474-475` (`accept-invitation` oqimi) allaqachon aynan shu muammoni hal qilgan:
yuqori-entropiyali (`secrets.token_urlsafe(32)` — 256 bit) tasodifiy tokenni saqlash. U yerda
**bcrypt emas, SHA-256 hex digest** ishlatiladi (`_hash_invitation_token`, izoh: "same approach as
session/email-verify tokens"). Sabab: bcrypt parollar uchun — past-entropiyali, inson tanlagan
qiymatlarni asta sekinlashtirib brute-force'dan himoya qilish uchun mo'ljallangan, va **индекс
bo'yicha qidirib bo'lmaydi** (har bir qatorni alohida tekshirish kerak). 256-bitli tasodifiy token
uchun bu keraksiz xarajat — oddiy `SHA256(token) = token_hash` ustida **UNIQUE indeks** bilan
O(1) qidiruv to'g'ri va xavfsiz yechim (token taxmin qilib topib bo'lmaydi, demak lug'at-hujumi
xavfi yo'q — bcrypt'ning "asta sekinlashtirish" xususiyati bu holatda foyda bermaydi).

**Qaror**: kiosk device token xuddi taklif-tokeni bilan bir xil naqsh — `secrets.token_urlsafe(32)`
ochiq matn (faqat yaratilish/rotate paytida BIR MARTA ko'rsatiladi), `SHA256(token)` saqlanadi,
`token_hash` ustida UNIQUE indeks.

## Fayl tuzilishi

### Yangi fayllar
- `apps/api/app/modules/kiosk/__init__.py`
- `apps/api/app/modules/kiosk/auth.py` — `get_current_kiosk_device()` FastAPI dependency
  (token parse + hash + DB lookup + status tekshiruvi + `last_used_at`/`last_used_ip` yangilash),
  xuddi `customer_portal/auth.py::get_current_customer()` shaklida.
- `apps/api/app/modules/kiosk/devices_router.py` — admin provisioning CRUD (`/kiosk-devices`,
  staff JWT + RBAC orqali himoyalangan).
- `apps/web/app/(dashboard)/settings/kiosk-devices/page.tsx` — admin UI: ro'yxat, "Yangi qurilma"
  (token BIR MARTA ko'rsatiladi, nusxalash tugmasi), "Rotate", "Revoke".

### Edit qilinadigan fayllar
- `apps/api/app/db/schema_patches.py` (+2 jadval, pastda)
- `apps/api/app/modules/rbac/permissions.py` (+4 permission: `kiosk.view/create/update/delete`)
- `apps/api/app/modules/rbac/middleware.py`:
  - `URL_MODULE`: `"kiosk-devices": "kiosk"` qo'shiladi (admin CRUD RBAC orqali o'tishi uchun)
  - `SKIP_PATHS_PREFIX`: `"/api/v1/kiosk/"` qo'shiladi (qurilma-token yo'li — inson RBAC
    middleware'idan **chiqarib qo'yiladi**, xuddi `/shop/` va `/customer-portal/` kabi)
- `apps/api/app/modules/idempotency/middleware.py`:
  - `_WHITELIST`: `("POST", "/api/v1/kiosk/checkout")` qo'shiladi
  - org-resolver: `_KIOSK_CHECKOUT_PATH` uchun `_resolve_portal_order_org`ga o'xshash funksiya —
    org_id `X-Organization-Id` headerdan emas, Bearer qurilma-tokenidan (`kiosk_devices` orqali)
    aniqlanadi (xuddi portal/shop uchun qilingani kabi — ikkalasi ham headersiz).
- `apps/api/app/main.py` — yangi router ro'yxatdan o'tkaziladi (`kiosk.router`,
  `kiosk.devices_router`).

## DB o'zgarishlari

```sql
-- Qurilma kredensiali — admin tomonidan chiqarilgan, bitta kassaga (demak T-206 orqali
-- bitta omborga) bog'langan, darhol bekor qilinadigan token.
CREATE TABLE IF NOT EXISTS kiosk_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cashbox_id      INT NOT NULL REFERENCES cashboxes(id) ON DELETE RESTRICT,
    name            VARCHAR(100) NOT NULL,
    token_hash      VARCHAR(64) NOT NULL,   -- SHA-256 hex, rbac/router.py::_hash_invitation_token naqshi
    token_prefix    VARCHAR(10) NOT NULL,   -- ochiq matnning dastlabki ~8 belgisi, faqat admin UI'da ajratish uchun
    status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active' | 'revoked'
    last_used_at    TIMESTAMPTZ,
    last_used_ip    VARCHAR(64),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    revoked_by      UUID REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kiosk_devices_token_hash ON kiosk_devices(token_hash);
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_org_status ON kiosk_devices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_cashbox ON kiosk_devices(cashbox_id);
```

**Nega `warehouse_id` ustuni YO'Q**: `sale/router.py` (T-206, "Case 3": faqat `cashbox_id`
berilganda `warehouse_id` kassadan avtomatik aniqlanadi) bilan bir xil naqsh qayta ishlatiladi.
Kiosk checkout vaqtida ombor har doim `cashboxes.warehouse_id`dan o'qiladi — ikkita joyda
(kiosk_devices VA cashboxes) bir xil ma'lumotni saqlab, ular vaqt o'tishi bilan bir-biridan
ajralib qolish xavfini oldindan yo'qotadi. Agar kassaning o'zi omborga bog'lanmagan bo'lsa —
`sale/router.py:147` bilan **bir xil** xato qaytariladi ("Kassa omborga bog'lanmagan", 422).

**Migration xavfsizligi**: ikkala jadval ham yangi (`CREATE TABLE IF NOT EXISTS`) — qulfsiz,
mavjud jadvallarga tegmaydi. Rollback: `DROP TABLE kiosk_devices` (hech qanday mavjud ishlab
turgan funksionallik bunga bog'liq emas — xavfsiz orqaga qaytarish).

```sql
-- Rollback
DROP TABLE IF EXISTS kiosk_devices;
```

> `kiosk_orders` jadvali (sotuv-darajasidagi metadata: order_number, payment_mode, status) —
> bu **checkout oqimining** bir qismi, token-modelining emas — `SPEC-self-checkout.md`da.

## API kontrakti (FREEZE)

### Qurilma-token transporti

Har bir `/api/v1/kiosk/*` so'rovi: `Authorization: Bearer kiosk_<token>` header. `kiosk_` prefiksi
— shunchaki brauzer devtools/log'larda oson ajratish uchun (xavfsizlik chegarasi emas — haqiqiy
entropiya `secrets.token_urlsafe(32)` qismida).

### Admin provisioning — `/api/v1/kiosk-devices` (staff JWT + RBAC, `kiosk.*`)

**POST /api/v1/kiosk-devices** — `kiosk.create`

Request:
```json
{ "name": "Kirish kiosk-1", "cashbox_id": 4 }
```

Response `201`:
```json
{
  "id": "uuid",
  "name": "Kirish kiosk-1",
  "cashbox_id": 4,
  "status": "active",
  "token": "kiosk_AbCd...32bytes...",
  "token_prefix": "kiosk_AbC"
}
```
> `token` — **FAQAT shu javobda, BIR MARTA** qaytariladi. Server plain-matnni saqlamaydi
> (`rbac/router.py:486-487` bilan bir xil shart).

Xatolar:
- `422` — `cashbox_id` boshqa org'ga tegishli / mavjud emas
- `403` — `kiosk.create` ruxsati yo'q

**GET /api/v1/kiosk-devices** — `kiosk.view`

Response `200`:
```json
[
  {
    "id": "uuid", "name": "Kirish kiosk-1", "token_prefix": "kiosk_AbC",
    "status": "active", "cashbox_id": 4, "cashbox_name": "Kassa-2",
    "warehouse_name": "Asosiy ombor",
    "last_used_at": "2026-10-12T09:30:00Z", "created_at": "2026-09-01T10:00:00Z"
  }
]
```
> `token`/`token_hash` bu javobda hech qachon qaytarilmaydi — faqat `token_prefix`.

**POST /api/v1/kiosk-devices/{id}/rotate** — `kiosk.update`

Response `200`: `{ "token": "kiosk_NeW...", "token_prefix": "kiosk_NeW" }`
Eski token shu zahoti ishlamay qoladi (grace period YO'Q — rotate = shubha bor degani).

**PUT /api/v1/kiosk-devices/{id}** — `kiosk.update`
Request: `{ "name": "string", "cashbox_id": int }` → Response `200`: `{ "ok": true }`

**DELETE /api/v1/kiosk-devices/{id}** — `kiosk.delete` (soft — `status='revoked'`)
Response `200`: `{ "ok": true }`. Qurilma shu zahoti barcha `/api/v1/kiosk/*` so'rovlarida `401`
oladi (keshlash yo'q — har bir so'rov real vaqtda DB'dan tekshiriladi).

### Qurilma identifikatsiyasi — `GET /api/v1/kiosk/session`

Kiosk ilovasi ishga tushganda/token almashtirilganda chaqiradi — token hali kuchda ekanini va
qaysi do'kon/kassaga bog'langanini tasdiqlaydi.

Response `200`:
```json
{
  "device_id": "uuid", "device_name": "Kirish kiosk-1",
  "organization_name": "Mening do'konim",
  "cashbox_id": 4, "cashbox_name": "Kassa-2",
  "warehouse_id": 7, "warehouse_name": "Asosiy ombor",
  "max_cart_amount": 500000.0
}
```
Xatolar: `401` — token noto'g'ri/bekor qilingan/topilmadi (barchasi bitta xabar, farqlanmaydi —
tashqi kuzatuvchiga qaysi sabab ekanini bildirmaslik uchun, storefront'ning 404-xulosasi bilan
bir xil ehtiyotkorlik).

## RBAC

| Permission | Kim avtomatik oladi | Izoh |
|---|---|---|
| `kiosk.view` | `admin` (ALL_PERMISSIONS orqali) | `manager`/`cashier`/`accountant`'ga **SHART EMAS** qo'shilmaydi |
| `kiosk.create` | `admin` | Yangi qurilma = yangi pul harakatlantiruvchi kredensial — tor doirada qoldiriladi |
| `kiosk.update` | `admin` | rotate/rename |
| `kiosk.delete` | `admin` | revoke |

**MUST**: `kiosk.*` ROLE_GRANTS'da `manager`/`cashier`/`accountant`/`viewer` ro'yxatlariga
**avtomatik qo'shilmasin**. Egasi xohlasa, mavjud rol-tahrirlash UI orqali qo'lda `manager`'ga
bu ruxsatlarni bera oladi — lekin seed bu qarorni **uning o'rniga avtomatik qabul qilmaydi**
(aynan shu feature'ning o'zi "avtomatik qabul qilinmaydi" tamoyili bilan yaratilgani kabi).

`/api/v1/kiosk/*` (qurilma-token yo'li) — inson RBAC tizimidan **butunlay tashqarida**
(`SKIP_PATHS_PREFIX`). Bu yerda "ruxsat" tushunchasi yo'q — faqat "token kuchda/kuchda emas".

## Xavfsizlik

- **Token hech qachon log'ga yozilmaydi**: audit_log/so'rov log'lari `Authorization` headerni
  saqlamaydi (mavjud middleware xulq-atvori — tekshirildi, `audit/middleware.py` headerlarni
  emas, faqat method/path/user_id/org_id yozadi).
- **Bir martalik ko'rsatish**: token faqat create/rotate javobida, boshqa hech qanday
  endpoint (shu jumladan `GET /kiosk-devices`) uni qaytarmaydi.
- **Darhol bekor qilish**: statik DB-tekshiruv (JWT emas) — revoke/rotate keshlanmaydi,
  keyingi so'rovda zudlik bilan amal qiladi. Bu ataylab JWT'dan ustun qo'yilgan — JWT
  tabiatan amal qilish muddati tugamaguncha bekor qilib bo'lmaydi (blocklist jadvali
  qo'shish shart bo'lardi — bu yerda keraksiz murakkablik).
- **Bitta qurilma = bitta kassa = bitta ombor**: token sizib chiqsa ham, zarar radiusi
  **bitta jismoniy joy** bilan chegaralanadi, butun tashkilot emas (storefront'ning global
  anonim modeli bilan solishtirganda ataylab tor qamrov).
- **`last_used_at`/`last_used_ip`**: har bir muvaffaqiyatli so'rovda yangilanadi — admin
  "bu kiosk 3 kundan beri jim" yoki "kutilmagan IP'dan foydalanilyapti" holatlarini qo'lda
  payqashi mumkin (avtomatik anomaliya aniqlash — bu safar QILMAYMIZ, lekin ma'lumot
  saqlanadi — kelajakda ustiga qurish mumkin).

## Tests (acceptance)

- `test_kiosk_auth.py::test_valid_token_resolves_device`
- `test_kiosk_auth.py::test_revoked_token_401`
- `test_kiosk_auth.py::test_unknown_token_401`
- `test_kiosk_auth.py::test_rotate_invalidates_old_token_immediately`
- `test_kiosk_devices_router.py::test_create_requires_kiosk_create_permission`
- `test_kiosk_devices_router.py::test_token_shown_once_not_in_list_response`
- `test_kiosk_devices_router.py::test_cross_tenant_isolation` (Org B admin Org A qurilmasini
  ko'ra/boshqara olmaydi)

## Kontrakt MUZLATILDI ✓

Backend (`kiosk/auth.py`, `kiosk/devices_router.py`) va frontend (`settings/kiosk-devices/`)
parallel ishlashi mumkin — yuqoridagi javob shakllari o'zgarmaydi. Checkout/katalog/to'lov
kontrakti `SPEC-self-checkout.md`da alohida — bu hujjat faqat token-modelini muzlatadi.
