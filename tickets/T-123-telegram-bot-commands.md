# T-123: Backend — Telegram bot command router

**Wave:** 4C
**Owner:** backend-dev
**Size:** M
**Depends on:** none (mavjud telegram.py kengaytirish)

## Goal
Mavjud Telegram webhook'ga command dispatch qo'shish: `/buyurtma`, `/qoldiq`, `/balans` stub handler'lar.

## Files likely touched
- `apps/api/app/modules/integration/telegram.py` (kengaytirish)
- `apps/api/app/modules/integration/router.py` (webhook endpoint mavjud — command routing qo'shish)

## Architecture
Mavjud webhook `POST /integrations/telegram/webhook` notificationlar uchun ishlatiladi. Command routing shu webhook'da:
```python
if update.get("message", {}).get("text", "").startswith("/"):
    await dispatch_command(db, org_id, update)
```

## Commands
| Command | Javob (stub) |
|---|---|
| `/buyurtma` | Oxirgi 5 ta buyurtma ro'yxati |
| `/qoldiq` | Kam qolgan tovarlar (≤ min_qty) |
| `/balans` | Kassa qoldig'i (joriy shift) |
| `/yordam` | Commands ro'yxati |

## Acceptance criteria
- `dispatch_command(db, org_id, update)` async funksiya — command'ni parse qilib to'g'ri handler'ga yo'naltiradi.
- Har handler DB'ga so'rov qiladi va Telegram'ga `send_raw()` orqali javob yuboradi.
- Noto'g'ri command: `/yordam` matnini yuboradi.
- Faqat `crm.telegram_chat_id` sozlangan org'lar uchun ishlaydi.
- Mavjud `notify_sale()` va `notify_low_stock()` funksiyalari buzilmaydi.
- Command'lar faqat sozlangan Telegram chat'dan kelsa ishlaydi (xavfsizlik: chat_id tekshirish).

## How we'll know it's done
Telegram'da bot'ga `/qoldiq` yuborganda kam qolgan tovarlar ro'yxati keladi (yoki "tovarlar yo'q" javobi).
