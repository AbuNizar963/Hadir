import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AdminMobileSettingsPage extends StatelessWidget {
  const AdminMobileSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('الإعدادات'),
          leading: IconButton(
            tooltip: 'رجوع',
            onPressed: () => context.canPop() ? context.pop() : context.go('/manager'),
            icon: const Icon(Icons.arrow_back_rounded),
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
          children: [
            Text('إعدادات النظام', style: TextStyle(color: scheme.onSurface, fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text('إدارة إعدادات HADIR من داخل تطبيق Flutter.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
            const SizedBox(height: 18),
            _section(context, Icons.tune_rounded, 'عام', 'الإعدادات الأساسية للنظام'),
            _section(context, Icons.location_on_outlined, 'المواقع', 'إدارة مواقع العمل ومواقع الحضور'),
            _section(context, Icons.admin_panel_settings_outlined, 'الحسابات والصلاحيات', 'إدارة حسابات المديرين والمشرفين'),
            _section(context, Icons.business_outlined, 'الشركة والتخصصات', 'بيانات الشركة والتخصصات والشعار'),
            _section(context, Icons.build_circle_outlined, 'متقدم', 'التشخيص وإعادة التهيئة والأدوات المتقدمة'),
          ],
        ),
      ),
    );
  }

  Widget _section(BuildContext context, IconData icon, String title, String subtitle) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .55),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .65)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(icon, color: scheme.primary, size: 23),
        ),
        title: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
        subtitle: Text(subtitle, style: TextStyle(fontSize: 10.5, color: scheme.onSurfaceVariant)),
        trailing: Icon(Icons.chevron_left_rounded, color: scheme.onSurfaceVariant),
      ),
    );
  }
}
