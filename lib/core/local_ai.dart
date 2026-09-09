import 'package:intl/intl.dart';

class HadirLocalAi {
  static const managerExamples = <String>[
    'من هرب هذا الشهر؟',
    'من غاب اليوم؟',
    'كم نسبة الحضور اليوم؟',
    'من لم يسجل حضورًا اليوم؟',
    'لخص حالة الموظفين اليوم',
    'كم عدد الموظفين النشطين؟',
    'كم تسجيل حضور لدينا هذا الشهر؟',
  ];

  static const employeeExamples = <String>[
    'متى غبت هذا العام؟',
    'كم مرة حضرت هذا الشهر؟',
    'متى كان آخر حضور لي؟',
    'كم تسجيل حضور لدي هذا العام؟',
    'لخص لي حضوري هذا الشهر',
  ];

  static String _norm(String value) => value
      .toLowerCase()
      .replaceAll(RegExp('[أإآ]'), 'ا')
      .replaceAll('ى', 'ي')
      .replaceAll(RegExp('[ًٌٍَُِّْ]'), '')
      .trim();

  static String _date(String value) {
    try {
      return DateTime.parse(value).toLocal().toIso8601String().substring(0, 10);
    } catch (_) {
      return value.length >= 10 ? value.substring(0, 10) : value;
    }
  }

  static String _fmt(String value) {
    try {
      return DateFormat('yyyy/MM/dd HH:mm', 'ar').format(DateTime.parse(value).toLocal());
    } catch (_) {
      return value;
    }
  }

  static String employee(String question, Map<String, dynamic>? employee, List<dynamic> attendance) {
    final q = _norm(question);
    final id = '${employee?['id'] ?? ''}';
    final own = attendance.where((raw) => raw is Map && '${raw['employeeId'] ?? raw['employee_id'] ?? ''}' == id).toList();
    final checks = own.where((raw) => '${raw['type'] ?? ''}' == 'check-in').toList();
    final now = DateTime.now();
    final year = now.year;
    final month = now.month;
    if (q.contains('اخر حضور') || q.contains('اخر تسجيل')) {
      if (checks.isEmpty) return 'لا يوجد حضور مسجل لك حتى الآن.';
      checks.sort((a, b) => '${b['timestamp']}'.compareTo('${a['timestamp']}'));
      return 'آخر حضور مسجل لك كان ${_fmt('${checks.first['timestamp']}')}.';
    }
    if (q.contains('غبت') || q.contains('غياب')) {
      final days = checks.where((raw) => _date('${raw['timestamp']}').startsWith('$year-')).map((raw) => _date('${raw['timestamp']}')).toSet();
      return 'لديك ${days.length} يوم حضور مسجل هذا العام. الأيام غير المسجلة ليست غيابًا مؤكدًا دون جدول المناوبة.';
    }
    if (q.contains('حضرت') || q.contains('حضور') || q.contains('تسجيل')) {
      final monthDays = checks.where((raw) {
        try {
          final d = DateTime.parse('${raw['timestamp']}').toLocal();
          return d.year == year && d.month == month;
        } catch (_) {
          return false;
        }
      }).map((raw) => _date('${raw['timestamp']}')).toSet();
      final yearDays = checks.where((raw) => _date('${raw['timestamp']}').startsWith('$year-')).map((raw) => _date('${raw['timestamp']}')).toSet();
      return 'لديك ${monthDays.length} يوم حضور مسجل هذا الشهر و${yearDays.length} يوم حضور مسجل هذا العام.';
    }
    if (q.contains('مناوب') || q.contains('دوام')) {
      final start = employee?['workStartTime'] ?? 'غير محدد';
      final end = employee?['workEndTime'] ?? 'غير محدد';
      final schedule = employee?['scheduleType'] ?? 'غير محدد';
      return 'جدولك المسجل: $schedule، من $start إلى $end. إذا كان لديك نظام مناوبات دورية فسيظهر حسب إعداد الإدارة.';
    }
    if (q.contains('خدمات')) {
      return 'يمكنك استخدام الحضور والانصراف، سجل الحضور، الطلبات، الإشعارات، الملف الشخصي، الخدمات، والذكاء الاصطناعي ضمن صلاحيات حسابك.';
    }
    return 'أستطيع مساعدتك في فهم حضورك وتسجيلاتك وجدولك. جرّب سؤالًا أكثر تحديدًا مثل: متى كان آخر حضور لي؟';
  }

  static String manager(String question, List<dynamic> employees, List<dynamic> attendance, List<dynamic> escapes) {
    final q = _norm(question);
    final active = employees.where((raw) => raw is Map && '${raw['status'] ?? ''}' == 'active').toList();
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final checked = attendance.where((raw) => raw is Map && '${raw['type'] ?? ''}' == 'check-in' && _date('${raw['timestamp']}') == today).map((raw) => '${raw['employeeId'] ?? raw['employee_id'] ?? ''}').toSet();
    if (q.contains('هرب') || q.contains('هروب')) {
      final rows = escapes.where((raw) => raw is Map && '${raw['status'] ?? ''}' == 'escaped' && _date('${raw['timestamp']}').startsWith('${DateTime.now().year}-${DateTime.now().month.toString().padLeft(2, '0')}')).take(20).toList();
      if (rows.isEmpty) return 'لا توجد حالات هروب مسجلة هذا الشهر.';
      return 'تم تسجيل ${rows.length} حالة هروب هذا الشهر: ${rows.map((r) => '${r['employeeName'] ?? r['employeeId'] ?? 'موظف'} · ${_fmt('${r['timestamp']}')}').join('، ')}';
    }
    if (q.contains('غاب') || q.contains('غائب') || q.contains('لم يسجل')) {
      final absent = active.where((raw) => raw is Map && !checked.contains('${raw['id'] ?? ''}')).take(30).map((raw) => '${raw['name'] ?? raw['id'] ?? 'موظف'}').toList();
      return 'يوجد ${absent.length} موظف نشط لم يظهر له تسجيل حضور اليوم${absent.isEmpty ? '' : ': ${absent.join('، ')}'}. عدم وجود تسجيل لا يعني بالضرورة غيابًا مؤكدًا.';
    }
    if (q.contains('نسبه الحضور') || q.contains('نسبة الحضور') || q.contains('الحضور اليوم')) {
      final rate = active.isEmpty ? 0 : ((checked.length / active.length) * 100).round();
      return 'نسبة الحضور المسجلة اليوم $rate% (${checked.length} من ${active.length}).';
    }
    if (q.contains('نشط') || q.contains('عدد الموظفين')) {
      return 'يوجد ${active.length} موظف نشط حاليًا من أصل ${employees.length}.';
    }
    if (q.contains('تسجيل حضور') || q.contains('كم تسجيل')) {
      final month = DateTime.now().month;
      final year = DateTime.now().year;
      final count = attendance.where((raw) {
        if (raw is! Map || '${raw['type'] ?? ''}' != 'check-in') return false;
        try {
          final d = DateTime.parse('${raw['timestamp']}').toLocal();
          return d.month == month && d.year == year;
        } catch (_) {
          return false;
        }
      }).length;
      return 'تم تسجيل $count عملية حضور منذ بداية هذا الشهر.';
    }
    if (q.contains('لخص') || q.contains('ملخص')) {
      final rate = active.isEmpty ? 0 : ((checked.length / active.length) * 100).round();
      final escapesToday = escapes.where((raw) => raw is Map && '${raw['status'] ?? ''}' == 'escaped' && _date('${raw['timestamp']}') == today).length;
      return 'ملخص اليوم: ${checked.length} حضروا من ${active.length} موظف نشط ($rate%). توجد $escapesToday حالة هروب مسجلة اليوم.';
    }
    return 'أستطيع تحليل الحضور والغياب والهروب والتسجيلات والإحصاءات ضمن البيانات التي تسمح بها صلاحياتك.';
  }
}
