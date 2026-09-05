import 'package:dio/dio.dart';

class HadirApi {
  static const baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  final Dio dio;
  HadirApi({String? token}) : dio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(seconds: 20))) {
    if (token != null && token.isNotEmpty) dio.options.headers['Authorization'] = 'Bearer $token';
  }

  Future<Map<String, dynamic>> login(String username, String password, {required String deviceId, String? fingerprint}) async {
    final r = await dio.post('/api/auth/login', data: {'username': username.trim(), 'password': password, 'deviceId': deviceId, 'deviceLabel': 'Flutter', 'deviceFingerprint': fingerprint ?? deviceId});
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<dynamic> me() => dio.get('/api/me').then((r) => r.data);
  Future<List<dynamic>> attendance({int limit = 500}) => dio.get('/api/attendance', queryParameters: {'limit': limit.clamp(1, 2000)}).then((r) => List<dynamic>.from(r.data as List));

  Future<Map<String, dynamic>> createChallenge({required String type, required double lat, required double lng, required String qrCode, String? deviceId}) async {
    final r = await dio.post('/api/attendance/challenge', data: {'type': type, 'lat': lat, 'lng': lng, 'qrCode': qrCode, if (deviceId != null) 'deviceId': deviceId});
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> createAttendance(Map<String, dynamic> record) async {
    final r = await dio.post('/api/attendance', data: record);
    return Map<String, dynamic>.from(r.data as Map);
  }
}
