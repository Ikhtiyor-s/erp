# 5. Dasturchi qo'llanmasi

ERP loyihasining texnik tafsiloti — arxitektura, deploy, kengaytirish.

## Mundarija

1. [Arxitektura](#arxitektura)
2. [Tech stack](#tech-stack)
3. [Loyiha tuzilishi](#loyiha-tuzilishi)
4. [Lokal rivojlanish](#lokal-rivojlanish)
5. [Yangi modul qo'shish](#yangi-modul-qoshish)
6. [Yangi sahifa qo'shish](#yangi-sahifa-qoshish)
7. [DB schema o'zgarishi](#db-schema-ozgarishi)
8. [i18n yangi tarjima](#i18n-yangi-tarjima)
9. [Deploy](#deploy)
10. [Test (kelajakda)](#test-kelajakda)

---

## Arxitektura

```
┌─────────────────────────────────────────────────┐
│                    BROWSER                      │
│              http://localhost:3010              │
└─────────────────┬───────────────────────────────┘
                  │
                  │ HTTP + JWT + X-Organization-Id
                  ▼
┌─────────────────────────────────────────────────┐
│         NEXT.JS 15 (Web)  port 3010             │
│  - App Router                                   │
│  - Tailwind CSS + next-themes + next-intl       │
│  - 152 ta page.tsx                              │
└─────────────────┬───────────────────────────────┘
                  │
                  │ API calls (axios)
                  ▼
┌─────────────────────────────────────────────────┐
│         FASTAPI (API)  port 8001                │
│  - SQLAlchemy 2 (raw SQL via text())            │
│  - 15 ta modul, 159 ta endpoint                 │
│  - JWT auth + multi-org isolation               │
└─────────────────┬───────────────────────────────┘
                  │
                  │ asyncpg
                  ▼
┌─────────────────────────────────────────────────┐
│        POSTGRES 16  port 5434                   │
│  - 67 ta jadval                                 │
│  - Multi-tenant (organization_id)               │
└─────────────────────────────────────────────────┘
```

### Multi-tenancy

- Har bir foydalanuvchi 1+ tashkilotga tegishli (`user_organizations` jadvali)
- Frontend hardar `X-Organization-Id: <uuid>` header yuboradi (localStorage'dan)
- Backend `get_current_org_id()` dependency orqali tekshiradi
- Barcha so'rovlar `WHERE organization_id = :o` bilan filtrlanadi

### Auth

- JWT Bearer tokens
- Access token: 60 daqiqa
- Refresh token: 30 kun
- `access_token` va `org_id` localStorage'da saqlanadi

---

## Tech stack

### Backend
| Komponent | Versiya | Tavsif |
|---|---|---|
| Python | 3.12 | Slim Docker image |
| FastAPI | 0.115.5 | Async REST API |
| SQLAlchemy | 2.0.36 | DB (raw SQL via `text()`) |
| asyncpg | 0.30.0 | PostgreSQL async driver |
| Pydantic | 2.10.3 | Validation |
| python-jose | latest | JWT |
| bcrypt | 4.x | Password hashing (passlib emas) |

### Frontend
| Komponent | Versiya | Tavsif |
|---|---|---|
| Next.js | 15.1.3 | App Router |
| React | 19.0.0 | |
| TypeScript | 5.x | |
| Tailwind CSS | 3.4.17 | `darkMode: 'class'` |
| next-intl | 3.26.5 | i18n (no routing) |
| next-themes | 0.4.4 | Dark mode |
| TanStack Query | 5.62.7 | Server state |
| react-hook-form | 7.54.1 | Forms |
| sonner | latest | Toast |
| lucide-react | latest | Icons |

### Infrastruktura
| Komponent | Port |
|---|---|
| PostgreSQL 16 | 5434:5432 |
| Redis 7 | 6380:6379 |
| pgAdmin | 5051:80 |

---

## Loyiha tuzilishi

```
D:\Docker\projects\erp\
├── apps/
│   ├── api/                          # FastAPI backend
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── config.py         # Sozlamalar (env'dan)
│   │   │   │   ├── deps.py           # get_db, get_current_user_id, get_current_org_id
│   │   │   │   └── security.py       # JWT, bcrypt
│   │   │   ├── db/
│   │   │   │   ├── session.py        # SQLAlchemy async engine
│   │   │   │   └── schema_patches.py # Idempotent DDL (startup'da)
│   │   │   ├── modules/              # 15 ta biznes modul
│   │   │   │   ├── auth/
│   │   │   │   ├── customer/
│   │   │   │   ├── finance/
│   │   │   │   ├── hr/
│   │   │   │   ├── manufacturing/
│   │   │   │   ├── marketing/
│   │   │   │   ├── organization/
│   │   │   │   ├── reference/
│   │   │   │   ├── sale/
│   │   │   │   ├── settings/
│   │   │   │   ├── statistics/
│   │   │   │   ├── supplier/
│   │   │   │   ├── tasks/
│   │   │   │   ├── tools/
│   │   │   │   └── warehouse/
│   │   │   └── main.py               # FastAPI app, router registration
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   └── web/                          # Next.js frontend
│       ├── app/
│       │   ├── (auth)/               # Login, register
│       │   ├── (dashboard)/          # 152 ta sahifa
│       │   │   ├── layout.tsx        # Sidebar + Topbar
│       │   │   ├── customer/...
│       │   │   ├── finance/...
│       │   │   └── ...
│       │   ├── globals.css
│       │   └── layout.tsx            # Root, providers
│       ├── components/
│       │   ├── ui/                   # DataTable, Modal, PageHeader, CommandPalette
│       │   ├── layout/               # Sidebar, Topbar
│       │   ├── reports/              # TurnoverReport, PeriodReport
│       │   └── settings/             # SettingsForm
│       ├── lib/
│       │   ├── api.ts                # axios client
│       │   ├── auth.ts               # JWT helpers
│       │   ├── menu.config.ts        # Sidebar konfigi
│       │   └── cn.ts                 # Tailwind class merger
│       ├── i18n/
│       │   ├── locale-provider.tsx
│       │   └── messages/             # uz.json, ru.json, en.json
│       ├── tailwind.config.ts
│       ├── package.json
│       └── Dockerfile
│
├── infra/postgres/init.sql           # DB schema (67 jadval)
├── docker-compose.yml
├── docs/                             # Bu hujjatlar
├── README.md
└── PROJECT_PLAN.md
```

---

## Lokal rivojlanish

### Docker bilan (tavsiya etiladi)

```powershell
cd D:\Docker\projects\erp
docker compose up -d
```

API kod o'zgartirilsa — restart kerak (volume mount bor):
```powershell
docker compose restart api
```

Frontend kod o'zgartirilsa — rebuild kerak:
```powershell
docker compose build web
docker compose up -d --force-recreate web
```

### Native (Docker'siz)

**Backend:**
```powershell
cd D:\Docker\projects\erp\apps\api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
$env:DATABASE_URL = "postgresql+asyncpg://erp:erp@localhost:5434/erp"
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```powershell
cd D:\Docker\projects\erp\apps\web
npm install
npm run dev  # port 3000
```

---

## Yangi modul qo'shish

Misol: `notifications` moduli qo'shish.

### 1. Backend modul yaratish

```powershell
mkdir D:\Docker\projects\erp\apps\api\app\modules\notifications
```

`__init__.py`:
```python
```

`router.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db, get_current_org_id

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, title, body, is_read, created_at "
             "FROM notifications WHERE organization_id = :o "
             "ORDER BY created_at DESC LIMIT 100"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]
```

### 2. main.py'ga ulang

```python
from app.modules.notifications.router import router as notif_router
# ...
app.include_router(notif_router, prefix=API_PREFIX)
```

### 3. Schema patch qo'shing

`apps/api/app/db/schema_patches.py` — `PATCHES` ro'yxatiga:
```python
"""
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
)
"""
```

### 4. API restart

```powershell
docker compose restart api
```

Schema avtomatik qo'llaniladi, endpoint tayyor: `GET /api/v1/notifications`.

### 5. Frontend sahifa qo'shing

Pastdagi "Yangi sahifa qo'shish" bo'limiga qarang.

### 6. Sidebar menyusiga qo'shish

`apps/web/lib/menu.config.ts` — `menuTree` ga yangi guruh:
```ts
{
  key: "notifications",
  label: "Bildirishnomalar",
  icon: Bell,
  href: "/notifications",
},
```

`apps/web/i18n/messages/uz.json` (va ru.json, en.json) ga `nav.notifications` qo'shing.

---

## Yangi sahifa qo'shish

Misol: `/notifications` sahifa.

### 1. Fayl yaratish

```powershell
mkdir D:\Docker\projects\erp\apps\web\app\`(dashboard`)\notifications
```

`page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

type Notif = { id: string; title: string; body?: string; created_at: string };

export default function NotificationsPage() {
  const [rows, setRows] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Notif[]>("/notifications")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const cols: Column<Notif>[] = [
    { key: "title", header: "Sarlavha" },
    { key: "body", header: "Matn" },
    { key: "created_at", header: "Vaqt",
      render: (r) => new Date(r.created_at).toLocaleString("ru-RU") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Bildirishnomalar" description="Tizim xabarlari" />
      <DataTable columns={cols} rows={rows} loading={loading} />
    </div>
  );
}
```

### 2. Rebuild

```powershell
docker compose build web
docker compose up -d --force-recreate web
```

---

## DB schema o'zgarishi

### Yangi jadval

`apps/api/app/db/schema_patches.py` — PATCHES'ga qo'shing:
```python
"""
CREATE TABLE IF NOT EXISTS my_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
)
"""
```

API restart — avtomatik qo'llaniladi.

### Mavjud jadvalga ustun qo'shish

```python
"""ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT"""
```

### O'chirish (DESTRUCTIVE — ehtiyot bo'ling!)

Schema patches o'chirmaslik kerak. Faqat alohida migration script yozing va qo'lda qo'llang.

---

## i18n yangi tarjima

### Kalit qo'shish

`apps/web/i18n/messages/uz.json` (va ru, en):
```json
{
  "nav": {
    "my_module": "Mening modulim"
  },
  "common": {
    "new_field": "Yangi maydon"
  }
}
```

### Sahifada ishlatish

```tsx
import { useTranslations } from "next-intl";

export default function MyPage() {
  const t = useTranslations("common");
  return <h1>{t("new_field")}</h1>;
}
```

---

## Deploy

### Production deploy (Nginx + HTTPS)

1. **Domen** — `erp.example.com` ga A-record qo'ying
2. **Docker Compose'ni production'ga moslang:**
   - `docker-compose.prod.yml` yarating
   - `ports` ni `expose` ga o'tkazing
   - Nginx reverse proxy qo'shing
3. **Letsencrypt SSL**:
   ```yaml
   nginx:
     image: nginx:alpine
     ports: ["80:80", "443:443"]
     volumes:
       - ./nginx.conf:/etc/nginx/nginx.conf
       - /etc/letsencrypt:/etc/letsencrypt:ro
   ```
4. **`.env` faylda**:
   ```
   SECRET_KEY=<random-32-chars>
   ENV=production
   CORS_ORIGINS=https://erp.example.com
   ```

### CI/CD (kelajakda)

GitHub Actions misol:
```yaml
- run: docker compose build
- run: docker compose up -d
```

---

## Test (kelajakda)

Hozir avtomatik testlar yo'q. Reja:

### Backend
- **pytest** + `pytest-asyncio`
- `tests/test_auth.py`, `tests/test_customer.py` va h.k.
- TestClient orqali endpoint'larni sinash

### Frontend
- **Playwright** — E2E
- **Vitest** — komponent testlari
