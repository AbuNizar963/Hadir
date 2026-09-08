import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../pages/notifications_page.dart';

const _brand = Color(0xFF0B6B5A);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF73827E);
const _soft = Color(0xFFEAF4F0);
const _bg = Color(0xFFF4F7F6);
const _border = Color(0xFFDCE6E2);

class AdminMobileShell extends StatelessWidget {
  const AdminMobileShell({super.key, required this.child});

  final Widget child;

  int _selectedIndex(BuildContext context) {
    final uri = GoRouterState.of(context).uri;
    if (uri.path == '/admin') return 0;
    if (uri.path == '/manager/requests') return 1;
    if (uri.path == '/admin/manage') return 2;
    if (uri.path == '/admin/reports' || uri.path == '/admin/reports/archive') return 3;
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
        context.go('/admin/settings');
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedIndex(context);
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _bg,
        body: SafeArea(
          bottom: false,
          child: Column(children: [_header(context), Expanded(child: child)]),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: selected,
          onDestinationSelected: (index) => _go(context, index),
          backgroundColor: Colors.white,
          indicatorColor: _soft,
          height: 74,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded, color: _brand), label: 'لوحة القيادة'),
            NavigationDestination(icon: Icon(Icons.assignment_outlined), selectedIcon: Icon(Icons.assignment_rounded, color: _brand), label: 'إدارة الطلبات'),
            NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups_rounded, color: _brand), label: 'الموظفون'),
            NavigationDestination(icon: Icon(Icons.bar_chart_outlined), selectedIcon: Icon(Icons.bar_chart_rounded, color: _brand), label: 'التقارير'),
            NavigationDestination(icon: Icon(Icons.more_horiz_rounded), selectedIcon: Icon(Icons.more_horiz_rounded, color: _brand), label: 'المزيد'),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 390;
    return Container(
      padding: EdgeInsets.fromLTRB(compact ? 12 : 14, 10, compact ? 12 : 14, 9),
      decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: _border))),
      child: Row(children: [
        Expanded(child: Row(children: [
          Container(
            width: compact ? 40 : 44,
            height: compact ? 40 : 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_brand, Color(0xFF064B40)]),
              borderRadius: BorderRadius.circular(compact ? 13 : 15),
              boxShadow: const [BoxShadow(color: Color(0x220B6B5A), blurRadius: 18, offset: Offset(0, 8))],
            ),
            child: Icon(Icons.how_to_reg_rounded, color: Colors.white, size: compact ? 23 : 25),
          ),
          const SizedBox(width: 9),
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('حاضر', style: TextStyle(color: _ink, fontSize: 22, height: 1, fontWeight: FontWeight.w900)),
            SizedBox(height: 4),
            Text('نظام حضور وانصراف موثّق', style: TextStyle(color: _muted, fontSize: 9.5, fontWeight: FontWeight.w600)),
          ]),
        ])),
        _headerButton(context, icon: Icons.notifications_none_rounded, label: 'الإشعارات', compact: compact, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const _AdminNotificationsPage()))),
        const SizedBox(width: 7),
        _headerButton(context, icon: Icons.menu_rounded, label: 'الخيارات', compact: compact, onTap: () => _showOptions(context)),
      ]),
    );
  }

  Widget _headerButton(BuildContext context, {required IconData icon, required String label, required bool compact, required VoidCallback onTap}) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: _ink,
        padding: EdgeInsets.symmetric(horizontal: compact ? 9 : 11, vertical: compact ? 9 : 10),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        side: const BorderSide(color: _border),
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: compact ? 20 : 21), if (!compact) ...[const SizedBox(width: 6), Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800))]]),
    );
  }

  Future<void> _showOptions(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (sheetContext) => SafeArea(child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Align(alignment: Alignment.centerRight, child: Text('الخيارات', style: TextStyle(color: _ink, fontSize: 19, fontWeight: FontWeight.w900))),
          const SizedBox(height: 10),
          _optionTile(sheetContext, Icons.wb_sunny_outlined, 'الطقس', 'حالة الطقس والخدمات المرتبطة بالموقع', '/weather'),
          _optionTile(sheetContext, Icons.explore_outlined, 'القبلة', 'اتجاه القبلة والخدمات المكانية', '/prayer'),
          _optionTile(sheetContext, Icons.settings_outlined, 'الإعدادات', 'إعدادات النظام والإدارة', '/admin/settings'),
        ]),
      )),
    );
  }

  Widget _optionTile(BuildContext context, IconData icon, String title, String subtitle, String route) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 6),
      leading: Container(width: 44, height: 44, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: _brand)),
      title: Text(title, style: const TextStyle(color: _ink, fontWeight: FontWeight.w900)),
      subtitle: Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10.5)),
      trailing: const Icon(Icons.chevron_left_rounded, color: _muted),
      onTap: () { Navigator.of(context).pop(); context.push(route); },
    );
  }
}

class _AdminNotificationsPage extends StatelessWidget {
  const _AdminNotificationsPage();
  @override
  Widget build(BuildContext context) => const NotificationsPage();
}
