import 'dart:math';
import 'package:geolocator/geolocator.dart';
import '../core/api.dart';
import '../core/session.dart';

class AttendanceService {
  final HadirApi api;
  final HadirSession session;
  AttendanceService(this.api, this.session);

  Future<Map<String, dynamic>> workplace() async {
    final profile = await api.employeeProfile();
    final locations = await api.locations();
    final profileMap = Map<String, dynamic>.from(profile['employee'] is Map ? profile['employee'] : profile);
    final wanted = profileMap['locationId']?.toString();
    Map<String, dynamic>? selected;
    for (final item in locations) {
      final row = Map<String, dynamic>.from(item as Map);
      if (wanted != null && row['id']?.toString() == wanted) selected = row;
    }
    if (selected == null) {
      for (final item in locations) {
        final row = Map<String, dynamic>.from(item as Map);
        if (row['id']?.toString() == 'main') selected = row;
      }
    }
    selected ??= locations.isNotEmpty ? Map<String, dynamic>.from(locations.first as Map) : null;
    if (selected == null) throw Exception('لم يتم إعداد موقع العمل للموظف.');
    return selected;
  }

  Future<Position> currentPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) throw Exception('فعّل خدمة الموقع/GPS ثم حاول مرة أخرى.');
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) throw Exception('تم رفض إذن الموقع. اسمح للتطبيق بالوصول إلى موقعك.');
    if (permission == LocationPermission.deniedForever) throw Exception('إذن الموقع محظور. افتح إعدادات التطبيق واسمح بالموقع.');
    return Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 25)));
  }

  double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
    const earth = 6371000.0;
    final p1 = lat1 * pi / 180, p2 = lat2 * pi / 180;
    final dp = (lat2 - lat1) * pi / 180, dl = (lon2 - lon1) * pi / 180;
    final a = sin(dp / 2) * sin(dp / 2) + cos(p1) * cos(p2) * sin(dl / 2) * sin(dl / 2);
    return earth * 2 * atan2(sqrt(a.clamp(0, 1)), sqrt(1 - a.clamp(0, 1)));
  }

  Future<AttendanceResult> record({required String type, required String qrCode}) async {
    final place = await workplace();
    final lat = double.tryParse('${place['lat']}');
    final lng = double.tryParse('${place['lng']}');
    final radius = double.tryParse('${place['radiusMeters']}');
    if (lat == null || lng == null || radius == null || radius <= 0) throw Exception('بيانات موقع العمل غير صالحة.');
    final position = await currentPosition();
    final distance = distanceMeters(position.latitude, position.longitude, lat, lng);
    if (distance > radius) throw Exception('أنت خارج نطاق العمل. المسافة الحالية ${distance.toStringAsFixed(1)} م، والحد ${radius.toStringAsFixed(0)} م.');
    final deviceId = await session.deviceId();
    final challenge = await api.createChallenge(type: type, lat: position.latitude, lng: position.longitude, qrCode: qrCode.trim(), deviceId: deviceId);
    final challengeId = challenge['challengeId']?.toString();
    if (challengeId == null || challengeId.isEmpty) throw Exception('لم يكتمل التحقق من الحضور على الخادم.');
    final profile = await api.employeeProfile();
    final employee = Map<String, dynamic>.from(profile['employee'] is Map ? profile['employee'] : profile);
    await api.createAttendance({
      'id': 'flutter-${DateTime.now().microsecondsSinceEpoch}',
      'employeeId': employee['id'], 'jobNumber': employee['jobNumber'] ?? employee['job_number'],
      'employeeName': employee['name'], 'type': type, 'timestamp': DateTime.now().toUtc().toIso8601String(),
      'lat': position.latitude, 'lng': position.longitude, 'distanceMeters': distance,
      'deviceId': deviceId, 'qrCode': qrCode.trim(), 'locationId': place['id'], 'challengeId': challengeId,
    });
    return AttendanceResult(DateTime.now(), distance);
  }
}

class AttendanceResult {
  final DateTime time;
  final double distance;
  const AttendanceResult(this.time, this.distance);
}
