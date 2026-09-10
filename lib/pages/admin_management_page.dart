import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'admin_management_page_legacy.dart' as legacy;
import 'manager_employees_directory_page.dart';

/// Keeps the complete existing management implementation for every management
/// route, while the dedicated manager employees tab uses the website-aligned
/// employee directory UI.
class AdminManagementPage extends StatelessWidget {
  const AdminManagementPage({super.key});

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/manager/employees') {
      return const ManagerEmployeesDirectoryPage();
    }
    return const legacy.AdminManagementPage();
  }
}
