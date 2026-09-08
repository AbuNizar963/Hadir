# حاضر (Hadir)

تطبيق حضور وانصراف مبني بالكامل باستخدام **Flutter** على فرع `Apps`.

## البنية

- Flutter app: `android/`, `ios/`, `lib/`, `test/`, `pubspec.yaml`
- Backend: `backend/`
- Cloudflare/functions infrastructure: `functions/`
- Documentation: `docs/`

## التشغيل

```bash
flutter pub get
flutter analyze
flutter test
flutter run
```

## أهم وظائف التطبيق

- تسجيل دخول الموظف والإدارة والمدير
- الحضور والانصراف باستخدام QR وGPS
- التحقق من موقع العمل ونطاقه
- الإشعارات
- الطلبات
- سجل الحضور والتحليلات
- إدارة الموظفين والقوى العاملة
- التقارير والتصدير والأرشيف
- التدقيق Audit
- الملف الشخصي والصورة
- الخدمات والمساعد الذكي

الواجهة السابقة المبنية بـ React/Vite لم تعد جزءًا من تطبيق `Apps`.
