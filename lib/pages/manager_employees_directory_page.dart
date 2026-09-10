import 'package:flutter/material.dart';

import 'admin_management_page_legacy.dart' as legacy;

/// Compatibility entry point for the manager employee directory.
/// The complete management implementation remains in the preserved legacy page,
/// so the existing employee CRUD, attendance, workforce controls, requests,
/// audit, locations and administrator functionality stays intact.
class ManagerEmployeesDirectoryPage extends StatelessWidget {
  const ManagerEmployeesDirectoryPage({super.key});

  @override
  Widget build(BuildContext context) => const legacy.AdminManagementPage();
}
