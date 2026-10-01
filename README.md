# SOLO STARS

## Ishga tushirish
1. `npm install`
2. `.env.example` ni `.env.local` ga nusxalang va to'ldiring:
   - `COINDROP_API_KEY` — CoinDrop kalitingiz (**eski kalitni almashtiring**, u oldin kodda ochiq edi)
   - `FIREBASE_SERVICE_ACCOUNT` — Firebase service account JSON (bir qatorda)
   - `ADMIN_PASSWORD` — yangi admin paroli (eskisi kodda ochiq edi)
3. Ishlab chiqish: `npm run dev`
4. Production: `npm run build && npm start`

## Buyurtma oqimi
Mijoz chek yuklaydi → buyurtma «Tekshirilmoqda» → admin chekni ko'radi:
- **Tasdiqlash & Tashlash**: API balansi bor bo'lsa CoinDrop orqali yuboriladi, bo'lmasa «Admin qo'lda bajaradi» holatiga o'tadi.
- **Qo'lda bajarildi**: admin o'zi yetkazgan bo'lsa shuni bosadi.
- API qotib qolsa: «Qayta Tekshir» yoki qo'lda bajarish.

## Firestore
`firestore.rules` ni Firebase Console → Firestore → Rules ga qo'ying (hamma to'g'ridan-to'g'ri kirishni yopadi). Buyurtmalar faqat server orqali yoziladi/o'qiladi.

## Vaqtincha o'chirilgan
Balans va balans to'ldirish (hamyon brauzerda edi, xavfsiz emas). Faqat kartaga to'lov + chek.
