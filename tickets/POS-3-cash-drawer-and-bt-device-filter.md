# POS-3 — Kassa qutisini ochish + Web Bluetooth qurilma tanlash filtri

**Spec**: `tickets/SPEC-pos-hardware.md`

## Goal

(1) Chek printeriga ulangan kassa qutisini ESC/POS pulse komandasi bilan ochish imkonini qo'shish
(POS-2'da ulangan Bluetooth kanalni qayta ishlatib, yangi qurilma turi qo'shmasdan). (2) Web
Bluetooth qurilma tanlash oynasidagi `acceptAllDevices:true`ni `filters` bilan almashtirib, faqat
mos printer/skaner xizmatlarini ko'rsatish (hozir har qanday yaqin BT qurilma ro'yxatda chiqadi).

## Files likely touched

- `apps/web/lib/bt-printer.ts` — `openCashDrawer()` yangi eksport (mavjud `btPrint()`ni
  `ESC_POS_DRAWER_OPEN` bayt ketma-ketligi bilan chaqiradi — Biznes POS'ning
  `cash-drawer.service.ts`dagi `0x1B 0x70 0x00 0x19 0xFA` komandasi referens), va
  `requestDevice({acceptAllDevices:true, ...})`ni `requestDevice({filters:[{services:
  SERVICE_UUIDS}]})`ga o'zgartirish
- `apps/web/app/(dashboard)/pos/page.tsx` — "Qutini ochish" tugmasi (faqat printer ulangan holatda
  ko'rinadi/faollashadi)

## How we'll know it's done

- Printer ulangan holatda "Qutini ochish" tugmasi bosilganda haqiqiy kassa qutisi (printer DK
  portiga ulangan) ochiladi (real qurilmada sinaladi)
- Printer ulanmagan holatda tugma ko'rinmaydi yoki o'chirilgan (disabled) holatda, tushunarli
  tooltip bilan
- Web Bluetooth qurilma tanlash oynasida endi faqat mos xizmat UUID'iga ega qurilmalar ko'rinadi
  (haqiqiy telefon/quloqchin kabi aloqasiz qurilmalar ro'yxatdan yo'qoladi) — real brauzerda
  tasdiqlanadi

## Owner role

`frontend-dev`

## Depends on

POS-2 (bir xil Bluetooth ulanish kanalidan foydalanadi)
