import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';

class HadirSession {
  static const _tokenKey = 'hadir.employee.token';
  static const _adminTokenKey = 'hadir.admin.token';
  static const _deviceKey = 'hadir.device.id';
  static const _fingerprintKey = 'hadir.device.fingerprint';

  final FlutterSecureStorage storage;

  HadirSession({FlutterSecureStorage? storage})
      : storage = storage ?? const FlutterSecureStorage();

  Future<String?> token() => _read(_tokenKey);

  Future<void> saveToken(String token) async {
    await _delete(_adminTokenKey);
    await _write(_tokenKey, token);
  }

  Future<String?> adminToken() => _read(_adminTokenKey);

  Future<void> saveAdminToken(String token) async {
    await _delete(_tokenKey);
    await _write(_adminTokenKey, token);
  }

  Future<void> clear() async {
    await _delete(_tokenKey);
    await _delete(_adminTokenKey);
  }

  Future<void> clearEmployee() => _delete(_tokenKey);

  Future<void> clearAdmin() => _delete(_adminTokenKey);

  Future<String> deviceId() async {
    final existing = await _read(_deviceKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final id = 'dev-${const Uuid().v4()}';
    await _write(_deviceKey, id);
    return id;
  }

  Future<String> deviceFingerprint() async {
    final existing = await _read(_fingerprintKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final fingerprint = 'native-${const Uuid().v4()}';
    await _write(_fingerprintKey, fingerprint);
    return fingerprint;
  }

  String get platformLabel => Platform.isIOS ? 'iPhone · حاضر' : 'Android · حاضر';

  Future<String?> _read(String key) async {
    try {
      return await storage.read(key: key);
    } on PlatformException catch (error) {
      if (!_isCorruptedKeystoreError(error)) rethrow;

      // Android can retain encrypted preferences after an app restore or a
      // signing-key change. The old ciphertext can no longer be decrypted;
      // clear only secure app storage and let the user sign in again.
      await _resetCorruptedStorage();
      return null;
    }
  }

  Future<void> _resetCorruptedStorage() async {
    try {
      await storage.deleteAll();
    } on PlatformException {
      // Some Android versions throw while removing the first broken entry.
      // The next read/write will retry against the refreshed keystore state.
    }
  }

  Future<void> _delete(String key) async {
    try {
      await storage.delete(key: key);
    } on PlatformException catch (error) {
      if (!_isCorruptedKeystoreError(error)) rethrow;
      await _resetCorruptedStorage();
    }
  }

  Future<void> _write(String key, String value) async {
    try {
      await storage.write(key: key, value: value);
    } on PlatformException catch (error) {
      if (!_isCorruptedKeystoreError(error)) rethrow;
      await _resetCorruptedStorage();
      await storage.write(key: key, value: value);
    }
  }

  bool _isCorruptedKeystoreError(PlatformException error) {
    final message = '${error.code} ${error.message ?? ''}'.toLowerCase();
    return message.contains('badpadding') ||
        message.contains('bad decrypt') ||
        message.contains('bad_decrypt') ||
        message.contains('invalidkey') ||
        message.contains('key permanently invalidated') ||
        message.contains('keystore');
  }
}
