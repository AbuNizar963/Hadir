import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:hadir/features/authentication/authentication.dart';
import 'package:hadir/modern_router.dart';

void main() {
  testWidgets('login entry now opens the employee login directly', (tester) async {
    final router = GoRouter(
      initialLocation: '/login',
      routes: [
        GoRoute(
          path: '/login',
          builder: (_, __) => const LoginEntryPage(),
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(find.byType(EmployeeLoginPage), findsOneWidget);
    expect(find.text('مساحة الموظف'), findsNothing);
    expect(find.text('مساحة الإدارة'), findsNothing);
  });

  test('authenticated root redirects to the employee workspace', () {
    expect(
      resolveAuthenticatedRedirect(
        location: '/',
        employeeToken: 'employee-token',
      ),
      '/home',
    );
  });

  test('authenticated root redirects to the admin workspace', () {
    expect(
      resolveAuthenticatedRedirect(
        location: '/',
        adminToken: 'admin-token',
      ),
      '/admin',
    );
  });

  test('authentication entry routes remain public', () {
    expect(
      resolveAuthenticatedRedirect(
        location: '/employee-login',
        employeeToken: 'employee-token',
      ),
      isNull,
    );
    expect(
      resolveAuthenticatedRedirect(
        location: '/manager/login',
        adminToken: 'admin-token',
      ),
      isNull,
    );
  });

  test('protected routes still reject missing sessions', () {
    expect(
      resolveAuthenticatedRedirect(location: '/employee/scan/check-in'),
      '/login',
    );
    expect(
      resolveAuthenticatedRedirect(location: '/manager/reports'),
      '/admin-login',
    );
    expect(
      resolveAuthenticatedRedirect(location: '/manager-home'),
      '/admin-login',
    );
  });
}
