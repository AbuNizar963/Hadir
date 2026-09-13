import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

class HadirApi {
  static const baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  final Dio dio;

  HadirApi({String? token}) : dio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(seconds: 20), sendTimeout: const Duration(seconds: 20), headers: const {'Accept': 'application/json'})) {
    if (token != null && token.isNotEmpty) dio.options.headers['Authorization'] = 'Bearer $token';
  }

  static String errorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      if (error.type == DioExceptionType.connectionError || error.type == DioExceptionType.connectionTimeout) return 'تعذر الاتصال بخادم حاضر. تحقق من الإنترنت ثم حاول مرة أخرى.';
      return 'تعذر إكمال العملية (${error.response?.statusCode ?? 'شبكة'}).';
    }
    return error.toString();
  }

  String employeeAvatarUrl(String employeeId) => '$baseUrl/api/employees/${Uri.encodeComponent(employeeId)}/avatar';

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    if (value is List) return <String, dynamic>{};
    return <String, dynamic>{};
  }

  List<dynamic> _asList(dynamic value) {
    if (value is List) return List<dynamic>.from(value);
    if (value is Map) {
      for (final key in const ['data', 'items', 'employees', 'requests', 'notifications', 'locations', 'attendance', 'audit', 'entries']) {
        final nested = value[key];
        if (nested is List) return List<dynamic>.from(nested);
      }
    }
    return <dynamic>[];
  }

  Future<Map<String, dynamic>> login(String username, String password, {required String deviceId, required String deviceLabel, required String fingerprint}) async {
    final full = <String, dynamic>{'username': username.trim(), 'password': password, 'deviceId': deviceId, 'deviceLabel': deviceLabel, 'deviceFingerprint': fingerprint};
    try {
      return _asMap((await dio.post('/api/auth/login', data: jsonEncode(full), options: Options(contentType: Headers.jsonContentType))).data);
    } on DioException catch (error) {
      if (error.response?.statusCode != 400) rethrow;
      final legacy = <String, dynamic>{'username': username.trim(), 'password': password, 'deviceId': deviceId, 'deviceLabel': deviceLabel};
      return _asMap((await dio.post('/api/auth/login', data: jsonEncode(legacy), options: Options(contentType: Headers.jsonContentType))).data);
    }
  }

  Future<Map<String, dynamic>> adminLogin(String username, String password, {String? deviceId, String? deviceLabel, String? fingerprint}) async {
    final full = <String, dynamic>{'username': username.trim(), 'password': password};
    if (deviceId != null && deviceId.trim().isNotEmpty) full['deviceId'] = deviceId.trim();
    if (deviceLabel != null && deviceLabel.trim().isNotEmpty) full['deviceLabel'] = deviceLabel.trim();
    if (fingerprint != null && fingerprint.trim().isNotEmpty) full['deviceFingerprint'] = fingerprint.trim();
    try {
      return _asMap((await dio.post('/api/auth/login', data: jsonEncode(full), options: Options(contentType: Headers.jsonContentType))).data);
    } on DioException catch (error) {
      if (error.response?.statusCode != 400 || full.length == 2) rethrow;
      final legacy = <String, dynamic>{'username': username.trim(), 'password': password};
      return _asMap((await dio.post('/api/auth/login', data: jsonEncode(legacy), options: Options(contentType: Headers.jsonContentType))).data);
    }
  }

  Future<Map<String, dynamic>> me() async => _asMap((await dio.get('/api/me')).data);
  Future<Map<String, dynamic>> employeeProfile() async => _asMap((await dio.get('/api/employee/profile')).data);
  Future<Map<String, dynamic>> updateEmployeeProfile(Map<String, dynamic> body) async => _asMap((await dio.patch('/api/workforce/live', data: body)).data);
  Future<Map<String, dynamic>> employeeDeviceStatus() async => _asMap((await dio.get('/api/device/status')).data);
  Future<List<dynamic>> locations() async => _asList((await dio.get('/api/locations')).data);
  Future<List<dynamic>> attendance({int limit = 500}) async => _asList((await dio.get('/api/attendance', queryParameters: {'limit': limit.clamp(1, 2000)})).data);
  Future<List<dynamic>> audit({int limit = 500}) async => _asList((await dio.get('/api/audit', queryParameters: {'limit': limit.clamp(1, 2000)})).data);
  Future<List<dynamic>> escapeEvents({String? employeeId, int limit = 20}) async => _asList((await dio.get('/api/escape-events', queryParameters: {'limit': limit.clamp(1, 500), if (employeeId != null && employeeId.isNotEmpty) 'employeeId': employeeId})).data);
  Future<Map<String, dynamic>> createChallenge({required String type, required double lat, required double lng, required String qrCode, required String deviceId}) async => _asMap((await dio.post('/api/attendance/challenge', data: {'type': type, 'lat': lat, 'lng': lng, 'qrCode': qrCode, 'deviceId': deviceId})).data);
  Future<Map<String, dynamic>> createAttendance(Map<String, dynamic> record) async => _asMap((await dio.post('/api/attendance', data: record)).data);
  Future<List<dynamic>> requests() async => _asList((await dio.get('/api/requests')).data);
  Future<Map<String, dynamic>> createRequest({required String type, required String reason, String? startDate, String? endDate, String? employeeId}) async => _asMap((await dio.post('/api/requests', data: {'type': type, 'reason': reason, if (startDate != null) 'startDate': startDate, if (endDate != null) 'endDate': endDate, if (employeeId != null) 'employeeId': employeeId})).data);
  Future<List<dynamic>> notifications() async => _asList((await dio.get('/api/notifications')).data);
  Future<void> markNotificationRead({String? id}) async { await dio.post('/api/notifications/read', data: {if (id != null) 'id': id}); }
  Future<void> deleteNotification({String? id}) async { await dio.delete('/api/notifications', data: {if (id != null) 'id': id}); }
  Future<Map<String, dynamic>> confirmRequest(String id) async => _asMap((await dio.post('/api/requests/$id/confirm')).data);
  Future<void> logout() async { try { await dio.post('/api/auth/logout', data: {}); } catch (_) {} }
  Future<Map<String, dynamic>> settings() async => _asMap((await dio.get('/api/settings')).data);
  Future<Map<String, dynamic>> updateSettings(Map<String, dynamic> settings) async => _asMap((await dio.put('/api/settings', data: settings)).data);
  Future<String> uploadCompanyLogo(String filePath) async {
    final compressed = await FlutterImageCompress.compressWithFile(
      filePath,
      minWidth: 1024,
      minHeight: 1024,
      quality: 88,
      format: CompressFormat.webp,
      autoCorrectionAngle: true,
      keepExif: false,
    );
    if (compressed == null || compressed.isEmpty) throw StateError('تعذر تحويل الشعار إلى WebP.');
    final tempDir = await Directory.systemTemp.createTemp('hadir-company-logo-');
    final webpFile = File('${tempDir.path}/company-logo.webp');
    try {
      await webpFile.writeAsBytes(compressed, flush: true);
      final response = await dio.post('/api/company/logo', data: FormData.fromMap({'file': await MultipartFile.fromFile(webpFile.path, filename: 'company-logo.webp')}));
      final data = _asMap(response.data);
      final url = data['url']?.toString();
      if (url == null || url.isEmpty) throw StateError('لم يُرجع الخادم رابط شعار صالح.');
      return url;
    } finally {
      await webpFile.delete().catchError((_) => webpFile);
      await tempDir.delete().catchError((_) => tempDir);
    }
  }
  Future<void> deleteCompanyLogo() async { await dio.delete('/api/company/logo'); }
  Future<Map<String, dynamic>> professionalAttendanceReport({required String from, required String to, String? employeeId}) async {
    final response = await dio.get('/api/manager/attendance-center', queryParameters: {
      'date': to,
      'from': from,
      'to': to,
      if (employeeId != null && employeeId.isNotEmpty) 'employeeId': employeeId,
    });
    final data = _asMap(response.data);
    final report = data['report'];
    if (report is! Map) throw StateError('استجابة مركز التقرير غير صالحة.');
    return Map<String, dynamic>.from(report);
  }
  Future<Map<String, dynamic>> professionalAttendanceDrilldown({required String attendanceDay, required String employeeId}) async => _asMap((await dio.get('/api/reports/professional-attendance', queryParameters: {'from': attendanceDay, 'to': attendanceDay, 'employeeId': employeeId, 'drilldown': '1'})).data);
  Future<List<dynamic>> archivedReports({int limit = 25}) async { final data = _asMap((await dio.get('/api/reports/archive', queryParameters: {'limit': limit.clamp(1, 100)})).data); return _asList(data['reports']); }
  Future<List<int>> downloadArchivedReport(String reportId) async => List<int>.from((await dio.get<List<int>>('/api/reports/archive/${Uri.encodeComponent(reportId)}', options: Options(responseType: ResponseType.bytes))).data ?? const <int>[]);
  Future<void> deleteArchivedReport(String reportId) async { await dio.delete('/api/reports/archive/${Uri.encodeComponent(reportId)}'); }
  Future<Map<String, dynamic>> workforceLive() async => _asMap((await dio.get('/api/workforce/live')).data);
  Future<List<dynamic>> violations({int limit = 100}) async => _asList((await dio.get('/api/violations', queryParameters: {'limit': limit.clamp(1, 500)})).data);
  Future<List<dynamic>> deviceRebindRequests() async => _asList((await dio.get('/api/device-rebind-requests')).data);
  Future<Map<String, dynamic>> dailyStatus({required String date}) async => _asMap((await dio.get('/api/manager/daily-status', queryParameters: {'date': date})).data);
  Future<Map<String, dynamic>> health() async => _asMap((await dio.get('/api/health')).data);
}
