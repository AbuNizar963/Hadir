/// Manager feature public API.
///
/// Manager workflows currently reuse administration and employee implementations.
/// This barrel keeps the manager dependency boundary stable while those screens
/// are migrated independently.
library;

export '../administration/pages/manager_requests_page.dart';
export '../employee/pages/hadir_workspace_page.dart';
export '../administration/pages/admin_role_workspace_page.dart';
export '../administration/pages/admin_management_page.dart';
export '../administration/pages/admin_operations_page.dart';
export '../administration/pages/admin_reports_page.dart';
export '../administration/pages/admin_report_archive_page.dart';
export '../administration/pages/admin_audit_page.dart';
export '../administration/pages/admin_mobile_settings_page.dart';
export '../administration/pages/manager_employees_directory_page.dart';
