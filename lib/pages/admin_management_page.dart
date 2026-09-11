import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../features/administration/pages/admin_management_page_implementation.dart' as implementation;
import 'manager_employees_directory_page.dart';

/// Compatibility entry point retained for existing imports.
///
/// The complete management implementation lives inside the administration
/// feature. The dedicated manager employees route keeps its specialized
/// employee-directory screen.
class AdminManagementPage extends StatelessWidget {
  const AdminManagementPage({super.key});

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    if (path == '/manager/employees') {
      return const ManagerEmployeesDirectoryPage();
    }
    return const implementation.AdminManagementPage();
  }
}
