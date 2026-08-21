# 1. Boshlash

## Tizim talablari

| Komponent | Talab |
|---|---|
| OS | Windows 10/11, macOS, Linux |
| RAM | Minimum 8 GB, tavsiya 16 GB |
| Docker | Docker Desktop 4.30+ yoki Docker Engine 24+ |
| Brauzer | Chrome/Edge 120+, Firefox 120+, Safari 17+ |

## O'rnatish

### 1. Loyihani klonlash

Loyiha `D:\Docker\projects\erp\` papkasida joylashgan.

### 2. Docker konteynerlarni ishga tushirish

```powershell
cd D:\Docker\projects\erp
docker compose up -d
```

5 ta konteyner ko'tariladi:
- **erp-postgres** (port 5434) — ma'lumotlar bazasi
- **erp-redis** (port 6380) — kesh
- **erp-api** (port 8001) — backend
- **erp-web** (port 3010) — frontend
- **erp-pgadmin** (port 5051) — DB boshqaruv

### 3. Ishga tushishini tekshirish

```powershell
docker ps --filter "name=erp"
```

Hammasi `Up` holatda bo'lishi kerak. `erp-postgres` `(healthy)` bo'lishi kerak.

### 4. Brauzerda ochish

```
http://localhost:3010
```

## Birinchi login

### Yangi foydalanuvchi yaratish

`/register` sahifasida:
- **Email:** ishchi email manzilingiz
- **Parol:** kuchli parol (kamida 8 ta belgi, raqam va katta harf bilan)
- **F.I.Sh.:** to'liq ismingiz
- **Tashkilot nomi:** kompaniyangiz nomi

Ro'yxatdan o'tgandan keyin avtomatik login qilasiz va o'zingizning tashkilotingiz uchun **admin** rolida bo'lasiz.

### Test foydalanuvchi (rivojlanish uchun)

| Email | Parol |
|---|---|
| `qa@example.com` | `Qa12345!` |

## Asosiy navigatsiya

### Sidebar (chap menyu)

**15 ta asosiy guruh:**
1. **Bosh sahifa** — KPI va sotuvlar paneli
2. **Sotuv** — kontraktlar, qaytarishlar, to'lovlar
3. **Moliya** — kassalar, tranzaksiyalar, balanslar
4. **Ombor** — mahsulotlar, qoldiqlar, kirim/chiqim
5. **Mijozlar** — mijozlar bazasi, buyurtmalar
6. **Ta'minot** — sotib olishlar, yetkazib beruvchilar
7. **Ishlab chiqarish** — BOM, buyurtmalar
8. **Xodimlar** — kadrlar, KPI, rollar
9. **Marketing** — chegirmalar, ekspektatsiyalar
10. **Ma'lumotnoma** — valyuta, birliklar, narxlar
11. **Statistika** — 18 ta hisobot
12. **Asboblar** — narx o'zgartirish, eksport
13. **Vazifalar** — to-do
14. **POS** — kassa
15. **Sozlamalar** — 21 ta sozlama sahifa

### Topbar (yuqori chiziq)

- **Organization Selector** — bir nechta tashkilot orasida almashtirish
- **🔍 Qidirish (⌘K)** — istalgan sahifaga 2 ta tugma bilan o'tish
- **🌐 Til** — UZ / RU / EN
- **🌙 Mavzu** — Light / Dark / System
- **👤 Foydalanuvchi** — profil va chiqish

### Klaviatura yorliqlari

| Yorliq | Vazifa |
|---|---|
| `⌘K` / `Ctrl+K` | Tezkor qidiruv (Command Palette) |
| `↑` `↓` | Qidiruvda navigatsiya |
| `Enter` | Tanlanganni ochish |
| `Esc` | Modal / qidiruvni yopish |

## Asosiy ekran elementlari

### List sahifalari (jadval)

Har bir modulda asosiy ko'rinish:
- **Sarlavha** — sahifa nomi + tavsifi + "Yangi yaratish" tugmasi (o'ngda yashil)
- **Filtr paneli** — qidiruv, sana, kategoriya filterlar
- **Jadval** — ma'lumotlar ro'yxati (hover'da tahrirlash/o'chirish tugmalari)
- **Pastki bar** — yozuvlar soni

### Modal oynalari

Yangi yaratish yoki tahrirlash uchun:
- **Yuqoridan** ochiladi (ekran o'rtasi emas)
- `Esc` bilan yopish mumkin
- Backdrop bilan kontekst kichraytiriladi

### Statuslar (ranglar)

| Rang | Ma'no |
|---|---|
| 🟢 Yashil | Muvaffaqiyat, faol, kirim |
| 🔴 Qizil | Xato, qarz, chiqim, qaytarish |
| 🟡 Sariq | Kutish, qisman, ogohlantirish |
| 🟣 Binafsha | Brand (asosiy tugmalar) |
| ⚪ Kulrang | Neytral, ma'lumot |

## Keyingi qadamlar

1. **Tashkilotingizni sozlang** → [Administrator qo'llanmasi](04-admin-guide.md#tashkilot-sozlamalari)
2. **Mahsulotlar qo'shing** → [Modullar: Ombor](03-modules.md#ombor)
3. **Birinchi sotuv qiling** → [Modullar: Sotuv](03-modules.md#sotuv)
4. **Hisobotlarni ko'ring** → [Modullar: Statistika](03-modules.md#statistika)
