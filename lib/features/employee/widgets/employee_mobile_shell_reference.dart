import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/hadir_theme_controller.dart';
import '../../../services/notifications_service.dart';
import '../../../core/session.dart';

/// Reference-matched employee navigation shell.
class EmployeeReferenceShell extends StatefulWidget {
  const EmployeeReferenceShell({super.key, required this.child});
  final Widget child;
  @override
  State<EmployeeReferenceShell> createState() => _EmployeeReferenceShellState();
}

class _EmployeeReferenceShellState extends State<EmployeeReferenceShell> {
  bool _menuOpen = false;
  int _unread = 0;

  int _selected(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/employee' || path == '/home') return 0;
    if (path == '/employee/center' || path == '/center' || path == '/employee/premium') return 1;
    if (path == '/employee/history' || path == '/history') return 2;
    if (path == '/employee/profile' || path == '/profile') return 3;
    return -1;
  }

  String _title(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/employee' || path == '/home') return 'لوحة الموظف';
    if (path == '/employee/center' || path == '/center' || path == '/employee/premium') return 'مركز الموظف';
    if (path == '/employee/history' || path == '/history') return 'سجل العمل';
    if (path == '/employee/profile' || path == '/profile') return 'الملف الشخصي';
    if (path == '/employee/notifications' || path == '/notifications') return 'الإشعارات';
    if (path == '/weather') return 'الطقس';
    if (path == '/prayer') return 'مواقيت الصلاة والقبلة';
    if (path == '/ai') return 'المساعد الذكي';
    if (path.startsWith('/attendance')) return 'الحضور والانصراف';
    if (path.startsWith('/requests')) return 'الطلبات';
    return 'حاضر';
  }

  @override
  void initState() {
    super.initState();
    _refreshUnread();
  }

  Future<void> _refreshUnread() async {
    try {
      final rows = await NotificationsService().list();
      if (mounted) setState(() => _unread = rows.where((n) => !n.read).length);
    } catch (_) {}
  }

  void _go(BuildContext context, int index) {
    const paths = ['/employee', '/employee/center', '/employee/history', '/employee/profile'];
    if (index >= 0 && index < paths.length) context.go(paths[index]);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final selected = _selected(context);
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: SafeArea(
          bottom: false,
          child: Column(children: [
            _topBar(scheme),
            _navBar(scheme, selected),
            if (_menuOpen) _menu(scheme),
            _pageHeading(scheme),
            Expanded(child: widget.child),
          ]),
        ),
      ),
    );
  }

  Widget _topBar(ColorScheme scheme) {
    return Container(
      height: 76,
      decoration: BoxDecoration(color: scheme.surface, border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .72))), boxShadow: [BoxShadow(color: scheme.onSurface.withValues(alpha: .035), blurRadius: 12, offset: const Offset(0, 4))]),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        child: Row(children: [
          _brand(scheme),
          const SizedBox(width: 8),
          _tool(Icons.menu_rounded, 'القائمة', () => setState(() => _menuOpen = !_menuOpen), scheme, active: _menuOpen),
          const SizedBox(width: 6),
          _tool(Icons.notifications_none_rounded, 'الإشعارات', () async { await context.push('/notifications'); _refreshUnread(); }, scheme, badge: _unread),
          const SizedBox(width: 6),
          _tool(Icons.cloud_outlined, 'الطقس', () => context.push('/weather'), scheme),
          const SizedBox(width: 6),
          _tool(Icons.explore_outlined, 'القبلة', () => context.push('/prayer'), scheme),
          const SizedBox(width: 6),
          _tool(Icons.smart_toy_outlined, 'المساعد', () => context.push('/ai'), scheme),
        ]),
      ),
    );
  }

  Widget _brand(ColorScheme scheme) {
    return InkWell(
      onTap: () => context.go('/employee'),
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(width: 108, height: 60, child: Row(children: [
        Image.asset('assets/branding/hadir_logo_transparent.png', width: 38, height: 38, fit: BoxFit.contain),
        const SizedBox(width: 7),
        Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [Text('حاضر', style: TextStyle(color: scheme.onSurface, fontSize: 18, fontWeight: FontWeight.w900, height: 1)), const SizedBox(height: 4), Text('HADIR  •  v1.1', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 8, letterSpacing: .8, fontWeight: FontWeight.w700))]),
      ])),
    );
  }

  Widget _tool(IconData icon, String label, VoidCallback onTap, ColorScheme scheme, {int badge = 0, bool active = false}) {
    return SizedBox(width: 78, height: 48, child: Stack(clipBehavior: Clip.none, children: [
      Material(color: active ? scheme.primary.withValues(alpha: .06) : scheme.surface, borderRadius: BorderRadius.circular(12), child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(12), child: Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: active ? scheme.primary.withValues(alpha: .35) : scheme.outlineVariant.withValues(alpha: .7))), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, size: 20, color: active ? scheme.primary : scheme.onSurface.withValues(alpha: .85)), const SizedBox(height: 2), Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: active ? scheme.primary : scheme.onSurface.withValues(alpha: .85)))])))),
      if (badge > 0) Positioned(top: -2, right: -2, child: Container(minWidth: 18, height: 18, padding: const EdgeInsets.symmetric(horizontal: 4), alignment: Alignment.center, decoration: BoxDecoration(color: scheme.error, borderRadius: BorderRadius.circular(99)), child: Text(badge > 99 ? '99+' : '$badge', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)))),
    ]);
  }

  Widget _navBar(ColorScheme scheme, int selected) {
    const items = [(Icons.dashboard_outlined, Icons.dashboard_rounded, 'لوحة الموظف'), (Icons.business_outlined, Icons.business_rounded, 'مركز الموظف'), (Icons.access_time_outlined, Icons.access_time_filled, 'سجل العمل'), (Icons.person_outline_rounded, Icons.person_rounded, 'الملف الشخصي')];
    return Container(decoration: BoxDecoration(color: scheme.surface, border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .65)))), child: SingleChildScrollView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6), child: Row(children: [for (var i = 0; i < items.length; i++) ...[_navItem(i, items[i], selected == i, scheme), if (i != items.length - 1) const SizedBox(width: 4)]]));
  }

  Widget _navItem(int index, (IconData, IconData, String) item, bool active, ColorScheme scheme) {
    return InkWell(onTap: () => _go(context, index), borderRadius: BorderRadius.circular(12), child: AnimatedContainer(duration: const Duration(milliseconds: 120), constraints: const BoxConstraints(minWidth: 86, minHeight: 54), padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6), decoration: BoxDecoration(color: active ? scheme.primary.withValues(alpha: .13) : Colors.transparent, borderRadius: BorderRadius.circular(12), border: active ? Border.all(color: scheme.primary.withValues(alpha: .35)) : null), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(active ? item.$2 : item.$1, size: 20, color: active ? scheme.primary : scheme.onSurface.withValues(alpha: .8)), const SizedBox(height: 3), Text(item.$3, style: TextStyle(fontSize: 10.5, fontWeight: active ? FontWeight.w800 : FontWeight.w600, color: active ? scheme.primary : scheme.onSurface.withValues(alpha: .8)))])));
  }

  Widget _pageHeading(ColorScheme scheme) {
    return Container(width: double.infinity, padding: const EdgeInsets.fromLTRB(16, 18, 16, 15), decoration: BoxDecoration(border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .3)))), child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 520), child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text('HADIR · EMPLOYEE', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5, fontWeight: FontWeight.w700, letterSpacing: 1.5)), const SizedBox(height: 4), Text(_title(context), style: TextStyle(color: scheme.onSurface, fontSize: 27, fontWeight: FontWeight.w900, height: 1.1))])));
  }

  Widget _menu(ColorScheme scheme) {
    return Container(width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), decoration: BoxDecoration(color: scheme.surface, border: Border(bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .65))), boxShadow: [BoxShadow(color: scheme.onSurface.withValues(alpha: .06), blurRadius: 10, offset: const Offset(0, 4))]), child: Wrap(spacing: 6, children: [TextButton.icon(onPressed: () => _theme(context), icon: const Icon(Icons.palette_outlined, size: 18), label: const Text('المظهر')), TextButton.icon(onPressed: _logout, icon: Icon(Icons.logout_rounded, color: scheme.error, size: 18), label: Text('تسجيل خروج', style: TextStyle(color: scheme.error, fontWeight: FontWeight.w700)))]));
  }

  void _theme(BuildContext context) {
    showModalBottomSheet<void>(context: context, builder: (_) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [ListTile(leading: const Icon(Icons.dark_mode_outlined), title: const Text('داكن'), onTap: () { HadirThemeController.instance.setMode(ThemeMode.dark); Navigator.pop(context); }), ListTile(leading: const Icon(Icons.light_mode_outlined), title: const Text('فاتح'), onTap: () { HadirThemeController.instance.setMode(ThemeMode.light); Navigator.pop(context); }), ListTile(leading: const Icon(Icons.monitor_outlined), title: const Text('تلقائي'), onTap: () { HadirThemeController.instance.setMode(ThemeMode.system); Navigator.pop(context); })])));
  }

  Future<void> _logout() async {
    await HadirSession().clear();
    if (mounted) context.go('/login');
  }
}