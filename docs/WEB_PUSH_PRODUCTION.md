# تشغيل Web Push في الإنتاج

نظام Web Push موجود في المشروع بالفعل: زر الجرس في الواجهة يستدعي طلب إذن المتصفح، ثم يسجل اشتراك Push في الـ Worker، وعند إنشاء إشعار للمستخدم يحاول الـ Worker إرساله إلى أجهزته المسجلة.

## المطلوب مرة واحدة فقط

مفاتيح VAPID هي هوية الخادم الذي يرسل الإشعارات. يجب إنشاء زوج واحد والاحتفاظ به وعدم تغييره بعد بدء الاستخدام؛ تغيير المفتاح العام/الخاص يسبب اشتراكات قديمة غير صالحة.

### 1. إنشاء المفاتيح

من جذر المشروع:

```bash
cd backend
bun install
bun run scripts/generate-vapid.mjs
```

سيظهر:

- `publicKey`: المفتاح العام.
- `privateKey`: المفتاح الخاص.
- `subject`: عنوان تواصل VAPID.

يمكن أيضاً استخدام مولد VAPID من الحزمة نفسها؛ الحزمة الحالية في المشروع تدعم `generateVapidKeys()` وتعمل مع Cloudflare Workers.

### 2. وضع المفاتيح في Cloudflare Worker

**لا تضع `VAPID_PRIVATE_KEY` داخل GitHub أو `wrangler.jsonc`.** أضفها كـ Worker Secrets:

```bash
cd backend
bunx wrangler secret put VAPID_PRIVATE_KEY
bunx wrangler secret put VAPID_PUBLIC_KEY
bunx wrangler secret put VAPID_SUBJECT
```

عند كل أمر، الصق القيمة المناسبة التي خرجت من مولد المفاتيح.

يمكن التأكد من وجود الإعداد من خلال endpoint:

`GET https://hadir-api.abunizar963.workers.dev/api/push/public-key`

عند نجاح الإعداد يجب أن يعيد `configured: true` ويعيد المفتاح العام فقط. المفتاح الخاص لا يعاد أبداً من الـ API.

### 3. البيئة المحلية

انسخ `backend/.dev.vars.example` إلى `backend/.dev.vars` وضع القيم الحقيقية فيه. ملف `.dev.vars` محلي ولا يجب رفعه إلى Git.

### 4. لا تحتاج إلى إضافة خيار جديد في الواجهة

السلوك المقصود هو الضغط على **أيقونة الإشعارات الموجودة حالياً**. عند أول ضغط، إذا كانت صلاحية المتصفح `default`، سيظهر مربع النظام الخاص بالمتصفح للسماح بالإشعارات. بعد الموافقة يتم إنشاء Push Subscription وإرساله للـ Worker.

لا توجد خانة إعدادات إضافية للمستخدم.

### 5. ملاحظات مهمة

- يجب أن يعمل الموقع عبر HTTPS، وهو متحقق على GitHub Pages.
- يجب أن يبقى `VAPID_PUBLIC_KEY` و`VAPID_PRIVATE_KEY` زوجاً واحداً ثابتاً.
- `VAPID_PRIVATE_KEY` سر إنتاجي؛ لا تسجله في logs ولا تضعه في ملفات المصدر.
- إذا رفض المستخدم الإذن، لا يعاد إجباره تلقائياً؛ يمكنه تغيير إذن الإشعارات من إعدادات المتصفح.
- إذا أصبح اشتراك Push غير صالح (`404` أو `410`)، يحذفه الـ Worker تلقائياً من D1.
