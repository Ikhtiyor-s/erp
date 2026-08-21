# T-6 — otp-phone-normalize

## Goal

`customer_portal/router.py` da OTP so'rovi va tekshiruvida telefon raqamni
normalize qilish funksiyasini joriy etish — `LIKE '%...%'` patternini `WHERE phone = :p`
(aniq tenglik) ga almashtirish va barcha kiritish formatlarini `+998XXXXXXXXX` ga keltirish.

## Acceptance criteria

- `normalize_phone(phone: str) -> str` yoki shunga o'xshash util funksiya `customer_portal` modulida (yoki `app/core/` da umumiy) mavjud
- Normalize qoidalari:
  - `+998901234567` → `+998901234567` (o'zgarmaydi)
  - `998901234567` → `+998901234567` (+ qo'shiladi)
  - `0901234567` → `+998901234567` (0 o'rniga +998)
  - Bo'shliq, tire, qavs tozalanadi
  - 12 raqamdan ko'p yoki kam — 422 (invalid phone format)
- OTP request endpoint'da (`router.py:56`) `phone = normalize_phone(raw_phone)` chaqiriladi
- OTP verify endpoint'da (`router.py:171`) ham `phone = normalize_phone(raw_phone)` chaqiriladi
- `WHERE phone = :p` — `LIKE '%...%'` QOLMAYDI
- Mavjud DB da `+998...` formatida saqlanmagan telefon raqamlar bo'lishi mumkin: backend-dev shu holatni tekshirib, agar format nomuvofiq bo'lsa — SPEC.md rollback rejasiga muvofiq eskalatsiya qilsin (migration script kerak bo'lishi mumkin)
- Muvaffaqiyatli normalize + OTP yuborish → 200
- Noto'g'ri format → 422, `{"detail": "Invalid phone number format"}`
- Mavjud barcha testlar PASS

## Files likely touched

- `apps/api/app/modules/customer_portal/router.py` (satırlar 56 va 171)
- `apps/api/app/core/phone_utils.py` (yangi fayl — agar umumiy util yaratilsa) yoki shu modulning `utils.py`

## Owner role

`backend-dev`

## Depends on

`none`

## Estimated effort

S (1 soat)
