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
          path: '/admin-login',
          builder: (_, __) => const Scaffold(body: Text('admin')),
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(find.text('مساحة الموظف'), findsOneWidget);
    expect(find.text('مساحة الإدارة'), findsOneWidget);
    expect(find.text('الحضور، السجل، الطلبات والخدمات'), findsOneWidget);
    expect(find.text('التشغيل، الموظفون والتقارير'), findsOneWidget);

    await tester.tap(find.text('مساحة الموظف'));
    await tester.pumpAndSettle();
    expect(find.text('employee'), findsOneWidget);

    router.go('/login');
    await tester.pumpAndSettle();
    await tester.tap(find.text('مساحة الإدارة'));
    await tester.pumpAndSettle();
    expect(find.text('admin'), findsOneWidget);
  });
}
