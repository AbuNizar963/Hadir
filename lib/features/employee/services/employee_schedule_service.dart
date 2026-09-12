import '../../../core/hadir_time.dart';

/// Resolved employee schedule state used by the native employee experience.
class EmployeeScheduleState {
  const EmployeeScheduleState({required this.isWorkDay, required this.kind, required this.label, this.detail, this.start, this.end, this.cycleDay, this.cycleTotal});
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
  static const _dayNames = <String>['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const EmployeeScheduleService();

  EmployeeScheduleState resolve(Map<String, dynamic>? employee, {DateTime? target}) {
    if (employee == null) return const EmployeeScheduleState(isWorkDay: false, kind: 'INVALID', label: 'غير محدد');
    final now = target ?? HadirTime.now();
    final type = '${employee['scheduleType'] ?? 'ADMIN'}'.trim().toUpperCase();
    return type == 'ROTATION' ? _rotation(employee, now) : _admin(employee, now);
  }

  EmployeeScheduleState _admin(Map<String, dynamic> employee, DateTime target) {
    final date = _dateOnly(HadirTime.dateKey(target));
    final workDays = _workDays(employee['workDays'] ?? employee['workDaysJson']);
    if (!workDays.contains(date.weekday % 7)) {
      return EmployeeScheduleState(
        isWorkDay: false,
        kind: 'OFF',
        label: 'إجازة أسبوعية',
        detail: workDays.isEmpty ? 'لم يتم تحديد أيام دوام إداري.' : 'أيام الدوام: ${workDays.map((d) => _dayNames[d]).join('، ')}',
      );
    }
    final start = _localDateTime(date, '${employee['workStartTime'] ?? '09:00'}');
    final rawEnd = _localDateTime(date, '${employee['workEndTime'] ?? '16:00'}');
    final end = rawEnd.isAfter(start) ? rawEnd : rawEnd.add(const Duration(days: 1));
    return EmployeeScheduleState(isWorkDay: true, kind: 'ADMIN', label: 'دوام إداري', detail: '${_formatTime(start)} → ${_formatTime(end)}', start: start, end: end);
  }

  EmployeeScheduleState _rotation(Map<String, dynamic> employee, DateTime target) {
    final rawStart = '${employee['rotationStartDate'] ?? ''}'.trim();
    final startDay = rawStart.length >= 10 ? rawStart.substring(0, 10) : rawStart;
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}\$').hasMatch(startDay)) {
      return const EmployeeScheduleState(isWorkDay: false, kind: 'INVALID', label: 'تاريخ بداية المناوبة غير صالح', detail: 'حدد تاريخ أول مناوبة.');
    }
    final daysOn = _positiveInt(employee['rotationDaysOn'], 4);
    final daysOff = _nonNegativeInt(employee['rotationDaysOff'], 4);
    final cycleTotal = daysOn + daysOff;
    final time = '${employee['workStartTime'] ?? employee['rotationStartTime'] ?? '09:00'}';
    final firstStart = _localDateTime(_dateOnly(startDay), time);
    if (target.isBefore(firstStart)) {
      return EmployeeScheduleState(isWorkDay: false, kind: 'NOT_STARTED', label: 'لم تبدأ المناوبة بعد', detail: 'تبدأ أول مناوبة في $startDay الساعة ${_formatTime(firstStart)}', start: firstStart, cycleDay: 0, cycleTotal: cycleTotal);
    }
    final targetDay = _dateOnly(HadirTime.dateKey(target));
    final startDate = _dateOnly(startDay);
    final diff = targetDay.difference(startDate).inDays;
    final cycleIndex = diff ~/ cycleTotal;
    final cycleDay = diff - (cycleIndex * cycleTotal);
    final periodStart = _localDateTime(startDate.add(Duration(days: cycleIndex * cycleTotal)), time);
    if (cycleDay < daysOn) {
      return EmployeeScheduleState(isWorkDay: true, kind: 'ROTATION', label: 'مناوبة تناوبية', detail: 'اليوم ${cycleDay + 1} من $daysOn في المناوبة', start: periodStart, end: periodStart.add(Duration(days: daysOn)), cycleDay: cycleDay + 1, cycleTotal: cycleTotal);
    }
    final restDay = cycleDay - daysOn + 1;
    return EmployeeScheduleState(isWorkDay: false, kind: 'OFF', label: 'راحة تناوبية', detail: 'اليوم $restDay من $daysOff في الراحة', cycleDay: cycleDay + 1, cycleTotal: cycleTotal);
  }

  List<int> _workDays(dynamic raw) {
    dynamic value = raw;
    if (value is String && value.trim().isNotEmpty) {
      value = value.replaceAll('[', '').replaceAll(']', '').split(',').map((item) => int.tryParse(item.trim())).whereType<int>().toList();
    }
    if (value is! List) return List<int>.from(_defaultWorkDays);
    final result = value.map((item) => item is int ? item : int.tryParse('$item')).whereType<int>().where((day) => day >= 0 && day <= 6).toSet().toList()..sort();
    return result;
  }

  DateTime _dateOnly(String value) {
    final parts = value.split('-').map(int.parse).toList();
    return HadirTime.date(parts[0], parts[1], parts[2]);
  }

  DateTime _localDateTime(DateTime date, String value) {
    final match = RegExp(r'^(\d{1,2}):(\d{2})\$').firstMatch(value.trim());
    final hour = match == null ? 9 : int.parse(match.group(1)!).clamp(0, 23);
    final minute = match == null ? 0 : int.parse(match.group(2)!).clamp(0, 59);
    return HadirTime.date(date.year, date.month, date.day, hour, minute);
  }

  String _formatTime(DateTime value) => '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';

  int _positiveInt(dynamic value, int fallback) {
    final parsed = int.tryParse('$value');
    return parsed == null || parsed < 1 ? fallback : parsed;
  }

  int _nonNegativeInt(dynamic value, int fallback) {
    final parsed = int.tryParse('$value');
    return parsed == null || parsed < 0 ? fallback : parsed;
  }
}
