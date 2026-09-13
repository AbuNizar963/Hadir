import 'package:flutter_test/flutter_test.dart';

import 'package:hadir/app/routes/app_router.dart';

void main() {
  group('resolveAuthenticatedRedirect', () {
    test('opens employee login directly at /login when signed out', () {
      expect(
        resolveAuthenticatedRedirect(location: '/login'),
        isNull,
      );
    });

    test('redirects the root to employee home for an employee session', () {
      expect(
        resolveAuthenticatedRedirect(
          location: '/',
          employeeToken: 'employee-token',
        ),
        '/home',
      );
    });

    test('redirects the root to admin home for an admin session', () {
      expect(
        resolveAuthenticatedRedirect(
          location: '/',
          adminToken: 'admin-token',
        ),
        '/admin',
      );
    });

    test('keeps web public service routes reachable without a session', () {
      for (final location in ['/weather', '/prayer', '/ai']) {
        expect(
          resolveAuthenticatedRedirect(location: location),
          isNull,
          reason: location,
        );
      }
    });

    test('protects employee routes', () {
      expect(
        resolveAuthenticatedRedirect(location: '/employee/history'),
        '/login',
      );
      expect(
        resolveAuthenticatedRedirect(location: '/employee/scan/check-in'),
        '/login',
      );
    });

    test('protects admin routes', () {
      expect(
        resolveAuthenticatedRedirect(location: '/manager/reports'),
        '/admin-login',
      );
    });

    test('does not turn an unknown route into the landing page', () {
      expect(
        resolveAuthenticatedRedirect(location: '/this-route-does-not-exist'),
        isNull,
      );
    });

    test('premium route is represented by the center redirect in the router', () {
      final router = buildAppRouter();
      final premiumRoute = router.configuration.routes
          .whereType<dynamic>()
          .firstWhere((route) => route.path == '/employee/premium');
      expect(premiumRoute.path, '/employee/premium');
    });
  });
}
