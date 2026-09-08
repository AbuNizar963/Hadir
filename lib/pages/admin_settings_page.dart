import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _bg = Color(0xFFF4F7F6);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF73827E);
const _line = Color(0xFFDCE6E2);

class AdminSettingsPage extends StatefulWidget {
  const AdminSettingsPage({super.key});

  @override
  State<AdminSettingsPage> createState() => _AdminSettingsPageState();
}

class _AdminSettingsPageState extends State<AdminSettingsPage> {
  final _session = HadirSession();
  Map<String, dynamic> _settings = {};
  List<dynamic> _locations = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<String?> _token() => _session.adminToken();

  Future<void> _load() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
      final api = HadirApi(token: token);
      final results = await Future.wait<dynamic>([api.settings(), api.locations()]);
      if (!mounted) return;
      setState(() {
        _settings = Map<String, dynamic>.from(results[0] as Map);
        _locations = List<dynamic>.from(results[1] as List);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(e); });
    }
  }

  Future<void> _savePatch(Map<String, dynamic> patch) async {
    if (_saving || patch.isEmpty) return;
    setState(() { _saving = true; _error = null; });
    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      final updated = await HadirApi(token: token).updateSettings(patch);
      if (!mounted) return;
      setState(() {
        _settings = {..._settings, ...patch, ...updated};
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ الإعدادات بنجاح')));
    } catch (e) {
      if (!mounted) return;
      setState(() { _saving = false; _error = HadirApi.errorMessage(e); });
    }
  }

  Future<void> _editValue(String key, dynamic value) async {
    final controller = TextEditingController(text: _displayValue(value));
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(_labelFor(key)),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 4,
          textDirection: TextDirection.rtl,
          decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'القيمة'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, controller.text.trim()), child: const Text('حفظ')),
        ],
      ),
    );
    controller.dispose();
    if (result == null) return;
    dynamic next = result;
    if (value is num) next = num.tryParse(result) ?? result;
    if (value is bool) next = result.toLowerCase() == 'true' || result == '1' || result == 'نعم';
    if (value is List) next = result.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
    await _savePatch({key: next});
  }

  String _displayValue(dynamic value) {
    if (value is List) return value.join(', ');
    if (value is Map) return value.entries.map((e) => '${e.key}: ${e.value}').join('\n');
    return value == null ? '' : '$value';
  }

  String _labelFor(String key) {
    const labels = <String, String>{
      'brandName': 'اسم الشركة / الجهة', 'brandLogo': 'شعار الشركة', 'qrCode': 'رمز الحضور QR',
      'workSiteLat': 'خط العرض', 'workSiteLng': 'خط الطول', 'radiusMeters': 'نطاق الموقع بالمتر',
      'workStart': 'بداية الدوام', 'workEnd': 'نهاية الدوام', 'lateGraceMinutes': 'مهلة التأخر بالدقائق',
      'earlyLeaveGraceMinutes': 'مهلة الانصراف المبكر بالدقائق', 'earlyGraceMinutes': 'مهلة الانصراف المبكر بالدقائق',
      'specialties': 'تخصصات العمل', 'ownerName': 'اسم المالك', 'ownerUsername': 'اسم مستخدم المالك',
      'adminAccounts': 'حسابات الإدارة', 'locations': 'المواقع',
    };
    return labels[key] ?? key;
  }

  IconData _iconFor(String key) {
    if (key.toLowerCase().contains('logo') || key.toLowerCase().contains('brand')) return Icons.business_rounded;
    if (key.toLowerCase().contains('qr')) return Icons.qr_code_2_rounded;
    if (key.toLowerCase().contains('lat') || key.toLowerCase().contains('lng') || key.toLowerCase().contains('radius') || key.toLowerCase().contains('location')) return Icons.location_on_outlined;
    if (key.toLowerCase().contains('time') || key.toLowerCase().contains('start') || key.toLowerCase().contains('end') || key.toLowerCase().contains('grace')) return Icons.schedule_rounded;
    if (key.toLowerCase().contains('owner') || key.toLowerCase().contains('admin') || key.toLowerCase().contains('account')) return Icons.admin_panel_settings_rounded;
    if (key.toLowerCase().contains('security') || key.toLowerCase().contains('token') || key.toLowerCase().contains('device')) return Icons.security_rounded;
    if (key.toLowerCase().contains('special')) return Icons.work_outline_rounded;
    return Icons.tune_rounded;
  }

  Widget _header(String title, String subtitle, IconData icon) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)),
    child: Row(children: [
      Container(width: 46, height: 46, decoration: BoxDecoration(color: _brand.withValues(alpha: .10), borderRadius: BorderRadius.circular(15)), child: Icon(icon, color: _brand)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: _ink, fontSize: 17, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 11))])),
    ]),
  );

  Widget _section(String title, IconData icon, List<Widget> children) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Container(width: 38, height: 38, decoration: BoxDecoration(color: _brand.withValues(alpha: .10), shape: BoxShape.circle), child: Icon(icon, color: _brand, size: 20)), const SizedBox(width: 10), Text(title, style: const TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.w900))]),
      const SizedBox(height: 13),
      ...children,
    ]),
  );

  Widget _settingTile(String key, dynamic value) {
    final bool editable = key != 'adminAccounts' && key != 'locations' && key != 'brandLogo';
    return InkWell(
      onTap: editable ? () => _editValue(key, value) : null,
      borderRadius: BorderRadius.circular(15),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(15), border: Border.all(color: _line)),
        child: Row(children: [
          Icon(_iconFor(key), color: _brand, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(_labelFor(key), style: const TextStyle(color: _ink, fontWeight: FontWeight.w800, fontSize: 12)), const SizedBox(height: 3), Text(_displayValue(value), maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 11))])),
          if (editable) const Icon(Icons.edit_outlined, color: _muted, size: 18),
        ]),
      ),
    );
  }

  Widget _general() {
    final known = <String>['brandName', 'brandLogo', 'specialties', 'ownerName', 'ownerUsername', 'adminAccounts'];
    final rows = known.where(_settings.containsKey).map((k) => _settingTile(k, _settings[k])).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _header('الهوية والحسابات', 'مطابقة خيارات الهوية والحسابات الموجودة في الموقع الرئيسي.', Icons.business_rounded),
      const SizedBox(height: 12),
      _section('الهوية', Icons.business_rounded, rows.isEmpty ? [const Text('لا توجد بيانات هوية إضافية من الخادم.')] : rows),
    ]);
  }

  Widget _locationsView() {
    final known = <String>['workSiteLat', 'workSiteLng', 'radiusMeters', 'qrCode'];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _header('المواقع و QR', 'إعداد الموقع الرئيسي ورمز الحضور وإدارة المواقع المسجلة في الخادم.', Icons.location_on_outlined),
      const SizedBox(height: 12),
      _section('الموقع الرئيسي و QR', Icons.location_on_outlined, [
        ...known.where(_settings.containsKey).map((k) => _settingTile(k, _settings[k])),
        if (!_settings.containsKey('workSiteLat') && !_settings.containsKey('workSiteLng')) const Text('لا توجد إحداثيات محفوظة حالياً.'),
      ]),
      const SizedBox(height: 12),
      _section('المواقع المسجلة', Icons.map_outlined, _locations.isEmpty
          ? [const Text('لا توجد مواقع إضافية مسجلة.', style: TextStyle(color: _muted))]
          : _locations.map((raw) {
              final item = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
              return Container(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(15), border: Border.all(color: _line)), child: Row(children: [const Icon(Icons.place_outlined, color: _brand), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${item['name'] ?? item['id'] ?? 'موقع'}', style: const TextStyle(fontWeight: FontWeight.w800, color: _ink)), const SizedBox(height: 3), Text('${item['lat'] ?? '—'}, ${item['lng'] ?? '—'} · ${item['radiusMeters'] ?? '—'} م', style: const TextStyle(fontSize: 11, color: _muted))]))]));
            }).toList()),
    ]);
  }

  Widget _workView() {
    final known = <String>['workStart', 'workEnd', 'lateGraceMinutes', 'earlyLeaveGraceMinutes', 'earlyGraceMinutes'];
    final rows = known.where(_settings.containsKey).map((k) => _settingTile(k, _settings[k])).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _header('ساعات العمل', 'إعدادات الدوام والمهل المستخدمة في الحضور والانصراف.', Icons.schedule_rounded),
      const SizedBox(height: 12),
      _section('الدوام والمهل', Icons.schedule_rounded, rows.isEmpty ? [const Text('لا توجد إعدادات دوام إضافية من الخادم.')] : rows),
    ]);
  }

  Widget _advancedView() {
    final excluded = {'brandName', 'brandLogo', 'specialties', 'ownerName', 'ownerUsername', 'adminAccounts', 'locations', 'workSiteLat', 'workSiteLng', 'radiusMeters', 'qrCode', 'workStart', 'workEnd', 'lateGraceMinutes', 'earlyLeaveGraceMinutes', 'earlyGraceMinutes'};
    final extras = _settings.entries.where((e) => excluded.contains(e.key) == false).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _header('الأمان والنظام والمتقدم', 'كل مفاتيح الإعدادات التي يرسلها الخادم تظهر هنا دون حذف الخيارات غير المعروفة للتطبيق.', Icons.security_rounded),
      const SizedBox(height: 12),
      _section('إعدادات الخادم الإضافية', Icons.tune_rounded, extras.isEmpty ? [const Text('لا توجد مفاتيح إضافية من الخادم.')] : extras.map((e) => _settingTile(e.key, e.value)).toList()),
      const SizedBox(height: 12),
      _section('التشخيص', Icons.health_and_safety_outlined, [
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.health_and_safety_outlined, color: _brand), title: const Text('فحص اتصال الخادم', style: TextStyle(fontWeight: FontWeight.w800)), subtitle: const Text('يتحقق من استجابة واجهة الصحة بدون تغيير البيانات.'), trailing: IconButton(onPressed: _checkHealth, icon: const Icon(Icons.refresh_rounded))),
        const Divider(height: 1),
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.refresh_rounded, color: _brand), title: const Text('إعادة تحميل الإعدادات'), subtitle: const Text('يجلب أحدث نسخة من الإعدادات والمواقع.'), trailing: IconButton(onPressed: _load, icon: const Icon(Icons.sync_rounded))),
      ]),
    ]);
  }

  Future<void> _checkHealth() async {
    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      final data = await HadirApi(token: token).health();
      if (!mounted) return;
      showDialog<void>(context: context, builder: (c) => AlertDialog(title: const Text('حالة الخادم'), content: Text(data.isEmpty ? 'لم تصل بيانات تشخيص.' : _displayValue(data)), actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('إغلاق'))]));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(HadirApi.errorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    const tabs = ['عام', 'المواقع و QR', 'الدوام', 'متقدم'];
    final views = [_general(), _locationsView(), _workView(), _advancedView()];
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _bg,
        appBar: AppBar(backgroundColor: _bg, surfaceTintColor: Colors.transparent, elevation: 0, title: const Text('إعدادات النظام', style: TextStyle(color: _ink, fontWeight: FontWeight.w900)), actions: [IconButton(onPressed: _loading ? null : _load, tooltip: 'تحديث', icon: const Icon(Icons.refresh_rounded))]),
        body: _loading
            ? const Center(child: CircularProgressIndicator(color: _brand))
            : _error != null && _settings.isEmpty
                ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48, color: _muted), const SizedBox(height: 12), Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh_rounded), label: const Text('إعادة المحاولة'))]))
                : RefreshIndicator(color: _brand, onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 34), physics: const AlwaysScrollableScrollPhysics(), children: [
                    SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: List.generate(tabs.length, (i) => Padding(padding: const EdgeInsets.only(left: 8), child: ChoiceChip(selected: _tab == i, avatar: Icon([Icons.tune_rounded, Icons.location_on_outlined, Icons.schedule_rounded, Icons.security_rounded][i], size: 17), label: Text(tabs[i]), onSelected: (_) => setState(() => _tab = i))))),
                    const SizedBox(height: 14),
                    if (_error != null) Container(margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFFFFF5F4), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFF0D8D5))), child: Row(children: [const Icon(Icons.error_outline_rounded, color: Color(0xFFB33A32)), const SizedBox(width: 8), Expanded(child: Text(_error!, style: const TextStyle(fontSize: 12)))])),
                    views[_tab],
                    if (_saving) const Padding(padding: EdgeInsets.only(top: 14), child: LinearProgressIndicator(minHeight: 2, color: _brand)),
                  ])),
      ),
    );
  }
}