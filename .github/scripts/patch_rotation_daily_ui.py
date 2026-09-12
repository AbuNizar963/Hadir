from pathlib import Path

p = Path("lib/features/employee/pages/hadir_workspace_page_implementation.dart")
s = p.read_text(encoding="utf-8")

old = """    final canIn = schedule['isWorkDay'] == true && open == null && !today.any((r) => _type(r) == 'check-in') && !hasLeave && !hasPermission && escape == null;
    final canOut = open != null;
    final checkInSubtitle = schedule['isWorkDay'] != true ? 'أنت في الراحة' : open != null ? 'الدوام جارٍ' : canIn ? 'مسح رمز QR' : 'غير متاح الآن';
"""
new = """    final now = _damascusNow();
    final dailyMode = schedule['kind'] == 'ROTATION_DAILY';
    final dailyInvalid = schedule['kind'] == 'ROTATION_DAILY_INVALID';
    final dailyWindowOpen = !dailyMode || (schedule['start'] is DateTime && schedule['end'] is DateTime && !now.isBefore(schedule['start'] as DateTime) && !now.isAfter(schedule['end'] as DateTime));
    final canIn = schedule['isWorkDay'] == true && !dailyInvalid && dailyWindowOpen && open == null && !today.any((r) => _type(r) == 'check-in') && !hasLeave && !hasPermission && escape == null;
    final canOut = open != null;
    final checkInSubtitle = schedule['isWorkDay'] != true ? 'أنت في الراحة' : dailyInvalid ? 'إعداد التسجيل اليومي غير صالح' : dailyMode && now.isBefore(schedule['start'] as DateTime) ? 'التسجيل يبدأ ${intl.DateFormat('HH:mm').format(schedule['start'] as DateTime)}' : dailyMode && now.isAfter(schedule['end'] as DateTime) ? 'انتهت مهلة التسجيل' : open != null ? 'الدوام جارٍ' : canIn ? 'مسح رمز QR' : 'غير متاح الآن';
"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

a = s.index("  Map<String, dynamic> _rotationSchedule([DateTime? target]) {")
b = s.index("\n  List<int> _workDays()", a)
rotation = """  Map<String, dynamic> _rotationSchedule([DateTime? target]) {
    final now = target ?? _damascusNow();
    final raw = '${_employee['rotationStartDate'] ?? ''}'.split('T').first;
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return {'isWorkDay': false, 'kind': 'INVALID', 'start': null, 'end': null};
    final daysOn = _number(_employee['rotationDaysOn'], 4).clamp(1, 31);
    final daysOff = _number(_employee['rotationDaysOff'], 4).clamp(0, 31);
    final cycle = daysOn + daysOff;
    final first = _localTime(DateTime(parsed.year, parsed.month, parsed.day), '${_employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
    if (now.isBefore(first)) return {'isWorkDay': false, 'kind': 'NOT_STARTED', 'start': first, 'end': null};
    final dayStart = DateTime(parsed.year, parsed.month, parsed.day);
    final diff = DateTime(now.year, now.month, now.day).difference(dayStart).inDays;
    if (diff < 0) return {'isWorkDay': false, 'kind': 'NOT_STARTED', 'start': first, 'end': null};
    final cycleDay = diff % cycle;
    final periodDay = dayStart.add(Duration(days: diff - cycleDay));
    final start = _localTime(periodDay, '${_employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
    final end = _localTime(periodDay.add(Duration(days: daysOn)), '${_employee['rotationEndTime'] ?? _employee['workEndTime'] ?? _employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
    final activeRotation = cycleDay < daysOn || (cycleDay == daysOn && now.isBefore(end));
    if (!activeRotation) return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
    final dailyEnabled = _employee['rotationDailyAttendanceEnabled'] == true || '${_employee['rotationDailyAttendanceEnabled'] ?? ''}'.toLowerCase() == 'true' || '${_employee['rotationDailyAttendanceEnabled'] ?? ''}' == '1';
    if (dailyEnabled) {
      final dailyTime = '${_employee['rotationDailyAttendanceTime'] ?? ''}'.trim();
      final match = RegExp(r'^(\\d{1,2}):(\\d{2})$').firstMatch(dailyTime);
      if (match == null) return {'isWorkDay': true, 'kind': 'ROTATION_DAILY_INVALID', 'start': null, 'end': null, 'rotationStart': start, 'rotationEnd': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
      final checkpoint = _localTime(DateTime(now.year, now.month, now.day), dailyTime);
      final rawGrace = _number(_employee['rotationDailyAttendanceGraceMinutes'], 0).clamp(0, 180);
      final graceEnd = checkpoint.add(Duration(minutes: rawGrace));
      return {'isWorkDay': true, 'kind': 'ROTATION_DAILY', 'start': checkpoint, 'end': graceEnd, 'rotationStart': start, 'rotationEnd': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff, 'dailyAttendanceEnabled': true, 'dailyAttendanceTime': dailyTime, 'dailyAttendanceGraceMinutes': rawGrace};
    }
    return {'isWorkDay': true, 'kind': 'ROTATION', 'start': start, 'end': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
  }
"""
s = s[:a] + rotation + s[b:]

replacements = [
    ("    if (s['kind'] == 'ADMIN') return 'دوام إداري';\n    if (s['kind'] == 'ROTATION') return 'مناوبة تناوبية';",
     "    if (s['kind'] == 'ADMIN') return 'دوام إداري';\n    if (s['kind'] == 'ROTATION_DAILY') return 'مناوبة تناوبية · تسجيل يومي';\n    if (s['kind'] == 'ROTATION_DAILY_INVALID') return 'تسجيل يومي غير صالح';\n    if (s['kind'] == 'ROTATION') return 'مناوبة تناوبية';"),
    ("    'متأخر' => 'تم تسجيل حضورك بعد بداية الفترة.',",
     "    'متأخر' => 'تم تسجيل حضورك بعد بداية الفترة.',\n    'تسجيل يومي غير صالح' => 'وقت التسجيل اليومي غير صالح. راجع إعدادات الموظف.',"),
    ("    if (start is DateTime && end is DateTime) return '${intl.DateFormat('HH:mm').format(start)} → ${intl.DateFormat('HH:mm').format(end)}';",
     "    if (start is DateTime && end is DateTime) {\n      final suffix = s['kind'] == 'ROTATION_DAILY' ? ' (نافذة التسجيل)' : '';\n      return '${intl.DateFormat('HH:mm').format(start)} → ${intl.DateFormat('HH:mm').format(end)}$suffix';\n    }"),
    ("    else if (s['isWorkDay'] == true && end is DateTime && end.isAfter(_damascusNow())) { target = end; label = 'تنتهي المناوبة خلال'; }",
     "    else if (s['kind'] == 'ROTATION_DAILY' && start is DateTime && _damascusNow().isBefore(start)) { target = start; label = 'يبدأ التسجيل اليومي خلال'; }\n    else if (s['kind'] == 'ROTATION_DAILY' && end is DateTime && end.isAfter(_damascusNow())) { target = end; label = 'تنتهي مهلة التسجيل خلال'; }\n    else if (s['isWorkDay'] == true && end is DateTime && end.isAfter(_damascusNow())) { target = end; label = 'تنتهي المناوبة خلال'; }"),
]
for old, new in replacements:
    assert s.count(old) == 1
    s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")
