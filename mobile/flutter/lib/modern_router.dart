import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'app_fixed.dart';
import 'core/session.dart';
import 'pages/admin_home_page.dart';
import 'pages/admin_login_page.dart';
import 'pages/admin_management_page.dart';
import 'pages/admin_operations_page.dart';
import 'pages/admin_reports_page.dart';
import 'pages/employee_center_page.dart';
import 'pages/modern_home_page.dart';
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
    if (adminToken == null && (location == '/admin' || location == '/admin/manage' || location == '/admin/operations' || location == '/admin/reports')) return '/admin-login';
    if (employeeToken == null && location != '/admin' && location != '/admin/manage' && location != '/admin/operations' && location != '/admin/reports' && location != '/admin-login' && location != '/login') return '/login';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginEntryPage()),
    GoRoute(path: '/employee-login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/admin-login', builder: (_, __) => const AdminLoginPage()),
    GoRoute(path: '/admin', builder: (_, __) => const SwipeBackPage(child: AdminHomePage())),
    GoRoute(path: '/admin/manage', builder: (_, __) => const SwipeBackPage(child: AdminManagementPage())),
    GoRoute(path: '/admin/operations', builder: (_, __) => const SwipeBackPage(child: AdminOperationsPage())),
    GoRoute(path: '/admin/reports', builder: (_, __) => const SwipeBackPage(child: AdminReportsPage())),
    GoRoute(path: '/home', builder: (_, __) => const ModernHomePage()),
    GoRoute(path: '/center', builder: (_, __) => const SwipeBackPage(child: EmployeeCenterPage())),
    GoRoute(path: '/attendance', builder: (_, s) => SwipeBackPage(child: AttendancePage(type: s.uri.queryParameters['type'] ?? 'check-in'))),
    GoRoute(path: '/history', builder: (_, __) => const SwipeBackPage(child: HistoryPage())),
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
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragStart: _start,
      onHorizontalDragUpdate: _update,
      onHorizontalDragEnd: _end,
      onHorizontalDragCancel: _cancel,
      child: widget.child,
    );
  }
}

class LoginEntryPage extends StatelessWidget {
  const LoginEntryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(width: 82, height: 82, alignment: Alignment.center, decoration: BoxDecoration(color: const Color(0xFF0B6B5A), borderRadius: BorderRadius.circular(26)), child: const Icon(Icons.how_to_reg_rounded, color: Colors.white, size: 44)),
                  const SizedBox(height: 24),
                  const Text('حاضر', textAlign: TextAlign.center, style: TextStyle(fontSize: 38, fontWeight: FontWeight.w800, color: Color(0xFF17322C))),
                  const SizedBox(height: 8),
                  const Text('اختر نوع الدخول', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF70817B), fontSize: 15)),
                  const SizedBox(height: 30),
                  FilledButton.icon(onPressed: () => context.go('/employee-login'), icon: const Icon(Icons.badge_outlined), label: const Padding(padding: EdgeInsets.symmetric(vertical: 13), child: Text('دخول الموظفين'))),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(onPressed: () => context.go('/admin-login'), icon: const Icon(Icons.admin_panel_settings_outlined), label: const Padding(padding: EdgeInsets.symmetric(vertical: 13), child: Text('دخول الإدارة'))),
                  const SizedBox(height: 22),
                  const Text('حساب الإدارة منفصل تمامًا عن حساب الموظف.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF70817B), fontSize: 12)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
