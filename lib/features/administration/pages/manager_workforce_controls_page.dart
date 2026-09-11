import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/session.dart';

/// Dedicated manager workforce controls matching the reference model.
/// VIP, automatic check-in, and automatic check-out are independent flags.
class ManagerWorkforceControlsPage extends StatefulWidget {
  const ManagerWorkforceControlsPage({super.key});

  @override
  State<ManagerWorkforceControlsPage> createState() => _ManagerWorkforceControlsPageState();
}

class _ManagerWorkforceControlsPageState extends State<ManagerWorkforceControlsPage> {
  static const _baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  final _session = HadirSession();
  late final Dio _dio;

  bool _loading = true;
  String? _error;
  String _query = '';
  List<Map<String, dynamic>> _employees = [];
  Map<String, Map<String, dynamic>> _controls = {};
  String? _busyEmployee;
  String? _busyField;

  @override
  void initState() {
    super.initState();
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: const {'Accept': 'application/json'},
    ));
    _load();
  }

  String _errorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      return 'تعذر إكمال العملية (${error.response?.statusCode ?? 'شبكة'}).';
    }
    return error.toString().replaceFirst('Exception: ', '');
  }

  List<Map<String, dynamic>> _asList(dynamic data) {
    if (data is List) {
      return data.whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
    }
    if (data is Map) {
      for (final key in const ['data', 'items', 'results', 'employees']) {
        final value = data[key];
        if (value is List) {
          return value.whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
        }
      }
    }
    return [];
  }

  Map<String, Map<String, dynamic>> _asControls(dynamic data) {
    final result = <String, Map<String, dynamic>>{};
    for (final item in _asList(data)) {
      final id = '${item['id'] ?? item['employeeId'] ?? ''}'.trim();
      if (id.isNotEmpty) result[id] = item;
    }
    return result;
  }

  Future<void> _load({bool spinner = true}) async {
    if (spinner && mounted) setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      _dio.options.headers['Authorization'] = 'Bearer $token';
      final results = await Future.wait([
        _dio.get('/api/employees'),
        _dio.get('/api/manager/workforce-controls'),
      ]);
      if (!mounted) return;
      setState(() {
        _employees = _asList(results[0].data);
        _controls = _asControls(results[1].data);
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() { _loading = false; _error = _errorMessage(error); });
    }
  }

  bool _value(Map<String, dynamic> employee, String field) {
    final id = '${employee['id'] ?? ''}';
    final control = _controls[id];
    final value = control?[field] ?? employee[field];
    return value == true;
  }

  Future<void> _toggle(Map<String, dynamic> employee, String field) async {
    final id = '${employee['id'] ?? ''}';
    if (id.isEmpty) return;
    final next = !_value(employee, field);
    setState(() { _busyEmployee = id; _busyField = field; });
    try {
      await _dio.patch('/api/workforce/live', data: {
        'employeeId': id,
        field: next,
      });
      await _load(spinner: false);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    } finally {
      if (mounted) setState(() { _busyEmployee = null; _busyField = null; });
    }
  }

  Widget _switch(Map<String, dynamic> employee, String field, String label, IconData icon) {
    final id = '${employee['id'] ?? ''}';
    final selected = _value(employee, field);
    final busy = _busyEmployee == id && _busyField == field;
    return Expanded(
      child: OutlinedButton.icon(
        onPressed: busy ? null : () => _toggle(employee, field),
        icon: busy ? const SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2)) : Icon(icon, size: 16),
        label: Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900)),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 46),
          padding: const EdgeInsets.symmetric(horizontal: 4),
          foregroundColor: selected ? Theme.of(context).colorScheme.primary : Theme.of(context).hintColor,
          side: BorderSide(color: selected ? Theme.of(context).colorScheme.primary.withValues(alpha: .45) : Theme.of(context).dividerColor),
          backgroundColor: selected ? Theme.of(context).colorScheme.primary.withValues(alpha: .06) : null,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
    );
  }

  Widget _card(Map<String, dynamic> employee) {
    final name = '${employee['name'] ?? 'بدون اسم'}';
    final job = '${employee['jobNumber'] ?? ''}';
    final active = '${employee['status'] ?? 'active'}' == 'active';
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(11),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            CircleAvatar(
              radius: 19,
              backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: .10),
              child: Text(name.trim().isEmpty ? 'م' : name.trim().substring(0, 1), style: TextStyle(fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)),
            ),
            const SizedBox(width: 9),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900)),
              Text(job, style: TextStyle(fontSize: 9, color: Theme.of(context).hintColor)),
            ])),
            Icon(active ? Icons.check_circle_rounded : Icons.pause_circle_rounded, size: 18, color: active ? Colors.green : Colors.red),
          ]),
          const SizedBox(height: 9),
          Row(children: [
            _switch(employee, 'isVip', 'VIP', Icons.star_rounded),
            const SizedBox(width: 5),
            _switch(employee, 'autoCheckIn', 'تحضير تلقائي', Icons.login_rounded),
            const SizedBox(width: 5),
            _switch(employee, 'autoCheckOut', 'انصراف تلقائي', Icons.logout_rounded),
          ]),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final list = _employees.where((e) {
      final name = '${e['name'] ?? ''}'.toLowerCase();
      final job = '${e['jobNumber'] ?? ''}'.toLowerCase();
      return query.isEmpty || name.contains(query) || job.contains(query);
    }).toList();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.fromLTRB(14, 12, 14, 30), children: [
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('WORKFORCE CONTROLS', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)),
              const SizedBox(height: 3),
              const Text('قوى العمل', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
              const SizedBox(height: 2),
              Text('تحكم مستقل في VIP والتحضير التلقائي والانصراف التلقائي.', style: TextStyle(fontSize: 10, color: Theme.of(context).hintColor)),
              const SizedBox(height: 10),
              TextField(onChanged: (v) => setState(() => _query = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'بحث بالاسم أو الرقم', isDense: true)),
            ])),
          ),
          if (_loading) const Padding(padding: EdgeInsets.all(45), child: Center(child: CircularProgressIndicator()))
          else if (_error != null) Padding(padding: const EdgeInsets.all(24), child: Column(children: [Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 8), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة'))]))
          else if (list.isEmpty) const Padding(padding: EdgeInsets.all(40), child: Center(child: Text('لا توجد نتائج')))
          else Padding(padding: const EdgeInsets.only(top: 10), child: LayoutBuilder(builder: (context, c) {
            final columns = c.maxWidth > 900 ? 3 : c.maxWidth > 600 ? 2 : 1;
            return GridView.builder(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), itemCount: list.length, gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: columns, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: columns == 1 ? 2.25 : 1.65), itemBuilder: (_, i) => _card(list[i]));
          })),
        ]),
      ),
    );
  }
}
