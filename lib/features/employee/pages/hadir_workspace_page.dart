import 'package:flutter/material.dart';

import 'hadir_workspace_page_implementation.dart' as implementation;

/// Compatibility entry point for the employee workspace screen.
///
/// The complete attendance and request implementation remains in the
/// employee feature boundary. This facade only constrains the content width
/// to the same narrow mobile canvas used by the web reference.
class HadirWorkspacePage extends StatelessWidget {
  const HadirWorkspacePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 576),
        child: const implementation.HadirWorkspacePage(),
      ),
    );
  }
}
