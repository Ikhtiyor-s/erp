# DESIGN-3 — Sprint 4 Architecture Design
**Date:** 2026-08-26
**Author:** Architect agent
**Status:** FROZEN (API contract section)
**Covers tickets:** T-100..T-142

---

## 1. Executive Summary

Sprint 4 qo'shadi: IntegrationBase unification framework (T-100), MXIK katalog (T-101), WebAuthn biometric auth (T-104), 10 ta integration scaffold (T-110..T-114, T-120..T-123), Telegram bot inbound commands (T-123), Integration Hub frontend (T-130), va 9 ta boshqa frontend feature. Uchta arxitektura qarori muzlatildi: WebAuthn challenge uchun **Variant A** (PostgreSQL temp jadval, Redis yo'q), Integration framework uchun **yangi `integrations` `app_settings` key** (mavjud jadval kengaytiriladi), Telegram bind uchun **Variant B** (token-based binding). Mavjud Click/Payme/Telegram/Eskiz flow'lar o'zgartirilmaydi.

---

## 2. Stack

Loyiha mavjud stacki ishlatiladi — yangi dependency kiritilmaydi:

| Qatlam | Texnologiya |
|---|---|
| Backend | FastAPI 0.115 + SQLAlchemy 2.0 async + asyncpg + Pydantic 2 |
| Encryption | `app.core.secret_box` (mavjud Fernet) |
| DB | PostgreSQL 16, `app_settings` JSONB (mavjud jadval, `key='integrations'`) |
| Frontend | Next.js 15 App Router + React + TypeScript + Tailwind |
| Barcode scan | `BarcodeDetector` Web API (native) + `@zxing/library` fallback |
| Barcode print | `jsbarcode` + `jspdf` (yangi npm) |
| WebAuthn | `navigator.credentials` Web API (native, no npm) |
| HTTP client | `axios` (mavjud) |
| Icons | `lucide-react` (mavjud) |

**Yangi npm paketlar (frontend only):** `jsbarcode`, `jspdf`, `@zxing/library`

---

## 3. File / Folder Layout

```
apps/api/app/modules/
  integration/
    base.py                        # NEW — IntegrationBase abstract class (T-100)
    registry.py                    # NEW — INTEGRATION_REGISTRY dict (T-100)
    integrations_router.py         # NEW — /integrations/* CRUD endpoints (T-100)
    services/
      alif.py                      # NEW — AlifService(IntegrationBase) (T-110)
      uzum.py                      # NEW — UzumService (T-111)
      multicard.py                 # NEW — MulticardService (T-112)
      rahmat.py                    # NEW — RahmatService (T-113)
      didox.py                     # NEW — DidoxService (T-120)
      yandex_delivery.py           # NEW — YandexDeliveryService (T-121)
      bts_delivery.py              # NEW — BTSDeliveryService (T-122)
  auth/
    webauthn_router.py             # NEW — /auth/webauthn/* endpoints (T-104)
  reference/
    mxik_router.py                 # NEW — /reference/mxik/search (T-101)
  finance/
    export_1c_router.py            # NEW — /finance/export/1c-csv, 1c-xml (T-105)
    debtors_sms_router.py          # NEW — /finance/debtors/{id}/send-sms (T-132)

apps/api/app/db/schema_patches.py  # EXTEND — 4 yangi PATCH blok qo'shiladi

apps/web/app/(dashboard)/
  integrations/
    page.tsx                       # NEW — Integration Hub (T-130)
  settings/
    online-payments/page.tsx       # EXTEND — Alif/Uzum/Multicard/Rahmat (T-115)
    didox/page.tsx                 # NEW (T-124)
    delivery/page.tsx              # NEW — Yandex + BTS (T-125)
    1c-export/page.tsx             # NEW (T-126)
    crm/page.tsx                   # EXTEND — Telegram commands section (T-127)
  products/page.tsx                # EXTEND — MXIK combobox + barcode print (T-133, T-135)
  warehouse/
    pick/page.tsx                  # EXTEND — barcode scan (T-134)

apps/web/app/m/
  finance/debtors/
    page.tsx                       # NEW — mobile debtor list (T-131)
    [id]/page.tsx                  # NEW — mobile debtor detail (T-131)
  login/page.tsx                   # EXTEND — biometric button (T-104)

apps/web/components/
  barcode/
    scanner.tsx                    # NEW — BarcodeDetector + ZXing fallback (T-102)
    label-print.tsx                # NEW — JsBarcode + jsPDF (T-103)
  integrations/
    IntegrationCard.tsx            # NEW — reusable card for Hub (T-130)

apps/web/lib/
  biometric.ts                     # NEW — WebAuthn helpers (T-104)

apps/web/i18n/messages/
  kaa.json                         # NEW — Karakalpak locale (T-106)
```

---

## 4. WebAuthn Challenge Storage — Variant A (T-104)

**Tanlangan variant: A — PostgreSQL temp jadval.**

Redis app kod'ida ulanmagan (tekshirildi: `apps/api/app/core/redis*.py` fayl topilmadi). In-memory dict (Variant C) multi-worker muhitida ishlamaydi. Shuning uchun PostgreSQL temp jadval optimaldir.

### 4.1 DDL

```sql
-- schema_patches.py ga qo'shiladi (Sprint 4 patch bloki)
CREATE TABLE IF NOT EXISTS user_webauthn_challenges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge   BYTEA NOT NULL,           -- 32-byte random, base64url encoded on read
    purpose     VARCHAR(20) NOT NULL,     -- 'register' | 'login'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user
    ON user_webauthn_challenges(user_id, created_at);
```

```sql
-- Rollback
DROP TABLE IF EXISTS user_webauthn_challenges;
```

### 4.2 TTL Enforcement

TTL = 5 daqiqa. Enforcement **ikki qatlamli**:

1. **Read-time check**: `finish` endpointlari `created_at > NOW() - INTERVAL '5 minutes'` filtri bilan challenge qidiradi. Eski challenge "not found" qaytaradi — replay attack imkonsiz.
2. **Lazy cleanup**: har `begin` chaqiruvida shu `user_id` uchun eski challengelar o'chiriladi:
   ```sql
   DELETE FROM user_webauthn_challenges
   WHERE user_id = :uid AND created_at < NOW() - INTERVAL '5 minutes';
   ```

Cron scheduler kerak emas — lazy cleanup yetarli.

### 4.3 WebAuthn Credential Storage

Ro'yxatdan o'tgan credential (public key, credential_id) `app_settings` JSONB'da saqlanadi — `key='webauthn'`:

```json
{
  "credentials": [
    {
      "credential_id": "base64url...",
      "public_key": "base64url...",
      "sign_count": 0,
      "registered_at": "2026-08-26T00:00:00Z",
      "device_name": "Android Chrome"
    }
  ]
}
```

### 4.4 Endpoint Flow

#### POST /auth/webauthn/register/begin
```
Given: logged-in user (JWT required)
When: POST /auth/webauthn/register/begin
Then:
  - 32-byte random challenge yaratiladi (secrets.token_bytes(32))
  - user_webauthn_challenges'ga INSERT (purpose='register')
  - HTTP 200 + PublicKeyCredentialCreationOptions qaytadi
```

Request: `{}` (body yo'q)

Response `200`:
```json
{
  "challenge": "base64url_encoded_32_bytes",
  "rp": { "name": "Aniq ERP", "id": "yourdomain.uz" },
  "user": { "id": "base64url_user_uuid", "name": "user@email.uz", "displayName": "Full Name" },
  "pubKeyCredParams": [
    { "type": "public-key", "alg": -7 },
    { "type": "public-key", "alg": -257 }
  ],
  "timeout": 60000,
  "attestation": "none",
  "authenticatorSelection": {
    "authenticatorAttachment": "platform",
    "userVerification": "required"
  }
}
```

Response `401`: `{"detail": "Not authenticated"}`

---

#### POST /auth/webauthn/register/finish
```
Given: user holds valid challenge (< 5 min)
When: POST /auth/webauthn/register/finish with credential
Then:
  - challenge DB'dan olinadi (purpose='register', < 5 min)
  - Verify: clientDataJSON.challenge matches, origin matches
  - credential app_settings['webauthn']['credentials'] ga qo'shiladi
  - challenge DB'dan o'chiriladi
  - HTTP 200
```

Request:
```json
{
  "credential_id": "base64url...",
  "client_data_json": "base64url...",
  "attestation_object": "base64url...",
  "device_name": "Android Chrome"
}
```

Response `200`: `{"ok": true}`
Response `400`: `{"detail": "Challenge topilmadi yoki muddati o'tgan"}`
Response `400`: `{"detail": "Verification xatosi: <reason>"}`

**MUHIM:** Sprint 4'da server-side attestation verification to'liq (cryptographic) bo'lmaydi — `challenge` matching va `origin` check amalga oshiriladi, `authData` signature verification — Out of Scope (SPEC-3.md'da keltirilgan). Backend primitive check qiladi; real security WebAuthn library kerak bo'lsa keyingi sprintda qo'shiladi.

---

#### POST /auth/webauthn/login/begin
```
Given: unauthenticated user (email required)
When: POST /auth/webauthn/login/begin
Then:
  - user_id email orqali topiladi
  - challenge yaratiladi (purpose='login')
  - HTTP 200 + PublicKeyCredentialRequestOptions
```

Request:
```json
{ "email": "user@example.uz" }
```

Response `200`:
```json
{
  "challenge": "base64url...",
  "timeout": 60000,
  "rpId": "yourdomain.uz",
  "allowCredentials": [
    { "type": "public-key", "id": "base64url_credential_id", "transports": ["internal"] }
  ],
  "userVerification": "required"
}
```

Response `404`: `{"detail": "Foydalanuvchi topilmadi"}`
Response `400`: `{"detail": "Biometric ro'yxatdan o'tilmagan"}`

---

#### POST /auth/webauthn/login/finish
```
Given: valid assertion from authenticator
When: POST /auth/webauthn/login/finish
Then:
  - challenge tekshiriladi (< 5 min, purpose='login')
  - credential_id bo'yicha stored public key topiladi
  - sign_count anti-replay check (stored_count < assertion_count)
  - sign_count yangilanadi
  - JWT access + refresh token qaytariladi (mavjud TokenPair schema)
```

Request:
```json
{
  "email": "user@example.uz",
  "credential_id": "base64url...",
  "client_data_json": "base64url...",
  "authenticator_data": "base64url...",
  "signature": "base64url...",
  "user_handle": "base64url..."
}
```

Response `200`:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

Response `400`: `{"detail": "Challenge muddati o'tgan"}`
Response `401`: `{"detail": "Biometric verification xatosi"}`

---

## 5. Integration Framework API (FROZEN) — T-100, T-130

### 5.1 app_settings Sxemasi

Mavjud `app_settings` jadvali kengaytiriladi — `key='integrations'` yangi entry:

```json
{
  "alif": {
    "enabled": false,
    "merchant_id": "fernet:...",
    "api_key": "fernet:...",
    "sandbox_url": "https://alifpay.uz/sandbox"
  },
  "uzum": {
    "enabled": false,
    "client_id": "fernet:...",
    "client_secret": "fernet:..."
  },
  "multicard": {
    "enabled": false,
    "api_key": "fernet:...",
    "terminal_id": "fernet:..."
  },
  "rahmat": {
    "enabled": false,
    "merchant_token": "fernet:...",
    "secret": "fernet:..."
  },
  "didox": {
    "enabled": false,
    "stir": "...",
    "token": "fernet:..."
  },
  "yandex_delivery": {
    "enabled": false,
    "oauth_token": "fernet:...",
    "sender_id": "..."
  },
  "bts_delivery": {
    "enabled": false,
    "api_key": "fernet:...",
    "account_id": "..."
  },
  "bill_payment": {
    "enabled": false
  }
}
```

Yangi `organization_settings` jadvali kerak emas — `app_settings` yetarli.

### 5.2 IntegrationBase Abstract Class Skeleton

```python
# apps/api/app/modules/integration/base.py
from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import AsyncSession

class IntegrationBase(ABC):
    code: str           # e.g. "alif"
    name: str           # e.g. "Alif Bank"
    category: str       # payment | delivery | e_invoice | accounting | communication
    credentials_required: bool

    def __init__(self, db: AsyncSession, org_id: str):
        self.db = db
        self.org_id = org_id

    @abstractmethod
    async def test_connection(self) -> dict:
        """Returns {"ok": bool, "error": str | None}"""
        ...

    @abstractmethod
    async def get_public_config(self) -> dict:
        """Returns config with secrets sensored: last 4 chars visible, rest '***'"""
        ...

    @abstractmethod
    async def save_config(self, payload: dict) -> None:
        """Encrypts secret fields, saves to app_settings JSONB key='integrations'"""
        ...

    async def get_raw_config(self) -> dict:
        """Reads and decrypts config from app_settings. Shared implementation."""
        ...

    async def set_enabled(self, enabled: bool) -> None:
        """Toggle enabled flag. Shared implementation."""
        ...
```

### 5.3 Registry

```python
# apps/api/app/modules/integration/registry.py
INTEGRATION_REGISTRY: dict[str, type[IntegrationBase]] = {
    "alif":             AlifService,
    "uzum":             UzumService,
    "multicard":        MulticardService,
    "rahmat":           RahmatService,
    "bill_payment":     BillPaymentService,
    "didox":            DidoxService,
    "yandex_delivery":  YandexDeliveryService,
    "bts_delivery":     BTSDeliveryService,
    "telegram":         TelegramIntegration,   # wraps existing telegram.py
    "eskiz":            EskizIntegration,       # wraps existing eskiz.py
    "click":            ClickIntegration,       # wraps existing click
    "payme":            PaymeIntegration,       # wraps existing payme
    "barcode":          BarcodeIntegration,     # no external API, always ok
    "1c_export":        OneCExportIntegration,  # no external API
    "mxik":             MxikIntegration,        # no external API
}
```

### 5.4 FROZEN API Endpoints (10 endpoint)

Prefix: `/api/v1/integrations` (yangi router, mavjud `/integration` prefix'dan alohida)

---

#### GET /integrations
Barcha integratsiyalar ro'yxati.

Response `200`:
```json
[
  {
    "code": "alif",
    "name": "Alif Bank",
    "category": "payment",
    "description": "Alif Bank toʻlov tizimi",
    "enabled": false,
    "credentials_required": true,
    "configured": false,
    "status": "not_configured"
  }
]
```

`status` qiymatlari: `"not_configured"` | `"configured"` | `"active"` | `"error"`

---

#### GET /integrations/{code}
Bitta integratsiya konfiguratsiyasi (secrets sensored).

Response `200`:
```json
{
  "code": "alif",
  "name": "Alif Bank",
  "category": "payment",
  "enabled": false,
  "credentials_required": true,
  "configured": true,
  "config": {
    "merchant_id": "***5abc",
    "api_key": "***ef12",
    "sandbox_url": "https://alifpay.uz/sandbox"
  }
}
```

Response `404`: `{"detail": "Integration topilmadi"}`

---

#### PUT /integrations/{code}
Konfiguratsiyani saqlash. Secret fieldlar `secret_box.encrypt` bilan shifrlanadi.

Request:
```json
{
  "merchant_id": "12345",
  "api_key": "my-secret-key",
  "sandbox_url": "https://..."
}
```

Response `200`: `{"ok": true}`
Response `404`: `{"detail": "Integration topilmadi"}`
Response `422`: Validation error

---

#### POST /integrations/{code}/test
Aloqa sinovi.

Request: `{}` (body yo'q yoki ixtiyoriy overrides)

Response `200`:
```json
{
  "ok": true,
  "message": "Ulanish muvaffaqiyatli",
  "latency_ms": 142
}
```

Response `200` (xato holat ham 200 — frontend error toast ko'rsatadi):
```json
{
  "ok": false,
  "message": "API key noto'g'ri yoki xizmat mavjud emas",
  "latency_ms": null
}
```

Response `400`: `{"detail": "Konfiguratsiya to'liq emas"}`

---

#### POST /integrations/{code}/enable

Request: `{}` (body yo'q)

Response `200`: `{"ok": true, "enabled": true}`
Response `400`: `{"detail": "Konfiguratsiya to'liq emas — avval sozlang"}`
Response `404`: `{"detail": "Integration topilmadi"}`

---

#### POST /integrations/{code}/disable

Request: `{}` (body yo'q)

Response `200`: `{"ok": true, "enabled": false}`
Response `404`: `{"detail": "Integration topilmadi"}`

---

#### GET /integrations/status (T-130 Hub uchun — Wave 4D)
Barcha integratsiyalar uchun yengil status endpoint (Hub sahifasi uchun).

Response `200`:
```json
{
  "alif": "not_configured",
  "uzum": "configured",
  "multicard": "not_configured",
  "rahmat": "not_configured",
  "bill_payment": "active",
  "didox": "not_configured",
  "yandex_delivery": "not_configured",
  "bts_delivery": "not_configured",
  "telegram": "active",
  "eskiz": "active",
  "click": "active",
  "payme": "not_configured",
  "barcode": "active",
  "1c_export": "active",
  "mxik": "active"
}
```

---

**Jami FROZEN endpoint soni: 7** (`GET /integrations`, `GET /integrations/{code}`, `PUT /integrations/{code}`, `POST /integrations/{code}/test`, `POST /integrations/{code}/enable`, `POST /integrations/{code}/disable`, `GET /integrations/status`)

### 5.5 TypeScript Interfaces (frontend T-130 uchun)

```typescript
// apps/web/lib/types/integrations.ts

export type IntegrationStatus =
  | "not_configured"
  | "configured"
  | "active"
  | "error";

export type IntegrationCategory =
  | "payment"
  | "delivery"
  | "e_invoice"
  | "accounting"
  | "communication"
  | "tools";

export interface IntegrationInfo {
  code: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  enabled: boolean;
  credentials_required: boolean;
  configured: boolean;
  status: IntegrationStatus;
}

export interface IntegrationConfig {
  code: string;
  name: string;
  category: IntegrationCategory;
  enabled: boolean;
  credentials_required: boolean;
  configured: boolean;
  config: Record<string, string>;  // sensored values: "***5abc"
}

export interface TestResult {
  ok: boolean;
  message: string;
  latency_ms: number | null;
}

export interface StatusMap {
  [code: string]: IntegrationStatus;
}
```

**Frontend → Backend deserialization trace:**

`GET /integrations` → `IntegrationInfo[]` — barcha fieldlar optional emas, type match qiladi.
`GET /integrations/{code}` → `IntegrationConfig` — `config` `Record<string, string>` sifatida parse qilinadi, sensored string qiymatlar mos keladi.
`POST /integrations/{code}/test` → `TestResult` — `latency_ms: number | null` Python `None` → JSON `null` mos keladi.

---

## 6. Integration Categories Matrix

| Kod | Kategoriya | Tashqi credentials | Real API yoki Scaffold |
|---|---|---|---|
| `alif` | payment | Ha — Merchant ID, API key | Scaffold |
| `uzum` | payment | Ha — Client ID, Secret | Scaffold |
| `multicard` | payment | Ha — API key, terminal_id | Scaffold |
| `rahmat` | payment | Ha — merchant_token, secret | Scaffold |
| `bill_payment` | payment | Yo'q (mavjud Click) | Real (Click API kengaytirish) |
| `click` | payment | Ha — merchant_id, secret | Real (mavjud) |
| `payme` | payment | Ha — merchant_id, secret | Real (mavjud) |
| `didox` | e_invoice | Ha — STIR, token | Scaffold |
| `yandex_delivery` | delivery | Ha — OAuth token, sender_id | Scaffold |
| `bts_delivery` | delivery | Ha — API key, account_id | Scaffold |
| `telegram` | communication | Ha — bot_token (mavjud) | Real (mavjud + kengaytirish) |
| `eskiz` | communication | Ha — email, password (mavjud) | Real (mavjud) |
| `barcode` | tools | Yo'q (browser API) | Real |
| `1c_export` | accounting | Yo'q (offline format) | Real |
| `mxik` | tools | Yo'q (CSV seed) | Real |

---

## 7. Telegram Bot Command Auth — Variant B (T-123)

**Tanlangan variant: B — `/start ORG_TOKEN` bilan bind qilish.**

Variant A'da `users.telegram_chat_id` field yetarli emas — bir foydalanuvchi bir nechta org'da bo'lishi mumkin, org konteksti yo'qoladi. Variant C murakkab. Variant B — org + user biriktirish uchun eng xavfsiz va oddiy yondashuv.

### 7.1 DDL

```sql
-- schema_patches.py ga qo'shiladi
CREATE TABLE IF NOT EXISTS user_telegram_bindings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chat_id     BIGINT NOT NULL,
    telegram_username VARCHAR(100),
    bound_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (user_id, org_id),
    UNIQUE (chat_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_tg_bindings_chat_org
    ON user_telegram_bindings(chat_id, org_id);

-- Bind token (temp): users jadvali kengaytiriladi
ALTER TABLE users ADD COLUMN IF NOT EXISTS
    tg_bind_token   VARCHAR(64),
    tg_bind_token_at TIMESTAMPTZ;
-- Token TTL = 15 daqiqa, `tg_bind_token_at > NOW() - INTERVAL '15 minutes'` check
```

```sql
-- Rollback
DROP TABLE IF EXISTS user_telegram_bindings;
ALTER TABLE users DROP COLUMN IF EXISTS tg_bind_token;
ALTER TABLE users DROP COLUMN IF EXISTS tg_bind_token_at;
```

### 7.2 Bind Flow

```
1. Foydalanuvchi web'da Settings → CRM → "Telegramga ulash" tugmasini bosadi
2. POST /auth/telegram/bind/generate → backend:
   - secrets.token_urlsafe(32) yaratadi
   - users.tg_bind_token = token, tg_bind_token_at = NOW()
   - Response: {"token": "abc123...", "bot_username": "@aniqerp_bot",
                "deep_link": "https://t.me/aniqerp_bot?start=abc123..."}
3. Foydalanuvchi deep_link'ni bosadi yoki botga /start abc123... yozadi
4. Telegram bot /start handler:
   - token extraction
   - SELECT users WHERE tg_bind_token = :t AND tg_bind_token_at > NOW() - INTERVAL '15 min'
   - Topilsa: user_telegram_bindings'ga INSERT (user_id, org_id, chat_id)
   - users.tg_bind_token = NULL (invalidate)
   - Bot javob: "✅ Ulandi! Siz endi /buyurtma, /qoldiq, /balans dan foydalanishingiz mumkin."
5. Web sahifa polling yoki foydalanuvchi reload orqali tekshiradi:
   GET /auth/telegram/bind/status → {"bound": true, "chat_id": 12345678}
```

**Xavfsizlik:**
- Token 15 daqiqa TTL (lazy cleanup: generate qilganda eski token muddati tekshiriladi)
- Token bir martalik — bind qilinganidan keyin NULL
- `UNIQUE (user_id, org_id)` — bir foydalanuvchi faqat bitta chat bind qilishi mumkin (rebind kerak bo'lsa avval unbind)

### 7.3 Command Dispatch Pattern

Mavjud `telegram_webhook` handler kengaytiriladi:

```python
# Mavjud flow: org_code → org_id → chat_id → body

# Yangi step: chat_id → user lookup
binding_res = await db.execute(
    text("""
        SELECT b.user_id, b.org_id, u.full_name, u.id as uid
        FROM user_telegram_bindings b
        JOIN users u ON u.id = b.user_id
        WHERE b.chat_id = :c AND b.org_id = :o AND b.is_active = TRUE
    """),
    {"c": chat_id, "o": org_id},
)
binding = binding_res.first()
# binding yo'q bo'lsa: mavjud public commands (/start, /yordam) ishlaydi
# binding bo'lsa: authenticated commands ishlaydi
```

**Command routing:**

| Command | Auth kerakmi | Query | Response |
|---|---|---|---|
| `/start [token]` | Yo'q | bind flow | Bind confirm yoki help |
| `/yordam` | Yo'q | — | Command list |
| `/balans` | Ha | `cashboxes WHERE org_id` | Kassalar qoldig'i |
| `/buyurtma [raqam]` | Ha | `sales WHERE org_id AND doc_number` | Sotuv tafsiloti |
| `/qoldiq [mahsulot]` | Ha | `stock_entries WHERE org_id AND product ILIKE` | Qoldiq raqami |
| `/unbind` | Ha | `user_telegram_bindings SET is_active=FALSE` | Unbind confirm |

**Mavjud `/sotuv` command:** `/buyurtma` bilan bir xil mantiq, `/sotuv` ham qoladi (backward compat).

### 7.4 Xavfsizlik

- **Rate limit:** `/auth/telegram/bind/generate` — 3/hour (limiter orqali)
- **Command rate limit:** inline check — 10 req/min per chat_id (in-memory counter acceptable, single webhook worker)
- **Spam guard:** binding yo'q chat'lardan faqat `/start` va `/yordam` ishlaydi, boshqa buyruqlarga: "Botni ulash uchun Aniq ERP'da Settings → CRM bo'limiga o'ting."
- **Unbind endpoint:** `POST /auth/telegram/bind/unbind` — JWT auth kerak, `is_active = FALSE`

### 7.5 Yangi Auth Endpointlar (T-123)

#### POST /auth/telegram/bind/generate
JWT auth kerak.

Response `200`:
```json
{
  "token": "abc123xyz...",
  "bot_username": "@aniqerp_bot",
  "deep_link": "https://t.me/aniqerp_bot?start=abc123xyz...",
  "expires_in_seconds": 900
}
```

#### GET /auth/telegram/bind/status
JWT auth kerak.

Response `200`:
```json
{
  "bound": true,
  "chat_id": 1234567890,
  "telegram_username": "@username",
  "bound_at": "2026-08-26T10:00:00Z"
}
```
yoki `{"bound": false}`

#### POST /auth/telegram/bind/unbind
JWT auth kerak.

Response `200`: `{"ok": true}`

---

## 8. Qo'shimcha FROZEN Endpointlar

### 8.1 MXIK Search (T-101)

#### GET /reference/mxik/search

Query params: `q` (string, min 2 char), `limit` (int, default 20, max 100)

Response `200`:
```json
[
  {
    "code": "01021000001000000",
    "name": "Mol go'shti, suyakli, muzlatilmagan",
    "group_name": "Go'sht va go'sht mahsulotlari",
    "unit": "KG"
  }
]
```

### 8.2 1C Export (T-105)

#### GET /finance/export/1c-csv
Query params: `date_from` (ISO date), `date_to` (ISO date), `include` (comma-separated: `sales,cash,customers`)
Response: `200 text/csv; Content-Disposition: attachment; filename="1c_export_YYYYMMDD.csv"`

#### GET /finance/export/1c-xml
Same params.
Response: `200 application/xml; Content-Disposition: attachment; filename="1c_export_YYYYMMDD.xml"`

### 8.3 SMS Reminder (T-132)

#### POST /finance/debtors/{customer_id}/send-sms

Request:
```json
{
  "message_template": "custom" | "default",
  "custom_text": "Hurmatli mijoz, qarzingiz: {amount} so'm"
}
```

Response `200`: `{"ok": true, "phone": "+998901234567", "sent_at": "2026-08-26T..."}`
Response `404`: `{"detail": "Mijoz topilmadi"}`
Response `400`: `{"detail": "SMS sozlanmagan (Eskiz credentials yo'q)"}`

### 8.4 Bill Payment (T-114)

#### POST /finance/bill-payment

Request:
```json
{
  "account_number": "12345678",
  "amount": 50000.00,
  "service_code": "electric" | "gas" | "water" | "internet",
  "cashbox_id": "uuid"
}
```

Response `200`:
```json
{
  "ok": true,
  "transaction_id": "click_tx_id",
  "provider_reference": "..."
}
```

Response `400`: `{"detail": "Click sozlanmagan"}`
Response `422`: Validation error

---

## 9. Data Model Summary — Sprint 4 Yangi Jadvallar/Ustunlar

| Jadval / Ustun | Maqsad | Ticket |
|---|---|---|
| `user_webauthn_challenges` (yangi jadval) | WebAuthn one-time challenge TTL storage | T-104 |
| `user_telegram_bindings` (yangi jadval) | Telegram chat_id ↔ user+org mapping | T-123 |
| `users.tg_bind_token` (yangi ustun) | 15-min bind token (temp, one-time) | T-123 |
| `users.tg_bind_token_at` (yangi ustun) | Token yaratilgan vaqt (TTL enforcement) | T-123 |
| `app_settings` key=`'integrations'` (yangi entry) | IntegrationBase configs per org (JSONB) | T-100 |
| `app_settings` key=`'webauthn'` (yangi entry) | WebAuthn registered credentials per user | T-104 |
| `mxik_products` (yangi jadval) | MXIK katalog (organization_id yo'q — global ref) | T-101 |

### mxik_products DDL

```sql
CREATE TABLE IF NOT EXISTS mxik_products (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(30) NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    group_code  VARCHAR(20),
    group_name  TEXT,
    unit        VARCHAR(20),
    is_active   BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_mxik_name_search ON mxik_products USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_mxik_code ON mxik_products(code);
```

**ESLATMA:** `mxik_products` global reference jadval — `organization_id` yo'q (multi-tenant qoidasidan istisno, reference ma'lumot uchun ruxsat berilgan, CLAUDE.md §1 faqat "domain tables" uchun).

---

## 10. Migration Compatibility — Mavjud Systemlar Sindirilmasin

| Mavjud komponent | Sprint 4 ta'siri | Xavfsizlik chorasi |
|---|---|---|
| `POST /integration/click/webhook/{org_code}` | O'zgartirilmaydi | router.py to'g'ridan-to'g'ri saqlanadi |
| `POST /integration/payme/webhook/{org_code}` | O'zgartirilmaydi | — |
| `POST /integration/telegram/webhook/{org_code}` | EXTEND — command dispatcher qo'shiladi | Mavjud `/balans`, `/sotuv`, `/yordam`, `/start` command'lar _avval_ ishlaydi; binding check keyinroq |
| `POST /integration/telegram/test` | O'zgartirilmaydi | — |
| `POST /integration/telegram/send` | O'zgartirilmaydi | — |
| `app_settings` key=`'crm'` | O'zgartirilmaydi (telegram token bu yerda) | `_read_crm_settings()` saqlanadi |
| `app_settings` key=`'online_payments'` | O'zgartirilmaydi (Click/Payme) | yangi providers `key='integrations'` da |
| `Eskiz.send_sms()` | To'g'ridan-to'g'ri chaqiriladi, wrapper qo'shiladi | mavjud imzo o'zgarmaydi |

**Muhim:** Yangi `/api/v1/integrations/*` router mavjud `/api/v1/integration/*` router bilan parallel ishlaydi. Ikkisi bir vaqtda `main.py`'ga include qilinadi.

---

## 11. RBAC Permissions — Sprint 4 Yangilash

`apps/api/app/modules/rbac/permissions.py`'ga qo'shilishi kerak:

```
integrations.view    — GET /integrations, GET /integrations/{code}
integrations.edit    — PUT /integrations/{code}, POST /integrations/{code}/test
integrations.toggle  — POST /integrations/{code}/enable | disable
mxik.view            — GET /reference/mxik/search
finance.export_1c    — GET /finance/export/1c-*
finance.bill_payment — POST /finance/bill-payment
debtors.sms          — POST /finance/debtors/{id}/send-sms
```

Grant: `admin` barcha yangi permissions + `manager` → `integrations.view`, `mxik.view`, `finance.export_1c`.

---

## 12. Out of Scope

Quyidagilar bu DESIGN'da ko'rib chiqilmagan va keyingi sprintga qoldirilgan:

- **Soliq.uz integratsiyasi** — SPEC-3.md'da aniq "WON'T DO".
- **Real Yandex/BTS/Didox/Alif/Uzum/Multicard/Rahmat API call** — credentials yo'q, scaffold qaytaradi `{"ok": false, "message": "Sandbox credentials sozlanmagan"}`.
- **WebAuthn cryptographic signature verification** — `authData` signature, CBOR decode, EC2 key math. Keyingi sprintda `webauthn` Python lib bilan qo'shilishi kerak. Bu sprintda primitive challenge + origin check.
- **Apelsin to'lov** — SPEC-3.md'da yo'q.
- **MXIK auto-sync** — bir martalik CSV seed. Cron/webhook yo'q.
- **Telegram bot state machine** — `/buyurtma yangi` kabi interactive flow yo'q; faqat query commands.
- **Multi-worker rate limit (Telegram command)** — in-memory counter yetarli (single bot webhook worker).
- **Customer-facing Telegram bind** — faqat xodimlar (`users` table); mijozlar (`customers`) bog'lanishi Out of Scope.
- **Barcode scanner iOS Safari** — `BarcodeDetector` iOS 17+ Safari'da cheklangan; ZXing fallback yetarli, ammo iOS tam testi keyingi sprintga.

---

## 13. Clarifications Log

*Hozircha bo'sh. Builderlar savol topsa `tickets/QUESTIONS.md`'ga yozadi.*

