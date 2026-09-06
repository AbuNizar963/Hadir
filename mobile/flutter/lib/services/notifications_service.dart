import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/api.dart';
import '../core/session.dart';

class HadirNotification {
  final String id;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool read;
  const HadirNotification({required this.id, required this.title, required this.body, required this.createdAt, this.read = false});

  factory HadirNotification.fromJson(Map<String, dynamic> json) => HadirNotification(
    id: '${json['id']}', title: '${json['title'] ?? ''}', body: '${json['body'] ?? json['message'] ?? ''}',
    createdAt: DateTime.tryParse('${json['createdAt'] ?? json['created_at']}') ?? DateTime.now(),
    read: json['read'] == true || json['readAt'] != null,
  );
  Map<String, dynamic> toJson() => {'id': id, 'title': title, 'body': body, 'createdAt': createdAt.toIso8601String(), 'read': read};
}

class NotificationsService {
  static const _key = 'hadir.notifications.cache';
  final FlutterSecureStorage storage;
  final HadirSession session;
  NotificationsService({FlutterSecureStorage? storage, HadirSession? session}) : storage = storage ?? const FlutterSecureStorage(), session = session ?? HadirSession();

  Future<List<HadirNotification>> _local() async {
    final raw = await storage.read(key: _key);
    if (raw == null || raw.isEmpty) return [];
    try { final value = jsonDecode(raw); if (value is! List) return []; return value.map((e) => HadirNotification.fromJson(Map<String, dynamic>.from(e as Map))).toList(); } catch (_) { return []; }
  }

  Future<List<HadirNotification>> list() async {
    final token = await session.token();
    if (token == null || token.isEmpty) return _local();
    try {
      final remote = await HadirApi(token: token).notifications();
      final rows = remote.map((e) => HadirNotification.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      await storage.write(key: _key, value: jsonEncode(rows.take(100).map((e) => e.toJson()).toList()));
      return rows;
    } catch (_) { return _local(); }
  }

  Future<void> markRead(String id) async {
    final token = await session.token();
    if (token != null && token.isNotEmpty) { try { await HadirApi(token: token).markNotificationRead(id: id); } catch (_) {} }
    final rows = await _local();
    await storage.write(key: _key, value: jsonEncode(rows.map((e) => e.id == id ? HadirNotification(id:e.id,title:e.title,body:e.body,createdAt:e.createdAt,read:true).toJson() : e.toJson()).toList()));
  }

  Future<void> markAllRead() async {
    final token = await session.token();
    if (token != null && token.isNotEmpty) { try { await HadirApi(token: token).markNotificationRead(); } catch (_) {} }
    final rows = await _local();
    await storage.write(key: _key, value: jsonEncode(rows.map((e) => HadirNotification(id:e.id,title:e.title,body:e.body,createdAt:e.createdAt,read:true).toJson()).toList()));
  }

  Future<void> delete(String id) async {
    final token = await session.token();
    if (token != null && token.isNotEmpty) { try { await HadirApi(token: token).deleteNotification(id:id); } catch (_) {} }
    final rows = await _local();
    await storage.write(key: _key, value: jsonEncode(rows.where((e) => e.id != id).map((e) => e.toJson()).toList()));
  }
}
