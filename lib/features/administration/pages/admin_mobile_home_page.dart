import 'package:flutter/material.dart';

import '../../../pages/admin_role_workspace_page.dart';
import '../widgets/admin_mobile_shell.dart';

/// Android-first entry point for the administration workspace.
///
/// The existing dashboard remains untouched; this page only supplies the
/// shared mobile navigation requested for the Android presentation.
class AdminMobileHomePage extends StatelessWidget {
  const AdminMobileHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return const AdminMobileShell(
      child: AdminRoleWorkspacePage(),
    );
  }
}
