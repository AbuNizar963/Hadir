import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

class AdminSettingsPage extends StatefulWidget {
  const AdminSettingsPage({super.key});

  @override
  State<AdminSettingsPage> createState() => _AdminSettingsPageState();
}

class _AdminSettingsPageState extends State<AdminSettingsPage> {
  final _session = HadirSession();
  final _formKey = GlobalKey<FormState>();
  final _brandName = TextEditingController();
  final _qrCode = TextEditingController();
  final _lat = TextEditingController();
  final _lng = TextEditingController();
  final _radius = TextEditingController();
  final _workStart = TextEditingController();
  final _workEnd = TextEditingController();
  final _lateGrace = TextEditingController();
  final _earlyGrace = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in [
      _brandName,
      _qrCode,
      _lat,
      _lng,
      _radius,
      _workStart,
      _workEnd,
      _lateGrace,
      _earlyGrace,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
      final settings = await HadirApi(token: token).settings();
      _setText(_brandName, settings['brandName']);
      _setText(_qrCode, settings['qrCode']);
      _setText(_lat, settings['workSiteLat'] ?? settings['lat']);
      _setText(_lng, settings['workSiteLng'] ?? settings['lng']);
      _setText(_radius, settings['radiusMeters']);
      _setText(_workStart, settings['workStart']);
      _setText(_workEnd, settings['workEnd']);
      _setText(_lateGrace, settings['lateGraceMinutes']);
      _setText(_earlyGrace, settings['earlyLeaveGraceMinutes'] ?? settings['earlyGraceMinutes']);
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  void _setText(TextEditingController controller, dynamic value) {
    controller.text = value == null ? '' : '$value';
  }

  String? _required(String? value) => value == null || value.trim().isEmpty ? 'هذا الحقل مطلوب' : null;

  String? _number(String? value) {
    if (_required(value) != null) return 'هذا الحقل مطلوب';
    return double.tryParse(value!.trim()) == null ? 'أدخل رقماً صالحاً' : null;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
      _success = null;
    });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
      final payload = <String, dynamic>{
        'brandName': _brandName.text.trim(),
        'qrCode': _qrCode.text.trim(),
        'workSiteLat': double.parse(_lat.text.trim()),
        'workSiteLng': double.parse(_lng.text.trim()),
        'radiusMeters': double.parse(_radius.text.trim()),
        'workStart': _workStart.text.trim(),
        'workEnd': _workEnd.text.trim(),
        'lateGraceMinutes': int.tryParse(_lateGrace.text.trim()) ?? 0,
        if (_earlyGrace.text.trim().isNotEmpty) 'earlyLeaveGraceMinutes': int.tryParse(_earlyGrace.text.trim()) ?? 0,
      };
      await HadirApi(token: token).updateSettings(payload);
      if (!mounted) return;
      setState(() {
        _saving = false;
        _success = 'تم حفظ الإعدادات بنجاح.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('إعدادات النظام'),
          actions: [
            IconButton(onPressed: _loading || _saving ? null : _load, tooltip: 'تحديث الإعدادات', icon: const Icon(Icons.refresh_rounded)),
          ],
        ),
        body: _loading
            ? Center(child: CircularProgressIndicator(color: scheme.primary))
            : RefreshIndicator(
                color: scheme.primary,
                onRefresh: _load,
                child: Form(
                  key: _formKey,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 34),
                    children: [
                      _hero(context),
                      const SizedBox(height: 14),
                      _section(context, 'عام', 'هوية المنشأة وإعدادات الحضور الأساسية', Icons.tune_rounded, [
                        _field(_brandName, 'اسم المنشأة', Icons.business_rounded, validator: _required),
                        _field(_qrCode, 'رمز الحضور QR', Icons.qr_code_2_rounded, validator: _required),
                      ]),
                      const SizedBox(height: 14),
                      _section(context, 'الموقع الجغرافي', 'نقطة العمل ونطاق التحقق الجغرافي', Icons.location_on_outlined, [
                        Row(children: [
                          Expanded(child: _field(_lat, 'خط العرض', Icons.north_rounded, validator: _number, keyboard: const TextInputType.numberWithOptions(decimal: true, signed: true))),
                          const SizedBox(width: 10),
                          Expanded(child: _field(_lng, 'خط الطول', Icons.east_rounded, validator: _number, keyboard: const TextInputType.numberWithOptions(decimal: true, signed: true))),
                        ]),
                        _field(_radius, 'نطاق الموقع بالمتر', Icons.radar_rounded, validator: _number, keyboard: TextInputType.number),
                      ]),
                      const SizedBox(height: 14),
                      _section(context, 'ساعات العمل', 'أوقات الدوام والهوامش المسموح بها', Icons.schedule_rounded, [
                        Row(children: [
                          Expanded(child: _field(_workStart, 'بداية الدوام', Icons.login_rounded, validator: _required)),
                          const SizedBox(width: 10),
                          Expanded(child: _field(_workEnd, 'نهاية الدوام', Icons.logout_rounded, validator: _required)),
                        ]),
                        Row(children: [
                          Expanded(child: _field(_lateGrace, 'مهلة التأخر بالدقائق', Icons.timer_outlined, validator: _number, keyboard: TextInputType.number)),
                          const SizedBox(width: 10),
                          Expanded(child: _field(_earlyGrace, 'مهلة الانصراف المبكر', Icons.timer_off_outlined, keyboard: TextInputType.number)),
                        ]),
                      ]),
                      if (_error != null) ...[const SizedBox(height: 14), _message(context, _error!, false)],
                      if (_success != null) ...[const SizedBox(height: 14), _message(context, _success!, true)],
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: _saving ? null : _save,
                        icon: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.save_rounded),
                        label: Text(_saving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'),
                      ),
                      const SizedBox(height: 8),
                      Text('التغييرات تطبق على إعدادات النظام الحالية ولا تغيّر سجلات الحضور السابقة.', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  Widget _hero(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [HadirBrand.primary, HadirBrand.primaryDark]),
          borderRadius: BorderRadius.circular(HadirBrand.radiusXl),
          boxShadow: const [BoxShadow(color: Color(0x220B6B5A), blurRadius: 22, offset: Offset(0, 10))],
        ),
        child: const Row(children: [
          Icon(Icons.settings_suggest_rounded, color: Colors.white, size: 32),
          SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('مركز إعدادات حاضر', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
            SizedBox(height: 4),
            Text('تحكم واضح وآمن في هوية المنشأة والموقع وساعات العمل.', style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.45)),
          ])),
        ]),
      );

  Widget _section(BuildContext context, String title, String subtitle, IconData icon, List<Widget> children) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(HadirBrand.radiusLg), border: Border.all(color: Theme.of(context).colorScheme.outline)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 42, height: 42, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: Theme.of(context).colorScheme.primary)),
            const SizedBox(width: 11),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 2),
              Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
            ])),
          ]),
          const SizedBox(height: 14),
          ...children.expand((child) => [child, const SizedBox(height: 10)]).toList()..removeLast(),
        ]),
      );

  Widget _field(TextEditingController controller, String label, IconData icon, {String? Function(String?)? validator, TextInputType? keyboard}) => TextFormField(
        controller: controller,
        validator: validator,
        keyboardType: keyboard,
        textDirection: TextDirection.ltr,
        decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
      );

  Widget _message(BuildContext context, String text, bool success) {
    final color = success ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.error;
    final background = success ? HadirBrand.soft : Theme.of(context).colorScheme.error.withValues(alpha: .08);
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(HadirBrand.radiusMd), border: Border.all(color: color.withValues(alpha: .25))),
      child: Row(children: [Icon(success ? Icons.check_circle_outline_rounded : Icons.error_outline_rounded, color: color), const SizedBox(width: 9), Expanded(child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)))]),
    );
  }
}
