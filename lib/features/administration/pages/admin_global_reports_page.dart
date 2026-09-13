import 'dart:convert';
import 'dart:typed_data';

import 'package:excel/excel.dart' hide Border;
import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api.dart';
import '../../../core/hadir_time.dart';
import '../../../core/session.dart';

/// Read-only reporting surface shared by the web site and Flutter.
/// Attendance mutations remain exclusively in the central attendance engine.
class AdminGlobalReportsPage extends StatefulWidget {
  const AdminGlobalReportsPage({super.key});

  @override
  State<AdminGlobalReportsPage> createState() => _AdminGlobalReportsPageState();
}

class _AdminGlobalReportsPageState extends State<AdminGlobalReportsPage> {
  HadirApi? _api;
  DateTime _from = DateTime(HadirTime.now().year, HadirTime.now().month, 1);
  DateTime _to = DateTime(HadirTime.now().year, HadirTime.now().month, HadirTime.now().day);
  String _employeeId = '';
  String _status = 'ALL';
  bool _exceptionsOnly = false;
  int _tab = 0;
  bool _loading = true;
  bool _exporting = false;
  String? _error;
  List<Map<String, dynamic>> _employees = <Map<String, dynamic>>[];
  Map<String, dynamic> _report = <String, dynamic>{};
  Map<String, dynamic>? _detail;

  String _date(DateTime value) => '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  Map<String, dynamic> _map(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  List<Map<String, dynamic>> _list(dynamic value) {
    if (value is! List) return <Map<String, dynamic>>[];
    return value.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList();
  }

  int _int(dynamic value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;

  String _minutes(dynamic value) {
    final minutes = _int(value).clamp(0, 999999);
    return '${minutes ~/ 60}س ${minutes % 60}د';
  }

  String _statusLabel(String status) => const <String, String>{
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
    if (date == null) return '$value';
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  List<Map<String, dynamic>> get _rows {
    final rows = _list(_report['rows']);
    return rows.where((row) {
      final status = '${row['status'] ?? ''}';
      if (_status != 'ALL' && status != _status) return false;
      if (!_exceptionsOnly) return true;
      return const <String>{'LATE', 'ABSENT', 'ESCAPED', 'OPEN'}.contains(status) ||
          _int(row['lateMinutes']) > 0 ||
          _int(row['earlyLeaveMinutes']) > 0 ||
          _int(row['overtimeMinutes']) > 0 ||
          '${row['exceptionCode'] ?? ''}'.trim().isNotEmpty;
    }).toList();
  }

  Map<String, dynamic> get _summary => _map(_report['summary']);
  Map<String, dynamic> get _analytics => _map(_report['analytics']);
  List<Map<String, dynamic>> get _summaries => _list(_analytics['employeeSummaries']);
  List<Map<String, dynamic>> get _exceptions => _list(_analytics['exceptions']);

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      final token = await HadirSession().adminToken();
      if (token == null || token.isEmpty) throw StateError('انتهت جلسة الإدارة.');
      final api = HadirApi(token: token);
      final response = await api.dio.get('/api/employees');
      final data = response.data;
      final raw = data is Map ? data['employees'] ?? data['data'] : data;
      if (!mounted) return;
      setState(() {
        _api = api;
        _employees = _list(raw);
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

  Future<void> _loadDetail(Map<String, dynamic> row) async {
    final api = _api;
    final day = '${row['attendanceDay'] ?? ''}';
    final employeeId = '${row['employeeId'] ?? ''}';
    if (api == null || day.isEmpty || employeeId.isEmpty) return;
    setState(() {
      _loading = true;
      _detail = null;
    });
    try {
      final detail = await api.professionalAttendanceDrilldown(attendanceDay: day, employeeId: employeeId);
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

  void _setPeriod(String period) {
    final now = HadirTime.now();
    final today = DateTime(now.year, now.month, now.day);
    late DateTime from;
    if (period == 'today') {
      from = today;
    } else if (period == 'week') {
      final start = today.subtract(Duration(days: today.weekday - 1));
      from = DateTime(start.year, start.month, start.day);
    } else if (period == 'year') {
      from = DateTime(now.year, 1, 1);
    } else {
      from = DateTime(now.year, now.month, 1);
    }
    setState(() {
      _from = from;
      _to = today;
    });
    _loadReport();
  }

  Future<void> _pickDate(bool isFrom) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? _from : _to,
      firstDate: DateTime(2020),
      lastDate: HadirTime.now().add(const Duration(days: 365)),
      locale: const Locale('ar'),
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) {
        _from = picked;
      } else {
        _to = picked;
      }
    });
    await _loadReport();
  }

  Widget _kpi(String title, dynamic value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon),
            const SizedBox(width: 12),
            Expanded(child: Text(title)),
            Text('$value', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }

  Widget _filters() {
    final employeeInitial = _employees.any((item) => '${item['id'] ?? item['employeeId'] ?? ''}' == _employeeId) ? _employeeId : '';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilterChip(label: const Text('اليوم'), selected: false, onSelected: (_) => _setPeriod('today')),
                FilterChip(label: const Text('هذا الأسبوع'), selected: false, onSelected: (_) => _setPeriod('week')),
                FilterChip(label: const Text('هذا الشهر'), selected: false, onSelected: (_) => _setPeriod('month')),
                FilterChip(label: const Text('هذه السنة'), selected: false, onSelected: (_) => _setPeriod('year')),
                FilterChip(label: const Text('استثناءات فقط'), selected: _exceptionsOnly, onSelected: (value) => setState(() => _exceptionsOnly = value)),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                OutlinedButton.icon(onPressed: () => _pickDate(true), icon: const Icon(Icons.date_range), label: Text('من ${_date(_from)}')),
                OutlinedButton.icon(onPressed: () => _pickDate(false), icon: const Icon(Icons.event), label: Text('إلى ${_date(_to)}')),
                SizedBox(
                  width: 280,
                  child: DropdownButtonFormField<String>(
                    initialValue: employeeInitial,
                    decoration: const InputDecoration(labelText: 'الموظف', border: OutlineInputBorder()),
                    items: [
                      const DropdownMenuItem(value: '', child: Text('كل الموظفين')),
                      ..._employees.map((employee) {
                        final id = '${employee['id'] ?? employee['employeeId'] ?? ''}';
                        final name = '${employee['name'] ?? employee['employeeName'] ?? employee['fullName'] ?? id}';
                        return DropdownMenuItem(value: id, child: Text(name));
                      }),
                    ],
                    onChanged: (value) {
                      setState(() => _employeeId = value ?? '');
                      _loadReport();
                    },
                  ),
                ),
                SizedBox(
                  width: 220,
                  child: DropdownButtonFormField<String>(
                    initialValue: _status,
                    decoration: const InputDecoration(labelText: 'الحالة', border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: 'ALL', child: Text('كل الحالات')),
                      DropdownMenuItem(value: 'PRESENT', child: Text('حاضر')),
                      DropdownMenuItem(value: 'LATE', child: Text('متأخر')),
                      DropdownMenuItem(value: 'ABSENT', child: Text('غياب')),
                      DropdownMenuItem(value: 'LEAVE', child: Text('إجازة')),
                      DropdownMenuItem(value: 'PERMISSION', child: Text('استئذان')),
                      DropdownMenuItem(value: 'REST', child: Text('راحة')),
                      DropdownMenuItem(value: 'OPEN', child: Text('انصراف معلق')),
                    ],
                    onChanged: (value) => setState(() => _status = value ?? 'ALL'),
                  ),
                ),
                FilledButton.icon(onPressed: _loading ? null : _loadReport, icon: const Icon(Icons.refresh), label: const Text('تحديث')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _overview() {
    final daily = _list(_analytics['dailySeries']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            SizedBox(width: 210, child: _kpi('الموظفون', _summary['employees'] ?? _summary['employeeCount'] ?? 0, Icons.people_alt_outlined)),
            SizedBox(width: 210, child: _kpi('سجلات الحضور', _summary['attendance'] ?? _summary['attendanceCount'] ?? _rows.length, Icons.fact_check_outlined)),
            SizedBox(width: 210, child: _kpi('الساعات', _minutes(_summary['workedMinutes'] ?? _summary['totalWorkedMinutes'] ?? 0), Icons.schedule_outlined)),
            SizedBox(width: 210, child: _kpi('الاستثناءات', _exceptions.length, Icons.warning_amber_outlined)),
          ],
        ),
        if (daily.isNotEmpty) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('الاتجاه اليومي', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  ...daily.take(14).map((item) => ListTile(
                        dense: true,
                        title: Text('${item['date'] ?? item['attendanceDay'] ?? '—'}'),
                        trailing: Text('${item['count'] ?? item['attendance'] ?? 0}'),
                      )),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _officialLog() {
    if (_rows.isEmpty) {
      return const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('لا توجد بيانات مطابقة للفلاتر الحالية.'))));
    }
    return Card(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: const [
            DataColumn(label: Text('التاريخ')),
            DataColumn(label: Text('الموظف')),
            DataColumn(label: Text('الحالة')),
            DataColumn(label: Text('الحضور')),
            DataColumn(label: Text('الانصراف')),
            DataColumn(label: Text('الساعات')),
            DataColumn(label: Text('تفاصيل')),
          ],
          rows: _rows.map((row) => DataRow(cells: [
                DataCell(Text('${row['attendanceDay'] ?? '—'}')),
                DataCell(Text('${row['employeeName'] ?? row['employeeId'] ?? '—'}')),
                DataCell(Text(_statusLabel('${row['status'] ?? ''}'))),
                DataCell(Text(_clock(row['checkInAt']))),
                DataCell(Text(_clock(row['checkOutAt']))),
                DataCell(Text(_minutes(row['workedMinutes']))),
                DataCell(IconButton(onPressed: () => _loadDetail(row), icon: const Icon(Icons.open_in_new))),
              ])).toList(),
        ),
      ),
    );
  }

  Widget _employeesTab() {
    if (_summaries.isEmpty) return const Card(child: Padding(padding: EdgeInsets.all(24), child: Text('لا توجد ملخصات موظفين.')));
    return Card(
      child: Column(
        children: _summaries.map((row) => ListTile(
              title: Text('${row['employeeName'] ?? row['name'] ?? row['employeeId'] ?? '—'}'),
              subtitle: Text('حضور: ${row['attendance'] ?? row['present'] ?? 0} · ساعات: ${_minutes(row['workedMinutes'] ?? 0)}'),
              trailing: Text('${row['lateMinutes'] ?? 0} د تأخر'),
            )).toList(),
      ),
    );
  }

  Widget _exceptionsTab() {
    if (_exceptions.isEmpty) return const Card(child: Padding(padding: EdgeInsets.all(24), child: Text('لا توجد استثناءات في الفترة المحددة.')));
    return Card(
      child: Column(
        children: _exceptions.map((row) => ListTile(
              title: Text('${row['employeeName'] ?? row['employeeId'] ?? '—'}'),
              subtitle: Text('${row['attendanceDay'] ?? row['date'] ?? '—'} · ${row['exceptionCode'] ?? row['code'] ?? 'استثناء'}'),
              trailing: Text('${row['minutes'] ?? row['lateMinutes'] ?? 0} د'),
            )).toList(),
      ),
    );
  }

  Widget _detailCard() {
    if (_detail == null) return const SizedBox.shrink();
    final report = _map(_detail!['report']);
    final data = report.isEmpty ? _detail! : report;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('تفاصيل السجل', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            Text('الحالة: ${_statusLabel('${data['status'] ?? ''}')}'),
            Text('الحضور: ${_clock(data['checkInAt'])}'),
            Text('الانصراف: ${_clock(data['checkOutAt'])}'),
            Text('الساعات: ${_minutes(data['workedMinutes'])}'),
            Text('التأخر: ${data['lateMinutes'] ?? 0} د'),
            Text('المبكر: ${data['earlyLeaveMinutes'] ?? 0} د'),
            Text('الإضافي: ${data['overtimeMinutes'] ?? 0} د'),
            const SizedBox(height: 10),
            const Text('هذا العرض للقراءة والتدقيق فقط؛ مصدر البيانات هو محرك الحضور والتقارير المركزي.', style: TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }

  Future<void> _shareCsv() async {
    if (_rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final buffer = StringBuffer('التاريخ,الموظف,الرقم الوظيفي,الحالة,الحضور,الانصراف,الساعات,التأخر,المبكر,الإضافي,الاستثناء\n');
      String quote(dynamic value) => '"${'${value ?? ''}'.replaceAll('"', '""')}"';
      for (final row in _rows) {
        buffer.writeln([
          row['attendanceDay'], row['employeeName'], row['jobNumber'], _statusLabel('${row['status'] ?? ''}'),
          _clock(row['checkInAt']), _clock(row['checkOutAt']), _minutes(row['workedMinutes']), row['lateMinutes'] ?? 0,
          row['earlyLeaveMinutes'] ?? 0, row['overtimeMinutes'] ?? 0, row['exceptionCode'] ?? '',
        ].map(quote).join(','));
      }
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(Uint8List.fromList(utf8.encode(buffer.toString())), mimeType: 'text/csv', name: 'hadir-attendance.csv')],
        text: 'تقرير حاضر ${_date(_from)} → ${_date(_to)}',
      ));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _shareExcel() async {
    if (_rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final excel = Excel.createExcel();
      final sheet = excel['تقرير الحضور'];
      const headers = <String>['التاريخ', 'الموظف', 'الرقم الوظيفي', 'الحالة', 'الحضور', 'الانصراف', 'الساعات', 'التأخر', 'المبكر', 'الإضافي', 'الاستثناء'];
      for (var column = 0; column < headers.length; column++) {
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: column, rowIndex: 0)).value = TextCellValue(headers[column]);
      }
      for (var index = 0; index < _rows.length; index++) {
        final row = _rows[index];
        final values = <String>[
          '${row['attendanceDay'] ?? ''}', '${row['employeeName'] ?? ''}', '${row['jobNumber'] ?? ''}', _statusLabel('${row['status'] ?? ''}'),
          _clock(row['checkInAt']), _clock(row['checkOutAt']), _minutes(row['workedMinutes']), '${row['lateMinutes'] ?? 0}',
          '${row['earlyLeaveMinutes'] ?? 0}', '${row['overtimeMinutes'] ?? 0}', '${row['exceptionCode'] ?? ''}',
        ];
        for (var column = 0; column < values.length; column++) {
          sheet.cell(CellIndex.indexByColumnRow(columnIndex: column, rowIndex: index + 1)).value = TextCellValue(values[column]);
        }
      }
      final bytes = excel.encode();
      if (bytes == null) throw StateError('تعذر إنشاء ملف Excel.');
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(Uint8List.fromList(bytes), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'hadir-attendance.xlsx')],
        text: 'تقرير حاضر ${_date(_from)} → ${_date(_to)}',
      ));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _print() async {
    if (_rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final regular = await PdfGoogleFonts.notoSansArabicRegular();
      final bold = await PdfGoogleFonts.notoSansArabicBold();
      final pdf = pw.Document();
      final data = _rows.map((row) => <String>[
            '${row['attendanceDay'] ?? '—'}', '${row['employeeName'] ?? '—'}', _statusLabel('${row['status'] ?? ''}'),
            _clock(row['checkInAt']), _clock(row['checkOutAt']), _minutes(row['workedMinutes']), '${row['lateMinutes'] ?? 0}',
            '${row['earlyLeaveMinutes'] ?? 0}', '${row['overtimeMinutes'] ?? 0}',
          ]).toList();
      pdf.addPage(pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        textDirection: pw.TextDirection.rtl,
        build: (_) => [
          pw.Text('HADIR / حاضر · تقرير الحضور', style: pw.TextStyle(font: bold, fontSize: 18)),
          pw.SizedBox(height: 6),
          pw.Text('${_date(_from)} → ${_date(_to)}', style: pw.TextStyle(font: regular, fontSize: 10)),
          pw.SizedBox(height: 10),
          pw.TableHelper.fromTextArray(
            data: data,
            headers: const ['التاريخ', 'الموظف', 'الحالة', 'الحضور', 'الانصراف', 'الساعات', 'التأخر', 'المبكر', 'الإضافي'],
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
    const tabs = <String>['نظرة تنفيذية', 'السجل الرسمي', 'الموظفون', 'الاستثناءات'];
    final body = <Widget>[_overview(), _officialLog(), _employeesTab(), _exceptionsTab()][_tab];
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('مركز التقارير والحضور', style: TextStyle(fontWeight: FontWeight.w900)),
          actions: [
            IconButton(onPressed: _exporting || _rows.isEmpty ? null : _print, tooltip: 'PDF / طباعة', icon: const Icon(Icons.print_outlined)),
            PopupMenuButton<String>(
              enabled: !_exporting && _rows.isNotEmpty,
              onSelected: (value) => value == 'excel' ? _shareExcel() : _shareCsv(),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'excel', child: Text('تصدير Excel')),
                PopupMenuItem(value: 'csv', child: Text('تصدير CSV')),
              ],
            ),
          ],
        ),
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) => Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1500),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _filters(),
                      if (_error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text(_error!, style: const TextStyle(fontWeight: FontWeight.w700))),
                      if (_loading) const Padding(padding: EdgeInsets.all(12), child: LinearProgressIndicator()),
                      const SizedBox(height: 6),
                      SegmentedButton<int>(
                        segments: [for (var index = 0; index < tabs.length; index++) ButtonSegment(value: index, label: Text(tabs[index]))],
                        selected: {_tab},
                        onSelectionChanged: (selection) => setState(() => _tab = selection.first),
                      ),
                      const SizedBox(height: 14),
                      body,
                      const SizedBox(height: 14),
                      _detailCard(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
