import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/session.dart';

/// Flutter counterpart of the web ManagerEmployees directory.
/// The preserved legacy management page is not modified by this screen.
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
  String? _error;
  String _query = '';
  String _statusFilter = 'all';
  String _scheduleFilter = 'all';
  List<Map<String, dynamic>> _employees = [];
  List<Map<String, dynamic>> _locations = [];
  List<Map<String, dynamic>> _escapeEvents = [];
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

  List<Map<String, dynamic>> _asList(dynamic data) {
    if (data is List) {
      return data.whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
    }
    if (data is Map) {
      for (final key in const ['data', 'items', 'results', 'employees', 'locations', 'events']) {
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
        _dio.get('/api/employees'),
        _dio.get('/api/locations'),
        _dio.get('/api/manager/workforce-controls'),
        _dio.get('/api/escape-events', queryParameters: const {'limit': 2000}),
      ]);
      if (!mounted) return;
      setState(() {
        _employees = _asList(results[0].data);
        _locations = _asList(results[1].data);
        _controls = _asControls(results[2].data);
        _escapeEvents = _asList(results[3].data);
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() { _loading = false; _error = _errorMessage(error); });
    }
  }

  Map<String, dynamic> _merged(Map<String, dynamic> employee) {
    final control = _controls['${employee['id'] ?? ''}'];
    return control == null ? employee : {...employee, ...control};
  }

  String _escapeState(String id) {
    final events = _escapeEvents.where((e) => '${e['employeeId'] ?? ''}' == id).toList();
    if (events.isEmpty) return 'none';
    events.sort((a, b) => '${b['timestamp'] ?? b['createdAt'] ?? ''}'.compareTo('${a['timestamp'] ?? a['createdAt'] ?? ''}'));
    final state = '${events.first['status'] ?? ''}'.toLowerCase();
    return state == 'escaped' ? 'escaped' : state == 'returned' ? 'returned' : 'none';
  }

  String _locationName(String id) {
    for (final location in _locations) {
      if ('${location['id']}' == id) return '${location['name'] ?? 'موقع'}';
    }
    return 'المقر الرئيسي';
  }

  List<Map<String, dynamic>> get _filtered {
    final q = _query.trim().toLowerCase();
    return _employees.map(_merged).where((e) {
      final name = '${e['name'] ?? ''}'.toLowerCase();
      final job = '${e['jobNumber'] ?? ''}'.toLowerCase();
      final device = '${e['deviceLabel'] ?? e['deviceId'] ?? ''}'.toLowerCase();
      final employeeStatus = '${e['status'] ?? 'active'}';
      final employeeSchedule = '${e['scheduleType'] ?? 'ADMIN'}';
      return (q.isEmpty || name.contains(q) || job.contains(q) || device.contains(q)) &&
          (_statusFilter == 'all' || employeeStatus == _statusFilter) &&
          (_scheduleFilter == 'all' || employeeSchedule == _scheduleFilter);
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

  Future<bool> _confirm(String title, String body) async {
    return await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
            content: Text(body),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
              FilledButton.tonal(onPressed: () => Navigator.pop(c, true), child: const Text('تأكيد')),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _workforce(Map<String, dynamic> employee) async {
    final id = '${employee['id'] ?? ''}';
    final enabled = employee['isVip'] != true;
    await _request('PATCH', '/api/workforce/live', data: {
      'employeeId': id,
      'isVip': enabled,
      'autoCheckIn': enabled,
      'autoCheckOut': enabled,
    });
  }

  Future<void> _attendance(Map<String, dynamic> employee, String type) async {
    if (!await _confirm(type == 'check-in' ? 'تحضير مباشر' : 'انصراف مباشر', 'تأكيد العملية للموظف «${employee['name'] ?? ''}»؟')) return;
    await _request('POST', type == 'check-in' ? '/api/manager/attendance' : '/api/workforce/live', data: {'employeeId': '${employee['id']}', 'type': type});
  }

  Future<void> _escape(Map<String, dynamic> employee, String state) async {
    final note = TextEditingController();
    final ok = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: Text(state == 'escaped' ? 'تسجيل هروب' : 'تسجيل عودة'),
            content: TextField(controller: note, maxLines: 3, decoration: const InputDecoration(labelText: 'السبب / الملاحظة')),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('تأكيد')),
            ],
          ),
        ) ??
        false;
    if (ok) await _request('POST', '/api/escape-events', data: {'employeeId': '${employee['id']}', 'status': state, 'reason': note.text.trim()});
    note.dispose();
  }

  Future<void> _employeeRequest(Map<String, dynamic> employee, String type) async {
    final today = DateTime.now().toIso8601String().split('T').first;
    final start = TextEditingController(text: today);
    final end = TextEditingController(text: today);
    final reason = TextEditingController();
    final label = type == 'permission' ? 'إذن' : 'إجازة';
    final ok = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: Text('تسجيل $label', style: const TextStyle(fontWeight: FontWeight.w900)),
            content: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('${employee['name'] ?? ''} · ${employee['jobNumber'] ?? ''}'),
              const SizedBox(height: 10),
              TextField(controller: start, decoration: const InputDecoration(labelText: 'أول يوم')),
              const SizedBox(height: 8),
              TextField(controller: end, decoration: const InputDecoration(labelText: 'آخر يوم')),
              const SizedBox(height: 8),
              TextField(controller: reason, maxLines: 3, decoration: const InputDecoration(labelText: 'السبب / الملاحظة')),
            ]),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('حفظ الفترة')),
            ],
          ),
        ) ??
        false;
    if (ok && start.text.trim().isNotEmpty && end.text.trim().isNotEmpty) {
      await _request('POST', '/api/requests', data: {'employeeId': '${employee['id']}', 'type': type, 'reason': reason.text.trim(), 'startDate': start.text.trim(), 'endDate': end.text.trim()});
    }
    start.dispose();
    end.dispose();
    reason.dispose();
  }

  Future<void> _delete(Map<String, dynamic> employee) async {
    if (await _confirm('حذف الموظف؟', 'سيتم حذف حساب «${employee['name'] ?? ''}». لا يمكن التراجع عن العملية.')) {
      await _request('DELETE', '/api/employees/${employee['id']}');
    }
  }

  Future<void> _resetDevice(Map<String, dynamic> employee) async {
    if (await _confirm('فك ربط الهاتف؟', 'إلغاء ربط جهاز «${employee['name'] ?? ''}».')) {
      await _request('DELETE', '/api/employees/${employee['id']}/device');
    }
  }

  Widget _field(TextEditingController controller, String label, String hint, {bool obscure = false, bool number = false}) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: number ? TextInputType.number : TextInputType.text,
      decoration: InputDecoration(labelText: label, hintText: hint),
    );
  }

  List<DropdownMenuItem<String>> _locationItems() {
    return [
      const DropdownMenuItem(value: '', child: Text('المقر الرئيسي')),
      ..._locations.where((x) => '${x['name'] ?? ''}'.trim() != 'المقر الرئيسي').map((x) => DropdownMenuItem(value: '${x['id'] ?? ''}', child: Text('${x['name'] ?? 'موقع'}'))),
    ];
  }

  Future<void> _edit(Map<String, dynamic> employee) async {
    final name = TextEditingController(text: '${employee['name'] ?? ''}');
    final job = TextEditingController(text: '${employee['jobNumber'] ?? ''}');
    final pin = TextEditingController();
    final grace = TextEditingController(text: '${employee['gracePeriodMinutes'] ?? 0}');
    final early = TextEditingController(text: '${employee['earlyCheckoutGraceMinutes'] ?? employee['earlyCheckoutMinutes'] ?? 0}');
    final rotationStart = TextEditingController(text: '${employee['rotationStartDate'] ?? ''}');
    final specialties = TextEditingController(text: employee['specialties'] is List ? (employee['specialties'] as List).join(', ') : '${employee['specialties'] ?? 'general'}');
    var employeeStatus = '${employee['status'] ?? 'active'}';
    var kind = '${employee['scheduleType'] ?? 'ADMIN'}';
    var start = '${employee['workStartTime'] ?? '08:00'}';
    var finish = '${employee['workEndTime'] ?? '16:00'}';
    var location = '${employee['locationId'] ?? ''}';
    var rotationOn = int.tryParse('${employee['rotationDaysOn'] ?? 7}') ?? 7;
    var rotationOff = int.tryParse('${employee['rotationDaysOff'] ?? 7}') ?? 7;
    var workDays = <int>{if (employee['workDays'] is List) ...(employee['workDays'] as List).map((x) => int.tryParse('$x')).whereType<int>()};
    if (workDays.isEmpty) workDays = {0, 1, 2, 3, 4};

    final ok = await showDialog<bool>(
          context: context,
          builder: (c) => StatefulBuilder(
            builder: (context, setDialogState) => AlertDialog(
              title: const Text('تعديل بيانات الموظف', style: TextStyle(fontWeight: FontWeight.w900)),
              content: SizedBox(
                width: 620,
                child: SingleChildScrollView(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    _field(name, 'اسم الموظف', 'اكتب الاسم الكامل'),
                    const SizedBox(height: 8),
                    _field(job, 'الرقم الوظيفي', 'مثال: D718075'),
                    const SizedBox(height: 8),
                    _field(pin, 'PIN جديد', 'اختياري', obscure: true),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(initialValue: employeeStatus, decoration: const InputDecoration(labelText: 'الحالة'), items: const [DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setDialogState(() => employeeStatus = v ?? employeeStatus)),
                    const SizedBox(height: 14),
                    DropdownButtonFormField<String>(initialValue: kind, decoration: const InputDecoration(labelText: 'نوع الدوام'), items: const [DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => setDialogState(() => kind = v ?? kind)),
                    const SizedBox(height: 8),
                    Row(children: [Expanded(child: _timeDropdown(start, 'بداية الدوام', (v) => setDialogState(() => start = v))), const SizedBox(width: 8), Expanded(child: _timeDropdown(finish, 'نهاية الدوام', (v) => setDialogState(() => finish = v)))]),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(initialValue: _locationItems().any((x) => x.value == location) ? location : '', decoration: const InputDecoration(labelText: 'موقع العمل'), items: _locationItems(), onChanged: (v) => setDialogState(() => location = v ?? '')),
                    const SizedBox(height: 8),
                    Row(children: [Expanded(child: _field(grace, 'سماح التأخير', 'دقائق', number: true)), const SizedBox(width: 8), Expanded(child: _field(early, 'سماح الانصراف المبكر', 'دقائق', number: true))]),
                    const SizedBox(height: 8),
                    _field(specialties, 'نوع العمل / التخصصات', 'general, technician'),
                    if (kind == 'ADMIN') ...[
                      const SizedBox(height: 10),
                      const Text('أيام الدوام', style: TextStyle(fontWeight: FontWeight.w800)),
                      Wrap(spacing: 5, runSpacing: 5, children: [for (var i = 0; i < _days.length; i++) FilterChip(label: Text(_days[i]), selected: workDays.contains(i), onSelected: (v) => setDialogState(() { if (v) workDays.add(i); else workDays.remove(i); }))]),
                    ],
                    if (kind == 'ROTATION') ...[
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOn.clamp(1, 31).toInt(), decoration: const InputDecoration(labelText: 'أيام العمل'), items: [for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i يوم'))], onChanged: (v) => setDialogState(() => rotationOn = v ?? rotationOn))),
                        const SizedBox(width: 8),
                        Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOff.clamp(0, 31).toInt(), decoration: const InputDecoration(labelText: 'أيام الراحة'), items: [const DropdownMenuItem(value: 0, child: Text('بدون راحة')), for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i يوم'))], onChanged: (v) => setDialogState(() => rotationOff = v ?? rotationOff))),
                      ]),
                      const SizedBox(height: 8),
                      _field(rotationStart, 'تاريخ أول مناوبة', 'YYYY-MM-DD'),
                    ],
                  ]),
                ),
              ),
              actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('حفظ التعديل'))],
            ),
          ),
        ) ??
        false;

    if (ok) {
      final payload = <String, dynamic>{
        'name': name.text.trim(),
        'jobNumber': job.text.trim(),
        'status': employeeStatus,
        'scheduleType': kind,
        'workStartTime': start,
        'workEndTime': finish,
        'gracePeriodMinutes': int.tryParse(grace.text.trim()) ?? 0,
        'workDays': workDays.toList()..sort(),
        'rotationDaysOn': rotationOn,
        'rotationDaysOff': rotationOff,
        'rotationStartDate': rotationStart.text.trim().isEmpty ? null : rotationStart.text.trim(),
        'locationId': location.isEmpty ? null : location,
        'specialties': specialties.text.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty).toList(),
      };
      if (pin.text.trim().isNotEmpty) payload['pin'] = pin.text.trim();
      await _request('PATCH', '/api/employees/${employee['id']}', data: payload);
      await _request('PUT', '/api/employees/${employee['id']}/checkout-policy', data: {'earlyCheckoutMinutes': (int.tryParse(early.text.trim()) ?? 0).clamp(0, 1440)});
    }
    name.dispose();
    job.dispose();
    pin.dispose();
    grace.dispose();
    early.dispose();
    rotationStart.dispose();
    specialties.dispose();
  }

  Widget _timeDropdown(String value, String label, ValueChanged<String> onChanged) {
    final values = [for (var h = 0; h < 24; h++) for (final m in const [0, 30]) '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}'];
    final selected = values.contains(value) ? value : '08:00';
    return DropdownButtonFormField<String>(initialValue: selected, decoration: InputDecoration(labelText: label), items: values.map((x) => DropdownMenuItem(value: x, child: Text(x))).toList(), onChanged: (v) => onChanged(v ?? selected));
  }

  Widget _metric(String label, int value, Color color, IconData icon) {
    return Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: color.withValues(alpha: .07), borderRadius: BorderRadius.circular(15), border: Border.all(color: color.withValues(alpha: .25))), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color)), Icon(icon, size: 15, color: color)]), const SizedBox(height: 7), Text('$value', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900))]));
  }

  Widget _badge(String text, Color color) {
    return Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4), decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(99), border: Border.all(color: color.withValues(alpha: .25))), child: Text(text, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color)));
  }

  Widget _info(String label, String value) {
    return Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .30), borderRadius: BorderRadius.circular(10)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(label, style: TextStyle(fontSize: 8, color: Theme.of(context).hintColor)), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800))]));
  }

  Widget _action(String label, IconData icon, VoidCallback onTap, Color color) {
    return OutlinedButton(onPressed: onTap, style: OutlinedButton.styleFrom(minimumSize: const Size(0, 50), padding: const EdgeInsets.all(2), foregroundColor: color, side: BorderSide(color: color.withValues(alpha: .25)), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11))), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, size: 16), const SizedBox(height: 2), Text(label, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w800))]));
  }

  Widget _employeeCard(Map<String, dynamic> e) {
    final id = '${e['id'] ?? ''}';
    final employeeStatus = '${e['status'] ?? 'active'}';
    final device = '${e['deviceId'] ?? ''}'.trim().isNotEmpty;
    final escapeStatus = _escapeState(id);
    final rotation = '${e['scheduleType'] ?? 'ADMIN'}' == 'ROTATION';
    final stateColor = escapeStatus == 'escaped' || employeeStatus != 'active' ? Colors.red : device ? Colors.green : Colors.orange;
    final actions = <Widget>[];
    if (employeeStatus == 'active') {
      actions.add(_action('إذن', Icons.event_note_rounded, () => _employeeRequest(e, 'permission'), Colors.blue));
      actions.add(_action('إجازة', Icons.calendar_month_rounded, () => _employeeRequest(e, 'leave'), Colors.deepPurple));
      actions.add(_action('تحضير', Icons.login_rounded, () => _attendance(e, 'check-in'), Colors.green));
      actions.add(_action('انصراف', Icons.logout_rounded, () => _attendance(e, 'check-out'), Colors.orange));
    }
    if (employeeStatus == 'active' && escapeStatus != 'escaped') actions.add(_action('هروب', Icons.directions_walk_rounded, () => _escape(e, 'escaped'), Colors.red));
    if (escapeStatus == 'escaped') actions.add(_action('عودة', Icons.undo_rounded, () => _escape(e, 'returned'), Colors.green));
    actions.add(_action('تعديل', Icons.edit_rounded, () => _edit(e), Theme.of(context).colorScheme.primary));
    actions.add(_action('حذف', Icons.delete_outline_rounded, () => _delete(e), Colors.red));
    if (device) actions.add(_action('الجهاز', Icons.smartphone_rounded, () => _resetDevice(e), Theme.of(context).hintColor));

    final name = '${e['name'] ?? 'بدون اسم'}';
    final initials = name.trim().split(RegExp(r'\s+')).where((x) => x.isNotEmpty).take(2).map((x) => x.substring(0, 1)).join();
    final initial = initials.isEmpty ? 'م' : initials;
    final earlyCheckout = (e['earlyCheckoutGraceMinutes'] ?? e['earlyCheckoutMinutes'] ?? 0) is num ? ((e['earlyCheckoutGraceMinutes'] ?? e['earlyCheckoutMinutes'] ?? 0) as num).toInt() : int.tryParse('${e['earlyCheckoutGraceMinutes'] ?? e['earlyCheckoutMinutes'] ?? 0}') ?? 0;
    return Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: Theme.of(context).dividerColor.withValues(alpha: .7))), child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [CircleAvatar(radius: 20, backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: .10), child: Text(initial, style: TextStyle(fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary))), const SizedBox(width: 9), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)), Text('${e['jobNumber'] ?? ''}', style: TextStyle(fontSize: 10, color: Theme.of(context).hintColor))])), Wrap(spacing: 3, children: [Container(margin: const EdgeInsets.only(top: 8), width: 8, height: 8, decoration: BoxDecoration(color: stateColor, shape: BoxShape.circle)), _badge(employeeStatus == 'active' ? 'فعال' : 'موقوف', employeeStatus == 'active' ? Colors.green : Colors.red), if (e['isVip'] == true) _badge('★ VIP', Colors.amber.shade700)])]),
      const SizedBox(height: 9),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, childAspectRatio: 2.9, crossAxisSpacing: 5, mainAxisSpacing: 5, children: [_info('الدوام', rotation ? 'تناوبي' : 'إداري'), _info('الموقع', _locationName('${e['locationId'] ?? ''}')), _info('الوقت', rotation ? '${e['rotationDaysOn'] ?? 0} عمل / ${e['rotationDaysOff'] ?? 0} راحة' : '${e['workStartTime'] ?? '--:--'} → ${e['workEndTime'] ?? '--:--'}'), _info('الحالة الميدانية', escapeStatus == 'escaped' ? 'هارب من العمل' : escapeStatus == 'returned' ? 'عاد للعمل' : 'طبيعي')]),
      const SizedBox(height: 7),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Flexible(child: Text('التأخير: ${e['gracePeriodMinutes'] ?? 0} دقيقة', style: const TextStyle(fontSize: 9))), Flexible(child: Text(earlyCheckout == 0 ? 'الانصراف المبكر: بعد انتهاء الدوام' : 'الانصراف المبكر: $earlyCheckout دقيقة', textAlign: TextAlign.end, style: const TextStyle(fontSize: 9)))]),
      const SizedBox(height: 7),
      Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .22), borderRadius: BorderRadius.circular(11)), child: Row(children: [OutlinedButton.icon(onPressed: () => _workforce(e), icon: const Icon(Icons.star_rounded, size: 15), label: const Text('VIP', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900))), const SizedBox(width: 7), Expanded(child: Text(e['isVip'] == true ? 'تحضير + انصراف تلقائي' : 'تشغيل تلقائي عند التفعيل', style: TextStyle(fontSize: 9, color: Theme.of(context).hintColor)))])),
      const SizedBox(height: 7),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 4, crossAxisSpacing: 4, mainAxisSpacing: 4, childAspectRatio: .90, children: actions),
    ])));
  }

  @override
  Widget build(BuildContext context) {
    final list = _filtered;
    final active = _employees.where((e) => '${e['status'] ?? 'active'}' == 'active').length;
    final suspended = _employees.length - active;
    final devices = _employees.where((e) => '${e['deviceId'] ?? ''}'.trim().isNotEmpty).length;
    final vip = _employees.map(_merged).where((e) => e['isVip'] == true).length;
    final escaped = _employees.where((e) => _escapeState('${e['id'] ?? ''}') == 'escaped').length;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 32), children: [
          Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: .25)), color: Theme.of(context).colorScheme.primary.withValues(alpha: .025)), child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('EMPLOYEE DIRECTORY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)), const SizedBox(height: 4), const Text('إدارة الموظفين', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900)), Text('دليل الموظفين الموحد — البيانات من النظام مباشرة.', style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor))])), FilledButton.icon(onPressed: _addEmployee, icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة موظف'))])),
          const SizedBox(height: 12),
          LayoutBuilder(builder: (context, c) { final columns = c.maxWidth > 900 ? 6 : c.maxWidth > 600 ? 3 : 2; return GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: columns, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 1.7, children: [_metric('الإجمالي', _employees.length, Colors.lightBlue, Icons.groups_rounded), _metric('فعال', active, Colors.green, Icons.check_circle_outline_rounded), _metric('موقوف', suspended, Colors.red, Icons.pause_circle_outline_rounded), _metric('أجهزة موثقة', devices, Colors.deepPurple, Icons.smartphone_rounded), _metric('VIP مفعل', vip, Colors.amber.shade700, Icons.star_rounded), _metric('هارب الآن', escaped, Colors.red.shade700, Icons.directions_walk_rounded)]); }),
          const SizedBox(height: 12),
          Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)), child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('LIVE DIRECTORY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)), Text('قائمة الموظفين (${list.length})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))])), IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded))]), const SizedBox(height: 9), TextField(onChanged: (v) => setState(() => _query = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'بحث بالاسم أو الرقم أو الجهاز', isDense: true)), const SizedBox(height: 8), Row(children: [Expanded(child: DropdownButtonFormField<String>(initialValue: _statusFilter, decoration: const InputDecoration(labelText: 'الحالة', isDense: true), items: const [DropdownMenuItem(value: 'all', child: Text('كل الحالات')), DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setState(() => _statusFilter = v ?? 'all'))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<String>(initialValue: _scheduleFilter, decoration: const InputDecoration(labelText: 'نوع الدوام', isDense: true), items: const [DropdownMenuItem(value: 'all', child: Text('كل أنواع الدوام')), DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => setState(() => _scheduleFilter = v ?? 'all')))]),
          ]))),
          if (_loading) const Padding(padding: EdgeInsets.all(45), child: Center(child: CircularProgressIndicator())) else if (_error != null) Padding(padding: const EdgeInsets.all(24), child: Column(children: [const Icon(Icons.cloud_off_rounded, size: 42), const SizedBox(height: 8), Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 8), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة'))])) else if (list.isEmpty) const Padding(padding: EdgeInsets.all(40), child: Column(children: [Icon(Icons.search_off_rounded, size: 42), SizedBox(height: 8), Text('لا توجد نتائج', style: TextStyle(fontWeight: FontWeight.w900)), SizedBox(height: 4), Text('جرّب تغيير البحث أو الفلاتر.')])) else Padding(padding: const EdgeInsets.only(top: 12), child: LayoutBuilder(builder: (context, c) { final columns = c.maxWidth > 1200 ? 4 : c.maxWidth > 760 ? 3 : c.maxWidth > 480 ? 2 : 1; return GridView.builder(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), itemCount: list.length, gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: columns, crossAxisSpacing: 9, mainAxisSpacing: 9, childAspectRatio: columns == 1 ? .72 : .68), itemBuilder: (_, i) => _employeeCard(list[i])); })),
        ],
      ),
    ));
  }

  Future<void> _addEmployee() async {
    final name = TextEditingController();
    final job = TextEditingController();
    final pin = TextEditingController();
    final grace = TextEditingController();
    final early = TextEditingController();
    final specialties = TextEditingController(text: 'general');
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: const Text('إضافة موظف جديد', style: TextStyle(fontWeight: FontWeight.w900)), content: SingleChildScrollView(child: Column(children: [_field(name, 'اسم الموظف', 'اكتب الاسم الكامل'), const SizedBox(height: 8), _field(job, 'الرقم الوظيفي', 'مثال: D718075'), const SizedBox(height: 8), _field(pin, 'رمز PIN', '4 أحرف/أرقام على الأقل', obscure: true), const SizedBox(height: 8), _field(grace, 'سماح التأخير', 'دقائق', number: true), const SizedBox(height: 8), _field(early, 'سماح الانصراف المبكر', 'دقائق', number: true), const SizedBox(height: 8), _field(specialties, 'نوع العمل / التخصصات', 'general, technician')])), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('إضافة الموظف'))])) ?? false;
    if (ok && name.text.trim().isNotEmpty && job.text.trim().isNotEmpty && pin.text.trim().length >= 4) {
      try {
        final response = await _dio.post('/api/employees', data: {'name': name.text.trim(), 'jobNumber': job.text.trim(), 'pin': pin.text.trim(), 'status': 'active', 'scheduleType': 'ADMIN', 'workStartTime': '08:00', 'workEndTime': '16:00', 'gracePeriodMinutes': int.tryParse(grace.text) ?? 0, 'workDays': [0, 1, 2, 3, 4], 'rotationDaysOn': 7, 'rotationDaysOff': 7, 'rotationStartDate': null, 'locationId': null, 'specialties': specialties.text.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty).toList(), 'avatar': null});
        final data = response.data;
        final created = data is Map ? data['employee'] : null;
        if (created is Map && '${created['id'] ?? ''}'.isNotEmpty) await _dio.put('/api/employees/${created['id']}/checkout-policy', data: {'earlyCheckoutMinutes': int.tryParse(early.text) ?? 0});
        await _load(spinner: false);
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(e))));
      }
    }
    name.dispose();
    job.dispose();
    pin.dispose();
    grace.dispose();
    early.dispose();
    specialties.dispose();
  }
}
