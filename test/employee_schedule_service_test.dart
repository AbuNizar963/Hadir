import 'package:flutter_test/flutter_test.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'package:hadir/core/hadir_time.dart';
import 'package:hadir/features/employee/services/employee_schedule_service.dart';

void main() {
  setUpAll(tz.initializeTimeZones);

  const service = EmployeeScheduleService();

  group('ADMIN schedule', () {
    test('resolves configured work day and hours', () {
      final state = service.resolve(
        {
          'scheduleType': 'ADMIN',
          'workDays': [0, 1, 2, 3, 4],
          'workStartTime': '08:30',
          'workEndTime': '16:00',
        },
        target: HadirTime.date(2026, 9, 13, 10),
      );

      expect(state.isWorkDay, isTrue);
      expect(state.kind, 'ADMIN');
      expect(state.detail, '08:30 → 16:00');
    });

    test('resolves Friday as weekly rest with Sunday-Friday work configuration', () {
      final state = service.resolve(
        {'scheduleType': 'ADMIN', 'workDays': [0, 1, 2, 3, 4]},
        target: HadirTime.date(2026, 9, 11, 10),
      );

      expect(state.isWorkDay, isFalse);
      expect(state.kind, 'OFF');
      expect(state.label, 'إجازة أسبوعية');
    });
  });

  group('ROTATION schedule', () {
    final employee = {
      'scheduleType': 'ROTATION',
      'rotationStartDate': '2026-09-01',
      'rotationDaysOn': 4,
      'rotationDaysOff': 4,
      'workStartTime': '07:00',
    };

    test('resolves a work day inside the configured cycle', () {
      final state = service.resolve(
        employee,
        target: HadirTime.date(2026, 9, 2, 10),
      );

      expect(state.isWorkDay, isTrue);
      expect(state.kind, 'ROTATION');
      expect(state.cycleDay, 2);
      expect(state.cycleTotal, 8);
    });

    test('resolves the configured off period', () {
      final state = service.resolve(
        employee,
        target: HadirTime.date(2026, 9, 5, 10),
      );

      expect(state.isWorkDay, isFalse);
      expect(state.kind, 'OFF');
      expect(state.cycleDay, 5);
    });

    test('does not mark the rotation as started before first shift time', () {
      final state = service.resolve(
        employee,
        target: HadirTime.date(2026, 8, 31, 23),
      );

      expect(state.kind, 'NOT_STARTED');
      expect(state.isWorkDay, isFalse);
    });
  });
}
