import 'package:dio/dio.dart';

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

  Future<Map<String, dynamic>> login(String username, String password, {required String deviceId, required String deviceLabel, required String fingerprint}) async => Map<String, dynamic>.from((await dio.post('/api/auth/login', data: {'username': username.trim(), 'password': password, 'deviceId': deviceId, 'deviceLabel': deviceLabel, 'deviceFingerprint': fingerprint})).data as Map);
  Future<Map<String, dynamic>> adminLogin(String username, String password) async => Map<String, dynamic>.from((await dio.post('/api/auth/login', data: {'username': username.trim(), 'password': password})).data as Map);
  Future<Map<String, dynamic>> me() async => Map<String, dynamic>.from((await dio.get('/api/me')).data as Map);
  Future<Map<String, dynamic>> employeeProfile() async => Map<String, dynamic>.from((await dio.get('/api/employee/profile')).data as Map);
  Future<Map<String, dynamic>> employeeDeviceStatus() async => Map<String, dynamic>.from((await dio.get('/api/device/status')).data as Map);
  Future<List<dynamic>> locations() async => List<dynamic>.from((await dio.get('/api/locations')).data as List);
  Future<dynamic> attendance({int limit = 500}) async => List<dynamic>.from((await dio.get('/api/attendance', queryParameters: {'limit': limit.clamp(1, 2000)})).data as List);
  Future<Map<String, dynamic>> createChallenge({required String type, required double lat, required double lng, required String qrCode, required String deviceId}) async => Map<String, dynamic>.from((await dio.post('/api/attendance/challenge', data: {'type': type, 'lat': lat, 'lng': lng, 'qrCode': qrCode, 'deviceId': deviceId})).data as Map);
  Future<Map<String, dynamic>> createAttendance(Map<String, dynamic> record) async => Map<String, dynamic>.from((await dio.post('/api/attendance', data: record)).data as Map);
  Future<List<dynamic>> requests() async => List<dynamic>.from((await dio.get('/api/requests')).data as List);
  Future<Map<String, dynamic>> createRequest({required String type, required String reason, String? startDate, String? endDate, String? employeeId}) async => Map<String, dynamic>.from((await dio.post('/api/requests', data: {'type': type, 'reason': reason, if (startDate != null) 'startDate': startDate, if (endDate != null) 'endDate': endDate, if (employeeId != null) 'employeeId': employeeId})).data as Map);
  Future<List<dynamic>> notifications() async => List<dynamic>.from((await dio.get('/api/notifications')).data as List);
  Future<void> markNotificationRead({String? id}) async { await dio.post('/api/notifications/read', data: {if (id != null) 'id': id}); }
  Future<void> deleteNotification({String? id}) async { await dio.delete('/api/notifications', data: {if (id != null) 'id': id}); }
  Future<Map<String, dynamic>> confirmRequest(String id) async => Map<String, dynamic>.from((await dio.post('/api/requests/$id/confirm')).data as Map);
  Future<void> logout() async { try { await dio.post('/api/auth/logout', data: {}); } catch (_) {} }
}
