import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keeps the app theme choice persistent without changing authentication data.
/// The value is intentionally limited to light, dark, or system.
class HadirThemeController extends ChangeNotifier {
  HadirThemeController._();

  static final HadirThemeController instance = HadirThemeController._();

  static const _storageKey = 'hadir_theme_mode';
  static const _storage = FlutterSecureStorage();

  ThemeMode _mode = ThemeMode.dark;
  bool _loaded = false;

  ThemeMode get mode => _mode;
  bool get loaded => _loaded;

  Future<void> load() async {
    final saved = await _storage.read(key: _storageKey);
    if (saved == 'light') {
      _mode = ThemeMode.light;
    } else if (saved == 'dark') {
      _mode = ThemeMode.dark;
    } else {
      _mode = ThemeMode.dark;
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> setMode(ThemeMode mode) async {
    if (_mode == mode && _loaded) return;
    _mode = mode;
    _loaded = true;
    notifyListeners();
    await _storage.write(key: _storageKey, value: _valueFor(mode));
  }

  String _valueFor(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return 'light';
      case ThemeMode.dark:
        return 'dark';
      case ThemeMode.system:
        return 'system';
    }
  }
}
