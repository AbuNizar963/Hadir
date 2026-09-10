import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/api.dart';
import '../core/session.dart';

const _bg = Color(0xFF080D18);
const _surface = Color(0xFF101827);
const _surface2 = Color(0xFF141D2D);
const _green = Color(0xFF16D6A0);
const _cyan = Color(0xFF12E6FF);
const _muted = Color(0xFF8D99AB);
const _line = Color(0xFF253044);
const _danger = Color(0xFFFF4D55);

class AdminSettingsPage extends StatefulWidget {
  const AdminSettingsPage({super.key});

  @override
  State<AdminSettingsPage> createState() => _AdminSettingsPageState();
}

enum _SettingsView { home, identity, locations, security, diagnostics }

class _AdminSettingsPageState extends State<AdminSettingsPage> {
  final _session = HadirSession();
  Map<String, dynamic> _settings = {};
  List<dynamic> _locations = [];
  List<dynamic> _admins = [];
  _SettingsView _view = _SettingsView.home;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String _bulkAction = '';
  final _bulkValue = TextEditingController(text: '10');
  final _ownerName = TextEditingController();
  final _ownerUsername = TextEditingController();
  final _ownerPassword = TextEditingController();
  final _specialty = TextEditingController();
  final _locationName = TextEditingController();
  final _locationLat = TextEditingController();
  final _locationLng = TextEditingController();
  final _locationRadius = TextEditingController(text: '100');
  String? _editingLocationId;
  bool _showAddLocation = false;
  bool _diagnosticLoading = false;
  Map<String, dynamic> _health = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _bulkValue.dispose();
    _ownerName.dispose();
    _ownerUsername.dispose();
    _ownerPassword.dispose();
    _specialty.dispose();
    _locationName.dispose();
    _locationLat.dispose();
    _locationLng.dispose();
    _locationRadius.dispose();
    super.dispose();
  }

  Future<String?> _token() => _session.adminToken();

  Future<HadirApi?> _api() async {
    final token = await _token();
    if (token == null || token.isEmpty) {
      if (mounted) setState(() => _error = 'انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
      return null;
    }
    return HadirApi(token: token);
  }

  Future<void> _load({bool admins = false}) async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final api = await _api();
      if (api == null) return;
      final values = await Future.wait<dynamic>([
        api.settings(),
        api.locations(),
        if (admins) api.dio.get('/api/admins'),
      ]);
      if (!mounted) return;
      setState(() {
        _settings = Map<String, dynamic>.from(values[0] as Map);
        _locations = List<dynamic>.from(values[1] as List);
        if (admins) _admins = _asList(values[2]);
        _loading = false;
      });
      _syncOwnerFields();
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(e); });
    }
  }

  List<dynamic> _asList(dynamic value) {
    if (value is List) return List<dynamic>.from(value);
    if (value is Map && value['data'] is List) return List<dynamic>.from(value['data']);
    if (value is Map && value['admins'] is List) return List<dynamic>.from(value['admins']);
    return const [];
  }

  void _syncOwnerFields() {
    _ownerName.text = '${_settings['ownerName'] ?? ''}';
    _ownerUsername.text = '${_settings['ownerUsername'] ?? ''}';
  }

  Future<void> _save(Map<String, dynamic> patch) async {
    if (_busy || patch.isEmpty) return;
    setState(() { _busy = true; _error = null; });
    try {
      final api = await _api();
      if (api == null) return;
      final updated = await api.updateSettings(patch);
      if (!mounted) return;
      setState(() { _settings = {..._settings, ...patch, ...updated}; _busy = false; });
      _toast('تم حفظ الإعدادات بنجاح');
    } catch (e) {
      if (!mounted) return;
      setState(() { _busy = false; _error = HadirApi.errorMessage(e); });
    }
  }

  Future<void> _saveOwner() async {
    final name = _ownerName.text.trim();
    final username = _ownerUsername.text.trim();
    if (name.isEmpty || username.isEmpty) { _toast('أدخل اسم المالك واسم المستخدم', danger: true); return; }
    final patch = <String, dynamic>{'ownerName': name, 'ownerUsername': username};
    if (_ownerPassword.text.isNotEmpty) patch['ownerPassword'] = _ownerPassword.text;
    await _save(patch);
    _ownerPassword.clear();
  }

  Future<void> _addSpecialty() async {
    final value = _specialty.text.trim();
    if (value.isEmpty) return;
    final current = List<String>.from((_settings['specialties'] is List) ? _settings['specialties'] as List : const []);
    if (current.contains(value)) { _specialty.clear(); return; }
    current.add(value);
    _specialty.clear();
    await _save({'specialties': current});
  }

  Future<void> _removeSpecialty(String value) async {
    final current = List<String>.from((_settings['specialties'] is List) ? _settings['specialties'] as List : const []);
    current.remove(value);
    await _save({'specialties': current});
  }

  Future<void> _saveLocation() async {
    final name = _locationName.text.trim();
    final lat = double.tryParse(_locationLat.text.trim());
    final lng = double.tryParse(_locationLng.text.trim());
    final radius = double.tryParse(_locationRadius.text.trim());
    if (name.isEmpty || lat == null || lng == null || radius == null || radius <= 0) { _toast('بيانات الموقع غير صالحة', danger: true); return; }
    final wasEditing = _editingLocationId != null;
    setState(() => _busy = true);
    try {
      final api = await _api();
      if (api == null) return;
      final id = _editingLocationId ?? 'loc_${DateTime.now().millisecondsSinceEpoch}';
      final location = {'id': id, 'name': name, 'lat': lat, 'lng': lng, 'radiusMeters': radius};
      await api.dio.put('/api/locations', data: location);
      if (!mounted) return;
      setState(() { _busy = false; _showAddLocation = false; _editingLocationId = null; });
      _clearLocationForm();
      await _load();
      _toast(wasEditing ? 'تم تحديث الموقع بنجاح' : 'تم حفظ الموقع بنجاح');
    } catch (e) {
      if (!mounted) return;
      setState(() { _busy = false; _error = HadirApi.errorMessage(e); });
    }
  }

  void _clearLocationForm() {
    _locationName.clear();
    _locationLat.text = '${_settings['workSiteLat'] ?? ''}';
    _locationLng.text = '${_settings['workSiteLng'] ?? ''}';
    _locationRadius.text = '${_settings['radiusMeters'] ?? 100}';
  }

  void _editLocation(Map<String, dynamic> item) {
    _editingLocationId = '${item['id'] ?? ''}';
    _locationName.text = '${item['name'] ?? ''}';
    _locationLat.text = '${item['lat'] ?? ''}';
    _locationLng.text = '${item['lng'] ?? ''}';
    _locationRadius.text = '${item['radiusMeters'] ?? 100}';
    setState(() => _showAddLocation = true);
  }

  Future<void> _deleteLocation(String id) async {
    if (!await _confirm('حذف الموقع', 'سيتم حذف هذا الموقع من قائمة مواقع العمل. هل تريد المتابعة؟')) return;
    try {
      final api = await _api();
      if (api == null) return;
      await api.dio.delete('/api/locations/${Uri.encodeComponent(id)}');
      await _load();
      _toast('تم حذف الموقع');
    } catch (e) { _toast(HadirApi.errorMessage(e), danger: true); }
  }

  Future<void> _loadAdmins() => _load(admins: true);

  Future<void> _createAdmin() async {
    final name = await _prompt('إضافة حساب إداري', 'اسم المدير أو المشرف');
    if (name == null || name.trim().isEmpty) return;
    final username = await _prompt('اسم المستخدم', 'username');
    if (username == null || username.trim().isEmpty) return;
    final password = await _prompt('كلمة المرور', '12 محرفًا على الأقل');
    if (password == null || password.length < 12) { _toast('كلمة المرور يجب أن تكون 12 محرفًا على الأقل', danger: true); return; }
    try {
      final api = await _api();
      if (api == null) return;
      await api.dio.post('/api/admins', data: {'name': name.trim(), 'username': username.trim(), 'password': password, 'role': 'manager'});
      await _loadAdmins();
      _toast('تمت إضافة الحساب');
    } catch (e) { _toast(HadirApi.errorMessage(e), danger: true); }
  }

  Future<void> _deleteAdmin(String id) async {
    if (!await _confirm('حذف الحساب', 'هل تريد حذف حساب الإدارة هذا؟')) return;
    try {
      final api = await _api();
      if (api == null) return;
      await api.dio.delete('/api/admins/${Uri.encodeComponent(id)}');
      await _loadAdmins();
      _toast('تم حذف الحساب');
    } catch (e) { _toast(HadirApi.errorMessage(e), danger: true); }
  }

  Future<void> _toggleAdmin(String id, bool active) async {
    try {
      final api = await _api();
      if (api == null) return;
      await api.dio.patch('/api/admins/${Uri.encodeComponent(id)}', data: {'active': active});
      await _loadAdmins();
    } catch (e) { _toast(HadirApi.errorMessage(e), danger: true); }
  }

  Future<void> _runBulk() async {
    if (_bulkAction.isEmpty) { _toast('اختر إعدادًا من القائمة', danger: true); return; }
    final payload = <String, dynamic>{'action': _bulkAction};
    if (_bulkAction == 'password') {
      final value = await _prompt('كلمة مرور الموظفين', 'أدخل كلمة المرور الجديدة');
      if (value == null || value.length < 6) { _toast('كلمة المرور يجب أن تكون 6 محارف على الأقل', danger: true); return; }
      payload['password'] = value;
    } else if (_bulkAction == 'grace' || _bulkAction == 'earlyCheckout') {
      final minutes = int.tryParse(_bulkValue.text);
      if (minutes == null || minutes < 0 || minutes > 180) { _toast('القيمة يجب أن تكون بين 0 و180 دقيقة', danger: true); return; }
      payload['minutes'] = minutes;
    } else if (_bulkAction == 'adminWorkHours' || _bulkAction == 'rotationWorkHours') {
      payload['workStartTime'] = '08:00';
      payload['workEndTime'] = '16:00';
    } else if (_bulkAction == 'rotationDays') {
      payload['rotationDaysOn'] = 4;
      payload['rotationDaysOff'] = 4;
    }
    if (_bulkAction == 'unlinkDevices' || _bulkAction == 'revokeSessions') {
      if (!await _confirm('تأكيد العملية', _bulkAction == 'unlinkDevices' ? 'سيتم فك ربط أجهزة جميع الموظفين.' : 'سيتم تسجيل خروج جميع الموظفين.')) return;
    }
    try {
      final api = await _api();
      if (api == null) return;
      final result = await api.dio.post('/api/owner/bulk-settings', data: payload);
      final data = result.data is Map ? Map<String, dynamic>.from(result.data as Map) : <String, dynamic>{};
      _toast(data['message']?.toString() ?? 'تم تنفيذ العملية بنجاح');
    } catch (e) { _toast(HadirApi.errorMessage(e), danger: true); }
  }

  Future<void> _resetTestData() async {
    if (!await _confirm('إعادة تعيين البيانات', 'هذا الإجراء للمالك فقط وقد يحذف بيانات التشغيل والاختبار. هل تريد المتابعة؟')) return;
    try {
      final api = await _api();
      if (api == null) return;
      final response = await api.dio.post('/api/workforce/reset', data: {'confirmation': 'تأكيد'});
      final data = response.data is Map ? Map<String, dynamic>.from(response.data as Map) : <String, dynamic>{};
      _toast(data['message']?.toString() ?? 'تمت إعادة التهيئة');
      await _load();
    } catch (e) { _toast(HadirApi.errorMessage(e), danger: true); }
  }

  Future<void> _checkHealth() async {
    setState(() => _diagnosticLoading = true);
    try {
      final api = await _api();
      if (api == null) return;
      final data = await api.health();
      if (!mounted) return;
      setState(() { _health = data; _diagnosticLoading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _diagnosticLoading = false; _error = HadirApi.errorMessage(e); });
    }
  }

  Future<bool> _confirm(String title, String message) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _surface2,
        title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
        content: Text(message, style: const TextStyle(color: _muted)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black), child: const Text('متابعة')),
        ],
      ),
    );
    return result == true;
  }

  Future<String?> _prompt(String title, String hint) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _surface2,
        title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
        content: TextField(controller: controller, autofocus: true, textDirection: TextDirection.rtl, style: const TextStyle(color: Colors.white), decoration: _inputDecoration(hint)),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('حفظ'))],
      ),
    );
    controller.dispose();
    return result;
  }

  InputDecoration _inputDecoration(String hint) => InputDecoration(hintText: hint, hintStyle: const TextStyle(color: _muted), filled: true, fillColor: const Color(0xFF070C16), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _line)), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _line)), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _green)));

  void _toast(String text, {bool danger = false}) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: danger ? _danger : _green, content: Text(text, style: TextStyle(color: danger ? Colors.white : Colors.black, fontWeight: FontWeight.w800))));

  Widget _eyebrow(String text, {Color color = _green}) => Text(text, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.3, fontFamily: 'monospace'));

  Widget _card({required Widget child, Color? border, EdgeInsets padding = const EdgeInsets.all(16)}) => Container(padding: padding, decoration: BoxDecoration(color: _surface.withValues(alpha: .96), borderRadius: BorderRadius.circular(22), border: Border.all(color: border ?? _line), boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 18, offset: Offset(0, 8))]), child: child);

  Widget _iconBox(IconData icon, {Color color = _green}) => Container(width: 44, height: 44, decoration: BoxDecoration(color: color.withValues(alpha: .11), borderRadius: BorderRadius.circular(14), border: Border.all(color: color.withValues(alpha: .12))), child: Icon(icon, color: color, size: 21));

  Widget _titleBlock(String code, String title, String description, IconData icon, {Color color = _green}) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [_iconBox(icon, color: color), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_eyebrow(code, color: color), const SizedBox(height: 4), Text(title, textAlign: TextAlign.right, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text(description, textAlign: TextAlign.right, style: const TextStyle(color: _muted, fontSize: 11, height: 1.45))]))]);

  Widget _sectionHeader(String title, String subtitle, IconData icon, {Color color = _green}) => Row(children: [_iconBox(icon, color: color), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10))]))]);

  Widget _home() {
    return ListView(padding: const EdgeInsets.fromLTRB(18, 16, 18, 90), children: [
      _card(border: _green.withValues(alpha: .22), child: Column(children: [
        Align(alignment: Alignment.centerRight, child: _eyebrow('HADIR · OWNER')),
        const SizedBox(height: 4),
        const Align(alignment: Alignment.centerRight, child: Text('الإعدادات', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900))),
        const SizedBox(height: 2),
        const Align(alignment: Alignment.centerRight, child: Text('إدارة النظام والهوية والمواقع والحسابات والأمان', style: TextStyle(color: _muted, fontSize: 11))),
        const SizedBox(height: 18),
        _brandCard(),
      ])),
      const SizedBox(height: 12),
      _card(child: Column(children: [
        _sectionHeader('الإعدادات', 'اختر قسمًا لفتح واجهته المستقلة', Icons.settings_outlined),
        const SizedBox(height: 6),
        _homeRow('الهوية والحسابات', 'هوية الشركة وحسابات الإدارة', Icons.person_outline_rounded, _SettingsView.identity),
        _homeRow('المواقع و QR', 'مواقع العمل ورموز الحضور', Icons.location_on_outlined, _SettingsView.locations),
        _homeRow('الأمان والصلاحيات', 'الحسابات والعمليات الجماعية', Icons.person_add_alt_1_outlined, _SettingsView.security),
        _homeRow('التشخيص وإعادة التهيئة', 'التشخيص وإعادة ضبط البيانات', Icons.gps_fixed_outlined, _SettingsView.diagnostics),
      ])),
    ]);
  }

  Widget _brandCard() => Container(padding: const EdgeInsets.fromLTRB(16, 16, 16, 14), decoration: BoxDecoration(color: const Color(0xFF151C2E), borderRadius: BorderRadius.circular(22), border: Border.all(color: _green.withValues(alpha: .18))), child: Column(children: [Stack(alignment: Alignment.bottomRight, children: [Container(width: 96, height: 96, padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: const Color(0xFF1B2236), shape: BoxShape.circle, border: Border.all(color: _green.withValues(alpha: .25), width: 2)), child: Image.asset('assets/branding/hadir_logo_transparent.png', fit: BoxFit.contain)), Container(width: 32, height: 32, decoration: const BoxDecoration(color: _green, shape: BoxShape.circle), child: const Icon(Icons.camera_alt_outlined, color: Colors.black, size: 17))]), const SizedBox(height: 10), Text('${_settings['brandName'] ?? 'قسم شرطة الشهباء'}', style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900)), const SizedBox(height: 3), const Text('هوية الشركة · الإعدادات المركزية', style: TextStyle(color: _muted, fontSize: 10)), const SizedBox(height: 5), TextButton(onPressed: () => setState(() => _view = _SettingsView.identity), child: const Text('إدارة الهوية', style: TextStyle(color: _danger, fontSize: 11, fontWeight: FontWeight.w900))) ]));

  Widget _homeRow(String title, String subtitle, IconData icon, _SettingsView view) => InkWell(onTap: () { setState(() => _view = view); if (view == _SettingsView.identity) _loadAdmins(); }, borderRadius: BorderRadius.circular(16), child: Container(margin: const EdgeInsets.only(top: 7), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12), decoration: BoxDecoration(border: Border(bottom: BorderSide(color: _line.withValues(alpha: .65)))), child: Row(children: [_iconBox(icon), const SizedBox(width: 11), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13)), const SizedBox(height: 2), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10))])), const Icon(Icons.chevron_left_rounded, color: _muted)]));

  Widget _identity() {
    final specialties = List<String>.from((_settings['specialties'] is List) ? _settings['specialties'] as List : const []);
    return ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 90), children: [
      _pageHeader('الهوية والحسابات', 'هوية الشركة والحسابات الإدارية', Icons.badge_outlined, _SettingsView.home),
      const SizedBox(height: 10),
      _card(child: Column(children: [
        _sectionHeader('هوية الشركة والجهة', 'الاسم والشعار والتخصصات المستخدمة عند إضافة الموظفين وفي التقارير', Icons.business_outlined),
        const SizedBox(height: 14),
        _field('اسم الشركة / الجهة', _settings['brandName']?.toString() ?? '', (v) => _save({'brandName': v})),
        const SizedBox(height: 10),
        const Align(alignment: Alignment.centerRight, child: Text('تخصصات العمل', style: TextStyle(color: _muted, fontSize: 11, fontWeight: FontWeight.w700))),
        const SizedBox(height: 7),
        Row(children: [Expanded(child: TextField(controller: _specialty, textDirection: TextDirection.rtl, style: const TextStyle(color: Colors.white, fontSize: 12), decoration: _inputDecoration('إضافة تخصص جديد'))), const SizedBox(width: 7), FilledButton(onPressed: _addSpecialty, style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black), child: const Text('+ إضافة'))]),
        const SizedBox(height: 8),
        ...List.generate(specialties.length, (i) => _specialtyRow(i + 1, specialties[i])),
      ])),
      const SizedBox(height: 10),
      _card(border: _cyan.withValues(alpha: .28), child: Column(children: [
        _sectionHeader('حساب المالك', 'بيانات المالك واسم المستخدم وتحديث كلمة المرور', Icons.person_outline_rounded, color: _cyan),
        const SizedBox(height: 12),
        _fieldController('اسم المالك', _ownerName),
        const SizedBox(height: 8),
        _fieldController('اسم المستخدم', _ownerUsername),
        const SizedBox(height: 8),
        _fieldController('كلمة مرور جديدة', _ownerPassword, obscure: true),
        const SizedBox(height: 10),
        Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: _surface2, borderRadius: BorderRadius.circular(14)), child: const Text('يتم تطبيق بيانات المالك من خلال مسار الحفظ المركزي. لن يتم تعديل الحساب بمعزل عن الخادم.', textAlign: TextAlign.right, style: TextStyle(color: _muted, fontSize: 10, height: 1.5))),
        const SizedBox(height: 10),
        Align(alignment: Alignment.centerLeft, child: FilledButton(onPressed: _busy ? null : _saveOwner, style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black), child: const Text('حفظ بيانات المالك'))),
      ])),
      const SizedBox(height: 10),
      _adminAccountsCard(),
    ]);
  }

  Widget _adminAccountsCard() => _card(child: Column(children: [
    _sectionHeader('حسابات المدراء والمشرفين', 'إدارة حسابات الإدارة والصلاحيات', Icons.admin_panel_settings_outlined),
    const SizedBox(height: 9),
    Align(alignment: Alignment.centerLeft, child: FilledButton.icon(onPressed: _createAdmin, icon: const Icon(Icons.add, size: 17), label: const Text('إضافة حساب'))),
    const SizedBox(height: 6),
    if (_admins.isEmpty) const Padding(padding: EdgeInsets.all(12), child: Text('لا توجد حسابات إضافية أو لم يتم تحميلها بعد.', style: TextStyle(color: _muted, fontSize: 10))),
    ..._admins.map((raw) { final a = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{}; final active = a['active'] != false; return Container(margin: const EdgeInsets.only(top: 5), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9), decoration: BoxDecoration(color: _surface2, borderRadius: BorderRadius.circular(12)), child: Row(children: [Icon(active ? Icons.check_circle_outline : Icons.block_outlined, color: active ? _green : _danger, size: 17), const SizedBox(width: 8), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${a['name'] ?? a['username'] ?? 'حساب'}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)), Text('${a['username'] ?? ''} · ${a['role'] ?? 'manager'}', style: const TextStyle(color: _muted, fontSize: 9))])), Switch(value: active, onChanged: (v) => _toggleAdmin('${a['id'] ?? ''}', v)), IconButton(onPressed: () => _deleteAdmin('${a['id'] ?? ''}'), icon: const Icon(Icons.delete_outline, color: _danger, size: 18))])); }).toList(),
  ]));

  Widget _specialtyRow(int number, String value) => Container(margin: const EdgeInsets.only(top: 5), padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7), decoration: BoxDecoration(color: _surface2, borderRadius: BorderRadius.circular(11)), child: Row(children: [IconButton(onPressed: () => _removeSpecialty(value), icon: const Icon(Icons.delete_outline, color: _danger, size: 16)), const SizedBox(width: 2), Expanded(child: Text('$number. $value', textAlign: TextAlign.right, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800))), const Icon(Icons.drag_indicator_rounded, color: _muted, size: 16)]));

  Widget _locations() {
    final qr = '${_settings['qrCode'] ?? 'HADIR-SITE-01-STATIC'}';
    return ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 90), children: [
      _pageHeader('المواقع و QR', 'إدارة مواقع العمل ورموز الحضور', Icons.location_on_outlined, _SettingsView.home),
      const SizedBox(height: 10),
      _card(child: Column(children: [
        _sectionHeader('مواقع العمل', 'اختر موقعًا من القائمة أو أضف موقع عمل جديد', Icons.location_on_outlined),
        const SizedBox(height: 8),
        ..._locations.map((raw) { final item = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{}; final id = '${item['id'] ?? ''}'; return Container(margin: const EdgeInsets.only(top: 5), padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 8), decoration: BoxDecoration(color: _surface2, borderRadius: BorderRadius.circular(12)), child: Row(children: [const Icon(Icons.location_on_outlined, color: _green, size: 18), const SizedBox(width: 7), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${item['name'] ?? id}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)), Text('${item['lat'] ?? '—'} · ${item['lng'] ?? '—'} · ${item['radiusMeters'] ?? '—'}م', style: const TextStyle(color: _muted, fontSize: 9))])), IconButton(onPressed: () => _editLocation(item), icon: const Icon(Icons.edit_outlined, color: _cyan, size: 17)), if (id != 'main') IconButton(onPressed: () => _deleteLocation(id), icon: const Icon(Icons.delete_outline, color: _danger, size: 17))])); }).toList(),
        const SizedBox(height: 8),
        OutlinedButton.icon(onPressed: () { _editingLocationId = null; _clearLocationForm(); setState(() => _showAddLocation = true); }, icon: const Icon(Icons.add, color: _green, size: 18), label: const Text('إضافة موقع عمل جديد', style: TextStyle(color: _green))),
        if (_showAddLocation) ...[
          const Divider(color: _line, height: 24),
          _fieldController('اسم الموقع', _locationName), const SizedBox(height: 8),
          _fieldController('خط العرض', _locationLat), const SizedBox(height: 8),
          _fieldController('خط الطول', _locationLng), const SizedBox(height: 8),
          _fieldController('النطاق بالمتر', _locationRadius), const SizedBox(height: 10),
          Row(children: [Expanded(child: OutlinedButton(onPressed: () { _clearLocationForm(); setState(() => _showAddLocation = false); }, child: const Text('إلغاء'))), const SizedBox(width: 8), Expanded(child: FilledButton(onPressed: _saveLocation, style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black), child: const Text('حفظ الموقع')))]),
        ],
      ])),
      const SizedBox(height: 10),
      _card(border: _cyan.withValues(alpha: .25), child: Column(children: [
        _sectionHeader('رمز QR', 'الرمز المستخدم للتحقق من موقع الحضور والانصراف', Icons.qr_code_2_rounded, color: _cyan),
        const SizedBox(height: 10),
        Align(alignment: Alignment.centerRight, child: _eyebrow('QR ACCESS · 04', color: _cyan)),
        const SizedBox(height: 7),
        Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)), child: QrImageView(data: qr, version: QrVersions.auto, size: 220, eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Colors.black), dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Colors.black))),
        const SizedBox(height: 8),
        Text(qr, textDirection: TextDirection.ltr, style: const TextStyle(color: _muted, fontSize: 10, fontFamily: 'monospace')),
        const SizedBox(height: 10),
        Row(children: [Expanded(child: OutlinedButton.icon(onPressed: () => _save({'qrCode': 'HADIR-${DateTime.now().millisecondsSinceEpoch}'}), icon: const Icon(Icons.qr_code_2, size: 17), label: const Text('توليد رمز جديد'))), const SizedBox(width: 8), Expanded(child: FilledButton.icon(onPressed: () => _toast('الرمز ظاهر وجاهز للمشاركة أو الطباعة من الجهاز'), icon: const Icon(Icons.print_outlined, size: 17), label: const Text('طباعة الرمز'), style: FilledButton.styleFrom(backgroundColor: _cyan, foregroundColor: Colors.black)))]),
      ])),
    ]);
  }

  Widget _security() => ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 90), children: [
    _pageHeader('الأمان والصلاحيات', 'حساب المالك والعمليات الجماعية للموظفين', Icons.shield_outlined, _SettingsView.home),
    const SizedBox(height: 10),
    _card(border: _green.withValues(alpha: .28), child: Column(children: [
      _sectionHeader('إدارة الموظفين دفعة واحدة', 'مركز تحكم موحد للمالك لتطبيق العمليات على جميع الموظفين', Icons.manage_accounts_outlined),
      const SizedBox(height: 12),
      Align(alignment: Alignment.centerRight, child: _eyebrow('OWNER CONTROL · BULK EMPLOYEE SETTINGS')),
      const SizedBox(height: 7),
      DropdownButtonFormField<String>(value: _bulkAction.isEmpty ? null : _bulkAction, dropdownColor: _surface2, decoration: _inputDecoration('اختيار إعداد'), style: const TextStyle(color: Colors.white, fontSize: 12), items: const [
        DropdownMenuItem(value: 'password', child: Text('تغيير كلمة مرور جميع الموظفين')),
        DropdownMenuItem(value: 'avatar', child: Text('تغيير الصورة الشخصية للجميع')),
        DropdownMenuItem(value: 'grace', child: Text('مهلة التأخر')),
        DropdownMenuItem(value: 'earlyCheckout', child: Text('مهلة الانصراف المبكر')),
        DropdownMenuItem(value: 'adminWorkHours', child: Text('أوقات دوام الموظفين الإداريين')),
        DropdownMenuItem(value: 'rotationWorkHours', child: Text('أوقات دوام الموظفين التناوبيين')),
        DropdownMenuItem(value: 'rotationDays', child: Text('أيام التناوب للموظفين التناوبيين')),
        DropdownMenuItem(value: 'unlinkDevices', child: Text('فك ربط جميع الأجهزة')),
        DropdownMenuItem(value: 'revokeSessions', child: Text('تسجيل خروج جميع الموظفين')),
      ], onChanged: (v) => setState(() => _bulkAction = v ?? '')),
      const SizedBox(height: 10),
      if (_bulkAction == 'grace' || _bulkAction == 'earlyCheckout') _fieldController('عدد الدقائق', _bulkValue),
      if (_bulkAction == 'adminWorkHours' || _bulkAction == 'rotationWorkHours') _compactInfo('08:00 → 16:00', 'وقت البداية والنهاية سيطبقان حسب نوع الدوام المحدد.'),
      if (_bulkAction == 'rotationDays') _compactInfo('4 أيام مناوبة + 4 أيام راحة', 'دورة التناوب الافتراضية. يمكن تعديلها لاحقًا من إعدادات الموظفين.'),
      if (_bulkAction == 'avatar') _compactInfo('الصورة الموحدة', 'رفع الصورة الموحدة يتم من واجهة الموظفين الذكية مع الحفاظ على ضغط الصورة.'),
      if (_bulkAction == 'password') _compactInfo('كلمة مرور جديدة', 'سيتم إلغاء الجلسات الحالية للموظفين بعد التطبيق.'),
      if (_bulkAction == 'unlinkDevices' || _bulkAction == 'revokeSessions') _compactInfo('عملية حساسة', 'ستؤثر على جميع الموظفين وتتطلب تأكيدًا قبل التنفيذ.'),
      const SizedBox(height: 10),
      Align(alignment: Alignment.centerLeft, child: FilledButton(onPressed: _runBulk, style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black), child: const Text('تنفيذ العملية'))),
    ])),
  ];

  Widget _compactInfo(String title, String text) => Container(width: double.infinity, padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFF0A111E), borderRadius: BorderRadius.circular(15), border: Border.all(color: _green.withValues(alpha: .18))), child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11)), const SizedBox(height: 3), Text(text, textAlign: TextAlign.right, style: const TextStyle(color: _muted, fontSize: 10, height: 1.45))]));

  Widget _diagnostics() => ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 90), children: [
    _pageHeader('التشخيص وإعادة التهيئة', 'مراجعة صحة النظام وإجراءات إعادة التهيئة', Icons.gps_fixed_outlined, _SettingsView.home),
    const SizedBox(height: 10),
    _card(child: Column(children: [
      _titleBlock('SYSTEM HEALTH · 07', 'تشخيص النظام', 'مراجعة سجل الأخطاء المحلي وتنظيم حالة النظام.', Icons.gps_fixed_outlined),
      const SizedBox(height: 12),
      Row(children: [Expanded(child: OutlinedButton.icon(onPressed: _checkHealth, icon: _diagnosticLoading ? const SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.gps_fixed_outlined, size: 16), label: const Text('فتح سجل التشخيص'))), const SizedBox(width: 7), Expanded(child: FilledButton.icon(onPressed: _checkHealth, icon: const Icon(Icons.refresh, size: 16), label: const Text('فحص النظام'), style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black)))]),
      if (_health.isNotEmpty) ...[const SizedBox(height: 9), _compactInfo('حالة الخادم', _health.entries.map((e) => '${e.key}: ${e.value}').join(' · '))],
    ])),
    const SizedBox(height: 10),
    _dangerCard('DANGER ZONE · 08', 'إعادة تهيئة النظام', 'إجراء تحضيري ومسؤول للمالك لإعادة بيانات التشغيل والاختبار وفق مسار الخادم.', Icons.security_outlined, 'إعادة تهيئة النظام', _resetTestData),
    const SizedBox(height: 10),
    _dangerCard('LOCAL RESET · 09', 'إعادة تعيين البيانات', 'إعادة تحميل بيانات النظام المحلية عند الحاجة. لا يتم تنفيذ الإجراء إلا بعد تأكيدك.', Icons.warning_amber_rounded, 'إعادة تعيين البيانات', _resetTestData),
    const SizedBox(height: 10),
    _card(child: const Text('ملاحظة: الأدوات المتقدمة لا تظهر للمالك إلا بعد التحقق من الصلاحيات الأساسية.', textAlign: TextAlign.right, style: TextStyle(color: _muted, fontSize: 10, height: 1.5))),
  ];

  Widget _dangerCard(String code, String title, String description, IconData icon, String button, VoidCallback action) => _card(border: _danger.withValues(alpha: .34), child: Column(children: [_titleBlock(code, title, description, icon, color: _danger), const SizedBox(height: 11), Align(alignment: Alignment.centerLeft, child: FilledButton.icon(onPressed: action, icon: const Icon(Icons.restart_alt_rounded, size: 16), label: Text(button), style: FilledButton.styleFrom(backgroundColor: _danger, foregroundColor: Colors.white)))]));

  Widget _pageHeader(String title, String subtitle, IconData icon, _SettingsView back) => Row(children: [IconButton(onPressed: () => setState(() => _view = back), icon: const Icon(Icons.chevron_right_rounded, color: _muted)), const SizedBox(width: 4), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(title, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10))]), const SizedBox(width: 10), _iconBox(icon)]);

  Widget _field(String label, String initial, ValueChanged<String> onSave) { final controller = TextEditingController(text: initial); return Row(children: [Expanded(child: TextField(controller: controller, textDirection: TextDirection.rtl, style: const TextStyle(color: Colors.white, fontSize: 12), decoration: _inputDecoration(label))), const SizedBox(width: 7), IconButton(onPressed: () { final value = controller.text.trim(); if (value.isNotEmpty) onSave(value); }, icon: const Icon(Icons.save_outlined, color: _green, size: 20))]); }

  Widget _fieldController(String label, TextEditingController controller, {bool obscure = false}) => TextField(controller: controller, obscureText: obscure, textDirection: TextDirection.rtl, style: const TextStyle(color: Colors.white, fontSize: 12), decoration: _inputDecoration(label));

  Widget _body() {
    switch (_view) {
      case _SettingsView.identity: return _identity();
      case _SettingsView.locations: return _locations();
      case _SettingsView.security: return _security();
      case _SettingsView.diagnostics: return _diagnostics();
      case _SettingsView.home: return _home();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(textDirection: TextDirection.rtl, child: Scaffold(backgroundColor: _bg, body: Stack(children: [if (_loading) const Center(child: CircularProgressIndicator(color: _green)) else _body(), if (_busy) const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator(minHeight: 2, color: _cyan, backgroundColor: Colors.transparent)), if (_error != null && !_loading) Positioned(left: 18, right: 18, bottom: 74, child: Material(color: _danger, borderRadius: BorderRadius.circular(12), child: Padding(padding: const EdgeInsets.all(10), child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)))) , Positioned(left: 18, right: 18, bottom: 14, child: SafeArea(top: false, child: SizedBox(height: 42, child: FilledButton(onPressed: _busy ? null : () => _save(_settings), style: FilledButton.styleFrom(backgroundColor: _cyan, foregroundColor: Colors.black, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))), child: Text(_busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)))))]));
  }
}
