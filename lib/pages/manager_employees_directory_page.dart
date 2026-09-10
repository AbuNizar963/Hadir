import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/hadir_brand.dart';
import '../core/session.dart';

class ManagerEmployeesDirectoryPage extends StatefulWidget {
  const ManagerEmployeesDirectoryPage({super.key});

  @override
  State<ManagerEmployeesDirectoryPage> createState() => _ManagerEmployeesDirectoryPageState();
}

class _ManagerEmployeesDirectoryPageState extends State<ManagerEmployeesDirectoryPage> {
  static const _baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  final _session = HadirSession();
  late final Dio _dio;
  bool _loading = true;
  String? _error;
  String _query = '';
  String _status = 'all';
  String _schedule = 'all';
  List<Map<String, dynamic>> _employees = [];
  List<Map<String, dynamic>> _locations = [];
  Map<String, Map<String, dynamic>> _workforce = {};

  @override
  void initState() {
    super.initState();
    _dio = Dio(BaseOptions(baseUrl: _baseUrl, connectTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(seconds: 20), sendTimeout: const Duration(seconds: 20)));
    _load();
  }

  List<Map<String, dynamic>> _list(dynamic data) {
    if (data is List) return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    if (data is Map) {
      for (final key in const ['data', 'items', 'results', 'employees', 'locations']) {
        if (data[key] is List) return _list(data[key]);
      }
    }
    return [];
  }

  String _errorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['error'] is String) return data['error'].toString();
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
        _dio.get('/api/locations'),
        _dio.get('/api/manager/workforce-controls'),
      ]);
      final workforce = <String, Map<String, dynamic>>{};
      for (final item in _list(results[2].data)) {
        final id = '${item['id'] ?? item['employeeId'] ?? ''}';
        if (id.isNotEmpty) workforce[id] = item;
      }
      if (!mounted) return;
      setState(() {
        _employees = _list(results[0].data);
        _locations = _list(results[1].data);
        _workforce = workforce;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = _errorMessage(e); });
    }
  }

  Map<String, dynamic> _employee(Map<String, dynamic> raw) {
    final id = '${raw['id'] ?? ''}';
    final controls = _workforce[id];
    return controls == null ? raw : {...raw, ...controls};
  }

  Color _stateColor(Map<String, dynamic> e) {
    final escaped = '${e['escapeStatus'] ?? e['fieldStatus'] ?? ''}'.toLowerCase() == 'escaped';
    if (escaped) return const Color(0xFFDC2626);
    if ('${e['status'] ?? 'active'}'.toLowerCase() != 'active') return const Color(0xFFDC2626);
    return '${e['deviceId'] ?? ''}'.trim().isNotEmpty ? const Color(0xFF16A34A) : const Color(0xFFD97706);
  }

  String _locationName(Map<String, dynamic> e) {
    final id = '${e['locationId'] ?? ''}';
    if (id.isEmpty) return 'المقر الرئيسي';
    return _locations.firstWhere((l) => '${l['id'] ?? ''}' == id, orElse: () => {}).cast<String, dynamic>()['name']?.toString() ?? 'المقر الرئيسي';
  }

  List<Map<String, dynamic>> get _filtered {
    final q = _query.trim().toLowerCase();
    return _employees.map(_employee).where((e) {
      final name = '${e['name'] ?? ''}'.toLowerCase();
      final job = '${e['jobNumber'] ?? ''}'.toLowerCase();
      final device = '${e['deviceLabel'] ?? e['deviceId'] ?? ''}'.toLowerCase();
      final status = '${e['status'] ?? 'active'}'.toLowerCase();
      final schedule = '${e['scheduleType'] ?? 'ADMIN'}';
      return (q.isEmpty || name.contains(q) || job.contains(q) || device.contains(q)) && (_status == 'all' || status == _status) && (_schedule == 'all' || schedule == _schedule);
    }).toList();
  }

  Future<void> _request(String method, String path, {Map<String, dynamic>? data}) async {
    try {
      await _dio.request(path, data: data, options: Options(method: method));
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(e))));
    }
  }

  Future<void> _direct(String id, String name, String type) async {
    final label = type == 'check-in' ? 'تحضير' : 'انصراف';
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: Text('$label مباشر'), content: Text('تأكيد $label للموظف «$name»؟'), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('تأكيد'))]));
    if (ok != true) return;
    try {
      await _dio.post(type == 'check-in' ? '/api/manager/attendance' : '/api/workforce/live', data: {'employeeId': id, 'type': type});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تم تسجيل $label')));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(e)))); }
  }

  Future<void> _escape(String id, String name, String status) async {
    final note = TextEditingController();
    final label = status == 'escaped' ? 'هروب' : 'عودة';
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: Text('تسجيل $label'), content: TextField(controller: note, decoration: const InputDecoration(labelText: 'السبب / الملاحظة')), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('تأكيد'))]));
    if (ok == true) await _request('POST', '/api/escape-events', data: {'employeeId': id, 'status': status, 'reason': note.text.trim()});
    note.dispose();
  }

  Future<void> _requestEmployee(String id, String name, String type) async {
    final reason = TextEditingController();
    final start = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));
    final end = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));
    final label = type == 'permission' ? 'إذن' : 'إجازة';
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: Text('تسجيل $label · $name'), content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: start, decoration: const InputDecoration(labelText: 'تاريخ البداية')), TextField(controller: end, decoration: const InputDecoration(labelText: 'تاريخ النهاية')), TextField(controller: reason, decoration: const InputDecoration(labelText: 'السبب / الملاحظة'))]), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('حفظ'))]));
    if (ok == true) await _request('POST', '/api/requests', data: {'employeeId': id, 'type': type, 'reason': reason.text.trim(), 'startDate': start.text.trim(), 'endDate': end.text.trim()});
    reason.dispose(); start.dispose(); end.dispose();
  }

  Future<void> _workforce(String id, String name) async {
    final current = Map<String, dynamic>.from(_workforce[id] ?? {});
    var vip = current['isVip'] == true;
    var autoIn = current['autoCheckIn'] == true;
    var autoOut = current['autoCheckOut'] == true;
    final result = await showDialog<Map<String, bool>>(context: context, builder: (c) => StatefulBuilder(builder: (context, setState) => AlertDialog(title: Text('قوى العمل · $name'), content: Column(mainAxisSize: MainAxisSize.min, children: [SwitchListTile(contentPadding: EdgeInsets.zero, value: vip, title: const Text('موظف VIP'), onChanged: (v) => setState(() => vip = v)), SwitchListTile(contentPadding: EdgeInsets.zero, value: autoIn, title: const Text('الحضور التلقائي'), onChanged: (v) => setState(() => autoIn = v)), SwitchListTile(contentPadding: EdgeInsets.zero, value: autoOut, title: const Text('الانصراف التلقائي'), onChanged: (v) => setState(() => autoOut = v))]), actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, {'isVip': vip, 'autoCheckIn': autoIn, 'autoCheckOut': autoOut}), child: const Text('حفظ'))]));
    if (result != null) {
      await _dio.patch('/api/workforce/live', data: {'employeeId': id, ...result});
      await _load();
    }
  }

  Future<void> _delete(String id, String name) async {
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: const Text('حذف الموظف؟'), content: Text('سيتم حذف حساب «$name». لا يمكن التراجع عن العملية.'), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton.tonal(onPressed: () => Navigator.pop(c, true), child: const Text('حذف'))]));
    if (ok == true) await _request('DELETE', '/api/employees/$id');
  }

  List<DropdownMenuItem<String>> _times() => [for (var h = 0; h < 24; h++) for (var m in const [0, 30]) DropdownMenuItem(value: '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}', child: Text('${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}'))];

  Future<void> _edit(Map<String, dynamic> source) async {
    final e = Map<String, dynamic>.from(source);
    final id = '${e['id'] ?? ''}';
    final name = TextEditingController(text: '${e['name'] ?? ''}');
    final job = TextEditingController(text: '${e['jobNumber'] ?? ''}');
    final pin = TextEditingController();
    final grace = TextEditingController(text: '${e['gracePeriodMinutes'] ?? 0}');
    final early = TextEditingController(text: '${e['earlyCheckoutMinutes'] ?? e['earlyCheckoutGrace'] ?? 0}');
    final rotationStart = TextEditingController(text: '${e['rotationStartDate'] ?? ''}');
    final specialties = TextEditingController(text: e['specialties'] is List ? (e['specialties'] as List).join(', ') : '${e['specialties'] ?? 'general'}');
    var status = '${e['status'] ?? 'active'}';
    var schedule = '${e['scheduleType'] ?? 'ADMIN'}';
    var start = '${e['workStartTime'] ?? '08:00'}';
    var end = '${e['workEndTime'] ?? '16:00'}';
    var location = '${e['locationId'] ?? ''}';
    var rotationOn = int.tryParse('${e['rotationDaysOn'] ?? 7}') ?? 7;
    var rotationOff = int.tryParse('${e['rotationDaysOff'] ?? 7}') ?? 7;
    var days = <int>{if (e['workDays'] is List) ...(e['workDays'] as List).map((x) => int.tryParse('$x')).whereType<int>()};
    if (days.isEmpty) days = {0, 1, 2, 3, 4};
    const labels = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (context, setState) => AlertDialog(title: Text('تعديل الموظف · ${e['name'] ?? ''}'), content: SizedBox(width: 620, child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [TextField(controller: name, decoration: const InputDecoration(labelText: 'اسم الموظف')), const SizedBox(height: 8), TextField(controller: job, decoration: const InputDecoration(labelText: 'الرقم الوظيفي')), const SizedBox(height: 8), TextField(controller: pin, obscureText: true, decoration: const InputDecoration(labelText: 'PIN جديد (اختياري)')), const SizedBox(height: 8), DropdownButtonFormField<String>(initialValue: status, decoration: const InputDecoration(labelText: 'الحالة'), items: const [DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setState(() => status = v ?? status)), const SizedBox(height: 12), DropdownButtonFormField<String>(initialValue: schedule, decoration: const InputDecoration(labelText: 'نوع الدوام'), items: const [DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => setState(() => schedule = v ?? schedule)), const SizedBox(height: 8), Row(children: [Expanded(child: DropdownButtonFormField<String>(initialValue: _times().any((x) => x.value == start) ? start : '08:00', decoration: const InputDecoration(labelText: 'بداية الدوام'), items: _times(), onChanged: (v) => setState(() => start = v ?? start))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<String>(initialValue: _times().any((x) => x.value == end) ? end : '16:00', decoration: const InputDecoration(labelText: 'نهاية الدوام'), items: _times(), onChanged: (v) => setState(() => end = v ?? end)))]), const SizedBox(height: 8), DropdownButtonFormField<String>(initialValue: location, decoration: const InputDecoration(labelText: 'موقع العمل'), items: [const DropdownMenuItem(value: '', child: Text('المقر الرئيسي')), ..._locations.map((l) => DropdownMenuItem(value: '${l['id'] ?? ''}', child: Text('${l['name'] ?? 'موقع'}')))], onChanged: (v) => setState(() => location = v ?? '')), const SizedBox(height: 8), Row(children: [Expanded(child: TextField(controller: grace, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'سماح التأخير'))), const SizedBox(width: 8), Expanded(child: TextField(controller: early, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'الانصراف المبكر')))]), if (schedule == 'ADMIN') ...[const SizedBox(height: 10), Wrap(spacing: 5, runSpacing: 5, children: [for (var i = 0; i < labels.length; i++) FilterChip(label: Text(labels[i]), selected: days.contains(i), onSelected: (v) => setState(() { if (v) days.add(i); else days.remove(i); }))])], if (schedule == 'ROTATION') ...[const SizedBox(height: 10), Row(children: [Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOn.clamp(1, 31), decoration: const InputDecoration(labelText: 'أيام العمل'), items: [for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i'))], onChanged: (v) => setState(() => rotationOn = v ?? rotationOn))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOff.clamp(0, 31), decoration: const InputDecoration(labelText: 'أيام الراحة'), items: [for (var i = 0; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i'))], onChanged: (v) => setState(() => rotationOff = v ?? rotationOff)))]), const SizedBox(height: 8), TextField(controller: rotationStart, decoration: const InputDecoration(labelText: 'تاريخ أول مناوبة'))], const SizedBox(height: 10), TextField(controller: specialties, decoration: const InputDecoration(labelText: 'التخصصات'))])), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('حفظ التعديل'))]));
    if (ok == true && id.isNotEmpty) {
      final payload = <String, dynamic>{'name': name.text.trim(), 'jobNumber': job.text.trim(), 'status': status, 'scheduleType': schedule, 'workStartTime': start, 'workEndTime': end, 'gracePeriodMinutes': int.tryParse(grace.text) ?? 0, 'workDays': days.toList()..sort(), 'rotationDaysOn': rotationOn, 'rotationDaysOff': rotationOff, 'rotationStartDate': rotationStart.text.trim().isEmpty ? null : rotationStart.text.trim(), 'locationId': location.isEmpty ? null : location, 'specialties': specialties.text.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty).toList()};
      if (pin.text.trim().isNotEmpty) payload['pin'] = pin.text.trim();
      await _dio.patch('/api/employees/$id', data: payload);
      await _dio.put('/api/employees/$id/checkout-policy', data: {'earlyCheckoutMinutes': (int.tryParse(early.text) ?? 0).clamp(0, 1440)});
      await _load();
    }
    for (final c in [name, job, pin, grace, early, rotationStart, specialties]) c.dispose();
  }

  Future<void> _add() async {
    final name = TextEditingController(), job = TextEditingController(), pin = TextEditingController(), grace = TextEditingController(), early = TextEditingController(), rotationStart = TextEditingController(), specialties = TextEditingController(text: 'general');
    var status = 'active', schedule = 'ADMIN', start = '08:00', end = '16:00', location = '';
    var rotationOn = 7, rotationOff = 7; var days = <int>{0, 1, 2, 3, 4};
    const labels = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (context, setState) => AlertDialog(title: const Text('إضافة موظف جديد'), content: SizedBox(width: 620, child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [TextField(controller: name, decoration: const InputDecoration(labelText: 'اسم الموظف', hintText: 'اكتب الاسم')), const SizedBox(height: 8), TextField(controller: job, decoration: const InputDecoration(labelText: 'الرقم الوظيفي')), const SizedBox(height: 8), TextField(controller: pin, obscureText: true, decoration: const InputDecoration(labelText: 'رمز PIN')), const SizedBox(height: 8), DropdownButtonFormField<String>(initialValue: status, decoration: const InputDecoration(labelText: 'الحالة'), items: const [DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setState(() => status = v ?? status)), const SizedBox(height: 12), DropdownButtonFormField<String>(initialValue: schedule, decoration: const InputDecoration(labelText: 'نوع الدوام'), items: const [DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => setState(() => schedule = v ?? schedule)), const SizedBox(height: 8), Row(children: [Expanded(child: DropdownButtonFormField<String>(initialValue: start, decoration: const InputDecoration(labelText: 'بداية الدوام'), items: _times(), onChanged: (v) => setState(() => start = v ?? start))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<String>(initialValue: end, decoration: const InputDecoration(labelText: 'نهاية الدوام'), items: _times(), onChanged: (v) => setState(() => end = v ?? end)))]), const SizedBox(height: 8), DropdownButtonFormField<String>(initialValue: location.isEmpty ? null : location, decoration: const InputDecoration(labelText: 'موقع العمل'), items: [const DropdownMenuItem(value: '', child: Text('المقر الرئيسي')), ..._locations.map((l) => DropdownMenuItem(value: '${l['id'] ?? ''}', child: Text('${l['name'] ?? 'موقع'}')))], onChanged: (v) => setState(() => location = v ?? '')), const SizedBox(height: 8), Row(children: [Expanded(child: TextField(controller: grace, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'سماح التأخير'))), const SizedBox(width: 8), Expanded(child: TextField(controller: early, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'الانصراف المبكر')))]), if (schedule == 'ADMIN') ...[const SizedBox(height: 10), Wrap(spacing: 5, runSpacing: 5, children: [for (var i = 0; i < labels.length; i++) FilterChip(label: Text(labels[i]), selected: days.contains(i), onSelected: (v) => setState(() { if (v) days.add(i); else days.remove(i); }))])], if (schedule == 'ROTATION') ...[const SizedBox(height: 10), Row(children: [Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOn, decoration: const InputDecoration(labelText: 'أيام العمل'), items: [for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i'))], onChanged: (v) => setState(() => rotationOn = v ?? rotationOn))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOff, decoration: const InputDecoration(labelText: 'أيام الراحة'), items: [for (var i = 0; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i'))], onChanged: (v) => setState(() => rotationOff = v ?? rotationOff)))]), const SizedBox(height: 8), TextField(controller: rotationStart, decoration: const InputDecoration(labelText: 'تاريخ أول مناوبة'))], const SizedBox(height: 10), TextField(controller: specialties, decoration: const InputDecoration(labelText: 'التخصصات'))])), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('إضافة الموظف'))]));
    if (ok == true && name.text.trim().isNotEmpty && job.text.trim().isNotEmpty && pin.text.trim().length >= 4) {
      final response = await _dio.post('/api/employees', data: {'name': name.text.trim(), 'jobNumber': job.text.trim(), 'pin': pin.text.trim(), 'status': status, 'scheduleType': schedule, 'workStartTime': start, 'workEndTime': end, 'gracePeriodMinutes': int.tryParse(grace.text) ?? 0, 'workDays': days.toList()..sort(), 'rotationDaysOn': rotationOn, 'rotationDaysOff': rotationOff, 'rotationStartDate': rotationStart.text.trim().isEmpty ? null : rotationStart.text.trim(), 'locationId': location.isEmpty ? null : location, 'specialties': specialties.text.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty).toList(), 'avatar': null});
      final employee = response.data is Map ? response.data['employee'] : null;
      final id = employee is Map ? '${employee['id'] ?? ''}' : '';
      if (id.isNotEmpty) await _dio.put('/api/employees/$id/checkout-policy', data: {'earlyCheckoutMinutes': (int.tryParse(early.text) ?? 0).clamp(0, 1440)});
      await _load();
    }
    for (final c in [name, job, pin, grace, early, rotationStart, specialties]) c.dispose();
  }

  Widget _stat(String label, String value, Color color) => Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: color.withValues(alpha: .07), borderRadius: BorderRadius.circular(16), border: Border.all(color: color.withValues(alpha: .25))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800)), Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle))]), const SizedBox(height: 8), Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900))]));
  Widget _pill(String label, String value) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .45), borderRadius: BorderRadius.circular(10)), child: Text('$label: $value', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)));
  Widget _action(String label, IconData icon, VoidCallback onTap, {Color? color}) => SizedBox(width: 64, child: OutlinedButton(onPressed: onTap, style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 7), minimumSize: const Size(0, 50), side: BorderSide(color: (color ?? Theme.of(context).colorScheme.outline).withValues(alpha: .45)), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))), child: Column(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 17, color: color), const SizedBox(height: 3), Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color))]));

  Widget _body() {
    final filtered = _filtered;
    final active = _employees.where((e) => '${e['status'] ?? 'active'}' == 'active').length;
    final devices = _employees.where((e) => '${e['deviceId'] ?? ''}'.isNotEmpty).length;
    final vip = _employees.where((e) => _employee(e)['isVip'] == true).length;
    final escaped = _employees.where((e) => '${e['escapeStatus'] ?? e['fieldStatus'] ?? ''}'.toLowerCase() == 'escaped').length;
    return Directionality(textDirection: TextDirection.rtl, child: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 30), children: [
      Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withValues(alpha: .025), borderRadius: BorderRadius.circular(20), border: Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: .25))), child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('EMPLOYEE DIRECTORY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: HadirBrand.primary)), const SizedBox(height: 4), const Text('إدارة الموظفين', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text('الواجهة ثابتة أثناء المزامنة؛ يتم تحديث القيم المتغيرة فقط.', style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant))])), FilledButton.icon(onPressed: _add, icon: const Icon(Icons.person_add_alt_1, size: 18), label: const Text('+ إضافة موظف'))])),
      const SizedBox(height: 12),
      LayoutBuilder(builder: (context, c) { final count = c.maxWidth >= 900 ? 6 : c.maxWidth >= 600 ? 3 : 2; return GridView.count(crossAxisCount: count, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 1.45, children: [_stat('الإجمالي', '${_employees.length}', const Color(0xFF38A9E8)), _stat('فعال', '$active', const Color(0xFF16A34A)), _stat('موقوف', '${_employees.length - active}', const Color(0xFFE11D48)), _stat('أجهزة موثقة', '$devices', const Color(0xFF8B5CF6)), _stat('VIP مفعل', '$vip', const Color(0xFFF59E0B)), _stat('هارب الآن', '$escaped', const Color(0xFFEF4444))]; }),
      const SizedBox(height: 12),
      Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface.withValues(alpha: .78), borderRadius: BorderRadius.circular(20), border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: .7))), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Text('LIVE DIRECTORY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: HadirBrand.primary)), const SizedBox(height: 4), Text.rich(TextSpan(children: [const TextSpan(text: 'قائمة الموظفين ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)), TextSpan(text: '(${filtered.length})', style: TextStyle(fontSize: 17, color: Theme.of(context).colorScheme.onSurfaceVariant))])), const SizedBox(height: 4), Text('المالك والمدير: إدارة الموظفين والتحضير المباشر للمهمات والمأموريات وتسجيل الهروب والعودة والأذونات والإجازات.', style: TextStyle(fontSize: 10.5, color: Theme.of(context).colorScheme.onSurfaceVariant)), const SizedBox(height: 14), LayoutBuilder(builder: (context, c) { final status = DropdownButtonFormField<String>(initialValue: _status, isDense: true, decoration: const InputDecoration(labelText: 'الحالة'), items: const [DropdownMenuItem(value: 'all', child: Text('كل الحالات')), DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setState(() => _status = v ?? 'all')); final schedule = DropdownButtonFormField<String>(initialValue: _schedule, isDense: true, decoration: const InputDecoration(labelText: 'نوع الدوام'), items: const [DropdownMenuItem(value: 'all', child: Text('كل أنواع الدوام')), DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => setState(() => _schedule = v ?? 'all')); if (c.maxWidth >= 720) return Row(children: [Expanded(child: TextField(onChanged: (v) => setState(() => _query = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'بحث بالاسم أو الرقم أو الجهاز'),)), const SizedBox(width: 8), SizedBox(width: 145, child: status), const SizedBox(width: 8), SizedBox(width: 155, child: schedule)]); return Column(children: [TextField(onChanged: (v) => setState(() => _query = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'بحث بالاسم أو الرقم أو الجهاز')), const SizedBox(height: 8), Row(children: [Expanded(child: status), const SizedBox(width: 8), Expanded(child: schedule)])]); }), const SizedBox(height: 16), if (_loading) const Padding(padding: EdgeInsets.symmetric(vertical: 50), child: Center(child: Text('جاري مزامنة الموظفين من قاعدة بيانات النظام…'))) else if (filtered.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 50), child: Center(child: Text('لا توجد نتائج'))) else LayoutBuilder(builder: (context, c) { final columns = c.maxWidth >= 1100 ? 3 : c.maxWidth >= 720 ? 2 : 1; final gap = 12.0; final width = (c.maxWidth - gap * (columns - 1)) / columns; return Wrap(spacing: gap, runSpacing: gap, children: filtered.map((e) { final id = '${e['id'] ?? ''}'; final name = '${e['name'] ?? 'بدون اسم'}'; final color = _stateColor(e); final escapedNow = '${e['escapeStatus'] ?? e['fieldStatus'] ?? ''}'.toLowerCase() == 'escaped'; final device = '${e['deviceId'] ?? ''}'.trim().isNotEmpty; final vipNow = e['isVip'] == true; final location = _locationName(e); final label = escapedNow ? 'هارب' : '${e['status'] ?? 'active'}' == 'active' ? (device ? 'فعال ومرتبط' : 'فعال وغير مرتبط') : 'موقوف'; return SizedBox(width: width, child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface.withValues(alpha: .76), borderRadius: BorderRadius.circular(18), border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: .65))), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(children: [Container(width: 42, height: 42, decoration: BoxDecoration(color: color.withValues(alpha: .09), borderRadius: BorderRadius.circular(13)), child: Center(child: Text(name.isEmpty ? 'م' : name.substring(0, 1), style: TextStyle(color: color, fontWeight: FontWeight.w900)))), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900)), Text('${e['jobNumber'] ?? '—'}', style: TextStyle(fontSize: 10, color: Theme.of(context).colorScheme.onSurfaceVariant, fontFamily: 'monospace'))])), Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: color.withValues(alpha: .09), borderRadius: BorderRadius.circular(20)), child: Text(label, style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w800))), if (vipNow) const Text('★ VIP', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 10, fontWeight: FontWeight.w900))])]), const SizedBox(height: 10), Wrap(spacing: 6, runSpacing: 6, children: [_pill('الدوام', e['scheduleType'] == 'ROTATION' ? 'تناوبي' : 'إداري'), _pill('الموقع', location), _pill('الوقت', e['scheduleType'] == 'ROTATION' ? '${e['rotationDaysOn'] ?? 7} عمل / ${e['rotationDaysOff'] ?? 7} راحة' : '${e['workStartTime'] ?? '--:--'} → ${e['workEndTime'] ?? '--:--'}'), _pill('الميدان', escapedNow ? 'هارب من العمل' : 'طبيعي'), if (device) _pill('الجهاز', '${e['deviceLabel'] ?? 'مرتبط'}')]), const SizedBox(height: 10), Wrap(spacing: 6, runSpacing: 6, children: [_action('إذن', Icons.event_available_rounded, () => _requestEmployee(id, name, 'permission'), color: const Color(0xFF0284C7)), _action('إجازة', Icons.beach_access_rounded, () => _requestEmployee(id, name, 'leave'), color: const Color(0xFF7C3AED)), _action('تحضير', Icons.login_rounded, () => _direct(id, name, 'check-in'), color: const Color(0xFF16A34A)), _action('انصراف', Icons.logout_rounded, () => _direct(id, name, 'check-out'), color: const Color(0xFFF97316)), _action(escapedNow ? 'عودة' : 'هروب', escapedNow ? Icons.rotate_left_rounded : Icons.directions_walk_rounded, () => _escape(id, name, escapedNow ? 'returned' : 'escaped'), color: escapedNow ? HadirBrand.primary : const Color(0xFFDC2626)), _action('تعديل', Icons.edit_rounded, () => _edit(e)), _action('قوى', Icons.auto_awesome_rounded, () => _workforce(id, name), color: const Color(0xFFF59E0B)), _action('جهاز', Icons.smartphone_rounded, () => _request('DELETE', '/api/employees/$id/device')), _action('حذف', Icons.delete_outline_rounded, () => _delete(id, name), color: const Color(0xFFDC2626))])]))); }).toList()); })])));
    ]));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('الموظفون', style: TextStyle(fontWeight: FontWeight.w900)), body: _loading && _employees.isEmpty ? const Center(child: CircularProgressIndicator()) : _error != null && _employees.isEmpty ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48), const SizedBox(height: 12), Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة'))]))) : _body());
  }
}
