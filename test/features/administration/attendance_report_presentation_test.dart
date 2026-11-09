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


    test('maps attendance sources to the same labels as the web report', () {
      expect(attendanceReportSourceLabel('AUTOMATIC_VIP'), 'تلقائي VIP');
      expect(attendanceReportSourceLabel('AUTOMATIC'), 'تلقائي');
      expect(attendanceReportSourceLabel('MANUAL_OWNER'), 'إداري');
      expect(attendanceReportSourceLabel('MANUAL_EMPLOYEE'), 'الموظف');
      expect(attendanceReportSourceLabel('MIXED'), 'مختلط');
      expect(attendanceReportSourceLabel('UNKNOWN'), 'غير محدد');
    });

    test('uses the web exception description in absence exports', () {
      expect(
        attendanceReportExceptionLabel(<String, dynamic>{
          'status': 'ABSENT',
          'exceptionCode': 'ABSENT_NO_APPROVED_REASON',
        }),
        'غياب دون عذر معتمد',
      );
      expect(
        attendanceReportExceptionLabel(<String, dynamic>{'status': 'ESCAPED'}),
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
