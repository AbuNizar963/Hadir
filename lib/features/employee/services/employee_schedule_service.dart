import '../../../core/hadir_time.dart';

/// Resolved employee schedule state used by the native employee experience.
class EmployeeScheduleState {
  const EmployeeScheduleState({
    required this.isWorkDay,
    required this.kind,
    required this.label,
    this.detail,
    this.start,
    this.end,
    this.cycleDay,
    this.cycleTotal,
  });

  final bool isWorkDay;
  final String kind;
  final String label;
  final String? detail;
  final DateTime? start;
  final DateTime? end;
  final int? cycleDay;
  final int? cycleTotal;
}

/// Resolves the same ADMIN/ROTATION schedule rules used by the Web app.
/// This resolver is read-only and never creates or mutates attendance data.
class EmployeeScheduleService {
  static const _defaultWorkDays = <int>[0, 1, 2, 3, 4];
  static const _dayNames = <String>[
    'الأحد',
    'الاثنين',
    'الثلاثاء',
    'الأربعاء',
    'الخميس',
    'الجمعة',
    'السبت',
  ];

  const EmployeeScheduleService();

  EmployeeScheduleState resolve(
    Map<String, dynamic>? employee, {
    DateTime? target,
  }) {
    if (employee == null) {
      return const EmployeeScheduleState(
        isWorkDay: false,
        kind: 'INVALID',
        label: 'غير محدد',
      );
    }

    final now = target ?? HadirTime.now();
    final type = '${employee['scheduleType'] ?? 'ADMIN'}'.trim().toUpperCase();
    return type == 'ROTATION' ? _rotation(employee, now) : _admin(employee, now);
  }

  /// Returns the user-facing schedule status with the same status wording
  /// and end-of-shift handling as the Web schedule layer.
  EmployeeScheduleState resolveStatus(
    Map<String, dynamic>? employee, {
    DateTime? target,
  }) {
    if (employee == null) {
      return const EmployeeScheduleState(
        isWorkDay: false,
        kind: 'INVALID',
        label: 'غير محدد',
      );
    }

    final now = target ?? HadirTime.now();
    final period = resolve(employee, target: now);

    if (period.kind == 'NOT_STARTED' || period.kind == 'INVALID') {
      return period;
    }

    final type = '${employee['scheduleType'] ?? 'ADMIN'}'.trim().toUpperCase();
    if (type == 'ROTATION') {
      if (period.kind == 'OFF') {
        final cycleDay = period.cycleDay;
        final daysOff = _nonNegativeInt(employee['rotationDaysOff'], 4);
        final daysOn = _positiveInt(employee['rotationDaysOn'], 4);
        final restDay = cycleDay == null ? 1 : cycleDay - daysOn + 1;
        return EmployeeScheduleState(
          isWorkDay: false,
          kind: 'OFF',
          label: 'فترة راحة',
          detail: 'اليوم $restDay من $daysOff في الراحة',
          cycleDay: cycleDay,
          cycleTotal: period.cycleTotal,
        );
      }

      final cycleDay = period.cycleDay;
      final daysOn = _positiveInt(employee['rotationDaysOn'], 4);
      final workDay = cycleDay == null ? 1 : cycleDay + 1;
      return EmployeeScheduleState(
        isWorkDay: true,
        kind: 'ROTATION',
        label: 'في المناوبة',
        detail: 'اليوم $workDay من $daysOn في المناوبة',
        start: period.start,
        end: period.end,
        cycleDay: cycleDay,
        cycleTotal: period.cycleTotal,
      );
    }

    if (period.kind == 'OFF') return period;
    if (period.end != null && !now.isBefore(period.end!)) {
      return EmployeeScheduleState(
        isWorkDay: false,
        kind: 'OFF',
        label: 'فترة راحة',
        detail: 'انتهى دوام اليوم',
        end: period.end,
      );
    }

    return const EmployeeScheduleState(
      isWorkDay: true,
      kind: 'ADMIN',
      label: 'في المناوبة',
      detail: 'يوم عمل (إداري)',
    );
  }

  EmployeeScheduleState _admin(
    Map<String, dynamic> employee,
    DateTime target,
  ) {
    final date = _dateOnly(HadirTime.dateKey(target));
    final workDays = _workDays(employee['workDays'] ?? employee['workDaysJson']);

    if (!workDays.contains(date.weekday % 7)) {
      return EmployeeScheduleState(
        isWorkDay: false,
        kind: 'OFF',
        label: 'إجازة أسبوعية',
        detail: workDays.isEmpty
            ? 'لم يتم تحديد أيام دوام إداري.'
            : 'أيام الدوام: ${workDays.map((d) => _dayNames[d]).join('، ')}',
      );
    }

    final start = _localDateTime(
      date,
      '${employee['workStartTime'] ?? '09:00'}',
    );
    final rawEnd = _localDateTime(
      date,
      '${employee['workEndTime'] ?? '16:00'}',
    );
    final end = rawEnd.isAfter(start)
        ? rawEnd
        : rawEnd.add(const Duration(days: 1));

    return EmployeeScheduleState(
      isWorkDay: true,
      kind: 'ADMIN',
      label: 'دوام إداري',
      detail: '${_formatTime(start)} → ${_formatTime(end)}',
      start: start,
      end: end,
    );
  }

  EmployeeScheduleState _rotation(
    Map<String, dynamic> employee,
    DateTime target,
  ) {
    final rawStart = '${employee['rotationStartDate'] ?? ''}'.trim();
    final startDay = rawStart.length >= 10 ? rawStart.substring(0, 10) : rawStart;

    // Keep this validation equivalent to the Web schedule parser: format only.
    // Date normalization is intentionally delegated to the same local-date
    // construction path used by the rest of the native time helpers.
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(startDay)) {
      return const EmployeeScheduleState(
        isWorkDay: false,
        kind: 'INVALID',
        label: 'تاريخ بداية المناوبة غير صالح',
        detail: 'حدد تاريخ أول مناوبة.',
      );
    }

    final daysOn = _positiveInt(employee['rotationDaysOn'], 4);
    final daysOff = _nonNegativeInt(employee['rotationDaysOff'], 4);
    final cycleTotal = daysOn + daysOff;
    final time =
        '${employee['workStartTime'] ?? employee['rotationStartTime'] ?? '09:00'}';
    final firstStart = _localDateTime(_dateOnly(startDay), time);

    if (target.isBefore(firstStart)) {
      return EmployeeScheduleState(
        isWorkDay: false,
        kind: 'NOT_STARTED',
        label: 'لم تبدأ المناوبة بعد',
        detail:
            'تبدأ أول مناوبة في $startDay الساعة ${_formatTime(firstStart)}',
        start: firstStart,
        cycleDay: 0,
        cycleTotal: cycleTotal,
      );
    }

    final targetDay = _dateOnly(HadirTime.dateKey(target));
    final startDate = _dateOnly(startDay);
    final diff = targetDay.difference(startDate).inDays;
    final cycleIndex = diff ~/ cycleTotal;
    final cycleDay = diff - (cycleIndex * cycleTotal);
    final periodStart = _localDateTime(
      startDate.add(Duration(days: cycleIndex * cycleTotal)),
      time,
    );

    if (cycleDay < daysOn) {
      final end = periodStart.add(Duration(days: daysOn));
      return EmployeeScheduleState(
        isWorkDay: true,
        kind: 'ROTATION',
        label: 'مناوبة تناوبية',
        detail: 'من ${_formatDateTime(periodStart)} → ${_formatDateTime(end)}',
        start: periodStart,
        end: end,
        cycleDay: cycleDay + 1,
        cycleTotal: cycleTotal,
      );
    }

    final restDay = cycleDay - daysOn + 1;
    return EmployeeScheduleState(
      isWorkDay: false,
      kind: 'OFF',
      label: 'راحة تناوبية',
      detail: 'اليوم $restDay من $daysOff في الراحة',
      cycleDay: cycleDay + 1,
      cycleTotal: cycleTotal,
    );
  }

  List<int> _workDays(dynamic raw) {
    dynamic value = raw;
    if (value is String && value.trim().isNotEmpty) {
      value = value
          .replaceAll('[', '')
          .replaceAll(']', '')
          .split(',')
          .map((item) => int.tryParse(item.trim()))
          .whereType<int>()
          .toList();
    }
    if (value is! List) return List<int>.from(_defaultWorkDays);

    final result = value
        .map((item) => item is int ? item : int.tryParse('$item'))
        .whereType<int>()
        .where((day) => day >= 0 && day <= 6)
        .toSet()
        .toList()
      ..sort();
    return result;
  }

  DateTime _dateOnly(String value) {
    final parts = value.split('-').map(int.parse).toList();
    return HadirTime.date(parts[0], parts[1], parts[2]);
  }

  DateTime _localDateTime(DateTime date, String value) {
    final match = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(value.trim());
    final hour = match == null
        ? 9
        : int.parse(match.group(1)!).clamp(0, 23);
    final minute = match == null
        ? 0
        : int.parse(match.group(2)!).clamp(0, 59);
    return HadirTime.date(date.year, date.month, date.day, hour, minute);
  }

  String _formatTime(DateTime value) =>
      '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';

  String _formatDateTime(DateTime value) =>
      '${HadirTime.dateKey(value)} ${_formatTime(value)}';

  int _positiveInt(dynamic value, int fallback) {
    final parsed = int.tryParse('$value');
    return parsed == null || parsed < 1 ? fallback : parsed;
  }

  int _nonNegativeInt(dynamic value, int fallback) {
    final parsed = int.tryParse('$value');
    return parsed == null || parsed < 0 ? fallback : parsed;
  }
}
