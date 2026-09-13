import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:hadir/modern_router.dart';

void main() {
  testWidgets('login entry exposes employee and admin spaces', (tester) async {
    final router = GoRouter(
      initialLocation: '/login',
      routes: [
        GoRoute(
          path: '/login',
          builder: (_, __) => const LoginEntryPage(),
        ),
        GoRoute(
          path: '/employee-login',
          builder: (_, __) => const Scaffold(body: Text('employee')),
        ),
        GoRoute(
          path: '/manager/login',
          builder: (_, __) => const Scaffold(body: Text('admin')),
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(find.text('مساحة الموظف'), findsOneWidget);
    expect(find.text('مساحة الإدارة'), findsOneWidget);

    await tester.tap(find.text('مساحة الموظف'));
    await tester.pumpAndSettle();
    expect(find.text('employee'), findsOneWidget);

    router.go('/login');
    await tester.pumpAndSettle();
    await tester.tap(find.text('مساحة الإدارة'));
    await tester.pumpAndSettle();
    expect(find.text('admin'), findsOneWidget);
  });

  test('restored employee session resumes the employee workspace', () {
    expect(
      resolveAuthenticatedRedirect(
        location: '/',
        employeeToken: 'employee-token',
      ),
      '/home',
    );
    expect(
      resolveAuthenticatedRedirect(
        location: '/employee-login',
        employeeToken: 'employee-token',
      ),
      '/home',
    );
  });

  test('restored admin session resumes the admin workspace', () {
    expect(
      resolveAuthenticatedRedirect(
        location: '/',
        adminToken: 'admin-token',
      ),
      '/admin',
    );
    expect(
      resolveAuthenticatedRedirect(
        location: '/manager/login',
        adminToken: 'admin-token',
      ),
      '/admin',
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
  });
}
