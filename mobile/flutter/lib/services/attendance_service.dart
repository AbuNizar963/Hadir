import 'package:geolocator/geolocator.dart';
import '../core/api.dart';
import '../core/session.dart';

class AttendanceService {
  final HadirApi api;
  final HadirSession session;
  AttendanceService(this.api, this.session);

  Future<Map<String, dynamic>> workplace() async {
    final results = await Future.wait([
      api.employeeProfile(),
      api.locations(),
    ]);
    final profile = Map<String, dynamic>.from(results[0] as Map);
    final locations = List<dynamic>.from(results[1] as List);
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
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception('فعّل خدمة الموقع/GPS ثم حاول مرة أخرى.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) {
      throw Exception('تم رفض إذن الموقع. اسمح للتطبيق بالوصول إلى موقعك.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw Exception('إذن الموقع محظور. افتح إعدادات التطبيق واسمح بالموقع.');
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 25),
      ),
    );
  }

  double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
    return Geolocator.distanceBetween(lat1, lon1, lat2, lon2);
  }

  Future<AttendanceChallenge> prepareChallenge({required String type, required String qrCode}) async {
    final code = qrCode.trim();
    if (code.isEmpty) throw Exception('امسح رمز QR أو أدخله يدويًا.');

    final place = await workplace();
    final lat = double.tryParse('${place['lat']}');
    final lng = double.tryParse('${place['lng']}');
    final radius = double.tryParse('${place['radiusMeters']}');
    if (lat == null || lng == null || radius == null || radius <= 0) {
      throw Exception('بيانات موقع العمل غير صالحة.');
    }

    final position = await currentPosition();
    final distance = distanceMeters(position.latitude, position.longitude, lat, lng);
    if (distance > radius) {
      throw Exception(
        'أنت خارج نطاق العمل. المسافة الحالية ${distance.toStringAsFixed(1)} م، والحد ${radius.toStringAsFixed(0)} م.',
      );
    }

    final deviceId = await session.deviceId();
    final challenge = await api.createChallenge(
      type: type,
      lat: position.latitude,
      lng: position.longitude,
      qrCode: code,
      deviceId: deviceId,
    );
    final challengeId = challenge['challengeId']?.toString();
    final expiresAt = DateTime.tryParse('${challenge['expiresAt'] ?? ''}');
    if (challengeId == null || challengeId.isEmpty || expiresAt == null) {
      throw Exception('لم يكتمل التحقق من الحضور على الخادم.');
    }

    return AttendanceChallenge(
      challengeId: challengeId,
      expiresAt: expiresAt.toUtc(),
      distance: distance,
      accuracyMeters: position.accuracy,
      locationName: '${place['name'] ?? 'موقع العمل'}',
      radiusMeters: radius,
      latitude: position.latitude,
      longitude: position.longitude,
      locationId: '${place['id'] ?? 'main'}',
    );
  }

  Future<AttendanceResult> completeChallenge({
    required String type,
    required String qrCode,
    required AttendanceChallenge challenge,
  }) async {
    if (DateTime.now().toUtc().isAfter(challenge.expiresAt)) {
      throw Exception('انتهت مهلة التحقق. أعد مسح رمز QR ثم أكّد العملية مرة أخرى.');
    }
    final profile = await api.employeeProfile();
    final employee = Map<String, dynamic>.from(profile['employee'] is Map ? profile['employee'] : profile);
    await api.createAttendance({
      'employeeId': employee['id'],
      'jobNumber': employee['jobNumber'] ?? employee['job_number'],
      'employeeName': employee['name'],
      'type': type,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      'lat': challenge.latitude,
      'lng': challenge.longitude,
      'distanceMeters': challenge.distance,
      'deviceId': await session.deviceId(),
      'qrCode': qrCode.trim(),
      'locationId': challenge.locationId,
      'challengeId': challenge.challengeId,
    });
    return AttendanceResult(
      DateTime.now(),
      challenge.distance,
      accuracyMeters: challenge.accuracyMeters,
    );
  }

  Future<AttendanceResult> record({required String type, required String qrCode}) async {
    final challenge = await prepareChallenge(type: type, qrCode: qrCode);
    return completeChallenge(type: type, qrCode: qrCode, challenge: challenge);
  }
}

class AttendanceChallenge {
  final String challengeId;
  final DateTime expiresAt;
  final double distance;
  final double accuracyMeters;
  final String locationName;
  final double radiusMeters;
  final double latitude;
  final double longitude;
  final String locationId;

  const AttendanceChallenge({
    required this.challengeId,
    required this.expiresAt,
    required this.distance,
    required this.accuracyMeters,
    required this.locationName,
    required this.radiusMeters,
    this.latitude = 0,
    this.longitude = 0,
    this.locationId = 'main',
  });
}

class AttendanceResult {
  final DateTime time;
  final double distance;
  final double accuracyMeters;

  const AttendanceResult(
    this.time,
    this.distance, {
    this.accuracyMeters = 0,
  });
}
