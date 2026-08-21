# Aniq ERP

Mustaqil ERP tizimi — FastAPI (Python 3.12) + Next.js 15 (App Router) + PostgreSQL 16 + Redis 7.

Modullar: finance, warehouse, sale, customer, supplier, manufacturing, hr, statistics, reference, settings.

## Loyiha tuzilishi

```
aniq-erp/
├── apps/
│   ├── api/                  # FastAPI (Python)
│   │   └── app/
│   │       ├── core/         # config, security, deps
│   │       ├── db/           # SQLAlchemy session
│   │       └── modules/      # auth, finance, warehouse, sale, ...
│   └── web/                  # Next.js 15
│       ├── app/
│       │   ├── (auth)/       # login, register
│       │   └── (dashboard)/  # dashboard + modullar
│       ├── components/layout/
│       └── lib/
├── infra/postgres/init.sql   # to'liq DDL + seed
├── docker-compose.yml
└── .env.example
```

## Tezkor ishga tushirish (Docker)

```powershell
cd D:\Docker\projects\erp
copy .env.example .env
# .env ichida SECRET_KEY ni o'zgartiring

docker compose up -d --build
```

Servislar:

| Servis    | URL                          | Login                       |
|-----------|------------------------------|-----------------------------|
| Web       | http://localhost:3010        | /register dan akkaunt yarat |
| API docs  | http://localhost:8001/docs   | —                           |
| pgAdmin   | http://localhost:5050        | admin@erp.local / admin     |
| Postgres  | localhost:5434               | erp / erp / erp             |

Birinchi marta ishga tushganda PostgreSQL `init.sql` ni avtomatik bajaradi (67 jadval, view'lar, seed).

Test ma'lumotlarini yuklash uchun:
```powershell
docker exec erp-api python -m app.db.seed_demo
```
Bu **Aniq Demo** tashkilot (code: `ANIQ`), 30 mahsulot, 50 mijoz va 5 test sotuv yaratadi.

## Lokal ishga tushirish (Docker-siz)

### Backend
```powershell
cd D:\Docker\projects\erp\apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend
```powershell
cd D:\Docker\projects\erp\apps\web
npm install --legacy-peer-deps
copy .env.example .env.local
npm run dev
```

## Modullar

| Modul          | Backend route prefix         | Frontend yo'l        |
|----------------|------------------------------|----------------------|
| Auth           | `/api/v1/auth`               | `/login`, `/register`|
| Organizations  | `/api/v1/organizations`      | (top-bar)            |
| Reference      | `/api/v1/reference`          | `/reference`         |
| Finance        | `/api/v1/finance`            | `/finance`           |
| Warehouse      | `/api/v1/warehouse`          | `/warehouse`         |
| Sale           | `/api/v1/sale`               | `/sale`              |
| Customer       | `/api/v1/customer`           | `/customer`          |
| Supplier       | `/api/v1/supplier`           | `/supplier`          |
| Manufacturing  | `/api/v1/manufacturing`      | `/manufacturing`     |
| HR             | `/api/v1/hr`                 | `/hr`                |
| Marketing      | `/api/v1/marketing`          | `/marketing`         |
| Statistics     | `/api/v1/statistics`         | `/statistics`        |
| Tools          | `/api/v1/tools`              | `/tools`             |
| Settings       | `/api/v1/settings`           | `/settings`          |
| Integration    | `/api/v1/integration`        | `/integration`       |

## Auth oqimi

1. `POST /api/v1/auth/register` — tashkilot + foydalanuvchi yaratadi, tokenlar qaytaradi
2. `POST /api/v1/auth/login` — `access_token` + `refresh_token`
3. Frontend ularni `localStorage` ga saqlaydi
4. Har request'da `Authorization: Bearer ...` + `X-Organization-Id: <uuid>` header'lari yuboriladi
5. 401 keldikda `/login` ga redirect

## Multi-organization

- Bitta foydalanuvchi bir nechta tashkilotga kira oladi (`user_organizations`)
- Aktiv tashkilot — `X-Organization-Id` header orqali
- Topbar dropdown'dan o'zgartirish mumkin

## Til

UI uchta tilda mavjud: **O'zbek (UZ)**, **Rus (RU)**, **Ingliz (EN)**.

i18n fayllar: `apps/web/i18n/messages/{uz,en,ru}.json`.

Default til — `uz`. Foydalanuvchi top-bar'dan o'zgartirishi mumkin (localStorage'da saqlanadi).

## Asosiy xususiyatlar (v1.0)

- ✅ **PDF chek** — A4 + termal 80mm + termal 58mm (reportlab + QR-kod)
- ✅ **Excel xlsx** — formatlanagn sarlavha, filter, frozen header, ko'p sheet
- ✅ **Audit log** — har POST/PUT/DELETE avto-log (middleware)
- ✅ **RBAC** — 67 ruxsat, 6 standart rol, sidebar avto-filter, 401/403
- ✅ **Telegram bot** — webhook + komandalar (/start, /balans, /sotuv)
- ✅ **AI assistent** — Claude/OpenAI + 6 ta read-only tool, demo rejim
- ✅ **Customer portal** — OTP SMS login, balans, sotuv tarixi, buyurtma
- ✅ **POS** — WebSerial barcode skaner + tarozi
- ✅ **Online to'lovlar** — Click + Payme webhook (merchant credentials kelganda live)
- ✅ **Test suite** — Pytest (29 backend), Playwright (E2E)
- ✅ **Production** — Sentry, Nginx + SSL, pg_dump backup, Prometheus + Grafana

Tafsilot: [ROADMAP.md](ROADMAP.md) va [DEPLOYMENT.md](DEPLOYMENT.md).

## Keyingi qadamlar

- [ ] Alembic — yangi migration'lar (baseline tayyor)
- [ ] SQLAlchemy ORM modellari (hozircha raw SQL)
- [ ] PWA — telefonga home screen install
- [ ] Soliq.uz E-invoice
- [ ] Bank API integratsiya
