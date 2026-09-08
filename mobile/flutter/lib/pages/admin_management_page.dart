import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/hadir_brand.dart';
import '../core/session.dart';

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
  String _employeeQuery = '';
  String _employeeStatus = 'all';
  String _requestQuery = '';
  String _requestStatus = 'all';
  String _adminQuery = '';
  List<dynamic> _employees = [];
  List<dynamic> _requests = [];
  List<dynamic> _audit = [];
  List<dynamic> _admins = [];
  Map<String, dynamic> _settings = {};

  @override
  void initState() {
    super.initState();
    _dio = Dio(
      BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 20),
        headers: const {'Accept': 'application/json'},
      ),
    );
    _load();
  }

  String _errorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['error'] is String) {
        return data['error'] as String;
      }
      return 'تعذر إكمال العملية (${error.response?.statusCode ?? 'شبكة'}).';
    }
    return error.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) {
        throw Exception('انتهت جلسة الإدارة.');
      }
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
      setState(() {
        _loading = false;
        _error = _errorMessage(error);
      });
    }
  }

  Future<void> _request(
    String method,
    String path, {
    Map<String, dynamic>? data,
  }) async {
    try {
      await _dio.request<dynamic>(
        path,
        data: data,
        options: Options(method: method),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    }
  }

  Future<void> _addEmployee() async {
    final name = TextEditingController();
    final job = TextEditingController();
    final pin = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('إضافة موظف'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: name, decoration: const InputDecoration(labelText: 'الاسم')),
              TextField(controller: job, decoration: const InputDecoration(labelText: 'الرقم الوظيفي')),
              TextField(
                controller: pin,
                keyboardType: TextInputType.number,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'PIN'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
            FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('حفظ')),
          ],
        );
      },
    );

    if (result != true) return;
    if (name.text.trim().isEmpty || job.text.trim().isEmpty) return;

    await _request(
      'POST',
      '/api/employees',
      data: {
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
      },
    );
  }

  Future<void> _addAdmin() async {
    final name = TextEditingController();
    final username = TextEditingController();
    final password = TextEditingController();
    var role = 'manager';

    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('إضافة حساب إدارة'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
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
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
                FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('حفظ')),
              ],
            );
          },
        );
      },
    );

    if (result != true) return;
    if (name.text.trim().isEmpty || username.text.trim().isEmpty || password.text.isEmpty) return;

    await _request(
      'POST',
      '/api/admins',
      data: {
        'name': name.text.trim(),
        'username': username.text.trim(),
        'password': password.text,
        'role': role,
      },
    );
  }

  Future<void> _deleteEmployee(String id, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('حذف الموظف؟'),
          content: Text('سيتم حذف حساب «$name». لا يمكن التراجع عن العملية.'),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
            FilledButton.tonal(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('حذف')),
          ],
        );
      },
    );

    if (confirmed == true) await _request('DELETE', '/api/employees/$id');
  }

  Widget _card(Widget child) {
    return Card(margin: const EdgeInsets.only(bottom: 10), child: child);
  }

  Widget _metric(String label, String value, IconData icon) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 13),
          child: Column(
            children: [
              Icon(icon, color: HadirBrand.primary),
              const SizedBox(height: 6),
              Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
              Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _searchBox({required String hint, required ValueChanged<String> onChanged}) {
    return TextField(
      onChanged: onChanged,
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.search_rounded),
        hintText: hint,
        isDense: true,
      ),
    );
  }

  Widget _employeesView() {
    final filtered = _employees.where((raw) {
      final employee = Map<String, dynamic>.from(raw as Map);
      final query = _employeeQuery.trim().toLowerCase();
      final name = '${employee['name'] ?? ''}'.toLowerCase();
      final job = '${employee['jobNumber'] ?? ''}'.toLowerCase();
      final status = '${employee['status'] ?? 'active'}'.toLowerCase();
      return (query.isEmpty || name.contains(query) || job.contains(query)) &&
          (_employeeStatus == 'all' || status == _employeeStatus);
    }).toList();
    final active = _employees.where((raw) => '${(raw as Map)['status'] ?? 'active'}' == 'active').length;
    final inactive = _employees.length - active;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(children: [
          _metric('إجمالي الموظفين', '${_employees.length}', Icons.groups_rounded),
          const SizedBox(width: 8),
          _metric('نشط', '$active', Icons.check_circle_outline_rounded),
          const SizedBox(width: 8),
          _metric('غير نشط', '$inactive', Icons.pause_circle_outline_rounded),
        ]),
        const SizedBox(height: 8),
        _searchBox(hint: 'ابحث بالاسم أو الرقم الوظيفي', onChanged: (v) => setState(() => _employeeQuery = v)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            _filterChip('الكل', 'all', _employeeStatus, (v) => setState(() => _employeeStatus = v)),
            _filterChip('نشط', 'active', _employeeStatus, (v) => setState(() => _employeeStatus = v)),
            _filterChip('غير نشط', 'inactive', _employeeStatus, (v) => setState(() => _employeeStatus = v)),
          ],
        ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: Text('${filtered.length} نتيجة', style: const TextStyle(fontWeight: FontWeight.w800))),
          FilledButton.icon(onPressed: _addEmployee, icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة')),
        ]),
        const SizedBox(height: 10),
        if (filtered.isEmpty) _empty('لا توجد موظفون مطابقون للبحث.')
        else ...filtered.map((raw) {
          final employee = Map<String, dynamic>.from(raw as Map);
          final id = '${employee['id'] ?? ''}';
          final name = '${employee['name'] ?? 'بدون اسم'}'.trim();
          final status = '${employee['status'] ?? 'active'}';
          return _card(ListTile(
            leading: CircleAvatar(
              backgroundColor: HadirBrand.soft,
              child: Text(name.isEmpty ? 'م' : name.substring(0, 1)),
            ),
            title: Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text('${employee['jobNumber'] ?? '—'} · $status · ${employee['scheduleType'] ?? '—'}'),
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
      ],
    );
  }

  Widget _filterChip(String label, String value, String current, ValueChanged<String> onSelected) {
    return ChoiceChip(label: Text(label), selected: current == value, onSelected: (_) => onSelected(value));
  }

  Widget _requestsView() {
    final filtered = _requests.where((raw) {
      final request = Map<String, dynamic>.from(raw as Map);
      final query = _requestQuery.trim().toLowerCase();
      final status = '${request['status'] ?? 'pending'}'.toLowerCase();
      final text = '${request['type'] ?? ''} ${request['employeeName'] ?? ''} ${request['employeeId'] ?? ''} ${request['reason'] ?? ''}'.toLowerCase();
      return (query.isEmpty || text.contains(query)) && (_requestStatus == 'all' || status == _requestStatus);
    }).toList();
    final pending = _requests.where((raw) => '${(raw as Map)['status'] ?? 'pending'}' == 'pending').length;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        _metric('إجمالي الطلبات', '${_requests.length}', Icons.inbox_rounded),
        const SizedBox(width: 8),
        _metric('قيد المراجعة', '$pending', Icons.pending_actions_rounded),
      ]),
      const SizedBox(height: 8),
      _searchBox(hint: 'ابحث في نوع الطلب أو الموظف أو السبب', onChanged: (v) => setState(() => _requestQuery = v)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, children: [
        _filterChip('الكل', 'all', _requestStatus, (v) => setState(() => _requestStatus = v)),
        _filterChip('معلق', 'pending', _requestStatus, (v) => setState(() => _requestStatus = v)),
        _filterChip('مقبول', 'approved', _requestStatus, (v) => setState(() => _requestStatus = v)),
        _filterChip('مرفوض', 'rejected', _requestStatus, (v) => setState(() => _requestStatus = v)),
      ]),
      const SizedBox(height: 12),
      if (filtered.isEmpty) _empty('لا توجد طلبات مطابقة.')
      else ...filtered.map((raw) {
        final request = Map<String, dynamic>.from(raw as Map);
        final id = '${request['id'] ?? ''}';
        final status = '${request['status'] ?? 'pending'}';
        return _card(ListTile(
          title: Text('${request['type'] ?? 'طلب'} · ${request['employeeName'] ?? request['employeeId'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${request['reason'] ?? ''}\nالحالة: $status'),
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

  Widget _reportsView() {
    final successful = _audit.where((raw) {
      final item = Map<String, dynamic>.from(raw as Map);
      return item['result'] == 'success' && (item['action'] == 'check-in' || item['action'] == 'check-out');
    }).toList();
    final checkIns = successful.where((raw) => (raw as Map)['action'] == 'check-in').length;
    final checkOuts = successful.where((raw) => (raw as Map)['action'] == 'check-out').length;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        _metric('سجلات ناجحة', '${successful.length}', Icons.fact_check_rounded),
        const SizedBox(width: 8),
        _metric('حضور', '$checkIns', Icons.login_rounded),
        const SizedBox(width: 8),
        _metric('انصراف', '$checkOuts', Icons.logout_rounded),
      ]),
      const SizedBox(height: 12),
      _card(const ListTile(title: Text('التقرير التفصيلي', style: TextStyle(fontWeight: FontWeight.w900)), subtitle: Text('عمليات الحضور والانصراف المستخرجة من سجل التدقيق.'))),
      ...successful.take(80).map((raw) {
        final item = Map<String, dynamic>.from(raw as Map);
        return _card(ListTile(
          title: Text('${item['actorName'] ?? item['jobNumber'] ?? 'موظف'} · ${item['action']}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${item['timestamp'] ?? ''} · ${item['distanceMeters'] ?? 0} متر'),
        ));
      }),
    ]);
  }

  Widget _auditView() {
    if (_audit.isEmpty) return _empty('لا توجد أحداث تدقيق.');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        _metric('إجمالي الأحداث', '${_audit.length}', Icons.security_rounded),
        const SizedBox(width: 8),
        _metric('ناجح', '${_audit.where((raw) => (raw as Map)['result'] == 'success').length}', Icons.verified_rounded),
      ]),
      const SizedBox(height: 12),
      ..._audit.take(120).map((raw) {
        final item = Map<String, dynamic>.from(raw as Map);
        return _card(ListTile(
          dense: true,
          title: Text('${item['action'] ?? 'حدث'} · ${item['actorName'] ?? item['jobNumber'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${item['timestamp'] ?? ''} · ${item['result'] ?? ''}'),
        ));
      }),
    ]);
  }

  Widget _adminsView() {
    final filtered = _admins.where((raw) {
      final admin = Map<String, dynamic>.from(raw as Map);
      final query = _adminQuery.trim().toLowerCase();
      return query.isEmpty || '${admin['name'] ?? ''} ${admin['username'] ?? ''} ${admin['role'] ?? ''}'.toLowerCase().contains(query);
    }).toList();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        _metric('الحسابات', '${_admins.length}', Icons.admin_panel_settings_rounded),
        const Spacer(),
        FilledButton.icon(onPressed: _addAdmin, icon: const Icon(Icons.person_add), label: const Text('إضافة')),
      ]),
      const SizedBox(height: 8),
      _searchBox(hint: 'ابحث بالاسم أو اسم المستخدم أو الصلاحية', onChanged: (v) => setState(() => _adminQuery = v)),
      const SizedBox(height: 12),
      if (filtered.isEmpty) _empty('لا توجد حسابات مطابقة.')
      else ...filtered.map((raw) {
        final admin = Map<String, dynamic>.from(raw as Map);
        final id = '${admin['id'] ?? ''}';
        return _card(ListTile(
          leading: const Icon(Icons.admin_panel_settings_rounded, color: HadirBrand.primary),
          title: Text('${admin['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('@${admin['username'] ?? ''} · ${admin['role'] ?? ''}'),
          trailing: Switch(value: admin['active'] != false, onChanged: (value) => _request('PATCH', '/api/admins/$id', data: {'active': value})),
        ));
      }),
    ]);
  }

  Widget _settingsView() {
    if (_settings.isEmpty) return _empty('لا توجد إعدادات متاحة.');
    final rows = _settings.entries.map((entry) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(children: [
        Expanded(child: Text(entry.key, style: const TextStyle(fontWeight: FontWeight.w700))),
        Flexible(child: Text('${entry.value}', textAlign: TextAlign.left, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant))),
      ]),
    )).toList();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('إعدادات النظام', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
      const SizedBox(height: 8),
      _card(Padding(padding: const EdgeInsets.all(16), child: Column(children: rows))),
    ]);
  }

  Widget _empty(String message) {
    return Card(child: Padding(padding: const EdgeInsets.all(28), child: Column(children: [
      const Icon(Icons.inbox_outlined, size: 42),
      const SizedBox(height: 10),
      Text(message, textAlign: TextAlign.center),
    ])));
  }

  @override
  Widget build(BuildContext context) {
    final views = [_employeesView(), _requestsView(), _reportsView(), _auditView(), _adminsView(), _settingsView()];
    const labels = ['الموظفون', 'الطلبات', 'التقارير', 'التدقيق', 'الإدارة', 'الإعدادات'];
    const icons = [Icons.groups_rounded, Icons.event_note_rounded, Icons.bar_chart_rounded, Icons.security_rounded, Icons.admin_panel_settings_rounded, Icons.settings_rounded];

    return Scaffold(
      appBar: AppBar(
        title: const Text('إدارة حاضر', style: TextStyle(fontWeight: FontWeight.w900)),
        leading: IconButton(onPressed: () => context.go('/admin'), icon: const Icon(Icons.arrow_back)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.cloud_off_rounded, size: 48),
                  const SizedBox(height: 12),
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _load, child: const Text('إعادة المحاولة')),
                ])))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(children: List.generate(labels.length, (index) => Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: ChoiceChip(selected: _tab == index, avatar: Icon(icons[index], size: 17), label: Text(labels[index]), onSelected: (_) => setState(() => _tab = index)),
                      ))),
                    ),
                    const SizedBox(height: 18),
                    views[_tab],
                  ]),
                ),
    );
  }
}
