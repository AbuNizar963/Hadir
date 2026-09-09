import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

class AdminManagementPage extends StatefulWidget {
  const AdminManagementPage({super.key});

  @override
  State<AdminManagementPage> createState() => _AdminManagementPageState();
}

class _AdminManagementPageState extends State<AdminManagementPage> {
  final _searchController = TextEditingController();
  final _adminSearchController = TextEditingController();
  final _api = HadirApi();

  bool _loading = true;
  String? _error;
  int _tab = 0;
  String _statusFilter = 'all';
  String _scheduleFilter = 'all';
  String _adminQuery = '';

  List<dynamic> _employees = [];
  List<dynamic> _requests = [];
  List<dynamic> _audit = [];
  List<dynamic> _admins = [];
  Map<String, dynamic> _settings = {};
  List<dynamic> _locations = [];
  List<dynamic> _escapes = [];
  Map<String, dynamic> _workforce = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _adminSearchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait<dynamic>([
        _request('GET', '/api/employees'),
        _request('GET', '/api/requests'),
        _request('GET', '/api/audit'),
        _request('GET', '/api/admins'),
        _request('GET', '/api/settings'),
        _request('GET', '/api/locations'),
        _request('GET', '/api/escape-events?limit=2000'),
        _request('GET', '/api/manager/workforce-controls'),
      ]);
      if (!mounted) return;
      setState(() {
        _employees = _asList(results[0]);
        _requests = _asList(results[1]);
        _audit = _asList(results[2]);
        _admins = _asList(results[3]);
        _settings = _asMap(results[4]);
        _locations = _asList(results[5]);
        _escapes = _asList(results[6]);
        _workforce = _asMap(results[7]);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '$e';
      });
    }
  }

  List<dynamic> _asList(dynamic value) {
    if (value is List) return value;
    if (value is Map && value['data'] is List) return value['data'] as List;
    if (value is Map && value['items'] is List) return value['items'] as List;
    return const [];
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  Future<dynamic> _request(String method, String path, {Map<String, dynamic>? data}) async {
    final token = await HadirSession.token();
    final api = HadirApi(token: token);
    switch (method) {
      case 'GET':
        return api.get(path);
      case 'POST':
        return api.post(path, data: data);
      case 'PATCH':
        return api.patch(path, data: data);
      case 'PUT':
        return api.put(path, data: data);
      case 'DELETE':
        return api.delete(path);
      default:
        throw Exception('Unsupported request method: $method');
    }
  }

  String _employeeId(Map<String, dynamic> employee) => '${employee['id'] ?? employee['_id'] ?? ''}';

  String _employeeStatus(Map<String, dynamic> employee) {
    final id = _employeeId(employee);
    if (_escapes.any((e) => e is Map && '${e['employeeId'] ?? e['employee_id'] ?? ''}' == id && e['returnedAt'] == null)) return 'escaped';
    final status = '${employee['status'] ?? 'active'}'.toLowerCase();
    if (status == 'suspended' || status == 'inactive') return 'inactive';
    final live = _workforce[id];
    if (live is Map && live['status'] != null) return '${live['status']}'.toLowerCase();
    return status;
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
      case 'present':
      case 'approved':
        return HadirBrand.accent;
      case 'late':
      case 'pending':
      case 'rest':
        return Colors.orange;
      case 'escaped':
      case 'inactive':
      case 'rejected':
        return Colors.red;
      default:
        return Theme.of(context).colorScheme.outline;
    }
  }

  Widget _card(Widget child) => Card(margin: const EdgeInsets.only(bottom: 10), child: child);

  Widget _metric(String label, String value, IconData icon) => Expanded(
        child: _card(Padding(
          padding: const EdgeInsets.all(12),
          child: Column(children: [Icon(icon, size: 24), const SizedBox(height: 5), Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), Text(label, textAlign: TextAlign.center)],),
        )),
      );

  Widget _searchBox({required String hint, required ValueChanged<String> onChanged}) => TextField(
        controller: _searchController,
        onChanged: onChanged,
        decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: hint, border: const OutlineInputBorder(), isDense: true),
      );

  Future<void> _addEmployee() async {
    final name = TextEditingController();
    final job = TextEditingController();
    final pin = TextEditingController();
    final start = TextEditingController(text: '08:00');
    final end = TextEditingController(text: '16:00');
    final grace = TextEditingController();
    final early = TextEditingController();
    final rotationOn = TextEditingController(text: '7');
    final rotationOff = TextEditingController(text: '7');
    final rotationStart = TextEditingController();
    final specialties = TextEditingController(text: 'general');
    String status = 'active';
    String schedule = 'ADMIN';
    String locationId = '';
    final workDays = <int>{0, 1, 2, 3, 4};

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('إضافة موظف'),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                TextField(controller: name, decoration: const InputDecoration(labelText: 'اسم الموظف')),
                TextField(controller: job, decoration: const InputDecoration(labelText: 'الرقم الوظيفي')),
                TextField(controller: pin, decoration: const InputDecoration(labelText: 'PIN'), obscureText: true),
                DropdownButtonFormField<String>(value: status, decoration: const InputDecoration(labelText: 'الحالة'), items: const [DropdownMenuItem(value: 'active', child: Text('نشط')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setDialogState(() => status = v ?? 'active')),
                DropdownButtonFormField<String>(value: schedule, decoration: const InputDecoration(labelText: 'نوع الجدول'), items: const [DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('مناوبات'))], onChanged: (v) => setDialogState(() => schedule = v ?? 'ADMIN')),
                Row(children: [Expanded(child: TextField(controller: start, decoration: const InputDecoration(labelText: 'بداية العمل'))), const SizedBox(width: 8), Expanded(child: TextField(controller: end, decoration: const InputDecoration(labelText: 'نهاية العمل')))]),
                Row(children: [Expanded(child: TextField(controller: grace, decoration: const InputDecoration(labelText: 'سماح التأخير بالدقائق'))), const SizedBox(width: 8), Expanded(child: TextField(controller: early, decoration: const InputDecoration(labelText: 'سماح الانصراف المبكر')))]),
                const SizedBox(height: 8),
                Align(alignment: Alignment.centerRight, child: Text('أيام العمل', style: Theme.of(context).textTheme.titleSmall)),
                Wrap(children: List.generate(7, (day) => FilterChip(label: Text(['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'][day]), selected: workDays.contains(day), onSelected: (selected) => setDialogState(() => selected ? workDays.add(day) : workDays.remove(day))))),
                Row(children: [Expanded(child: TextField(controller: rotationOn, decoration: const InputDecoration(labelText: 'أيام المناوبة'))), const SizedBox(width: 8), Expanded(child: TextField(controller: rotationOff, decoration: const InputDecoration(labelText: 'أيام الراحة')))]),
                TextField(controller: rotationStart, decoration: const InputDecoration(labelText: 'تاريخ بداية المناوبة')),
                DropdownButtonFormField<String>(value: locationId.isEmpty ? null : locationId, decoration: const InputDecoration(labelText: 'الموقع'), items: [const DropdownMenuItem(value: '', child: Text('بدون موقع')), ..._locations.whereType<Map>().map((l) => DropdownMenuItem(value: '${l['id'] ?? ''}', child: Text('${l['name'] ?? 'موقع'}')))], onChanged: (v) => setDialogState(() => locationId = v ?? '')),
                TextField(controller: specialties, decoration: const InputDecoration(labelText: 'التخصصات')),
              ]),
            ),
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')), FilledButton(onPressed: () async {
            if (name.text.trim().isEmpty || job.text.trim().isEmpty || (pin.text.isNotEmpty && pin.text.length < 4)) return;
            final payload = <String, dynamic>{'name': name.text.trim(), 'jobNumber': job.text.trim(), 'status': status, 'scheduleType': schedule, 'workStartTime': start.text.trim(), 'workEndTime': end.text.trim(), 'gracePeriodMinutes': int.tryParse(grace.text) ?? 0, 'workDays': workDays.toList()..sort(), 'rotationDaysOn': int.tryParse(rotationOn.text) ?? 7, 'rotationDaysOff': int.tryParse(rotationOff.text) ?? 7, 'rotationStartDate': rotationStart.text.trim(), 'locationId': locationId, 'specialties': specialties.text.trim()};
            if (pin.text.isNotEmpty) payload['pin'] = pin.text;
            await _request('POST', '/api/employees', data: payload);
            if (context.mounted) Navigator.pop(context);
            await _load();
          }, child: const Text('حفظ'))],
        ),
      ),
    );
    name.dispose(); job.dispose(); pin.dispose(); start.dispose(); end.dispose(); grace.dispose(); early.dispose(); rotationOn.dispose(); rotationOff.dispose(); rotationStart.dispose(); specialties.dispose();
  }

  Future<void> _employeeAction(String id, String type) async {
    if (type == 'check-in' || type == 'check-out') {
      await _request('POST', '/api/manager/attendance', data: {'employeeId': id, 'type': type});
    } else if (type == 'escape') {
      await _request('POST', '/api/escape-events', data: {'employeeId': id, 'type': 'escape'});
    } else if (type == 'return') {
      await _request('POST', '/api/escape-events', data: {'employeeId': id, 'type': 'return'});
    } else if (type == 'reset-device') {
      await _request('DELETE', '/api/employees/$id/device');
    } else if (type == 'delete') {
      await _request('DELETE', '/api/employees/$id');
    }
    await _load();
  }

  Future<void> _updateWorkforce(String id, Map<String, dynamic> patch) async {
    await _request('PATCH', '/api/workforce/live', data: {'employeeId': id, ...patch});
    await _load();
  }

  Future<void> _createRequest(String employeeId, String type) async {
    await _request('POST', '/api/requests', data: {'employeeId': employeeId, 'type': type, 'status': 'approved'});
    await _load();
  }

  Widget _employeesView() {
    final query = _searchController.text.trim().toLowerCase();
    final filtered = _employees.where((raw) {
      if (raw is! Map) return false;
      final employee = Map<String, dynamic>.from(raw);
      final text = '${employee['name'] ?? ''} ${employee['jobNumber'] ?? ''}'.toLowerCase();
      if (query.isNotEmpty && !text.contains(query)) return false;
      final status = _employeeStatus(employee);
      if (_statusFilter != 'all' && status != _statusFilter) return false;
      final schedule = '${employee['scheduleType'] ?? 'ADMIN'}';
      if (_scheduleFilter != 'all' && schedule != _scheduleFilter) return false;
      return true;
    }).toList();
    final active = _employees.where((e) => e is Map && _employeeStatus(Map<String, dynamic>.from(e)) == 'active').length;
    final devices = _employees.where((e) => e is Map && '${e['deviceId'] ?? ''}'.isNotEmpty).length;
    final vip = _employees.where((e) => e is Map && e['vip'] == true).length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [_metric('الإجمالي', '${_employees.length}', Icons.groups_rounded), _metric('النشطون', '$active', Icons.verified_rounded), _metric('الأجهزة', '$devices', Icons.phone_android_rounded), _metric('VIP', '$vip', Icons.star_rounded)]),
      Row(children: [Expanded(child: _searchBox(hint: 'ابحث باسم الموظف أو الرقم', onChanged: (_) => setState(() {}))), const SizedBox(width: 8), FilledButton.icon(onPressed: _addEmployee, icon: const Icon(Icons.person_add), label: const Text('إضافة موظف'))]),
      const SizedBox(height: 10),
      SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [for (final item in {'all': 'الكل', 'active': 'النشطون', 'inactive': 'الموقوفون', 'escaped': 'الهاربون'}.entries) Padding(padding: const EdgeInsets.only(left: 6), child: ChoiceChip(label: Text(item.value), selected: _statusFilter == item.key, onSelected: (_) => setState(() => _statusFilter = item.key))), const SizedBox(width: 8), for (final item in {'all': 'كل الجداول', 'ADMIN': 'إداري', 'ROTATION': 'مناوبات'}.entries) Padding(padding: const EdgeInsets.only(left: 6), child: ChoiceChip(label: Text(item.value), selected: _scheduleFilter == item.key, onSelected: (_) => setState(() => _scheduleFilter = item.key)))])),
      const SizedBox(height: 12),
      if (filtered.isEmpty) _empty('لا توجد موظفون مطابقون للبحث.') else ...filtered.map((raw) {
        final employee = Map<String, dynamic>.from(raw as Map);
        final id = _employeeId(employee);
        final status = _employeeStatus(employee);
        final color = _statusColor(status);
        final location = _locations.whereType<Map>().cast<Map<String, dynamic>?>().firstWhere((l) => l?['id']?.toString() == employee['locationId']?.toString(), orElse: () => null);
        return _card(Container(decoration: BoxDecoration(border: Border(right: BorderSide(color: color, width: 3)), borderRadius: BorderRadius.circular(12)), child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(children: [CircleAvatar(child: Text('${employee['name'] ?? '?'}'.trim().isEmpty ? '?' : '${employee['name']}'.trim()[0])), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${employee['name'] ?? 'موظف'}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)), Text('${employee['jobNumber'] ?? ''} · ${employee['scheduleType'] ?? 'ADMIN'}')])) , Chip(label: Text(status), backgroundColor: color.withAlpha(28))]), const SizedBox(height: 8), Text('العمل: ${employee['workStartTime'] ?? '08:00'} - ${employee['workEndTime'] ?? '16:00'}'), Text('الموقع: ${location?['name'] ?? employee['locationId'] ?? 'غير محدد'}'), Text('الجهاز: ${employee['deviceId'] ?? 'غير مربوط'}'), const SizedBox(height: 8), Wrap(spacing: 6, runSpacing: 6, children: [OutlinedButton.icon(onPressed: () => _createRequest(id, 'permission'), icon: const Icon(Icons.event_available), label: const Text('إذن')), OutlinedButton.icon(onPressed: () => _createRequest(id, 'leave'), icon: const Icon(Icons.beach_access), label: const Text('إجازة')), OutlinedButton.icon(onPressed: () => _employeeAction(id, 'check-in'), icon: const Icon(Icons.login), label: const Text('حضور')), OutlinedButton.icon(onPressed: () => _employeeAction(id, 'check-out'), icon: const Icon(Icons.logout), label: const Text('انصراف')), OutlinedButton.icon(onPressed: () => _employeeAction(id, status == 'escaped' ? 'return' : 'escape'), icon: Icon(status == 'escaped' ? Icons.undo : Icons.warning_amber), label: Text(status == 'escaped' ? 'عودة' : 'هروب')), if ('${employee['deviceId'] ?? ''}'.isNotEmpty) OutlinedButton.icon(onPressed: () => _employeeAction(id, 'reset-device'), icon: const Icon(Icons.phonelink_erase), label: const Text('فصل الجهاز')), OutlinedButton.icon(onPressed: () => _updateWorkforce(id, {'vip': employee['vip'] != true}), icon: Icon(employee['vip'] == true ? Icons.star : Icons.star_border), label: Text(employee['vip'] == true ? 'إلغاء VIP' : 'VIP')), FilledButton.tonalIcon(onPressed: () => _employeeAction(id, 'delete'), icon: const Icon(Icons.delete_outline), label: const Text('حذف'))])]))));
      }),
    ]);
  }

  Widget _requestsView() {
    if (_requests.isEmpty) return _empty('لا توجد طلبات.');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text('إدارة الطلبات (${_requests.length})', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), const SizedBox(height: 10), ..._requests.take(120).map((raw) { final item = Map<String, dynamic>.from(raw as Map); final status = '${item['status'] ?? 'pending'}'; final color = _statusColor(status); return _card(ListTile(leading: Icon(Icons.event_note, color: color), title: Text('${item['type'] ?? 'طلب'} · ${item['employeeName'] ?? item['jobNumber'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${item['date'] ?? item['createdAt'] ?? ''}'), trailing: Wrap(children: [Text(status), if (status == 'pending') IconButton(onPressed: () => _request('PATCH', '/api/requests/${item['id']}', data: {'status': 'approved'}).then((_) => _load()), icon: const Icon(Icons.check))]))); })]);
  }

  Widget _reportsView() {
    final successful = _audit.where((raw) => raw is Map && raw['result'] == 'success' && (raw['action'] == 'check-in' || raw['action'] == 'check-out')).toList();
    final checkIns = successful.where((raw) => (raw as Map)['action'] == 'check-in').length;
    final checkOuts = successful.where((raw) => (raw as Map)['action'] == 'check-out').length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(children: [_metric('سجلات ناجحة', '${successful.length}', Icons.fact_check_rounded), _metric('حضور', '$checkIns', Icons.login_rounded), _metric('انصراف', '$checkOuts', Icons.logout_rounded)]), const SizedBox(height: 12), _card(const ListTile(title: Text('التقرير التفصيلي', style: TextStyle(fontWeight: FontWeight.w900)), subtitle: Text('عمليات الحضور والانصراف المستخرجة من سجل التدقيق.'))), ...successful.take(80).map((raw) { final item = Map<String, dynamic>.from(raw as Map); final color = _statusColor(item['action'] == 'check-in' ? 'active' : 'approved'); return _card(Container(decoration: BoxDecoration(border: Border(right: BorderSide(color: color, width: 3)), borderRadius: BorderRadius.circular(12)), child: ListTile(title: Text('${item['actorName'] ?? item['jobNumber'] ?? 'موظف'} · ${item['action']}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${item['timestamp'] ?? ''} · ${item['distanceMeters'] ?? 0} متر')))); })]);
  }

  Widget _auditView() {
    if (_audit.isEmpty) return _empty('لا توجد أحداث تدقيق.');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(children: [_metric('إجمالي الأحداث', '${_audit.length}', Icons.security_rounded), _metric('ناجح', '${_audit.where((raw) => raw is Map && raw['result'] == 'success').length}', Icons.verified_rounded)]), const SizedBox(height: 12), ..._audit.take(120).map((raw) { final item = Map<String, dynamic>.from(raw as Map); final color = _statusColor('${item['result'] ?? ''}'); return _card(Container(decoration: BoxDecoration(border: Border(right: BorderSide(color: color, width: 3)), borderRadius: BorderRadius.circular(12)), child: ListTile(dense: true, title: Text('${item['action'] ?? 'حدث'} · ${item['actorName'] ?? item['jobNumber'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${item['timestamp'] ?? ''} · ${item['result'] ?? ''}', style: TextStyle(color: color)))); })]);
  }

  Widget _adminsView() {
    final filtered = _admins.where((raw) { if (raw is! Map) return false; final admin = Map<String, dynamic>.from(raw); final query = _adminQuery.trim().toLowerCase(); return query.isEmpty || '${admin['name'] ?? ''} ${admin['username'] ?? ''} ${admin['role'] ?? ''}'.toLowerCase().contains(query); }).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(children: [_metric('الحسابات', '${_admins.length}', Icons.admin_panel_settings_rounded), const Spacer(), FilledButton.icon(onPressed: _addAdmin, icon: const Icon(Icons.person_add), label: const Text('إضافة'))]), const SizedBox(height: 8), TextField(controller: _adminSearchController, onChanged: (v) => setState(() => _adminQuery = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'ابحث بالاسم أو اسم المستخدم أو الصلاحية', border: OutlineInputBorder())), const SizedBox(height: 12), if (filtered.isEmpty) _empty('لا توجد حسابات مطابقة.') else ...filtered.map((raw) { final admin = Map<String, dynamic>.from(raw as Map); final id = '${admin['id'] ?? ''}'; final color = _statusColor(admin['active'] == false ? 'inactive' : 'active'); return _card(Container(decoration: BoxDecoration(border: Border(right: BorderSide(color: color, width: 3)), borderRadius: BorderRadius.circular(12)), child: ListTile(leading: Icon(Icons.admin_panel_settings_rounded, color: color), title: Text('${admin['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('@${admin['username'] ?? ''} · ${admin['role'] ?? ''}'), trailing: Switch(value: admin['active'] != false, onChanged: (value) => _request('PATCH', '/api/admins/$id', data: {'active': value}).then((_) => _load()))))); })]);
  }

  Future<void> _addAdmin() async {
    final name = TextEditingController(); final username = TextEditingController(); final password = TextEditingController();
    await showDialog<void>(context: context, builder: (context) => AlertDialog(title: const Text('إضافة حساب إداري'), content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: name, decoration: const InputDecoration(labelText: 'الاسم')), TextField(controller: username, decoration: const InputDecoration(labelText: 'اسم المستخدم')), TextField(controller: password, decoration: const InputDecoration(labelText: 'كلمة المرور'), obscureText: true)]), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')), FilledButton(onPressed: () async { await _request('POST', '/api/admins', data: {'name': name.text.trim(), 'username': username.text.trim(), 'password': password.text}); if (context.mounted) Navigator.pop(context); await _load(); }, child: const Text('حفظ'))]));
    name.dispose(); username.dispose(); password.dispose();
  }

  Widget _settingsView() {
    if (_settings.isEmpty) return _empty('لا توجد إعدادات متاحة.');
    final rows = _settings.entries.map((entry) => Padding(padding: const EdgeInsets.symmetric(vertical: 7), child: Row(children: [Expanded(child: Text(entry.key, style: const TextStyle(fontWeight: FontWeight.w700))), Flexible(child: Text('${entry.value}', textAlign: TextAlign.left, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)))]))).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Text('إعدادات النظام', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), const SizedBox(height: 8), _card(Padding(padding: const EdgeInsets.all(16), child: Column(children: rows))) ]);
  }

  Widget _empty(String message) => Card(child: Padding(padding: const EdgeInsets.all(28), child: Column(children: [const Icon(Icons.inbox_outlined, size: 42), const SizedBox(height: 10), Text(message, textAlign: TextAlign.center)])));

  @override
  Widget build(BuildContext context) {
    final views = [_employeesView(), _requestsView(), _reportsView(), _auditView(), _adminsView(), _settingsView()];
    const labels = ['الموظفون', 'الطلبات', 'التقارير', 'التدقيق', 'الإدارة', 'الإعدادات'];
    const icons = [Icons.groups_rounded, Icons.event_note_rounded, Icons.bar_chart_rounded, Icons.security_rounded, Icons.admin_panel_settings_rounded, Icons.settings_rounded];
    return Scaffold(appBar: AppBar(title: const Text('إدارة حاضر', style: TextStyle(fontWeight: FontWeight.w900)), leading: IconButton(onPressed: () => context.go('/admin'), icon: const Icon(Icons.arrow_back))), body: _loading ? const Center(child: CircularProgressIndicator()) : _error != null ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48), const SizedBox(height: 12), Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة'))]))) : RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: List.generate(labels.length, (index) => Padding(padding: const EdgeInsets.only(left: 8), child: ChoiceChip(selected: _tab == index, avatar: Icon(icons[index], size: 17), label: Text(labels[index]), onSelected: (_) => setState(() => _tab = index))))), const SizedBox(height: 18), views[_tab]])));
  }
}
