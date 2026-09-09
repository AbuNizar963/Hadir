import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/employee_transfer.dart';
import '../core/session.dart';

class EmployeeTransferPage extends StatefulWidget {
  const EmployeeTransferPage({super.key});

  @override
  State<EmployeeTransferPage> createState() => _EmployeeTransferPageState();
}

class _EmployeeTransferPageState extends State<EmployeeTransferPage> {
  static const _baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  final _session = HadirSession();
  final _csvController = TextEditingController();
  late final Dio _dio;
  List<Map<String, dynamic>> _employees = [];
  EmployeeTransferPreview? _preview;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String? _message;

  @override
  void initState() {
    super.initState();
    _dio = Dio(BaseOptions(baseUrl: _baseUrl, connectTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(seconds: 20), sendTimeout: const Duration(seconds: 20), headers: const {'Accept': 'application/json'}));
    _load();
  }

  @override
  void dispose() {
    _csvController.dispose();
    super.dispose();
  }

  String _errorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      return 'تعذر إكمال العملية (${error.response?.statusCode ?? 'شبكة'}).';
    }
    return error.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      _dio.options.headers['Authorization'] = 'Bearer $token';
      final response = await _dio.get('/api/employees');
      final data = response.data;
      final list = data is List ? data : data is Map && data['employees'] is List ? data['employees'] : data is Map && data['data'] is List ? data['data'] : const [];
      if (!mounted) return;
      setState(() {
        _employees = list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() { _loading = false; _error = _errorMessage(error); });
    }
  }

  Set<String> get _existingJobs => _employees.map((e) => '${e['jobNumber'] ?? ''}'.trim().toLowerCase()).where((e) => e.isNotEmpty).toSet();

  List<EmployeeTransferRow> get _exportRows => _employees.map((e) {
        final specialties = e['specialties'];
        return EmployeeTransferRow(
          name: '${e['name'] ?? ''}',
          jobNumber: '${e['jobNumber'] ?? ''}',
          status: '${e['status'] ?? 'active'}',
          scheduleType: '${e['scheduleType'] ?? 'ADMIN'}',
          workStartTime: '${e['workStartTime'] ?? '08:00'}',
          workEndTime: '${e['workEndTime'] ?? '16:00'}',
          gracePeriodMinutes: int.tryParse('${e['gracePeriodMinutes'] ?? 0}') ?? 0,
          workDays: e['workDays'] is List ? (e['workDays'] as List).map((v) => int.tryParse('$v')).whereType<int>().toList() : const [0, 1, 2, 3, 4],
          rotationDaysOn: int.tryParse('${e['rotationDaysOn'] ?? 7}') ?? 7,
          rotationDaysOff: int.tryParse('${e['rotationDaysOff'] ?? 7}') ?? 7,
          rotationStartDate: '${e['rotationStartDate'] ?? ''}'.trim().isEmpty ? null : '${e['rotationStartDate']}',
          locationId: '${e['locationId'] ?? ''}'.trim().isEmpty ? null : '${e['locationId']}',
          specialties: specialties is List ? specialties.map((v) => '$v').toList() : ['${specialties ?? 'general'}'],
          isVip: e['isVip'] == true,
          autoCheckIn: e['autoCheckIn'] == true,
          autoCheckOut: e['autoCheckOut'] == true,
        );
      }).where((e) => e.name.trim().isNotEmpty && e.jobNumber.trim().isNotEmpty).toList();

  Future<void> _export() async {
    try {
      final csv = EmployeeTransfer.toCsv(_exportRows);
      await SharePlus.instance.share(ShareParams(text: csv, subject: 'HADIR - تصدير الموظفين'));
    } catch (error) {
      if (mounted) setState(() => _error = _errorMessage(error));
    }
  }

  void _previewImport() {
    try {
      final text = _csvController.text.trim();
      if (text.isEmpty) throw const FormatException('ألصق بيانات CSV أولًا.');
      final rows = EmployeeTransfer.decodeCsv(text);
      final preview = EmployeeTransfer.previewRows(rows, existingJobNumbers: _existingJobs);
      setState(() { _preview = preview; _error = null; _message = 'تم تحليل الملف: ${preview.validRows} صف صالح.'; });
    } catch (error) {
      setState(() { _preview = null; _error = _errorMessage(error); _message = null; });
    }
  }

  Future<void> _import() async {
    final preview = _preview;
    if (preview == null || preview.rows.isEmpty) return;
    setState(() { _busy = true; _error = null; _message = null; });
    var added = 0;
    var failed = 0;
    try {
      for (final row in preview.rows) {
        if (_existingJobs.contains(row.jobNumber.toLowerCase())) continue;
        try {
          await _dio.post('/api/employees', data: row.toJson());
          added++;
        } catch (_) {
          failed++;
        }
      }
      await _load();
      if (!mounted) return;
      setState(() { _busy = false; _preview = null; _csvController.clear(); _message = 'اكتمل الاستيراد: أضيف $added موظف${failed == 0 ? '' : '، وفشل $failed'}.'; });
    } catch (error) {
      if (!mounted) return;
      setState(() { _busy = false; _error = _errorMessage(error); });
    }
  }

  Widget _metric(String label, String value, IconData icon) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: Theme.of(context).colorScheme.outlineVariant)),
        child: Row(children: [Icon(icon, size: 20), const SizedBox(width: 10), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label), Text(value, style: const TextStyle(fontWeight: FontWeight.w800))])]),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('نقل الموظفين الذكي')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              Wrap(spacing: 10, runSpacing: 10, children: [_metric('الموظفون', '${_employees.length}', Icons.groups_rounded), _metric('جاهز للتصدير', '${_exportRows.length}', Icons.file_upload_rounded)]),
              const SizedBox(height: 16),
              if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
              if (_message != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_message!)),
              FilledButton.icon(onPressed: _busy ? null : _export, icon: const Icon(Icons.share_rounded), label: const Text('تصدير الموظفين CSV')),
              const SizedBox(height: 16),
              TextField(controller: _csvController, maxLines: 10, decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'بيانات CSV', hintText: 'ألصق بيانات الموظفين هنا')),
              const SizedBox(height: 10),
              OutlinedButton.icon(onPressed: _busy ? null : _previewImport, icon: const Icon(Icons.preview_rounded), label: const Text('معاينة الاستيراد')),
              if (_preview != null) ...[
                const SizedBox(height: 12),
                Text('صالح: ${_preview!.validRows} • أخطاء: ${_preview!.invalidRows} • إجمالي: ${_preview!.rows.length}', style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                FilledButton.icon(onPressed: _busy || _preview!.validRows == 0 ? null : _import, icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.download_done_rounded), label: const Text('استيراد الصفوف الصالحة')),
              ],
            ]),
    );
  }
}
