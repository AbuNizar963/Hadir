import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/session.dart';

/// Visual Flutter counterpart of the web ManagerEmployees page.
/// The preserved legacy management implementation is intentionally untouched.
class ManagerEmployeesDirectoryPage extends StatefulWidget {
  const ManagerEmployeesDirectoryPage({super.key});
  @override
  State<ManagerEmployeesDirectoryPage> createState() => _ManagerEmployeesDirectoryPageState();
}

class _ManagerEmployeesDirectoryPageState extends State<ManagerEmployeesDirectoryPage> {
  static const baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  static const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  final session = HadirSession();
  late final Dio dio;
  bool loading = true;
  String? error;
  String query = '';
  String status = 'all';
  String schedule = 'all';
  List<Map<String, dynamic>> employees = [];
  List<Map<String, dynamic>> locations = [];
  List<Map<String, dynamic>> escapes = [];
  Map<String, Map<String, dynamic>> controls = {};

  @override
  void initState() {
    super.initState();
    dio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(seconds: 20), sendTimeout: const Duration(seconds: 20)));
    load();
  }

  List<Map<String, dynamic>> asList(dynamic data) {
    if (data is List) return data.whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
    if (data is Map) {
      for (final key in const ['data', 'items', 'results', 'employees', 'locations', 'events']) {
        final value = data[key];
        if (value is List) return value.whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
      }
    }
    return [];
  }

  Map<String, Map<String, dynamic>> asControls(dynamic data) {
    final out = <String, Map<String, dynamic>>{};
    for (final x in asList(data)) {
      final id = '${x['id'] ?? x['employeeId'] ?? ''}'.trim();
      if (id.isNotEmpty) out[id] = x;
    }
    return out;
  }

  String message(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      return 'تعذر إكمال العملية (${e.response?.statusCode ?? 'شبكة'}).';
    }
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> load({bool spinner = true}) async {
    if (spinner && mounted) setState(() { loading = true; error = null; });
    try {
      final token = await session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      dio.options.headers['Authorization'] = 'Bearer $token';
      final r = await Future.wait([
        dio.get('/api/employees'),
        dio.get('/api/locations'),
        dio.get('/api/manager/workforce-controls'),
        dio.get('/api/escape-events', queryParameters: const {'limit': 2000}),
      ]);
      if (!mounted) return;
      setState(() {
        employees = asList(r[0].data);
        locations = asList(r[1].data);
        controls = asControls(r[2].data);
        escapes = asList(r[3].data);
        loading = false;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() { loading = false; error = message(e); });
    }
  }

  Map<String, dynamic> merged(Map<String, dynamic> e) => controls['${e['id'] ?? ''}'] == null ? e : {...e, ...controls['${e['id'] ?? ''}']!};

  String escapeState(String id) {
    final list = escapes.where((x) => '${x['employeeId'] ?? ''}' == id).toList();
    if (list.isEmpty) return 'none';
    list.sort((a, b) => '${b['timestamp'] ?? b['createdAt'] ?? ''}'.compareTo('${a['timestamp'] ?? a['createdAt'] ?? ''}'));
    final s = '${list.first['status'] ?? ''}'.toLowerCase();
    return s == 'escaped' ? 'escaped' : s == 'returned' ? 'returned' : 'none';
  }

  String locationName(String id) {
    for (final x in locations) if ('${x['id']}' == id) return '${x['name'] ?? 'موقع'}';
    return 'المقر الرئيسي';
  }

  List<Map<String, dynamic>> get filtered => employees.map(merged).where((e) {
    final q = query.trim().toLowerCase();
    final name = '${e['name'] ?? ''}'.toLowerCase();
    final job = '${e['jobNumber'] ?? ''}'.toLowerCase();
    final device = '${e['deviceLabel'] ?? e['deviceId'] ?? ''}'.toLowerCase();
    return (q.isEmpty || name.contains(q) || job.contains(q) || device.contains(q)) &&
        (status == 'all' || '${e['status'] ?? 'active'}' == status) &&
        (schedule == 'all' || '${e['scheduleType'] ?? 'ADMIN'}' == schedule);
  }).toList();

  Future<void> request(String method, String path, {Map<String, dynamic>? data}) async {
    try {
      await dio.request(path, data: data, options: Options(method: method));
      await load(spinner: false);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message(e))));
    }
  }

  Future<bool> confirm(String title, String body) async => await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)), content: Text(body), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton.tonal(onPressed: () => Navigator.pop(c, true), child: const Text('تأكيد'))])) ?? false;

  Future<void> workforce(Map<String, dynamic> e) async {
    final id = '${e['id'] ?? ''}';
    var vip = e['isVip'] == true, autoIn = e['autoCheckIn'] == true, autoOut = e['autoCheckOut'] == true;
    final result = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (context, set) => AlertDialog(title: Text('قوى العمل · ${e['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w900)), content: Column(mainAxisSize: MainAxisSize.min, children: [SwitchListTile(contentPadding: EdgeInsets.zero, value: vip, title: const Text('موظف VIP'), onChanged: (v) => set(() => vip = v)), SwitchListTile(contentPadding: EdgeInsets.zero, value: autoIn, title: const Text('التحضير التلقائي'), onChanged: (v) => set(() => autoIn = v)), SwitchListTile(contentPadding: EdgeInsets.zero, value: autoOut, title: const Text('الانصراف التلقائي'), onChanged: (v) => set(() => autoOut = v))]), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('حفظ'))])));
    if (result == true) await request('PATCH', '/api/workforce/live', data: {'employeeId': id, 'isVip': vip, 'autoCheckIn': autoIn, 'autoCheckOut': autoOut});
  }

  Future<void> attendance(Map<String, dynamic> e, String type) async {
    if (!await confirm(type == 'check-in' ? 'تحضير مباشر' : 'انصراف مباشر', 'تأكيد العملية للموظف «${e['name'] ?? ''}»؟')) return;
    await request('POST', type == 'check-in' ? '/api/manager/attendance' : '/api/workforce/live', data: {'employeeId': '${e['id']}', 'type': type});
  }

  Future<void> escape(Map<String, dynamic> e, String state) async {
    final note = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: Text(state == 'escaped' ? 'تسجيل هروب' : 'تسجيل عودة'), content: TextField(controller: note, maxLines: 3, decoration: const InputDecoration(labelText: 'السبب / الملاحظة')), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('تأكيد'))])) ?? false;
    if (ok) await request('POST', '/api/escape-events', data: {'employeeId': '${e['id']}', 'status': state, 'reason': note.text.trim()});
    note.dispose();
  }

  Future<void> requestFor(Map<String, dynamic> e, String type) async {
    final start = TextEditingController(text: today());
    final end = TextEditingController(text: today());
    final reason = TextEditingController();
    final label = type == 'permission' ? 'إذن' : 'إجازة';
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: Text('تسجيل $label', style: const TextStyle(fontWeight: FontWeight.w900)), content: Column(mainAxisSize: MainAxisSize.min, children: [Text('${e['name'] ?? ''} · ${e['jobNumber'] ?? ''}'), const SizedBox(height: 10), TextField(controller: start, decoration: const InputDecoration(labelText: 'أول يوم')), const SizedBox(height: 8), TextField(controller: end, decoration: const InputDecoration(labelText: 'آخر يوم')), const SizedBox(height: 8), TextField(controller: reason, maxLines: 3, decoration: const InputDecoration(labelText: 'السبب / الملاحظة'))]), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('حفظ الفترة'))])) ?? false;
    if (ok) await request('POST', '/api/requests', data: {'employeeId': '${e['id']}', 'type': type, 'reason': reason.text.trim(), 'startDate': start.text.trim(), 'endDate': end.text.trim()});
    start.dispose(); end.dispose(); reason.dispose();
  }

  String today() => DateTime.now().toIso8601String().substring(0, 10);

  Future<void> edit(Map<String, dynamic> e) async {
    final name = TextEditingController(text: '${e['name'] ?? ''}'), job = TextEditingController(text: '${e['jobNumber'] ?? ''}'), pin = TextEditingController(), grace = TextEditingController(text: '${e['gracePeriodMinutes'] ?? 0}'), early = TextEditingController(text: '${e['earlyCheckoutGraceMinutes'] ?? e['earlyCheckoutMinutes'] ?? 0}'), rotationStart = TextEditingController(text: '${e['rotationStartDate'] ?? ''}'), specialties = TextEditingController(text: e['specialties'] is List ? (e['specialties'] as List).join(', ') : '${e['specialties'] ?? 'general'}');
    var state = '${e['status'] ?? 'active'}';
    var kind = '${e['scheduleType'] ?? 'ADMIN'}';
    var start = '${e['workStartTime'] ?? '08:00'}', finish = '${e['workEndTime'] ?? '16:00'}';
    var location = '${e['locationId'] ?? ''}';
    var on = int.tryParse('${e['rotationDaysOn'] ?? 7}') ?? 7, off = int.tryParse('${e['rotationDaysOff'] ?? 7}') ?? 7;
    var work = <int>{if (e['workDays'] is List) ...(e['workDays'] as List).map((x) => int.tryParse('$x')).whereType<int>()};
    if (work.isEmpty) work = {0, 1, 2, 3, 4};
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (context, set) => AlertDialog(title: const Text('تعديل بيانات الموظف', style: TextStyle(fontWeight: FontWeight.w900)), content: SizedBox(width: 620, child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [_field(name, 'اسم الموظف', 'اكتب الاسم الكامل'), const SizedBox(height: 8), _field(job, 'الرقم الوظيفي', 'مثال: D718075'), const SizedBox(height: 8), _field(pin, 'PIN جديد', 'اختياري', obscure: true), const SizedBox(height: 8), DropdownButtonFormField<String>(initialValue: state, decoration: const InputDecoration(labelText: 'الحالة'), items: const [DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => set(() => state = v ?? state)), const SizedBox(height: 14), DropdownButtonFormField<String>(initialValue: kind, decoration: const InputDecoration(labelText: 'نوع الدوام'), items: const [DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => set(() => kind = v ?? kind)), const SizedBox(height: 8), Row(children: [Expanded(child: _time(start, 'بداية الدوام', (v) => set(() => start = v))), const SizedBox(width: 8), Expanded(child: _time(finish, 'نهاية الدوام', (v) => set(() => finish = v)))]), const SizedBox(height: 8), DropdownButtonFormField<String>(initialValue: _locations(location).any((x) => x.value == location) ? location : '', decoration: const InputDecoration(labelText: 'موقع العمل'), items: _locations(''), onChanged: (v) => set(() => location = v ?? '')), const SizedBox(height: 8), Row(children: [Expanded(child: _field(grace, 'سماح التأخير', 'دقائق', number: true)), const SizedBox(width: 8), Expanded(child: _field(early, 'سماح الانصراف المبكر', 'دقائق', number: true))]), const SizedBox(height: 8), _field(specialties, 'نوع العمل / التخصصات', 'general, technician'), if (kind == 'ADMIN') ...[const SizedBox(height: 10), const Text('أيام الدوام', style: TextStyle(fontWeight: FontWeight.w800)), Wrap(spacing: 5, children: [for (var i = 0; i < days.length; i++) FilterChip(label: Text(days[i]), selected: work.contains(i), onSelected: (v) => set(() { if (v) work.add(i); else work.remove(i); }))])], if (kind == 'ROTATION') ...[const SizedBox(height: 10), Row(children: [Expanded(child: DropdownButtonFormField<int>(initialValue: on.clamp(1, 31), decoration: const InputDecoration(labelText: 'أيام العمل'), items: [for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i يوم'))], onChanged: (v) => set(() => on = v ?? on))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<int>(initialValue: off.clamp(0, 31), decoration: const InputDecoration(labelText: 'أيام الراحة'), items: [const DropdownMenuItem(value: 0, child: Text('بدون راحة')), for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i يوم'))], onChanged: (v) => set(() => off = v ?? off)))]), const SizedBox(height: 8), _field(rotationStart, 'تاريخ أول مناوبة', 'YYYY-MM-DD')]]))), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('حفظ التعديل'))])) ?? false;
    if (ok) {
      final payload = <String, dynamic>{'name': name.text.trim(), 'jobNumber': job.text.trim(), 'status': state, 'scheduleType': kind, 'workStartTime': start, 'workEndTime': finish, 'gracePeriodMinutes': int.tryParse(grace.text.trim()) ?? 0, 'workDays': work.toList()..sort(), 'rotationDaysOn': on, 'rotationDaysOff': off, 'rotationStartDate': rotationStart.text.trim().isEmpty ? null : rotationStart.text.trim(), 'locationId': location.isEmpty ? null : location, 'specialties': specialties.text.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty).toList()};
      if (pin.text.trim().isNotEmpty) payload['pin'] = pin.text.trim();
      await request('PATCH', '/api/employees/${e['id']}', data: payload);
      await request('PUT', '/api/employees/${e['id']}/checkout-policy', data: {'earlyCheckoutMinutes': (int.tryParse(early.text.trim()) ?? 0).clamp(0, 1440)});
    }
    name.dispose(); job.dispose(); pin.dispose(); grace.dispose(); early.dispose(); rotationStart.dispose(); specialties.dispose();
  }

  Widget _field(TextEditingController c, String label, String hint, {bool obscure = false, bool number = false}) => TextField(controller: c, obscureText: obscure, keyboardType: number ? TextInputType.number : TextInputType.text, decoration: InputDecoration(labelText: label, hintText: hint));
  Widget _time(String value, String label, ValueChanged<String> onChanged) => DropdownButtonFormField<String>(initialValue: _timeValues.contains(value) ? value : '08:00', decoration: InputDecoration(labelText: label), items: _timeValues.map((x) => DropdownMenuItem(value: x, child: Text(x))).toList(), onChanged: (v) => onChanged(v ?? value));
  List<String> get _timeValues => [for (var h = 0; h < 24; h++) for (final m in const [0, 30]) '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}'];
  List<DropdownMenuItem<String>> _locations(String selected) => [const DropdownMenuItem(value: '', child: Text('المقر الرئيسي')), ...locations.where((x) => '${x['name'] ?? ''}'.trim() != 'المقر الرئيسي').map((x) => DropdownMenuItem(value: '${x['id'] ?? ''}', child: Text('${x['name'] ?? 'موقع'}')))];
  Widget _badge(String text, Color color) => Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4), decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(99), border: Border.all(color: color.withValues(alpha: .25))), child: Text(text, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color)));
  Widget _info(String label, String value) => Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .3), borderRadius: BorderRadius.circular(10)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(label, style: TextStyle(fontSize: 8, color: Theme.of(context).hintColor)), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800))]));
  Widget _action(String label, IconData icon, VoidCallback fn, Color color) => OutlinedButton(onPressed: fn, style: OutlinedButton.styleFrom(minimumSize: const Size(0, 50), padding: const EdgeInsets.all(2), foregroundColor: color, side: BorderSide(color: color.withValues(alpha: .25)), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11))), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, size: 16), const SizedBox(height: 2), Text(label, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w800))]));

  Widget card(Map<String, dynamic> e) {
    final id = '${e['id'] ?? ''}', state = '${e['status'] ?? 'active'}', escapeStatus = escapeState(id), device = '${e['deviceId'] ?? ''}'.trim().isNotEmpty, rotation = '${e['scheduleType'] ?? 'ADMIN'}' == 'ROTATION';
    final color = escapeStatus == 'escaped' || state != 'active' ? Colors.red : device ? Colors.green : Colors.orange;
    final actions = <Widget>[];
    if (state == 'active') { actions.add(_action('إذن', Icons.event_note_rounded, () => requestFor(e, 'permission'), Colors.blue)); actions.add(_action('إجازة', Icons.calendar_month_rounded, () => requestFor(e, 'leave'), Colors.deepPurple)); }
    actions.add(_action('تحضير', Icons.login_rounded, () => attendance(e, 'check-in'), Colors.green));
    actions.add(_action('انصراف', Icons.logout_rounded, () => attendance(e, 'check-out'), Colors.orange));
    if (state == 'active' && escapeStatus != 'escaped') actions.add(_action('هروب', Icons.directions_walk_rounded, () => escape(e, 'escaped'), Colors.red));
    if (escapeStatus == 'escaped') actions.add(_action('عودة', Icons.undo_rounded, () => escape(e, 'returned'), Colors.green));
    actions.add(_action('تعديل', Icons.edit_rounded, () => edit(e), Theme.of(context).colorScheme.primary));
    actions.add(_action('حذف', Icons.delete_outline_rounded, () async { if (await confirm('حذف الموظف؟', 'سيتم حذف حساب «${e['name'] ?? ''}».')) await request('DELETE', '/api/employees/$id'); }, Colors.red));
    if (device) actions.add(_action('الجهاز', Icons.smartphone_rounded, () async { if (await confirm('فك ربط الهاتف؟', 'إلغاء ربط جهاز «${e['name'] ?? ''}».')) await request('DELETE', '/api/employees/$id/device'); }, Theme.of(context).hintColor));
    return Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: Theme.of(context).dividerColor.withValues(alpha: .7))), child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(crossAxisAlignment: CrossAxisAlignment.start, children: [CircleAvatar(radius: 20, backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: .10), child: Text('${e['name'] ?? 'م'}'.trim().isEmpty ? 'م' : '${e['name']}'.trim().substring(0, 1), style: TextStyle(fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary))), const SizedBox(width: 9), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${e['name'] ?? 'بدون اسم'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)), Text('${e['jobNumber'] ?? ''}', style: TextStyle(fontSize: 10, color: Theme.of(context).hintColor))])), Wrap(spacing: 3, children: [Container(margin: const EdgeInsets.only(top: 8), width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)), _badge(state == 'active' ? 'فعال' : 'موقوف', state == 'active' ? Colors.green : Colors.red), if (e['isVip'] == true) _badge('★ VIP', Colors.amber.shade700)])]), const SizedBox(height: 9), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, childAspectRatio: 2.9, crossAxisSpacing: 5, mainAxisSpacing: 5, children: [_info('الدوام', rotation ? 'تناوبي' : 'إداري'), _info('الموقع', locationName('${e['locationId'] ?? ''}')), _info('الوقت', rotation ? '${e['rotationDaysOn'] ?? 0} عمل / ${e['rotationDaysOff'] ?? 0} راحة' : '${e['workStartTime'] ?? '--:--'} → ${e['workEndTime'] ?? '--:--'}'), _info('الحالة الميدانية', escapeStatus == 'escaped' ? 'هارب من العمل' : escapeStatus == 'returned' ? 'عاد للعمل' : 'طبيعي')]), const SizedBox(height: 7), Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('التأخير: ${e['gracePeriodMinutes'] ?? 0} دقيقة', style: const TextStyle(fontSize: 9)), Text('الانصراف المبكر: ${e['earlyCheckoutGraceMinutes'] ?? e['earlyCheckoutMinutes'] ?? 0} دقيقة', style: const TextStyle(fontSize: 9))]), const SizedBox(height: 7), Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .22), borderRadius: BorderRadius.circular(11)), child: Row(children: [OutlinedButton.icon(onPressed: () => workforce(e), icon: const Icon(Icons.star_rounded, size: 15), label: const Text('VIP', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900))), const SizedBox(width: 7), Expanded(child: Text(e['isVip'] == true ? 'تحضير + انصراف تلقائي' : 'تشغيل تلقائي عند التفعيل', style: TextStyle(fontSize: 9, color: Theme.of(context).hintColor)))])), const SizedBox(height: 7), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: actions.length > 6 ? 4 : 4, crossAxisSpacing: 4, mainAxisSpacing: 4, childAspectRatio: .9, children: actions)]));
  }

  Widget metric(String label, int value, Color color, IconData icon) => Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: color.withValues(alpha: .07), borderRadius: BorderRadius.circular(15), border: Border.all(color: color.withValues(alpha: .25))), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color)), Icon(icon, size: 15, color: color)]), const SizedBox(height: 7), Text('$value', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900))]));

  @override
  Widget build(BuildContext context) {
    final list = filtered;
    final active = employees.where((e) => '${e['status'] ?? 'active'}' == 'active').length;
    final suspended = employees.length - active;
    final devices = employees.where((e) => '${e['deviceId'] ?? ''}'.isNotEmpty).length;
    final vip = employees.map(merged).where((e) => e['isVip'] == true).length;
    final escaped = employees.where((e) => escapeState('${e['id'] ?? ''}') == 'escaped').length;
    return Scaffold(body: RefreshIndicator(onRefresh: load, child: ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 32), children: [Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: .25)), color: Theme.of(context).colorScheme.primary.withValues(alpha: .025)), child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('EMPLOYEE DIRECTORY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)), const SizedBox(height: 4), const Text('إدارة الموظفين', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900)), Text('دليل الموظفين الموحد — البيانات من النظام مباشرة.', style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor))])), FilledButton.icon(onPressed: () => _add(), icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة موظف'))])), const SizedBox(height: 12), LayoutBuilder(builder: (context, c) { final n = c.maxWidth > 900 ? 6 : c.maxWidth > 600 ? 3 : 2; return GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: n, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 1.7, children: [metric('الإجمالي', employees.length, Colors.lightBlue, Icons.groups_rounded), metric('فعال', active, Colors.green, Icons.check_circle_outline_rounded), metric('موقوف', suspended, Colors.red, Icons.pause_circle_outline_rounded), metric('أجهزة موثقة', devices, Colors.deepPurple, Icons.smartphone_rounded), metric('VIP مفعل', vip, Colors.amber.shade700, Icons.star_rounded), metric('هارب الآن', escaped, Colors.red.shade700, Icons.directions_walk_rounded)]); }), const SizedBox(height: 12), Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)), child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('LIVE DIRECTORY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)), Text('قائمة الموظفين (${list.length})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))])), IconButton(onPressed: load, icon: const Icon(Icons.refresh_rounded))]), const SizedBox(height: 9), TextField(onChanged: (v) => setState(() => query = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'بحث بالاسم أو الرقم أو الجهاز', isDense: true)), const SizedBox(height: 8), Row(children: [Expanded(child: DropdownButtonFormField<String>(initialValue: status, decoration: const InputDecoration(labelText: 'الحالة', isDense: true), items: const [DropdownMenuItem(value: 'all', child: Text('كل الحالات')), DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setState(() => status = v ?? 'all'))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<String>(initialValue: schedule, decoration: const InputDecoration(labelText: 'نوع الدوام', isDense: true), items: const [DropdownMenuItem(value: 'all', child: Text('كل أنواع الدوام')), DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => setState(() => schedule = v ?? 'all')))]), ])), if (loading) const Padding(padding: EdgeInsets.all(45), child: Center(child: CircularProgressIndicator())) else if (error != null) Padding(padding: const EdgeInsets.all(24), child: Column(children: [const Icon(Icons.cloud_off_rounded, size: 42), const SizedBox(height: 8), Text(error!, textAlign: TextAlign.center), FilledButton(onPressed: load, child: const Text('إعادة المحاولة'))])) else if (list.isEmpty) const Padding(padding: EdgeInsets.all(40), child: Column(children: [Icon(Icons.search_off_rounded, size: 42), SizedBox(height: 8), Text('لا توجد نتائج', style: TextStyle(fontWeight: FontWeight.w900)), SizedBox(height: 4), Text('جرّب تغيير البحث أو الفلاتر.')])) else Padding(padding: const EdgeInsets.only(top: 12), child: LayoutBuilder(builder: (context, c) { final n = c.maxWidth > 1200 ? 4 : c.maxWidth > 760 ? 3 : c.maxWidth > 480 ? 2 : 1; return GridView.builder(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), itemCount: list.length, gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: n, crossAxisSpacing: 9, mainAxisSpacing: 9, childAspectRatio: n == 1 ? .72 : .68), itemBuilder: (_, i) => card(list[i])); }))])));
  }

  Future<void> _add() async {
    final name = TextEditingController(), job = TextEditingController(), pin = TextEditingController(), grace = TextEditingController(), early = TextEditingController(), specialties = TextEditingController(text: 'general');
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: const Text('إضافة موظف جديد', style: TextStyle(fontWeight: FontWeight.w900)), content: SingleChildScrollView(child: Column(children: [_field(name, 'اسم الموظف', 'اكتب الاسم الكامل'), const SizedBox(height: 8), _field(job, 'الرقم الوظيفي', 'مثال: D718075'), const SizedBox(height: 8), _field(pin, 'رمز PIN', '4 أحرف/أرقام على الأقل', obscure: true), const SizedBox(height: 8), _field(grace, 'سماح التأخير', 'دقائق', number: true), const SizedBox(height: 8), _field(early, 'سماح الانصراف المبكر', 'دقائق', number: true), const SizedBox(height: 8), _field(specialties, 'نوع العمل / التخصصات', 'general, technician')])) , actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('إضافة الموظف'))])) ?? false;
    if (ok && name.text.trim().isNotEmpty && job.text.trim().isNotEmpty && pin.text.trim().length >= 4) {
      final r = await dio.post('/api/employees', data: {'name': name.text.trim(), 'jobNumber': job.text.trim(), 'pin': pin.text.trim(), 'status': 'active', 'scheduleType': 'ADMIN', 'workStartTime': '08:00', 'workEndTime': '16:00', 'gracePeriodMinutes': int.tryParse(grace.text) ?? 0, 'workDays': [0, 1, 2, 3, 4], 'rotationDaysOn': 7, 'rotationDaysOff': 7, 'rotationStartDate': null, 'locationId': null, 'specialties': specialties.text.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty).toList(), 'avatar': null});
      final data = r.data; final created = data is Map ? data['employee'] : null; if (created is Map && '${created['id'] ?? ''}'.isNotEmpty) await dio.put('/api/employees/${created['id']}/checkout-policy', data: {'earlyCheckoutMinutes': int.tryParse(early.text) ?? 0});
      await load(spinner: false);
    }
    name.dispose(); job.dispose(); pin.dispose(); grace.dispose(); early.dispose(); specialties.dispose();
  }
}
