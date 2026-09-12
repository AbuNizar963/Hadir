import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hadir/core/api.dart';
import 'package:hadir/core/session.dart';
import 'package:hadir/services/attendance/attendance_service.dart';

void main() {
  group('AttendanceService', () {
    late AttendanceService service;

    setUp(() {
      service = AttendanceService(HadirApi(), HadirSession());
    });

    test('calculates zero distance for the same coordinates', () {
      expect(service.distanceMeters(33.5138, 36.2765, 33.5138, 36.2765), 0);
    });

    test('calculates a positive distance for different coordinates', () {
      final distance = service.distanceMeters(33.5138, 36.2765, 33.5148, 36.2765);
      expect(distance, greaterThan(0));
      expect(distance, closeTo(111.2, 2.0));
    });
  });

  group('HadirApi.errorMessage', () {
    test('uses the server error message when available', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/api/attendance'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/attendance'),
          statusCode: 400,
          data: {'error': 'بيانات الحضور غير صالحة'},
        ),
      );

      expect(HadirApi.errorMessage(error), 'بيانات الحضور غير صالحة');
    });
  });
}
