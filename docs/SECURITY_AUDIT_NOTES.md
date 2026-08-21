# Security Audit Notes — 2026-06-27

`local_audit_cdad78df53.pdf` (Web Cloner Security Platform) tahlili va
qabul qilingan qarorlar tarixi.

## Bartaraf etilgan (real) topilmalar

| # | Topilma | Fayl | Yechim |
|---|---|---|---|
| 1 | Dockerfile root user | `apps/api/Dockerfile` | `appuser:appgroup` (uid/gid 1001) qo'shildi |
| 2 | Dockerfile root user | `apps/web/Dockerfile` | `USER node` + `--chown=node:node` |
| 3 | `privileged: true` (cadvisor) | `infra/monitoring/docker-compose.yml` | `devices: [/dev/kmsg]` ga almashtirildi (cadvisor rasmiy tavsiyasi) |
| 4 | Rate limit middleware yo'q | `apps/api/app/main.py` | `slowapi` middleware o'rnatildi; `/auth/login` 10/min, `/auth/register` 5/hour, `/auth/refresh` 30/min, `/customer-portal/auth/request-otp` 3/min, `/customer-portal/auth/verify` 10/min |
| 5 | Frontend fetch timeout yo'q (9 joy) | `apps/web/app/(portal)/portal/**`, `apps/web/public/sw.js` | `AbortSignal.timeout(10000)` (SW: 15000 static, 10000 shell) |
| 6 | `console.log` JSDoc misolda | `apps/web/lib/scanner.ts` | Misol neytral commentga almashtirildi |

## False positives — kod o'zgartirilmagan

### 47 ta "SQL injection" (apps/api/app/modules/*/router.py)

Audit tool `text(f"SELECT ... {var}")` namunasini SQL injection deb belgilaydi,
lekin kod **xavfsiz**: `var` (odatda `where_sql`) faqat **hardcoded SQL
fragment**lardan yig'iladi, foydalanuvchi qiymatlari esa SQLAlchemy
bound-parameters (`:o`, `:q`, `:cat`...) orqali uzatiladi.

Misol — [audit/router.py:40-74](../apps/api/app/modules/audit/router.py#L40-L74):

```python
where = ["a.organization_id = :o"]
if action:
    where.append("a.action = :a")
    params["a"] = action          # bound, not interpolated
where_sql = " AND ".join(where)   # only hardcoded fragments
await db.execute(text(f"... WHERE {where_sql} ..."), params)
```

SQL injection mavjud emas. Boshqa flagged routerlar ham xuddi shu pattern.

**Tavsiya:** kelajakda WHERE kompozitsiyasi uchun `from sqlalchemy import select`
+ ORM yondashuvi yoki helper funksiya (`build_where(filters)`) yozish
kod-style yaxshilanishi sifatida ko'rilishi mumkin, lekin xavfsizlik
nuqtai nazaridan zarur emas.

### 2 ta MD5 ([click.py:41, :51](../apps/api/app/modules/integration/payments/click.py#L41))

Click to'lov tizimi protokoli signatureni MD5 deb belgilab qo'ygan
(rasmiy hujjat):

```
sign_string = md5(click_trans_id + service_id + secret_key +
                  merchant_trans_id + amount + action + sign_time)
```

Parol uchun emas — webhook integrity verification. Algoritmni o'zgartirib
bo'lmaydi (provayder talabidir).

### Hardcoded passwords — test fixtures va labellar

| Fayl | Mazmun | Sabab |
|---|---|---|
| `apps/api/tests/test_auth.py:8,20` | `"Qa12345!"` | Test fixture, prod sir emas |
| `apps/api/tests/test_customer_portal.py:39,100` | `"Qa12345!"` | Test fixture |
| `apps/web/i18n/messages/en.json:200` | `"password": "Password"` | i18n form label ("Password" so'zi tarjima qilingan), sir emas |
| `docs/06-api-reference.md:296` | `curl` misol payload | Doc misoli, real credential emas |

### `0.0.0.0` bind ([apps/api/app/main.py:117](../apps/api/app/main.py#L117))

Docker container ichida `0.0.0.0` shart — `127.0.0.1` qilsa container
tashqarisidan ulanib bo'lmaydi. Port `127.0.0.1:8001:8000` shaklida host'da
bind qilinadi (`docker-compose.yml`'da), shu sabab tashqi exposure yo'q.

### 3 ta `SELECT *` (mobile/router.py:319, :327, :553)

Stylistic kuzatuv — tezkor xavfsizlik muammosi emas. Kerakli ustunlarni
sanab chiqish keyingi refaktoringda ko'riladi.

## Hozirgi audit balli holatiga ta'sir

- **HIGH 51 → ~3** (47 SQL FP + 2 MD5 FP minus, real haqiqiylari hammasi
  yopildi: 2 Dockerfile + 1 privileged + 1 rate-limit)
- **MEDIUM 3 → 1** (cache yo'qligi qoldi — arxitektura qarori, hozirgi
  yuklamada zarur emas)
- **LOW 21 → ~6** (timeout + console.log yopildi; test fixture'larida
  paroli qoldi)

## Keyingi qadamlar (ixtiyoriy)

- Cache layer: hot endpoint'larga Redis cache (foydalanuvchi ko'paysa)
- `slowapi` uchun Redis storage backend (multi-worker deploy uchun)
- SELECT * o'rniga aniq ustunlar (mobile router refaktoring)
