import 'dart:convert';
import 'dart:typed_data';

import 'package:excel/excel.dart' hide Border;
import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api.dart';
import '../../../core/hadir_brand.dart';
import '../../../core/hadir_time.dart';
import '../../../core/session.dart';

/// Canonical read-only reporting surface shared by the web site and Flutter.
/// Attendance mutations remain exclusively on the central attendance engine.
class AdminGlobalReportsPage extends StatefulWidget {
  const AdminGlobalReportsPage({super.key});

  @override
  State<AdminGlobalReportsPage> createState() => _AdminGlobalReportsPageState();
}

class _AdminGlobalReportsPageState extends State<AdminGlobalReportsPage> {
  HadirApi? _api;
  DateTime _from = DateTime(HadirTime.now().year, HadirTime.now().month, 1);
  DateTime _to = HadirTime.now();
  String _employeeId = '';
  String _status = 'ALL';
  bool _exceptionsOnly = false;
  int _tab = 0;
  bool _loading = true;
  bool _exporting = false;
  String? _error;
  List<Map<String, dynamic>> _employees = [];
  Map<String, dynamic>? _report;
  Map<String, dynamic>? _detail;

  String _date(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  int _num(Map<String, dynamic> value, String key) => value[key] is num
      ? (value[key] as num).toInt()
      : int.tryParse('${value[key]}') ?? 0;

  String _minutes(dynamic value) {
    final n = (value is num ? value.toInt() : int.tryParse('$value') ?? 0).clamp(0, 999999);
    return '${n ~/ 60}س ${n % 60}د';
  }

  String _statusLabel(String status) => const {
        'PRESENT': 'حاضر',
        'LATE': 'متأخر',
        'ABSENT': 'غياب',
        'LEAVE': 'إجازة',
        'PERMISSION': 'استئذان',
        'REST': 'راحة',
        'ESCAPED': 'هروب',
        'NOT_STARTED': 'لم يبدأ',
        'INVALID': 'غير صالح',
        'OPEN': 'انصراف معلق',
      }[status] ?? status;

  String _clock(dynamic value) {
    if (value == null || '$value'.trim().isEmpty) return '—';
    final date = HadirTime.fromTimestamp(value);
    return date == null
        ? '$value'
        : '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final token = await HadirSession().adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      final api = HadirApi(token: token);
      final response = await api.dio.get('/api/employees');
      final raw = response.data;
      final employees = raw is List
          ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _api = api;
        _employees = employees;
        _loading = false;
      });
      await _loadReport();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(error);
      });
    }
  }

  Future<void> _loadReport() async {
    final api = _api;
    if (api == null) return;
    if (_from.isAfter(_to)) {
      setState(() => _error = 'حدد فترة زمنية صحيحة.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _detail = null;
    });
    try {
      final result = await api.professionalAttendanceReport(
        from: _date(_from),
        to: _date(_to),
        employeeId: _employeeId.isEmpty ? null : _employeeId,
      );
      if (!mounted) return;
      setState(() {
        _report = result;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(error);
      });
    }
  }

  Future<void> _detailFor(Map<String, dynamic> row) async {
    final api = _api;
    final day = '${row['attendanceDay'] ?? ''}';
    final id = '${row['employeeId'] ?? ''}';
    if (api == null || day.isEmpty || id.isEmpty) return;
    setState(() {
      _detail = null;
      _loading = true;
    });
    try {
      final detail = await api.professionalAttendanceDrilldown(
        attendanceDay: day,
        employeeId: id,
      );
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(error);
      });
    }
  }

  List<Map<String, dynamic>> get _rows {
    final raw = _report?['rows'];
    if (raw is! List) return [];
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).where((row) {
      final status = '${row['status'] ?? ''}';
      if (_status != 'ALL' && status != _status) return false;
      if (_exceptionsOnly &&
          !(['LATE', 'ABSENT', 'ESCAPED', 'OPEN'].contains(status) ||
              _num(row, 'lateMinutes') > 0 ||
              _num(row, 'earlyLeaveMinutes') > 0 ||
              _num(row, 'overtimeMinutes') > 0 ||
              '${row['exceptionCode'] ?? ''}'.isNotEmpty)) {
        return false;
      }
      return true;
    }).toList();
  }

  List<Map<String, dynamic>> get _summaries {
    final analytics = _report?['analytics'];
    final raw = analytics is Map ? analytics['employeeSummaries'] : null;
    return raw is List
        ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
        : [];
  }

  List<Map<String, dynamic>> get _exceptions {
    final analytics = _report?['analytics'];
    final raw = analytics is Map ? analytics['exceptions'] : null;
    return raw is List
        ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
        : [];
  }

  Map<String, dynamic> get _summary => _report?['summary'] is Map
      ? Map<String, dynamic>.from(_report!['summary'] as Map)
      : <String, dynamic>{};

  void _period(String period) {
    final now = HadirTime.now();
    DateTime from;
    DateTime to = DateTime(now.year, now.month, now.day);
    switch (period) {
      case 'today':
        from = to;
        break;
      case 'week':
        final start = now.subtract(Duration(days: now.weekday - 1));
        from = DateTime(start.year, start.month, start.day);
        break;
      case 'year':
        from = DateTime(now.year, 1, 1);
        break;
      default:
        from = DateTime(now.year, now.month, 1);
    }
    setState(() {
      _from = from;
      _to = to;
    });
    _loadReport();
  }

  Future<void> _pickDate(bool from) async {
    final initial = from ? _from : _to;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: HadirTime.now().add(const Duration(days: 365)),
      locale: const Locale('ar'),
    );
    if (picked == null) return;
    setState(() {
      if (from) {
        _from = picked;
      } else {
        _to = picked;
      }
    });
  }

  Future<void> _shareCsv() async {
    final rows = _rows;
    if (rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final buffer = StringBuffer();
      buffer.writeln('التاريخ,الموظف,الرقم الوظيفي,الحالة,الحضور,الانصراف,الساعات,التأخر,المبكر,الإضافي,الاستثناء');
      String quote(dynamic value) => '"${'${value ?? ''}'.replaceAll('"', '""')}"';
      for (final row in rows) {
        buffer.writeln([
          row['attendanceDay'],
          row['employeeName'],
          row['jobNumber'],
          _statusLabel('${row['status'] ?? ''}'),
          _clock(row['checkInAt']),
          _clock(row['checkOutAt']),
          _minutes(row['workedMinutes']),
          row['lateMinutes'] ?? 0,
          row['earlyLeaveMinutes'] ?? 0,
          row['overtimeMinutes'] ?? 0,
          row['exceptionCode'] ?? '',
        ].map(quote).join(','));
      }
      await SharePlus.instance.share(ShareParams(
        files: [
          XFile.fromData(
            Uint8List.fromList(utf8.encode(buffer.toString())),
            mimeType: 'text/csv',
            name: 'hadir-attendance.csv',
          ),
        ],
        text: 'تقرير حاضر ${_date(_from)} → ${_date(_to)}',
      ));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _shareExcel() async {
    final rows = _rows;
    if (rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final excel = Excel.createExcel();
      final sheet = excel['تقرير الحضور'];
      const headers = ['التاريخ', 'الموظف', 'الرقم الوظيفي', 'الحالة', 'الحضور', 'الانصراف', 'الساعات', 'التأخر', 'المبكر', 'الإضافي', 'الاستثناء'];
      for (var column = 0; column < headers.length; column++) {
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: column, rowIndex: 0)).value = TextCellValue(headers[column]);
      }
      for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        final row = rows[rowIndex];
        final values = [
          '${row['attendanceDay'] ?? ''}',
          '${row['employeeName'] ?? ''}',
          '${row['jobNumber'] ?? ''}',
          _statusLabel('${row['status'] ?? ''}'),
          _clock(row['checkInAt']),
          _clock(row['checkOutAt']),
          _minutes(row['workedMinutes']),
          '${row['lateMinutes'] ?? 0}',
          '${row['earlyLeaveMinutes'] ?? 0}',
          '${row['overtimeMinutes'] ?? 0}',
          '${row['exceptionCode'] ?? ''}',
        ];
        for (var column = 0; column < values.length; column++) {
          sheet.cell(CellIndex.indexByColumnRow(columnIndex: column, rowIndex: rowIndex + 1)).value = TextCellValue(values[column]);
        }
      }
      final bytes = excel.encode();
      if (bytes == null) throw Exception('تعذر إنشاء ملف Excel.');
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(Uint8List.fromList(bytes), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'hadir-attendance.xlsx')],
        text: 'تقرير حاضر ${_date(_from)} → ${_date(_to)}',
      ));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _print() async {
    final rows = _rows;
    if (rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final regular = await PdfGoogleFonts.notoSansArabicRegular();
      final bold = await PdfGoogleFonts.notoSansArabicBold();
      final pdf = pw.Document();
      final data = rows.map((row) => <String>[
            '${row['attendanceDay'] ?? '—'}',
            '${row['employeeName'] ?? '—'}',
            '${row['jobNumber'] ?? '—'}',
            _statusLabel('${row['status'] ?? ''}'),
            _clock(row['checkInAt']),
            _clock(row['checkOutAt']),
            _minutes(row['workedMinutes']),
            '${row['lateMinutes'] ?? 0}',
            '${row['earlyLeaveMinutes'] ?? 0}',
            '${row['overtimeMinutes'] ?? 0}',
          ]).toList();
      pdf.addPage(pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        textDirection: pw.TextDirection.rtl,
        build: (_) => [
          pw.Text('HADIR / حاضر · تقرير الحضور', style: pw.TextStyle(font: bold, fontSize: 18)),
          pw.SizedBox(height: 8),
          pw.Text('${_date(_from)} → ${_date(_to)}', style: pw.TextStyle(font: regular, fontSize: 10)),
          pw.SizedBox(height: 12),
          pw.TableHelper.fromTextArray(
            data: data,
            headers: const ['التاريخ', 'الموظف', 'الرقم الوظيفي', 'الحالة', 'الحضور', 'الانصراف', 'الساعات', 'التأخر', 'المبكر', 'الإضافي'],
            headerStyle: pw.TextStyle(font: bold, fontSize: 7),
            cellStyle: pw.TextStyle(font: regular, fontSize: 7),
            tableDirection: pw.TextDirection.rtl,
          ),
        ],
      ));
      await Printing.layoutPdf(name: 'hadir-report-${_date(_from)}-${_date(_to)}.pdf', onLayout: (_) => pdf.save());
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('مركز التقارير والحضور', style: TextStyle(fontWeight: FontWeight.w900)),
          actions: [
            IconButton(onPressed: _exporting || rows.isEmpty ? null : _print, tooltip: 'PDF / طباعة', icon: const Icon(Icons.print_outlined)),
            PopupMenuButton<String>(
              enabled: !_exporting && rows.isNotEmpty,
              onSelected: (value) => value == 'excel' ? _shareExcel() : _shareCsv(),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'excel', child: Text('تصدير Excel')),
                PopupMenuItem(value: 'csv', child: Text('تصدير CSV')),
              ],
            ),
            IconButton(onPressed: _loading ? null : _loadReport, tooltip: 'تحديث', icon: const Icon(Icons.refresh_rounded)),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: _loadReport,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 30),
            children: [
              _hero(),
              const SizedBox(height: 12),
              _filters(),
              if (_error != null) ...[const SizedBox(height: 10), _errorCard()],
              if (_report != null) ...[
                const SizedBox(height: 14),
                _kpis(_summary),
                const SizedBox(height: 14),
                _tabs(),
                const SizedBox(height: 12),
                _tabBody(rows),
                if (_detail != null) _detailCard(_detail!),
              ],
              if (_loading && _report == null) const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero() => Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(children: [
            Container(width: 46, height: 46, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(13)), child: const Icon(Icons.analytics_rounded, color: HadirBrand.primary)),
            const SizedBox(width: 12),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('HADIR · GLOBAL WORKFORCE REPORTING', style: TextStyle(color: HadirBrand.muted, fontSize: 10, fontWeight: FontWeight.w800)),
              SizedBox(height: 2),
              Text('لوحة الحضور التنفيذية', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
              SizedBox(height: 4),
              Text('المصدر الموحد للسجل الرسمي، المؤشرات، الساعات والاستثناءات. القراءة فقط؛ تسجيل الحضور يبقى عبر محرك الحضور المركزي.', style: TextStyle(color: HadirBrand.muted, fontSize: 11, height: 1.4)),
            ])),
          ]),
        ),
      );

  Widget _filters() => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(children: [
            Align(alignment: Alignment.centerRight, child: Wrap(spacing: 7, children: [
              _periodChip('يومي', 'today'),
              _periodChip('أسبوعي', 'week'),
              _periodChip('شهري', 'month'),
              _periodChip('سنوي', 'year'),
            ])),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: _dateButton('من', _from, true)),
              const SizedBox(width: 8),
              Expanded(child: _dateButton('إلى', _to, false)),
            ]),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              value: _employeeId.isEmpty ? null : _employeeId,
              decoration: const InputDecoration(labelText: 'الموظف', prefixIcon: Icon(Icons.person_outline)),
              items: [
                const DropdownMenuItem<String>(value: '', child: Text('كل الموظفين')),
                ..._employees.map((employee) => DropdownMenuItem<String>(value: '${employee['id']}', child: Text('${employee['name'] ?? 'موظف'} · ${employee['jobNumber'] ?? '—'}'))),
              ],
              onChanged: (value) => setState(() => _employeeId = value ?? ''),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: DropdownButtonFormField<String>(
                value: _status,
                decoration: const InputDecoration(labelText: 'الحالة'),
                items: const [
                  DropdownMenuItem(value: 'ALL', child: Text('كل الحالات')),
                  DropdownMenuItem(value: 'PRESENT', child: Text('حاضر')),
                  DropdownMenuItem(value: 'LATE', child: Text('متأخر')),
                  DropdownMenuItem(value: 'ABSENT', child: Text('غياب')),
                  DropdownMenuItem(value: 'LEAVE', child: Text('إجازة')),
                  DropdownMenuItem(value: 'PERMISSION', child: Text('استئذان')),
                  DropdownMenuItem(value: 'REST', child: Text('راحة')),
                  DropdownMenuItem(value: 'ESCAPED', child: Text('هروب')),
                  DropdownMenuItem(value: 'OPEN', child: Text('انصراف معلق')),
                  DropdownMenuItem(value: 'INVALID', child: Text('غير صالح')),
                ],
                onChanged: (value) => setState(() => _status = value ?? 'ALL'),
              )),
              const SizedBox(width: 8),
              Expanded(child: SwitchListTile.adaptive(contentPadding: EdgeInsets.zero, value: _exceptionsOnly, onChanged: (value) => setState(() => _exceptionsOnly = value), title: const Text('الاستثناءات فقط', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)))),
            ]),
            const SizedBox(height: 8),
            FilledButton.icon(onPressed: _loading ? null : _loadReport, icon: _loading ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.sync_rounded), label: Text(_loading ? 'جاري بناء التقرير…' : 'تحديث مركز التقارير')),
          ]),
        ),
      );

  Widget _periodChip(String label, String period) => ActionChip(label: Text(label), onPressed: () => _period(period));

  Widget _dateButton(String label, DateTime value, bool from) => OutlinedButton.icon(onPressed: () => _pickDate(from), icon: const Icon(Icons.calendar_today_outlined, size: 17), label: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 10)), Text(_date(value), style: const TextStyle(fontWeight: FontWeight.w800))]));

  Widget _kpis(Map<String, dynamic> summary) => GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        childAspectRatio: 1.55,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        children: [
          _Kpi('الموظفون', '${_num(summary, 'employees')}', '${_num(summary, 'employeeDays')} موظف/يوم', Icons.groups_rounded),
          _Kpi('الحضور', '${_num(summary, 'present') + _num(summary, 'late')}', 'معدل ${summary['attendanceRate'] ?? 0}%', Icons.how_to_reg_rounded),
          _Kpi('الساعات', _minutes(summary['workedMinutes']), 'متوقع ${_minutes(summary['expectedMinutes'])}', Icons.schedule_rounded),
          _Kpi('الاستثناءات', '${_exceptions.length}', 'تأخر ${_num(summary, 'lateMinutes')}د · إضافي ${_num(summary, 'overtimeMinutes')}د', Icons.warning_amber_rounded),
        ],
      );

  Widget _tabs() => SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
        _tabButton(0, 'النظرة التنفيذية', Icons.dashboard_outlined),
        _tabButton(1, 'السجل اليومي', Icons.fact_check_outlined),
        _tabButton(2, 'الموظفون', Icons.groups_outlined),
        _tabButton(3, 'الاستثناءات', Icons.warning_amber_outlined),
      ]));

  Widget _tabButton(int index, String label, IconData icon) {
    final active = _tab == index;
    return Padding(padding: const EdgeInsets.only(left: 7), child: ChoiceChip(selected: active, label: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 16), const SizedBox(width: 5), Text(label)]), onSelected: (_) => setState(() => _tab = index)));
  }

  Widget _tabBody(List<Map<String, dynamic>> rows) {
    switch (_tab) {
      case 1:
        return _dailyTab(rows);
      case 2:
        return _employeeTab();
      case 3:
        return _exceptionTab();
      default:
        return _overview();
    }
  }

  Widget _overview() {
    final analytics = _report?['analytics'];
    final dailyRaw = analytics is Map ? analytics['dailySeries'] : null;
    final daily = dailyRaw is List ? dailyRaw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).take(31).toList() : <Map<String, dynamic>>[];
    return Column(children: [
      Card(child: Padding(padding: const EdgeInsets.all(15), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('اتجاه الحضور والغياب', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        const SizedBox(height: 12),
        if (daily.isEmpty) const Text('لا توجد سلسلة يومية للفترة الحالية.') else SizedBox(height: 180, child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: daily.map((day) {
          final present = _num(day, 'present');
          final late = _num(day, 'late');
          final absent = _num(day, 'absent');
          final total = (present + late + absent).clamp(1, 999999);
          return Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 2), child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
            Expanded(child: Align(alignment: Alignment.bottomCenter, child: Container(height: (present / total) * 120 + 4, width: 12, decoration: BoxDecoration(color: HadirBrand.primary, borderRadius: BorderRadius.circular(6))))),
            Text('${day['attendanceDay'] ?? ''}'.split('-').last, style: const TextStyle(fontSize: 8)),
            Text('$present/$late/$absent', style: const TextStyle(fontSize: 7, color: HadirBrand.muted)),
          ])));
        }).toList())),
      ]))),
      const SizedBox(height: 10),
      Card(child: Padding(padding: const EdgeInsets.all(15), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('الساعات الفعلية مقابل المتوقعة', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        const SizedBox(height: 10),
        ...daily.take(10).map((day) {
          final worked = _num(day, 'workedMinutes');
          final expected = _num(day, 'expectedMinutes');
          final max = [worked, expected, 1].reduce((a, b) => a > b ? a : b);
          return Padding(padding: const EdgeInsets.only(bottom: 9), child: Row(children: [
            SizedBox(width: 78, child: Text('${day['attendanceDay'] ?? ''}', style: const TextStyle(fontSize: 9))),
            Expanded(child: Column(children: [LinearProgressIndicator(value: expected / max, minHeight: 5), const SizedBox(height: 3), LinearProgressIndicator(value: worked / max, minHeight: 5)])),
            const SizedBox(width: 8),
            Text(_minutes(worked), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800)),
          ]));
        }),
      ]))),
    ]);
  }

  Widget _dailyTab(List<Map<String, dynamic>> rows) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('السجل اليومي الرسمي · ${rows.length} سجل', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
        const SizedBox(height: 8),
        if (rows.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('لا توجد بيانات مطابقة للفلاتر الحالية.')))),
        ...rows.take(250).map(_rowCard),
        if (rows.length > 250) const Padding(padding: EdgeInsets.all(8), child: Text('الواجهة تعرض أول 250 سجلًا؛ التصدير يشمل جميع النتائج.', style: TextStyle(color: HadirBrand.muted, fontSize: 10))),
      ]);

  Widget _rowCard(Map<String, dynamic> row) => Card(child: ListTile(
        onTap: () => _detailFor(row),
        leading: CircleAvatar(backgroundColor: HadirBrand.soft, child: Icon('${row['status'] ?? ''}' == 'ABSENT' ? Icons.event_busy_rounded : Icons.event_available_rounded, color: HadirBrand.primary)),
        title: Text('${row['employeeName'] ?? 'موظف'}', style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text('${row['attendanceDay'] ?? '—'} · ${row['jobNumber'] ?? '—'}\n${_statusLabel('${row['status'] ?? ''}')} · ${_clock(row['checkInAt'])} → ${_clock(row['checkOutAt'])} · ${_minutes(row['workedMinutes'])}'),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_left_rounded),
      ));

  Widget _employeeTab() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('ملخص الموظفين', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
        const SizedBox(height: 8),
        ..._summaries.map((employee) => Card(child: ListTile(
          leading: CircleAvatar(backgroundColor: HadirBrand.soft, child: const Icon(Icons.person_outline)),
          title: Text('${employee['employeeName'] ?? 'موظف'}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${employee['jobNumber'] ?? '—'} · أيام ${employee['days'] ?? 0} · حاضر ${employee['present'] ?? 0} · غياب ${employee['absent'] ?? 0}\nتأخر ${employee['lateMinutes'] ?? 0}د · مبكر ${employee['earlyLeaveMinutes'] ?? 0}د · إضافي ${employee['overtimeMinutes'] ?? 0}د'),
          isThreeLine: true,
        ))),
      ]);

  Widget _exceptionTab() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('الاستثناءات · ${_exceptions.length}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
        const SizedBox(height: 8),
        if (_exceptions.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('لا توجد استثناءات للفترة.')))),
        ..._exceptions.map((exception) => Card(child: ListTile(
          leading: const Icon(Icons.warning_amber_rounded),
          title: Text('${exception['employeeName'] ?? 'موظف'}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${exception['attendanceDay'] ?? '—'} · ${exception['code'] ?? exception['exceptionCode'] ?? 'استثناء'}\n${exception['status'] ?? 'معلق'} · ${exception['reason'] ?? ''}'),
          isThreeLine: true,
        ))),
      ]);

  Widget _detailCard(Map<String, dynamic> detail) {
    final fact = detail['fact'] is Map ? Map<String, dynamic>.from(detail['fact'] as Map) : <String, dynamic>{};
    final trace = detail['trace'] is Map ? Map<String, dynamic>.from(detail['trace'] as Map) : <String, dynamic>{};
    final sources = detail['sources'] is Map ? Map<String, dynamic>.from(detail['sources'] as Map) : <String, dynamic>{};
    return Card(margin: const EdgeInsets.only(top: 10), child: Padding(padding: const EdgeInsets.all(15), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [const Icon(Icons.manage_search_rounded, color: HadirBrand.primary), const SizedBox(width: 7), Expanded(child: Text('تفصيل ${fact['employeeName'] ?? ''} · ${fact['attendanceDay'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)))]),
      const Divider(height: 22),
      _line('الحالة', _statusLabel('${fact['status'] ?? '—'}')),
      _line('الجدول', '${fact['scheduleType'] ?? '—'} · ${fact['scheduledStart'] ?? '—'} → ${fact['scheduledEnd'] ?? '—'}'),
      _line('العمل', _minutes(fact['workedMinutes'])),
      _line('التأخر / المبكر / الإضافي', '${fact['lateMinutes'] ?? 0}د / ${fact['earlyLeaveMinutes'] ?? 0}د / ${fact['overtimeMinutes'] ?? 0}د'),
      _line('مصدر الحساب', '${fact['calculationSource'] ?? trace['sourceOfTruth'] ?? '—'}'),
      _line('الإصدار', '${fact['calculationVersion'] ?? '—'}'),
      _line('التتبع', 'حضور ${trace['attendanceEventIds'] is List ? (trace['attendanceEventIds'] as List).length : 0} · طلبات ${trace['requestIds'] is List ? (trace['requestIds'] as List).length : 0} · تدقيق ${trace['auditIds'] is List ? (trace['auditIds'] as List).length : 0} · استثناءات ${sources['exceptions'] is List ? (sources['exceptions'] as List).length : 0}'),
      const SizedBox(height: 5),
      const Text('قراءة فقط — لا يتم تعديل السجل الخام من مركز التقارير.', style: TextStyle(color: HadirBrand.muted, fontSize: 10)),
    ])));
  }

  Widget _line(String label, String value) => Padding(padding: const EdgeInsets.only(bottom: 7), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [SizedBox(width: 130, child: Text(label, style: const TextStyle(color: HadirBrand.muted, fontSize: 11, fontWeight: FontWeight.w700))), Expanded(child: Text(value, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)))]));

  Widget _errorCard() => Card(color: Theme.of(context).colorScheme.errorContainer, child: Padding(padding: const EdgeInsets.all(13), child: Row(children: [Icon(Icons.error_outline, color: Theme.of(context).colorScheme.onErrorContainer), const SizedBox(width: 8), Expanded(child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer)))]));
}

class _Kpi extends StatelessWidget {
  const _Kpi(this.title, this.value, this.detail, this.icon);
  final String title;
  final String value;
  final String detail;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: HadirBrand.primary)), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: HadirBrand.muted, fontSize: 11)), const SizedBox(height: 2), Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), Text(detail, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: HadirBrand.muted, fontSize: 9))]))]));
}
