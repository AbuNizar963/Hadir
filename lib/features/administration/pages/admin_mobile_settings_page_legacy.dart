import 'package:flutter/material.dart';

import '../../../core/api.dart';
import '../../../core/session.dart';

class AdminMobileSettingsPage extends StatefulWidget {
  const AdminMobileSettingsPage({super.key});

  @override
  State<AdminMobileSettingsPage> createState() => _AdminMobileSettingsPageState();
}

class _AdminMobileSettingsPageState extends State<AdminMobileSettingsPage> {
  final _session = HadirSession();
  Map<String, dynamic> _settings = {};
  List<dynamic> _locations = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;
  int _section = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<String?> _token() => _session.adminToken();

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final token = await _token();
      if (token == null || token.isEmpty) {
        throw Exception('انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
      }
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
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  Future<void> _savePatch(Map<String, dynamic> patch) async {
    if (_saving || patch.isEmpty) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      final updated = await HadirApi(token: token).updateSettings(patch);
      if (!mounted) return;
      setState(() {
        _settings = {..._settings, ...patch, ...updated};
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم حفظ الإعدادات بنجاح')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = HadirApi.errorMessage(e);
      });
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
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            hintText: 'القيمة',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text.trim()),
            child: const Text('حفظ'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (result == null) return;

    dynamic next = result;
    if (value is num) next = num.tryParse(result) ?? result;
    if (value is bool) next = result.toLowerCase() == 'true' || result == '1' || result == 'نعم';
    if (value is List) {
      next = result.split(',').map((v) => v.trim()).where((v) => v.isNotEmpty).toList();
    }
    await _savePatch({key: next});
  }

  String _displayValue(dynamic value) {
    if (value is List) return value.join(', ');
    if (value is Map) return value.entries.map((e) => '${e.key}: ${e.value}').join('\n');
    return value == null ? '' : '$value';
  }

  String _labelFor(String key) {
    const labels = <String, String>{
      'brandName': 'اسم الشركة / الجهة',
      'brandLogo': 'شعار الشركة',
      'qrCode': 'رمز الحضور QR',
      'workSiteLat': 'خط العرض',
      'workSiteLng': 'خط الطول',
      'radiusMeters': 'نطاق الموقع بالمتر',
      'workStart': 'بداية الدوام',
      'workEnd': 'نهاية الدوام',
      'lateGraceMinutes': 'مهلة التأخر بالدقائق',
      'earlyLeaveGraceMinutes': 'مهلة الانصراف المبكر بالدقائق',
      'earlyGraceMinutes': 'مهلة الانصراف المبكر بالدقائق',
      'specialties': 'تخصصات العمل',
      'ownerName': 'اسم المالك',
      'ownerUsername': 'اسم مستخدم المالك',
      'adminAccounts': 'حسابات الإدارة',
      'locations': 'المواقع',
    };
    return labels[key] ?? key;
  }

  IconData _iconFor(String key) {
    final lower = key.toLowerCase();
    if (lower.contains('logo') || lower.contains('brand')) return Icons.business_rounded;
    if (lower.contains('qr')) return Icons.qr_code_2_rounded;
    if (lower.contains('lat') || lower.contains('lng') || lower.contains('radius') || lower.contains('location')) {
      return Icons.location_on_outlined;
    }
    if (lower.contains('time') || lower.contains('start') || lower.contains('end') || lower.contains('grace')) {
      return Icons.schedule_rounded;
    }
    if (lower.contains('owner') || lower.contains('admin') || lower.contains('account')) {
      return Icons.admin_panel_settings_rounded;
    }
    if (lower.contains('security') || lower.contains('token') || lower.contains('device')) return Icons.security_rounded;
    if (lower.contains('special')) return Icons.work_outline_rounded;
    return Icons.tune_rounded;
  }

  Widget _settingTile(BuildContext context, String key, dynamic value) {
    final scheme = Theme.of(context).colorScheme;
    final editable = key != 'adminAccounts' && key != 'locations' && key != 'brandLogo';
    return Container(
      margin: const EdgeInsets.only(bottom: 7),
      decoration: BoxDecoration(
        color: scheme.surface.withValues(alpha: .42),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .48)),
      ),
      child: ListTile(
        dense: true,
        minVerticalPadding: 4,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 1),
        leading: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: .09),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(_iconFor(key), color: scheme.primary, size: 20),
        ),
        title: Text(_labelFor(key), style: TextStyle(color: scheme.onSurface, fontSize: 12.5, fontWeight: FontWeight.w800)),
        subtitle: Text(_displayValue(value).isEmpty ? '—' : _displayValue(value), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)),
        trailing: editable ? Icon(Icons.edit_outlined, color: scheme.onSurfaceVariant, size: 17) : null,
        onTap: editable ? () => _editValue(key, value) : null,
      ),
    );
  }

  Widget _sectionBody(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    const groups = <List<String>>[
      ['brandName', 'brandLogo', 'specialties', 'ownerName', 'ownerUsername', 'adminAccounts'],
      ['workSiteLat', 'workSiteLng', 'radiusMeters', 'qrCode'],
      ['workStart', 'workEnd', 'lateGraceMinutes', 'earlyLeaveGraceMinutes', 'earlyGraceMinutes'],
    ];
    const titles = ['الهوية والحسابات', 'المواقع و QR', 'الدوام', 'المتقدم والتشخيص'];
    const icons = [Icons.person_outline_rounded, Icons.location_on_outlined, Icons.schedule_rounded, Icons.tune_rounded];

    if (_section == 3) {
      final excluded = <String>{...groups.expand((g) => g), 'locations'};
      final extras = _settings.entries.where((e) => !excluded.contains(e.key)).toList();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _sectionHeader(context, titles[3], 'التشخيص وإعدادات الخادم المتقدمة', icons[3]),
          const SizedBox(height: 8),
          if (extras.isEmpty)
            _empty(context, 'لا توجد مفاتيح إضافية من الخادم.')
          else
            ...extras.map((e) => _settingTile(context, e.key, e.value)),
          const SizedBox(height: 3),
          _actionTile(context, Icons.health_and_safety_outlined, 'فحص اتصال الخادم', 'تحقق من استجابة واجهة الصحة بدون تعديل البيانات.', _checkHealth),
          _actionTile(context, Icons.refresh_rounded, 'إعادة تحميل الإعدادات', 'جلب أحدث الإعدادات والمواقع من الخادم.', _load),
        ],
      );
    }

    final keys = groups[_section];
    final rows = keys.where(_settings.containsKey).map((key) => _settingTile(context, key, _settings[key])).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _sectionHeader(context, titles[_section], _sectionSubtitle(_section), icons[_section]),
        const SizedBox(height: 8),
        if (rows.isEmpty) _empty(context, _section == 1 ? 'لا توجد بيانات مواقع محفوظة حالياً.' : 'لا توجد بيانات إضافية من الخادم.') else ...rows,
        if (_section == 1 && _locations.isNotEmpty) ...[
          const SizedBox(height: 5),
          Text('المواقع المسجلة', style: TextStyle(color: scheme.onSurface, fontSize: 12.5, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          ..._locations.map((raw) => _locationTile(context, raw)),
        ],
      ],
    );
  }

  String _sectionSubtitle(int index) {
    switch (index) {
      case 0: return 'هوية الشركة وحسابات الإدارة';
      case 1: return 'مواقع العمل ورموز QR';
      case 2: return 'ساعات الدوام والمهل المستخدمة في الحضور والانصراف';
      default: return 'التشخيص والأدوات المتقدمة وإعدادات الخادم';
    }
  }

  Widget _sectionHeader(BuildContext context, String title, String subtitle, IconData icon) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(13)),
          child: Icon(icon, color: scheme.primary, size: 21),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: TextStyle(color: scheme.onSurface, fontSize: 14, fontWeight: FontWeight.w900)),
              const SizedBox(height: 1),
              Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _locationTile(BuildContext context, dynamic raw) {
    final scheme = Theme.of(context).colorScheme;
    final item = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return Container(
      margin: const EdgeInsets.only(bottom: 7),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      decoration: BoxDecoration(
        color: scheme.surface.withValues(alpha: .38),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .45)),
      ),
      child: Row(
        children: [
          Icon(Icons.place_outlined, color: scheme.primary, size: 20),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${item['name'] ?? item['id'] ?? 'موقع'}', style: TextStyle(color: scheme.onSurface, fontSize: 12, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text('${item['lat'] ?? '—'}, ${item['lng'] ?? '—'} · ${item['radiusMeters'] ?? '—'} م', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _empty(BuildContext context, String text) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: scheme.surface.withValues(alpha: .30), borderRadius: BorderRadius.circular(12), border: Border.all(color: scheme.outlineVariant.withValues(alpha: .42))),
      child: Text(text, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10.5), textAlign: TextAlign.center),
    );
  }

  Widget _actionTile(BuildContext context, IconData icon, String title, String subtitle, VoidCallback onTap) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(top: 7),
      decoration: BoxDecoration(color: scheme.surface.withValues(alpha: .40), borderRadius: BorderRadius.circular(12), border: Border.all(color: scheme.outlineVariant.withValues(alpha: .45))),
      child: ListTile(
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
        leading: Icon(icon, color: scheme.primary, size: 21),
        title: Text(title, style: TextStyle(color: scheme.onSurface, fontSize: 12.5, fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)),
        trailing: Icon(Icons.chevron_left_rounded, color: scheme.onSurfaceVariant, size: 19),
        onTap: onTap,
      ),
    );
  }

  Future<void> _checkHealth() async {
    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      final data = await HadirApi(token: token).health();
      if (!mounted) return;
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('حالة الخادم'),
          content: Text(data.isEmpty ? 'لم تصل بيانات تشخيص.' : _displayValue(data)),
          actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إغلاق'))],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(HadirApi.errorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: const Alignment(0.95, -0.9),
            radius: 1.25,
            colors: [scheme.primary.withValues(alpha: .075), Colors.transparent],
          ),
        ),
        child: _loading
            ? Center(child: CircularProgressIndicator(color: scheme.primary))
            : RefreshIndicator(
                color: scheme.primary,
                onRefresh: _load,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
                  children: [
                    Text('HADIR  ·  OWNER', textDirection: TextDirection.ltr, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.5)),
                    const SizedBox(height: 5),
                    Text('الإعدادات', style: TextStyle(color: scheme.onSurface, fontSize: 24, height: 1.1, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text('إدارة النظام والهوية والمواقع والحسابات والأمان', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11, height: 1.5)),
                    const SizedBox(height: 14),
                    _companyCard(context),
                    const SizedBox(height: 14),
                    Text('الإعدادات', style: TextStyle(color: scheme.onSurface, fontSize: 14, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text('اختر قسمًا لفتح واجهته الإدارية', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10.5)),
                    const SizedBox(height: 9),
                    _sectionSelector(context),
                    const SizedBox(height: 10),
                    if (_error != null) _errorBanner(context),
                    _sectionBody(context),
                    if (_saving) Padding(padding: const EdgeInsets.only(top: 12), child: LinearProgressIndicator(minHeight: 2, color: scheme.primary)),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _companyCard(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final name = '${_settings['brandName'] ?? 'هوية الشركة'}';
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 13),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .42),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: scheme.primary.withValues(alpha: .20)),
        boxShadow: [BoxShadow(color: scheme.primary.withValues(alpha: .06), blurRadius: 18, spreadRadius: 1)],
      ),
      child: Row(
        children: [
          Container(width: 58, height: 58, decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .10), shape: BoxShape.circle, border: Border.all(color: scheme.primary.withValues(alpha: .35), width: 1.2)), child: Icon(Icons.business_rounded, color: scheme.primary, size: 28)),
          const SizedBox(width: 11),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(name, style: TextStyle(color: scheme.onSurface, fontSize: 15, fontWeight: FontWeight.w900)), const SizedBox(height: 2), Text('هوية الشركة · الإعدادات المركزية', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5))])),
        ],
      ),
    );
  }

  Widget _sectionSelector(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    const labels = ['الهوية', 'المواقع و QR', 'الدوام', 'المتقدم'];
    const icons = [Icons.person_outline_rounded, Icons.location_on_outlined, Icons.schedule_rounded, Icons.tune_rounded];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(labels.length, (index) {
          final selected = _section == index;
          return Padding(
            padding: const EdgeInsets.only(left: 6),
            child: ChoiceChip(
              selected: selected,
              avatar: Icon(icons[index], size: 16, color: selected ? scheme.onPrimary : scheme.onSurfaceVariant),
              label: Text(labels[index], style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
              onSelected: (_) => setState(() => _section = index),
            ),
          );
        }),
      ),
    );
  }

  Widget _errorBanner(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 9),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      decoration: BoxDecoration(color: scheme.errorContainer.withValues(alpha: .55), borderRadius: BorderRadius.circular(12), border: Border.all(color: scheme.error.withValues(alpha: .22))),
      child: Row(children: [Icon(Icons.error_outline_rounded, color: scheme.error, size: 19), const SizedBox(width: 8), Expanded(child: Text(_error!, style: TextStyle(color: scheme.onErrorContainer, fontSize: 10))) ]),
    );
  }
}
