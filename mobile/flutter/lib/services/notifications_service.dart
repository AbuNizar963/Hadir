import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class HadirNotification {
  final String id;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool read;
  const HadirNotification({required this.id, required this.title, required this.body, required this.createdAt, this.read = false});

  Map<String, dynamic> toJson() => {'id': id, 'title': title, 'body': body, 'createdAt': createdAt.toIso8601String(), 'read': read};
  factory HadirNotification.fromJson(Map<String, dynamic> json) => HadirNotification(id: '${json['id']}', title: '${json['title'] ?? ''}', body: '${json['body'] ?? ''}', createdAt: DateTime.tryParse('${json['createdAt']}') ?? DateTime.now(), read: json['read'] == true);
}

class NotificationsService {
  static const _key = 'hadir.notifications';
  final FlutterSecureStorage storage;
  NotificationsService({FlutterSecureStorage? storage}) : storage = storage ?? const FlutterSecureStorage();

  Future<List<HadirNotification>> list() async {
    final raw = await storage.read(key: _key);
    if (raw == null || raw.isEmpty) return [];
    final value = jsonDecode(raw);
    if (value is! List) return [];
    return value.map((e) => HadirNotification.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<void> add({required String id, required String title, required String body}) async {
    final rows = await list();
    rows.insert(0, HadirNotification(id: id, title: title, body: body, createdAt: DateTime.now()));
    await storage.write(key: _key, value: jsonEncode(rows.take(50).map((e) => e.toJson()).toList()));
  }

  Future<void> markRead(String id) async {
    final rows = await list();
    await storage.write(key: _key, value: jsonEncode(rows.map((e) => e.id == id ? HadirNotification(id: e.id, title: e.title, body: e.body, createdAt: e.createdAt, read: true).toJson() : e.toJson()).toList()));
  }

  Future<void> markAllRead() async {
    final rows = await list();
    await storage.write(key: _key, value: jsonEncode(rows.map((e) => HadirNotification(id: e.id, title: e.title, body: e.body, createdAt: e.createdAt, read: true).toJson()).toList()));
  }
}
