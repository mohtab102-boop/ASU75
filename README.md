# كتاب ذكريات دفعة 75 طب عين شمس (نسخة مشتركة)

موقع ثابت على GitHub Pages، وكل تعديل نص أو صورة بيتحفظ في Supabase ويظهر لكل الدفعة فوراً.

## الإعداد (مرة واحدة)
1. ادخل على supabase.com وسجّل بحساب GitHub، واضغط New project (مجاني، من غير بطاقة).
2. بعد ما المشروع يجهز: SQL Editor ثم New query، والصق محتوى `schema.sql` واضغط Run.
3. من Project Settings ثم API انسخ **Project URL** و**anon public key**.
4. افتح `config.js` في الـ repo (القلم Edit) والصقهم بين علامات التنصيص، واضغط Commit.
5. افتح الموقع بعد دقيقة. أول ما تظهر رسالة «آخر نسخة جاهزة» يبقى الربط تمام.

## ملاحظات
- أي حد معاه الرابط يقدر يعدل. شارك الرابط مع الدفعة بس.
- لو حد خرّب نص أو صورة: Table Editor ثم `items_history` فيه كل القيم القديمة، وترجّعها بتعديل صف في `items`.
- الـ anon key مصمم يتحط في الموقع، فمش سر. ما تحطش service_role key هنا أبداً.
- PDF: زر «طباعة / PDF» ثم Save as PDF، مقاس A4، الهوامش None، وفعّل Background graphics.
- الخطوط من Google Fonts فمحتاج إنترنت.
