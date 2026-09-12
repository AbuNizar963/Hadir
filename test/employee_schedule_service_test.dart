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

    test('uses the web defaults when work days and hours are omitted', () {
      final state = service.resolve(
        {'scheduleType': 'ADMIN'},
        target: HadirTime.date(2026, 9, 13, 10),
      );

      expect(state.isWorkDay, isTrue);
      expect(state.detail, '09:00 → 16:00');
    });

    test('supports an overnight administrative shift', () {
      final state = service.resolve(
        {
          'scheduleType': 'ADMIN',
          'workDays': [0, 1, 2, 3, 4],
          'workStartTime': '22:00',
          'workEndTime': '06:00',
        },
        target: HadirTime.date(2026, 9, 13, 23),
      );

      expect(state.isWorkDay, isTrue);
      expect(state.kind, 'ADMIN');
      expect(state.detail, '22:00 → 06:00');
    });

    test('reports web-compatible rest status after the configured end time', () {
      final state = service.resolveStatus(
        {
          'scheduleType': 'ADMIN',
          'workDays': [0, 1, 2, 3, 4],
          'workStartTime': '08:30',
          'workEndTime': '16:00',
        },
        target: HadirTime.date(2026, 9, 13, 16),
      );

      expect(state.isWorkDay, isFalse);
      expect(state.kind, 'OFF');
      expect(state.label, 'فترة راحة');
      expect(state.detail, 'انتهى دوام اليوم · العمل القادم 2026-09-14 08:30');
      expect(state.start, HadirTime.date(2026, 9, 14, 8, 30));
    });

    test('reports web-compatible active status during configured hours', () {
      final state = service.resolveStatus(
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
      expect(state.label, 'في المناوبة');
      expect(state.detail, 'يوم عمل (إداري)');
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
      expect(state.detail, contains('07:00'));
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

    test('keeps the first rotation day pending until the configured start time', () {
      final before = service.resolveStatus(
        employee,
        target: HadirTime.date(2026, 9, 1, 6, 59),
      );
      final atStart = service.resolveStatus(
        employee,
        target: HadirTime.date(2026, 9, 1, 7),
      );

      expect(before.kind, 'NOT_STARTED');
      expect(before.isWorkDay, isFalse);
      expect(atStart.kind, 'ROTATION');
      expect(atStart.isWorkDay, isTrue);
      expect(atStart.detail, 'اليوم 1 من 4 في المناوبة');
    });

    test('keeps every later rotation work cycle pending until its start time', () {
      final before = service.resolveStatus(
        employee,
        target: HadirTime.date(2026, 9, 9, 6, 59),
      );
      final atStart = service.resolveStatus(
        employee,
        target: HadirTime.date(2026, 9, 9, 7),
      );

      expect(before.kind, 'NOT_STARTED');
      expect(before.isWorkDay, isFalse);
      expect(before.cycleDay, 1);
      expect(before.start, HadirTime.date(2026, 9, 9, 7));
      expect(atStart.kind, 'ROTATION');
      expect(atStart.isWorkDay, isTrue);
      expect(atStart.cycleDay, 1);
    });

    test('uses the canonical invalid schedule label in status output', () {
      final state = service.resolveStatus(
        {...employee, 'rotationStartDate': '01-09-2026'},
        target: HadirTime.date(2026, 9, 2, 10),
      );

      expect(state.kind, 'INVALID');
      expect(state.isWorkDay, isFalse);
      expect(state.label, 'جدول غير صالح');
      expect(state.detail, 'حدد تاريخ أول مناوبة.');
    });

    test('rejects an invalid rotation start-date format', () {
      final state = service.resolve(
        {...employee, 'rotationStartDate': '01-09-2026'},
        target: HadirTime.date(2026, 9, 2, 10),
      );

      expect(state.kind, 'INVALID');
      expect(state.isWorkDay, isFalse);
    });

    test('reports the active rotation day using web status wording', () {
      final state = service.resolveStatus(
        employee,
        target: HadirTime.date(2026, 9, 2, 10),
      );

      expect(state.isWorkDay, isTrue);
      expect(state.kind, 'ROTATION');
      expect(state.label, 'في المناوبة');
      expect(state.detail, 'اليوم 2 من 4 في المناوبة');
      expect(state.cycleDay, 2);
      expect(state.cycleTotal, 8);
    });

    test('reports the rotation rest day using web status wording', () {
      final state = service.resolveStatus(
        employee,
        target: HadirTime.date(2026, 9, 5, 10),
      );

      expect(state.isWorkDay, isFalse);
      expect(state.kind, 'OFF');
      expect(state.label, 'فترة راحة');
      expect(state.detail, 'اليوم 1 من 4 في الراحة');
      expect(state.cycleDay, 5);
      expect(state.cycleTotal, 8);
    });
  });
}
