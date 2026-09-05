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
  final _session = HadirSession();
  late final Dio _dio;
  int tab = 0;
  bool loading = true;
  String? error;
  List<dynamic> employees = [];
  List<dynamic> requests = [];
  List<dynamic> audit = [];
  List<dynamic> admins = [];
  Map<String, dynamic> settings = {};

  @override
  void initState() {
    super.initState();
    _dio = Dio(BaseOptions(baseUrl: 'https://hadir-api.abunizar963.workers.dev', connectTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(seconds: 20)));
    _load();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final token = await _session.adminToken();
      if (token == null) throw Exception('انتهت جلسة الإدارة.');
      _dio.options.headers['Authorization'] = 'Bearer $token';
      final results = await Future.wait([
        _dio.get('/api/employees'),
        _dio.get('/api/requests'),
        _dio.get('/api/audit', queryParameters: {'limit': 500}),
        _dio.get('/api/admins'),
        _dio.get('/api/settings'),
      ]);
      if (!mounted) return;
      setState(() {
        employees = List<dynamic>.from(results[0].data as List);
        requests = List<dynamic>.from(results[1].data as List);
        audit = List<dynamic>.from(results[2].data as List);
        admins = List<dynamic>.from(results[3].data as List);
        settings = Map<String, dynamic>.from(results[4].data as Map);
        loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { loading = false; error = e.toString(); });
    }
  }

  Future<void> _request(String method, String path, {Map<String, dynamic>? data}) async {
    try {
      await _dio.request(path, method: method, data: data);
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذر تنفيذ العملية: $e')));
    }
  }

  Future<void> _addEmployee() async {
    final name = TextEditingController();
    final job = TextEditingController();
    final pin = TextEditingController();
    final result = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('إضافة موظف'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: name, decoration: const InputDecoration(labelText: 'الاسم')),
        TextField(controller: job, decoration: const InputDecoration(labelText: 'الرقم الوظيفي')),
        TextField(controller: pin, keyboardType: TextInputType.number, obscureText: true, decoration: const InputDecoration(labelText: 'PIN من 4 أرقام')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حفظ'))],
    ));
    if (result != true || name.text.trim().isEmpty || job.text.trim().isEmpty) return;
    await _request('POST', '/api/employees', data: {'id': 'mobile-${DateTime.now().microsecondsSinceEpoch}', 'name': name.text.trim(), 'jobNumber': job.text.trim(), 'pin': pin.text.trim(), 'status': 'active', 'scheduleType': 'ADMIN', 'workStartTime': '08:00', 'workEndTime': '16:00', 'workDays': [0,1,2,3,4], 'specialties': ['general']});
  }

  Future<void> _addAdmin() async {
    final name = TextEditingController();
    final username = TextEditingController();
    final password = TextEditingController();
    String role = 'manager';
    final result = await showDialog<bool>(context: context, builder: (context) => StatefulBuilder(builder: (context, setDialog) => AlertDialog(
      title: const Text('إضافة حساب إدارة'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: name, decoration: const InputDecoration(labelText: 'الاسم')),
        TextField(controller: username, decoration: const InputDecoration(labelText: 'اسم المستخدم')),
        TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'كلمة المرور')),
        DropdownButtonFormField<String>(value: role, decoration: const InputDecoration(labelText: 'الصلاحية'), items: const [DropdownMenuItem(value: 'manager', child: Text('مدير')), DropdownMenuItem(value: 'supervisor', child: Text('مشرف'))], onChanged: (v) => setDialog(() => role = v ?? 'manager')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حفظ'))],
    )));
    if (result != true) return;
    await _request('POST', '/api/admins', data: {'name': name.text.trim(), 'username': username.text.trim(), 'password': password.text, 'role': role});
  }

  Widget _card({required Widget child}) => Card(margin: const EdgeInsets.only(bottom: 10), child: child);

  Widget _employees() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Row(children: [Expanded(child: Text('${employees.length} موظف', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink))), FilledButton.icon(onPressed: _addEmployee, icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة'))]),
    const SizedBox(height: 12),
    ...employees.map((e) { final m = Map<String, dynamic>.from(e as Map); final id = '${m['id'] ?? ''}'; return _card(child: ListTile(leading: CircleAvatar(backgroundColor: const Color(0xFFEAF4F0), child: Text('${m['name'] ?? 'م'}'.trim().isEmpty ? 'م' : '${m['name']}'.trim().substring(0,1))), title: Text('${m['name'] ?? 'بدون اسم'}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${m['jobNumber'] ?? '—'} · ${m['status'] ?? 'active'}'), trailing: PopupMenuButton<String>(onSelected: (v) { if (v == 'reset') _request('DELETE', '/api/employees/$id/device'); if (v == 'delete') _request('DELETE', '/api/employees/$id'); }, itemBuilder: (_) => const [PopupMenuItem(value: 'reset', child: Text('إعادة ربط الجهاز')), PopupMenuItem(value: 'delete', child: Text('حذف الموظف'))]))); }),
  ]);

  Widget _requests() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Text('${requests.length} طلب', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink)), const SizedBox(height: 12),
    ...requests.map((e) { final m = Map<String, dynamic>.from(e as Map); final id = '${m['id'] ?? ''}'; final status = '${m['status'] ?? 'pending'}'; return _card(child: ListTile(title: Text('${m['type'] ?? 'طلب'} · ${m['employeeName'] ?? m['employeeId'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${m['reason'] ?? ''}\nالحالة: $status'), isThreeLine: true, trailing: status == 'pending' ? PopupMenuButton<String>(onSelected: (v) => _request('PATCH', '/api/requests/$id', data: {'status': v}), itemBuilder: (_) => const [PopupMenuItem(value: 'approved', child: Text('موافقة')), PopupMenuItem(value: 'rejected', child: Text('رفض'))]) : null)); }),
  ]);

  Widget _reports() {
    final successful = audit.where((e) { final m = Map<String, dynamic>.from(e as Map); return m['result'] == 'success' && (m['action'] == 'check-in' || m['action'] == 'check-out'); }).toList();
    final checkIns = successful.where((e) => (e as Map)['action'] == 'check-in').length;
    final checkOuts = successful.where((e) => (e as Map)['action'] == 'check-out').length;
    return Column(children: [
      Row(children: [Expanded(child: _stat('سجلات ناجحة', '${successful.length}', Icons.fact_check_rounded)), const SizedBox(width: 10), Expanded(child: _stat('تحضير', '$checkIns', Icons.login_rounded)), const SizedBox(width: 10), Expanded(child: _stat('انصراف', '$checkOuts', Icons.logout_rounded))]),
      const SizedBox(height: 16),
      _card(child: ListTile(title: const Text('التقرير التفصيلي', style: TextStyle(fontWeight: FontWeight.w900)), subtitle: Text('يمكنك تصفية ${successful.length} عملية حضور وانصراف من سجل التدقيق.'))),
      ...successful.take(80).map((e) { final m = Map<String, dynamic>.from(e as Map); return _card(child: ListTile(title: Text('${m['actorName'] ?? m['jobNumber'] ?? 'موظف'} · ${m['action']}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${m['timestamp'] ?? ''} · ${m['distanceMeters'] ?? 0} متر'))); }),
    ]);
  }

  Widget _audit() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text('${audit.length} حدث مسجل', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink)), const SizedBox(height: 12), ...audit.take(120).map((e) { final m = Map<String, dynamic>.from(e as Map); return _card(child: ListTile(dense: true, title: Text('${m['action'] ?? 'حدث'} · ${m['actorName'] ?? m['jobNumber'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${m['timestamp'] ?? ''} · ${m['result'] ?? ''}'))); })]);

  Widget _admins() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(children: [Expanded(child: Text('${admins.length} حساب إداري', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink))), FilledButton.icon(onPressed: _addAdmin, icon: const Icon(Icons.person_add), label: const Text('إضافة'))]), const SizedBox(height: 12), ...admins.map((e) { final m = Map<String, dynamic>.from(e as Map); final id = '${m['id'] ?? ''}'; return _card(child: ListTile(leading: const Icon(Icons.admin_panel_settings_rounded, color: _green), title: Text('${m['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('@${m['username'] ?? ''} · ${m['role'] ?? ''}'), trailing: Switch(value: m['active'] != false, onChanged: (v) => _request('PATCH', '/api/admins/$id', data: {'active': v}))); }))]);

  Widget _settings() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Text('إعدادات النظام', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink)), const SizedBox(height: 12), _card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: settings.entries.map((e) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(children: [Expanded(child: Text(e.key, style: const TextStyle(fontWeight: FontWeight.w700))), Flexible(child: Text('${e.value}', textAlign: TextAlign.left, style: const TextStyle(color: Colors.black54)))]))).toList()))]);

  Widget _stat(String label, String value, IconData icon) => Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(children: [Icon(icon, color: _green), const SizedBox(height: 7), Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)), Text(label, style: const TextStyle(fontSize: 10, color: Colors.black54))])));

  @override
  Widget build(BuildContext context) {
    final views = [_employees(), _requests(), _reports(), _audit(), _admins(), _settings()];
    const labels = ['الموظفون', 'الطلبات', 'التقارير', 'التدقيق', 'الإدارة', 'الإعدادات'];
    const icons = [Icons.groups_rounded, Icons.event_note_rounded, Icons.bar_chart_rounded, Icons.security_rounded, Icons.admin_panel_settings_rounded, Icons.settings_rounded];
    return Scaffold(appBar: AppBar(title: const Text('إدارة حاضر', style: TextStyle(fontWeight: FontWeight.w900)), leading: IconButton(onPressed: () => context.go('/admin'), icon: const Icon(Icons.arrow_back))), body: loading ? const Center(child: CircularProgressIndicator()) : error != null ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48), const SizedBox(height: 12), Text(error!, textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة'))])) : RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: List.generate(labels.length, (i) => Padding(padding: const EdgeInsets.only(left: 8), child: ChoiceChip(selected: tab == i, avatar: Icon(icons[i], size: 17), label: Text(labels[i]), onSelected: (_) => setState(() => tab = i))))), const SizedBox(height: 18), views[tab]])));
  }
}
