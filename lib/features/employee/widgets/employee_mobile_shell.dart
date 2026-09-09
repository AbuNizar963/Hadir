import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/hadir_theme_controller.dart';

/// Android/iOS employee shell.
///
/// Mirrors the website structure: a compact utility header followed by the
/// employee navigation row. Existing employee routes and functionality remain
/// unchanged.
class EmployeeMobileShell extends StatelessWidget {
  const EmployeeMobileShell({super.key, required this.child});
  final Widget child;

  int _selectedIndex(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/employee' || path == '/home') return 0;
    if (path == '/employee/center' || path == '/center' || path == '/employee/premium') return 1;
    if (path == '/employee/history' || path == '/history') return 2;
    if (path == '/employee/profile' || path == '/profile') return 3;
    return -1;
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
          _headerButton(context, Icons.menu_rounded, 'القائمة', () => _showOptions(context), compact: compact),
          SizedBox(width: compact ? 5 : 7),
          _headerButton(context, Icons.notifications_none_rounded, 'الإشعارات', () => context.push('/employee/notifications'), compact: compact),
          SizedBox(width: compact ? 5 : 7),
          _headerButton(context, Icons.wb_sunny_outlined, 'الطقس', () => context.push('/weather'), compact: compact),
          SizedBox(width: compact ? 5 : 7),
          _headerButton(context, Icons.explore_outlined, 'القبلة', () => context.push('/prayer'), compact: compact),
          SizedBox(width: compact ? 5 : 7),
          _headerButton(context, Icons.auto_awesome_rounded, 'المساعد', () => context.push('/ai'), compact: compact),
        ],
      ),
    );
  }

  Widget _navigation(BuildContext context, int selected) {
    final scheme = Theme.of(context).colorScheme;
    final items = const [
      (Icons.dashboard_outlined, Icons.dashboard_rounded, 'لوحة الموظف'),
      (Icons.business_center_outlined, Icons.business_center_rounded, 'مركز الموظف'),
      (Icons.access_time_outlined, Icons.access_time_filled, 'سجل العمل'),
      (Icons.person_outline_rounded, Icons.person_rounded, 'الملف الشخصي'),
    ];
    return Container(
      height: 78,
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(bottom: BorderSide(color: scheme.outlineVariant)),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 4),
        itemBuilder: (context, index) {
          final item = items[index];
          final active = selected == index;
          return InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => _go(context, index),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              constraints: const BoxConstraints(minWidth: 88),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: active ? scheme.primary.withValues(alpha: .13) : Colors.transparent,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: active ? scheme.primary.withValues(alpha: .28) : Colors.transparent),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(active ? item.$2 : item.$1, color: active ? scheme.primary : scheme.onSurfaceVariant, size: 23),
                  const SizedBox(height: 3),
                  Text(item.$3, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: active ? scheme.primary : scheme.onSurfaceVariant, fontSize: 10.5, fontWeight: active ? FontWeight.w900 : FontWeight.w700)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _headerButton(BuildContext context, IconData icon, String label, VoidCallback onTap, {required bool compact}) {
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
                child: Text('القائمة', style: TextStyle(color: Theme.of(sheetContext).colorScheme.onSurface, fontSize: 19, fontWeight: FontWeight.w900)),
              ),
              const SizedBox(height: 10),
              _themeSelector(sheetContext),
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 6),
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: Theme.of(sheetContext).colorScheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(14)),
                  child: Icon(Icons.logout_rounded, color: Theme.of(sheetContext).colorScheme.error),
                ),
                title: Text('تسجيل خروج', style: TextStyle(color: Theme.of(sheetContext).colorScheme.error, fontWeight: FontWeight.w900)),
                onTap: () => _logout(context),
              ),
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
              if (mode != null) controller.setMode(mode);
            },
          ),
        );
      },
    );
  }

  Future<void> _logout(BuildContext context) async {
    Navigator.of(context).pop();
    await HadirThemeController.instance.logout(context);
  }
}
