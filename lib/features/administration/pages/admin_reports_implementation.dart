import 'dart:convert';
import 'dart:typed_data';

import 'package:excel/excel.dart' hide Border;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api.dart';
import '../../../core/hadir_brand.dart';
import '../../../core/session.dart';

class AdminReportsPage extends StatefulWidget {
  const AdminReportsPage({super.key});

  @override
  State<AdminReportsPage> createState() => _AdminReportsPageState();
}

class _AdminReportsPageState extends State<AdminReportsPage> {
  HadirApi? _api;
  DateTime _from = DateTime(DateTime.now().year, DateTime.now().month, 1);
  DateTime _to = DateTime.now();
  String? _employeeId;
  String _statusFilter = 'ALL';
  bool _exceptionsOnly = false;
  List<dynamic> _employees = [];
  Map<String, dynamic>? _report;
  Map<String, dynamic>? _detail;
  bool _loading = false;
  bool _exporting = false;
  String? _error;

  String _date(DateTime value) => '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  String _fmtMinutes(dynamic value) {
    final minutes = (value is num ? value.toInt() : int.tryParse('$value') ?? 0).clamp(0, 999999);
    return '${minutes ~/ 60}س ${minutes % 60}د';
  }

  int _num(Map<String, dynamic> map, String key) => map[key] is num ? (map[key] as num).toInt() : int.tryParse('${map[key]}') ?? 0;

  String _status(String value) => const {
        'PRESENT': 'حاضر',
        'LATE': 'متأخر',
        'ABSENT': 'غياب',
        'LEAVE': 'إجازة',
        'PERMISSION': 'استئذان',
        'REST': 'راحة',
        'NOT_STARTED': 'لم يبدأ',
        'INVALID': 'غير صالح',
        'OPEN': 'مناوبة مفتوحة',
      }[value] ?? value;

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
      if (!mounted) return;
      setState(() {
        _api = api;
        _employees = response.data is List ? List<dynamic>.from(response.data as List) : [];
      });
      await _loadReport();
    } catch (e) {
      if (mounted) setState(() => _error = HadirApi.errorMessage(e));
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
      final report = await api.professionalAttendanceReport(from: _date(_from), to: _date(_to), employeeId: _employeeId);
      if (mounted) setState(() {
        _report = report;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  Future<void> _pickDate(bool from) async {
    final selected = await showDatePicker(
      context: context,
      initialDate: from ? _from : _to,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      locale: const Locale('ar'),
    );
    if (selected == null) return;
    setState(() {
      if (from) {
        _from = selected;
      } else {
        _to = selected;
      }
    });
  }

  void _setPeriod(String value) {
    final today = DateTime.now();
    setState(() {
      if (value == 'today') {
        _from = DateTime(today.year, today.month, today.day);
        _to = _from;
      } else if (value == 'week') {
        final start = today.subtract(Duration(days: today.weekday - 1));
        _from = DateTime(start.year, start.month, start.day);
        _to = DateTime(today.year, today.month, today.day);
      } else if (value == 'month') {
        _from = DateTime(today.year, today.month, 1);
        _to = DateTime(today.year, today.month, today.day);
      } else {
        _from = DateTime(today.year, 1, 1);
        _to = DateTime(today.year, today.month, today.day);
      }
    });
    _loadReport();
  }

  Future<void> _openDetail(Map<String, dynamic> row) async {
    final api = _api;
    final day = '${row['attendanceDay'] ?? ''}';
    final id = '${row['employeeId'] ?? ''}';
    if (api == null || day.isEmpty || id.isEmpty) return;
    setState(() {
      _detail = null;
      _loading = true;
    });
    try {
      final detail = await api.professionalAttendanceDrilldown(attendanceDay: day, employeeId: id);
      if (mounted) setState(() {
        _detail = detail;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  List<Map<String, dynamic>> _filteredRows() {
    final raw = _report?['rows'];
    if (raw is! List) return [];
    return raw.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).where((row) {
      final status = '${row['status'] ?? ''}';
      if (_statusFilter != 'ALL' && status != _statusFilter) return false;
      if (_exceptionsOnly) {
        final exception = status == 'LATE' || status == 'ABSENT' || status == 'OPEN' || _num(row, 'lateMinutes') > 0 || _num(row, 'earlyLeaveMinutes') > 0;
        if (!exception) return false;
      }
      return true;
    }).toList();
  }

  Future<void> _exportCsv() async {
    final rows = _filteredRows();
    if (rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final buffer = StringBuffer();
      buffer.writeln('التاريخ,الموظف,الرقم الوظيفي,الحالة,الحضور,الانصراف,الساعات,التأخر,المغادرة المبكرة,الإضافي');
      for (final row in rows) {
        String clean(dynamic value) => '"${'${value ?? ''}'.replaceAll('"', '""')}"';
        buffer.writeln([
          clean(row['attendanceDay']),
          clean(row['employeeName']),
          clean(row['jobNumber']),
          clean(_status('${row['status'] ?? ''}')),
          clean(_clock(row['checkInAt'])),
          clean(_clock(row['checkOutAt'])),
          clean(_fmtMinutes(row['workedMinutes'])),
          clean('${row['lateMinutes'] ?? 0}'),
          clean('${row['earlyLeaveMinutes'] ?? 0}'),
          clean('${row['overtimeMinutes'] ?? 0}'),
        ].join(','));
      }
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(Uint8List.fromList(utf8.encode(buffer.toString())), mimeType: 'text/csv', name: 'hadir-report.csv')],
        text: 'تقرير حاضر من ${_date(_from)} إلى ${_date(_to)}',
      ));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _exportExcel() async {
    final rows = _filteredRows();
    if (rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final excel = Excel.createExcel();
      final sheet = excel['تقرير الحضور'];
      final headers = ['التاريخ', 'الموظف', 'الرقم الوظيفي', 'الحالة', 'الحضور', 'الانصراف', 'الساعات', 'التأخر', 'المغادرة المبكرة', 'الإضافي'];
      for (var i = 0; i < headers.length; i++) {
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0)).value = TextCellValue(headers[i]);
      }
      for (var r = 0; r < rows.length; r++) {
        final row = rows[r];
        final values = [
          '${row['attendanceDay'] ?? ''}',
          '${row['employeeName'] ?? ''}',
          '${row['jobNumber'] ?? ''}',
          _status('${row['status'] ?? ''}'),
          _clock(row['checkInAt']),
          _clock(row['checkOutAt']),
          _fmtMinutes(row['workedMinutes']),
          '${row['lateMinutes'] ?? 0}',
          '${row['earlyLeaveMinutes'] ?? 0}',
          '${row['overtimeMinutes'] ?? 0}',
        ];
        for (var c = 0; c < values.length; c++) {
          sheet.cell(CellIndex.indexByColumnRow(columnIndex: c, rowIndex: r + 1)).value = TextCellValue(values[c]);
        }
      }
      final encoded = excel.encode();
      if (encoded == null) throw Exception('تعذر إنشاء ملف Excel.');
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(Uint8List.fromList(encoded), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'hadir-report.xlsx')],
        text: 'تقرير حاضر من ${_date(_from)} إلى ${_date(_to)}',
      ));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = _report?['summary'] is Map ? Map<String, dynamic>.from(_report!['summary'] as Map) : <String, dynamic>{};
    final analytics = _report?['analytics'] is Map ? Map<String, dynamic>.from(_report!['analytics'] as Map) : <String, dynamic>{};
    final exceptions = analytics['exceptions'] is List ? List<dynamic>.from(analytics['exceptions'] as List) : <dynamic>[];
    final rows = _filteredRows();

    return Scaffold(
      appBar: AppBar(
        title: const Text('التقارير العالمية', style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          IconButton(onPressed: () => context.push('/admin/reports/archive'), tooltip: 'أرشيف التقارير', icon: const Icon(Icons.inventory_2_outlined)),
          PopupMenuButton<String>(
            tooltip: 'تصدير التقرير',
            enabled: !_exporting && rows.isNotEmpty,
            onSelected: (value) => value == 'excel' ? _exportExcel() : _exportCsv(),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'excel', child: Text('تصدير Excel')),
              PopupMenuItem(value: 'csv', child: Text('تصدير CSV')),
            ],
          ),
          IconButton(onPressed: _loadReport, tooltip: 'تحديث', icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadReport,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 32),
          children: [
            Container(
              padding: const EdgeInsets.all(19),
              decoration: BoxDecoration(
                gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [HadirBrand.primary, HadirBrand.primaryDark]),
                borderRadius: BorderRadius.circular(HadirBrand.radiusXl),
              ),
              child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('لوحة الحضور التنفيذية', style: TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900)),
                SizedBox(height: 6),
                Text('تقرير رسمي من طبقة بيانات حاضر مع فلاتر، تفصيل يومي وتصدير جاهز للمشاركة.', style: TextStyle(color: Colors.white70, height: 1.5, fontSize: 12)),
              ]),
            ),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(children: [
                  Align(alignment: Alignment.centerRight, child: Wrap(spacing: 7, runSpacing: 7, children: [
                    _periodChip('يومي', 'today'),
                    _periodChip('شهري', 'month'),
                    _periodChip('سنوي', 'year'),
                  ])),
                  const SizedBox(height: 12),
                  Row(children: [Expanded(child: _dateButton('من', _from, true)), const SizedBox(width: 8), Expanded(child: _dateButton('إلى', _to, false))]),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _employeeId,
                    decoration: const InputDecoration(labelText: 'الموظف', prefixIcon: Icon(Icons.person_outline_rounded)),
                    items: [
                      const DropdownMenuItem<String>(value: '', child: Text('كل الموظفين')),
                      ..._employees.map((raw) {
                        final e = Map<String, dynamic>.from(raw as Map);
                        return DropdownMenuItem<String>(value: '${e['id']}', child: Text('${e['name'] ?? 'موظف'} · ${e['jobNumber'] ?? '—'}'));
                      }),
                    ],
                    onChanged: (value) => setState(() => _employeeId = value == null || value.isEmpty ? null : value),
                  ),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(child: DropdownButtonFormField<String>(
                      initialValue: _statusFilter,
                      decoration: const InputDecoration(labelText: 'الحالة'),
                      items: const [
                        DropdownMenuItem(value: 'ALL', child: Text('كل الحالات')),
                        DropdownMenuItem(value: 'PRESENT', child: Text('حاضر')),
                        DropdownMenuItem(value: 'LATE', child: Text('متأخر')),
                        DropdownMenuItem(value: 'ABSENT', child: Text('غياب')),
                        DropdownMenuItem(value: 'LEAVE', child: Text('إجازة')),
                        DropdownMenuItem(value: 'PERMISSION', child: Text('استئذان')),
                        DropdownMenuItem(value: 'REST', child: Text('راحة')),
                        DropdownMenuItem(value: 'NOT_STARTED', child: Text('لم يبدأ')),
                        DropdownMenuItem(value: 'OPEN', child: Text('مناوبة مفتوحة')),
                        DropdownMenuItem(value: 'INVALID', child: Text('غير صالح')),
                      ],
                      onChanged: (value) => setState(() => _statusFilter = value ?? 'ALL'),
                    )),
                    const SizedBox(width: 10),
                    Expanded(child: SwitchListTile.adaptive(
                      contentPadding: EdgeInsets.zero,
                      value: _exceptionsOnly,
                      onChanged: (value) => setState(() => _exceptionsOnly = value),
                      title: const Text('الاستثناءات فقط', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                    )),
                  ]),
                  const SizedBox(height: 8),
                  FilledButton.icon(onPressed: _loading ? null : _loadReport, icon: _loading ? const SizedBox.square(dimension: 19, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.analytics_rounded), label: Text(_loading ? 'جاري بناء التقرير...' : 'تحديث التقرير')),
                ]),
              ),
            ),
            if (_error != null) ...[const SizedBox(height: 10), Card(child: Padding(padding: const EdgeInsets.all(14), child: Text(_error!)))],
            if (_report != null) ...[
              const SizedBox(height: 14),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                childAspectRatio: 1.55,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
                children: [
                  _Kpi('الموظفون', '${_num(summary, 'employees')}', 'موظف'),
                  _Kpi('الحضور', '${_num(summary, 'present') + _num(summary, 'late')}', 'معدل ${summary['attendanceRate'] ?? 0}%'),
                  _Kpi('الساعات', _fmtMinutes(summary['workedMinutes']), 'متوقع ${_fmtMinutes(summary['expectedMinutes'])}'),
                  _Kpi('الاستثناءات', '${exceptions.length}', 'تأخر ${_num(summary, 'lateMinutes')}د'),
                ],
              ),
              const SizedBox(height: 16),
              _sectionTitle('السجل اليومي الرسمي', '${rows.length} سجل ظاهر · ${_report!['from'] ?? ''} → ${_report!['to'] ?? ''}'),
              const SizedBox(height: 8),
              if (rows.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('لا توجد بيانات مطابقة للفلاتر الحالية.')))),
              ...rows.take(250).map((row) {
                final status = '${row['status'] ?? ''}';
                return Card(
                  child: ListTile(
                    onTap: () => _openDetail(row),
                    leading: Container(width: 43, height: 43, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(13)), child: Icon(status == 'ABSENT' ? Icons.event_busy_rounded : Icons.event_available_rounded, color: status == 'LATE' ? HadirBrand.warning : HadirBrand.primary)),
                    title: Text('${row['employeeName'] ?? 'موظف'}', style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text('${row['attendanceDay'] ?? '—'} · ${row['jobNumber'] ?? '—'}\n${_status(status)} · حضور ${_clock(row['checkInAt'])} · انصراف ${_clock(row['checkOutAt'])}'),
                    isThreeLine: true,
                    trailing: const Icon(Icons.chevron_left_rounded),
                  ),
                );
              }),
              if (rows.length > 250) const Padding(padding: EdgeInsets.all(10), child: Text('يتم عرض أول 250 سجلًا في الواجهة. التصدير يشمل جميع النتائج.', textAlign: TextAlign.center, style: TextStyle(color: HadirBrand.muted, fontSize: 11))),
              if (_detail != null) _detailCard(_detail!),
            ],
          ],
        ),
      ),
    );
  }

  Widget _periodChip(String label, String value) => ActionChip(label: Text(label), onPressed: () => _setPeriod(value));

  String _clock(dynamic value) {
    if (value == null || '$value'.isEmpty) return '—';
    final parsed = DateTime.tryParse('$value');
    return parsed == null ? '$value' : '${parsed.toLocal().hour.toString().padLeft(2, '0')}:${parsed.toLocal().minute.toString().padLeft(2, '0')}';
  }

  Widget _dateButton(String label, DateTime value, bool from) => OutlinedButton.icon(onPressed: () => _pickDate(from), icon: const Icon(Icons.calendar_today_outlined, size: 17), label: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 10)), Text(_date(value), style: const TextStyle(fontWeight: FontWeight.w800))]));

  Widget _sectionTitle(String title, String subtitle) => Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)), Text(subtitle, style: const TextStyle(fontSize: 11, color: HadirBrand.muted))])), const Icon(Icons.fact_check_outlined, color: HadirBrand.primary)]);

  Widget _detailCard(Map<String, dynamic> detail) {
    final fact = detail['fact'] is Map ? Map<String, dynamic>.from(detail['fact'] as Map) : <String, dynamic>{};
    final trace = detail['trace'] is Map ? Map<String, dynamic>.from(detail['trace'] as Map) : <String, dynamic>{};
    final attendanceIds = trace['attendanceEventIds'] is List ? (trace['attendanceEventIds'] as List).length : 0;
    final requestIds = trace['requestIds'] is List ? (trace['requestIds'] as List).length : 0;
    final auditIds = trace['auditIds'] is List ? (trace['auditIds'] as List).length : 0;
    return Card(margin: const EdgeInsets.only(top: 8), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [const Icon(Icons.manage_search_rounded, color: HadirBrand.primary), const SizedBox(width: 8), Expanded(child: Text('تفصيل ${fact['employeeName'] ?? ''} · ${fact['attendanceDay'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)))]),
      const Divider(height: 24),
      _detailLine('الحالة', _status('${fact['status'] ?? '—'}')),
      _detailLine('الجدول', '${fact['scheduleType'] ?? '—'} · ${fact['scheduledStart'] ?? '—'} → ${fact['scheduledEnd'] ?? '—'}'),
      _detailLine('العمل', _fmtMinutes(fact['workedMinutes'])),
      _detailLine('التأخر / المبكر / الإضافي', '${fact['lateMinutes'] ?? 0}د / ${fact['earlyLeaveMinutes'] ?? 0}د / ${fact['overtimeMinutes'] ?? 0}د'),
      _detailLine('مصدر الحساب', '${fact['calculationSource'] ?? trace['sourceOfTruth'] ?? '—'}'),
      _detailLine('إصدار الحساب', '${fact['calculationVersion'] ?? '—'}'),
      _detailLine('التتبع', 'حضور $attendanceIds · طلبات $requestIds · تدقيق $auditIds'),
      const SizedBox(height: 6),
      const Text('التفصيل للقراءة فقط؛ لا يغيّر السجل الخام.', style: TextStyle(color: HadirBrand.muted, fontSize: 11)),
    ])));
  }

  Widget _detailLine(String label, String value) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [SizedBox(width: 125, child: Text(label, style: const TextStyle(color: HadirBrand.muted, fontSize: 12))), Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)))]));
}

class _Kpi extends StatelessWidget {
  final String title;
  final String value;
  final String detail;
  const _Kpi(this.title, this.value, this.detail);

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(HadirBrand.radiusMd), border: Border.all(color: Theme.of(context).dividerColor)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
          Text(title, style: const TextStyle(color: HadirBrand.muted, fontSize: 11)),
          const SizedBox(height: 3),
          Text(value, style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 21, fontWeight: FontWeight.w900)),
          Text(detail, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: HadirBrand.muted, fontSize: 9)),
        ]),
      );
}
