import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/api.dart';
import '../../../core/session.dart';

enum SettingsRefView { home, identity, locations, security, diagnostics }

class AdminMobileSettingsReferencePage extends StatefulWidget {
  const AdminMobileSettingsReferencePage({super.key});

  @override
  State<AdminMobileSettingsReferencePage> createState() => _AdminMobileSettingsReferencePageState();
}

class _AdminMobileSettingsReferencePageState extends State<AdminMobileSettingsReferencePage> {
  static const bg = Color(0xFF080D18);
  static const card = Color(0xFF111827);
  static const inner = Color(0xFF151E30);
  static const green = Color(0xFF17D7A1);
  static const cyan = Color(0xFF10E7FF);
  static const muted = Color(0xFF8B97AA);
  static const line = Color(0xFF263146);
  static const red = Color(0xFFFF4D55);

  final session = HadirSession();
  final ownerName = TextEditingController();
  final ownerUsername = TextEditingController();
  final ownerPassword = TextEditingController();
  final specialty = TextEditingController();
  final bulkMinutes = TextEditingController(text: '10');
  final locationName = TextEditingController();
  final locationLat = TextEditingController();
  final locationLng = TextEditingController();
  final locationRadius = TextEditingController(text: '100');

  SettingsRefView view = SettingsRefView.home;
  Map<String, dynamic> settings = {};
  List<dynamic> locations = [];
  List<dynamic> admins = [];
  bool loading = true;
  bool busy = false;
  String? error;
  String? editingLocation;
  bool addingLocation = false;
  String bulkAction = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    for (final controller in [
      ownerName,
      ownerUsername,
      ownerPassword,
      specialty,
      bulkMinutes,
      locationName,
      locationLat,
      locationLng,
      locationRadius,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<HadirApi?> api() async {
    final token = await session.adminToken();
    if (token == null || token.isEmpty) {
      if (mounted) {
        setState(() => error = 'انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
      }
      return null;
    }
    return HadirApi(token: token);
  }

  List<dynamic> asList(dynamic value) {
    if (value is List) return List<dynamic>.from(value);
    if (value is Map && value['admins'] is List) {
      return List<dynamic>.from(value['admins']);
    }
    return const <dynamic>[];
  }

  Future<void> load({bool withAdmins = false}) async {
    if (mounted) setState(() => loading = true);
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      final results = await Future.wait<dynamic>([
        apiClient.settings(),
        apiClient.locations(),
        if (withAdmins) apiClient.dio.get('/api/admins'),
      ]);
      if (!mounted) return;
      setState(() {
        settings = Map<String, dynamic>.from(results[0] as Map);
        locations = List<dynamic>.from(results[1] as List);
        if (withAdmins) admins = asList(results[2]);
        loading = false;
        error = null;
      });
      ownerName.text = '${settings['ownerName'] ?? ''}';
      ownerUsername.text = '${settings['ownerUsername'] ?? ''}';
    } catch (e) {
      if (mounted) {
        setState(() {
          loading = false;
          error = HadirApi.errorMessage(e);
        });
      }
    }
  }

  Future<void> save(Map<String, dynamic> patch) async {
    if (busy || patch.isEmpty) return;
    setState(() => busy = true);
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      final updated = await apiClient.updateSettings(patch);
      if (!mounted) return;
      setState(() => settings = {...settings, ...patch, ...updated});
      toast('تم حفظ الإعدادات');
    } catch (e) {
      if (mounted) setState(() => error = HadirApi.errorMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void toast(String message, {bool danger = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: danger ? red : green,
        content: Text(
          message,
          style: TextStyle(
            color: danger ? Colors.white : Colors.black,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }

  Future<bool> confirm(String title, String message) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: inner,
        title: Text(
          title,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
        ),
        content: Text(message, style: const TextStyle(color: muted)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('متابعة'),
          ),
        ],
      ),
    );
    return result == true;
  }

  InputDecoration input(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: muted),
        filled: true,
        fillColor: const Color(0xFF070C16),
        border: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: line),
        ),
        enabledBorder: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: line),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: green),
        ),
      );

  Widget eyebrow(String text, {Color color = green}) => Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.2,
          fontFamily: 'monospace',
        ),
      );

  Widget iconBox(IconData icon, {Color color = green}) => Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: color.withValues(alpha: .10),
          borderRadius: BorderRadius.circular(13),
        ),
        child: Icon(icon, color: color, size: 21),
      );

  Widget box(Widget child, {Color border = line}) => Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: card,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: border),
        ),
        child: child,
      );

  Widget sectionHead(String title, String subtitle, IconData icon, {Color color = green}) => Row(
        children: [
          iconBox(icon, color: color),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(color: muted, fontSize: 9.5),
                ),
              ],
            ),
          ),
        ],
      );

  Widget pageHeader(String title, String subtitle, IconData icon) => Row(
        children: [
          IconButton(
            onPressed: () => setState(() => view = SettingsRefView.home),
            icon: const Icon(Icons.chevron_right_rounded, color: muted),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(color: muted, fontSize: 10),
                ),
              ],
            ),
          ),
          const SizedBox(width: 9),
          iconBox(icon),
        ],
      );

  Widget home() => ListView(
        padding: const EdgeInsets.fromLTRB(18, 15, 18, 86),
        children: [
          box(
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                eyebrow('HADIR · OWNER'),
                const SizedBox(height: 3),
                const Text(
                  'الإعدادات',
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 27,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text(
                  'إدارة النظام والهوية والمواقع والحسابات والأمان',
                  textAlign: TextAlign.right,
                  style: TextStyle(color: muted, fontSize: 10.5),
                ),
                const SizedBox(height: 15),
                brand(),
              ],
            ),
            border: green.withValues(alpha: .22),
          ),
          const SizedBox(height: 10),
          box(
            Column(
              children: [
                sectionHead(
                  'الإعدادات',
                  'اختر القسم المطلوب لفتح صفحته',
                  Icons.settings_outlined,
                ),
                homeRow(
                  'الهوية والحسابات',
                  'هوية الشركة وحسابات الإدارة',
                  Icons.person_outline_rounded,
                  SettingsRefView.identity,
                ),
                homeRow(
                  'المواقع و QR',
                  'مواقع العمل ورموز الحضور',
                  Icons.location_on_outlined,
                  SettingsRefView.locations,
                ),
                homeRow(
                  'الأمان والصلاحيات',
                  'الحسابات والعمليات الجماعية',
                  Icons.person_add_alt_1_outlined,
                  SettingsRefView.security,
                ),
                homeRow(
                  'التشخيص وإعادة التهيئة',
                  'التشخيص وإعادة ضبط البيانات',
                  Icons.gps_fixed_outlined,
                  SettingsRefView.diagnostics,
                ),
              ],
            ),
          ),
        ],
      );

  Widget brand() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: inner,
          borderRadius: BorderRadius.circular(21),
          border: Border.all(color: green.withValues(alpha: .18)),
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
                border: Border.all(color: green.withValues(alpha: .25), width: 2),
              ),
              child: Image.asset('assets/branding/hadir_logo_transparent.png'),
            ),
            const SizedBox(height: 8),
            Text(
              '${settings['brandName'] ?? 'قسم شرطة الشهباء'}',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const Text(
              'هوية الشركة · الإعدادات المركزية',
              style: TextStyle(color: muted, fontSize: 9.5),
            ),
            TextButton(
              onPressed: () => setState(() => view = SettingsRefView.identity),
              child: const Text(
                'إدارة الهوية',
                style: TextStyle(color: red, fontSize: 10, fontWeight: FontWeight.w900),
              ),
            ),
          ],
        ),
      );

  Widget homeRow(String title, String subtitle, IconData icon, SettingsRefView target) => InkWell(
        onTap: () {
          setState(() => view = target);
          if (target == SettingsRefView.identity) load(withAdmins: true);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: line)),
          ),
          child: Row(
            children: [
              iconBox(icon),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(color: muted, fontSize: 9.5),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left_rounded, color: muted),
            ],
          ),
        ),
      );

  Widget identity() {
    final specialtyItems = specialties();
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 86),
      children: [
        pageHeader('الهوية والحسابات', 'هوية الشركة والحسابات الإدارية', Icons.badge_outlined),
        const SizedBox(height: 9),
        box(
          Column(
            children: [
              sectionHead(
                'هوية الشركة والجهة',
                'الاسم والشعار وتخصصات العمل',
                Icons.business_outlined,
              ),
              const SizedBox(height: 10),
              field(
                'اسم الشركة / الجهة',
                settings['brandName']?.toString() ?? '',
                onSave: (value) => save({'brandName': value}),
              ),
              const SizedBox(height: 10),
              const Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'تخصصات العمل',
                  style: TextStyle(color: muted, fontSize: 10.5, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: specialty,
                      textDirection: TextDirection.rtl,
                      style: const TextStyle(color: Colors.white, fontSize: 11),
                      decoration: input('إضافة تخصص جديد'),
                    ),
                  ),
                  const SizedBox(width: 6),
                  FilledButton(
                    onPressed: addSpecialty,
                    style: FilledButton.styleFrom(
                      backgroundColor: green,
                      foregroundColor: Colors.black,
                    ),
                    child: const Text('+ إضافة'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              for (final entry in specialtyItems.asMap().entries)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: inner,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => removeSpecialty(entry.value),
                        icon: const Icon(Icons.delete_outline, color: red, size: 16),
                      ),
                      Expanded(
                        child: Text(
                          '${entry.key + 1}. ${entry.value}',
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const Icon(Icons.drag_indicator_rounded, color: muted, size: 15),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 9),
        box(
          Column(
            children: [
              sectionHead(
                'حساب المالك',
                'بيانات المالك وتحديث كلمة المرور',
                Icons.person_outline_rounded,
                color: cyan,
              ),
              const SizedBox(height: 10),
              fieldController('اسم المالك', ownerName),
              const SizedBox(height: 7),
              fieldController('اسم المستخدم', ownerUsername),
              const SizedBox(height: 7),
              fieldController('كلمة مرور جديدة', ownerPassword, obscure: true),
              const SizedBox(height: 9),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton(
                  onPressed: saveOwner,
                  style: FilledButton.styleFrom(
                    backgroundColor: green,
                    foregroundColor: Colors.black,
                  ),
                  child: const Text('حفظ بيانات المالك'),
                ),
              ),
            ],
          ),
          border: cyan.withValues(alpha: .25),
        ),
        const SizedBox(height: 9),
        accounts(),
      ],
    );
  }

  List<String> specialties() {
    final value = settings['specialties'];
    return value is List ? List<String>.from(value.map((e) => '$e')) : <String>[];
  }

  Future<void> addSpecialty() async {
    final value = specialty.text.trim();
    if (value.isEmpty) return;
    final items = specialties();
    if (!items.contains(value)) items.add(value);
    specialty.clear();
    await save({'specialties': items});
  }

  Future<void> removeSpecialty(String value) async {
    final items = specialties()..remove(value);
    await save({'specialties': items});
  }

  Widget field(String hint, String initial, {ValueChanged<String>? onSave}) {
    final controller = TextEditingController(text: initial);
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            textDirection: TextDirection.rtl,
            style: const TextStyle(color: Colors.white, fontSize: 12),
            decoration: input(hint),
            onSubmitted: onSave,
          ),
        ),
        if (onSave != null)
          IconButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.isNotEmpty) onSave(value);
            },
            icon: const Icon(Icons.save_outlined, color: green, size: 19),
          ),
      ],
    );
  }

  Widget fieldController(String hint, TextEditingController controller, {bool obscure = false}) => TextField(
        controller: controller,
        obscureText: obscure,
        textDirection: TextDirection.rtl,
        style: const TextStyle(color: Colors.white, fontSize: 12),
        decoration: input(hint),
      );

  Future<void> saveOwner() async {
    final patch = <String, dynamic>{
      'ownerName': ownerName.text.trim(),
      'ownerUsername': ownerUsername.text.trim(),
    };
    if (ownerPassword.text.isNotEmpty) patch['ownerPassword'] = ownerPassword.text;
    await save(patch);
    ownerPassword.clear();
  }

  Widget accounts() => box(
        Column(
          children: [
            sectionHead(
              'حسابات المدراء والمشرفين',
              'إدارة حسابات الإدارة والصلاحيات',
              Icons.admin_panel_settings_outlined,
            ),
            const SizedBox(height: 7),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                onPressed: createAdmin,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('إضافة حساب'),
              ),
            ),
            if (admins.isEmpty)
              const Padding(
                padding: EdgeInsets.all(12),
                child: Text(
                  'لا توجد حسابات إضافية أو لم يتم تحميلها بعد.',
                  style: TextStyle(color: muted, fontSize: 9.5),
                ),
              ),
            for (final raw in admins)
              Builder(
                builder: (context) {
                  final account = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
                  final active = account['active'] != false;
                  final id = '${account['id'] ?? ''}';
                  return Container(
                    margin: const EdgeInsets.only(top: 5),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    decoration: BoxDecoration(
                      color: inner,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          active ? Icons.check_circle_outline : Icons.block_outlined,
                          color: active ? green : red,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '${account['name'] ?? account['username'] ?? 'حساب'} · ${account['role'] ?? 'manager'}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        Switch(
                          value: active,
                          onChanged: id.isEmpty ? null : (value) => toggleAdmin(id, value),
                        ),
                        IconButton(
                          onPressed: id.isEmpty ? null : () => deleteAdmin(id),
                          icon: const Icon(Icons.delete_outline, color: red, size: 17),
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      );

  Future<void> createAdmin() async {
    final name = await prompt('اسم المدير أو المشرف');
    if (name == null || name.trim().isEmpty) return;
    final username = await prompt('اسم المستخدم');
    if (username == null || username.trim().isEmpty) return;
    final password = await prompt('كلمة المرور');
    if (password == null || password.length < 12) {
      toast('كلمة المرور يجب أن تكون 12 محرفًا على الأقل', danger: true);
      return;
    }
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      await apiClient.dio.post(
        '/api/admins',
        data: {
          'name': name.trim(),
          'username': username.trim(),
          'password': password,
          'role': 'manager',
        },
      );
      await load(withAdmins: true);
      toast('تمت إضافة الحساب');
    } catch (e) {
      toast(HadirApi.errorMessage(e), danger: true);
    }
  }

  Future<String?> prompt(String hint) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: inner,
        title: Text(
          hint,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
        ),
        content: TextField(
          controller: controller,
          textDirection: TextDirection.rtl,
          style: const TextStyle(color: Colors.white),
          decoration: input(hint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: const Text('حفظ'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  Future<void> toggleAdmin(String id, bool active) async {
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      await apiClient.dio.patch(
        '/api/admins/${Uri.encodeComponent(id)}',
        data: {'active': active},
      );
      await load(withAdmins: true);
    } catch (e) {
      toast(HadirApi.errorMessage(e), danger: true);
    }
  }

  Future<void> deleteAdmin(String id) async {
    if (!await confirm('حذف الحساب', 'هل تريد حذف حساب الإدارة هذا؟')) return;
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      await apiClient.dio.delete('/api/admins/${Uri.encodeComponent(id)}');
      await load(withAdmins: true);
      toast('تم حذف الحساب');
    } catch (e) {
      toast(HadirApi.errorMessage(e), danger: true);
    }
  }

  Widget locationsView() => ListView(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 86),
        children: [
          pageHeader('المواقع و QR', 'مواقع العمل ورموز الحضور', Icons.location_on_outlined),
          const SizedBox(height: 9),
          box(
            Column(
              children: [
                sectionHead(
                  'مواقع العمل',
                  'إدارة مواقع العمل في القائمة المستقلة',
                  Icons.location_on_outlined,
                ),
                const SizedBox(height: 7),
                for (final raw in locations)
                  Builder(
                    builder: (context) {
                      final location = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
                      final id = '${location['id'] ?? ''}';
                      return Container(
                        margin: const EdgeInsets.only(top: 5),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: inner,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.location_on_outlined, color: green, size: 18),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${location['name'] ?? id}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  Text(
                                    '${location['lat'] ?? '—'} · ${location['lng'] ?? '—'} · ${location['radiusMeters'] ?? '—'} م',
                                    style: const TextStyle(color: muted, fontSize: 9),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed: () => editLocation(location),
                              icon: const Icon(Icons.edit_outlined, color: cyan, size: 17),
                            ),
                            if (id != 'main')
                              IconButton(
                                onPressed: () => deleteLocation(id),
                                icon: const Icon(Icons.delete_outline, color: red, size: 17),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                const SizedBox(height: 7),
                OutlinedButton.icon(
                  onPressed: () {
                    editingLocation = null;
                    clearLocation();
                    setState(() => addingLocation = true);
                  },
                  icon: const Icon(Icons.add, color: green, size: 17),
                  label: const Text(
                    'إضافة موقع عمل جديد',
                    style: TextStyle(color: green),
                  ),
                ),
                if (addingLocation) ...[
                  const Divider(color: line, height: 20),
                  fieldController('اسم الموقع', locationName),
                  const SizedBox(height: 7),
                  fieldController('خط العرض', locationLat),
                  const SizedBox(height: 7),
                  fieldController('خط الطول', locationLng),
                  const SizedBox(height: 7),
                  fieldController('النطاق بالمتر', locationRadius),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setState(() => addingLocation = false),
                          child: const Text('إلغاء'),
                        ),
                      ),
                      const SizedBox(width: 7),
                      Expanded(
                        child: FilledButton(
                          onPressed: saveLocation,
                          style: FilledButton.styleFrom(
                            backgroundColor: green,
                            foregroundColor: Colors.black,
                          ),
                          child: const Text('حفظ الموقع'),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 9),
          box(
            Column(
              children: [
                sectionHead(
                  'رمز QR',
                  'الرمز المستخدم للتحقق من الحضور والانصراف',
                  Icons.qr_code_2_rounded,
                  color: cyan,
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: eyebrow('QR ACCESS · 04', color: cyan),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: QrImageView(
                    data: '${settings['qrCode'] ?? 'HADIR-SITE-01-STATIC'}',
                    size: 220,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  '${settings['qrCode'] ?? 'HADIR-SITE-01-STATIC'}',
                  style: const TextStyle(color: muted, fontSize: 9, fontFamily: 'monospace'),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => save({'qrCode': 'HADIR-${DateTime.now().millisecondsSinceEpoch}'}),
                        icon: const Icon(Icons.qr_code_2, size: 16),
                        label: const Text('توليد رمز جديد'),
                      ),
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => toast('الرمز جاهز للطباعة أو المشاركة من الجهاز'),
                        icon: const Icon(Icons.print_outlined, size: 16),
                        label: const Text('طباعة الرمز'),
                        style: FilledButton.styleFrom(
                          backgroundColor: cyan,
                          foregroundColor: Colors.black,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      );

  void clearLocation() {
    locationName.clear();
    locationLat.text = '${settings['workSiteLat'] ?? ''}';
    locationLng.text = '${settings['workSiteLng'] ?? ''}';
    locationRadius.text = '${settings['radiusMeters'] ?? 100}';
  }

  void editLocation(Map<String, dynamic> location) {
    editingLocation = '${location['id'] ?? ''}';
    locationName.text = '${location['name'] ?? ''}';
    locationLat.text = '${location['lat'] ?? ''}';
    locationLng.text = '${location['lng'] ?? ''}';
    locationRadius.text = '${location['radiusMeters'] ?? 100}';
    setState(() => addingLocation = true);
  }

  Future<void> saveLocation() async {
    final lat = double.tryParse(locationLat.text);
    final lng = double.tryParse(locationLng.text);
    final radius = double.tryParse(locationRadius.text);
    if (locationName.text.trim().isEmpty || lat == null || lng == null || radius == null || radius <= 0) {
      toast('بيانات الموقع غير صالحة', danger: true);
      return;
    }
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      await apiClient.dio.put(
        '/api/locations',
        data: {
          'id': editingLocation ?? 'loc_${DateTime.now().millisecondsSinceEpoch}',
          'name': locationName.text.trim(),
          'lat': lat,
          'lng': lng,
          'radiusMeters': radius,
        },
      );
      setState(() => addingLocation = false);
      await load();
      toast('تم حفظ الموقع');
    } catch (e) {
      toast(HadirApi.errorMessage(e), danger: true);
    }
  }

  Future<void> deleteLocation(String id) async {
    if (!await confirm('حذف الموقع', 'سيتم حذف الموقع من قائمة مواقع العمل.')) return;
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      await apiClient.dio.delete('/api/locations/${Uri.encodeComponent(id)}');
      await load();
      toast('تم حذف الموقع');
    } catch (e) {
      toast(HadirApi.errorMessage(e), danger: true);
    }
  }

  Widget security() => ListView(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 86),
        children: [
          pageHeader('الأمان والصلاحيات', 'حساب المالك والعمليات الجماعية للموظفين', Icons.shield_outlined),
          const SizedBox(height: 9),
          box(
            Column(
              children: [
                sectionHead(
                  'إدارة الموظفين دفعة واحدة',
                  'عمليات جماعية متاحة للمالك فقط',
                  Icons.manage_accounts_outlined,
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: bulkAction.isEmpty ? null : bulkAction,
                  dropdownColor: inner,
                  style: const TextStyle(color: Colors.white, fontSize: 11),
                  decoration: input('اختيار إعداد'),
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
                  onChanged: (value) => setState(() => bulkAction = value ?? ''),
                ),
                const SizedBox(height: 8),
                if (bulkAction == 'grace' || bulkAction == 'earlyCheckout')
                  fieldController('عدد الدقائق', bulkMinutes),
                if (bulkAction == 'adminWorkHours' || bulkAction == 'rotationWorkHours')
                  info('08:00 → 16:00', 'وقت البداية والنهاية يطبقان حسب نوع الدوام.'),
                if (bulkAction == 'rotationDays')
                  info('4 أيام مناوبة + 4 أيام راحة', 'دورة التناوب للموظفين التناوبيين.'),
                if (bulkAction == 'avatar')
                  info('الصورة الموحدة', 'رفع الصورة الموحدة يتم من واجهة الموظفين الذكية.'),
                if (bulkAction == 'password')
                  info('كلمة مرور جديدة', 'سيتم إلغاء الجلسات الحالية بعد التطبيق.'),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton(
                    onPressed: runBulk,
                    style: FilledButton.styleFrom(
                      backgroundColor: green,
                      foregroundColor: Colors.black,
                    ),
                    child: const Text('تنفيذ العملية'),
                  ),
                ),
              ],
            ),
          ),
        ],
      );

  Widget info(String title, String subtitle) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: const Color(0xFF0A111E),
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: green.withValues(alpha: .17)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              title,
              style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800),
            ),
            Text(
              subtitle,
              textAlign: TextAlign.right,
              style: const TextStyle(color: muted, fontSize: 9.5),
            ),
          ],
        ),
      );

  Future<void> runBulk() async {
    if (bulkAction.isEmpty) {
      toast('اختر إعدادًا من القائمة', danger: true);
      return;
    }
    final payload = <String, dynamic>{'action': bulkAction};
    if (bulkAction == 'grace' || bulkAction == 'earlyCheckout') {
      payload['minutes'] = int.tryParse(bulkMinutes.text) ?? 10;
    }
    if (bulkAction == 'password') {
      final password = await prompt('كلمة مرور الموظفين');
      if (password == null || password.length < 6) {
        toast('كلمة المرور يجب أن تكون 6 محارف على الأقل', danger: true);
        return;
      }
      payload['password'] = password;
    }
    if (bulkAction == 'adminWorkHours' || bulkAction == 'rotationWorkHours') {
      payload['workStartTime'] = '08:00';
      payload['workEndTime'] = '16:00';
    }
    if (bulkAction == 'rotationDays') {
      payload['rotationDaysOn'] = 4;
      payload['rotationDaysOff'] = 4;
    }
    if ((bulkAction == 'unlinkDevices' || bulkAction == 'revokeSessions') &&
        !await confirm('تأكيد العملية', 'ستؤثر هذه العملية على جميع الموظفين.')) {
      return;
    }
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      final response = await apiClient.dio.post('/api/owner/bulk-settings', data: payload);
      final data = response.data is Map ? Map<String, dynamic>.from(response.data as Map) : <String, dynamic>{};
      toast(data['message']?.toString() ?? 'تم تنفيذ العملية بنجاح');
    } catch (e) {
      toast(HadirApi.errorMessage(e), danger: true);
    }
  }

  Widget diagnostics() => ListView(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 86),
        children: [
          pageHeader('التشخيص وإعادة التهيئة', 'مراجعة صحة النظام وإجراءات المالك', Icons.gps_fixed_outlined),
          const SizedBox(height: 9),
          box(
            Column(
              children: [
                sectionHead('تشخيص النظام', 'SYSTEM HEALTH · 07', Icons.gps_fixed_outlined),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: checkHealth,
                        icon: const Icon(Icons.gps_fixed_outlined, size: 16),
                        label: const Text('فتح سجل التشخيص'),
                      ),
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: checkHealth,
                        icon: const Icon(Icons.refresh),
                        label: const Text('فحص النظام'),
                        style: FilledButton.styleFrom(
                          backgroundColor: green,
                          foregroundColor: Colors.black,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 9),
          danger(
            'DANGER ZONE · 08',
            'إعادة تهيئة النظام',
            'إجراء مسؤول للمالك لإعادة بيانات التشغيل والاختبار.',
            'إعادة تهيئة النظام',
          ),
          const SizedBox(height: 9),
          danger(
            'LOCAL RESET · 09',
            'إعادة تعيين البيانات',
            'إعادة تعيين بيانات النظام المحلية بعد التأكيد.',
            'إعادة تعيين البيانات',
          ),
        ],
      );

  Widget danger(String code, String title, String subtitle, String button) => box(
        Column(
          children: [
            sectionHead(title, subtitle, Icons.security_outlined, color: red),
            const SizedBox(height: 7),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                onPressed: resetData,
                icon: const Icon(Icons.restart_alt, size: 16),
                label: Text(button),
                style: FilledButton.styleFrom(
                  backgroundColor: red,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
        border: red.withValues(alpha: .35),
      );

  Future<void> checkHealth() async {
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      final health = await apiClient.health();
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (dialogContext) => AlertDialog(
          backgroundColor: inner,
          title: const Text('حالة الخادم', style: TextStyle(color: Colors.white)),
          content: Text(
            health.entries.map((entry) => '${entry.key}: ${entry.value}').join('\n'),
            style: const TextStyle(color: muted),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('إغلاق'),
            ),
          ],
        ),
      );
    } catch (e) {
      toast(HadirApi.errorMessage(e), danger: true);
    }
  }

  Future<void> resetData() async {
    if (!await confirm(
      'إعادة التهيئة',
      'هذا الإجراء للمالك فقط وقد يحذف بيانات التشغيل والاختبار. هل تريد المتابعة؟',
    )) {
      return;
    }
    try {
      final apiClient = await api();
      if (apiClient == null) return;
      final response = await apiClient.dio.post(
        '/api/workforce/reset',
        data: {'confirmation': 'تأكيد'},
      );
      final data = response.data is Map ? Map<String, dynamic>.from(response.data as Map) : <String, dynamic>{};
      toast(data['message']?.toString() ?? 'تمت إعادة التهيئة');
      await load();
    } catch (e) {
      toast(HadirApi.errorMessage(e), danger: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    late Widget body;
    switch (view) {
      case SettingsRefView.home:
        body = home();
      case SettingsRefView.identity:
        body = identity();
      case SettingsRefView.locations:
        body = locationsView();
      case SettingsRefView.security:
        body = security();
      case SettingsRefView.diagnostics:
        body = diagnostics();
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: bg,
        body: Stack(
          children: [
            if (loading)
              const Center(child: CircularProgressIndicator(color: green))
            else
              body,
            if (error != null && !loading)
              Positioned(
                left: 18,
                right: 18,
                bottom: 66,
                child: Material(
                  color: red,
                  borderRadius: BorderRadius.circular(10),
                  child: Padding(
                    padding: const EdgeInsets.all(9),
                    child: Text(
                      error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            Positioned(
              left: 18,
              right: 18,
              bottom: 12,
              child: SafeArea(
                top: false,
                child: SizedBox(
                  height: 40,
                  child: FilledButton(
                    onPressed: busy ? null : () => save(settings),
                    style: FilledButton.styleFrom(
                      backgroundColor: cyan,
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
                    ),
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
