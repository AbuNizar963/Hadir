/// Manager feature public API.
///
/// Manager workflows currently reuse the administration implementations. This
/// barrel keeps the manager dependency boundary stable while those screens are
/// migrated independently.
library;

export '../../pages/manager_requests_page.dart';
export '../../pages/hadir_workspace_page.dart';
export '../../pages/admin_role_workspace_page.dart';
export '../../pages/admin_management_page.dart';
export '../../pages/admin_operations_page.dart';
export '../../pages/admin_reports_page.dart';
export '../../pages/admin_report_archive_page.dart';
export '../../pages/admin_audit_page.dart';
export '../administration/pages/admin_mobile_settings_page.dart';
