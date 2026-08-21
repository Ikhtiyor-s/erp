# 4. Administrator qo'llanmasi

Adminstrator vazifalari: tashkilot sozlash, foydalanuvchilar boshqarish, hisobotlar, backup.

## Mundarija

1. [Tashkilot sozlamalari](#tashkilot-sozlamalari)
2. [Foydalanuvchilar va rollar](#foydalanuvchilar-va-rollar)
3. [Boshlang'ich ma'lumotlar](#boshlangich-malumotlar)
4. [Valyuta kursini yangilash](#valyuta-kursini-yangilash)
5. [Backup va restore](#backup-va-restore)
6. [Logiş va monitoring](#loging-va-monitoring)
7. [Konteynerlarni boshqarish](#konteynerlarni-boshqarish)

---

## Tashkilot sozlamalari

**Sahifa:** Sozlamalar → Organization (`/settings`)

To'ldiring:
- **Nomi** — to'liq rasmiy nom
- **STIR / ИНН**
- **Manzil**
- **Telefon**
- **Logo URL** (ixtiyoriy)

Bu ma'lumotlar cheklarda, hisob-fakturalarda chiqadi.

### Bir nechta tashkilot

Bitta foydalanuvchi bir nechta tashkilotga (org) tegishli bo'lishi mumkin. Topbar'da **Organization Selector** orqali almashtirish.

Yangi tashkilot qo'shish:
1. Ro'yxatdan o'tayotganda yangi tashkilot nomi
2. Yoki API orqali: `POST /api/v1/organizations`

---

## Foydalanuvchilar va rollar

### Rollar (oldindan sozlangan)

| Rol | Tavsif |
|---|---|
| `superadmin` | Hammasi |
| `admin` | Tashkilot ichida hamma narsa |
| `manager` | Sotuv + ombor + mijoz |
| `accountant` | Moliya + hisobot |
| `cashier` | Faqat POS + sotuv |

### Yangi xodim qo'shish

1. **Xodimlar → Sotrudniklar** ga o'ting
2. **+ Yangi** — xodim ma'lumotlari (F.I.O, telefon, lavozim, maosh)
3. Xodim **alohida foydalanuvchi** sifatida ro'yxatdan o'tishi kerak (`/register`)
4. Adminstrator API orqali (kelajakda — UI orqali) xodimni user akkauntiga bog'laydi

⚠️ **Joriy versiyada UI orqali ulanish yo'q.** API orqali: `POST /api/v1/organizations/{org_id}/users` (kelajakda).

### Foydalanuvchi rolini o'zgartirish

Hozircha faqat DB darajasida:
```sql
UPDATE user_organizations SET role_id = (SELECT id FROM roles WHERE code = 'manager')
WHERE user_id = '...' AND organization_id = '...';
```

---

## Boshlang'ich ma'lumotlar

Yangi tashkilot uchun **6 ta** boshlang'ich katalog to'ldirish:

### 1. Valyutalar (`/finance/currency`)
- UZS (asosiy)
- USD
- EUR
- RUB (kerak bo'lsa)

### 2. O'lchov birliklari (`/reference/units`)
- dona, kg, gr, litr, metr va h.k.

### 3. To'lov turlari (`/finance/payment-type`)
- Naqd
- Karta
- Bank o'tkazma
- Click / Payme (kelajakda)

### 4. Mijoz kategoriyalari (`/customer/category`)
- VIP (chegirma 10%)
- Optom
- Chakana

### 5. Omborlar (`/warehouse/warehouses`)
- Asosiy ombor
- Magazin
- Filial (agar kerak bo'lsa)

### 6. Kassalar (`/finance/cash`)
- Asosiy kassa (UZS)
- USD kassa
- Bank kartasi

---

## Valyuta kursini yangilash

### CBU'dan avtomatik
**Sahifa:** Finance → Valyutalar (`/finance/currency`)

Yuqoridagi **"Загрузить курсы с cbu.uz"** tugmasini bosing — bugungi kurslar `cbu.uz` dan yuklanadi.

### Qo'lda
1. Valyutani tanlang → **Kurslar** ikoni
2. Yangi kurs qo'shing: sana + 1 X = N UZS

---

## Backup va restore

### Postgres backup

```powershell
# Daily backup script
docker exec erp-postgres pg_dump -U erp erp > "D:\backups\erp-$(Get-Date -Format yyyy-MM-dd).sql"
```

### Restore

```powershell
# Tikla
Get-Content "D:\backups\erp-2026-06-19.sql" | docker exec -i erp-postgres psql -U erp -d erp
```

### Avtomatik kunlik backup (Task Scheduler)

1. Task Scheduler oching
2. Trigger: Daily at 02:00
3. Action: `powershell.exe`
4. Arguments: `-Command "docker exec erp-postgres pg_dump -U erp erp > D:\backups\erp-$(Get-Date -Format yyyy-MM-dd).sql"`

### Backup'larni 30 kun saqlash (avto-tozalash)

```powershell
Get-ChildItem D:\backups\erp-*.sql | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

---

## Logiş va monitoring

### Real-time log

```powershell
docker logs -f erp-api    # backend
docker logs -f erp-web    # frontend
docker logs -f erp-postgres
```

### Oxirgi xatolar

```powershell
docker logs --tail 100 erp-api 2>&1 | Select-String -Pattern "ERROR|Exception"
```

### Health check

| Servis | URL |
|---|---|
| Web | http://localhost:3010/ |
| API | http://localhost:8001/health |
| API docs | http://localhost:8001/docs |
| pgAdmin | http://localhost:5051/ |

### Resurs ishlatish

```powershell
docker stats --no-stream
```

---

## Konteynerlarni boshqarish

### Ishga tushirish

```powershell
cd D:\Docker\projects\erp
docker compose up -d
```

### To'xtatish

```powershell
docker compose stop      # to'xtatish (data saqlanadi)
docker compose down      # konteynerlarni o'chirish (volume'lar saqlanadi)
docker compose down -v   # HAMMASINI O'CHIRISH (DB ham yo'qoladi)
```

### Bir servisni qayta yuklash

```powershell
docker compose restart api    # kod o'zgargandan keyin
docker compose restart web
```

### Yangi versiya deploy qilish

Frontend (kod o'zgartirilgan):
```powershell
docker compose build web
docker compose up -d --force-recreate web
```

Backend (kod o'zgartirilgan):
```powershell
# Volume mount bilan — restart yetarli
docker compose restart api
```

### Konteyner ichiga kirish

```powershell
docker exec -it erp-postgres psql -U erp -d erp    # DB shell
docker exec -it erp-api sh                          # backend shell
docker exec -it erp-web sh                          # frontend shell
```

---

## Xavfsizlik

### Parollar
- Ishchi parollarni o'zgartiring (`.env` faylda `SECRET_KEY`, DB parollari)
- HTTPS sertifikat qo'shing (Nginx reverse proxy)

### Tarmoq
- Tashqi tarmoqdan faqat port 80/443 ochiq bo'lsin
- Postgres porti 5434 — faqat lokal

### Foydalanuvchilar
- Kuchli parollar talab qiling
- Refresh token 30 kun — qisqartirish mumkin (`.env` ichida `REFRESH_TOKEN_EXPIRE_DAYS`)

---

## Yangilash (update)

### Manba kod yangilanganda

```powershell
cd D:\Docker\projects\erp
git pull  # agar git bo'lsa
docker compose build
docker compose up -d --force-recreate
```

### Schema patches

Yangi DB jadval/ustun qo'shilsa — `apps/api/app/db/schema_patches.py` da `CREATE TABLE IF NOT EXISTS ...` yoki `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` qo'shing. API startup'da avtomatik qo'llaniladi.

---

## Hisobotlar yuborish

### Excel uchun

Statistika sahifalarida **CSV** yuklab oling, Excel'da oching, formatlang va emailga jo'nating.

### PDF chek/hisob-faktura

Brauzerda `Ctrl+P` bosing — PDF saqlanadi.

### Telegram xabar (kelajakda)

`/settings/marketing-sms` da sozlash — Telegram bot bilan integratsiya rejada.
