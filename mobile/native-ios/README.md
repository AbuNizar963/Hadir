# حاضر — Native iOS

هذا المشروع هو عميل iPhone أصلي مستقل لتطبيق HADIR، وليس WebView أو TWA.

- Swift + SwiftUI
- يتصل مباشرة بـ `https://hadir-api.abunizar963.workers.dev`
- يدعم تسجيل دخول الموظف وحفظ الجلسة في Keychain
- البنية مجهزة لإضافة QR/GPS/Face ID/الإشعارات والمزامنة دون تغيير الـ backend
- يفضل فتح هذا المجلد كمشروع Xcode، ثم إنشاء Target باسم `HadirNative` باستخدام ملفات Swift الموجودة هنا.

الحد الأدنى المقترح حاليًا: iOS 15.0؛ الميزات التي تتطلب APIs أحدث تُفعل بشكل مشروط.
