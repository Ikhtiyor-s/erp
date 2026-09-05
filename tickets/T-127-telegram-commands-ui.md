# T-127: Frontend — Telegram settings sahifasi kengaytirish

**Wave:** 4C
**Owner:** frontend-dev
**Size:** S
**Depends on:** T-123

## Goal
`settings/crm/page.tsx` (mavjud) — bot commands ro'yxati va help matni qo'shish.

## Files likely touched
- `apps/web/app/(dashboard)/settings/crm/page.tsx` (kengaytirish)
- `apps/web/i18n/messages/*.json`

## UI qo'shimcha blok
```
Bot buyruqlari (read-only info blok):
/buyurtma — Oxirgi 5 ta buyurtma
/qoldiq   — Kam qolgan tovarlar
/balans   — Kassa qoldig'i
/yordam   — Buyruqlar ro'yxati
```
- Copy tugmasi har command yonida (bot'ga yozish uchun).
- "Bot'ga /start yuboring" onboarding matniga havola.

## Acceptance criteria
- Mavjud CRM settings (bot token, channel ID) buzilmaydi.
- Commands bloki read-only (faqat ma'lumot).
- Mavjud sahifaga qo'shimcha section sifatida qo'shiladi (alohida sahifa emas).

## How we'll know it's done
CRM settings sahifasida commands ro'yxati ko'rinadi; mavjud bot token va channel ID saqlash ishlaydi.
