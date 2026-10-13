# Tezkor tugmalar (hotkeys)

Manba: `docs.regos.uz/ru/regos-pos/operations/hot-keys`

## REGOS to'liq ro'yxati

**Sotuv ekrani:**

| Tugma | Amal |
|---|---|
| `Delete` | sторno (tanlangan qatorni bekor qilish) |
| `Enter` | tanlash/qo'llash |
| `Esc` | kiritish/popupni bekor qilish (to'lov ekranida emas) |
| `F1` | tezkor mahsulotlar |
| `F2` | qatorni tahrirlash |
| `F3` | qidiruv |
| `F5` | qaytarish rejimi |
| `F8` | to'lov |
| `F9` | butun hujjatni bekor qilish |
| `F11` | bloklash |
| `F12` | asosiy menyuga chiqish |
| `↑` `↓` | qator tanlovini siljitish |
| `Ctrl+F3` | kategoriya bo'yicha tanlash |
| `Ctrl+G` | chekni kutish rejimiga qo'yish |
| `Ctrl+H` | kutayotgan chekni davom ettirish |
| `Ctrl+I` | kassaga naqd kiritish |
| `Ctrl+J` | kutayotgan cheklar ro'yxati |
| `Ctrl+O` | kassadan naqd chiqarish |
| `Ctrl+U` | kassa qutisini ochish |
| `Ctrl+Shift+A/B/C/M` | artikul/shtrix-kod/kod/markirovka bo'yicha qidiruv |
| `Ctrl+Shift+D` | mijoz kartasi |
| `Ctrl+Shift+F` | mijoz kartasini qidirish |
| `Ctrl+Shift+I` | qatorga %-chegirma |
| `Ctrl+Shift+K` | chek bo'yicha qidiruv |
| `Ctrl+Shift+L` | narx-turini almashtirish |
| `Ctrl+Shift+N/T/W` | tarozi: nol/tara/og'irlikni olish |
| `Ctrl+Shift+O` | butun hujjatga %-chegirma |
| `Ctrl+Shift+P` | butun hujjatga summa-chegirma |
| `Ctrl+Shift+Q` | miqdorni belgilash |
| `Shift+Alt+D` | tashqi bonus dasturi |

**To'lov ekrani:**

| Tugma | Amal |
|---|---|
| `Delete` | to'lov qatorini sторno qilish |
| `F8` | chekni yopish |
| `↑` `↓` | to'lov qatori tanlovini siljitish |

## Aniq ERP holati

⚠️ **Qisman — eng muhim deb topilgan 6 tasi 2026-10-13da qo'shildi**
(`apps/web/app/(dashboard)/pos/page.tsx`, `onKeyDown` effekti):

| Tugma | Aniq ERP'da amal | Izoh |
|---|---|---|
| `F3` | qidiruv maydonini fokus qiladi | ✅ |
| `F5` | `/sale/return` sahifasiga o'tadi | ⚠️ REGOS'dagidek shu ekranda rejim almashtirmaydi — [`refund.md`](sales-registration/refund.md)ga qarang |
| `F8` | klaviaturadagi summa bilan birinchi to'lov usulini qo'llaydi (yoki, to'liq to'langan bo'lsa, yakunlaydi) | ✅ |
| `F9` / `F12` | ikkalasi ham chekni tozalaydi (tasdiqlash so'raladi) | ⚠️ REGOS'da bular ikki xil amal (F9=bekor qilish, F12=menyuga chiqish) — Aniq ERP'da ikkalasi bir xil ishlaydi, chunki "asosiy menyu"ga alohida chiqish tushunchasi yo'q |
| `Delete` | oxirgi qatorni o'chiradi (matn maydonida emas) | ⚠️ "sторno-lite" — audit-trail yo'q, [`general-information.md`](sales-registration/general-information.md)ga qarang |
| `Esc` | chegirma kiritish rejimidan chiqadi | ✅ (REGOS'da ham shunga o'xshash — popup/kiritishni bekor qilish) |

**Qolgan hammasi (`F1`, `F2`, `F11`, `↑↓`, barcha `Ctrl+*` kombinatsiyalari)
— ❌ yo'q.** Ko'pchiligi tegishli funksiya o'zi qurilmagani uchun tabiiy
ravishda yo'q (masalan `Ctrl+G`/`Ctrl+H` — kutish rejimi yo'q; `Ctrl+I`/
`Ctrl+O` — kassa harakati yo'q; `Ctrl+Shift+N/T/W` — tarozi nol/tara yo'q).

## Keyingi qadam

Qolgan hotkeylarni qo'shish alohida ticket emas — har biri tegishli
funksiya (chegirma, sторno, kutish rejimi, kassa harakati, tarozi) qurilgan
sayin, o'sha funksiyaning tugatuvchi qadami sifatida hotkey ham qo'shilsin
(ya'ni "funksiya + uning hotkey'i" bitta ticket, alohida "hotkeylar"
ticketi emas).
