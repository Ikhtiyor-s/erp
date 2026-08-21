# 8. Muammolar va yechimlar

Tez-tez uchraydigan muammolar va ularning yechimlari.

## Brauzer xatolari

### `ERR_EMPTY_RESPONSE` (port 3010)

**Muammo:** http://localhost:3010 javob bermayapti.

**Sabab:** `erp-web` konteyneri yiqilgan yoki zombie holatda.

**Yechim:**
```powershell
# 1. Konteyner holatini ko'ring
docker ps -a --filter "name=erp-web"

# 2. Restart qiling
cd D:\Docker\projects\erp
docker compose restart web

# 3. Agar restart yordam bermasa (zombie holat)
docker compose up -d --force-recreate web

# 4. Eng oxirgi chora — Docker Desktop restart
Get-Process "Docker Desktop" | Stop-Process -Force
Start-Sleep -Seconds 3
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

---

### `ERR_CONNECTION_REFUSED`

**Sabab:** Konteyner ishlamayapti.

**Yechim:**
```powershell
docker compose up -d
```

---

### Cache muammosi — eski versiya ko'rinmoqda

**Sabab:** Brauzer eski JS chunk'larni cache'lagan.

**Yechim:**
- `Ctrl+Shift+R` (hard reload)
- Yoki DevTools → Network → "Disable cache" yoqib qo'ying

---

## API xatolari

### `401 Unauthorized`

**Sabab:** Token muddati o'tgan yoki noto'g'ri.

**Yechim:** Login qaytadan (`/login`)

---

### `400 X-Organization-Id header required`

**Sabab:** Frontend org_id'ni yubormagan.

**Yechim:**
- Topbar'dan Organization tanlash
- `localStorage.getItem('org_id')` to'g'ri ekanligini tekshirish
- Brauzer DevTools → Application → Local Storage

---

### `500 Internal Server Error`

**Sabab:** Backend xatosi.

**Yechim:**
```powershell
# Log ko'ring
docker logs --tail 50 erp-api 2>&1

# Restart
docker compose restart api
```

---

### API javob bermayapti (timeout)

**Sabab:** API yiqilgan yoki schema patch'larni qo'llamoqda (startup vaqti).

**Yechim:**
1. 30 sek kuting (schema patches ishlashi mumkin)
2. Log'ni ko'ring:
   ```powershell
   docker logs erp-api 2>&1 | Select-Object -Last 30
   ```
3. Agar `Application startup complete` ko'rinmasa — restart

---

## Database xatolari

### `relation "table_name" does not exist`

**Sabab:** Yangi jadval qo'shilgan, lekin schema patch qo'llanmagan.

**Yechim:**
```powershell
# API'ni restart qiling — schema patches startup'da avtomatik qo'llaniladi
docker compose restart api

# Yoki qo'lda
docker exec -it erp-postgres psql -U erp -d erp -c "CREATE TABLE IF NOT EXISTS ..."
```

---

### `column "..." does not exist`

**Sabab:** ALTER patch qo'llanmagan.

**Yechim:**
- API restart
- Yoki: `apps/api/app/db/schema_patches.py` ga `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` qo'shing

---

### `duplicate key violates unique constraint`

**Sabab:** Bir xil ma'lumot 2 marta kiritilmoqda.

**Yechim:**
- UI'da formni tekshiring (kod, nom bir xil)
- DB'da takrorlanganlarni topish:
  ```sql
  SELECT code, COUNT(*) FROM products WHERE organization_id = '...'
  GROUP BY code HAVING COUNT(*) > 1;
  ```

---

### `current transaction is aborted`

**Sabab:** Avvalgi so'rov xato bilan tugadi, ammo session yopilmadi (rare).

**Yechim:** API restart.

---

## Docker muammolari

### `Cannot connect to the Docker daemon`

**Sabab:** Docker Desktop ishlamayapti.

**Yechim:**
- Start menyusi'dan Docker Desktop ochish
- Yoki:
  ```powershell
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  ```

---

### `port is already allocated`

**Sabab:** Boshqa servis bilan port konflikti.

**Yechim:**
- Konfliktli portni topish (3010, 8001, 5434, 6380, 5051):
  ```powershell
  netstat -ano | findstr "3010"
  ```
- Topilgan PID'ni o'chirish yoki `docker-compose.yml` da boshqa port

---

### `no space left on device`

**Sabab:** Docker'dagi disk to'lgan.

**Yechim:**
```powershell
docker system prune -a --volumes  # ⚠️ HAMMASINI O'CHIRADI (ehtiyot bo'ling)
# Yoki tanlab
docker image prune -a
```

---

### Konteyner "Up" lekin javob bermaydi (zombie)

**Sabab:** OS darajasidagi zombie process (WSL2 + Docker xatosi).

**Yechim:**
```powershell
# 1. Force recreate
docker compose up -d --force-recreate <service>

# 2. Agar yordam bermasa — Docker Desktop restart
Get-Process "Docker Desktop" | Stop-Process -Force
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 3. Yoki WSL'ni to'liq qayta yuklash (administrator sifatida)
wsl --shutdown
Restart-Service LxssManager -Force
```

---

### `docker compose build` juda sekin

**Sabab:** Network sekin (Google Fonts yuklab olish), npm install qayta-qayta.

**Yechim:**
- Birinchi build ~10-15 daqiqa (npm install + next build)
- Keyingi build'lar layer cache bilan ~5-7 daqiqa
- Bir oydan ortiq Docker'ni ishlatilmagan bo'lsangiz, `docker system prune` qiling

---

## Frontend muammolari

### `Type error: Cannot find name 't'`

**Sabab:** `useTranslations` hook chaqirilmagan, lekin `t("...")` ishlatilgan.

**Yechim:**
```tsx
import { useTranslations } from "next-intl";

export default function MyPage() {
  const t = useTranslations("ui");  // ← qo'shish kerak
  return <div>{t("key")}</div>;
}
```

---

### `Hydration mismatch`

**Sabab:** Server-render va client-render farqi (next-themes, localStorage).

**Yechim:**
- Komponentni `"use client"` qiling
- `useEffect` ichida state'ni yangilash

---

### Sahifa "Loading..." da qotib qoldi

**Sabab:** API javob bermayapti yoki xato.

**Yechim:**
- Brauzer DevTools → Network — qaysi so'rov muammoli
- API log'ni ko'rish
- Brauzer'da `console.log` qatla — error trace'ni ko'rish

---

## Tarjima muammolari

### Ba'zi matnlar rus tilida qoladi

**Sabab:** Sahifaga `useTranslations` hook qo'shilmagan yoki kalit yo'q.

**Yechim:**
1. Sahifa kodida hardcoded "русские слова" topish
2. `t("...")` bilan almashtirish
3. `apps/web/i18n/messages/{uz,ru,en}.json` ga kalit qo'shish
4. Build qaytadan

---

### Til o'zgartirdim, lekin matnlar o'zgarmadi

**Sabab:** Cache (browser yoki Next.js).

**Yechim:**
- `Ctrl+Shift+R` — hard reload
- localStorage'ni tozalash:
  ```js
  // Brauzer console'da
  localStorage.removeItem("locale")
  ```

---

## Performance

### Sahifa juda sekin

**Sabab:** Ko'p so'rov, ko'p DOM element.

**Yechim:**
- API'da `limit=100` ishlatish
- Pagination kerak (kelajakda)
- Browser DevTools → Performance — bottleneck topish

---

### API sekin javob beradi (> 1 sek)

**Yechim:**
1. PostgreSQL `EXPLAIN ANALYZE` bilan slow query topish:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM sales WHERE customer_id = '...';
   ```
2. Index qo'shish:
   ```sql
   CREATE INDEX idx_sales_customer ON sales (customer_id);
   ```

---

## Tarmoq xatolari

### `ECONNRESET` / `socket hang up`

**Sabab:** Lokal network buzilgan.

**Yechim:**
- `docker network prune`
- Docker restart

---

## Emergency

### "Hech narsa ishlamayapti, men nimadir buzdim"

1. **Hayajonga tushmang.** Ma'lumotlar Postgres volume'ida saqlangan, kod fayllar joyida.

2. **Konteynerlarni qayta yarating:**
   ```powershell
   cd D:\Docker\projects\erp
   docker compose down
   docker compose up -d
   ```

3. **Agar ham ishlamasa — Docker restart:**
   ```powershell
   Get-Process "Docker Desktop" | Stop-Process -Force
   Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
   ```

4. **Eng oxirgi chora — kompyuter restart**

### "Ma'lumotlar yo'qoldi"

- Postgres volume mavjudligini tekshiring:
  ```powershell
  docker volume ls | findstr "erp"
  ```
- Backup'dan tiklash: [Admin guide](04-admin-guide.md#backup-va-restore)

---

## Debug rejimi

### Backend log

```powershell
docker logs -f erp-api          # Live log
docker logs --tail 100 erp-api  # Oxirgi 100 satr
```

### Frontend log

```powershell
docker logs -f erp-web
```

### Database query log

```powershell
docker exec -it erp-postgres psql -U erp -d erp -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

### Brauzer DevTools

- `F12` — DevTools
- **Console** — JavaScript xatolari
- **Network** — qaysi so'rov sekin
- **Application** → Local Storage — token, org_id, locale

---

## Bog'lanish

Muammo topilmasa yoki murakkab bo'lsa:
- Logni nusxalang (`docker logs ...` chiqishi)
- Brauzer DevTools'dan xato matnini oling
- Devops bilan bog'laning
