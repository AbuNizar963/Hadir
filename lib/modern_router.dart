import 'package:go_router/go_router.dart';

/// Compatibility facade for the application router.
///
/// The canonical router implementation now lives under `app/routes/`.
library;

export 'app/routes/app_router.dart' show buildAppRouter, LoginEntryPage, SwipeBackPage;

/// Backward-compatible API retained for existing imports.
GoRouter buildModernRouter() => buildAppRouter();
