import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/hadir_brand.dart';
import '../core/session.dart';

class ManagerRequestsPage extends StatefulWidget {
  const ManagerRequestsPage({super.key});

  @override
  State<ManagerRequestsPage> createState() => _ManagerRequestsPageState();
}

class _ManagerRequestsPageState extends State<ManagerRequestsPage> {
  static const _baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  final _session = HadirSession();
  late final Dio _dio;
  bool _loading = true;
  String? _error;
  String? _busy;
  List<Map<String, dynamic>> _requests = [];

  @override
  void initState() {
    super.initState();
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
    ));
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      _dio.options.headers['Authorization'] = 'Bearer $token';
      final responses = await Future.wait<Response<dynamic>>([
        _dio.get('/api/requests'),
        _dio.get('/api/device-rebind-requests'),
      ]);
      final legacy = _asList(responses[0].data).map((row) => _normalize(row, 'request')).toList();
      final rebind = _asList(responses[1].data).map((row) => _normalize(row, 'device-rebind')).toList();
      final merged = [...legacy, ...rebind]
        ..sort((a, b) => _date(b['createdAt']).compareTo(_date(a['createdAt'])));
      if (!mounted) return;
      setState(() { _requests = merged; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is DioException
            ? 'تعذر تحميل الطلبات (${e.response?.statusCode ?? 'شبكة'}).'
            : e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  List<dynamic> _asList(dynamic data) {
    if (data is List) return data;
    if (data is Map && data['requests'] is List) return data['requests'] as List;
    return const [];
  }

  Map<String, dynamic> _normalize(dynamic raw, String type) {
    final row = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return {
      'id': '${row['id'] ?? ''}',
      'type': type == 'device-rebind' ? 'device-rebind' : '${row['type'] ?? 'request'}',
      'employeeName': '${row['employee_name'] ?? row['employeeName'] ?? row['name'] ?? 'موظف'}',
      'jobNumber': '${row['job_number'] ?? row['jobNumber'] ?? '—'}',
      'reason': '${row['reason'] ?? row['note'] ?? 'بدون سبب'}',
      'deviceLabel': row['device_label'] ?? row['deviceLabel'],
      'status': '${row['status'] ?? 'pending'}',
      'createdAt': '${row['created_at'] ?? row['createdAt'] ?? DateTime.now().toIso8601String()}',
    };
  }

  DateTime _date(dynamic value) => DateTime.tryParse('$value') ?? DateTime.fromMillisecondsSinceEpoch(0);

  Future<void> _review(Map<String, dynamic> request, String status) async {
    final id = '${request['id']}';
    final type = '${request['type']}';
    if (id.isEmpty) return;
    setState(() => _busy = id);
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      _dio.options.headers['Authorization'] = 'Bearer $token';
      if (type == 'device-rebind') {
        await _dio.patch('/api/device-rebind-requests', data: {'id': id, 'status': status});
      } else {
        await _dio.patch('/api/requests/${Uri.encodeComponent(id)}', data: {'status': status});
      }
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is DioException ? 'تعذر تحديث الطلب.' : e.toString().replaceFirst('Exception: ', ''))));
      setState(() => _busy = null);
    }
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'permission': return 'استئذان';
      case 'leave': return 'إجازة';
      case 'device-rebind': return 'فك ربط الهاتف';
      case 'checkout': return 'انصراف';
      default: return 'طلب موظف';
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'pending': return 'قيد المراجعة';
      case 'approved': return 'موافق عليه';
      case 'rejected': return 'مرفوض';
      case 'confirmed': return 'تم التأكيد';
      default: return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = _requests.where((r) => r['status'] == 'pending').toList();
    final history = _requests.where((r) => r['status'] != 'pending').take(50).toList();
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('طلبات الموظفين', style: TextStyle(fontWeight: FontWeight.w900)),
          actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded))],
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _errorView()
                : RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(18), children: [
                    _hero(pending.length),
                    const SizedBox(height: 16),
                    if (pending.isEmpty)
                      const _Empty(text: 'لا توجد طلبات بانتظار المراجعة.')
                    else ...[
                      Text('الطلبات الجديدة  ${pending.length}', style: const TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      ...pending.map(_pendingCard),
                    ],
                    if (history.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      const Text('السجل السابق', style: TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      ...history.map(_historyCard),
                    ],
                  ])),
      ),
    );
  }

  Widget _hero(int pending) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [HadirBrand.primary, HadirBrand.primaryDark]),
          borderRadius: BorderRadius.circular(HadirBrand.radiusXl),
        ),
        child: Row(children: [
          const Icon(Icons.inbox_rounded, color: Colors.white, size: 32),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('طلبات بانتظار المراجعة', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 5),
            Text('$pending طلب يحتاج إلى إجراء إداري.', style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ])),
          Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(14)), child: Text('$pending', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
        ]),
      );

  Widget _pendingCard(Map<String, dynamic> request) {
    final id = '${request['id']}';
    final busy = _busy == id;
    final rebind = request['type'] == 'device-rebind';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(padding: const EdgeInsets.all(15), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('${request['employeeName']} · ${request['jobNumber']}', style: const TextStyle(fontWeight: FontWeight.w900))),
          Text(_typeLabel('${request['type']}'), style: TextStyle(color: rebind ? HadirBrand.warning : HadirBrand.primary, fontWeight: FontWeight.w800, fontSize: 12)),
        ]),
        const SizedBox(height: 7),
        Text('${request['reason']}', style: const TextStyle(fontSize: 12, color: HadirBrand.muted)),
        if (rebind && request['deviceLabel'] != null) ...[const SizedBox(height: 5), Text('الهاتف المطلوب: ${request['deviceLabel']}', style: const TextStyle(fontSize: 11))],
        const SizedBox(height: 5),
        Text(_date(request['createdAt']).toLocal().toString(), style: const TextStyle(fontSize: 10, color: HadirBrand.muted)),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: FilledButton(onPressed: busy ? null : () => _review(request, 'approved'), child: Text(busy ? 'جاري…' : 'موافقة'))),
          const SizedBox(width: 8),
          Expanded(child: OutlinedButton(onPressed: busy ? null : () => _review(request, 'rejected'), child: const Text('رفض'))),
        ]),
      ])),
    );
  }

  Widget _historyCard(Map<String, dynamic> request) => Card(
        margin: const EdgeInsets.only(bottom: 7),
        child: ListTile(
          title: Text('${request['employeeName']} · ${request['jobNumber']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          subtitle: Text('طلب ${_typeLabel('${request['type']}')} · ${request['reason']}', style: const TextStyle(fontSize: 11)),
          trailing: Text(_statusLabel('${request['status']}'), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800)),
        ),
      );

  Widget _errorView() => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.cloud_off_rounded, size: 48),
        const SizedBox(height: 12),
        Text(_error!, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        FilledButton(onPressed: _load, child: const Text('إعادة المحاولة')),
      ]));
}

class _Empty extends StatelessWidget {
  final String text;
  const _Empty({required this.text});
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(24), child: Center(child: Text(text, style: const TextStyle(color: HadirBrand.muted)))));
}
