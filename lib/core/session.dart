import 'dart:io';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

class HadirSession {
  static const _tokenKey = 'hadir.employee.token';
  static const _adminTokenKey = 'hadir.admin.token';
  static const _deviceKey = 'hadir.device.id';
  static const _fingerprintKey = 'hadir.device.fingerprint';
  final FlutterSecureStorage storage;
  HadirSession({FlutterSecureStorage? storage}) : storage = storage ?? const FlutterSecureStorage();

  Future<String?> token() => storage.read(key: _tokenKey);
  Future<void> saveToken(String token) async {
    await storage.delete(key: _adminTokenKey);
    await storage.write(key: _tokenKey, value: token);
  }
  Future<String?> adminToken() => storage.read(key: _adminTokenKey);
  Future<void> saveAdminToken(String token) async {
    await storage.delete(key: _tokenKey);
    await storage.write(key: _adminTokenKey, value: token);
  }
  Future<void> clear() async {
    await storage.delete(key: _tokenKey);
    await storage.delete(key: _adminTokenKey);
  }
  Future<void> clearAdmin() => storage.delete(key: _adminTokenKey);

  Future<String> deviceId() async {
    final existing = await storage.read(key: _deviceKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final id = 'dev-${const Uuid().v4()}';
    await storage.write(key: _deviceKey, value: id);
    return id;
  }

  Future<String> deviceFingerprint() async {
    final existing = await storage.read(key: _fingerprintKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final fingerprint = 'native-${const Uuid().v4()}';
    await storage.write(key: _fingerprintKey, value: fingerprint);
    return fingerprint;
  }

  String get platformLabel => Platform.isIOS ? 'iPhone · حاضر' : 'Android · حاضر';
}
