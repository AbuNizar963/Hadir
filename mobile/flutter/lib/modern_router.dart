import 'package:go_router/go_router.dart';

import 'app_fixed.dart';
import 'core/session.dart';
import 'pages/modern_home_page.dart';
import 'pages/requests_page.dart';
import 'pages/notifications_page.dart';
import 'pages/profile_page.dart';

final _modernSession = HadirSession();

GoRouter buildModernRouter() => GoRouter(
  initialLocation: '/login',
  redirect: (_, state) async {
    final token = await _modernSession.token();
    if (token == null && state.matchedLocation != '/login') return '/login';
    if (token != null && state.matchedLocation == '/login') return '/home';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/home', builder: (_, __) => const ModernHomePage()),
    GoRoute(path: '/attendance', builder: (_, s) => AttendancePage(type: s.uri.queryParameters['type'] ?? 'check-in')),
    GoRoute(path: '/history', builder: (_, __) => const HistoryPage()),
    GoRoute(path: '/requests', builder: (_, __) => const RequestsPage()),
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationsPage()),
    GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
  ],
);
