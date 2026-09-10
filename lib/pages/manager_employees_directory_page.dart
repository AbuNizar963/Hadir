import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/session.dart';

/// Flutter implementation of the web ManagerEmployees directory.
/// The legacy management page remains untouched and continues to provide the
/// complete administration surface outside this directory route.
class ManagerEmployeesDirectoryPage extends StatefulWidget {
  const ManagerEmployeesDirectoryPage({super.key});

  @override
  State<ManagerEmployeesDirectoryPage> createState() => _ManagerEmployeesDirectoryPageState();
}

class _ManagerEmployeesDirectoryPageState extends State<ManagerEmployeesDirectoryPage> {
  static const _baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  static const _days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  final _session = HadirSession();
  late final Dio _dio;

  bool _loading = true;
  bool _saving = false;
  String? _error;
  String _query = '';
  String _statusFilter = 'all';
  String _scheduleFilter = 'all';
  String _role = 'manager';
  List<Map<String, dynamic>> _employees = [];
  List<Map<String, dynamic>> _locations = [];
  List<Map<String, dynamic>> _escapes = [];
  Map<String, Map<String, dynamic>> _controls = {};

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

  List<Map<String, dynamic>> _list(dynamic data) {
    if (data is List) return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    if (data is Map) {
      for (final key in const ['data', 'items', 'results', 'employees', 'locations', 'events']) {
        final value = data[key];
        if (value is List) return value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      }
    }
    return [];
  }

  Map<String, Map<String, dynamic>> _controlMap(dynamic data) {
    final result = <String, Map<String, dynamic>>{};
    for (final item in _list(data)) {
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
      final responses = await Future.wait([
        _dio.get('/api/employees'),
        _dio.get('/api/locations'),
        _dio.get('/api/manager/workforce-controls'),
        _dio.get('/api/escape-events', queryParameters: const {'limit': 2000}),
      ]);
      final employees = _list(responses[0].data);
      final locations = _list(responses[1].data);
      final controls = _controlMap(responses[2].data);
      final escapes = _list(responses[3].data);
      if (!mounted) return;
      setState(() {
        _employees = employees;
        _locations = locations;
        _controls = controls;
        _escapes = escapes;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() { _loading = false; _error = _errorMessage(error); });
    }
  }

  Map<String, dynamic> _employee(Map<String, dynamic> raw) {
    final id = '${raw['id'] ?? ''}';
    final control = _controls[id];
    return control == null ? raw : {...raw, ...control};
  }

  String _escapeStatus(String id) {
    final matching = _escapes.where((e) => '${e['employeeId'] ?? ''}' == id).toList();
    if (matching.isEmpty) return 'none';
    matching.sort((a, b) => '${b['createdAt'] ?? b['timestamp'] ?? ''}'.compareTo('${a['createdAt'] ?? a['timestamp'] ?? ''}'));
    final status = '${matching.first['status'] ?? 'none'}'.toLowerCase();
    return status == 'escaped' ? 'escaped' : status == 'returned' ? 'returned' : 'none';
  }

  Map<String, dynamic>? _location(String? id) {
    if (id == null || id.isEmpty) return _locations.cast<Map<String, dynamic>?>().firstWhere((x) => x?['id'] == 'main', orElse: () => null);
    for (final item in _locations) if ('${item['id']}' == id) return item;
    return _locations.cast<Map<String, dynamic>?>().firstWhere((x) => x?['id'] == 'main', orElse: () => null);
  }

  bool get _canManage => _role == 'owner' || _role == 'manager';
  bool get _isOwner => _role == 'owner';
  bool get _canAdd => _canManage || _role == 'supervisor';

  List<Map<String, dynamic>> get _filtered {
    final q = _query.trim().toLowerCase();
    return _employees.map(_employee).where((e) {
      final name = '${e['name'] ?? ''}'.toLowerCase();
      final job = '${e['jobNumber'] ?? ''}'.toLowerCase();
      final device = '${e['deviceLabel'] ?? e['deviceId'] ?? ''}'.toLowerCase();
      final status = '${e['status'] ?? 'active'}';
      final schedule = '${e['scheduleType'] ?? 'ADMIN'}';
      return (q.isEmpty || name.contains(q) || job.contains(q) || device.contains(q)) &&
          (_statusFilter == 'all' || status == _statusFilter) &&
          (_scheduleFilter == 'all' || schedule == _scheduleFilter);
    }).toList();
  }

  Future<void> _request(String method, String path, {Map<String, dynamic>? data}) async {
    try {
      await _dio.request(path, data: data, options: Options(method: method));
      await _load(spinner: false);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    }
  }

  Future<void> _updateWorkforce(Map<String, dynamic> e) async {
    final id = '${e['id'] ?? ''}';
    var vip = e['isVip'] == true;
    var autoIn = e['autoCheckIn'] == true;
    var autoOut = e['autoCheckOut'] == true;
    final result = await showDialog<Map<String, bool>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(builder: (context, setDialogState) => AlertDialog(
        title: Text('قوى العمل · ${e['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w900)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          SwitchListTile(contentPadding: EdgeInsets.zero, value: vip, title: const Text('موظف VIP'), onChanged: (v) => setDialogState(() => vip = v)),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: autoIn, title: const Text('التحضير التلقائي'), onChanged: (v) => setDialogState(() => autoIn = v)),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: autoOut, title: const Text('الانصراف التلقائي'), onChanged: (v) => setDialogState(() => autoOut = v)),
        ]),
        actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(dialogContext, {'isVip': vip, 'autoCheckIn': autoIn, 'autoCheckOut': autoOut}), child: const Text('حفظ'))],
      )),
    );
    if (result == null || id.isEmpty) return;
    await _request('PATCH', '/api/workforce/live', data: {'employeeId': id, ...result});
  }

  Future<void> _confirmAction(String title, String message, Future<void> Function() action) async {
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
      content: Text(message),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton.tonal(onPressed: () => Navigator.pop(c, true), child: const Text('تأكيد'))],
    ));
    if (ok == true) await action();
  }

  Future<void> _directAttendance(Map<String, dynamic> e, bool checkout) async {
    if (!_isOwner || '${e['status'] ?? 'active'}' != 'active') return;
    final id = '${e['id'] ?? ''}';
    await _confirmAction(checkout ? 'انصراف مباشر' : 'تحضير مباشر', 'تأكيد العملية للموظف «${e['name'] ?? ''}»؟', () async {
      await _request('POST', checkout ? '/api/workforce/live' : '/api/manager/attendance', data: {'employeeId': id, 'type': checkout ? 'check-out' : 'check-in'});
    });
  }

  Future<void> _changeEscape(Map<String, dynamic> e, String status) async {
    if (!_canManage) return;
    final note = TextEditingController();
    final confirmed = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(status == 'escaped' ? 'تسجيل هروب' : 'تسجيل عودة', style: const TextStyle(fontWeight: FontWeight.w900)),
      content: TextField(controller: note, maxLines: 3, decoration: const InputDecoration(labelText: 'السبب / الملاحظة')),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('تأكيد'))],
    ));
    if (confirmed == true) await _request('POST', '/api/escape-events', data: {'employeeId': '${e['id']}', 'status': status, 'reason': note.text.trim()});
    note.dispose();
  }

  Future<void> _employeeRequest(Map<String, dynamic> e, String type) async {
    if (!_canManage || '${e['status'] ?? 'active'}' != 'active') return;
    final start = TextEditingController(text: _today());
    final end = TextEditingController(text: _today());
    final reason = TextEditingController();
    final label = type == 'permission' ? 'إذن' : 'إجازة';
    final confirmed = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text('تسجيل $label', style: const TextStyle(fontWeight: FontWeight.w900)),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text('${e['name'] ?? ''} · ${e['jobNumber'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12), TextField(controller: start, decoration: const InputDecoration(labelText: 'أول يوم')),
        const SizedBox(height: 8), TextField(controller: end, decoration: const InputDecoration(labelText: 'آخر يوم')),
        const SizedBox(height: 8), TextField(controller: reason, maxLines: 3, decoration: const InputDecoration(labelText: 'السبب / الملاحظة')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('حفظ الفترة'))],
    ));
    if (confirmed == true && start.text.isNotEmpty && end.text.isNotEmpty) {
      await _request('POST', '/api/requests', data: {'employeeId': '${e['id']}', 'type': type, 'reason': reason.text.trim(), 'startDate': start.text.trim(), 'endDate': end.text.trim()});
    }
    start.dispose(); end.dispose(); reason.dispose();
  }

  String _today() => DateTime.now().toIso8601String().substring(0, 10);

  Future<void> _delete(Map<String, dynamic> e) async {
    if (!_canManage) return;
    await _confirmAction('حذف الموظف؟', 'سيتم حذف حساب «${e['name'] ?? ''}». لا يمكن التراجع عن العملية.', () => _request('DELETE', '/api/employees/${e['id']}'));
  }

  Future<void> _resetDevice(Map<String, dynamic> e) async {
    await _confirmAction('فك ربط الهاتف؟', 'إلغاء ربط جهاز «${e['name'] ?? ''}» من الحساب.', () => _request('POST', '/api/employees/${e['id']}/reset-device'));
  }

  Future<void> _editOrAdd({Map<String, dynamic>? employee}) async {
    final editing = employee != null;
    final e = employee ?? {};
    final name = TextEditingController(text: '${e['name'] ?? ''}');
    final job = TextEditingController(text: '${e['jobNumber'] ?? ''}');
    final pin = TextEditingController();
    final grace = TextEditingController(text: editing ? '${e['gracePeriodMinutes'] ?? 0}' : '');
    final early = TextEditingController(text: editing ? '${e['earlyCheckoutGraceMinutes'] ?? e['earlyCheckoutMinutes'] ?? 0}' : '');
    final rotationStart = TextEditingController(text: '${e['rotationStartDate'] ?? ''}');
    final specialties = TextEditingController(text: e['specialties'] is List ? (e['specialties'] as List).join(', ') : '${e['specialties'] ?? 'general'}');
    var status = '${e['status'] ?? 'active'}';
    var schedule = '${e['scheduleType'] ?? 'ADMIN'}';
    var start = '${e['workStartTime'] ?? '08:00'}';
    var finish = '${e['workEndTime'] ?? '16:00'}';
    var locationId = '${e['locationId'] ?? ''}';
    var rotationOn = int.tryParse('${e['rotationDaysOn'] ?? 7}') ?? 7;
    var rotationOff = int.tryParse('${e['rotationDaysOff'] ?? 7}') ?? 7;
    var workDays = <int>{if (e['workDays'] is List) ...(e['workDays'] as List).map((x) => int.tryParse('$x')).whereType<int>()};
    if (workDays.isEmpty) workDays = {0, 1, 2, 3, 4};
    try {
      final result = await showDialog<bool>(context: context, builder: (dialogContext) => StatefulBuilder(builder: (context, setDialogState) => AlertDialog(
        title: Text(editing ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد', style: const TextStyle(fontWeight: FontWeight.w900)),
        content: SizedBox(width: 620, child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _field(name, 'اسم الموظف', 'اكتب الاسم الكامل'),
          const SizedBox(height: 8), _field(job, 'الرقم الوظيفي', 'مثال: D718075'),
          const SizedBox(height: 8), _field(pin, 'رمز PIN', editing ? 'اختياري — اتركه فارغًا للإبقاء على الحالي' : '4 أحرف/أرقام على الأقل', obscure: true),
          const SizedBox(height: 12), DropdownButtonFormField<String>(initialValue: status, decoration: const InputDecoration(labelText: 'الحالة'), items: const [DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setDialogState(() => status = v ?? status)),
          const SizedBox(height: 16), const Text('الدوام والموقع', style: TextStyle(fontWeight: FontWeight.w900)), const SizedBox(height: 8),
          DropdownButtonFormField<String>(initialValue: schedule, decoration: const InputDecoration(labelText: 'نوع الدوام'), items: const [DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => setDialogState(() => schedule = v ?? schedule)),
          const SizedBox(height: 8), Row(children: [Expanded(child: _timeDropdown('بداية الدوام', start, (v) => setDialogState(() => start = v))), const SizedBox(width: 8), Expanded(child: _timeDropdown('نهاية الدوام', finish, (v) => setDialogState(() => finish = v)))]),
          const SizedBox(height: 8), DropdownButtonFormField<String>(initialValue: _locationOptions(locationId).any((x) => x.value == locationId) ? locationId : '', decoration: const InputDecoration(labelText: 'موقع العمل'), items: _locationOptions(''), onChanged: (v) => setDialogState(() => locationId = v ?? '')),
          const SizedBox(height: 8), Row(children: [Expanded(child: _field(grace, 'فترة السماح بالتأخير', 'بالدقائق', number: true)), const SizedBox(width: 8), Expanded(child: _field(early, 'فترة السماح بالانصراف المبكر', 'بالدقائق', number: true))]),
          const SizedBox(height: 8), _field(specialties, 'نوع العمل / التخصصات', 'مثال: general, technician'),
          if (schedule == 'ADMIN') ...[const SizedBox(height: 12), const Text('أيام الدوام', style: TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 6), Wrap(spacing: 6, runSpacing: 6, children: [for (var i = 0; i < _days.length; i++) FilterChip(label: Text(_days[i]), selected: workDays.contains(i), onSelected: (v) => setDialogState(() { if (v) workDays.add(i); else workDays.remove(i); }))])],
          if (schedule == 'ROTATION') ...[const SizedBox(height: 12), Row(children: [Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOn.clamp(1, 31), decoration: const InputDecoration(labelText: 'أيام العمل'), items: [for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i يوم'))], onChanged: (v) => setDialogState(() => rotationOn = v ?? rotationOn))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOff.clamp(0, 31), decoration: const InputDecoration(labelText: 'أيام الراحة'), items: [const DropdownMenuItem(value: 0, child: Text('بدون راحة')), for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i يوم'))], onChanged: (v) => setDialogState(() => rotationOff = v ?? rotationOff)))]), const SizedBox(height: 8), _field(rotationStart, 'تاريخ أول مناوبة', 'YYYY-MM-DD')],
        ]))),
        actions: [TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('إلغاء')), FilledButton.icon(onPressed: () => Navigator.pop(dialogContext, true), icon: Icon(editing ? Icons.save_rounded : Icons.person_add_alt_1), label: Text(editing ? 'حفظ التعديل' : 'إضافة الموظف'))],
      )));
      if (result != true) return;
      if (name.text.trim().isEmpty || job.text.trim().isEmpty || (!editing && pin.text.trim().length < 4) || (schedule == 'ADMIN' && workDays.isEmpty)) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أكمل الحقول المطلوبة وتأكد من أيام الدوام وPIN.')));
        return;
      }
      _saving = true;
      if (mounted) setState(() {});
      final payload = <String, dynamic>{'name': name.text.trim(), 'jobNumber': job.text.trim(), 'status': status, 'scheduleType': schedule, 'workStartTime': start, 'workEndTime': finish, 'gracePeriodMinutes': int.tryParse(grace.text.trim()) ?? 0, 'workDays': workDays.toList()..sort(), 'rotationDaysOn': rotationOn, 'rotationDaysOff': rotationOff, 'rotationStartDate': rotationStart.text.trim().isEmpty ? null : rotationStart.text.trim(), 'locationId': locationId.isEmpty ? null : locationId, 'specialties': specialties.text.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty).toList()};
      if (pin.text.trim().isNotEmpty) payload['pin'] = pin.text.trim();
      if (editing) {
        await _dio.patch('/api/employees/${e['id']}', data: payload);
        await _dio.put('/api/employees/${e['id']}/checkout-policy', data: {'earlyCheckoutMinutes': (int.tryParse(early.text.trim()) ?? 0).clamp(0, 1440)});
      } else {
        final response = await _dio.post('/api/employees', data: {...payload, 'pin': pin.text.trim(), 'avatar': null});
        final data = response.data;
        final created = data is Map ? data['employee'] : null;
        if (created is Map && '${created['id'] ?? ''}'.isNotEmpty) await _dio.put('/api/employees/${created['id']}/checkout-policy', data: {'earlyCheckoutMinutes': (int.tryParse(early.text.trim()) ?? 0).clamp(0, 1440)});
      }
      await _load(spinner: false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(editing ? 'تم تحديث الموظف بنجاح' : 'تم إضافة الموظف بنجاح')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    } finally {
      _saving = false;
      name.dispose(); job.dispose(); pin.dispose(); grace.dispose(); early.dispose(); rotationStart.dispose(); specialties.dispose();
      if (mounted) setState(() {});
    }
  }

  Widget _field(TextEditingController controller, String label, String hint, {bool obscure = false, bool number = false}) => TextField(controller: controller, obscureText: obscure, keyboardType: number ? TextInputType.number : TextInputType.text, decoration: InputDecoration(labelText: label, hintText: hint));

  Widget _timeDropdown(String label, String value, ValueChanged<String> onChanged) => DropdownButtonFormField<String>(initialValue: _times.contains(value) ? value : '08:00', decoration: InputDecoration(labelText: label), items: _times.map((x) => DropdownMenuItem(value: x, child: Text(x))).toList(), onChanged: (v) => onChanged(v ?? value));

  List<String> get _times => [for (var h = 0; h < 24; h++) for (var m in const [0, 30]) '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}'];

  List<DropdownMenuItem<String>> _locationOptions(String ignored) => [const DropdownMenuItem(value: '', child: Text('المقر الرئيسي')), ..._locations.where((x) => '${x['name'] ?? ''}'.trim() != 'المقر الرئيسي').map((x) => DropdownMenuItem(value: '${x['id'] ?? ''}', child: Text('${x['name'] ?? 'موقع'}')))];

  Widget _metric(String label, int value, IconData icon, Color color) => Expanded(child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: color.withValues(alpha: .07), borderRadius: BorderRadius.circular(16), border: Border.all(color: color.withValues(alpha: .25))), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color)), Icon(icon, size: 16, color: color)]), const SizedBox(height: 8), Text('$value', style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w900))]));

  Widget _statRow() {
    final active = _employees.where((e) => '${e['status'] ?? 'active'}' == 'active').length;
    final suspended = _employees.length - active;
    final devices = _employees.where((e) => '${e['deviceId'] ?? ''}'.trim().isNotEmpty).length;
    final vip = _employees.map(_employee).where((e) => e['isVip'] == true).length;
    final escaped = _employees.where((e) => _escapeStatus('${e['id'] ?? ''}') == 'escaped').length;
    final metrics = [_metric('الإجمالي', _employees.length, Icons.groups_rounded, Colors.lightBlue), _metric('فعال', active, Icons.check_circle_outline_rounded, Colors.green), _metric('موقوف', suspended, Icons.pause_circle_outline_rounded, Colors.red), _metric('أجهزة موثقة', devices, Icons.smartphone_rounded, Colors.deepPurple), _metric('VIP مفعل', vip, Icons.star_rounded, Colors.amber.shade700), _metric('هارب الآن', escaped, Icons.directions_walk_rounded, Colors.red.shade700)];
    return LayoutBuilder(builder: (context, constraints) { final columns = constraints.maxWidth > 900 ? 6 : constraints.maxWidth > 600 ? 3 : 2; return GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: columns, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.7, children: metrics); });
  }

  Widget _action(String label, IconData icon, VoidCallback onTap, Color color) => OutlinedButton(onPressed: onTap, style: OutlinedButton.styleFrom(minimumSize: const Size(0, 52), padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4), foregroundColor: color, side: BorderSide(color: color.withValues(alpha: .28)), backgroundColor: color.withValues(alpha: .045), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, size: 17), const SizedBox(height: 3), Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800))]));

  Widget _employeeCard(Map<String, dynamic> e) {
    final id = '${e['id'] ?? ''}';
    final status = '${e['status'] ?? 'active'}';
    final device = '${e['deviceId'] ?? ''}'.trim().isNotEmpty;
    final escape = _escapeStatus(id);
    final rotation = '${e['scheduleType'] ?? 'ADMIN'}' == 'ROTATION';
    final location = _location('${e['locationId'] ?? ''}');
    final name = '${e['name'] ?? 'بدون اسم'}';
    final initials = name.trim().split(RegExp(r'\s+')).where((x) => x.isNotEmpty).take(2).map((x) => x.characters.first).join();
    final stateColor = escape == 'escaped' || status != 'active' ? Colors.red : device ? Colors.green : Colors.orange;
    return Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: Theme.of(context).dividerColor.withValues(alpha: .7))), child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [CircleAvatar(radius: 20, backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: .10), child: Text(initials.isEmpty ? 'م' : initials, style: TextStyle(fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary))), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)), Text('${e['jobNumber'] ?? ''}', style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor))])), Wrap(spacing: 4, children: [Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 8), decoration: BoxDecoration(color: stateColor, shape: BoxShape.circle)), _badge(status == 'active' ? 'فعال' : 'موقوف', status == 'active' ? Colors.green : Colors.red), if (e['isVip'] == true) _badge('★ VIP', Colors.amber.shade700)])]),
      const SizedBox(height: 10), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, childAspectRatio: 3.1, crossAxisSpacing: 6, mainAxisSpacing: 6, children: [_info('الدوام', rotation ? 'تناوبي' : 'إداري'), _info('الموقع', '${location?['name'] ?? 'المقر الرئيسي'}'), _info('الوقت', rotation ? '${e['rotationDaysOn'] ?? 0} عمل / ${e['rotationDaysOff'] ?? 0} راحة' : '${e['workStartTime'] ?? '--:--'} → ${e['workEndTime'] ?? '--:--'}'), _info('الحالة الميدانية', escape == 'escaped' ? 'هارب من العمل' : escape == 'returned' ? 'عاد للعمل' : 'طبيعي')]),
      const SizedBox(height: 8), Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('التأخير: ${e['gracePeriodMinutes'] ?? 0} دقيقة', style: const TextStyle(fontSize: 10)), Text('الانصراف المبكر: ${e['earlyCheckoutGraceMinutes'] ?? e['earlyCheckoutMinutes'] ?? 0} دقيقة', style: const TextStyle(fontSize: 10))]),
      const SizedBox(height: 8), Container padding = const EdgeInsets.symmetric(horizontal: 8, vertical: 7);
    ])));
  }

  Widget _badge(String text, Color color) => Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4), decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(999), border: Border.all(color: color.withValues(alpha: .25))), child: Text(text, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color)));
  Widget _info(String label, String value) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .35), borderRadius: BorderRadius.circular(11), border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: .45))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(label, style: TextStyle(fontSize: 9, color: Theme.of(context).hintColor)), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800))]));

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 32), children: [
        Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: .25)), color: Theme.of(context).colorScheme.primary.withValues(alpha: .025)), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('EMPLOYEE DIRECTORY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary, letterSpacing: .8)), const SizedBox(height: 4), const Text('إدارة الموظفين', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text('دليل الموظفين الموحد — البيانات من النظام مباشرة.', style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor))])), Wrap(spacing: 8, runSpacing: 8, children: [if (_canAdd) FilledButton.icon(onPressed: _saving ? null : () => _editOrAdd(), icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة موظف'))])]),
        ])),
        const SizedBox(height: 14),
        _statRow(),
        const SizedBox(height: 14),
        Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)), child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('LIVE DIRECTORY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)), const SizedBox(height: 3), Text('قائمة الموظفين (${filtered.length})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))])), IconButton(onPressed: _loading ? null : () => _load(), icon: const Icon(Icons.refresh_rounded))]), const SizedBox(height: 10),
          TextField(onChanged: (v) => setState(() => _query = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'بحث بالاسم أو الرقم أو الجهاز', isDense: true)), const SizedBox(height: 8),
          Row(children: [Expanded(child: DropdownButtonFormField<String>(initialValue: _statusFilter, decoration: const InputDecoration(labelText: 'الحالة', isDense: true), items: const [DropdownMenuItem(value: 'all', child: Text('كل الحالات')), DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setState(() => _statusFilter = v ?? 'all'))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<String>(initialValue: _scheduleFilter, decoration: const InputDecoration(labelText: 'نوع الدوام', isDense: true), items: const [DropdownMenuItem(value: 'all', child: Text('كل أنواع الدوام')), DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => setState(() => _scheduleFilter = v ?? 'all')))]),
        ])),
        if (_loading) const Padding(padding: EdgeInsets.all(50), child: Center(child: CircularProgressIndicator())) else if (_error != null) Padding(padding: const EdgeInsets.all(20), child: Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [const Icon(Icons.cloud_off_rounded, size: 42), const SizedBox(height: 8), Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 10), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة'))])))) else if (filtered.isEmpty) Padding(padding: const EdgeInsets.all(40), child: Column(children: [Icon(Icons.search_off_rounded, size: 42, color: Theme.of(context).hintColor), const SizedBox(height: 8), const Text('لا توجد نتائج', style: TextStyle(fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text('جرّب تغيير البحث أو الفلاتر.', style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor))])) else Padding(padding: const EdgeInsets.only(top: 12), child: LayoutBuilder(builder: (context, constraints) { final columns = constraints.maxWidth > 1200 ? 4 : constraints.maxWidth > 760 ? 3 : constraints.maxWidth > 480 ? 2 : 1; return GridView.builder(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), itemCount: filtered.length, gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: columns, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: columns == 1 ? .82 : columns == 2 ? .78 : .72), itemBuilder: (context, index) { final e = filtered[index]; return _cardWithActions(e); }); })),
      ])),
    );
  }

  Widget _cardWithActions(Map<String, dynamic> e) {
    final id = '${e['id'] ?? ''}';
    final status = '${e['status'] ?? 'active'}';
    final device = '${e['deviceId'] ?? ''}'.trim().isNotEmpty;
    final escape = _escapeStatus(id);
    final rotation = '${e['scheduleType'] ?? 'ADMIN'}' == 'ROTATION';
    final location = _location('${e['locationId'] ?? ''}');
    final name = '${e['name'] ?? 'بدون اسم'}';
    final initials = name.trim().split(RegExp(r'\s+')).where((x) => x.isNotEmpty).take(2).map((x) => x.substring(0, 1)).join();
    final stateColor = escape == 'escaped' || status != 'active' ? Colors.red : device ? Colors.green : Colors.orange;
    final actions = <Widget>[];
    if (_canManage && status == 'active') { actions.add(_action('إذن', Icons.event_note_rounded, () => _employeeRequest(e, 'permission'), Colors.blue)); actions.add(_action('إجازة', Icons.calendar_month_rounded, () => _employeeRequest(e, 'leave'), Colors.deepPurple)); }
    if (_isOwner && status == 'active') { actions.add(_action('تحضير', Icons.login_rounded, () => _directAttendance(e, false), Colors.green)); actions.add(_action('انصراف', Icons.logout_rounded, () => _directAttendance(e, true), Colors.orange)); }
    if (_canManage && status == 'active' && escape != 'escaped') actions.add(_action('هروب', Icons.directions_walk_rounded, () => _changeEscape(e, 'escaped'), Colors.red));
    if (_canManage && escape == 'escaped') actions.add(_action('عودة', Icons.undo_rounded, () => _changeEscape(e, 'returned'), Colors.green));
    if (_canManage) { actions.add(_action('تعديل', Icons.edit_rounded, () => _editOrAdd(employee: e), Theme.of(context).colorScheme.primary)); actions.add(_action('حذف', Icons.delete_outline_rounded, () => _delete(e), Colors.red)); }
    if (device) actions.add(_action('الجهاز', Icons.smartphone_rounded, () => _resetDevice(e), Theme.of(context).hintColor));
    return Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: Theme.of(context).dividerColor.withValues(alpha: .7))), child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [CircleAvatar(radius: 20, backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: .10), child: Text(initials.isEmpty ? 'م' : initials, style: TextStyle(fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary))), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)), Text('${e['jobNumber'] ?? ''}', style: TextStyle(fontSize: 10, color: Theme.of(context).hintColor))])), Wrap(spacing: 4, children: [Container(margin: const EdgeInsets.only(top: 8), width: 8, height: 8, decoration: BoxDecoration(color: stateColor, shape: BoxShape.circle)), _badge(status == 'active' ? 'فعال' : 'موقوف', status == 'active' ? Colors.green : Colors.red), if (e['isVip'] == true) _badge('★ VIP', Colors.amber.shade700)])]),
      const SizedBox(height: 10), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, childAspectRatio: 2.9, crossAxisSpacing: 6, mainAxisSpacing: 6, children: [_info('الدوام', rotation ? 'تناوبي' : 'إداري'), _info('الموقع', '${location?['name'] ?? 'المقر الرئيسي'}'), _info('الوقت', rotation ? '${e['rotationDaysOn'] ?? 0} عمل / ${e['rotationDaysOff'] ?? 0} راحة' : '${e['workStartTime'] ?? '--:--'} → ${e['workEndTime'] ?? '--:--'}'), _info('الحالة الميدانية', escape == 'escaped' ? 'هارب من العمل' : escape == 'returned' ? 'عاد للعمل' : 'طبيعي')]),
      const SizedBox(height: 8), Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Flexible(child: Text('التأخير: ${e['gracePeriodMinutes'] ?? 0} دقيقة', style: const TextStyle(fontSize: 9))), Flexible(child: Text('الانصراف المبكر: ${e['earlyCheckoutGraceMinutes'] ?? e['earlyCheckoutMinutes'] ?? 0} دقيقة', textAlign: TextAlign.end, style: const TextStyle(fontSize: 9)))]),
      const SizedBox(height: 8), Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .22), borderRadius: BorderRadius.circular(12), border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: .5))), child: Row(children: [OutlinedButton.icon(onPressed: _isOwner ? () => _updateWorkforce(e) : null, icon: const Icon(Icons.star_rounded, size: 15), label: const Text('VIP', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900)), style: OutlinedButton.styleFrom(foregroundColor: e['isVip'] == true ? Colors.amber.shade700 : null)), const SizedBox(width: 8), Expanded(child: Text(e['isVip'] == true ? 'تحضير + انصراف تلقائي' : 'تشغيل تلقائي عند التفعيل', style: TextStyle(fontSize: 9, color: Theme.of(context).hintColor))) ])),
      const SizedBox(height: 8), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: actions.length > 6 ? 4 : actions.length.clamp(1, 4), crossAxisSpacing: 5, mainAxisSpacing: 5, childAspectRatio: .88, children: actions),
    ]));
  }
}
