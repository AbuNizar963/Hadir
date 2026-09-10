import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/hadir_theme_controller.dart';
import '../../../core/session.dart';
import '../../../services/notifications_service.dart';

/// Employee shell matching the website EmployeeLayout structure.
class EmployeeMobileShell extends StatefulWidget {
  const EmployeeMobileShell({super.key, required this.child});
  final Widget child;

  @override
  State<EmployeeMobileShell> createState() => _EmployeeMobileShellState();
}

class _EmployeeMobileShellState extends State<EmployeeMobileShell> {
  bool _menuOpen = false;
  bool _themeMenuOpen = false;
  int _unreadNotifications = 0;

  int _selectedIndex(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/employee' || path == '/home') return 0;
    if (path == '/employee/center' || path == '/center' || path == '/employee/premium') return 1;
    if (path == '/employee/history' || path == '/history') return 2;
    if (path == '/employee/profile' || path == '/profile') return 3;
    return -1;
  }

  String _pageTitle(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/employee' || path == '/home') return 'لوحة الموظف';
    if (path == '/employee/center' || path == '/center' || path == '/employee/premium') return 'مركز الموظف';
    if (path == '/employee/history' || path == '/history') return 'سجل العمل';
    if (path == '/employee/profile' || path == '/profile') return 'الملف الشخصي';
    if (path == '/employee/notifications' || path == '/notifications') return 'الإشعارات';
    if (path == '/weather') return 'الطقس';
    if (path == '/prayer') return 'القبلة ومواقيت الصلاة';
    if (path == '/ai') return 'المساعد الذكي';
    if (path.startsWith('/attendance')) return 'الحضور والانصراف';
    if (path.startsWith('/requests')) return 'الطلبات';
    return 'حاضر';
  }

  String _pageSubtitle(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/employee' || path == '/home') return 'متابعة حالة اليوم وتسجيل الحضور والانصراف والطلبات.';
    if (path == '/employee/center' || path == '/center' || path == '/employee/premium') return 'بطاقتك الرقمية وملخص العمل والدوام والخدمات المرتبطة بحسابك.';
    if (path == '/employee/history' || path == '/history') return 'راجع عمليات الحضور والانصراف وسجل عملك.';
    if (path == '/employee/profile' || path == '/profile') return 'إدارة بياناتك الشخصية وبيانات الحساب.';
    if (path == '/employee/notifications' || path == '/notifications') return 'التنبيهات والرسائل الخاصة بحسابك.';
    if (path == '/attendance') return 'التحقق من الموقع والجهاز وتسجيل العملية.';
    return '';
  }

  @override
  void initState() {
    super.initState();
    _loadUnreadNotifications();
  }

  Future<void> _loadUnreadNotifications() async {
    try {
      final rows = await NotificationsService().list();
      if (mounted) setState(() => _unreadNotifications = rows.where((n) => !n.read).length);
    } catch (_) {
      // The notifications page remains the source of truth if the shell count fails.
    }
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
              if (_menuOpen) _utilityMenu(context),
              _pageHeader(context),
              Expanded(child: widget.child),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final utilities = <({IconData icon, String label, VoidCallback action})>[
      (icon: _menuOpen ? Icons.close_rounded : Icons.menu_rounded, label: 'القائمة', action: () => setState(() { _menuOpen = !_menuOpen; _themeMenuOpen = false; })),
      (icon: Icons.notifications_none_rounded, label: 'الإشعارات', action: () async { await context.push('/employee/notifications'); if (mounted) _loadUnreadNotifications(); }),
      (icon: Icons.cloud_outlined, label: 'الطقس', action: () => context.push('/weather')),
    ];
    return Container(
      constraints: const BoxConstraints(minHeight: 76),
      decoration: BoxDecoration(
        color: scheme.surface.withValues(alpha: .95),
        border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .72))),
        boxShadow: [BoxShadow(color: scheme.onSurface.withValues(alpha: .045), blurRadius: 18, offset: const Offset(0, 7))],
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            ...utilities.map((item) => Padding(
              padding: const EdgeInsets.only(left: 6),
              child: _utilityButton(context, item.icon, item.label, item.action, selected: item.label == 'القائمة' && _menuOpen, showBadge: item.label == 'الإشعارات'),
            )),
            const SizedBox(width: 4),
            _brand(context),
          ],
        ),
      ),
    );
  }

  Widget _brand(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: () => context.go('/employee'),
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        child: Row(
          children: [
            Image.asset(
              'assets/branding/hadir_logo_transparent.png',
              width: 38,
              height: 38,
              fit: BoxFit.contain,
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('حاضر', style: TextStyle(color: scheme.onSurface, fontSize: 18, height: 1, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text('HADIR  •  v1.1', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 8.5, letterSpacing: 1.0, fontWeight: FontWeight.w700)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _utilityButton(BuildContext context, IconData icon, String label, VoidCallback onTap, {bool selected = false, bool showBadge = false}) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: 80,
      height: 48,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Material(
            color: selected ? scheme.primary.withValues(alpha: .05) : scheme.surface.withValues(alpha: .70),
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: selected ? scheme.primary.withValues(alpha: .40) : scheme.outlineVariant.withValues(alpha: .70)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, color: selected ? scheme.primary : scheme.onSurface.withValues(alpha: .85), size: 20),
                    const SizedBox(height: 2),
                    Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: selected ? scheme.primary : scheme.onSurface.withValues(alpha: .85), fontSize: 10.5, fontWeight: FontWeight.w600, height: 1)),
                  ],
                ),
              ),
            ),
          ),
          if (showBadge && _unreadNotifications > 0)
            Positioned(
              top: -2,
              right: -2,
              child: Container(
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                padding: const EdgeInsets.symmetric(horizontal: 4),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: scheme.error, borderRadius: BorderRadius.circular(99)),
                child: Text(_unreadNotifications > 99 ? '99+' : '$_unreadNotifications', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _navigation(BuildContext context, int selected) {
    final scheme = Theme.of(context).colorScheme;
    // Lucide equivalents used by the website: LayoutDashboard, Building2, Clock3, UserRound.
    final items = const [
      (Icons.dashboard_outlined, Icons.dashboard_rounded, 'لوحة الموظف'),
      (Icons.business_outlined, Icons.business_rounded, 'مركز الموظف'),
      (Icons.access_time_outlined, Icons.access_time_filled, 'سجل العمل'),
      (Icons.person_outline_rounded, Icons.person_rounded, 'الملف الشخصي'),
    ];
    return Container(
      decoration: BoxDecoration(
        color: scheme.surface.withValues(alpha: .95),
        border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .72))),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(
          children: [
            for (var index = 0; index < items.length; index++) ...[
              _navItem(context, index, items[index], selected == index),
              if (index < items.length - 1) const SizedBox(width: 4),
            ],
          ],
        ),
      ),
    );
  }

  Widget _navItem(BuildContext context, int index, (IconData, IconData, String) item, bool active) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _go(context, index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        constraints: const BoxConstraints(minWidth: 86, minHeight: 54),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: active ? scheme.primary.withValues(alpha: .15) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: active ? Border.all(color: scheme.primary.withValues(alpha: .35)) : null,
          boxShadow: active ? [BoxShadow(color: scheme.primary.withValues(alpha: .08), blurRadius: 8, offset: const Offset(0, 3))] : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(active ? item.$2 : item.$1, color: active ? scheme.primary : scheme.onSurface.withValues(alpha: .80), size: 20),
            const SizedBox(height: 3),
            Text(item.$3, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: active ? scheme.primary : scheme.onSurface.withValues(alpha: .80), fontSize: 10.5, fontWeight: active ? FontWeight.w800 : FontWeight.w600, height: 1)),
          ],
        ),
      ),
    );
  }

  Widget _pageHeader(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final subtitle = _pageSubtitle(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .35)))),
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 18),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('HADIR · EMPLOYEE', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.5)),
              const SizedBox(height: 4),
              Text(_pageTitle(context), style: TextStyle(color: scheme.onSurface, fontSize: 27, height: 1.15, fontWeight: FontWeight.w900)),
              if (subtitle.isNotEmpty) ...[
                const SizedBox(height: 7),
                Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11.5, height: 1.45)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _utilityMenu(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surface,
      elevation: 8,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: scheme.surface,
          border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .70))),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Wrap(
            alignment: WrapAlignment.start,
            spacing: 6,
            runSpacing: 6,
            children: [
              _themeMenuButton(context),
              TextButton.icon(
                onPressed: _logout,
                icon: Icon(Icons.logout_rounded, color: scheme.error, size: 18),
                label: Text('تسجيل خروج', style: TextStyle(color: scheme.error, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _themeMenuButton(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return PopupMenuButton<ThemeMode>(
      tooltip: 'المظهر',
      onSelected: (mode) {
        HadirThemeController.instance.setMode(mode);
        setState(() => _themeMenuOpen = false);
      },
      offset: const Offset(0, 46),
      itemBuilder: (_) => const [
        PopupMenuItem(value: ThemeMode.dark, child: ListTile(leading: Icon(Icons.dark_mode_outlined), title: Text('داكن'))),
        PopupMenuItem(value: ThemeMode.light, child: ListTile(leading: Icon(Icons.light_mode_outlined), title: Text('فاتح'))),
        PopupMenuItem(value: ThemeMode.system, child: ListTile(leading: Icon(Icons.monitor_outlined), title: Text('تلقائي'))),
      ],
      child: TextButton.icon(
        onPressed: () => setState(() => _themeMenuOpen = !_themeMenuOpen),
        icon: const Icon(Icons.palette_outlined, size: 18),
        label: const Text('المظهر'),
        style: TextButton.styleFrom(foregroundColor: scheme.onSurface),
      ),
    );
  }

  Future<void> _logout() async {
    try {
      await HadirSession().clear();
    } finally {
      if (mounted) {
        setState(() { _menuOpen = false; _themeMenuOpen = false; });
        context.go('/login');
      }
    }
  }
}
