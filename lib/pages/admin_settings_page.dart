import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _bg = Color(0xFFF7F9F8);
const _ink = Color(0xFF17322C);
const _line = Color(0xFFDCE6E2);

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
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _bg,
        appBar: AppBar(
          backgroundColor: _bg,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          title: const Text('إعدادات النظام', style: TextStyle(color: _ink, fontWeight: FontWeight.w900)),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator(color: _brand))
            : RefreshIndicator(
                color: _brand,
                onRefresh: _load,
                child: Form(
                  key: _formKey,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 34),
                    children: [
                      _section('عام', Icons.tune_rounded, [
                        _field(_brandName, 'اسم المنشأة', Icons.business_rounded, validator: _required),
                        _field(_qrCode, 'رمز الحضور QR', Icons.qr_code_2_rounded, validator: _required),
                      ]),
                      const SizedBox(height: 14),
                      _section('الموقع', Icons.location_on_outlined, [
                        Row(children: [
                          Expanded(child: _field(_lat, 'خط العرض', Icons.north_rounded, validator: _number, keyboard: const TextInputType.numberWithOptions(decimal: true, signed: true))),
                          const SizedBox(width: 10),
                          Expanded(child: _field(_lng, 'خط الطول', Icons.east_rounded, validator: _number, keyboard: const TextInputType.numberWithOptions(decimal: true, signed: true))),
                        ]),
                        _field(_radius, 'نطاق الموقع بالمتر', Icons.radar_rounded, validator: _number, keyboard: TextInputType.number),
                      ]),
                      const SizedBox(height: 14),
                      _section('ساعات العمل', Icons.schedule_rounded, [
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
                      if (_error != null) ...[const SizedBox(height: 14), _message(_error!, false)],
                      if (_success != null) ...[const SizedBox(height: 14), _message(_success!, true)],
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: _saving ? null : _save,
                        icon: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.save_rounded),
                        label: Text(_saving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  Widget _section(String title, IconData icon, List<Widget> children) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 40, height: 40, decoration: const BoxDecoration(color: Color(0xFFEAF4F0), shape: BoxShape.circle), child: Icon(icon, color: _brand)),
            const SizedBox(width: 11),
            Text(title, style: const TextStyle(color: _ink, fontSize: 16, fontWeight: FontWeight.w900)),
          ]),
          const SizedBox(height: 14),
          ...children.expand((child) => [child, const SizedBox(height: 10)]).toList()..removeLast(),
        ]),
      );

  Widget _field(TextEditingController controller, String label, IconData icon, {String? Function(String?)? validator, TextInputType? keyboard}) => Padding(
        padding: const EdgeInsets.only(bottom: 0),
        child: TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboard,
          textDirection: TextDirection.ltr,
          decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon), filled: true, fillColor: const Color(0xFFF8FAF9)),
        ),
      );

  Widget _message(String text, bool success) => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(color: success ? const Color(0xFFEAF4F0) : const Color(0xFFFFF5F4), borderRadius: BorderRadius.circular(16), border: Border.all(color: success ? const Color(0xFFCFE7DE) : const Color(0xFFF0D8D5))),
        child: Row(children: [Icon(success ? Icons.check_circle_outline_rounded : Icons.error_outline_rounded, color: success ? _brand : const Color(0xFFB33A32)), const SizedBox(width: 9), Expanded(child: Text(text, style: const TextStyle(color: _ink, fontSize: 12, fontWeight: FontWeight.w600)))]),
      );
}
