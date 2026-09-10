import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/hadir_theme_controller.dart';
import '../../../pages/notifications_page.dart';

class AdminMobileShell extends StatelessWidget {
  const AdminMobileShell({super.key, required this.child});

  final Widget child;

  int _selectedIndex(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/admin' || path == '/manager') return 0;
    if (path == '/manager/requests') return 1;
    if (path == '/admin/manage' || path == '/manager/employees' || path == '/manager/employees/transfer') return 2;
    if (path == '/admin/audit' || path == '/manager/audit') return 3;
    if (path == '/admin/reports' || path == '/manager/reports') return 4;
    return -1;
  }

  void _go(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go('/manager');
      case 1:
        context.go('/manager/requests');
      case 2:
        context.go('/manager/employees');
      case 3:
        context.go('/manager/audit');
      case 4:
        context.go('/manager/reports');
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedIndex(context);
    final theme = Theme.of(context);
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              _header(context),
              _navigation(context, selected),
              Expanded(child: child),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 390;
    final scheme = Theme.of(context).colorScheme;
    return Container(
      constraints: const BoxConstraints(minHeight: 72),
      padding: EdgeInsets.fromLTRB(compact ? 8 : 12, 7, compact ? 8 : 12, 7),
      decoration: BoxDecoration(
        color: scheme.surface.withValues(alpha: .96),
        border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .65))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Container(
                  width: compact ? 34 : 38,
                  height: compact ? 34 : 38,
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: .10),
                    shape: BoxShape.circle,
                    border: Border.all(color: scheme.primary.withValues(alpha: .55), width: 1.2),
                  ),
                  child: Icon(Icons.wb_sunny_rounded, color: scheme.primary, size: compact ? 20 : 22),
                ),
                const SizedBox(width: 7),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'حاضر',
                      style: TextStyle(color: scheme.onSurface, fontSize: compact ? 18 : 20, height: 1, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'HADIR  •  v1.1',
                      textDirection: TextDirection.ltr,
                      style: TextStyle(color: scheme.onSurfaceVariant, fontSize: compact ? 8 : 9, fontWeight: FontWeight.w700, letterSpacing: .35),
                    ),
                  ],
                ),
              ],
            ),
          ),
          _headerButton(context, icon: Icons.menu_rounded, label: 'القائمة', compact: compact, onTap: () => _showOptions(context)),
          const SizedBox(width: 4),
          _headerButton(context, icon: Icons.notifications_none_rounded, label: 'الإشعارات', compact: compact, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const _AdminNotificationsPage()))),
          const SizedBox(width: 4),
          _headerButton(context, icon: Icons.wb_sunny_outlined, label: 'الطقس', compact: compact, onTap: () => context.push('/weather')),
        ],
      ),
    );
  }

  Widget _navigation(BuildContext context, int selected) {
    final scheme = Theme.of(context).colorScheme;
    final items = const [
      (Icons.dashboard_outlined, Icons.dashboard_rounded, 'لوحة القيادة'),
      (Icons.assignment_outlined, Icons.assignment_rounded, 'إدارة الطلبات'),
      (Icons.groups_outlined, Icons.groups_rounded, 'الموظفون'),
      (Icons.fact_check_outlined, Icons.fact_check_rounded, 'سجل التدقيق'),
      (Icons.bar_chart_outlined, Icons.bar_chart_rounded, 'التقارير'),
    ];
    return Container(
      height: 54,
      decoration: BoxDecoration(
        color: scheme.surface.withValues(alpha: .98),
        border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .65))),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 3),
        itemBuilder: (context, index) {
          final item = items[index];
          final active = selected == index;
          return InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => _go(context, index),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              constraints: const BoxConstraints(minWidth: 82),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: active ? scheme.primary.withValues(alpha: .13) : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: active ? scheme.primary.withValues(alpha: .35) : Colors.transparent, width: 1.1),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(active ? item.$2 : item.$1, color: active ? scheme.primary : scheme.onSurfaceVariant, size: 20),
                  const SizedBox(height: 1),
                  Text(item.$3, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: active ? scheme.primary : scheme.onSurfaceVariant, fontSize: 11, fontWeight: active ? FontWeight.w900 : FontWeight.w700)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _headerButton(BuildContext context, {required IconData icon, required String label, required bool compact, required VoidCallback onTap}) {
    final scheme = Theme.of(context).colorScheme;
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: scheme.onSurface,
        fixedSize: Size(compact ? 70 : 80, 48),
        padding: EdgeInsets.zero,
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: .85)),
        backgroundColor: scheme.surface.withValues(alpha: .55),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 20),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, height: 1)),
        ],
      ),
    );
  }

  Future<void> _showOptions(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(alignment: Alignment.centerRight, child: Text('القائمة', style: TextStyle(color: Theme.of(sheetContext).colorScheme.onSurface, fontSize: 19, fontWeight: FontWeight.w900))),
              const SizedBox(height: 10),
              _themeSelector(sheetContext),
              _optionTile(sheetContext, Icons.notifications_none_rounded, 'الإشعارات', 'الإشعارات الإدارية والتنبيهات', '/notifications'),
              _optionTile(sheetContext, Icons.groups_outlined, 'نقل الموظفين الذكي', 'استيراد وتصدير الموظفين مع المعاينة والتحقق', '/manager/employees/transfer'),
              _optionTile(sheetContext, Icons.fact_check_outlined, 'سجل التدقيق', 'مراجعة العمليات والأحداث الإدارية', '/admin/audit'),
              _optionTile(sheetContext, Icons.archive_outlined, 'أرشيف التقارير', 'التقارير المحفوظة والأرشيف', '/admin/reports/archive'),
              _optionTile(sheetContext, Icons.psychology_outlined, 'المساعد الذكي', 'المساعد والتحليلات الذكية', '/ai'),
              _optionTile(sheetContext, Icons.wb_sunny_outlined, 'الطقس', 'حالة الطقس والخدمات المرتبطة بالموقع', '/weather'),
              _optionTile(sheetContext, Icons.explore_outlined, 'القبلة', 'اتجاه القبلة والخدمات المكانية', '/prayer'),
              _optionTile(sheetContext, Icons.settings_outlined, 'الإعدادات', 'إعدادات النظام والإدارة', '/admin/settings'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _themeSelector(BuildContext context) {
    return AnimatedBuilder(
      animation: HadirThemeController.instance,
      builder: (context, _) {
        final scheme = Theme.of(context).colorScheme;
        final controller = HadirThemeController.instance;
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: DropdownButtonFormField<ThemeMode>(
            initialValue: controller.mode,
            decoration: InputDecoration(labelText: 'مظهر التطبيق', prefixIcon: const Icon(Icons.brightness_6_outlined), filled: true, fillColor: scheme.surfaceContainerHighest.withValues(alpha: .45)),
            items: const [
              DropdownMenuItem(value: ThemeMode.system, child: Text('تلقائي حسب الجهاز')),
              DropdownMenuItem(value: ThemeMode.light, child: Text('الوضع الفاتح')),
              DropdownMenuItem(value: ThemeMode.dark, child: Text('الوضع الداكن')),
            ],
            onChanged: (mode) { if (mode != null) controller.setMode(mode); },
          ),
        );
      },
    );
  }

  Widget _optionTile(BuildContext context, IconData icon, String title, String subtitle, String route) {
    final scheme = Theme.of(context).colorScheme;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 6),
      leading: Container(width: 44, height: 44, decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: scheme.primary)),
      title: Text(title, style: TextStyle(color: scheme.onSurface, fontWeight: FontWeight.w900)),
      subtitle: Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10.5)),
      trailing: Icon(Icons.chevron_left_rounded, color: scheme.onSurfaceVariant),
      onTap: () {
        Navigator.of(context).pop();
        if (route == '/notifications') {
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const _AdminNotificationsPage()));
        } else {
          context.push(route);
        }
      },
    );
  }
}

class _AdminNotificationsPage extends StatelessWidget {
  const _AdminNotificationsPage();
  @override
  Widget build(BuildContext context) => const NotificationsPage();
}
