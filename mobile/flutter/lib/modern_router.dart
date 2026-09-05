import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'app_fixed.dart';
import 'core/session.dart';
import 'pages/admin_home_page.dart';
import 'pages/admin_login_page.dart';
import 'pages/modern_home_page.dart';
import 'pages/requests_page.dart';
import 'pages/notifications_page.dart';
import 'pages/profile_page.dart';

final _modernSession = HadirSession();

GoRouter buildModernRouter() => GoRouter(
  initialLocation: '/login',
  redirect: (_, state) async {
    final employeeToken = await _modernSession.token();
    final adminToken = await _modernSession.adminToken();
    final location = state.matchedLocation;
    final publicLocations = {'/login', '/employee-login', '/admin-login'};
    if (employeeToken == null && adminToken == null && !publicLocations.contains(location)) return '/login';
    if (adminToken != null && publicLocations.contains(location)) return '/admin';
    if (employeeToken != null && publicLocations.contains(location)) return '/home';
    if (adminToken == null && location == '/admin') return '/admin-login';
    if (employeeToken == null && location != '/admin' && location != '/admin-login' && location != '/login') return '/login';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginEntryPage()),
    GoRoute(path: '/employee-login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/admin-login', builder: (_, __) => const AdminLoginPage()),
    GoRoute(path: '/admin', builder: (_, __) => const AdminHomePage()),
    GoRoute(path: '/home', builder: (_, __) => const ModernHomePage()),
    GoRoute(path: '/attendance', builder: (_, s) => AttendancePage(type: s.uri.queryParameters['type'] ?? 'check-in')),
    GoRoute(path: '/history', builder: (_, __) => const HistoryPage()),
    GoRoute(path: '/requests', builder: (_, __) => const RequestsPage()),
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationsPage()),
    GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
  ],
);

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
                  Container(
                    width: 82,
                    height: 82,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: const Color(0xFF0B6B5A), borderRadius: BorderRadius.circular(26)),
                    child: const Icon(Icons.how_to_reg_rounded, color: Colors.white, size: 44),
                  ),
                  const SizedBox(height: 24),
                  const Text('حاضر', textAlign: TextAlign.center, style: TextStyle(fontSize: 38, fontWeight: FontWeight.w800, color: Color(0xFF17322C))),
                  const SizedBox(height: 8),
                  const Text('اختر نوع الدخول', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF70817B), fontSize: 15)),
                  const SizedBox(height: 30),
                  FilledButton.icon(
                    onPressed: () => context.go('/employee-login'),
                    icon: const Icon(Icons.badge_outlined),
                    label: const Padding(padding: EdgeInsets.symmetric(vertical: 13), child: Text('دخول الموظفين')),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => context.go('/admin-login'),
                    icon: const Icon(Icons.admin_panel_settings_outlined),
                    label: const Padding(padding: EdgeInsets.symmetric(vertical: 13), child: Text('دخول الإدارة')),
                  ),
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
