import 'admin_mobile_settings_reference_page.dart';

/// Compatibility facade. The previous settings implementation is preserved in
/// `admin_mobile_settings_page_legacy.dart`; this route now uses the reference
/// settings workspace captured from the manager UI.
class AdminMobileSettingsPage extends AdminMobileSettingsReferencePage {
  const AdminMobileSettingsPage({super.key});
}
