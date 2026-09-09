import 'dart:convert';

import 'package:excel/excel.dart';

class EmployeeTransferRow {
  const EmployeeTransferRow({
    required this.name,
    required this.jobNumber,
    this.status = 'active',
    this.scheduleType = 'ADMIN',
    this.workStartTime = '08:00',
    this.workEndTime = '16:00',
    this.gracePeriodMinutes = 0,
    this.workDays = const [0, 1, 2, 3, 4],
    this.rotationDaysOn = 7,
    this.rotationDaysOff = 7,
    this.rotationStartDate,
    this.locationId,
    this.specialties = const ['general'],
    this.isVip = false,
    this.autoCheckIn = false,
    this.autoCheckOut = false,
  });

  final String name;
  final String jobNumber;
  final String status;
  final String scheduleType;
  final String workStartTime;
  final String workEndTime;
  final int gracePeriodMinutes;
  final List<int> workDays;
  final int rotationDaysOn;
  final int rotationDaysOff;
  final String? rotationStartDate;
  final String? locationId;
  final List<String> specialties;
  final bool isVip;
  final bool autoCheckIn;
  final bool autoCheckOut;

  Map<String, dynamic> toJson() => {
        'name': name,
        'jobNumber': jobNumber,
        'status': status,
        'scheduleType': scheduleType,
        'workStartTime': workStartTime,
        'workEndTime': workEndTime,
        'gracePeriodMinutes': gracePeriodMinutes,
        'workDays': workDays,
        'rotationDaysOn': rotationDaysOn,
        'rotationDaysOff': rotationDaysOff,
        'rotationStartDate': rotationStartDate,
        'locationId': locationId,
        'specialties': specialties,
        'isVip': isVip,
        'autoCheckIn': autoCheckIn,
        'autoCheckOut': autoCheckOut,
      };
}

class EmployeeTransferPreview {
  const EmployeeTransferPreview({required this.rows, required this.invalidRows, required this.duplicateJobNumbers});

  final List<EmployeeTransferRow> rows;
  final int invalidRows;
  final Set<String> duplicateJobNumbers;

  int get validRows => rows.length;
}

class EmployeeTransfer {
  static const headers = <String>[
    'الاسم',
    'الرقم الوظيفي',
    'نوع الدوام',
    'الحالة',
    'وقت بداية الدوام',
    'وقت نهاية الدوام',
    'دقائق السماح',
    'أيام الدوام',
    'أيام العمل التناوبي',
    'أيام الراحة التناوبي',
    'تاريخ بداية التناوب',
    'معرف الموقع',
    'التخصصات',
    'VIP',
    'الحضور التلقائي',
    'الانصراف التلقائي',
  ];

  static String _text(Object? value) => '${value ?? ''}'.trim();

  static String _normalize(Object? value) => _text(value)
      .toLowerCase()
      .replaceAll(RegExp(r'[\s_\-./\\()\[\]{}:]+'), '');

  static bool _nameLooksValid(String value) =>
      value.length >= 3 && value.length <= 90 && !RegExp(r'^\d+$').hasMatch(value) && RegExp(r'[A-Za-z\u0600-\u06FF]').hasMatch(value);

  static bool _jobLooksValid(String value) =>
      value.length >= 2 && value.length <= 30 && RegExp(r'^[A-Za-z0-9٠-٩\-_/]+$').hasMatch(value) && RegExp(r'\d').hasMatch(value);

  static const _aliases = <String, List<String>>{
    'name': ['name', 'fullname', 'full_name', 'employee_name', 'employeename', 'اسم', 'اسم الموظف', 'الاسم', 'الاسم الكامل'],
    'jobNumber': ['jobnumber', 'job_number', 'employeenumber', 'employee_number', 'employeeid', 'employee_id', 'number', 'رقم', 'الرقم الوظيفي', 'الرقم الوظيفى', 'رقم الموظف', 'الرقم'],
    'status': ['status', 'الحالة', 'حالة الموظف'],
    'scheduleType': ['scheduletype', 'schedule_type', 'نوع الدوام', 'نوع الجدول', 'الدوام'],
    'workStartTime': ['workstarttime', 'work_start_time', 'starttime', 'وقت بداية الدوام', 'بداية الدوام'],
    'workEndTime': ['workendtime', 'work_end_time', 'endtime', 'وقت نهاية الدوام', 'نهاية الدوام'],
    'gracePeriodMinutes': ['graceperiodminutes', 'grace_period_minutes', 'grace', 'السماح', 'دقائق السماح', 'فترة السماح'],
    'workDays': ['workdays', 'work_days', 'أيام الدوام', 'أيام العمل'],
    'rotationDaysOn': ['rotationdayson', 'rotation_days_on', 'أيام العمل التناوبي', 'أيام العمل في التناوب'],
    'rotationDaysOff': ['rotationdaysoff', 'rotation_days_off', 'أيام الراحة التناوبي', 'أيام الراحة في التناوب'],
    'rotationStartDate': ['rotationstartdate', 'rotation_start_date', 'بداية التناوب', 'تاريخ بداية التناوب'],
    'locationId': ['locationid', 'location_id', 'معرف الموقع', 'معرف موقع العمل'],
    'specialties': ['specialties', 'التخصصات', 'التخصص'],
    'isVip': ['isvip', 'is_vip', 'vip', 'مميز'],
    'autoCheckIn': ['autocheckin', 'auto_check_in', 'التحضير التلقائي', 'حضور تلقائي'],
    'autoCheckOut': ['autocheckout', 'auto_check_out', 'الانصراف التلقائي', 'انصراف تلقائي'],
  };

  static int _scoreHeader(Object? value, List<String> words) {
    final normalized = _normalize(value);
    if (words.any((word) => _normalize(word) == normalized)) return 100;
    if (words.any((word) => normalized.contains(_normalize(word)))) return 60;
    return 0;
  }

  static String? _findColumn(List<String> columns, String key) {
    final aliases = _aliases[key]!;
    final ranked = columns.map((column) => MapEntry(column, _scoreHeader(column, aliases))).toList()..sort((a, b) => b.value.compareTo(a.value));
    return ranked.isNotEmpty && ranked.first.value > 0 ? ranked.first.key : null;
  }

  static int _number(Object? value, int fallback) {
    final normalized = _text(value).replaceAllMapped(RegExp(r'[٠-٩]'), (m) => '${'٠١٢٣٤٥٦٧٨٩'.indexOf(m.group(0)!)}');
    return int.tryParse(normalized) ?? fallback;
  }

  static bool _bool(Object? value, [bool fallback = false]) {
    final valueNormalized = _normalize(value);
    if (const ['1', 'true', 'yes', 'y', 'on', 'نعم', 'مفعل', 'فعال', 'مميز', 'vip'].contains(valueNormalized)) return true;
    if (const ['0', 'false', 'no', 'n', 'off', 'لا', 'غيرمفعل', 'موقوف'].contains(valueNormalized)) return false;
    return fallback;
  }

  static String _schedule(Object? value) => _normalize(value).contains('تناوب') || _normalize(value) == 'rotation' ? 'ROTATION' : 'ADMIN';

  static String _status(Object? value) => const ['موقوف', 'suspended', 'inactive', 'غيرفعال'].contains(_normalize(value)) ? 'suspended' : 'active';

  static List<int> _days(Object? value) {
    final raw = _text(value);
    if (raw.isEmpty) return const [0, 1, 2, 3, 4];
    const map = {'الأحد': 0, 'الاثنين': 1, 'الثلاثاء': 2, 'الأربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'السبت': 6};
    final result = <int>{};
    for (final part in raw.split(RegExp(r'[,،|;/]+')).map((v) => v.trim()).where((v) => v.isNotEmpty)) {
      final number = int.tryParse(part);
      if (number != null) {
        result.add(number.clamp(0, 6).toInt());
      } else if (map.containsKey(part)) {
        result.add(map[part]!);
      }
    }
    return result.isEmpty ? const [0, 1, 2, 3, 4] : (result.toList()..sort());
  }

  static List<String> _specialties(Object? value) {
    final result = _text(value).split(RegExp(r'[,،|;/]+')).map((v) => v.trim()).where((v) => v.isNotEmpty).toSet().toList();
    return result.isEmpty ? const ['general'] : result;
  }

  static EmployeeTransferRow _row(Map<String, Object?> row, Map<String, String> mapping) => EmployeeTransferRow(
        name: _text(row[mapping['name']]),
        jobNumber: _text(row[mapping['jobNumber']]),
        status: _status(row[mapping['status']]),
        scheduleType: _schedule(row[mapping['scheduleType']]),
        workStartTime: _text(row[mapping['workStartTime']]).isEmpty ? '08:00' : _text(row[mapping['workStartTime']]),
        workEndTime: _text(row[mapping['workEndTime']]).isEmpty ? '16:00' : _text(row[mapping['workEndTime']]),
        gracePeriodMinutes: _number(row[mapping['gracePeriodMinutes']], 0),
        workDays: _days(row[mapping['workDays']]),
        rotationDaysOn: _number(row[mapping['rotationDaysOn']], 7),
        rotationDaysOff: _number(row[mapping['rotationDaysOff']], 7),
        rotationStartDate: _text(row[mapping['rotationStartDate']]).isEmpty ? null : _text(row[mapping['rotationStartDate']]),
        locationId: _text(row[mapping['locationId']]).isEmpty ? null : _text(row[mapping['locationId']]),
        specialties: _specialties(row[mapping['specialties']]),
        isVip: _bool(row[mapping['isVip']]),
        autoCheckIn: _bool(row[mapping['autoCheckIn']]),
        autoCheckOut: _bool(row[mapping['autoCheckOut']]),
      );

  static EmployeeTransferPreview previewRows(List<Map<String, Object?>> rows, {Set<String> existingJobNumbers = const {}}) {
    if (rows.isEmpty) throw const FormatException('الملف لا يحتوي على بيانات.');
    final columns = rows.first.keys.toList();
    final mapping = <String, String>{};
    for (final required in const ['name', 'jobNumber']) {
      final column = _findColumn(columns, required);
      if (column == null) throw FormatException('تعذر تحديد عمود ${required == 'name' ? 'الاسم' : 'الرقم الوظيفي'}.');
      mapping[required] = column;
    }
    for (final optional in const ['status', 'scheduleType', 'workStartTime', 'workEndTime', 'gracePeriodMinutes', 'workDays', 'rotationDaysOn', 'rotationDaysOff', 'rotationStartDate', 'locationId', 'specialties', 'isVip', 'autoCheckIn', 'autoCheckOut']) {
      final column = _findColumn(columns, optional);
      if (column != null) mapping[optional] = column;
    }
    final seen = <String>{};
    final valid = <EmployeeTransferRow>[];
    var invalid = 0;
    final duplicates = <String>{};
    for (final raw in rows) {
      final row = _row(raw, mapping);
      if (!_nameLooksValid(row.name) || !_jobLooksValid(row.jobNumber)) {
        invalid++;
        continue;
      }
      final job = row.jobNumber.toLowerCase();
      if (existingJobNumbers.contains(job) || !seen.add(job)) duplicates.add(row.jobNumber);
      valid.add(row);
    }
    return EmployeeTransferPreview(rows: valid, invalidRows: invalid, duplicateJobNumbers: duplicates);
  }

  static List<Map<String, Object?>> decodeXlsx(List<int> bytes) {
    final workbook = Excel.decodeBytes(bytes);
    final defaultSheet = workbook.getDefaultSheet();
    final sheetName = defaultSheet ?? (workbook.tables.isEmpty ? null : workbook.tables.keys.first);
    if (sheetName == null) throw const FormatException('لم يتم العثور على ورقة بيانات.');
    final sheet = workbook.tables[sheetName];
    if (sheet == null || sheet.rows.isEmpty) throw const FormatException('لم يتم العثور على بيانات الموظفين.');
    var headerIndex = -1;
    for (var i = 0; i < sheet.rows.length && i < 20; i++) {
      final values = sheet.rows[i].map((cell) => cell?.value?.toString() ?? '').toList();
      final hasName = values.any((v) => _scoreHeader(v, _aliases['name']!) >= 60);
      final hasJob = values.any((v) => _scoreHeader(v, _aliases['jobNumber']!) >= 60);
      if (hasName && hasJob) { headerIndex = i; break; }
    }
    if (headerIndex < 0) throw const FormatException('تعذر العثور على صف عناوين الموظفين.');
    final headers = sheet.rows[headerIndex].map((cell) => cell?.value?.toString() ?? '').toList();
    final result = <Map<String, Object?>>[];
    for (var i = headerIndex + 1; i < sheet.rows.length; i++) {
      final row = <String, Object?>{};
      for (var c = 0; c < headers.length; c++) {
        final key = headers[c].trim();
        if (key.isEmpty) continue;
        row[key] = c < sheet.rows[i].length ? sheet.rows[i][c]?.value?.toString() ?? '' : '';
      }
      if (row.values.any((value) => _text(value).isNotEmpty)) result.add(row);
    }
    return result;
  }

  static String toCsv(Iterable<EmployeeTransferRow> employees) {
    final lines = <String>[headers.map(_csvCell).join(',')];
    for (final e in employees) {
      lines.add([
        e.name,
        e.jobNumber,
        e.scheduleType == 'ROTATION' ? 'تناوبي' : 'إداري',
        e.status == 'active' ? 'فعال' : 'موقوف',
        e.workStartTime,
        e.workEndTime,
        e.gracePeriodMinutes,
        e.workDays.join(','),
        e.rotationDaysOn,
        e.rotationDaysOff,
        e.rotationStartDate ?? '',
        e.locationId ?? '',
        e.specialties.join(', '),
        e.isVip ? 'نعم' : 'لا',
        e.autoCheckIn ? 'نعم' : 'لا',
        e.autoCheckOut ? 'نعم' : 'لا',
      ].map(_csvCell).join(','));
    }
    return '\uFEFF${lines.join('\n')}';
  }

  static String _csvCell(Object? value) {
    final text = _text(value).replaceAll('"', '""');
    return '"$text"';
  }

  static List<int> toXlsx(Iterable<EmployeeTransferRow> employees) {
    final excel = Excel.createExcel();
    final sheetName = excel.getDefaultSheet() ?? 'Sheet1';
    final sheet = excel[sheetName];
    sheet.appendRow(headers.map((h) => TextCellValue(h)).toList());
    for (final e in employees) {
      sheet.appendRow([
        TextCellValue(e.name),
        TextCellValue(e.jobNumber),
        TextCellValue(e.scheduleType == 'ROTATION' ? 'تناوبي' : 'إداري'),
        TextCellValue(e.status == 'active' ? 'فعال' : 'موقوف'),
        TextCellValue(e.workStartTime),
        TextCellValue(e.workEndTime),
        IntCellValue(e.gracePeriodMinutes),
        TextCellValue(e.workDays.join(',')),
        IntCellValue(e.rotationDaysOn),
        IntCellValue(e.rotationDaysOff),
        TextCellValue(e.rotationStartDate ?? ''),
        TextCellValue(e.locationId ?? ''),
        TextCellValue(e.specialties.join(', ')),
        BoolCellValue(e.isVip),
        BoolCellValue(e.autoCheckIn),
        BoolCellValue(e.autoCheckOut),
      ]);
    }
    for (var i = 0; i < headers.length; i++) sheet.setColumnAutoFit(i);
    return excel.save() ?? <int>[];
  }

  static List<Map<String, dynamic>> apiPayloads(Iterable<EmployeeTransferRow> rows) => rows.map((e) => e.toJson()).toList();

  static List<Map<String, Object?>> decodeCsv(String csv) {
    final lines = const LineSplitter().convert(csv.replaceFirst('\uFEFF', ''));
    if (lines.isEmpty) return [];
    final matrix = lines.map(_parseCsvLine).toList();
    final headers = matrix.first;
    return matrix.skip(1).where((row) => row.any((v) => v.trim().isNotEmpty)).map((row) => <String, Object?>{
          for (var i = 0; i < headers.length; i++) headers[i].trim(): i < row.length ? row[i] : '',
        }).toList();
  }

  static List<String> _parseCsvLine(String line) {
    final cells = <String>[];
    final buffer = StringBuffer();
    var quoted = false;
    for (var i = 0; i < line.length; i++) {
      final char = line[i];
      if (char == '"') {
        if (quoted && i + 1 < line.length && line[i + 1] == '"') { buffer.write('"'); i++; } else { quoted = !quoted; }
      } else if (char == ',' && !quoted) {
        cells.add(buffer.toString());
        buffer.clear();
      } else {
        buffer.write(char);
      }
    }
    cells.add(buffer.toString());
    return cells;
  }
}
