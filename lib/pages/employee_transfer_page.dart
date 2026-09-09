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
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: Theme.of(context).colorScheme.outlineVariant), color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .45)),
        child: Row(children: [Icon(icon, size: 20), const SizedBox(width: 10), Expanded(child: Text(label)), Text(value, style: const TextStyle(fontWeight: FontWeight.w900))]),
      );

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('نقل الموظفين الذكي'), centerTitle: false),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(16), children: [
                Card(child: Padding(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('استيراد وتصدير الموظفين', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  const Text('يدعم CSV بالعناوين العربية أو الإنجليزية، مع معاينة قبل الإضافة والتحقق من الاسم والرقم الوظيفي والتكرارات.'),
                  const SizedBox(height: 16),
                  Row(children: [Expanded(child: _metric('الموظفون الحاليون', '${_employees.length}', Icons.groups_rounded)), const SizedBox(width: 10), Expanded(child: _metric('حقول النقل', '${EmployeeTransfer.headers.length}', Icons.table_chart_rounded))]),
                  const SizedBox(height: 16),
                  FilledButton.icon(onPressed: _export, icon: const Icon(Icons.ios_share_rounded), label: const Text('تصدير الموظفين CSV')),
                ]))),
                const SizedBox(height: 12),
                Card(child: Padding(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('استيراد CSV', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 6),
                  const Text('الصق محتوى CSV هنا. سيتم اكتشاف الأعمدة تلقائيًا ثم عرض المعاينة قبل الإضافة إلى النظام.'),
                  const SizedBox(height: 12),
                  TextField(controller: _csvController, minLines: 8, maxLines: 16, textDirection: TextDirection.ltr, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'الاسم,الرقم الوظيفي,نوع الدوام,...')),
                  const SizedBox(height: 10),
                  FilledButton.icon(onPressed: _busy ? null : _previewImport, icon: const Icon(Icons.auto_awesome_rounded), label: const Text('تحليل ومعاينة')),
                  if (preview != null) ...[
                    const SizedBox(height: 14),
                    _metric('صفوف صالحة', '${preview.validRows}', Icons.check_circle_outline_rounded),
                    const SizedBox(height: 8),
                    _metric('صفوف غير صالحة', '${preview.invalidRows}', Icons.error_outline_rounded),
                    const SizedBox(height: 8),
                    _metric('أرقام وظيفية مكررة', '${preview.duplicateJobNumbers.length}', Icons.content_copy_rounded),
                    const SizedBox(height: 12),
                    FilledButton.icon(onPressed: _busy || preview.rows.isEmpty ? null : _import, icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.cloud_upload_rounded), label: Text(_busy ? 'جاري الاستيراد…' : 'تأكيد الاستيراد')),
                  ],
                ]))),
                if (_message != null) ...[const SizedBox(height: 12), Card(child: ListTile(leading: const Icon(Icons.check_circle_rounded), title: Text('$_message')))],
                if (_error != null) ...[const SizedBox(height: 12), Card(child: ListTile(leading: const Icon(Icons.error_rounded), title: Text('$_error')))],
              ]),
      ),
    );
  }
}
