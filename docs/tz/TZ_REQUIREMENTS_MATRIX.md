# TZ Requirements Matrix — Aniq ERP Inventory

> Manbaa: `.tz_full_temp.txt` (506 qator, 19 talab bloki)
> Yaratilgan: 2026-09-05

---

## Jadval: Talablar ro'yxati

| ID | Talab nomi | Kategoriya | Ta'sir jadvallari | Ta'sir modullar | Priority |
|---|---|---|---|---|---|
| TZ-01 | Formirovanie skladov | Sklad | warehouses, warehouse_types, stock_balances | warehouse | P0 |
| TZ-02 | Tochki prodazhi | Sklad | cashboxes, pos_pages, open_tickets, sales | sale, pos | P0 |
| TZ-03 | Kartochka tovara | Mahsulot | products, product_categories, stock_balances | warehouse | P0 |
| TZ-04 | Neskolko shtrixkodov | Mahsulot | product_barcodes, products | warehouse | P0 |
| TZ-05 | Postavshchiki | Ta'minot | suppliers | supplier | P1 |
| TZ-06 | Zakupki i priem tovarov | Ta'minot | supplies, supply_items, stock_balances, cash_movements | warehouse, finance | P0 |
| TZ-07 | Zhurnal dvizheniya tovarov | Harakat | **stock_movements (YO'Q)**, stock_balances | warehouse | P0 |
| TZ-08 | Peremeshchenie mezhdu skladami | Harakat | internal_transfers, internal_transfer_items, stock_balances | warehouse | P0 |
| TZ-09 | Spisanie i oprihodovanie | Harakat | write_offs, write_off_items, write_off_reasons | warehouse | P0 |
| TZ-10 | Vozvrat postavshchiku | Harakat | **supplier_returns (YO'Q)**, supplies, stock_balances | warehouse, finance | P0 |
| TZ-11 | Kontrol ostatkov | Nazorat | recommended_stock, stock_balances, purchase_orders | warehouse | P1 |
| TZ-12 | Inventarizatsiya | Nazorat | inventories, inventory_items | warehouse | P0 |
| TZ-13 | Novy tovar pri inventarizatsii | Nazorat | inventories, products, product_barcodes, write_offs | warehouse | P1 |
| TZ-14 | Otchety | Hisobot | barcha jadvallar | warehouse, finance, statistics | P1 |
| TZ-15 | Sebestoimost va valovaya pribyl | Hisobot | stock_balances, sale_items, supply_items | finance, warehouse | P1 |
| TZ-16 | Finansovaya integratsiya | Moliya | cash_movements, supplies, sales, write_offs | finance | P1 |
| TZ-17 | Roli i prava dostupa | Umumiy | roles, role_permissions, permissions | rbac | P0 |
| TZ-18 | Zhurnal aktivnosti | Umumiy | audit_log | audit | P1 |
| TZ-19 | Obshchie NFR | Umumiy | barcha | barcha | P0 |

---

## Har talab uchun funksional checklist va qabul mezonlari

---

### TZ-01 Formirovanie skladov

**Funksional talablar:**
- [ ] Cheksiz miqdorda sklad yaratish mumkin (bir tashkilot doirasida)
- [ ] Har sklad: nom, filial/lokatsiya, tur (warehouse_types), manzil, mas'ul xodim, faollik holati, izoh
- [ ] Misol turlari: asosiy sklad, bar, magazin, SPA, bola zonasi, filial skladi
- [ ] Tovar qoldig'i har sklad uchun alohida saqlanadi (`stock_balances.warehouse_id`)
- [ ] Joriy qoldiq + mavjud qoldiq + minimal qoldiq ko'rinishi
- [ ] Sklad tarixi: barcha operatsiyalar va hujjatlar ro'yxati
- [ ] Deaktivatsiya — faqat ochiq operatsiyalar tugallangandan va qoldiqlar nolga kelgandan/ko'chirilgandan keyin

**Biznes qoidalari:**
- Qoldiqni o'zgartirish faqat sklad hujjati yoki tasdiqlangan sotuv orqali mumkin
- Manfiy qoldiq sukut bo'yicha taqiqlanadi (`allow_negative=False`)

**Qabul mezonlari:**
- Given bir tashkilot, when bir nechta sklad yaratilsa, then har birida mustaqil qoldiqlar yuritiladi
- Given bir sklad operatsiyasi, when o'tkazilsa, then boshqa sklad qoldig'i o'zgarmaydi
- Given deaktivatsiya so'rovi, when ochiq operatsiyalar mavjud bo'lsa, then 422 xato qaytariladi

---

### TZ-02 Tochki prodazhi

**Funksional talablar:**
- [ ] Har sotuv nuqtasi bir sukut bo'yicha sklad bilan bog'langan
- [ ] Sotuv paytida tizim bog'liq sklad qoldig'ini avtomatik kamaytiradi
- [ ] Sotuv nuqtasi: nom, filial, sklad, kassa
- [ ] Vakolati bo'lgan xodim tasdiqlashdan oldin boshqa sklad tanlashi mumkin
- [ ] Sotuv qaytarishi tovarni shu sklad qoldig'iga qaytaradi

**Biznes qoidalari:**
- Yetarli qoldiq bo'lmasa sotuv amalga oshirilmaydi
- Sotuv o'tkazilgandan keyin sklad faqat tuzatuvchi operatsiya orqali o'zgartirilishi mumkin

**Qabul mezonlari:**
- Given sotuv nuqtasi skladi, when sotuv tasdiqlansa, then shu sklad qoldig'i kamayadi
- Given yetarli qoldiq yo'q, when sotuv tasdiqlansa, then 422 xato qaytariladi
- Given qaytarish, when o'tkazilsa, then harakatlar jurnalida yozuv hosil bo'ladi

---

### TZ-03 Kartochka tovara

**Funksional talablar:**
- [ ] Tovar kartasi: nom, kategoriya, tavsif, foto, shtrix-kod, o'lchov birligi, xarid narxi, sotuv narxi, asosiy ta'minotchi, minimal qoldiq, holat, izoh
- [ ] Qo'shimcha: soliq stavkasi, og'irlik, hajm, muddati, seriya/partiya belgisi, sotuv sozlamalari
- [ ] Qidiruv: nom, har qanday shtrix-kod, kategoriya, ta'minotchi bo'yicha
- [ ] Holatlari: faol, to'ldirish kerak (qoldiq 0), arxiv (nofaol)
- [ ] Operatsiyada ishtirok etgan tovarni fizik o'chirish mumkin emas
- [ ] Kartadan sklad bo'yicha joriy qoldiqlar va harakat tarixi

**Biznes qoidalari:**
- Xarid narxi oxirgi yetkazib berishda yangilanadi yoki o'rtacha tannarx sifatida hisoblanadi
- Arxiv tovar o'tgan hujjatlarda saqlanadi, yangi operatsiyalarda ishlatib bo'lmaydi

**Qabul mezonlari:**
- Given faol tovar, when barcha modullarda izlansa, then topiladi
- Given arxivlangan tovar, when operatsiya qo'shishga harakat qilinsa, then 422 xato
- Given majburiy maydonlar bo'sh, when saqlansa, then 422 validatsiya xatosi

---

### TZ-04 Neskolko shtrixkodov v kartochke tovara

**Funksional talablar:**
- [ ] Tovar kartasida "Shtrix-kodlar" alohida bloki
- [ ] Bir nechta shtrix-kod qo'shish, tahrirlash, deaktivatsiya, qayta faollashtirish
- [ ] Qo'shimcha shtrix-kodlar soni cheklanmaydi
- [ ] Faqat bitta asosiy shtrix-kod bo'lishi mumkin (primary flag)
- [ ] Asosiy kod ro'yxatlarda, hujjatlarda, eksportda ishlatiladi
- [ ] Barcha faol qo'shimcha kodlar skanerlash vaqtida ishlaydi
- [ ] Noma'lum kod topilganda: yangi tovar yaratish, mavjudga bog'lash, qo'shimcha kod sifatida qo'shish, o'tkazib yuborish

**Biznes qoidalari:**
- Har faol shtrix-kod tizim doirasida yagona bo'lishi SHART
- Bir shtrix-kod ikki tovarga bir vaqtda bog'lab bo'lmaydi
- Dublikat topilsa tizim qaysi tovar bilan bog'langanligini ko'rsatadi
- O'chirish o'rniga deaktivatsiya tavsiya etiladi (tarix saqlanadi)

**Qabul mezonlari:**
- Given bir tovar, when bir nechta shtrix-kod qo'shilsa, then barchasi skanerlanganda shu tovar topiladi
- Given faol dublikat shtrix-kod, when qo'shishga harakat qilinsa, then 409 xato
- Given deaktivatsiya qilingan shtrix-kod, when skanerlansa, then topilmaydi

---

### TZ-05 Postavshchiki

**Funksional talablar:**
- [ ] Ta'minotchi kartasi: kompaniya nomi, kontakt shaxs, telefon, email, manzil, rekvizitlar, izoh
- [ ] Kartada: zakup tarixi, qaytarishlar, zakup summasi, o'zaro hisob-kitob (moliya bo'lsa)
- [ ] Holat: faol yoki arxiv
- [ ] Kartadan bog'liq zakupka va qaytarishlarga o'tish

**Biznes qoidalari:**
- Operatsiya tarixi bo'lgan ta'minotchini o'chirish taqiqlanadi
- Bir tovarning asosiy va qo'shimcha ta'minotchilari bo'lishi mumkin

**Qabul mezonlari:**
- Given ta'minotchi, when zakupka hujjatida tanlansa, then bog'liq hujjatlar kartada ko'rinadi
- Given operatsiya tarixi bo'lgan ta'minotchi, when o'chirishga harakat qilinsa, then 409 xato

---

### TZ-06 Zakupki i priem tovarov

**Funksional talablar:**
- [ ] Zakupka hujjati: ta'minotchi, sklad, sana, mas'ul, izoh
- [ ] Jadval qismida: tovar, shtrix-kod, miqdor, o'lchov birligi, xarid narxi, jami summa
- [ ] Hujjat o'tkazilgandan keyin saldo tanlangan sklad bo'yicha oshadi
- [ ] Xarid tannarxi sebebiyat hisoblashga uzatiladi
- [ ] Qisman qabul qilish va haqiqatda qabul qilingan miqdorni qayd etish
- [ ] Noma'lum shtrix-kod: yangi tovar yaratish yoki mavjudga bog'lash
- [ ] Zakupka o'tkazilganda harakat va DDS (pul oqimi) yozuvlari yaratiladi
- [ ] Tuzatish: bekor qilish, qaytarish yoki tuzatuvchi hujjat

**Holatlari:** draft → awaiting_receipt → partially_received → posted → cancelled

**Qabul mezonlari:**
- Given bir nechta tovorli zakupka, when o'tkazilsa, then har sklad bo'yicha to'g'ri qoldiq oshadi
- Given qisman qabul, when qayd etilsa, then faqat haqiqatda qabul qilingan tovar hisobga olinadi

---

### TZ-07 Zhurnal dvizheniya tovarov

**Funksional talablar:**
- [ ] Jurnal: zakupka, sotuv, qaytarish, ta'minotchiga qaytarish, spisaniye, oprihodovaniye, tuzatish, ko'chirish, inventarizatsiya natijalari
- [ ] Har yozuv: sana/vaqt, tovar, sklad, operatsiyadan oldingi qoldiq, o'zgarish, operatsiyadan keyingi qoldiq, tannarx, foydalanuvchi, operatsiya turi
- [ ] Filtrlar: davr, sklad, tovar, kategoriya, operatsiya turi, xodim, hujjat
- [ ] Yozuvdan manba hujjatga o'tish imkoni

**Biznes qoidalari:**
- Harakat yozuvlarini qo'lda o'chirish yoki tahrirlash taqiqlanadi (immutable)
- Hujjat bekor qilinganda teskari harakat yozuvi hosil bo'ladi

**Qabul mezonlari:**
- Given qoldiq o'zgarishi, when bajarilsa, then jurnalda yozuv hosil bo'ladi
- Given jurnal yozuvi, when bosilsa, then manba hujjat ochiladi

---

### TZ-08 Peremeshchenie mezhdu skladami

**Funksional talablar:**
- [ ] Ko'chirish hujjati: jo'natuvchi sklad, qabul qiluvchi sklad, sana, mas'ul, izoh, tovarlar ro'yxati
- [ ] Qator: tovar, miqdor, partiya (kerak bo'lsa)
- [ ] O'tkazilgandan keyin jo'natuvchi saldosi kamayadi, qabul qiluvchi oshadi
- [ ] Jo'natish va qabul qilish bosqichlari qo'llab-quvvatlanadi (kerak bo'lsa)

**Holatlari:** draft → sent → partially_received → received → cancelled

**Qabul mezonlari:**
- Given ko'chirish hujjati, when ikki tomonlama tasdiqlansa, then ikkala saldo to'g'ri o'zgaradi

---

### TZ-09 Spisanie i oprihodovanie

**Funksional talablar:**
- [ ] Ikki turdagi operatsiya: spisaniye va oprihodovaniye
- [ ] Hujjat: sklad, sana, mas'ul, sabab, izoh, bir nechta tovar qatori
- [ ] Spisaniye sabablari: brak, muddati o'tgan, zarar, yo'qolish, kamomad, hisob xatosi, ichki foydalanish, marketing, assortimentdan chiqarish, foydalanuvchi sababi
- [ ] Oprihodovaniye sabablari: inventarizatsiya ortig'i, hisob tuzatish, mijoz qaytarishi, ta'minotchi qaytarish tuzatish, ichki ishlab chiqarish, foydalanuvchi sababi
- [ ] Operatsiyalar qo'lda yoki inventarizatsiya natijasida avtomatik yaratiladi

**Biznes qoidalari:**
- Sabab majburiy
- Spisaniye mavjud qoldiqdan oshmasligi kerak (maxsus ruxsatsiz)
- O'tkazilgandan keyin to'g'ridan-to'g'ri tahrirlash taqiqlanadi

**Qabul mezonlari:**
- Given spisaniye hujjati, when o'tkazilsa, then qoldiq kamayadi va sabab saqlanadi
- Given oprihodovaniye, when o'tkazilsa, then qoldiq oshadi

---

### TZ-10 Vozvrat postavshchiku

**Funksional talablar:**
- [ ] Qaytarish hujjati: ta'minotchi, sklad, sana, mas'ul, sabab, kompensatsiya usuli, izoh
- [ ] Mavjud zakupka asosida yoki mustaqil hujjat sifatida yaratilishi mumkin
- [ ] Tovarlar: miqdor, xarid tannarxi, manba zakupka havolasi
- [ ] Sabablari: brak, muddati o'tgan, noto'g'ri yetkazib berish, zarar, sifat muammosi, ortiqcha yetkazib berish, foydalanuvchi sababi
- [ ] Kompensatsiya usullari: pul qaytarish, tovar almashtirish, o'zaro hisob-kitob
- [ ] O'tkazilganda qoldiq kamayadi
- [ ] Pul qaytarish DDS'da, tovar almashtirish yangi qabul kutadi, o'zaro hisob-kitob hisoblarda aks etadi

**Holatlari:** draft → awaiting_shipment → shipped → completed → cancelled

**Qabul mezonlari:**
- Given ta'minotchiga qaytarish, when o'tkazilsa, then qoldiq kamayadi va jurnalda ko'rinadi
- Given kompensatsiya usuli, when tanlansa, then moliya hisoblari to'g'ri yangilanadi

---

### TZ-11 Kontrol ostatkov i potrebnost v zakupke

**Funksional talablar:**
- [ ] Har tovar uchun har sklad bo'yicha minimal qoldiq belgilanadi
- [ ] Tizim mavjud qoldiqni minimal daraj bilan taqqoslaydi
- [ ] Kamayib ketganda bildirishnoma va "Buyurtma kerak" ro'yxati
- [ ] Ro'yxat: tovar, sklad, joriy qoldiq, minimal qoldiq, tavsiya miqdori, ta'minotchi, oxirgi xarid narxi
- [ ] Ro'yxatdan zakupka drafti yaratish

**Biznes qoidalari:**
- Mavjud qoldiq hisobida rezerv hisobga olinishi mumkin
- Arxiv tovarlar ro'yxatga kiritilmaydi

**Qabul mezonlari:**
- Given tovar minimal qoldiqdan past tushsa, then "Buyurtma kerak" ro'yxatiga tushadi
- Given ro'yxatdan zakupka yaratilsa, then satrlar to'ldirilgan holda draft yaratiladi

---

### TZ-12 Inventarizatsiya

**Funksional talablar:**
- [ ] Inventarizatsiya hujjati: sklad, sana, kategoriyalar yoki tovarlar, mas'ul, hisoblash rejimi
- [ ] Jadval: tovar, foto, shtrix-kod, hisob miqdori, haqiqiy miqdor, farq, tafovut tannarxi
- [ ] Shtrix-kod skanerlash va qo'lda kiritish
- [ ] Har skanerlash haqiqiy miqdorni 1 ta yoki o'rash koeffitsiyentiga ko'paytirib oshiradi
- [ ] Qo'lda haqiqiy miqdorni tuzatish mumkin
- [ ] Nom, artikul, faol shtrix-kod bo'yicha qidiruv
- [ ] Ko'r rejim: hisob miqdori tugaguncha yashiriladi (optional)
- [ ] To'xtatib qo'yish va keyinroq davom etish
- [ ] Bir nechta xodim bilan ishlash — har yozuv muallifi qayd etiladi
- [ ] Skladi to'liq bloklash, faqat tanlangan kategoriyalarni bloklash, yoki ogohlantirish bilan ruxsat berish
- [ ] Tasdiqlash oldidan: tekshirilgan tovarlar, kamomad, ortig', tannarx ko'rsatiladi
- [ ] Tasdiqdan so'ng: kamomad → spisaniye, ortig' → oprihodovaniye

**Holatlari:** draft → in_progress → paused → pending_confirmation → completed → cancelled

**Qabul mezonlari:**
- Given inventarizatsiya, when skaner va qo'lda kiritish qo'llanilsa, then farq avtomatik hisoblanadi
- Given tasdiqlash, when bostirilsa, then bog'liq hujjatlar (spisaniye/oprihodovaniye) yaratiladi
- Given to'xtatish, when davom ettirilsa, then ma'lumotlar saqlanadi

---

### TZ-13 Novy tovar pri inventarizatsii

**Funksional talablar:**
- [ ] Noma'lum shtrix-kod: "Tovar topilmadi" xabari
- [ ] Harakatlar: yangi tovar yaratish, mavjudga bog'lash, vaqtinchalik pozitsiya, o'tkazib yuborish
- [ ] Yangi tovar qisqa formasi: nom, kategoriya, shtrix-kod, o'lchov birligi, haqiqiy miqdor, sklad, xarid tannarxi, sotuv narxi, ta'minotchi, izoh
- [ ] Saqlash: karta yaratiladi, tovar inventarizatsiyaga qo'shiladi, kod skanerlash uchun mavjud bo'ladi
- [ ] Inventarizatsiya tugagandan keyin: oprihodovaniye "Inventarizatsiyada topilgan yangi tovar" sababi bilan

**Biznes qoidalari:**
- Vaqtinchalik karta uchun minimal: nom/belgi, shtrix-kod, o'lchov birligi, miqdor
- Kod allaqachon mavjud bo'lsa bog'liq tovarga o'tish taklif etiladi

**Qabul mezonlari:**
- Given noma'lum shtrix-kod, when inventarizatsiyada skanerlansa, then tovar inventarizatsiyadan chiqmasdan yaratiladi
- Given inventarizatsiya yakunlangandan keyin, then yangi tovar uchun oprihodovaniye hosil bo'ladi

---

### TZ-14 Otchety

**Funksional talablar:**
- [ ] Barcha hisobotlar uchun filtrlar: davr, filial, sklad, kategoriya, tovar, ta'minotchi, xodim, operatsiya turi
- [ ] Excel eksport, saralash, guruhlash, manba hujjatga o'tish
- [ ] Hisobotlar: qoldiqlar, harakat, tovar savdosi, zakupka, ta'minotchilar, spisaniylar, inventarizatsiya, tannarx
- [ ] Dashboard: zaxira tannarxi, minimaldan past tovarlar, savdo, zakupka, spisaniye, yalpi foyda, so'nggi muhim operatsiyalar

**Qabul mezonlari:**
- Given hisobot ma'lumotlari, when ko'rilsa, then harakat jurnali va moliya hujjatlariga mos keladi
- Given aggregate qator, when bosilsa, then batafsil ma'lumot ochiladi

---

### TZ-15 Otchet po sebestoimosti i valovoy pribyli

**Funksional talablar:**
- [ ] Hisobot: kirim tovarlari, spisaniylar, ko'chirishlar, joriy qoldiqlar, sotilgan tovarlar tannarxi (COGS), yalpi foyda
- [ ] Har pozitsiya: miqdor, o'rtacha/haqiqiy tannarx, qoldiq tannarxi, tushum, marja
- [ ] Tannarx hisoblash usuli tizim sozlamalarida belgilanadi: o'rtacha og'irlik usuli
- [ ] Sklad ko'chirish foyda/zararni yaratmaydi
- [ ] Mijoz qaytarishi tannarxni tuzatadi; ta'minotchi qaytarishi zaxirani kamaytiradi

**Biznes qoidalari:**
- Tannarx usulini o'zgartirish maxsus protsedura talab etadi
- Moliya huquqisiz foydalanuvchilar xarid narxi, tannarx va marjani ko'rmaydi

**Qabul mezonlari:**
- Given joriy zaxira, when hisobot olinsa, then tanlangan usul bo'yicha tannarx ko'rsatiladi
- Given yalpi foyda, when hisoblanilsa, then tushum minus tannarx qiymatiga teng

---

### TZ-16 Finansovaya integratsiya

**Funksional talablar:**
- [ ] Zakupka to'lovi → DDS chiqim
- [ ] Sotuv → DDS kirim
- [ ] Ta'minotchi tomonidan pul qaytarishi → DDS kirim yoki chiqim kamaytirish
- [ ] Mijozga qaytarish → DDS chiqim yoki kirim kamaytirish
- [ ] Spisaniye → boshqaruv natijasiga ta'sir (yo'qotish yoki ichki xarajat)
- [ ] Barcha moliya yozuvlari manba hujjatga havola bo'ladi

**Biznes qoidalari:**
- Sklad va moliya holati alohida bo'lishi mumkin: tovar qabul qilindi, lekin to'lanmagan
- Hujjat bekor qilinganda bog'liq moliya yozuvlari faqat ruxsat berilgan stsenariyda tuzatiladi

**Qabul mezonlari:**
- Given sklad va moliya operatsiyalari, when bajarilsa, then manba hujjatlar bog'liq
- Given DDS summalar, when tekshirilsa, then zakupka, sotuv va qaytarishlarga mos

---

### TZ-17 Roli i prava dostupa

**Funksional talablar:**
- [ ] Huquqlar rol va xodim bo'yicha sozlanadi
- [ ] Ko'rish, yaratish, tahrirlash, o'tkazish, bekor qilish, eksport huquqlari alohida
- [ ] Huquqlar filial va sklad bilan chegaralanishi mumkin
- [ ] Xarid narxi, tannarx, marja, moliya integratsiyasi alohida nazorat qilinadi

**Qabul mezonlari:**
- Given foydalanuvchi roli, when tizimga kirsa, then faqat ruxsat etilgan sklad va harakatlarni ko'radi
- Given moliya huquqisiz foydalanuvchi, when tovar kartasini ko'rsa, then xarid narxi yashirilgan
- Given taqiqlangan operatsiya, when so'rov kelsa, then server tomonida 403 qaytariladi

---

### TZ-18 Zhurnal aktivnosti

**Funksional talablar:**
- [ ] Hujjatlar va ma'lumotnomalarda yaratish, tahrirlash, o'tkazish, bekor qilish, arxivlash loglanadi
- [ ] Muhim o'zgarishlarda: sana/vaqt, foydalanuvchi, ob'ekt, harakat, eski qiymat, yangi qiymat, izoh
- [ ] Alohida log: narx o'zgarishlari, shtrix-kodlar, inventarizatsiyadagi haqiqiy miqdor, spisaniye sabablari, huquqlar
- [ ] Log ob'ekt kartasidan va umumiy jurnaldan ko'rish mumkin
- [ ] Oddiy foydalanuvchilar logni o'chira yoki tahrirlaya olmaydi

**Qabul mezonlari:**
- Given har qanday muhim o'zgarish, when bajarilsa, then foydalanuvchi va vaqt bilan bog'lab topiladi
- Given audit yozuvi, when ko'rilsa, then eski va yangi qiymatlar ko'rinadi

---

### TZ-19 Obshchie NFR

**Funksional talablar:**
- [ ] Qoldiq o'zgarish operatsiyalari avtomatik bajariladi (atom transaktsiya)
- [ ] Bitta hujjatni ikki marta o'tkazish oldini olish (idempotensiya)
- [ ] Bir nechta foydalanuvchi parallel ishlashi (concurrency guard)
- [ ] Qidiruv va skanerlash sezilarli kechikishsiz (tipik hajmlarda)
- [ ] Interfeys kompyuter va planshetda to'g'ri ishlaydi
- [ ] Barcha sana/vaqt tashkilot vaqt mintaqasi bilan saqlanadi
- [ ] Eksport manba ma'lumotlarini o'zgartirmaydi

**Qabul mezonlari:**
- Given bitta buyruqning takroriy yuborilishi, when bajarilsa, then dublikat harakat yaratilmaydi
- Given parallel operatsiyalar, when bajarilsa, then ma'lumotlar yo'qolmaydi
- Given o'tkazish xatosi, when yuz bersa, then qisman o'zgartirilgan qoldiqlar qolmaydi
