---
name: api-integration-reliability
description: Tashqi API/webhook integratsiya ishonchligi — timeout, exponential backoff retry, idempotency keys, HMAC signature verification, ACK<1s rule. Use when integrating external services (SMS, payment, marketplace, OFD, bank).
---

# API & integration reliability (Aniq ERP)

## 3 ta primitiv

| Primitiv | Vazifa | Rejim | Loyihadagi misol |
|---|---|---|---|
| **API call** | Tashqi xizmatga sinxron chaqiruv | Sync | Eskiz `send_sms`, CBU.uz currency import |
| **Database** | Holatli saqlash/so'rov | Stateful | Postgres + asyncpg |
| **Webhook** | Tashqi tizim agentni triggerlaydi | Async | Click webhook, Payme JSON-RPC, Telegram bot |

## 1. API call ishonchligi (yozuvlar uchun MAJBURIY)

### Timeout — doim o'rnat

Timeout'siz qo'ng'iroq agentni cheksiz kuttirishi mumkin. Sukut bo'yicha — **10-20 soniya**.

```python
# ✅ YAXSHI (apps/api/app/modules/integration/sms/eskiz.py:71)
async with httpx.AsyncClient(timeout=10.0) as client:
    r = await client.post(url, data={...})

# ❌ YOMON — agent qotib qoladi
async with httpx.AsyncClient() as client:
    r = await client.post(url, data={...})
```

Loyihada: `axios` default 20s timeout (`apps/web/lib/api.ts:22`).

### Retry — eksponensial backoff

Vaqtinchalik nosozlik (5xx, network) uchun **avtomatik qayta urinish**. Lekin **idempotent emas bo'lgan operatsiyalarni qayta urinmang** (idempotency key bilan ishlatish kerak).

```python
import asyncio
from typing import Callable, TypeVar

T = TypeVar("T")

async def with_retry(
    fn: Callable[[], T],
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
) -> T:
    last_exc = None
    for attempt in range(max_attempts):
        try:
            return await fn()
        except (httpx.TimeoutException, httpx.NetworkError) as e:
            last_exc = e
            if attempt == max_attempts - 1:
                raise
            delay = min(base_delay * (2 ** attempt), max_delay)
            await asyncio.sleep(delay)
    raise last_exc
```

**Faqat 5xx va network errorlarda retry qiling**. 4xx (validatsiya, auth) — qayta urinish foydasiz.

### Idempotency key (KRITIK — yozuvlar uchun)

User "Sotib olish" tugmasini ikki marta bosadi → siz 2 ta zakaz yaratmaysiz. Idempotency key bilan request "men buni allaqachon qildim" deydi.

**Pattern**:
```python
# Client (request yuborayotgan tomon)
idempotency_key = f"sale-{user_id}-{ts_seconds}-{client_request_id}"
headers = {"Idempotency-Key": idempotency_key}

# Server (qabul qilayotgan tomon)
# 1. Idempotency key DB'da bormi tekshir
existing = await db.execute(
    text("SELECT response_body FROM idempotency_keys WHERE key = :k AND expires_at > NOW()"),
    {"k": idempotency_key},
)
row = existing.first()
if row:
    return json.loads(row.response_body)  # bir xil javob qaytar

# 2. Operatsiyani bajar
result = await create_sale(...)

# 3. Javobni keyingi qayta urinishlar uchun saqla (24 soat)
await db.execute(
    text("INSERT INTO idempotency_keys (key, response_body, expires_at) "
         "VALUES (:k, :b, NOW() + INTERVAL '24 hours')"),
    {"k": idempotency_key, "b": json.dumps(result)},
)
```

**Eskiz va boshqa SMS provayderlar**: `client_message_id` field — xuddi shu maqsadda.

**Payme/Click webhook**: idempotency `click_trans_id` orqali (avto — webhook duplicate kelganda, allaqachon `received` deb qaytaramiz).

## 2. Webhook qabul qilish

### HMAC imzo tekshiruvi (SHART)

Webhook'ni har kim sizning URL'ga POST qila oladi. Imzo bilan tekshirmasangiz — hujumchi soxta to'lov "muvaffaqiyatli" deb keladi.

```python
# Pattern (Click misol — apps/api/app/modules/integration/payments/click.py)
import hashlib

def verify_click_signature(payload: dict, secret: str) -> bool:
    """Click protocol: MD5(click_trans_id+service_id+secret+...)."""
    expected = hashlib.md5(
        f"{payload['click_trans_id']}{payload['service_id']}{secret}..."
        .encode()
    ).hexdigest()
    return payload.get("sign_string") == expected

# Endpoint'da:
if not verify_click_signature(body, click_secret):
    raise HTTPException(403, "Invalid signature")
```

Boshqa provayderlar HMAC-SHA256 ishlatadi (modern). MD5 faqat protokol talab qilsa.

### ACK < 1 soniya, ishni navbatga qo'y

Webhook beruvchi (Click, Payme, GitHub) tez ACK kutadi (1-3 sek). Sekin javob bersangiz — ular **qayta yuboradi** (duplicate webhook problem).

```python
@router.post("/webhook")
async def webhook(req: Request, background: BackgroundTasks):
    body = await req.json()
    # 1. Tez tekshir
    if not verify_signature(body, secret):
        raise HTTPException(403)
    # 2. ACK darhol
    background.add_task(process_webhook_async, body)
    return {"received": True}

async def process_webhook_async(body: dict):
    # Sekin ish (DB write, audit, notification)
    ...
```

**Yoki**: Redis/Celery queue'ga `LPUSH` qil, worker o'qib bajarsin.

### Webhook idempotency (duplicate handling)

Provayder qayta yuborganda — siz bir xil hodisani **2 marta** ishlamaysiz:

```python
# Provayder unique ID bilan keladi (click_trans_id, payme transaction_id)
already_processed = await db.execute(
    text("SELECT 1 FROM payment_transactions WHERE provider = :p AND provider_id = :id"),
    {"p": "click", "id": body["click_trans_id"]},
)
if already_processed.scalar():
    # Bir xil javob qaytar (provayder darhol qoniqadi)
    return {"error": 0, "error_note": "Already processed"}
```

## 3. Autentifikatsiya (eng kam imtiyozli hisob)

| Type | Misol | Xavfsizlik darajasi |
|---|---|---|
| API key | Eskiz, OpenAI | Past — kalit kompromat bo'lsa to'liq egallaydi |
| Basic auth | Payme | Past — har request'da parol |
| OAuth2 (bearer) | GitHub, Slack | O'rta — token muddati cheklangan |
| JWT | Aniq ERP ichida | O'rta |
| HMAC signed request | Click webhook | Yaxshi — kalit hech qachon uzatilmaydi |
| IAM/SigV4 | AWS | Eng yaxshi — rolga asoslangan |

**Qoidalar**:
- Eng kam imtiyozli hisob ishlatish (`scopes:read` agar yozish kerak emas)
- Sirlarni `app.core.secret_box.encrypt(...)` bilan saqlash (settings JSONB'da)
- **Sirlarni promptga joylashtirmang** — environment yoki secret_box orqali

## 4. MCP (Model Context Protocol) — keyingi qadam

Hozir loyihada MCP yo'q. Future: ClickUp / GitHub / Slack ulash uchun.

Idea: bitta protokol, har qanday backend. Agent backend'dan bexabar.

## 5. A2A (Agent-to-Agent) — hozir kerak emas

Agent ↔ agent boshqa kompaniya bilan (cross-org). Bizning jamoa bitta jarayonda, shu sababdan A2A keyinga.

## Tool sprawl (agentga ko'p asbob — kasallik)

- 5 asbob bilan agent aniqligi: ~95%
- 100 asbob: < 30%
- **Har agent uchun 10-20 ta asbob max**

Bizning agentlar:
- pm, architect: **4 ta** (Read/Write/Glob/Grep) ✓
- cto: **4 ta** (+Bash) ✓
- backend-dev, frontend-dev: **6 ta** (+Edit, Bash) ✓
- qa-reviewer: **3 ta** (Read/Grep/Glob) ✓

## Logging (har integratsiya uchun MAJBURIY)

Har tashqi chaqiruvni `audit_log`'ga yozing — kelajakda nosozlik tekshirish uchun:

```python
import time
start = time.time()
try:
    result = await external_api_call(...)
    status = "ok"
except Exception as e:
    status = f"error: {e}"
    raise
finally:
    elapsed_ms = int((time.time() - start) * 1000)
    await db.execute(
        text("INSERT INTO audit_log (organization_id, action, entity, diff) "
             "VALUES (:o, 'external_call', :svc, :d::jsonb)"),
        {"o": org_id, "svc": "eskiz",
         "d": json.dumps({"url": "...", "status": status, "elapsed_ms": elapsed_ms})},
    )
```

`SENSITIVE_KEYS` redact qiladi — parol/token avtomatik `***` bo'ladi.

## Schema drift (yopiq nuqta)

Tashqi xizmat schema'sini o'zgartirgan paytda **silent failure** chiqadi. Misol: ClickUp `task.id` ni `task.taskId` ga o'zgartirsa.

**Yechim**: integratsiya schema'sini har 30 kunda **jonli endpoint'dan qayta yarat** — eski deprecated bo'lsa, sizga vaqt beradi.

## Tekshirish (har integratsiya uchun)

```
□ Timeout (>=5s, <=30s) o'rnatilgan?
□ Retry only on 5xx/network, backoff bilan?
□ Yozuvlar uchun idempotency key (request + DB tracking)?
□ Webhook: HMAC tekshirish — qattiq talab?
□ Webhook: ACK <1s, sekin ish background?
□ Webhook duplicate handling (provider_id check)?
□ Hisob ma'lumotlari encrypted at rest (secret_box)?
□ Har chaqiruv audit_log'ga yoziladi (sensitive fields redacted)?
```
