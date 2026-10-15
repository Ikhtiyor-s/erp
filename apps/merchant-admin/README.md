# merchant_admin — Aniq ERP mobil ilovasi

Aniq ERP uchun birinchi native mobil (Flutter, Android-only v1) ilova. Tashkilot `admin`/
`manager` roli uchun REGOS-parity ko'lamda: Dashboard/KPI, katalog (mahsulot+kategoriya),
statistika/hisobotlar, buyurtmalar (faqat ko'rish), xodimlar/payroll, xarajatlar va
kassa-smena (till-shift) boshqaruvi — bitta telefon ekranidan.

Kontrakt va qamrov: `tickets/SPEC-merchant-admin.md` va `tickets/DESIGN-merchant-admin.md`
(FROZEN API kontrakt + fayl egaligi) — repo ildizida.

## Stack

- Flutter (stable), Dart `^3.10.1`
- State: Provider (`ChangeNotifier`)
- Routing: go_router
- HTTP: Dio, `lib/services/api_client.dart` — har so'rovda `Authorization: Bearer` +
  `X-Organization-Id`
- Secure storage: `flutter_secure_storage` (access/refresh token)
- Offline o'qish-keshi: `lib/services/local_cache.dart` (yozish navbati YO'Q — faqat
  so'nggi muvaffaqiyatli ma'lumotni ko'rsatish uchun)
- Push: `firebase_core`/`firebase_messaging` — faqat ro'yxatga olish, jo'natuvchi xizmati
  hali ulanmagan (pastga qarang)

## Ishga tushirish

```powershell
cd D:\Docker\projects\erp\apps\merchant-admin
flutter pub get
```

Backend manzilini `API_BASE_URL` dart-define orqali beriladi (`lib/config.dart`):

```powershell
# Android emulator'dan localhost'dagi API'ga (10.0.2.2 — emulator'ning host-loopback aliasi)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8001/api/v1

# Jismoniy qurilma yoki boshqa host uchun haqiqiy manzil bering
flutter run --dart-define=API_BASE_URL=https://api.aniq-erp.example/api/v1
```

`API_BASE_URL` berilmasa, standart qiymat `http://10.0.2.2:8001/api/v1` (Android
emulator + lokal `apps/api`) ishlatiladi.

## Test va tahlil

```powershell
flutter analyze
flutter test
```

## Ma'lum cheklovlar

- `android/app/google-services.json` — **hozircha placeholder**. ERP backend'ida
  push-bildirishnoma jo'natuvchi (sender) xizmati ulanmagan (haqiqiy Firebase loyihasi
  yo'q) — ro'yxatga olish ishlaydi, lekin bildirishnoma kelishi kafolatlanmaydi
  (`lib/services/fcm_service.dart`, `tickets/DESIGN-merchant-admin.md` §7).
- v1 — faqat Android, iOS build yo'q.
- Checkout/to'lov ekrani yo'q — Buyurtmalar bo'limi faqat ko'rish/holat.
