# Hujjat holat-modeli va qator sторnosi

Manba: `docs.regos.uz/ru/regos-pos/operations/sales-registration/general-information`

## 1. Hujjat holatlari (status model)

REGOS'da sotuv hujjati **oltita** holatdan o'tishi mumkin (uchta emas):

```
Открыт (yaratildi, qatorlar bor)
   │
   ├─→ Отложен (tahrirlashda to'xtatildi — qatorlarni tahrirlashga qaytarish mumkin)
   │
   ▼
Оплата (to'lov rejimida)
   │
   ├─→ Отложена оплата (to'lov jarayonida to'xtatildi — faqat to'g'ridan-to'g'ri
   │                      Оплата'ga qaytariladi, Открыт'ga emas)
   │
   ▼
Закрыт (to'langan, yopilgan)

Istalgan bosqichdan: Отменен (bekor qilindi, final — F9)
```

Muhim nuans: **ikki xil "to'xtatilgan" holat bor**, va ular bir-biriga
almashtirilmaydi — qaysi ekranda to'xtatilgan bo'lsa, faqat o'sha ekranga qaytadi.

### Aniq ERP holati

❌ **Yo'q.** `sales.status` ustunida bunday granulярlik mavjud emas — hozircha
faqat oddiy holatlar bor (`confirmed`/`cancelled` kabi, loyalty/pay logikasiga
qarab). Hech qanday "to'xtatilgan" (parked) holat yo'q.

`kiosk_orders.status` (SC-3, 2026-10-12 sprint) da `awaiting_payment`/`paid`/
`cancelled`/`payment_failed` bor — lekin bu **boshqa, kiosk-specific** holat
mashinasi, shu yerdagi REGOS modeliga mos emas va uni almashtira olmaydi.

**Keyingi qadam:** yangi ticket kerak — `sales.status`ga `parked_editing` va
`parked_payment` (yoki shunga mos) qiymatlarini qo'shish, POS ekranida
"Kutish rejimi" tugmasini (hozir docs/regos-pos bo'yicha stub, ERP kodida
`pos/page.tsx`dagi "Kutish rejimi"/"Kutayotganlar" tugmalari) ulash. Bu
ushbu hujjatlar to'plamidagi **eng katta yagona gap**.

## 2. Qator sторnosi (сторнирование) ≠ o'chirish

Kassir savatdagi bitta qatorni **bekor qilishi** (`Delete` tugmasi) mumkin —
lekin bu qatorni o'chirmaydi:

1. Qator **chizib qo'yiladi** (strikethrough) — vizual ravishda "bekor
   qilingan" deb belgilanadi, lekin ekranda qoladi.
2. Avtomatik ravishda **manfiy miqdorli qarshi-qator** yaratiladi (masalan
   asl qator +2 dona bo'lsa, qarshi-qator −2 dona) — ikkalasi birga 0 ga
   teng bo'ladi, lekin audit izi (nima sotilib, keyin bekor qilingani)
   saqlanadi.
3. Allaqachon sторno qilingan qatorni **qayta sторno qilib bo'lmaydi**.
4. Butun hujjatni bekor qilish (`Аннулировать`, `F9`) — bu alohida, kattaroq
   amal, sotuv ekranidan ham, to'lov ekranidan ham chaqirilishi mumkin.

### Aniq ERP holati

❌ **Yo'q.** Tekshirildi: `apps/api/app/modules/sale/` ichida "storno"/"void"
so'zlari uchun qidiruv natija bermadi; `pos/page.tsx`dagi `removeCart()`
funksiyasi qatorni **shunchaki massivdan olib tashlaydi** — hech qanday
audit-izi, qarshi-qator yo'q.

2026-10-13 sessiyasida qo'shilgan `Delete` hotkey ham xuddi shu — "sторno-lite"
deb izohlangan, ya'ni faqat oxirgi qatorni o'chiradi, audit-trail yaratmaydi.

**Keyingi qadam:** yangi ticket kerak. Taklif qilinadigan yondashuv:
- `sale_items`ga `voided_at`/`voided_counter_item_id` kabi ustun qo'shish
  (yoki alohida audit jadval), yoki
- Backend'da "sotuv hali `Открыт`/draft holatda (serverga yuborilmagan)
  paytda frontend-only o'chirish qoladi, lekin server'ga yuborilgandan keyin
  (яъни to'lov boshlangandan keyin) har qanday o'zgarish faqat
  qarshi-yozuv orqali" qoidasi — bu REGOS modeliga yaqinroq, chunki Aniq
  ERP'da ham `ensureSale()` chaqirilgandan keyin savat "qulflanadi"
  (`disabled={!!saleId}` — bu allaqachon bor).

Bog'liq: to'lov qatori sторnosi uchun [`payment-by-document.md`](payment-by-document.md)ga qarang — bir xil naqsh, lekin alohida implementatsiya kerak.
