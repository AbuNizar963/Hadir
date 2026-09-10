/// Administration feature public API.
///
/// This barrel is the stable dependency boundary for administration. The
/// underlying implementations may migrate without changing route imports.
library;

export 'pages/admin_mobile_home_page.dart';
export 'pages/admin_home_page.dart';
export 'pages/admin_mobile_settings_page.dart';
export 'pages/admin_audit_page.dart';
export 'pages/admin_management_page.dart';
export 'pages/admin_operations_page.dart';
export 'pages/admin_reports_page.dart';
export 'pages/admin_report_archive_page.dart';
export 'pages/admin_role_workspace_page.dart';
export 'pages/manager_requests_page.dart';
export 'pages/employee_transfer_page.dart';
export '../authentication/pages/admin_login_page.dart';
