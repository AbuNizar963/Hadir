import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/hadir_theme_controller.dart';
import '../../../pages/notifications_page.dart';

class AdminMobileShell extends StatelessWidget {
  const AdminMobileShell({super.key, required this.child});

  final Widget child;

  int _selectedIndex(BuildContext context) {
    final uri = GoRouterState.of(context).uri;
    if (uri.path == '/admin') return 0;
    if (uri.path == '/manager/requests') return 1;
    if (uri.path == '/admin/manage' || uri.path == '/manager/employees') return 2;
    if (uri.path == '/admin/reports' || uri.path == '/admin/reports/archive' || uri.path == '/manager/reports' || uri.path == '/manager/report-archive') return 3;
    return 4;
  }

  void _go(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go('/admin');
      case 1:
        context.go('/manager/requests');
      case 2:
        context.go('/admin/manage');
      case 3:
        context.go('/admin/reports');
      case 4:
        _showOptions(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedIndex(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: SafeArea(
          bottom: false,
          child: Column(children: [_header(context), Expanded(child: child)]),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: selected,
          onDestinationSelected: (index) => _go(context, index),
          backgroundColor: scheme.surface,
          indicatorColor: scheme.primary.withValues(alpha: .12),
          height: 74,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            NavigationDestination(icon: const Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded, color: scheme.primary), label: 'لوحة القيادة'),
            NavigationDestination(icon: const Icon(Icons.assignment_outlined), selectedIcon: Icon(Icons.assignment_rounded, color: scheme.primary), label: 'إدارة الطلبات'),
            NavigationDestination(icon: const Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups_rounded, color: scheme.primary), label: 'الموظفون'),
            NavigationDestination(icon: const Icon(Icons.bar_chart_outlined), selectedIcon: Icon(Icons.bar_chart_rounded, color: scheme.primary), label: 'التقارير'),
            NavigationDestination(icon: const Icon(Icons.more_horiz_rounded), selectedIcon: Icon(Icons.more_horiz_rounded, color: scheme.primary), label: 'المزيد'),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 390;
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: EdgeInsets.fromLTRB(compact ? 12 : 14, 10, compact ? 12 : 14, 9),
      decoration: BoxDecoration(color: scheme.surface, border: Border(bottom: BorderSide(color: scheme.outlineVariant))),
      child: Row(children: [
        Expanded(child: Row(children: [
          Container(
            width: compact ? 40 : 44,
            height: compact ? 40 : 44,
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(compact ? 13 : 15),
              border: Border.all(color: scheme.primary.withValues(alpha: .20)),
            ),
            child: Icon(Icons.how_to_reg_rounded, color: scheme.primary, size: compact ? 23 : 25),
          ),
          const SizedBox(width: 9),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('حاضر', style: TextStyle(color: scheme.onSurface, fontSize: 22, height: 1, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text('نظام حضور وانصراف موثّق', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5, fontWeight: FontWeight.w600)),
          ]),
        ])),
        _headerButton(context, icon: Icons.notifications_none_rounded, label: 'الإشعارات', compact: compact, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const _AdminNotificationsPage()))),
        const SizedBox(width: 7),
        _headerButton(context, icon: Icons.menu_rounded, label: 'الخيارات', compact: compact, onTap: () => _showOptions(context)),
      ]),
    );
  }

  Widget _headerButton(BuildContext context, {required IconData icon, required String label, required bool compact, required VoidCallback onTap}) {
    final scheme = Theme.of(context).colorScheme;
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: scheme.onSurface,
        padding: EdgeInsets.symmetric(horizontal: compact ? 9 : 11, vertical: compact ? 9 : 10),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        side: BorderSide(color: scheme.outlineVariant),
        backgroundColor: scheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: compact ? 20 : 21), if (!compact) ...[const SizedBox(width: 6), Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800))]]),
    );
  }

  Future<void> _showOptions(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (sheetContext) => SafeArea(child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Align(alignment: Alignment.centerRight, child: Text('الخيارات', style: TextStyle(color: Theme.of(sheetContext).colorScheme.onSurface, fontSize: 19, fontWeight: FontWeight.w900))),
          const SizedBox(height: 10),
          _themeSelector(sheetContext),
          _optionTile(sheetContext, Icons.notifications_none_rounded, 'الإشعارات', 'الإشعارات الإدارية والتنبيهات', '/notifications'),
          _optionTile(sheetContext, Icons.fact_check_outlined, 'سجل التدقيق', 'مراجعة العمليات والأحداث الإدارية', '/admin/audit'),
          _optionTile(sheetContext, Icons.archive_outlined, 'أرشيف التقارير', 'التقارير المحفوظة والأرشيف', '/admin/reports/archive'),
          _optionTile(sheetContext, Icons.psychology_outlined, 'المساعد الذكي', 'المساعد والتحليلات الذكية', '/ai'),
          _optionTile(sheetContext, Icons.wb_sunny_outlined, 'الطقس', 'حالة الطقس والخدمات المرتبطة بالموقع', '/weather'),
          _optionTile(sheetContext, Icons.explore_outlined, 'القبلة', 'اتجاه القبلة والخدمات المكانية', '/prayer'),
          _optionTile(sheetContext, Icons.settings_outlined, 'الإعدادات', 'إعدادات النظام والإدارة', '/admin/settings'),
        ]),
      )),
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
            decoration: InputDecoration(
              labelText: 'مظهر التطبيق',
              prefixIcon: const Icon(Icons.brightness_6_outlined),
              filled: true,
              fillColor: scheme.surfaceContainerHighest.withValues(alpha: .45),
            ),
            items: const [
              DropdownMenuItem(value: ThemeMode.system, child: Text('تلقائي حسب الجهاز')),
              DropdownMenuItem(value: ThemeMode.light, child: Text('الوضع الفاتح')),
              DropdownMenuItem(value: ThemeMode.dark, child: Text('الوضع الداكن')),
            ],
            onChanged: (mode) {
              if (mode != null) {
                controller.setMode(mode);
              }
            },
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
