import 'dart:typed_data';

import 'package:excel/excel.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

class AdminAuditPage extends StatefulWidget {
  const AdminAuditPage({super.key});

  @override
  State<AdminAuditPage> createState() => _AdminAuditPageState();
}

class _AdminAuditPageState extends State<AdminAuditPage> {
  final _session = HadirSession();
  final _search = TextEditingController();
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  bool _exporting = false;
  String? _error;
  String _result = 'all';
  String _action = 'all';

  static const _actions = <String, String>{
    'login': 'تسجيل دخول',
    'login-failed': 'دخول فاشل',
    'check-in': 'حضور',
    'check-out': 'انصراف',
    'device-bound': 'ربط جهاز',
    'manager-login': 'دخول مدير',
    'manager-login-failed': 'دخول مدير فاشل',
    'supervisor-login': 'دخول مشرف',
    'supervisor-login-failed': 'دخول مشرف فاشل',
    'owner-login': 'دخول مالك',
    'owner-login-failed': 'دخول مالك فاشل',
    'admin-login': 'دخول إداري',
    'admin-login-failed': 'دخول إداري فاشل',
  };

  @override
  void initState() {
    super.initState();
    _search.addListener(_refreshView);
    _load();
  }

  @override
  void dispose() {
    _search.removeListener(_refreshView);
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) {
        throw Exception('انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
      }
      final raw = await HadirApi(token: token).audit(limit: 2000);
      final rows = raw
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
      if (!mounted) return;
      setState(() {
        _rows = rows;
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

  void _refreshView() => setState(() {});

  List<Map<String, dynamic>> get _filtered {
    final q = _search.text.trim().toLowerCase();
    return _rows.where((row) {
      final result = '${row['result'] ?? ''}';
      final action = '${row['action'] ?? ''}';
      if (_result == 'success' && result != 'success') return false;
      if (_result == 'rejected' && result == 'success') return false;
      if (_action != 'all' && action != _action) return false;
      if (q.isEmpty) return true;
      final haystack = [
        row['actorName'],
        row['jobNumber'],
        row['reason'],
        row['deviceId'],
        row['ip'],
      ].map((v) => '$v').join(' ').toLowerCase();
      return haystack.contains(q);
    }).toList();
  }

  String _date(dynamic value) {
    final parsed = DateTime.tryParse('$value');
    if (parsed == null) return '—';
    final local = parsed.toLocal();
    return '${local.year}/${local.month.toString().padLeft(2, '0')}/${local.day.toString().padLeft(2, '0')} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  String _csvCell(dynamic value) {
    final text = '$value'.replaceAll('"', '""');
    return '"$text"';
  }

  List<String> _headers() => [
        'م',
        'الوقت',
        'الموظف',
        'الرقم الوظيفي',
        'العملية',
        'النتيجة',
        'السبب',
        'الجهاز',
        'IP',
        'خط العرض',
        'خط الطول',
        'المسافة (م)',
      ];

  List<dynamic> _exportValues(int number, Map<String, dynamic> row) => [
        number,
        _date(row['timestamp']),
        row['actorName'] ?? '',
        row['jobNumber'] ?? '',
        _actions[row['action']] ?? row['action'] ?? '',
        row['result'] == 'success' ? 'نجاح' : 'رفض',
        row['reason'] ?? '',
        row['deviceId'] ?? '',
        row['ip'] ?? '',
        row['lat'] ?? '',
        row['lng'] ?? '',
        row['distanceMeters'] ?? '',
      ];

  Future<void> _exportCsv() async {
    final rows = _filtered;
    final buffer = StringBuffer('\ufeff');
    buffer.writeln(_headers().map(_csvCell).join(','));
    for (var i = 0; i < rows.length; i++) {
      buffer.writeln(
        _exportValues(i + 1, rows[i]).map(_csvCell).join(','),
      );
    }
    await SharePlus.instance.share(
      ShareParams(
        text: buffer.toString(),
        subject: 'سجل التدقيق - حاضر',
      ),
    );
  }

  Future<void> _exportExcel() async {
    if (_exporting) return;
    final rows = _filtered;
    if (rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final workbook = Excel.createExcel();
      final sheet = workbook['سجل التدقيق'];
      sheet.appendRow(
        _headers().map((value) => TextCellValue(value)).toList(),
      );
      for (var i = 0; i < rows.length; i++) {
        final values = _exportValues(i + 1, rows[i]);
        sheet.appendRow(
          values.map((value) {
            if (value is int) return IntCellValue(value);
            if (value is double) return DoubleCellValue(value);
            return TextCellValue('$value');
          }).toList(),
        );
      }
      final bytes = workbook.encode();
      if (bytes == null || bytes.isEmpty) {
        throw Exception('تعذر إنشاء ملف Excel.');
      }
      await SharePlus.instance.share(
        ShareParams(
          files: [
            XFile.fromData(
              Uint8List.fromList(bytes),
              mimeType:
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              name: 'hadir-audit.xlsx',
            ),
          ],
          subject: 'سجل التدقيق - حاضر',
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'تعذر تصدير Excel: ${HadirApi.errorMessage(error)}',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filtered;
    final success = rows.where((row) => row['result'] == 'success').length;
    final rejected = rows.length - success;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text(
            'سجل التدقيق',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
          actions: [
            IconButton(
              onPressed: _loading ? null : _load,
              tooltip: 'تحديث',
              icon: const Icon(Icons.refresh_rounded),
            ),
            PopupMenuButton<String>(
              enabled: rows.isNotEmpty && !_exporting,
              tooltip: 'تصدير',
              onSelected: (value) {
                if (value == 'csv') {
                  _exportCsv();
                } else {
                  _exportExcel();
                }
              },
              itemBuilder: (context) => const [
                PopupMenuItem(
                  value: 'excel',
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.table_view_rounded),
                    title: Text('تصدير Excel'),
                  ),
                ),
                PopupMenuItem(
                  value: 'csv',
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.description_outlined),
                    title: Text('تصدير CSV'),
                  ),
                ),
              ],
              icon: _exporting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.ios_share_rounded),
            ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
            children: [
              _hero(rows.length, success, rejected),
              const SizedBox(height: 14),
              _filters(),
              const SizedBox(height: 14),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                ),
              if (_error != null) _errorCard(),
              if (!_loading && _error == null && rows.isEmpty) _empty(),
              if (!_loading && _error == null)
                ...rows.asMap().entries.map(
                  (entry) => _rowCard(entry.key + 1, entry.value),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero(int total, int success, int rejected) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [HadirBrand.primaryDark, HadirBrand.primary],
          ),
          borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
          boxShadow: [
            BoxShadow(
              color: HadirBrand.primary.withValues(alpha: .16),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(15),
              ),
              child: const Icon(Icons.fact_check_outlined, color: Colors.white),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'سجل العمليات',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$total سجل • $success نجاح • $rejected رفض',
                    style: const TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _filters() => Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              TextField(
                controller: _search,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search_rounded),
                  hintText: 'بحث بالاسم / الرقم / السبب / الجهاز',
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _result,
                      decoration: const InputDecoration(labelText: 'النتيجة'),
                      items: const [
                        DropdownMenuItem(
                          value: 'all',
                          child: Text('كل النتائج'),
                        ),
                        DropdownMenuItem(
                          value: 'success',
                          child: Text('ناجحة فقط'),
                        ),
                        DropdownMenuItem(
                          value: 'rejected',
                          child: Text('مرفوضة فقط'),
                        ),
                      ],
                      onChanged: (value) =>
                          setState(() => _result = value ?? 'all'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _action,
                      decoration: const InputDecoration(labelText: 'العملية'),
                      items: [
                        const DropdownMenuItem(
                          value: 'all',
                          child: Text('كل العمليات'),
                        ),
                        ..._actions.entries.map(
                          (entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                        ),
                      ],
                      onChanged: (value) =>
                          setState(() => _action = value ?? 'all'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );

  Widget _rowCard(int number, Map<String, dynamic> row) {
    final ok = row['result'] == 'success';
    final lat = double.tryParse('${row['lat']}');
    final lng = double.tryParse('${row['lng']}');
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  '#$number',
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    color: HadirBrand.muted,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${row['actorName'] ?? 'غير معروف'}',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                _badge(ok),
              ],
            ),
            const SizedBox(height: 7),
            Text(
              '${row['jobNumber'] ?? '—'}  •  ${_actions[row['action']] ?? row['action'] ?? 'عملية غير معروفة'}',
              style: const TextStyle(
                color: HadirBrand.muted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _date(row['timestamp']),
              style: const TextStyle(fontSize: 11, color: HadirBrand.muted),
            ),
            if ('${row['reason'] ?? ''}'.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('${row['reason']}', style: const TextStyle(height: 1.35)),
            ],
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                if (lat != null && lng != null)
                  _meta(
                    Icons.location_on_outlined,
                    '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}',
                  ),
                if (row['distanceMeters'] != null)
                  _meta(
                    Icons.straighten_rounded,
                    '${row['distanceMeters']} م',
                  ),
                if ('${row['deviceId'] ?? ''}'.isNotEmpty)
                  _meta(
                    Icons.phone_android_outlined,
                    '${row['deviceId']}',
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _badge(bool ok) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: (ok ? HadirBrand.primary : HadirBrand.danger)
              .withValues(alpha: .1),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          ok ? 'نجاح' : 'رفض',
          style: TextStyle(
            color: ok ? HadirBrand.primary : HadirBrand.danger,
            fontWeight: FontWeight.w900,
            fontSize: 11,
          ),
        ),
      );

  Widget _meta(IconData icon, String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: HadirBrand.panel,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: HadirBrand.muted),
            const SizedBox(width: 5),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 210),
              child: Text(
                text,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 10,
                  color: HadirBrand.muted,
                ),
              ),
            ),
          ],
        ),
      );

  Widget _errorCard() => Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            children: [
              const Icon(
                Icons.error_outline_rounded,
                color: HadirBrand.danger,
                size: 34,
              ),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );

  Widget _empty() {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(30),
        child: Center(
          child: Text(
            'لا توجد سجلات مطابقة للفلاتر الحالية.',
            textAlign: TextAlign.center,
            style: TextStyle(color: HadirBrand.muted),
          ),
        ),
      ),
    );
  }
}
