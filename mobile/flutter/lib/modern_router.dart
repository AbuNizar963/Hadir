import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'app_fixed.dart' show LoginEntryPage, SwipeBackPage, LoginPage, HistoryPage;
import 'core/session.dart';
import 'pages/admin_home_page.dart';
import 'pages/admin_login_page.dart';
import 'pages/admin_management_page.dart';
import 'pages/admin_operations_page.dart';
import 'pages/admin_reports_page.dart';
import 'pages/admin_report_archive_page.dart';
import 'pages/attendance_page.dart';
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
    if (adminToken == null && (location == '/admin' || location == '/admin/manage' || location == '/admin/operations' || location == '/admin/reports' || location == '/admin/reports/archive')) return '/admin-login';
    if (employeeToken == null && location != '/admin' && location != '/admin/manage' && location != '/admin/operations' && location != '/admin/reports' && location != '/admin/reports/archive' && location != '/admin-login' && location != '/login') return '/login';
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
    GoRoute(path: '/admin/reports/archive', builder: (_, __) => const SwipeBackPage(child: AdminReportArchivePage())),
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
