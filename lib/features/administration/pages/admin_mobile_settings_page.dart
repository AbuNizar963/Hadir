import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/api.dart';
import '../../../core/session.dart';

enum _SettingsView { home, identity, locations, security, diagnostics }

class AdminMobileSettingsPage extends StatefulWidget {
  const AdminMobileSettingsPage({super.key});

  @override
  State<AdminMobileSettingsPage> createState() => _AdminMobileSettingsPageState();
}

class _AdminMobileSettingsPageState extends State<AdminMobileSettingsPage> {
  static const _bg = Color(0xFF080D18);
  static const _card = Color(0xFF111827);
  static const _inner = Color(0xFF151E30);
  static const _green = Color(0xFF17D7A1);
  static const _cyan = Color(0xFF10E7FF);
  static const _muted = Color(0xFF8B97AA);
  static const _line = Color(0xFF263146);
  static const _red = Color(0xFFFF4D55);

  final _session = HadirSession();
  final _ownerName = TextEditingController();
  final _ownerUsername = TextEditingController();
  final _ownerPassword = TextEditingController();
  final _specialty = TextEditingController();
  final _bulkMinutes = TextEditingController(text: '10');
  final _locationName = TextEditingController();
  final _locationLat = TextEditingController();
  final _locationLng = TextEditingController();
  final _locationRadius = TextEditingController(text: '100');

  _SettingsView _view = _SettingsView.home;
  Map<String, dynamic> _settings = <String, dynamic>{};
  List<dynamic> _locations = <dynamic>[];
  List<dynamic> _admins = <dynamic>[];
  bool _loading = true;
  bool _saving = false;
  bool _locationEditor = false;
  String? _error;
  String? _editingLocation;
  String _bulkAction = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ownerName.dispose();
    _ownerUsername.dispose();
    _ownerPassword.dispose();
    _specialty.dispose();
    _bulkMinutes.dispose();
    _locationName.dispose();
    _locationLat.dispose();
    _locationLng.dispose();
    _locationRadius.dispose();
    super.dispose();
  }

  Future<HadirApi?> _api() async {
    final token = await _session.adminToken();
    if (token == null || token.isEmpty) {
      if (mounted) setState(() => _error = 'انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
      return null;
    }
    return HadirApi(token: token);
  }

  Future<void> _load({bool admins = false}) async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
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
        if (admins) {
          final raw = values[2];
          if (raw is List) {
            _admins = List<dynamic>.from(raw);
          } else if (raw is Map && raw['admins'] is List) {
            _admins = List<dynamic>.from(raw['admins'] as List);
          }
        }
        _loading = false;
      });
      _ownerName.text = '${_settings['ownerName'] ?? ''}';
      _ownerUsername.text = '${_settings['ownerUsername'] ?? ''}';
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(error);
      });
    }
  }

  Future<void> _save(Map<String, dynamic> patch) async {
    if (_saving || patch.isEmpty) return;
    setState(() => _saving = true);
    try {
      final api = await _api();
      if (api == null) return;
      final updated = await api.updateSettings(patch);
      if (!mounted) return;
      setState(() => _settings = <String, dynamic>{..._settings, ...patch, ...updated});
      _toast('تم حفظ الإعدادات');
    } catch (error) {
      if (mounted) setState(() => _error = HadirApi.errorMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _toast(String text, {bool danger = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: danger ? _red : _green,
        content: Text(text, style: TextStyle(color: danger ? Colors.white : Colors.black, fontWeight: FontWeight.w800)),
      ),
    );
  }

  Future<bool> _confirm(String title, String message) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: _inner,
          title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
          content: Text(message, style: const TextStyle(color: _muted)),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('إلغاء')),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('متابعة')),
          ],
        );
      },
    );
    return result == true;
  }

  InputDecoration _input(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: _muted),
      filled: true,
      fillColor: const Color(0xFF070C16),
      border: const OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: _line),
      ),
      enabledBorder: const OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: _line),
      ),
      focusedBorder: const OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: _green),
      ),
    );
  }

  Widget _iconBox(IconData icon, {Color color = _green}) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(13)),
      child: Icon(icon, color: color, size: 21),
    );
  }

  Widget _card(Widget child, {Color border = _line}) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: border),
      ),
      child: child,
    );
  }

  Widget _sectionHeader(String title, String subtitle, IconData icon, {Color color = _green}) {
    return Row(
      children: [
        _iconBox(icon, color: color),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w900)),
              Text(subtitle, style: const TextStyle(color: _muted, fontSize: 9.5)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _pageHeader(String title, String subtitle, IconData icon) {
    return Row(
      children: [
        IconButton(
          onPressed: () => setState(() => _view = _SettingsView.home),
          icon: const Icon(Icons.chevron_right_rounded, color: _muted),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w900)),
              Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10)),
            ],
          ),
        ),
        const SizedBox(width: 9),
        _iconBox(icon),
      ],
    );
  }

  Widget _home() {
    final rows = <Widget>[
      _homeRow('الهوية والحسابات', 'هوية الشركة وحسابات الإدارة', Icons.person_outline_rounded, _SettingsView.identity),
      _homeRow('المواقع و QR', 'مواقع العمل ورموز الحضور', Icons.location_on_outlined, _SettingsView.locations),
      _homeRow('الأمان والصلاحيات', 'الحسابات والعمليات الجماعية', Icons.person_add_alt_1_outlined, _SettingsView.security),
      _homeRow('التشخيص وإعادة التهيئة', 'التشخيص وإعادة ضبط البيانات', Icons.gps_fixed_outlined, _SettingsView.diagnostics),
    ];

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 15, 18, 88),
      children: [
        _card(
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('HADIR · OWNER', textDirection: TextDirection.ltr, style: TextStyle(color: _green, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.2)),
              const SizedBox(height: 3),
              const Text('الإعدادات', textAlign: TextAlign.right, style: TextStyle(color: Colors.white, fontSize: 27, fontWeight: FontWeight.w900)),
              const Text('إدارة النظام والهوية والمواقع والحسابات والأمان', textAlign: TextAlign.right, style: TextStyle(color: _muted, fontSize: 10.5)),
              const SizedBox(height: 15),
              _brandCard(),
            ],
          ),
          border: _green.withValues(alpha: .22),
        ),
        const SizedBox(height: 10),
        _card(Column(children: [_sectionHeader('الإعدادات', 'اختر القسم المطلوب لفتح صفحته', Icons.settings_outlined), ...rows])),
      ],
    );
  }

  Widget _brandCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _inner,
        borderRadius: BorderRadius.circular(21),
        border: Border.all(color: _green.withValues(alpha: .18)),
      ),
      child: Column(
        children: [
          Container(
            width: 96,
            height: 96,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1B2437),
              shape: BoxShape.circle,
              border: Border.all(color: _green.withValues(alpha: .25), width: 2),
            ),
            child: Image.asset('assets/branding/hadir_logo_transparent.png'),
          ),
          const SizedBox(height: 8),
          Text('${_settings['brandName'] ?? 'قسم شرطة الشهباء'}', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
          const Text('هوية الشركة · الإعدادات المركزية', style: TextStyle(color: _muted, fontSize: 9.5)),
          TextButton(
            onPressed: () {
              setState(() => _view = _SettingsView.identity);
              _load(admins: true);
            },
            child: const Text('إدارة الهوية', style: TextStyle(color: _red, fontSize: 10, fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }

  Widget _homeRow(String title, String subtitle, IconData icon, _SettingsView view) {
    return InkWell(
      onTap: () {
        setState(() => _view = view);
        if (view == _SettingsView.identity) _load(admins: true);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _line))),
        child: Row(
          children: [
            _iconBox(icon),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w900)),
                  Text(subtitle, style: const TextStyle(color: _muted, fontSize: 9.5)),
                ],
              ),
            ),
            const Icon(Icons.chevron_left_rounded, color: _muted),
          ],
        ),
      ),
    );
  }

  Widget _identity() {
    final children = <Widget>[
      _pageHeader('الهوية والحسابات', 'هوية الشركة والحسابات الإدارية', Icons.badge_outlined),
      const SizedBox(height: 9),
      _card(_identityCompany()),
      const SizedBox(height: 9),
      _card(_ownerCard(), border: _cyan.withValues(alpha: .25)),
      const SizedBox(height: 9),
      _accounts(),
    ];
    return ListView(padding: const EdgeInsets.fromLTRB(18, 10, 18, 88), children: children);
  }

  Widget _identityCompany() {
    final specialtyRows = <Widget>[];
    final values = _specialties();
    for (var i = 0; i < values.length; i++) {
      specialtyRows.add(_specialtyRow(i + 1, values[i]));
    }

    return Column(
      children: [
        _sectionHeader('هوية الشركة والجهة', 'الاسم والشعار وتخصصات العمل', Icons.business_outlined),
        const SizedBox(height: 10),
        _field('اسم الشركة / الجهة', '${_settings['brandName'] ?? ''}', (value) => _save({'brandName': value})),
        const SizedBox(height: 10),
        const Align(alignment: Alignment.centerRight, child: Text('تخصصات العمل', style: TextStyle(color: _muted, fontSize: 10.5, fontWeight: FontWeight.w700))),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(child: TextField(controller: _specialty, textDirection: TextDirection.rtl, style: const TextStyle(color: Colors.white, fontSize: 11), decoration: _input('إضافة تخصص جديد'))),
            const SizedBox(width: 6),
            FilledButton(onPressed: _addSpecialty, style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black), child: const Text('+ إضافة')),
          ],
        ),
        const SizedBox(height: 5),
        ...specialtyRows,
      ],
    );
  }

  Widget _ownerCard() {
    return Column(
      children: [
        _sectionHeader('حساب المالك', 'بيانات المالك وتحديث كلمة المرور', Icons.person_outline_rounded, color: _cyan),
        const SizedBox(height: 10),
        _fieldController('اسم المالك', _ownerName),
        const SizedBox(height: 7),
        _fieldController('اسم المستخدم', _ownerUsername),
        const SizedBox(height: 7),
        _fieldController('كلمة مرور جديدة', _ownerPassword, obscure: true),
        const SizedBox(height: 9),
        Align(alignment: Alignment.centerLeft, child: FilledButton(onPressed: _saveOwner, style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black), child: const Text('حفظ بيانات المالك'))),
      ],
    );
  }

  List<String> _specialties() {
    final value = _settings['specialties'];
    if (value is List) return value.map((item) => '$item').toList();
    return <String>[];
  }

  Future<void> _addSpecialty() async {
    final value = _specialty.text.trim();
    if (value.isEmpty) return;
    final values = _specialties();
    if (!values.contains(value)) values.add(value);
    _specialty.clear();
    await _save({'specialties': values});
  }

  Future<void> _removeSpecialty(String value) async {
    final values = _specialties()..remove(value);
    await _save({'specialties': values});
  }

  Widget _specialtyRow(int number, String value) {
    return Container(
      margin: const EdgeInsets.only(top: 5),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(color: _inner, borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          IconButton(onPressed: () => _removeSpecialty(value), icon: const Icon(Icons.delete_outline, color: _red, size: 16)),
          Expanded(child: Text('$number. $value', textAlign: TextAlign.right, style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800))),
          const Icon(Icons.drag_indicator_rounded, color: _muted, size: 15),
        ],
      ),
    );
  }

  Widget _accounts() {
    final rows = <Widget>[];
    for (final raw in _admins) {
      final admin = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
      final active = admin['active'] != false;
      final id = '${admin['id'] ?? ''}';
      rows.add(
        Container(
          margin: const EdgeInsets.only(top: 5),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(color: _inner, borderRadius: BorderRadius.circular(10)),
          child: Row(
            children: [
              Icon(active ? Icons.check_circle_outline : Icons.block_outlined, color: active ? _green : _red, size: 16),
              const SizedBox(width: 6),
              Expanded(child: Text('${admin['name'] ?? admin['username'] ?? 'حساب'} · ${admin['role'] ?? 'manager'}', style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800))),
              Switch(value: active, onChanged: (value) => _toggleAdmin(id, value)),
              IconButton(onPressed: () => _deleteAdmin(id), icon: const Icon(Icons.delete_outline, color: _red, size: 17)),
            ],
          ),
        ),
      );
    }

    return _card(
      Column(
        children: [
          _sectionHeader('حسابات المدراء والمشرفين', 'إدارة حسابات الإدارة والصلاحيات', Icons.admin_panel_settings_outlined),
          const SizedBox(height: 7),
          Align(alignment: Alignment.centerLeft, child: FilledButton.icon(onPressed: _createAdmin, icon: const Icon(Icons.add, size: 16), label: const Text('إضافة حساب'))),
          if (rows.isEmpty) const Padding(padding: EdgeInsets.all(12), child: Text('لا توجد حسابات إضافية أو لم يتم تحميلها بعد.', style: TextStyle(color: _muted, fontSize: 9.5))),
          ...rows,
        ],
      ),
    );
  }

  Widget _locations() {
    final rows = <Widget>[];
    for (final raw in _locations) {
      final location = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
      final id = '${location['id'] ?? ''}';
      rows.add(
        Container(
          margin: const EdgeInsets.only(top: 5),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(color: _inner, borderRadius: BorderRadius.circular(10)),
          child: Row(
            children: [
              const Icon(Icons.location_on_outlined, color: _green, size: 18),
              const SizedBox(width: 6),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${location['name'] ?? id}', style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800)), Text('${location['lat'] ?? '—'} · ${location['lng'] ?? '—'} · ${location['radiusMeters'] ?? '—'} م', style: const TextStyle(color: _muted, fontSize: 9))])),
              IconButton(onPressed: () => _editLocation(location), icon: const Icon(Icons.edit_outlined, color: _cyan, size: 17)),
              if (id != 'main') IconButton(onPressed: () => _deleteLocation(id), icon: const Icon(Icons.delete_outline, color: _red, size: 17)),
            ],
          ),
        ),
      );
    }

    final children = <Widget>[
      _pageHeader('المواقع و QR', 'مواقع العمل ورموز الحضور', Icons.location_on_outlined),
      const SizedBox(height: 9),
      _card(Column(children: [_sectionHeader('مواقع العمل', 'إدارة مواقع العمل في القائمة المستقلة', Icons.location_on_outlined), ...rows, const SizedBox(height: 7), _locationEditorButton()])),
      const SizedBox(height: 9),
      _qrCard(),
    ];
    if (_locationEditor) {
      children.insert(3, _locationEditorCard());
    }
    return ListView(padding: const EdgeInsets.fromLTRB(18, 10, 18, 88), children: children);
  }

  Widget _locationEditorButton() {
    return OutlinedButton.icon(
      onPressed: () {
        _editingLocation = null;
        _clearLocation();
        setState(() => _locationEditor = true);
      },
      icon: const Icon(Icons.add, color: _green, size: 17),
      label: const Text('إضافة موقع عمل جديد', style: TextStyle(color: _green)),
    );
  }

  Widget _locationEditorCard() {
    return _card(
      Column(
        children: [
          _sectionHeader(_editingLocation == null ? 'إضافة موقع' : 'تعديل الموقع', 'بيانات الموقع ونطاق الحضور', Icons.edit_location_alt_outlined, color: _cyan),
          const SizedBox(height: 8),
          _fieldController('اسم الموقع', _locationName),
          const SizedBox(height: 7),
          _fieldController('خط العرض', _locationLat),
          const SizedBox(height: 7),
          _fieldController('خط الطول', _locationLng),
          const SizedBox(height: 7),
          _fieldController('النطاق بالمتر', _locationRadius),
          const SizedBox(height: 8),
          Row(children: [Expanded(child: OutlinedButton(onPressed: () => setState(() => _locationEditor = false), child: const Text('إلغاء'))), const SizedBox(width: 7), Expanded(child: FilledButton(onPressed: _saveLocation, style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black), child: const Text('حفظ الموقع')))]),
        ],
      ),
    );
  }

  Widget _qrCard() {
    final value = '${_settings['qrCode'] ?? 'HADIR-SITE-01-STATIC'}';
    return _card(
      Column(
        children: [
          _sectionHeader('رمز QR', 'الرمز المستخدم للتحقق من الحضور والانصراف', Icons.qr_code_2_rounded, color: _cyan),
          const SizedBox(height: 8),
          Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)), child: QrImageView(data: value, size: 220)),
          const SizedBox(height: 7),
          Text(value, textDirection: TextDirection.ltr, style: const TextStyle(color: _muted, fontSize: 9, fontFamily: 'monospace')),
          const SizedBox(height: 8),
          Row(children: [Expanded(child: OutlinedButton.icon(onPressed: () => _save({'qrCode': 'HADIR-${DateTime.now().millisecondsSinceEpoch}'}), icon: const Icon(Icons.qr_code_2, size: 16), label: const Text('توليد رمز جديد'))), const SizedBox(width: 7), Expanded(child: FilledButton.icon(onPressed: () => _toast('الرمز جاهز للطباعة أو المشاركة من الجهاز'), icon: const Icon(Icons.print_outlined, size: 16), label: const Text('طباعة الرمز'), style: FilledButton.styleFrom(backgroundColor: _cyan, foregroundColor: Colors.black)))])
        ],
      ),
    );
  }

  void _clearLocation() {
    _locationName.clear();
    _locationLat.text = '${_settings['workSiteLat'] ?? ''}';
    _locationLng.text = '${_settings['workSiteLng'] ?? ''}';
    _locationRadius.text = '${_settings['radiusMeters'] ?? 100}';
  }

  void _editLocation(Map<String, dynamic> location) {
    _editingLocation = '${location['id'] ?? ''}';
    _locationName.text = '${location['name'] ?? ''}';
    _locationLat.text = '${location['lat'] ?? ''}';
    _locationLng.text = '${location['lng'] ?? ''}';
    _locationRadius.text = '${location['radiusMeters'] ?? 100}';
    setState(() => _locationEditor = true);
  }

  Future<void> _saveLocation() async {
    final lat = double.tryParse(_locationLat.text);
    final lng = double.tryParse(_locationLng.text);
    final radius = double.tryParse(_locationRadius.text);
    if (_locationName.text.trim().isEmpty || lat == null || lng == null || radius == null || radius <= 0) {
      _toast('بيانات الموقع غير صالحة', danger: true);
      return;
    }
    try {
      final api = await _api();
      if (api == null) return;
      await api.dio.put('/api/locations', data: {'id': _editingLocation ?? 'loc_${DateTime.now().millisecondsSinceEpoch}', 'name': _locationName.text.trim(), 'lat': lat, 'lng': lng, 'radiusMeters': radius});
      setState(() => _locationEditor = false);
      await _load();
      _toast('تم حفظ الموقع');
    } catch (error) {
      _toast(HadirApi.errorMessage(error), danger: true);
    }
  }

  Future<void> _deleteLocation(String id) async {
    if (id.isEmpty || !await _confirm('حذف الموقع', 'سيتم حذف الموقع من قائمة مواقع العمل.')) return;
    try {
      final api = await _api();
      if (api == null) return;
      await api.dio.delete('/api/locations/${Uri.encodeComponent(id)}');
      await _load();
      _toast('تم حذف الموقع');
    } catch (error) {
      _toast(HadirApi.errorMessage(error), danger: true);
    }
  }

  Widget _security() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 88),
      children: [
        _pageHeader('الأمان والصلاحيات', 'حسابات المالك والعمليات الجماعية للموظفين', Icons.shield_outlined),
        const SizedBox(height: 9),
        _card(
          Column(
            children: [
              _sectionHeader('إدارة الموظفين دفعة واحدة', 'عمليات جماعية متاحة للمالك فقط', Icons.manage_accounts_outlined),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _bulkAction.isEmpty ? null : _bulkAction,
                dropdownColor: _inner,
                style: const TextStyle(color: Colors.white, fontSize: 11),
                decoration: _input('اختيار إعداد'),
                items: const [
                  DropdownMenuItem(value: 'password', child: Text('تغيير كلمة مرور جميع الموظفين')),
                  DropdownMenuItem(value: 'avatar', child: Text('تغيير الصورة الشخصية للجميع')),
                  DropdownMenuItem(value: 'grace', child: Text('مهلة التأخر')),
                  DropdownMenuItem(value: 'earlyCheckout', child: Text('مهلة الانصراف المبكر')),
                  DropdownMenuItem(value: 'adminWorkHours', child: Text('أوقات دوام الموظفين الإداريين')),
                  DropdownMenuItem(value: 'rotationWorkHours', child: Text('أوقات دوام الموظفين التناوبيين')),
                  DropdownMenuItem(value: 'rotationDays', child: Text('أيام التناوب للموظفين التناوبيين')),
                  DropdownMenuItem(value: 'unlinkDevices', child: Text('فك ربط جميع الأجهزة')),
                  DropdownMenuItem(value: 'revokeSessions', child: Text('تسجيل خروج جميع الموظفين')),
                ],
                onChanged: (value) => setState(() => _bulkAction = value ?? ''),
              ),
              const SizedBox(height: 8),
              if (_bulkAction == 'grace' || _bulkAction == 'earlyCheckout') _fieldController('عدد الدقائق', _bulkMinutes),
              if (_bulkAction == 'adminWorkHours' || _bulkAction == 'rotationWorkHours') _info('08:00 → 16:00', 'وقت البداية والنهاية يطبقان حسب نوع الدوام.'),
              if (_bulkAction == 'rotationDays') _info('4 أيام مناوبة + 4 أيام راحة', 'دورة التناوب للموظفين التناوبيين.'),
              if (_bulkAction == 'avatar') _info('الصورة الموحدة', 'رفع الصورة الموحدة يتم من واجهة الموظفين الذكية.'),
              if (_bulkAction == 'password') _info('كلمة مرور جديدة', 'سيتم إلغاء الجلسات الحالية بعد التطبيق.'),
              const SizedBox(height: 8),
              Align(alignment: Alignment.centerLeft, child: FilledButton(onPressed: _runBulk, style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black), child: const Text('تنفيذ العملية'))),
            ],
          ),
        ),
      ],
    );
  }

  Widget _info(String title, String subtitle) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(color: const Color(0xFF0A111E), borderRadius: BorderRadius.circular(13), border: Border.all(color: _green.withValues(alpha: .17))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(title, style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800)), Text(subtitle, textAlign: TextAlign.right, style: const TextStyle(color: _muted, fontSize: 9.5))]),
    );
  }

  Future<void> _runBulk() async {
    if (_bulkAction.isEmpty) {
      _toast('اختر إعدادًا من القائمة', danger: true);
      return;
    }
    final payload = <String, dynamic>{'action': _bulkAction};
    if (_bulkAction == 'grace' || _bulkAction == 'earlyCheckout') payload['minutes'] = int.tryParse(_bulkMinutes.text) ?? 10;
    if (_bulkAction == 'password') {
      final password = await _prompt('كلمة مرور الموظفين');
      if (password == null || password.length < 6) {
        _toast('كلمة المرور يجب أن تكون 6 محارف على الأقل', danger: true);
        return;
      }
      payload['password'] = password;
    }
    if (_bulkAction == 'adminWorkHours' || _bulkAction == 'rotationWorkHours') {
      payload['workStartTime'] = '08:00';
      payload['workEndTime'] = '16:00';
    }
    if (_bulkAction == 'rotationDays') {
      payload['rotationDaysOn'] = 4;
      payload['rotationDaysOff'] = 4;
    }
    if ((_bulkAction == 'unlinkDevices' || _bulkAction == 'revokeSessions') && !await _confirm('تأكيد العملية', 'ستؤثر هذه العملية على جميع الموظفين.')) return;
    try {
      final api = await _api();
      if (api == null) return;
      final response = await api.dio.post('/api/owner/bulk-settings', data: payload);
      final data = response.data is Map ? Map<String, dynamic>.from(response.data as Map) : <String, dynamic>{};
      _toast(data['message']?.toString() ?? 'تم تنفيذ العملية بنجاح');
    } catch (error) {
      _toast(HadirApi.errorMessage(error), danger: true);
    }
  }

  Widget _diagnostics() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 88),
      children: [
        _pageHeader('النظام والتشخيص', 'فحص صحة النظام وإجراءات المالك', Icons.gps_fixed_outlined),
        const SizedBox(height: 9),
        _card(
          Column(
            children: [
              _sectionHeader('تشخيص النظام', 'SYSTEM HEALTH · 07', Icons.gps_fixed_outlined),
              const SizedBox(height: 10),
              Row(children: [Expanded(child: OutlinedButton.icon(onPressed: _checkHealth, icon: const Icon(Icons.gps_fixed_outlined, size: 16), label: const Text('فتح سجل التشخيص'))), const SizedBox(width: 7), Expanded(child: FilledButton.icon(onPressed: _checkHealth, icon: const Icon(Icons.refresh, size: 16), label: const Text('فحص النظام'), style: FilledButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.black)))]),
              const SizedBox(height: 6),
              _actionTile('مسح السجل', 'تنظيف سجل الأخطاء الصحي وتنظيمه.', Icons.delete_sweep_outlined, () => _toast('تم فتح أدوات التشخيص؛ مسح السجل يتم حسب صلاحيات الخادم.')),
            ],
          ),
        ),
        const SizedBox(height: 9),
        _danger('DANGER ZONE · 08', 'إعادة تهيئة النظام', 'إجراء مسؤول للمالك لإعادة بيانات التشغيل والاختبار.', 'إعادة تهيئة النظام'),
        const SizedBox(height: 9),
        _danger('LOCAL RESET · 09', 'إعادة تعيين البيانات', 'إعادة تعيين بيانات النظام المحلية عند الحاجة.', 'إعادة تعيين البيانات'),
      ],
    );
  }

  Widget _actionTile(String title, String subtitle, IconData icon, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(top: 6),
      decoration: BoxDecoration(color: _inner, borderRadius: BorderRadius.circular(11), border: Border.all(color: _line)),
      child: ListTile(dense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 9, vertical: 1), leading: Icon(icon, color: _green, size: 20), title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)), subtitle: Text(subtitle, style: const TextStyle(color: _muted, fontSize: 9)), trailing: const Icon(Icons.chevron_left_rounded, color: _muted, size: 18), onTap: onTap),
    );
  }

  Widget _danger(String code, String title, String subtitle, String button) {
    return _card(
      Column(children: [_sectionHeader(title, subtitle, Icons.security_outlined, color: _red), const SizedBox(height: 7), Align(alignment: Alignment.centerLeft, child: FilledButton.icon(onPressed: _resetData, icon: const Icon(Icons.restart_alt, size: 16), label: Text(button), style: FilledButton.styleFrom(backgroundColor: _red, foregroundColor: Colors.white)))]),
      border: _red.withValues(alpha: .35),
    );
  }

  Future<void> _checkHealth() async {
    try {
      final api = await _api();
      if (api == null) return;
      final health = await api.health();
      if (!mounted) return;
      await showDialog<void>(context: context, builder: (dialogContext) => AlertDialog(backgroundColor: _inner, title: const Text('حالة الخادم', style: TextStyle(color: Colors.white)), content: Text(health.entries.map((entry) => '${entry.key}: ${entry.value}').join('\n'), style: const TextStyle(color: _muted)), actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إغلاق'))]));
    } catch (error) {
      _toast(HadirApi.errorMessage(error), danger: true);
    }
  }

  Future<void> _resetData() async {
    if (!await _confirm('إعادة التهيئة', 'هذا الإجراء للمالك فقط وقد يحذف بيانات التشغيل والاختبار. هل تريد المتابعة؟')) return;
    try {
      final api = await _api();
      if (api == null) return;
      final response = await api.dio.post('/api/workforce/reset', data: {'confirmation': 'تأكيد'});
      final data = response.data is Map ? Map<String, dynamic>.from(response.data as Map) : <String, dynamic>{};
      _toast(data['message']?.toString() ?? 'تمت إعادة التهيئة');
      await _load(admins: true);
    } catch (error) {
      _toast(HadirApi.errorMessage(error), danger: true);
    }
  }

  Widget _field(String hint, String initial, ValueChanged<String> onSave) {
    final controller = TextEditingController(text: initial);
    return Row(children: [Expanded(child: TextField(controller: controller, textDirection: TextDirection.rtl, style: const TextStyle(color: Colors.white, fontSize: 12), decoration: _input(hint), onSubmitted: onSave)), IconButton(onPressed: () { final value = controller.text.trim(); if (value.isNotEmpty) onSave(value); }, icon: const Icon(Icons.save_outlined, color: _green, size: 19))]);
  }

  Widget _fieldController(String hint, TextEditingController controller, {bool obscure = false}) {
    return TextField(controller: controller, obscureText: obscure, textDirection: TextDirection.rtl, style: const TextStyle(color: Colors.white, fontSize: 12), decoration: _input(hint));
  }

  Future<void> _saveOwner() async {
    final patch = <String, dynamic>{'ownerName': _ownerName.text.trim(), 'ownerUsername': _ownerUsername.text.trim()};
    if (_ownerPassword.text.isNotEmpty) patch['ownerPassword'] = _ownerPassword.text;
    await _save(patch);
    _ownerPassword.clear();
  }

  Future<String?> _prompt(String hint) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: _inner,
        title: Text(hint, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
        content: TextField(controller: controller, textDirection: TextDirection.rtl, style: const TextStyle(color: Colors.white), decoration: _input(hint)),
        actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(dialogContext, controller.text), child: const Text('حفظ'))],
      ),
    );
    controller.dispose();
    return result;
  }

  Future<void> _createAdmin() async {
    final name = await _prompt('اسم المدير أو المشرف');
    if (name == null || name.trim().isEmpty) return;
    final username = await _prompt('اسم المستخدم');
    if (username == null || username.trim().isEmpty) return;
    final password = await _prompt('كلمة المرور');
    if (password == null || password.length < 12) {
      _toast('كلمة المرور يجب أن تكون 12 محرفًا على الأقل', danger: true);
      return;
    }
    try {
      final api = await _api();
      if (api == null) return;
      await api.dio.post('/api/admins', data: {'name': name.trim(), 'username': username.trim(), 'password': password, 'role': 'manager'});
      await _load(admins: true);
      _toast('تمت إضافة الحساب');
    } catch (error) {
      _toast(HadirApi.errorMessage(error), danger: true);
    }
  }

  Future<void> _toggleAdmin(String id, bool active) async {
    if (id.isEmpty) return;
    try {
      final api = await _api();
      if (api == null) return;
      await api.dio.patch('/api/admins/${Uri.encodeComponent(id)}', data: {'active': active});
      await _load(admins: true);
    } catch (error) {
      _toast(HadirApi.errorMessage(error), danger: true);
    }
  }

  Future<void> _deleteAdmin(String id) async {
    if (id.isEmpty || !await _confirm('حذف الحساب', 'هل تريد حذف حساب الإدارة هذا؟')) return;
    try {
      final api = await _api();
      if (api == null) return;
      await api.dio.delete('/api/admins/${Uri.encodeComponent(id)}');
      await _load(admins: true);
    } catch (error) {
      _toast(HadirApi.errorMessage(error), danger: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    late final Widget body;
    switch (_view) {
      case _SettingsView.home:
        body = _home();
        break;
      case _SettingsView.identity:
        body = _identity();
        break;
      case _SettingsView.locations:
        body = _locations();
        break;
      case _SettingsView.security:
        body = _security();
        break;
      case _SettingsView.diagnostics:
        body = _diagnostics();
        break;
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _bg,
        body: Stack(
          children: [
            if (_loading) const Center(child: CircularProgressIndicator(color: _green)) else body,
            if (_error != null && !_loading)
              Positioned(left: 18, right: 18, bottom: 66, child: Material(color: _red, borderRadius: BorderRadius.circular(10), child: Padding(padding: const EdgeInsets.all(9), child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)))),
            Positioned(
              left: 18,
              right: 18,
              bottom: 12,
              child: SafeArea(
                top: false,
                child: SizedBox(
                  height: 40,
                  child: FilledButton(
                    onPressed: _saving ? null : () => _save(_settings),
                    style: FilledButton.styleFrom(backgroundColor: _cyan, foregroundColor: Colors.black, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: Text(_saving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
