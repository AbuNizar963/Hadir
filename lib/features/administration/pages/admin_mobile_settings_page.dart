import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AdminMobileSettingsPage extends StatelessWidget {
  const AdminMobileSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 24, 18, 28),
        children: [
          Text(
            'HADIR  ·  OWNER',
            textDirection: TextDirection.ltr,
            style: TextStyle(
              color: scheme.onSurfaceVariant,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            'الإعدادات',
            style: TextStyle(
              color: scheme.onSurface,
              fontSize: 28,
              height: 1.1,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            'إدارة النظام والهوية والمواقع والحسابات والأمان',
            style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11.5, height: 1.5),
          ),
          const SizedBox(height: 18),
          _companyCard(context),
          const SizedBox(height: 14),
          Text(
            'الإعدادات',
            style: TextStyle(color: scheme.onSurface, fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            'اختر قسمًا لفتح واجهته الإدارية',
            style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10.5),
          ),
          const SizedBox(height: 9),
          _section(context, Icons.person_outline_rounded, 'الهوية والحسابات', 'هوية الشركة وحسابات الإدارة'),
          _section(context, Icons.location_on_outlined, 'المواقع و QR', 'مواقع العمل ورموز QR'),
          _section(context, Icons.admin_panel_settings_outlined, 'الأمان والصلاحيات', 'الحسابات والصلاحيات الإدارية'),
          _section(context, Icons.tune_rounded, 'المتقدم والتشخيص', 'التشخيص وإعادة التهيئة والأدوات المتقدمة'),
          const SizedBox(height: 18),
          SizedBox(
            height: 48,
            child: FilledButton.icon(
              onPressed: () => context.pop(),
              icon: const Icon(Icons.check_rounded, size: 19),
              label: const Text('حفظ الإعدادات', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _companyCard(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .42),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: scheme.primary.withValues(alpha: .20)),
        boxShadow: [
          BoxShadow(color: scheme.primary.withValues(alpha: .06), blurRadius: 20, spreadRadius: 1),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 86,
            height: 86,
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: .10),
              shape: BoxShape.circle,
              border: Border.all(color: scheme.primary.withValues(alpha: .35), width: 1.5),
            ),
            child: Icon(Icons.business_rounded, color: scheme.primary, size: 42),
          ),
          const SizedBox(height: 10),
          Text('قسم شرطة الشهباء', style: TextStyle(color: scheme.onSurface, fontSize: 19, fontWeight: FontWeight.w900)),
          const SizedBox(height: 3),
          Text('هوية الشركة · الإعدادات المركزية', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10.5)),
          const SizedBox(height: 6),
          Text('تغيير الشعار', style: TextStyle(color: scheme.error, fontSize: 10, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _section(BuildContext context, IconData icon, String title, String subtitle) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .40),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .55)),
      ),
      child: ListTile(
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(icon, color: scheme.primary, size: 21),
        ),
        title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900)),
        subtitle: Text(subtitle, style: TextStyle(fontSize: 10, color: scheme.onSurfaceVariant)),
        trailing: Icon(Icons.chevron_left_rounded, color: scheme.onSurfaceVariant, size: 20),
      ),
    );
  }
}
