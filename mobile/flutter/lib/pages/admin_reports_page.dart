import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';

const _reportBrand = Color(0xFF0B6B5A);
const _reportInk = Color(0xFF17322C);
const _reportMuted = Color(0xFF70817B);
const _reportSoft = Color(0xFFEAF4F0);

class AdminReportsPage extends StatefulWidget {
  const AdminReportsPage({super.key});
  @override State<AdminReportsPage> createState() => _AdminReportsPageState();
}

class _AdminReportsPageState extends State<AdminReportsPage> {
  HadirApi? _api;
  DateTime _from = DateTime(DateTime.now().year, DateTime.now().month, 1);
  DateTime _to = DateTime.now();
  String? _employeeId;
  List<dynamic> _employees = [];
  Map<String, dynamic>? _report;
  Map<String, dynamic>? _detail;
  bool _loading = false;
  String? _error;

  String _date(DateTime value) => '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  String _fmtMinutes(dynamic value) { final minutes = (value is num ? value.toInt() : int.tryParse('$value') ?? 0).clamp(0, 999999); return '${minutes ~/ 60}س ${minutes % 60}د'; }
  int _num(Map<String, dynamic> map, String key) => map[key] is num ? (map[key] as num).toInt() : int.tryParse('${map[key]}') ?? 0;
  String _status(String value) => const {'PRESENT': 'حاضر', 'LATE': 'متأخر', 'ABSENT': 'غياب', 'LEAVE': 'إجازة', 'PERMISSION': 'استئذان', 'REST': 'راحة', 'NOT_STARTED': 'لم يبدأ', 'INVALID': 'غير صالح'}[value] ?? value;

  @override
  void initState() { super.initState(); _init(); }

  Future<void> _init() async {
    try {
      final token = await HadirSession().adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      final api = HadirApi(token: token);
      final response = await api.dio.get('/api/employees');
      if (!mounted) return;
      setState(() { _api = api; _employees = response.data is List ? List<dynamic>.from(response.data as List) : []; });
      await _loadReport();
    } catch (e) { if (mounted) setState(() => _error = HadirApi.errorMessage(e)); }
  }

  Future<void> _loadReport() async {
    final api = _api;
    if (api == null) return;
    if (_from.isAfter(_to)) { setState(() => _error = 'حدد فترة زمنية صحيحة.'); return; }
    setState(() { _loading = true; _error = null; _detail = null; });
    try {
      final report = await api.professionalAttendanceReport(from: _date(_from), to: _date(_to), employeeId: _employeeId);
      if (mounted) setState(() { _report = report; _loading = false; });
    } catch (e) { if (mounted) setState(() { _loading = false; _error = HadirApi.errorMessage(e); }); }
  }

  Future<void> _pickDate(bool from) async {
    final selected = await showDatePicker(context: context, initialDate: from ? _from : _to, firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 365)), locale: const Locale('ar'));
    if (selected == null) return;
    setState(() { if (from) _from = selected; else _to = selected; });
  }

  Future<void> _openDetail(Map<String, dynamic> row) async {
    final api = _api; final day = '${row['attendanceDay'] ?? ''}'; final id = '${row['employeeId'] ?? ''}';
    if (api == null || day.isEmpty || id.isEmpty) return;
    setState(() { _detail = null; _loading = true; });
    try { final detail = await api.professionalAttendanceDrilldown(attendanceDay: day, employeeId: id); if (mounted) setState(() { _detail = detail; _loading = false; }); }
    catch (e) { if (mounted) setState(() { _loading = false; _error = HadirApi.errorMessage(e); }); }
  }

  @override
  Widget build(BuildContext context) {
    final summary = _report?['summary'] is Map ? Map<String, dynamic>.from(_report!['summary'] as Map) : <String, dynamic>{};
    final rows = _report?['rows'] is List ? List<dynamic>.from(_report!['rows'] as List) : <dynamic>[];
    final analytics = _report?['analytics'] is Map ? Map<String, dynamic>.from(_report!['analytics'] as Map) : <String, dynamic>{};
    final exceptions = analytics['exceptions'] is List ? List<dynamic>.from(analytics['exceptions'] as List) : <dynamic>[];
    return Scaffold(
      appBar: AppBar(title: const Text('التقارير العالمية', style: TextStyle(fontWeight: FontWeight.w900)), actions: [IconButton(onPressed: _loadReport, icon: const Icon(Icons.refresh_rounded))]),
      body: RefreshIndicator(onRefresh: _loadReport, child: ListView(padding: const EdgeInsets.fromLTRB(16, 10, 16, 32), children: [
        Container(padding: const EdgeInsets.all(19), decoration: BoxDecoration(gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_reportBrand, Color(0xFF084F44)]), borderRadius: BorderRadius.circular(25)), child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('لوحة الحضور التنفيذية', style: TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900)), SizedBox(height: 6), Text('التقرير الرسمي من طبقة بيانات HADIR Web، بدون إعادة حساب محلي للدوام.', style: TextStyle(color: Colors.white70, height: 1.5, fontSize: 12))])),
        const SizedBox(height: 14),
        Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(children: [Row(children: [Expanded(child: _dateButton('من', _from, true)), const SizedBox(width: 8), Expanded(child: _dateButton('إلى', _to, false))]), const SizedBox(height: 10), DropdownButtonFormField<String>(initialValue: _employeeId, decoration: const InputDecoration(labelText: 'الموظف', prefixIcon: Icon(Icons.person_outline_rounded)), items: [const DropdownMenuItem<String>(child: Text('كل الموظفين')), ..._employees.map((raw) { final e = Map<String, dynamic>.from(raw as Map); return DropdownMenuItem<String>(value: '${e['id']}', child: Text('${e['name'] ?? 'موظف'} · ${e['jobNumber'] ?? '—'}')); })], onChanged: (value) => setState(() => _employeeId = value)), const SizedBox(height: 10), FilledButton.icon(onPressed: _loading ? null : _loadReport, icon: _loading ? const SizedBox.square(dimension: 19, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.analytics_rounded), label: Text(_loading ? 'جاري بناء التقرير...' : 'تحديث التقرير'))]))),
        if (_error != null) ...[const SizedBox(height: 10), Card(color: const Color(0xFFFFF3F1), child: Padding(padding: const EdgeInsets.all(14), child: Text(_error!, style: const TextStyle(color: Color(0xFF8D332C)))))],
        if (_report != null) ...[
          const SizedBox(height: 14),
          GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, childAspectRatio: 1.55, crossAxisSpacing: 8, mainAxisSpacing: 8, children: [_Kpi('الموظفون', '${_num(summary, 'employees')}', 'موظف'), _Kpi('الحضور', '${_num(summary, 'present') + _num(summary, 'late')}', 'معدل ${summary['attendanceRate'] ?? 0}%'), _Kpi('الساعات', _fmtMinutes(summary['workedMinutes']), 'متوقع ${_fmtMinutes(summary['expectedMinutes'])}'), _Kpi('الاستثناءات', '${exceptions.length}', 'تأخر ${_num(summary, 'lateMinutes')}د')]),
          const SizedBox(height: 16), _sectionTitle('السجل اليومي الرسمي', '${_report!['from'] ?? ''} → ${_report!['to'] ?? ''}'),
          if (rows.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('لا توجد بيانات ضمن الفترة المحددة.')))),
          ...rows.map((raw) { final row = Map<String, dynamic>.from(raw as Map); final status = '${row['status'] ?? ''}'; return Card(child: ListTile(onTap: () => _openDetail(row), leading: Container(width: 43, height: 43, decoration: BoxDecoration(color: _reportSoft, borderRadius: BorderRadius.circular(13)), child: Icon(status == 'ABSENT' ? Icons.event_busy_rounded : Icons.event_available_rounded, color: _reportBrand)), title: Text('${row['employeeName'] ?? 'موظف'}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${row['attendanceDay'] ?? '—'} · ${row['jobNumber'] ?? '—'}\n${_status(status)} · حضور ${_clock(row['checkInAt'])} · انصراف ${_clock(row['checkOutAt'])}'), isThreeLine: true, trailing: const Icon(Icons.chevron_left_rounded))); }),
          if (_detail != null) _detailCard(_detail!),
        ],
      ])),
    );
  }

  String _clock(dynamic value) { if (value == null || '$value'.isEmpty) return '—'; final parsed = DateTime.tryParse('$value'); return parsed == null ? '$value' : '${parsed.toLocal().hour.toString().padLeft(2, '0')}:${parsed.toLocal().minute.toString().padLeft(2, '0')}'; }
  Widget _dateButton(String label, DateTime value, bool from) => OutlinedButton.icon(onPressed: () => _pickDate(from), icon: const Icon(Icons.calendar_today_outlined, size: 17), label: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 10)), Text(_date(value), style: const TextStyle(fontWeight: FontWeight.w800))]));
  Widget _sectionTitle(String title, String subtitle) => Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: _reportInk)), Text(subtitle, style: const TextStyle(fontSize: 11, color: _reportMuted))])), const Icon(Icons.fact_check_outlined, color: _reportBrand)]);
  Widget _detailCard(Map<String, dynamic> detail) { final fact = detail['fact'] is Map ? Map<String, dynamic>.from(detail['fact'] as Map) : <String, dynamic>{}; final trace = detail['trace'] is Map ? Map<String, dynamic>.from(detail['trace'] as Map) : <String, dynamic>{}; final attendanceIds = trace['attendanceEventIds'] is List ? (trace['attendanceEventIds'] as List).length : 0; final requestIds = trace['requestIds'] is List ? (trace['requestIds'] as List).length : 0; final auditIds = trace['auditIds'] is List ? (trace['auditIds'] as List).length : 0; return Card(margin: const EdgeInsets.only(top: 8), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [const Icon(Icons.manage_search_rounded, color: _reportBrand), const SizedBox(width: 8), Expanded(child: Text('تفصيل ${fact['employeeName'] ?? ''} · ${fact['attendanceDay'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)))]), const Divider(height: 24), _detailLine('الحالة', _status('${fact['status'] ?? '—'}')), _detailLine('الجدول', '${fact['scheduleType'] ?? '—'} · ${fact['scheduledStart'] ?? '—'} → ${fact['scheduledEnd'] ?? '—'}'), _detailLine('العمل', _fmtMinutes(fact['workedMinutes'])), _detailLine('التأخر / المبكر / الإضافي', '${fact['lateMinutes'] ?? 0}د / ${fact['earlyLeaveMinutes'] ?? 0}د / ${fact['overtimeMinutes'] ?? 0}د'), _detailLine('مصدر الحساب', '${fact['calculationSource'] ?? trace['sourceOfTruth'] ?? '—'}'), _detailLine('إصدار الحساب', '${fact['calculationVersion'] ?? '—'}'), _detailLine('التتبع', 'حضور $attendanceIds · طلبات $requestIds · تدقيق $auditIds'), const SizedBox(height: 6), const Text('التفصيل للقراءة فقط؛ لا يغيّر السجل الخام.', style: TextStyle(color: _reportMuted, fontSize: 11))]))); }
  Widget _detailLine(String label, String value) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [SizedBox(width: 125, child: Text(label, style: const TextStyle(color: _reportMuted, fontSize: 12))), Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700, color: _reportInk, fontSize: 12)))]));
}

class _Kpi extends StatelessWidget { final String title; final String value; final String detail; const _Kpi(this.title, this.value, this.detail); @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(13), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE2E9E6))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(title, style: const TextStyle(color: _reportMuted, fontSize: 11)), const SizedBox(height: 3), Text(value, style: const TextStyle(color: _reportInk, fontSize: 21, fontWeight: FontWeight.w900)), Text(detail, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _reportMuted, fontSize: 9))])); }
