import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/session.dart';

/// Dedicated manager workforce controls matching the reference model.
///
/// VIP, automatic check-in, and automatic check-out remain independent
/// server-backed flags. Owner-only direct attendance actions are also exposed.
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
  bool _owner = false;
  String? _error;
  String _query = '';
  List<Map<String, dynamic>> _employees = [];
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
      for (final key in const ['employees', 'data', 'items', 'results']) {
        final value = data[key];
        if (value is List) {
          return value.whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
        }
      }
    }
    return [];
  }

  bool _isOwner(dynamic data) {
    if (data is Map) {
      final user = data['user'];
      final profile = data['profile'];
      final role = data['role'] ??
          (user is Map ? user['role'] : null) ??
          (profile is Map ? profile['role'] : null);
      return '${role ?? ''}'.toLowerCase() == 'owner';
    }
    return false;
  }

  Future<void> _load({bool spinner = true}) async {
    if (spinner && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      _dio.options.headers['Authorization'] = 'Bearer $token';

      final results = await Future.wait([
        _dio.get('/api/me'),
        _dio.get('/api/workforce/live'),
      ]);
      if (!mounted) return;
      setState(() {
        _owner = _isOwner(results[0].data);
        _employees = _asList(results[1].data);
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _errorMessage(error);
        });
      }
    }
  }

  bool _value(Map<String, dynamic> employee, String field) {
    final value = employee[field];
    return value == true || value == 1 || value == '1';
  }

  String _schedule(Map<String, dynamic> employee) {
    if ('${employee['scheduleType'] ?? ''}'.toUpperCase() == 'ROTATION') {
      final on = employee['rotationDaysOn'] ?? 0;
      final off = employee['rotationDaysOff'] ?? 0;
      return '$on عمل / $off راحة';
    }
    final start = employee['workStartTime'] ?? '--:--';
    final end = employee['workEndTime'] ?? '--:--';
    return '$start → $end';
  }

  Future<void> _toggle(Map<String, dynamic> employee, String field) async {
    if (!_owner) return;
    final id = '${employee['id'] ?? ''}';
    if (id.isEmpty) return;
    final next = !_value(employee, field);
    setState(() {
      _busyEmployee = id;
      _busyField = field;
    });
    try {
      final response = await _dio.patch('/api/workforce/live', data: {
        'employeeId': id,
        field: next,
      });
      final payload = response.data;
      final updated = payload is Map ? payload['employee'] : null;
      if (updated is Map && mounted) {
        final row = Map<String, dynamic>.from(updated);
        setState(() {
          _employees = _employees.map((e) => e['id'] == id ? {...e, ...row} : e).toList();
        });
      } else {
        await _load(spinner: false);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
      }
    } finally {
      if (mounted) {
        setState(() {
          _busyEmployee = null;
          _busyField = null;
        });
      }
    }
  }

  Future<void> _direct(Map<String, dynamic> employee, String type) async {
    if (!_owner) return;
    final id = '${employee['id'] ?? ''}';
    if (id.isEmpty) return;
    setState(() {
      _busyEmployee = id;
      _busyField = type;
    });
    try {
      await _dio.post('/api/workforce/live', data: {
        'employeeId': id,
        'type': type,
      });
      await _load(spinner: false);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
      }
    } finally {
      if (mounted) {
        setState(() {
          _busyEmployee = null;
          _busyField = null;
        });
      }
    }
  }

  Widget _switch(Map<String, dynamic> employee, String field, String label, IconData icon) {
    final id = '${employee['id'] ?? ''}';
    final selected = _value(employee, field);
    final busy = _busyEmployee == id && _busyField == field;
    return Expanded(
      child: OutlinedButton.icon(
        onPressed: !_owner || busy ? null : () => _toggle(employee, field),
        icon: busy
            ? const SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2))
            : Icon(icon, size: 16),
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

  Widget _infoBox(String title, String value) {
    return Container(
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(fontSize: 9, color: Theme.of(context).hintColor)),
        const SizedBox(height: 2),
        Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800)),
      ]),
    );
  }

  Widget _card(Map<String, dynamic> employee) {
    final name = '${employee['name'] ?? 'بدون اسم'}';
    final job = '${employee['jobNumber'] ?? ''}';
    final id = '${employee['id'] ?? ''}';
    final active = '${employee['status'] ?? 'active'}' == 'active';
    final directInBusy = _busyEmployee == id && _busyField == 'check-in';
    final directOutBusy = _busyEmployee == id && _busyField == 'check-out';

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
            if (_value(employee, 'isVip'))
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), color: Colors.amber.withValues(alpha: .10), border: Border.all(color: Colors.amber.withValues(alpha: .40))),
                child: const Text('★ VIP', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900)),
              ),
            const SizedBox(width: 5),
            Icon(active ? Icons.check_circle_rounded : Icons.pause_circle_rounded, size: 18, color: active ? Colors.green : Colors.red),
          ]),
          const SizedBox(height: 9),
          Row(children: [
            Expanded(child: _infoBox('المناوبة', _schedule(employee))),
            const SizedBox(width: 6),
            Expanded(child: _infoBox('النوع', '${employee['scheduleType'] ?? ''}'.toUpperCase() == 'ROTATION' ? 'تناوبي' : 'إداري')),
          ]),
          const SizedBox(height: 9),
          Row(children: [
            _switch(employee, 'isVip', 'VIP', Icons.star_rounded),
            const SizedBox(width: 5),
            _switch(employee, 'autoCheckIn', 'تحضير تلقائي', Icons.login_rounded),
            const SizedBox(width: 5),
            _switch(employee, 'autoCheckOut', 'انصراف تلقائي', Icons.logout_rounded),
          ]),
          if (_owner) ...[
            const SizedBox(height: 7),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: directInBusy ? null : () => _direct(employee, 'check-in'),
                  icon: directInBusy ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.login_rounded, size: 16),
                  label: const Text('تحضير مباشر', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900)),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: directOutBusy ? null : () => _direct(employee, 'check-out'),
                  icon: directOutBusy ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.logout_rounded, size: 16),
                  label: const Text('انصراف مباشر', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900)),
                ),
              ),
            ]),
          ],
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final list = _employees.where((e) {
      final status = '${e['status'] ?? 'active'}';
      final name = '${e['name'] ?? ''}'.toLowerCase();
      final job = '${e['jobNumber'] ?? ''}'.toLowerCase();
      return status == 'active' && (query.isEmpty || name.contains(query) || job.contains(query));
    }).toList();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 30),
          children: [
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text('WORKFORCE CONTROL', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)),
                  const SizedBox(height: 3),
                  const Text('دورة المناوبة والتحضير الذكي', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 2),
                  Text(_owner ? 'أنت المالك: يمكنك تغيير VIP والتلقائي وتنفيذ الإجراءات المباشرة.' : 'للقراءة والمراقبة فقط. التحضير والانصراف والتلقائي محجوزة للمالك.', style: TextStyle(fontSize: 10, color: Theme.of(context).hintColor)),
                  const SizedBox(height: 10),
                  TextField(onChanged: (v) => setState(() => _query = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'بحث بالاسم أو الرقم', isDense: true)),
                ]),
              ),
            ),
            if (_loading)
              const Padding(padding: EdgeInsets.all(45), child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              Padding(padding: const EdgeInsets.all(24), child: Column(children: [Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 8), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة'))]))
            else if (list.isEmpty)
              const Padding(padding: EdgeInsets.all(40), child: Center(child: Text('لا توجد نتائج')))
            else
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: LayoutBuilder(builder: (context, c) {
                  final columns = c.maxWidth > 900 ? 3 : c.maxWidth > 600 ? 2 : 1;
                  return GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: list.length,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: columns, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: columns == 1 ? 1.55 : 1.35),
                    itemBuilder: (_, i) => _card(list[i]),
                  );
                }),
              ),
          ],
        ),
      ),
    );
  }
}
