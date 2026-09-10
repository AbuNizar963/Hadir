/// Canonical application routing entry point.
///
/// Keep route composition inside `app/routes/app_router.dart` so navigation
/// remains centralized while older imports continue to work.
library;

export 'routes/app_router.dart' show buildAppRouter, LoginEntryPage, SwipeBackPage;

