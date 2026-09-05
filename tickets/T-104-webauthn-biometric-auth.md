# T-104: Frontend — WebAuthn biometric auth wrapper

**Wave:** 4A
**Owner:** frontend-dev
**Size:** L
**Depends on:** none

## Goal
`lib/biometric.ts` WebAuthn helper + mobile login sahifasiga fingerprint/face id tugmasi — mavjud password va passcode auth'ni buzmasdan.

## Files likely touched
- `apps/web/lib/biometric.ts` (yangi)
- `apps/web/app/m/login/page.tsx` (biometric tugma qo'shish)
- `apps/web/i18n/messages/uz.json` + ru.json + en.json + uz-cyrl.json (biometric kalitlar)

## Architecture decision (Architect kerak)
WebAuthn challenge server-side saqlash kerak. Mavjud JWT flow bilan integratsiya:
- **Tavsiya:** Challenge `app_settings` JSONB'da per-org emas, per-user session'da (in-memory yoki Redis) — **Architect T-104'dan oldin qaror qilishi kerak.**
- Agar Redis yo'q: short-lived challenge DB'da (`user_webauthn_challenges` temp jadval, 5 min TTL).

## Acceptance criteria
- `lib/biometric.ts` eksport: `isBiometricAvailable()`, `enrollBiometric(userId, jwt)`, `authenticateWithBiometric()`.
- Enrollment: `navigator.credentials.create()` — credential `localStorage`'da saqlanadi (server-side passkey storage bu sprintda yo'q).
- Login: `navigator.credentials.get()` — muvaffaqiyatli bo'lsa mavjud JWT refresh endpoint'i chaqiriladi.
- Tugma faqat `isBiometricAvailable()` true bo'lganda ko'rinadi.
- Mavjud password/passcode login o'zgartirilmaydi.
- iOS Safari (Face ID): `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` check.

## WON'T DO (bu ticket)
- Server-side passkey registration endpoint — bu Wave 4A risk, architect qaroriga bog'liq.
- Biometric auth backend RBAC — mavjud JWT token ishlatiladi.

## How we'll know it's done
Android Chrome'da biometric enroll qilingandan keyin login sahifasida biometric tugma ko'rinadi va fingerprint bilan kirsa bo'ladi; iOS Safari'da ham ko'rinadi; passcode orqali kirish hamon ishlaydi.
