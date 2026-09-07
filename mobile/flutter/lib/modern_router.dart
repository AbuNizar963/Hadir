import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/session.dart';
import 'pages/admin_login_page.dart';
import 'pages/admin_management_page.dart';
import 'pages/admin_operations_page.dart';
import 'pages/admin_reports_page.dart';
import 'pages/admin_report_archive_page.dart';
import 'pages/admin_role_workspace_page.dart';
import 'pages/attendance_page.dart';
import 'pages/attendance_insights_page.dart';
import 'pages/employee_center_page.dart';
import 'pages/employee_login_page.dart';
import 'pages/hadir_workspace_page.dart';
import 'pages/jibble_history_page.dart';
import 'pages/requests_page.dart';
import 'pages/notifications_page.dart';
import 'pages/profile_page.dart';
import 'pages/services_page.dart';

final _modernSession = HadirSession();

GoRouter buildModernRouter() => GoRouter(
  initialLocation: '/login',
  redirect: (_, state) async {
    final employeeToken = await _modernSession.token();
    final adminToken = await _modernSession.adminToken();
    final location = state.matchedLocation;
    const publicLocations = {'/login', '/employee-login', '/admin-login'};
    if (employeeToken == null && adminToken == null && !publicLocations.contains(location)) return '/login';
    if (adminToken != null && publicLocations.contains(location)) return '/admin';
    if (employeeToken != null && publicLocations.contains(location)) return '/home';
    if (adminToken == null && (location == '/admin' || location == '/admin/roles' || location == '/admin/manage' || location == '/admin/operations' || location == '/admin/reports' || location == '/admin/reports/archive')) return '/admin-login';
    if (employeeToken == null && location != '/admin' && location != '/admin/roles' && location != '/admin/manage' && location != '/admin/operations' && location != '/admin/reports' && location != '/admin/reports/archive' && location != '/admin-login' && location != '/login') return '/login';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginEntryPage()),
    GoRoute(path: '/employee-login', builder: (_, __) => const EmployeeLoginPage()),
    GoRoute(path: '/admin-login', builder: (_, __) => const AdminLoginPage()),
    GoRoute(path: '/admin', builder: (_, __) => const SwipeBackPage(child: AdminRoleWorkspacePage())),
    GoRoute(path: '/admin/roles', builder: (_, __) => const SwipeBackPage(child: AdminRoleWorkspacePage())),
    GoRoute(path: '/admin/manage', builder: (_, __) => const SwipeBackPage(child: AdminManagementPage())),
    GoRoute(path: '/admin/operations', builder: (_, __) => const SwipeBackPage(child: AdminOperationsPage())),
    GoRoute(path: '/admin/reports', builder: (_, __) => const SwipeBackPage(child: AdminReportsPage())),
    GoRoute(path: '/admin/reports/archive', builder: (_, __) => const SwipeBackPage(child: AdminReportArchivePage())),
    GoRoute(path: '/home', builder: (_, __) => const HadirWorkspacePage()),
    GoRoute(path: '/center', builder: (_, __) => const SwipeBackPage(child: EmployeeCenterPage())),
    GoRoute(path: '/attendance', builder: (_, s) => SwipeBackPage(child: AttendancePage(type: s.uri.queryParameters['type'] ?? 'check-in'))),
    GoRoute(path: '/history', builder: (_, __) => const SwipeBackPage(child: JibbleHistoryPage())),
    GoRoute(path: '/insights', builder: (_, __) => const SwipeBackPage(child: AttendanceInsightsPage())),
    GoRoute(path: '/requests', builder: (_, __) => const SwipeBackPage(child: RequestsPage())),
    GoRoute(path: '/notifications', builder: (_, __) => const SwipeBackPage(child: NotificationsPage())),
    GoRoute(path: '/profile', builder: (_, __) => const SwipeBackPage(child: ProfilePage())),
    GoRoute(path: '/services', builder: (_, __) => const SwipeBackPage(child: ServicesPage())),
  ],
);

class SwipeBackPage extends StatefulWidget {
  const SwipeBackPage({super.key, required this.child});
  final Widget child;
  @override
  State<SwipeBackPage> createState() => _SwipeBackPageState();
}

class _SwipeBackPageState extends State<SwipeBackPage> {
  static const _edgeWidth = 32.0;
  static const _triggerDistance = 90.0;
  bool _tracking = false;
  bool _fromLeft = true;
  double _dragDistance = 0;

  void _start(DragStartDetails details) {
    if (!context.canPop()) return;
    final width = MediaQuery.sizeOf(context).width;
    final x = details.globalPosition.dx;
    if (x <= _edgeWidth) {
      _tracking = true;
      _fromLeft = true;
      _dragDistance = 0;
    } else if (x >= width - _edgeWidth) {
      _tracking = true;
      _fromLeft = false;
      _dragDistance = 0;
    }
  }
  void _update(DragUpdateDetails details) {
    if (!_tracking) return;
    final delta = details.primaryDelta ?? 0;
    _dragDistance += _fromLeft ? delta : -delta;
    if (_dragDistance < 0) _dragDistance = 0;
  }
  void _end(DragEndDetails details) {
    if (!_tracking) return;
    final velocity = details.primaryVelocity ?? 0;
    final effectiveVelocity = _fromLeft ? velocity : -velocity;
    final shouldPop = _dragDistance >= _triggerDistance || effectiveVelocity > 700;
    _tracking = false;
    _dragDistance = 0;
    if (shouldPop && mounted && context.canPop()) context.pop();
  }
  void _cancel() {
    _tracking = false;
    _dragDistance = 0;
  }
  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.translucent,
    onHorizontalDragStart: _start,
    onHorizontalDragUpdate: _update,
    onHorizontalDragEnd: _end,
    onHorizontalDragCancel: _cancel,
    child: widget.child,
  );
}

class LoginEntryPage extends StatelessWidget {
  const LoginEntryPage({super.key});
  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.rtl,
    child: Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      body: Stack(children: [
        Positioned(top: -100, left: -80, child: Container(width: 260, height: 260, decoration: BoxDecoration(shape: BoxShape.circle, color: const Color(0xFF0B6B5A).withValues(alpha: .09)))),
        Positioned(bottom: -130, right: -90, child: Container(width: 300, height: 300, decoration: BoxDecoration(shape: BoxShape.circle, color: const Color(0xFF0B6B5A).withValues(alpha: .06)))),
        SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(22, 24, 22, 28), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 460), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [Container(width: 58, height: 58, decoration: BoxDecoration(gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [Color(0xFF0B6B5A), Color(0xFF064B40)]), borderRadius: BorderRadius.circular(19), boxShadow: const [BoxShadow(color: Color(0x220B6B5A), blurRadius: 22, offset: Offset(0, 10))]), child: const Icon(Icons.how_to_reg_rounded, color: Colors.white, size: 30))]),
          const SizedBox(height: 18),
          const Text('حاضر', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF142D27), fontSize: 34, fontWeight: FontWeight.w900, letterSpacing: -.8)),
          const SizedBox(height: 7),
          const Text('منصة العمل اليومية للموظف والإدارة', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF73827E), fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 30),
          Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(27), border: Border.all(color: const Color(0xFFDCE6E2)), boxShadow: const [BoxShadow(color: Color(0x0D142D27), blurRadius: 24, offset: Offset(0, 10))]), child: Column(children: [
            _EntryCard(icon: Icons.badge_outlined, title: 'مساحة الموظف', subtitle: 'الحضور، السجل، الطلبات والخدمات', accent: const Color(0xFF0B6B5A), onTap: () => context.go('/employee-login')),
            const SizedBox(height: 4),
            _EntryCard(icon: Icons.admin_panel_settings_outlined, title: 'مساحة الإدارة', subtitle: 'التشغيل، الموظفون والتقارير', accent: const Color(0xFF344B65), onTap: () => context.go('/admin-login')),
          ])),
          const SizedBox(height: 18),
          Container(padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13), decoration: BoxDecoration(color: const Color(0xFFEAF4F0), borderRadius: BorderRadius.circular(17), border: Border.all(color: const Color(0xFFD3E8E0))), child: const Row(children: [Icon(Icons.shield_outlined, color: Color(0xFF0B6B5A), size: 19), SizedBox(width: 9), Expanded(child: Text('تجربة موحدة، مع فصل كامل بين صلاحيات الموظف والإدارة.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF064B40), fontSize: 10.5, height: 1.4, fontWeight: FontWeight.w600)))])),
          const SizedBox(height: 20),
          const Text('بعض المزايا المتقدمة ستظهر داخل التطبيق بعلامة «قريباً» حتى يتم ربطها بالواجهة الخلفية.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF899691), fontSize: 9.5, height: 1.45)),
        ]))))),
      ]),
    ),
  );
}

class _EntryCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final VoidCallback onTap;
  const _EntryCard({required this.icon, required this.title, required this.subtitle, required this.accent, required this.onTap});
  @override
  Widget build(BuildContext context) => Material(color: Colors.transparent, borderRadius: BorderRadius.circular(21), child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(21), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13), child: Row(children: [
    Container(width: 48, height: 48, decoration: BoxDecoration(color: accent.withValues(alpha: .09), borderRadius: BorderRadius.circular(15)), child: Icon(icon, color: accent, size: 23)),
    const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Color(0xFF142D27), fontSize: 14, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: Color(0xFF73827E), fontSize: 10.5))])),
    Icon(Icons.arrow_back_ios_new_rounded, color: accent, size: 15),
  ]))));
}
