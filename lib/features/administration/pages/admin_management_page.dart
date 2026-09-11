import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'admin_management_page_implementation.dart' as implementation;
import 'manager_employees_directory_page.dart';

/// Administration management page compatibility entry point.
///
/// The complete management implementation remains canonical in
/// [admin_management_page_implementation.dart]. The manager employee route
/// intentionally resolves to its dedicated directory implementation.
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
