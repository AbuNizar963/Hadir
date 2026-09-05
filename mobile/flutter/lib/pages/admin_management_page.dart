import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/session.dart';

const _green = Color(0xFF0B6B5A);
const _ink = Color(0xFF17322C);

class AdminManagementPage extends StatefulWidget {
  const AdminManagementPage({super.key});

  @override
  State<AdminManagementPage> createState() => _AdminManagementPageState();
}

class _AdminManagementPageState extends State<AdminManagementPage> {
  static const _baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  final _session = HadirSession();
  late final Dio _dio;
  int _tab = 0;
  bool _loading = true;
  String? _error;
  List<dynamic> _employees = [];
  List<dynamic> _requests = [];
  List<dynamic> _audit = [];
  List<dynamic> _admins = [];
  Map<String, dynamic> _settings = {};

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

  String _message(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      return 'تعذر إكمال العملية (${error.response?.statusCode ?? 'شبكة'}).';
    }
    return error.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _load() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      _dio.options.headers['Authorization'] = 'Bearer $token';
      final results = await Future.wait<Response<dynamic>>([
        _dio.get('/api/employees'),
        _dio.get('/api/requests'),
        _dio.get('/api/audit', queryParameters: const {'limit': 500}),
        _dio.get('/api/admins'),
        _dio.get('/api/settings'),
      ]);
      if (!mounted) return;
      setState(() {
        _employees = List<dynamic>.from(results[0].data as List);
        _requests = List<dynamic>.from(results[1].data as List);
        _audit = List<dynamic>.from(results[2].data as List);
        _admins = List<dynamic>.from(results[3].data as List);
        _settings = Map<String, dynamic>.from(results[4].data as Map);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() { _loading = false; _error = _message(error); });
    }
  }

  Future<void> _request(String method, String path, {Map<String, dynamic>? data}) async {
    try {
      await _dio.request<dynamic>(path, data: data, options: Options(method: method));
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_message(error))));
    }
  }

  Future<void> _addEmployee() async {
    final name = TextEditingController();
    final job = TextEditingController();
    final pin = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('إضافة موظف'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: name, decoration: const InputDecoration(labelText: 'الاسم')),
          TextField(controller: job, decoration: const InputDecoration(labelText: 'الرقم الوظيفي')),
          TextField(controller: pin, keyboardType: TextInputType.number, obscureText: true, decoration: const InputDecoration(labelText: 'PIN')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('حفظ')),
        ],
      ),
    );
    if (ok != true || name.text.trim().isEmpty || job.text.trim().isEmpty) return;
    await _request('POST', '/api/employees', data: {
      'id': 'mobile-${DateTime.now().microsecondsSinceEpoch}',
      'name': name.text.trim(),
      'jobNumber': job.text.trim(),
      'pin': pin.text.trim(),
      'status': 'active',
      'scheduleType': 'ADMIN',
      'workStartTime': '08:00',
      'workEndTime': '16:00',
      'workDays': [0, 1, 2, 3, 4],
      'specialties': ['general'],
    });
  }

  Future<void> _addAdmin() async {
    final name = TextEditingController();
    final username = TextEditingController();
    final password = TextEditingController();
    var role = 'manager';
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('إضافة حساب إدارة'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: name, decoration: const InputDecoration(labelText: 'الاسم')),
            TextField(controller: username, decoration: const InputDecoration(labelText: 'اسم المستخدم')),
            TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'كلمة المرور')),
            DropdownButtonFormField<String>(
              initialValue: role,
              decoration: const InputDecoration(labelText: 'الصلاحية'),
              items: const [
                DropdownMenuItem(value: 'manager', child: Text('مدير')),
                DropdownMenuItem(value: 'supervisor', child: Text('مشرف')),
              ],
              onChanged: (value) => setDialogState(() => role = value ?? 'manager'),
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
            FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('حفظ')),
          ],
        ),
      ),
    );
    if (ok != true || name.text.trim().isEmpty || username.text.trim().isEmpty || password.text.isEmpty) return;
    await _request('POST', '/api/admins', data: {
      'name': name.text.trim(),
      'username': username.text.trim(),
      'password': password.text,
      'role': role,
    });
  }

  Future<void> _deleteEmployee(String id, String name) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('حذف الموظف؟'),
        content: Text('سيتم حذف حساب «$name». لا يمكن التراجع عن العملية.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
          FilledButton.tonal(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok == true) await _request('DELETE', '/api/employees/$id');
  }

  Widget _card(Widget child) => Card(margin: const EdgeInsets.only(bottom: 10), child: child);

  Widget _employeesView() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: Text('${_employees.length} موظف', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink))),
        FilledButton.icon(onPressed: _addEmployee, icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة')),
      ]),
      const SizedBox(height: 12),
      ..._employees.map((raw) {
        final e = Map<String, dynamic>.from(raw as Map);
        final id = '${e['id'] ?? ''}';
        final name = '${e['name'] ?? 'بدون اسم'}'.trim();
        return _card(ListTile(
          leading: CircleAvatar(backgroundColor: const Color(0xFFEAF4F0), child: Text(name.isEmpty ? 'م' : name.substring(0, 1))),
          title: Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${e['jobNumber'] ?? '—'} · ${e['status'] ?? 'active'}'),
          trailing: PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'reset') _request('DELETE', '/api/employees/$id/device');
              if (value == 'delete') _deleteEmployee(id, name);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'reset', child: Text('إعادة ربط الجهاز')),
              PopupMenuItem(value: 'delete', child: Text('حذف الموظف')),
            ],
          ),
        ));
      }),
    ]);
  }

  Widget _requestsView() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('${_requests.length} طلب', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink)),
      const SizedBox(height: 12),
      ..._requests.map((raw) {
        final r = Map<String, dynamic>.from(raw as Map);
        final id = '${r['id'] ?? ''}';
        final status = '${r['status'] ?? 'pending'}';
        return _card(ListTile(
          title: Text('${r['type'] ?? 'طلب'} · ${r['employeeName'] ?? r['employeeId'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${r['reason'] ?? ''}\nالحالة: $status'),
          isThreeLine: true,
          trailing: status == 'pending'
              ? PopupMenuButton<String>(
                  onSelected: (value) => _request('PATCH', '/api/requests/$id', data: {'status': value}),
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'approved', child: Text('موافقة')),
                    PopupMenuItem(value: 'rejected', child: Text('رفض')),
                  ],
                )
              : null,
        ));
      }),
    ]);
  }

  Widget _auditView() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('${_audit.length} حدث مسجل', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink)),
      const SizedBox(height: 12),
      ..._audit.take(120).map((raw) {
        final a = Map<String, dynamic>.from(raw as Map);
        return _card(ListTile(
          dense: true,
          title: Text('${a['action'] ?? 'حدث'} · ${a['actorName'] ?? a['jobNumber'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${a['timestamp'] ?? ''} · ${a['result'] ?? ''}'),
        ));
      }),
    ]);
  }

  Widget _adminsView() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: Text('${_admins.length} حساب إداري', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink))),
        FilledButton.icon(onPressed: _addAdmin, icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة')),
      ]),
      const SizedBox(height: 12),
      ..._admins.map((raw) {
        final a = Map<String, dynamic>.from(raw as Map);
        return _card(ListTile(
          leading: const CircleAvatar(child: Icon(Icons.admin_panel_settings_outlined)),
          title: Text('${a['name'] ?? 'حساب إداري'}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${a['username'] ?? '—'} · ${a['role'] ?? 'admin'}'),
        ));
      }),
    ]);
  }

  Widget _settingsView() {
    final entries = _settings.entries.toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('إعدادات النظام', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink)),
      const SizedBox(height: 12),
      ...entries.map((entry) => _card(ListTile(title: Text(entry.key), subtitle: Text('${entry.value}')))),
    ]);
  }

  Widget _reportsView() {
    final successful = _audit.where((raw) {
      final a = Map<String, dynamic>.from(raw as Map);
      return a['result'] == 'success' && (a['action'] == 'check-in' || a['action'] == 'check-out');
    }).toList();
    final checkIns = successful.where((raw) => (raw as Map)['action'] == 'check-in').length;
    final checkOuts = successful.where((raw) => (raw as Map)['action'] == 'check-out').length;
    return Column(children: [
      Row(children: [
        Expanded(child: _stat('سجلات ناجحة', '${successful.length}', Icons.fact_check_rounded)),
        const SizedBox(width: 10),
        Expanded(child: _stat('حضور', '$checkIns', Icons.login_rounded)),
        const SizedBox(width: 10),
        Expanded(child: _stat('انصراف', '$checkOuts', Icons.logout_rounded)),
      ]),
      const SizedBox(height: 16),
      _card(const ListTile(title: Text('التقرير التفصيلي', style: TextStyle(fontWeight: FontWeight.w900)), subtitle: Text('عمليات الحضور والانصراف المستخرجة من سجل التدقيق.'))),
      ...successful.take(80).map((raw) {
        final a = Map<String, dynamic>.from(raw as Map);
        return _card(ListTile(
          title: Text('${a['actorName'] ?? a['jobNumber'] ?? 'موظف'} · ${a['action']}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${a['timestamp'] ?? ''} · ${a['distanceMeters'] ?? 0} متر'),
        ));
      }),
    ]);
  }

  Widget _stat(String label, String value, IconData icon) {
    return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
      Icon(icon, color: _green),
      const SizedBox(height: 6),
      Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
      Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11)),
    ])));
  }

  @override
  Widget build(BuildContext context) {
    final views = [_employeesView(), _requestsView(), _reportsView(), _auditView(), _adminsView(), _settingsView()];
    return Scaffold(
      appBar: AppBar(
        title: const Text('إدارة حاضر', style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.error_outline_rounded, size: 48),
                  const SizedBox(height: 12),
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _load, child: const Text('إعادة المحاولة')),
                ])))
              : RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [views[_tab]])),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (value) => setState(() => _tab = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.people_alt_outlined), label: 'الموظفون'),
          NavigationDestination(icon: Icon(Icons.assignment_outlined), label: 'الطلبات'),
          NavigationDestination(icon: Icon(Icons.bar_chart_rounded), label: 'التقارير'),
          NavigationDestination(icon: Icon(Icons.history_rounded), label: 'التدقيق'),
          NavigationDestination(icon: Icon(Icons.admin_panel_settings_outlined), label: 'الإدارة'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), label: 'الإعدادات'),
        ],
      ),
    );
  }
}
