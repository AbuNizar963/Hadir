import 'package:flutter_test/flutter_test.dart';
import 'package:hadir/features/administration/attendance_report_presentation.dart';

void main() {
  group('attendance report presentation', () {
    test('treats a missing checkout as its own report status', () {
      final row = <String, dynamic>{
        'status': 'PRESENT',
        'exceptionCode': 'MISSING_CHECKOUT',
      };

      expect(attendanceReportStatus(row), 'MISSING_CHECKOUT');
      expect(attendanceReportStatusLabel(row), 'انصراف معلق');
      expect(attendanceReportNote(row), 'انصراف معلق');
    });

    test('keeps legacy OPEN rows compatible with the canonical exception', () {
      final row = <String, dynamic>{'status': 'OPEN'};

      expect(attendanceReportStatus(row), 'MISSING_CHECKOUT');
      expect(attendanceReportStatusLabel(row), 'انصراف معلق');
    });

    test('preserves canonical statuses and escaped-attendance wording', () {
      expect(
        attendanceReportStatusLabel(<String, dynamic>{'status': 'LATE'}),
        'متأخر',
      );
      expect(
        attendanceReportNote(<String, dynamic>{'status': 'ESCAPED'}),
        'هرب من العمل',
      );
    });

    test('does not invent an exception note when no exception exists', () {
      expect(
        attendanceReportNote(<String, dynamic>{'status': 'PRESENT'}),
        '—',
      );
    });
  });
}
