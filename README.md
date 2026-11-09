# 🎭 MAFIYA — Onlayn Ko'p O'yinchili Real-Vaqt O'yini

Real vaqtda do'stlar bilan yoki butun dunyodagi o'yinchilar bilan brauzer orqali o'ynaladigan zamonaviy **"Mafiya" (ijtimoiy deduksiya)** veb-o'yini.

---

## 🌟 Asosiy Xususiyatlar

1. **Bosh sahifa**:
   - Ism (nickname) va qahramon avatari (8 xil ramziy avatar) tanlash.
   - Bir bosishda yangi xona yaratish yoki 5 xonali kod orqali mavjud xonaga qo'shilish.
   - Havola orqali to'g'ridan-to'g'ri kirish (`?room=KOD`).

2. **Lobbi va Sozlamalar**:
   - Xona kodi va havola nusxalash / ulashish tugmalari.
   - Xonadagi barcha o'yinchilarning real vaqtda jonli ro'yxati (Xost toji 👑, botlar 🤖, o'yinchi holatlari).
   - Xost uchun qulay boshqaruv:
     - Mafiya sonini sozlash (1, 2, 3...)
     - Shifokor (Doktor) rolini yoqish/o'chirish
     - Komissar (Detektiv) rolini yoqish/o'chirish
     - Faza vaqtlarini sozlash (Tun, Muhokama, Ovoz berish)
     - **Sinov uchun Botlar qo'shish (+ Bot)**: Do'stlar yetarli bo'lmaganda yoki o'yinni yakka o'zingiz darhol sinab ko'rish uchun aqlli botlarni qo'shish imkoniyati.

3. **Maxfiy Rollar va Rol Ochilish Animatsiyasi**:
   - Server tomonda 100% xavfsiz va tasodifiy taqsimot.
   - Har bir o'yinchi faqat o'zining rolini ko'radi (3D karta animatsiyasi bilan).
   - **Mafiya**: Sheriklarining ismlarini biladi, tunda maxfiy chat orqali qurbon tanlaydi.
   - **Shifokor**: Har kecha bitta odamni mafiya hujumidan qutqaradi.
   - **Komissar**: Tunda gumonlanuvchini tekshirib, uning mafiya ekanligini darhol bilib oladi.
   - **Tinch aholi**: Kunduzgi munozarada va ovoz berishda mafiyani fosh qiladi.

4. **Kecha Fazasi (Tun)**:
   - Maxsus qorong'i atmosferik vizual effektlar va katta raqamli SVG progress taymer.
   - Mafiyalar uchun **Maxfiy Tungi Chat** va nishon tanlash.
   - Shifokor va Komissarning interaktiv kartalar orqali o'z harakatini bajarishi.
   - Barcha rollar o'z harakatini bajarganda vaqtni behuda kutmasdan avtomatik tezlatish (Fast-forward).

5. **Kunduz Fazasi (Tong va Muhokama)**:
   - Tong otishi va tungi qurbon (yoki shifokor qutqarganligi) haqidagi e'lon.
   - Umumiy ochiq shahar chati va jonli munozara.
   - O'lgan o'yinchilar "Ruh" (Ghost 👻) holatida kuzatish va chatda gaplashish imkoniyati.

6. **Linch Sudi (Ovoz Berish Fazasi)**:
   - Jonli ovoz berish: har bir o'yinchining to'plagan ovozlari real vaqtda kartalarda ko'rinadi.
   - Ovoz berishni o'tkazib yuborish ("Skip") imkoniyati.
   - Eng ko'p ovoz to'plagan o'yinchi chiqarib yuboriladi va uning haqiqiy roli e'lon qilinadi.

7. **G'alaba va Natijalar**:
   - Tinch aholi g'alabasi (barcha mafiyalar yo'q qilinganda).
   - Mafiya g'alabasi (mafiyalar soni fuqarolarga teng yoki ko'p bo'lganda).
   - Barcha o'yinchilarning to'liq haqiqiy rollari va holatlari ro'yxati.
   - Xost uchun "Yana o'ynash" tugmasi — xonani qayta lobbi holatiga o'tkazadi.

8. **Internet Uzilishiga Chidamlilik (Reconnect)**:
   - Brauzer yangilansa (F5) yoki internet uzilib qayta ulansa, o'yinchi o'z xonasiga, roliga va holatiga hech narsa yo'qotmasdan qaytadi.

9. **Tovush Effektlari**:
   - Web Audio API orqali generatsiya qilinadigan tovushlar (tungi g'o'ng'illash, tonggi ohang, zarb, taymer tick-tock, g'alaba musiqasi). Hech qanday tashqi audio fayl yuklanishiga bog'liq emas.

---

## 🚀 Ishga Tushirish

### 1. Talablar:
- [Node.js](https://nodejs.org/) (v16 yoki undan yuqori)

### 2. O'rnatish va Ishga Tushirish:
Loyihaning asosiy papkasida terminalni oching va quyidagi buyruqni bering:

```bash
npm start
```

Server ishga tushgach, brauzeringizda quyidagi manzilni oching:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 👥 Do'stlar Bilan O'ynash Yo'llari

### 1. Bitta Wi-Fi (Lokal Tarmoq) Orqali:
Agar siz va do'stlaringiz bitta Wi-Fi tarmog'iga ulangan bo'lsangiz:
1. Kompyuteringizning mahalliy IP manzilini bilib oling (masalan, Windows terminalida `ipconfig` buyrug'i orqali `IPv4 Address: 192.168.1.5`).
2. Do'stlaringiz o'z telefonlari yoki noutbuklarida brauzerdan quyidagi manzilga kiradilar:
   `http://192.168.1.5:3000`
3. Siz yaratgan xona kodini kiritib, birga o'ynayverasizlar!

### 2. Internet Orqali (Dunyoning istalgan nuqtasidan):
1. **Bepul tunnel (masalan ngrok yoki localtunnel)**:
   ```bash
   npx localtunnel --port 3000
   ```
   Hosil bo'lgan havolani do'stlaringizga yuborasiz.
2. **Bepul bulutli serverga yuklash (Deploy)**:
   - [Render.com](https://render.com)
   - [Railway.app](https://railway.app)
   Loyihani GitHub'ga yuklab, Render yoki Railway'ga bir necha bosishda joylashtirish mumkin.

---

## 🛠 Texnologiyalar
- **Frontend**: HTML5, Modern CSS3 (CSS Variables, Flexbox, Grid, Glassmorphism), Vanilla JavaScript ES6+
- **Backend**: Node.js, Express.js
- **Real-Vaqt Aloqa**: Socket.io
- **Audio**: Web Audio API (Sintezator tovushlari)
