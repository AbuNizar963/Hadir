import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/hadir_theme_controller.dart';

/// Android/iOS employee shell.
///
/// Uses the same navigation placement as the manager shell: a compact
/// branded header at the top and a five-item bottom navigation bar.
/// Existing employee routes and functionality remain unchanged.
class EmployeeMobileShell extends StatelessWidget {
  const EmployeeMobileShell({super.key, required this.child});
  final Widget child;

  int _selectedIndex(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/employee' || path == '/home') return 0;
    if (path == '/employee/center' || path == '/center' || path == '/employee/premium') return 1;
    if (path == '/employee/history' || path == '/history') return 2;
    if (path == '/employee/profile' || path == '/profile') return 3;
    return 4;
  }

  void _go(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go('/employee');
      case 1:
        context.go('/employee/center');
      case 2:
        context.go('/employee/history');
      case 3:
        context.go('/employee/profile');
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
          child: Column(
            children: [
              _header(context),
              Expanded(child: child),
            ],
          ),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: selected,
          onDestinationSelected: (index) => _go(context, index),
          backgroundColor: scheme.surface,
          indicatorColor: scheme.primary.withValues(alpha: .12),
          height: 74,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            NavigationDestination(icon: const Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded, color: scheme.primary), label: 'لوحة الموظف'),
            NavigationDestination(icon: const Icon(Icons.business_center_outlined), selectedIcon: Icon(Icons.business_center_rounded, color: scheme.primary), label: 'مركز الموظف'),
            NavigationDestination(icon: const Icon(Icons.access_time_outlined), selectedIcon: Icon(Icons.access_time_filled, color: scheme.primary), label: 'سجل العمل'),
            NavigationDestination(icon: const Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded, color: scheme.primary), label: 'الملف الشخصي'),
            NavigationDestination(icon: const Icon(Icons.more_horiz_rounded), selectedIcon: Icon(Icons.more_horiz_rounded, color: scheme.primary), label: 'المزيد'),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 430;
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: EdgeInsets.fromLTRB(compact ? 10 : 14, 10, compact ? 10 : 14, 9),
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(bottom: BorderSide(color: scheme.outlineVariant)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Container(
                  width: compact ? 40 : 42,
                  height: compact ? 40 : 42,
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: .10),
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(color: scheme.primary.withValues(alpha: .20)),
                  ),
                  child: Icon(Icons.how_to_reg_rounded, color: scheme.primary, size: 25),
                ),
                const SizedBox(width: 9),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('حاضر', style: TextStyle(color: scheme.onSurface, fontSize: 22, height: 1, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text('HADIR  •  v1.1', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5, letterSpacing: 1.1, fontWeight: FontWeight.w700)),
                  ],
                ),
              ],
            ),
          ),
          _headerButton(
            context,
            Icons.notifications_none_rounded,
            'الإشعارات',
            () => context.push('/employee/notifications'),
            compact: compact,
          ),
          SizedBox(width: compact ? 5 : 7),
          _headerButton(
            context,
            Icons.menu_rounded,
            'الخيارات',
            () => _showOptions(context),
            compact: compact,
          ),
        ],
      ),
    );
  }

  Widget _headerButton(
    BuildContext context,
    IconData icon,
    String label,
    VoidCallback onTap, {
    required bool compact,
  }) {
    final scheme = Theme.of(context).colorScheme;
    return IconButton(
      onPressed: onTap,
      tooltip: label,
      visualDensity: VisualDensity.compact,
      constraints: const BoxConstraints(minWidth: 42, minHeight: 42),
      padding: EdgeInsets.zero,
      style: IconButton.styleFrom(
        foregroundColor: scheme.onSurface,
        backgroundColor: compact ? scheme.primary.withValues(alpha: .08) : Colors.transparent,
        side: compact ? BorderSide(color: scheme.outlineVariant) : null,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
      ),
      icon: Icon(icon, size: 21),
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
              Align(
                alignment: Alignment.centerRight,
                child: Text('الخيارات', style: TextStyle(color: Theme.of(sheetContext).colorScheme.onSurface, fontSize: 19, fontWeight: FontWeight.w900)),
              ),
              const SizedBox(height: 10),
              _themeSelector(sheetContext),
              _optionTile(sheetContext, Icons.wb_sunny_outlined, 'الطقس', 'حالة الطقس والخدمات المرتبطة بالموقع', '/weather'),
              _optionTile(sheetContext, Icons.explore_outlined, 'القبلة', 'اتجاه القبلة والخدمات المكانية', '/prayer'),
              _optionTile(sheetContext, Icons.settings_outlined, 'الإعدادات', 'إعدادات حساب الموظف', '/employee/center'),
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
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(14)),
        child: Icon(icon, color: scheme.primary),
      ),
      title: Text(title, style: TextStyle(color: scheme.onSurface, fontWeight: FontWeight.w900)),
      subtitle: Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10.5)),
      trailing: Icon(Icons.chevron_left_rounded, color: scheme.onSurfaceVariant),
      onTap: () {
        Navigator.of(context).pop();
        context.push(route);
      },
    );
  }
}
