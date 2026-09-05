import 'dart:io';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

class HadirSession {
  static const _tokenKey = 'hadir.employee.token';
  static const _deviceKey = 'hadir.device.id';
  final FlutterSecureStorage storage;
  HadirSession({FlutterSecureStorage? storage}) : storage = storage ?? const FlutterSecureStorage();

  Future<String?> token() => storage.read(key: _tokenKey);
  Future<void> saveToken(String token) => storage.write(key: _tokenKey, value: token);
  Future<void> clear() => storage.delete(key: _tokenKey);

  Future<String> deviceId() async {
    final existing = await storage.read(key: _deviceKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final id = const Uuid().v4();
    await storage.write(key: _deviceKey, value: id);
    return id;
  }

  String get platformLabel => Platform.isIOS ? 'iPhone' : 'Android';
}
