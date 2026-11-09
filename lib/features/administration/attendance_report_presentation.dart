const _statusLabels = <String, String>{
  'PRESENT': 'حاضر',
  'LATE': 'متأخر',
  'ABSENT': 'غياب',
  'LEAVE': 'إجازة',
  'PERMISSION': 'استئذان',
  'REST': 'راحة',
  'ESCAPED': 'هارب',
  'NOT_STARTED': 'لم يبدأ',
  'HOLIDAY': 'عطلة رسمية',
  'INVALID': 'غير صالح',
  'MISSING_CHECKOUT': 'انصراف معلق',
};

const _exceptionLabels = <String, String>{
  'MISSING_CHECKOUT': 'انصراف معلق',
  'CHECKOUT_WITHOUT_CHECKIN': 'انصراف دون حضور',
  'ABSENT_NO_APPROVED_REASON': 'غياب دون عذر معتمد',
  'LATE_ARRIVAL': 'تأخر في الحضور',
  'EARLY_LEAVE': 'انصراف مبكر',
  'OVERTIME': 'عمل إضافي',
};

String attendanceReportStatus(Map<String, dynamic> row) {
  final status = '${row['status'] ?? ''}'.trim().toUpperCase();
  final exceptionCode = '${row['exceptionCode'] ?? ''}'.trim().toUpperCase();
  if (status == 'OPEN' || exceptionCode == 'MISSING_CHECKOUT') {
    return 'MISSING_CHECKOUT';
  }
  return status;
}

String attendanceReportStatusLabel(Map<String, dynamic> row) {
  final status = attendanceReportStatus(row);
  return _statusLabels[status] ?? status;
}

String attendanceReportNote(Map<String, dynamic> row) {
  final status = '${row['status'] ?? ''}'.trim().toUpperCase();
  if (status == 'ESCAPED') return 'هرب من العمل';
  final code = '${row['exceptionCode'] ?? ''}'.trim().toUpperCase();
  if (code.isEmpty) return '—';
  return _exceptionLabels[code] ?? code;
}
