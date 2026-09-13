import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/session.dart';
import '../../features/authentication/authentication.dart';
import '../../features/administration/administration.dart';
import '../../features/administration/widgets/admin_mobile_shell.dart';
import '../../features/employee/employee.dart';
import '../../features/employee/widgets/employee_mobile_shell.dart';

final _session = HadirSession();
String? _validatedEmployeeToken;
String? _validatedAdminToken;

Future<bool> _isTokenValid(String token) async {
  try {
    await HadirApi(token: token).me();
    return true;
  } on DioException catch (error) {
    final status = error.response?.statusCode;
    if (status == 401 || status == 403) return false;
    return true;
  } catch (_) {
    return true;
  }
}

/// Resolves the navigation target after authentication state is restored.
///
/// Keeping this decision separate from token validation makes the session
/// restore behavior deterministic and testable without coupling tests to
/// secure storage or the live API.
String? resolveAuthenticatedRedirect({
  required String location,
  String? employeeToken,
  String? adminToken,
}) {
  const publicLocations = {
    '/',
    '/login',
    '/employee-login',
    '/admin-login',
    '/manager/login',
  };

  final hasEmployeeToken = employeeToken != null && employeeToken.isNotEmpty;
  final hasAdminToken = adminToken != null && adminToken.isNotEmpty;

  if (!hasEmployeeToken && !hasAdminToken && !publicLocations.contains(location)) {
    return '/';
  }

  // A restored admin session should never land on a login/public entry page.
  if (hasAdminToken && publicLocations.contains(location)) return '/admin';

  // A restored employee session should resume the employee workspace instead
  // of showing the landing/login screen again.
  if (hasEmployeeToken && publicLocations.contains(location)) return '/home';

  const adminPaths = {
    '/admin',
    '/admin/roles',
    '/admin/manage',
    '/admin/operations',
    '/admin/reports',
    '/admin/reports/archive',
    '/admin/audit',
    '/admin/settings',
    '/manager',
    '/manager/employees',
    '/manager/workforce',
    '/manager/requests',
    '/manager/audit',
    '/manager/reports',
    '/manager/report-archive',
    '/manager/settings',
    '/manager/employees/transfer',
  };
  if (!hasAdminToken && adminPaths.contains(location)) return '/admin-login';

  const employeePaths = {
    '/home',
    '/employee',
    '/center',
    '/employee/center',
    '/employee/premium',
    '/attendance',
    '/history',
    '/employee/history',
    '/insights',
    '/requests',
    '/notifications',
    '/employee/notifications',
    '/profile',
    '/employee/profile',
    '/services',
    '/weather',
    '/prayer',
    '/ai',
  };
  final isEmployeeScan = location.startsWith('/employee/scan/');
  if (!hasEmployeeToken && (employeePaths.contains(location) || isEmployeeScan)) return '/login';

  return null;
}

GoRouter buildAppRouter() => GoRouter(
  initialLocation: '/',
  redirect: (_, state) async {
    final employeeToken = await _session.token();
    final adminToken = await _session.adminToken();

    // Clear the in-memory validation cache when its corresponding persisted
    // session disappears. This prevents a later reuse of the same token value
    // from bypassing validation after logout/login.
    if (employeeToken == null || employeeToken.isEmpty) _validatedEmployeeToken = null;
    if (adminToken == null || adminToken.isEmpty) _validatedAdminToken = null;

    final location = state.matchedLocation;

    if (employeeToken != null && employeeToken.isNotEmpty && employeeToken != _validatedEmployeeToken) {
      final valid = await _isTokenValid(employeeToken);
      if (!valid) {
        _validatedEmployeeToken = null;
        await _session.clear();
        if (!resolveAuthenticatedRedirect(location: location).isNullOrEmpty) {
          return resolveAuthenticatedRedirect(location: location);
        }
      } else {
        _validatedEmployeeToken = employeeToken;
      }
    }

    if (adminToken != null && adminToken.isNotEmpty && adminToken != _validatedAdminToken) {
      final valid = await _isTokenValid(adminToken);
      if (!valid) {
        _validatedAdminToken = null;
        await _session.clearAdmin();
        if (!resolveAuthenticatedRedirect(location: location).isNullOrEmpty) {
          return resolveAuthenticatedRedirect(location: location);
        }
      } else {
        _validatedAdminToken = adminToken;
      }
    }

    final currentEmployeeToken = await _session.token();
    final currentAdminToken = await _session.adminToken();
    return resolveAuthenticatedRedirect(
      location: location,
      employeeToken: currentEmployeeToken,
      adminToken: currentAdminToken,
    );
  },
  errorBuilder: (_, __) => const _NotFoundPage(),
  routes: [
    GoRoute(path: '/', builder: (_, __) => const LandingPage()),
    GoRoute(path: '/login', builder: (_, __) => const LoginEntryPage()),
    GoRoute(path: '/employee-login', builder: (_, __) => const EmployeeLoginPage()),
    GoRoute(path: '/admin-login', builder: (_, __) => const AdminLoginPage()),
    GoRoute(path: '/manager/login', builder: (_, __) => const AdminLoginPage()),
    GoRoute(path: '/admin', builder: (_, __) => const SwipeBackPage(child: AdminMobileHomePage())),
    GoRoute(path: '/admin/roles', builder: (_, __) => const SwipeBackPage(child: AdminMobileHomePage())),
    GoRoute(path: '/admin/manage', builder: (_, __) => const SwipeBackPage(child: AdminManagementPage())),
    GoRoute(path: '/admin/operations', builder: (_, __) => const SwipeBackPage(child: AdminOperationsPage())),
    GoRoute(path: '/admin/reports', builder: (_, __) => const SwipeBackPage(child: AdminReportsPage())),
    GoRoute(path: '/admin/reports/archive', builder: (_, __) => const SwipeBackPage(child: AdminReportArchivePage())),
    GoRoute(path: '/admin/audit', builder: (_, __) => const SwipeBackPage(child: AdminAuditPage())),
    GoRoute(path: '/admin/settings', builder: (_, __) => const SwipeBackPage(child: AdminMobileSettingsPage())),
    GoRoute(path: '/manager', builder: (_, __) => const SwipeBackPage(child: AdminMobileHomePage())),
    GoRoute(path: '/manager-home', redirect: (_, __) => '/manager'),
    GoRoute(path: '/manager/employees', builder: (_, __) => const SwipeBackPage(child: AdminManagementPage())),
    GoRoute(path: '/manager/employees/transfer', builder: (_, __) => const SwipeBackPage(child: EmployeeTransferPage())),
    GoRoute(path: '/manager/workforce', builder: (_, __) => const SwipeBackPage(child: ManagerWorkforcePage())),
    GoRoute(path: '/manager/requests', builder: (_, __) => const SwipeBackPage(child: ManagerRequestsPage())),
    GoRoute(path: '/manager/audit', builder: (_, __) => const SwipeBackPage(child: AdminAuditPage())),
    GoRoute(path: '/manager/reports', builder: (_, __) => const SwipeBackPage(child: AdminReportsPage())),
    GoRoute(path: '/manager/report-archive', builder: (_, __) => const SwipeBackPage(child: AdminReportArchivePage())),
    GoRoute(path: '/manager/settings', builder: (_, __) => const SwipeBackPage(child: AdminMobileSettingsPage())),
    GoRoute(path: '/home', builder: (_, __) => const SwipeBackPage(child: HadirWorkspacePage())),
    GoRoute(path: '/employee', builder: (_, __) => const SwipeBackPage(child: HadirWorkspacePage())),
    GoRoute(path: '/center', builder: (_, __) => const SwipeBackPage(child: EmployeeCenterPage())),
    GoRoute(path: '/employee/center', builder: (_, __) => const SwipeBackPage(child: EmployeeCenterPage())),
    GoRoute(path: '/employee/premium', builder: (_, __) => const SwipeBackPage(child: EmployeeCenterPage())),
    GoRoute(path: '/attendance', builder: (_, s) => SwipeBackPage(child: AttendancePage(type: s.uri.queryParameters['type'] ?? 'check-in'))),
    GoRoute(path: '/employee/scan/:type', builder: (_, s) => SwipeBackPage(child: AttendancePage(type: s.pathParameters['type'] ?? 'check-in'))),
    GoRoute(path: '/history', builder: (_, __) => const SwipeBackPage(child: JibbleHistoryPage())),
    GoRoute(path: '/employee/history', builder: (_, __) => const SwipeBackPage(child: JibbleHistoryPage())),
    GoRoute(path: '/insights', builder: (_, __) => const SwipeBackPage(child: AttendanceInsightsPage())),
    GoRoute(path: '/requests', builder: (_, __) => const SwipeBackPage(child: RequestsPage())),
    GoRoute(path: '/notifications', builder: (_, __) => const SwipeBackPage(child: NotificationsPage())),
    GoRoute(path: '/employee/notifications', builder: (_, __) => const SwipeBackPage(child: NotificationsPage())),
    GoRoute(path: '/profile', builder: (_, __) => const SwipeBackPage(child: ProfilePage())),
    GoRoute(path: '/employee/profile', builder: (_, __) => const SwipeBackPage(child: ProfilePage())),
    GoRoute(path: '/services', builder: (_, __) => const SwipeBackPage(child: ServicesPage())),
    GoRoute(path: '/weather', builder: (_, __) => const SwipeBackPage(child: ServicesPage(initialTab: 0))),
    GoRoute(path: '/prayer', builder: (_, __) => const SwipeBackPage(child: ServicesPage(initialTab: 1))),
    GoRoute(path: '/ai', builder: (_, __) => const SwipeBackPage(child: AIAssistantPage())),
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
    if (x <= _edgeWidth) { _tracking = true; _fromLeft = true; _dragDistance = 0; }
    else if (x >= width - _edgeWidth) { _tracking = true; _fromLeft = false; _dragDistance = 0; }
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
    _tracking = false; _dragDistance = 0;
    if (shouldPop && mounted && context.canPop()) context.pop();
  }
  void _cancel() { _tracking = false; _dragDistance = 0; }
  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final isAdminArea = path == '/admin' || path.startsWith('/admin/') || path == '/manager' || path.startsWith('/manager/');
    final isEmployeeArea = path == '/home' || path == '/employee' || path == '/center' || path == '/employee/center' || path == '/employee/premium' || path == '/attendance' || path == '/history' || path == '/employee/history' || path == '/insights' || path == '/requests' || path == '/notifications' || path == '/employee/notifications' || path == '/profile' || path == '/employee/profile' || path == '/services' || path == '/weather' || path == '/prayer' || path == '/ai' || path.startsWith('/employee/scan/');
    final content = isAdminArea ? AdminMobileShell(child: widget.child) : isEmployeeArea ? EmployeeMobileShell(child: widget.child) : widget.child;
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragStart: _start,
      onHorizontalDragUpdate: _update,
      onHorizontalDragEnd: _end,
      onHorizontalDragCancel: _cancel,
      child: content,
    );
  }
}

class _NotFoundPage extends StatelessWidget {
  const _NotFoundPage();
  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.rtl,
    child: Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 420),
              padding: const EdgeInsets.all(30),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFDCE6E2)), boxShadow: const [BoxShadow(color: Color(0x0D142D27), blurRadius: 24, offset: Offset(0, 10))]),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.error_outline_rounded, color: Color(0xFF0B6B5A), size: 40),
                const SizedBox(height: 12),
                const Text('الصفحة غير موجودة', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF142D27), fontSize: 27, fontWeight: FontWeight.w900)),
                const SizedBox(height: 18),
                FilledButton.icon(onPressed: () => context.go('/'), icon: const Icon(Icons.home_rounded), label: const Text('العودة للرئيسية')),
              ]),
            ),
          ),
        ),
      ),
    ),
  );
}

class LoginEntryPage extends StatelessWidget {
  const LoginEntryPage({super.key});
  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.rtl,
    child: Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: .94), borderRadius: BorderRadius.circular(22), border: Border.all(color: const Color(0xFFDCE6E2)), boxShadow: const [BoxShadow(color: Color(0x0D142D27), blurRadius: 24, offset: Offset(0, 10))]),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [IconButton.filledTonal(onPressed: () => context.go('/'), icon: const Icon(Icons.arrow_forward_rounded)), const SizedBox(width: 10), const Expanded(child: Text('اختيار مساحة الدخول', style: TextStyle(color: Color(0xFF142D27), fontSize: 21, fontWeight: FontWeight.w900)))]),
                  const SizedBox(height: 18),
                  FilledButton.icon(onPressed: () => context.go('/employee-login'), icon: const Icon(Icons.person_rounded), label: const Text('مساحة الموظف')),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(onPressed: () => context.go('/manager/login'), icon: const Icon(Icons.admin_panel_settings_rounded), label: const Text('مساحة الإدارة')),
                ]),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
