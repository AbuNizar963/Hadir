import 'package:flutter/material.dart';

import 'admin_mobile_dashboard_page.dart';

/// Android-first entry point for the administration dashboard.
///
/// The router owns the shared AdminMobileShell. This page must therefore
/// provide dashboard content only, preventing duplicate headers and bars.
class AdminMobileHomePage extends StatelessWidget {
  const AdminMobileHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return const AdminMobileDashboardPage();
  }
}
