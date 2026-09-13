import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'package:hadir/core/api.dart';
import 'package:hadir/core/hadir_time.dart';
import 'package:hadir/core/session.dart';
import 'package:hadir/services/attendance/attendance_service.dart';

void main() {
  setUpAll(tz.initializeTimeZones);

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

  group('AttendanceService.checkInWindowOpen', () {
    test('keeps administrative check-in closed before the shift starts', () {
      final employee = {
        'scheduleType': 'ADMIN',
        'workDays': [0, 1, 2, 3, 4],
        'workStartTime': '08:30',
        'workEndTime': '16:00',
      };

      expect(
        AttendanceService.checkInWindowOpen(
          employee,
          target: HadirTime.date(2026, 9, 13, 8, 29),
        ),
        isFalse,
      );
      expect(
        AttendanceService.checkInWindowError(
          employee,
          target: HadirTime.date(2026, 9, 13, 8, 29),
        ),
        contains('08:30'),
      );
    });

    test('opens administrative check-in at the configured start time', () {
      final employee = {
        'scheduleType': 'ADMIN',
        'workDays': [0, 1, 2, 3, 4],
        'workStartTime': '08:30',
        'workEndTime': '16:00',
      };

      expect(
        AttendanceService.checkInWindowOpen(
          employee,
          target: HadirTime.date(2026, 9, 13, 8, 30),
        ),
        isTrue,
      );
    });

    test('closes administrative check-in at the configured end time', () {
      final employee = {
        'scheduleType': 'ADMIN',
        'workDays': [0, 1, 2, 3, 4],
        'workStartTime': '08:30',
        'workEndTime': '16:00',
      };

      expect(
        AttendanceService.checkInWindowOpen(
          employee,
          target: HadirTime.date(2026, 9, 13, 16),
        ),
        isFalse,
      );
      expect(
        AttendanceService.checkInWindowError(
          employee,
          target: HadirTime.date(2026, 9, 13, 16),
        ),
        contains('انتهى'),
      );
    });

    test('blocks rotation rest days and pre-start cycles', () {
      final employee = {
        'scheduleType': 'ROTATION',
        'rotationStartDate': '2026-09-01',
        'rotationDaysOn': 4,
        'rotationDaysOff': 4,
        'workStartTime': '07:00',
      };

      expect(
        AttendanceService.checkInWindowOpen(
          employee,
          target: HadirTime.date(2026, 9, 5, 10),
        ),
        isFalse,
      );
      expect(
        AttendanceService.checkInWindowOpen(
          employee,
          target: HadirTime.date(2026, 9, 9, 6, 59),
        ),
        isFalse,
      );
      expect(
        AttendanceService.checkInWindowOpen(
          employee,
          target: HadirTime.date(2026, 9, 9, 7),
        ),
        isTrue,
      );
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
