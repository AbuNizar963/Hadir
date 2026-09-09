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
  String _employeeSchedule = 'all';
  String _requestQuery = '';
  String _requestStatus = 'all';
  String _adminQuery = '';
  List<dynamic> _employees = [];
  List<dynamic> _requests = [];
  List<dynamic> _audit = [];
  List<dynamic> _admins = [];
  Map<String, dynamic> _settings = {};
  Map<String, Map<String, dynamic>> _workforceControls = {};
  List<Map<String, dynamic>> _locations = [];

  Color _statusColor(String status, {bool escaped = false, bool hasDevice = false}) {
    if (escaped) return const Color(0xFFDC2626);
    switch (status.toLowerCase()) {
      case 'active':
      case 'online':
        return const Color(0xFF16A34A);
      case 'suspended':
      case 'inactive':
        return const Color(0xFFDC2626);
      case 'pending':
        return const Color(0xFFD97706);
      case 'approved':
      case 'returned':
        return const Color(0xFF16A34A);
      case 'rejected':
        return const Color(0xFFDC2626);
      default:
        return hasDevice ? const Color(0xFF16A34A) : const Color(0xFFD97706);
    }
  }

  Color _statusSoft(Color color) => Color.alphaBlend(color.withValues(alpha: 0.09), Theme.of(context).colorScheme.surface);

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

  List<dynamic> _asList(dynamic data) {
    if (data is List) return List<dynamic>.from(data);
    if (data is Map) {
      for (final key in const ['data', 'items', 'results', 'employees', 'requests', 'audit', 'admins']) {
        final value = data[key];
        if (value is List) return List<dynamic>.from(value);
      }
    }
    return <dynamic>[];
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map) {
      final direct = Map<String, dynamic>.from(data);
      final nested = direct['data'];
      if (nested is Map) return Map<String, dynamic>.from(nested);
      return direct;
    }
    return <String, dynamic>{};
  }

  Map<String, Map<String, dynamic>> _asWorkforceControls(dynamic data) {
    final list = _asList(data);
    final result = <String, Map<String, dynamic>>{};
    for (final raw in list) {
      if (raw is! Map) continue;
      final item = Map<String, dynamic>.from(raw);
      final id = '${item['id'] ?? item['employeeId'] ?? ''}';
      if (id.isNotEmpty) result[id] = item;
    }
    return result;
  }

  List<Map<String, dynamic>> _asLocations(dynamic data) {
    return _asList(data).whereType<Map>().map((raw) => Map<String, dynamic>.from(raw)).toList();
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
        _dio.get('/api/manager/workforce-controls'),
        _dio.get('/api/locations'),
      ]);
      if (!mounted) return;
      setState(() {
        _employees = _asList(results[0].data);
        _requests = _asList(results[1].data);
        _audit = _asList(results[2].data);
        _admins = _asList(results[3].data);
        _settings = _asMap(results[4].data);
        _workforceControls = _asWorkforceControls(results[5].data);
        _locations = _asLocations(results[6].data);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() { _loading = false; _error = _errorMessage(error); });
    }
  }

  Future<void> _request(String method, String path, {Map<String, dynamic>? data}) async {
    try {
      await _dio.request<dynamic>(path, data: data, options: Options(method: method));
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    }
  }

  Future<void> _updateWorkforce(String id, Map<String, dynamic> patch) async {
    final previous = Map<String, dynamic>.from(_workforceControls[id] ?? {});
    final next = <String, dynamic>{...previous, ...patch, 'id': id};
    if (mounted) setState(() => _workforceControls[id] = next);
    try {
      await _dio.patch('/api/workforce/live', data: {'employeeId': id, ...patch});
      await _load();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        if (previous.isEmpty) {
          _workforceControls.remove(id);
        } else {
          _workforceControls[id] = previous;
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    }
  }

  Future<void> _showWorkforceControls(String id, String name) async {
    final current = Map<String, dynamic>.from(_workforceControls[id] ?? {});
    var isVip = current['isVip'] == true;
    var autoCheckIn = current['autoCheckIn'] == true;
    var autoCheckOut = current['autoCheckOut'] == true;
    final result = await showDialog<Map<String, bool>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('قوى العمل · $name'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            SwitchListTile(contentPadding: EdgeInsets.zero, value: isVip, title: const Text('موظف VIP'), subtitle: const Text('تمييز الموظف كحالة أولوية في نظام الحضور.'), onChanged: (value) => setDialogState(() => isVip = value)),
            SwitchListTile(contentPadding: EdgeInsets.zero, value: autoCheckIn, title: const Text('الحضور التلقائي'), subtitle: const Text('السماح بمحرك الحضور التلقائي لهذا الموظف.'), onChanged: (value) => setDialogState(() => autoCheckIn = value)),
            SwitchListTile(contentPadding: EdgeInsets.zero, value: autoCheckOut, title: const Text('الانصراف التلقائي'), subtitle: const Text('السماح بمحرك الانصراف التلقائي لهذا الموظف.'), onChanged: (value) => setDialogState(() => autoCheckOut = value)),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('إلغاء')),
            FilledButton(onPressed: () => Navigator.of(dialogContext).pop({'isVip': isVip, 'autoCheckIn': autoCheckIn, 'autoCheckOut': autoCheckOut}), child: const Text('حفظ')),
          ],
        ),
      ),
    );
    if (result != null) await _updateWorkforce(id, result);
  }

  Future<void> _addEmployee() async {
    final name = TextEditingController();
    final job = TextEditingController();
    final pin = TextEditingController();
    final grace = TextEditingController();
    final earlyCheckout = TextEditingController();
    final rotationStart = TextEditingController();
    final specialties = TextEditingController(text: 'general');
    var status = 'active';
    var scheduleType = 'ADMIN';
    var startTime = '08:00';
    var endTime = '16:00';
    var locationId = '';
    var rotationOn = 7;
    var rotationOff = 7;
    var workDays = <int>{0, 1, 2, 3, 4};
    final dayLabels = const ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    try {
      final result = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: const Text('إضافة موظف جديد', style: TextStyle(fontWeight: FontWeight.w900)),
            content: SizedBox(
              width: 620,
              child: SingleChildScrollView(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('بيانات الموظف الأساسية', style: TextStyle(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 10),
                  TextField(controller: name, decoration: const InputDecoration(labelText: 'اسم الموظف', hintText: 'اكتب الاسم الكامل')),
                  const SizedBox(height: 8),
                  TextField(controller: job, decoration: const InputDecoration(labelText: 'الرقم الوظيفي', hintText: 'مثال: D718075')),
                  const SizedBox(height: 8),
                  TextField(controller: pin, obscureText: true, decoration: const InputDecoration(labelText: 'رمز PIN', hintText: '4 أحرف/أرقام على الأقل')),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(initialValue: status, decoration: const InputDecoration(labelText: 'الحالة'), items: const [DropdownMenuItem(value: 'active', child: Text('فعال')), DropdownMenuItem(value: 'suspended', child: Text('موقوف'))], onChanged: (v) => setDialogState(() => status = v ?? 'active')),
                  const SizedBox(height: 16),
                  const Text('الدوام والموقع', style: TextStyle(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(initialValue: scheduleType, decoration: const InputDecoration(labelText: 'نوع الدوام'), items: const [DropdownMenuItem(value: 'ADMIN', child: Text('إداري')), DropdownMenuItem(value: 'ROTATION', child: Text('تناوبي'))], onChanged: (v) => setDialogState(() => scheduleType = v ?? 'ADMIN')),
                  const SizedBox(height: 8),
                  Row(children: [Expanded(child: DropdownButtonFormField<String>(initialValue: startTime, decoration: const InputDecoration(labelText: 'بداية الدوام'), items: [for (var h = 0; h < 24; h++) for (var m in const [0, 30]) DropdownMenuItem(value: '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}', child: Text('${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}'))], onChanged: (v) => setDialogState(() => startTime = v ?? startTime))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<String>(initialValue: endTime, decoration: const InputDecoration(labelText: 'نهاية الدوام'), items: [for (var h = 0; h < 24; h++) for (var m in const [0, 30]) DropdownMenuItem(value: '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}', child: Text('${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}'))], onChanged: (v) => setDialogState(() => endTime = v ?? endTime))) ]),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(initialValue: locationId.isEmpty ? null : locationId, decoration: const InputDecoration(labelText: 'موقع العمل'), items: [const DropdownMenuItem<String>(value: '', child: Text('المقر الرئيسي')), ..._locations.where((l) => '${l['name'] ?? ''}'.trim() != 'المقر الرئيسي').map((l) => DropdownMenuItem<String>(value: '${l['id'] ?? ''}', child: Text('${l['name'] ?? 'موقع'}')))], onChanged: (v) => setDialogState(() => locationId = v ?? '')),
                  const SizedBox(height: 8),
                  Row(children: [Expanded(child: TextField(controller: grace, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'سماح التأخير بالدقائق', hintText: 'مثال: 6'))), const SizedBox(width: 8), Expanded(child: TextField(controller: earlyCheckout, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'سماح الانصراف المبكر', hintText: 'مثال: 60')))]),
                  if (scheduleType == 'ADMIN') ...[
                    const SizedBox(height: 12),
                    const Text('أيام الدوام', style: TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Wrap(spacing: 6, runSpacing: 6, children: [for (var i = 0; i < dayLabels.length; i++) FilterChip(label: Text(dayLabels[i]), selected: workDays.contains(i), onSelected: (selected) => setDialogState(() { if (selected) { workDays.add(i); } else { workDays.remove(i); } }))]),
                  ],
                  if (scheduleType == 'ROTATION') ...[
                    const SizedBox(height: 12),
                    Row(children: [Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOn, decoration: const InputDecoration(labelText: 'أيام العمل'), items: [for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i يوم'))], onChanged: (v) => setDialogState(() => rotationOn = v ?? 7))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<int>(initialValue: rotationOff, decoration: const InputDecoration(labelText: 'أيام الراحة'), items: [const DropdownMenuItem(value: 0, child: Text('بدون راحة')), for (var i = 1; i <= 31; i++) DropdownMenuItem(value: i, child: Text('$i يوم'))], onChanged: (v) => setDialogState(() => rotationOff = v ?? 7)))]),
                    const SizedBox(height: 8),
                    TextField(controller: rotationStart, keyboardType: TextInputType.datetime, decoration: const InputDecoration(labelText: 'تاريخ أول مناوبة', hintText: 'YYYY-MM-DD')),
                  ],
                  const SizedBox(height: 12),
                  TextField(controller: specialties, decoration: const InputDecoration(labelText: 'التخصصات', hintText: 'مثال: general, technician')),
                  const SizedBox(height: 8),
                  Text('قاعدة الانصراف المبكر: القيمة بالدقائق وتُحفظ عبر سياسة الموظف بعد إنشاء الحساب.', style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ]),
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
              FilledButton.icon(onPressed: () {
                if (name.text.trim().isEmpty || job.text.trim().isEmpty || pin.text.trim().length < 4 || (scheduleType == 'ADMIN' && workDays.isEmpty)) return;
                Navigator.of(dialogContext).pop(true);
              }, icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة الموظف')),
            ],
          ),
        ),
      );
      if (result != true) return;
      final employeeResponse = await _dio.post('/api/employees', data: {
        'name': name.text.trim(),
        'jobNumber': job.text.trim(),
        'pin': pin.text.trim(),
        'status': status,
        'scheduleType': scheduleType,
        'workStartTime': startTime,
        'workEndTime': endTime,
        'gracePeriodMinutes': int.tryParse(grace.text.trim()) ?? 0,
        'workDays': workDays.toList()..sort(),
        'rotationDaysOn': rotationOn,
        'rotationDaysOff': rotationOff,
        'rotationStartDate': rotationStart.text.trim().isEmpty ? null : rotationStart.text.trim(),
        'locationId': locationId.isEmpty ? null : locationId,
        'specialties': specialties.text.split(',').map((v) => v.trim()).where((v) => v.isNotEmpty).toList(),
        'avatar': null,
      });
      final employee = _asMap(employeeResponse.data)['employee'];
      final employeeId = employee is Map ? '${employee['id'] ?? ''}' : '';
      final early = int.tryParse(earlyCheckout.text.trim()) ?? 0;
      if (employeeId.isNotEmpty) {
        await _dio.put('/api/employees/$employeeId/checkout-policy', data: {'earlyCheckoutMinutes': early.clamp(0, 1440)});
      }
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إضافة الموظف بنجاح')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    } finally {
      name.dispose(); job.dispose(); pin.dispose(); grace.dispose(); earlyCheckout.dispose(); rotationStart.dispose(); specialties.dispose();
    }
  }

  Future<void> _addAdmin() async {
    final name = TextEditingController();
    final username = TextEditingController();
    final password = TextEditingController();
    var role = 'manager';
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('إضافة حساب إدارة'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: name, decoration: const InputDecoration(labelText: 'الاسم')),
            TextField(controller: username, decoration: const InputDecoration(labelText: 'اسم المستخدم')),
            TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'كلمة المرور')),
            DropdownButtonFormField<String>(initialValue: role, decoration: const InputDecoration(labelText: 'الصلاحية'), items: const [DropdownMenuItem(value: 'manager', child: Text('مدير')), DropdownMenuItem(value: 'supervisor', child: Text('مشرف'))], onChanged: (value) => setDialogState(() => role = value ?? 'manager')),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
            FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('حفظ')),
          ],
        ),
      ),
    );
    if (result != true || name.text.trim().isEmpty || username.text.trim().isEmpty || password.text.isEmpty) return;
    await _request('POST', '/api/admins', data: {'name': name.text.trim(), 'username': username.text.trim(), 'password': password.text, 'role': role});
  }

  Future<void> _deleteEmployee(String id, String name) async {
    final confirmed = await showDialog<bool>(
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
    if (confirmed == true) await _request('DELETE', '/api/employees/$id');
  }

  Future<void> _directAttendance(String id, String name, String type) async {
    final label = type == 'check-in' ? 'تحضير' : 'انصراف';
    final confirmed = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(title: Text('$label مباشر'), content: Text('تأكيد $label للموظف «$name»؟'), actions: [TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('تأكيد'))]));
    if (confirmed != true) return;
    try {
      final path = type == 'check-in' ? '/api/manager/attendance' : '/api/workforce/live';
      await _dio.post(path, data: {'employeeId': id, 'type': type});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تم تسجيل $label')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    }
  }

  Future<void> _changeEscape(String id, String name, String status) async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(title: Text(status == 'escaped' ? 'تسجيل هروب' : 'تسجيل عودة'), content: TextField(controller: controller, decoration: const InputDecoration(labelText: 'السبب / الملاحظة')), actions: [TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('تأكيد'))]));
    if (confirmed != true) { controller.dispose(); return; }
    try {
      await _dio.post('/api/escape-events', data: {'employeeId': id, 'status': status, 'reason': controller.text.trim()});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(status == 'escaped' ? 'تم تسجيل الهروب' : 'تم تسجيل العودة')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    } finally {
      controller.dispose();
    }
  }

  Future<void> _employeeRequest(String id, String name, String type) async {
    final reason = TextEditingController();
    final start = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));
    final end = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));
    final label = type == 'permission' ? 'إذن' : 'إجازة';
    try {
      final result = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(title: Text('تسجيل $label · $name'), content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: start, decoration: const InputDecoration(labelText: 'تاريخ البداية')), TextField(controller: end, decoration: const InputDecoration(labelText: 'تاريخ النهاية')), TextField(controller: reason, decoration: InputDecoration(labelText: 'السبب / الملاحظة'))]), actions: [TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('حفظ'))]));
      if (result != true) return;
      await _dio.post('/api/requests', data: {'employeeId': id, 'type': type, 'reason': reason.text.trim(), 'startDate': start.text.trim(), 'endDate': end.text.trim()});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تم تسجيل $label')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    } finally {
      reason.dispose(); start.dispose(); end.dispose();
    }
  }

  Widget _card(Widget child) => Card(margin: const EdgeInsets.only(bottom: 10), child: child);

  Widget _metric(String label, String value, IconData icon) => Expanded(child: Card(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 13), child: Column(children: [Icon(icon, color: HadirBrand.primary), const SizedBox(height: 6), Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10))]))));

  Widget _searchBox({required String hint, required ValueChanged<String> onChanged}) => TextField(onChanged: onChanged, decoration: InputDecoration(prefixIcon: const Icon(Icons.search_rounded), hintText: hint, isDense: true));

  Map<String, dynamic> _employeeWithControls(Map<String, dynamic> employee) {
    final id = '${employee['id'] ?? ''}';
    final controls = _workforceControls[id];
    return controls == null ? employee : {...employee, ...controls};
  }

  Widget _employeesView() {
    final filtered = _employees.where((raw) {
      if (raw is! Map) return false;
      final employee = _employeeWithControls(Map<String, dynamic>.from(raw));
      final query = _employeeQuery.trim().toLowerCase();
      final name = '${employee['name'] ?? ''}'.toLowerCase();
      final job = '${employee['jobNumber'] ?? ''}'.toLowerCase();
      final device = '${employee['deviceLabel'] ?? employee['deviceId'] ?? ''}'.toLowerCase();
      final status = '${employee['status'] ?? 'active'}'.toLowerCase();
      final schedule = '${employee['scheduleType'] ?? 'ADMIN'}';
      return (query.isEmpty || name.contains(query) || job.contains(query) || device.contains(query)) && (_employeeStatus == 'all' || status == _employeeStatus) && (_employeeSchedule == 'all' || schedule == _employeeSchedule);
    }).toList();
    final active = _employees.where((raw) => raw is Map && '${raw['status'] ?? 'active'}' == 'active').length;
    final inactive = _employees.length - active;
    final devices = _employees.where((raw) => raw is Map && '${raw['deviceId'] ?? ''}'.trim().isNotEmpty).length;
    final vip = _employees.where((raw) => raw is Map && _employeeWithControls(Map<String, dynamic>.from(raw))['isVip'] == true).length;
    final escaped = _employees.where((raw) => raw is Map && '${raw['escapeStatus'] ?? raw['fieldStatus'] ?? ''}'.toLowerCase() == 'escaped').length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [_metric('إجمالي الموظفين', '${_employees.length}', Icons.groups_rounded), const SizedBox(width: 8), _metric('فعال', '$active', Icons.check_circle_outline_rounded), const SizedBox(width: 8), _metric('موقوف', '$inactive', Icons.pause_circle_outline_rounded)]),
      const SizedBox(height: 8),
      Row(children: [_metric('أجهزة موثقة', '$devices', Icons.smartphone_rounded), const SizedBox(width: 8), _metric('VIP مفعل', '$vip', Icons.star_rounded), const SizedBox(width: 8), _metric('هروب', '$escaped', Icons.directions_walk_rounded)]),
      const SizedBox(height: 12),
      _searchBox(hint: 'بحث بالاسم أو الرقم أو الجهاز', onChanged: (v) => setState(() => _employeeQuery = v)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        _filterChip('كل الحالات', 'all', _employeeStatus, (v) => setState(() => _employeeStatus = v)),
        _filterChip('فعال', 'active', _employeeStatus, (v) => setState(() => _employeeStatus = v)),
        _filterChip('موقوف', 'suspended', _employeeStatus, (v) => setState(() => _employeeStatus = v)),
      ]),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        _filterChip('كل أنواع الدوام', 'all', _employeeSchedule, (v) => setState(() => _employeeSchedule = v)),
        _filterChip('إداري', 'ADMIN', _employeeSchedule, (v) => setState(() => _employeeSchedule = v)),
        _filterChip('تناوبي', 'ROTATION', _employeeSchedule, (v) => setState(() => _employeeSchedule = v)),
      ]),
      const SizedBox(height: 12),
      Row(children: [Expanded(child: Text('${filtered.length} نتيجة', style: const TextStyle(fontWeight: FontWeight.w800))), FilledButton.icon(onPressed: _addEmployee, icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة موظف'))]),
      const SizedBox(height: 10),
      if (filtered.isEmpty) _empty('لا توجد نتائج مطابقة.') else ...filtered.map((raw) {
        final employee = _employeeWithControls(Map<String, dynamic>.from(raw as Map));
        final id = '${employee['id'] ?? ''}';
        final name = '${employee['name'] ?? 'بدون اسم'}'.trim();
        final status = '${employee['status'] ?? 'active'}';
        final isVip = employee['isVip'] == true;
        final autoIn = employee['autoCheckIn'] == true;
        final autoOut = employee['autoCheckOut'] == true;
        final escapeStatus = '${employee['escapeStatus'] ?? employee['fieldStatus'] ?? 'none'}'.toLowerCase();
        final isEscaped = escapeStatus == 'escaped' || escapeStatus == 'escape';
        final hasDevice = '${employee['deviceId'] ?? ''}'.trim().isNotEmpty;
        final stateColor = _statusColor(status, escaped: isEscaped, hasDevice: hasDevice);
        final stateLabel = isEscaped ? 'هارب' : status.toLowerCase() == 'active' ? (hasDevice ? 'فعال ومرتبط' : 'فعال وغير مرتبط') : status.toLowerCase() == 'suspended' || status.toLowerCase() == 'inactive' ? 'موقوف' : status;
        final location = _locations.where((l) => '${l['id'] ?? ''}' == '${employee['locationId'] ?? ''}').firstOrNull;
        return _card(Container(
          decoration: BoxDecoration(border: Border(right: BorderSide(color: stateColor, width: 4)), borderRadius: BorderRadius.circular(12)),
          child: Padding(padding: const EdgeInsets.fromLTRB(8, 8, 8, 10), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ListTile(
              leading: CircleAvatar(backgroundColor: _statusSoft(stateColor), foregroundColor: stateColor, child: Text(name.isEmpty ? 'م' : name.substring(0, 1))),
              title: Row(children: [Flexible(child: Text(name, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900))), if (isVip) const Padding(padding: EdgeInsets.only(right: 6), child: Text('★ VIP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900)))]),
              subtitle: Padding(padding: const EdgeInsets.only(top: 5), child: Wrap(spacing: 6, runSpacing: 5, children: [Text('${employee['jobNumber'] ?? '—'} · ${employee['scheduleType'] == 'ROTATION' ? 'تناوبي' : 'إداري'}'), Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3), decoration: BoxDecoration(color: _statusSoft(stateColor), borderRadius: BorderRadius.circular(20)), child: Text(stateLabel, style: TextStyle(color: stateColor, fontWeight: FontWeight.w800, fontSize: 11)))])),
              isThreeLine: true,
            ),
            Wrap(spacing: 6, runSpacing: 6, children: [
              _infoPill('الوقت', employee['scheduleType'] == 'ROTATION' ? '${employee['rotationDaysOn'] ?? 7} عمل / ${employee['rotationDaysOff'] ?? 7} راحة' : '${employee['workStartTime'] ?? '--:--'} → ${employee['workEndTime'] ?? '--:--'}'),
              _infoPill('التأخير', '${employee['gracePeriodMinutes'] ?? 0} دقيقة'),
              _infoPill('الموقع', '${location?['name'] ?? 'المقر الرئيسي'}'),
              if (employee['deviceId'] != null && '${employee['deviceId']}'.isNotEmpty) _infoPill('الجهاز', '${employee['deviceLabel'] ?? 'مرتبط'}'),
              if (autoIn || autoOut) _infoPill('الأتمتة', '${autoIn ? 'حضور' : ''}${autoIn && autoOut ? ' + ' : ''}${autoOut ? 'انصراف' : ''}'),
            ]),
            const SizedBox(height: 8),
            SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
              _smallAction('إذن', Icons.event_available_rounded, () => _employeeRequest(id, name, 'permission')),
              _smallAction('إجازة', Icons.beach_access_rounded, () => _employeeRequest(id, name, 'leave')),
              _smallAction('تحضير', Icons.login_rounded, () => _directAttendance(id, name, 'check-in')),
              _smallAction('انصراف', Icons.logout_rounded, () => _directAttendance(id, name, 'check-out')),
              _smallAction(isEscaped ? 'عودة' : 'هروب', isEscaped ? Icons.rotate_left_rounded : Icons.directions_walk_rounded, () => _changeEscape(id, name, isEscaped ? 'returned' : 'escaped')),
              _smallAction('قوى العمل', Icons.auto_awesome_rounded, () => _showWorkforceControls(id, name)),
              _smallAction('الجهاز', Icons.smartphone_rounded, () => _request('DELETE', '/api/employees/$id/device')),
              _smallAction('حذف', Icons.delete_outline_rounded, () => _deleteEmployee(id, name)),
            ])),
          ])),
        ));
      }),
    ]);
  }

  Widget _infoPill(String label, String value) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .45), borderRadius: BorderRadius.circular(10)), child: Text('$label: $value', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)));

  Widget _smallAction(String label, IconData icon, VoidCallback onTap) => Padding(padding: const EdgeInsets.only(left: 6), child: OutlinedButton.icon(onPressed: onTap, icon: Icon(icon, size: 15), label: Text(label), style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9), textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800))));

  Widget _filterChip(String label, String value, String current, ValueChanged<String> onSelected) => ChoiceChip(label: Text(label), selected: current == value, onSelected: (_) => onSelected(value));

  Widget _requestsView() {
    final filtered = _requests.where((raw) {
      if (raw is! Map) return false;
      final request = Map<String, dynamic>.from(raw);
      final query = _requestQuery.trim().toLowerCase();
      final status = '${request['status'] ?? 'pending'}'.toLowerCase();
      final text = '${request['type'] ?? ''} ${request['employeeName'] ?? ''} ${request['employeeId'] ?? ''} ${request['reason'] ?? ''}'.toLowerCase();
      return (query.isEmpty || text.contains(query)) && (_requestStatus == 'all' || status == _requestStatus);
    }).toList();
    final pending = _requests.where((raw) => raw is Map && '${raw['status'] ?? 'pending'}' == 'pending').length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [_metric('إجمالي الطلبات', '${_requests.length}', Icons.inbox_rounded), const SizedBox(width: 8), _metric('قيد المراجعة', '$pending', Icons.pending_actions_rounded)]),
      const SizedBox(height: 8),
      _searchBox(hint: 'ابحث في نوع الطلب أو الموظف أو السبب', onChanged: (v) => setState(() => _requestQuery = v)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, children: [_filterChip('الكل', 'all', _requestStatus, (v) => setState(() => _requestStatus = v)), _filterChip('معلق', 'pending', _requestStatus, (v) => setState(() => _requestStatus = v)), _filterChip('مقبول', 'approved', _requestStatus, (v) => setState(() => _requestStatus = v)), _filterChip('مرفوض', 'rejected', _requestStatus, (v) => setState(() => _requestStatus = v))]),
      const SizedBox(height: 12),
      if (filtered.isEmpty) _empty('لا توجد طلبات مطابقة.') else ...filtered.map((raw) {
        final request = Map<String, dynamic>.from(raw as Map);
        final id = '${request['id'] ?? ''}';
        final status = '${request['status'] ?? 'pending'}';
        final color = _statusColor(status);
        return _card(Container(decoration: BoxDecoration(border: Border(right: BorderSide(color: color, width: 4)), borderRadius: BorderRadius.circular(12)), child: ListTile(title: Text('${request['type'] ?? 'طلب'} · ${request['employeeName'] ?? request['employeeId'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Wrap(spacing: 8, children: [Text('${request['reason'] ?? ''}'), Text('الحالة: $status', style: TextStyle(color: color, fontWeight: FontWeight.w800))]), isThreeLine: true, trailing: status == 'pending' ? PopupMenuButton<String>(onSelected: (value) => _request('PATCH', '/api/requests/$id', data: {'status': value}), itemBuilder: (_) => const [PopupMenuItem(value: 'approved', child: Text('موافقة')), PopupMenuItem(value: 'rejected', child: Text('رفض'))]) : null)));
      }),
    ]);
  }

  Widget _reportsView() {
    final successful = _audit.where((raw) => raw is Map && raw['result'] == 'success' && (raw['action'] == 'check-in' || raw['action'] == 'check-out')).toList();
    final checkIns = successful.where((raw) => (raw as Map)['action'] == 'check-in').length;
    final checkOuts = successful.where((raw) => (raw as Map)['action'] == 'check-out').length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [_metric('سجلات ناجحة', '${successful.length}', Icons.fact_check_rounded), const SizedBox(width: 8), _metric('حضور', '$checkIns', Icons.login_rounded), const SizedBox(width: 8), _metric('انصراف', '$checkOuts', Icons.logout_rounded)]),
      const SizedBox(height: 12),
      _card(const ListTile(title: Text('التقرير التفصيلي', style: TextStyle(fontWeight: FontWeight.w900)), subtitle: Text('عمليات الحضور والانصراف المستخرجة من سجل التدقيق.'))),
      ...successful.take(80).map((raw) { final item = Map<String, dynamic>.from(raw as Map); final color = _statusColor(item['action'] == 'check-in' ? 'active' : 'approved'); return _card(Container(decoration: BoxDecoration(border: Border(right: BorderSide(color: color, width: 3)), borderRadius: BorderRadius.circular(12)), child: ListTile(title: Text('${item['actorName'] ?? item['jobNumber'] ?? 'موظف'} · ${item['action']}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${item['timestamp'] ?? ''} · ${item['distanceMeters'] ?? 0} متر')))); }),
    ]);
  }

  Widget _auditView() {
    if (_audit.isEmpty) return _empty('لا توجد أحداث تدقيق.');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [_metric('إجمالي الأحداث', '${_audit.length}', Icons.security_rounded), const SizedBox(width: 8), _metric('ناجح', '${_audit.where((raw) => raw is Map && raw['result'] == 'success').length}', Icons.verified_rounded)]),
      const SizedBox(height: 12),
      ..._audit.take(120).map((raw) { final item = Map<String, dynamic>.from(raw as Map); final color = _statusColor('${item['result'] ?? ''}'); return _card(Container(decoration: BoxDecoration(border: Border(right: BorderSide(color: color, width: 3)), borderRadius: BorderRadius.circular(12)), child: ListTile(dense: true, title: Text('${item['action'] ?? 'حدث'} · ${item['actorName'] ?? item['jobNumber'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${item['timestamp'] ?? ''} · ${item['result'] ?? ''}', style: TextStyle(color: color))))); }),
    ]);
  }

  Widget _adminsView() {
    final filtered = _admins.where((raw) {
      if (raw is! Map) return false;
      final admin = Map<String, dynamic>.from(raw);
      final query = _adminQuery.trim().toLowerCase();
      return query.isEmpty || '${admin['name'] ?? ''} ${admin['username'] ?? ''} ${admin['role'] ?? ''}'.toLowerCase().contains(query);
    }).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [_metric('الحسابات', '${_admins.length}', Icons.admin_panel_settings_rounded), const Spacer(), FilledButton.icon(onPressed: _addAdmin, icon: const Icon(Icons.person_add), label: const Text('إضافة'))]),
      const SizedBox(height: 8),
      _searchBox(hint: 'ابحث بالاسم أو اسم المستخدم أو الصلاحية', onChanged: (v) => setState(() => _adminQuery = v)),
      const SizedBox(height: 12),
      if (filtered.isEmpty) _empty('لا توجد حسابات مطابقة.') else ...filtered.map((raw) {
        final admin = Map<String, dynamic>.from(raw as Map);
        final id = '${admin['id'] ?? ''}';
        final color = _statusColor(admin['active'] == false ? 'inactive' : 'active');
        return _card(Container(decoration: BoxDecoration(border: Border(right: BorderSide(color: color, width: 3)), borderRadius: BorderRadius.circular(12)), child: ListTile(leading: Icon(Icons.admin_panel_settings_rounded, color: color), title: Text('${admin['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('@${admin['username'] ?? ''} · ${admin['role'] ?? ''}'), trailing: Switch(value: admin['active'] != false, onChanged: (value) => _request('PATCH', '/api/admins/$id', data: {'active': value}))));
      }),
    ]);
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
    return Scaffold(
      appBar: AppBar(title: const Text('إدارة حاضر', style: TextStyle(fontWeight: FontWeight.w900)), leading: IconButton(onPressed: () => context.go('/admin'), icon: const Icon(Icons.arrow_back))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48), const SizedBox(height: 12), Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة'))])))
              : RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: List.generate(labels.length, (index) => Padding(padding: const EdgeInsets.only(left: 8), child: ChoiceChip(selected: _tab == index, avatar: Icon(icons[index], size: 17), label: Text(labels[index]), onSelected: (_) => setState(() => _tab = index))))), const SizedBox(height: 18), views[_tab]]))),
    );
  }
}
