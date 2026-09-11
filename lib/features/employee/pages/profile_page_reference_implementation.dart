import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/api.dart';
import '../../../core/hadir_brand.dart';
import '../../../core/session.dart';

/// Native employee profile screen matching the supplied reference capture.
class EmployeeProfileReferencePage extends StatefulWidget {
  const EmployeeProfileReferencePage({super.key});

  @override
  State<EmployeeProfileReferencePage> createState() => _EmployeeProfileReferencePageState();
}

class _EmployeeProfileReferencePageState extends State<EmployeeProfileReferencePage> {
  static const _webOrigin = 'https://hadir-9rq.pages.dev';
  final _session = HadirSession();

  Map<String, dynamic>? _user;
  bool _loading = true;
  bool _saving = false;
  bool _showPassword = false;
  bool _copied = false;
  String _newPassword = '';
  String _confirmPassword = '';
  String _lastSync = '';
  String? _error;
  String? _message;
  String? _avatarUrl;
  String? _token;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.token();
      final api = HadirApi(token: token);
      final user = Map<String, dynamic>.from(await api.employeeProfile());
      final id = '${user['id'] ?? ''}'.trim();
      if (!mounted) return;
      setState(() {
        _token = token;
        _user = user;
        _avatarUrl = id.isEmpty ? null : api.employeeAvatarUrl(id);
        _lastSync = TimeOfDay.now().format(context);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(e); });
    }
  }

  String _text(String key, [String fallback = '—']) {
    final value = '${_user?[key] ?? ''}'.trim();
    return value.isEmpty ? fallback : value;
  }

  Future<void> _copyJobNumber() async {
    final job = _text('jobNumber', _text('username'));
    if (job == '—') return;
    await Clipboard.setData(ClipboardData(text: job));
    if (!mounted) return;
    setState(() => _copied = true);
    Future<void>.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  Future<void> _savePassword() async {
    setState(() { _error = null; _message = null; });
    if (!RegExp(r'^\d{6}$').hasMatch(_newPassword)) {
      setState(() => _error = 'كلمة سر الموظف يجب أن تتكون من 6 أرقام بالضبط.');
      return;
    }
    if (_newPassword != _confirmPassword) {
      setState(() => _error = 'تأكيد كلمة السر غير مطابق.');
      return;
    }
    final id = _text('id', '').trim();
    if (id.isEmpty) {
      setState(() => _error = 'تعذر تحديد الموظف الحالي. يرجى تسجيل الدخول مرة أخرى.');
      return;
    }
    setState(() => _saving = true);
    try {
      await HadirApi(token: _token).updateEmployeeProfile({'employeeId': id, 'password': _newPassword});
      if (!mounted) return;
      setState(() {
        _newPassword = '';
        _confirmPassword = '';
        _showPassword = false;
        _message = 'تم تغيير كلمة السر بنجاح';
      });
    } catch (e) {
      if (mounted) setState(() => _error = HadirApi.errorMessage(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: RefreshIndicator(
        color: HadirBrand.primary,
        onRefresh: _load,
        child: _loading
            ? const _ProfileLoading()
            : ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 30),
                children: [
                  _topActions(),
                  const SizedBox(height: 12),
                  _profileHero(),
                  const SizedBox(height: 12),
                  _digitalCard(),
                  const SizedBox(height: 12),
                  _accountCard(),
                  const SizedBox(height: 12),
                  _securityCard(),
                  if (_message != null) ...[const SizedBox(height: 10), _notice(_message!, true)],
                  if (_error != null) ...[const SizedBox(height: 10), _notice(_error!, false)],
                ],
              ),
      ),
    );
  }

  Widget _topActions() {
    return Row(
      children: [
        Expanded(
          child: Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton.icon(
              onPressed: () => context.pop(),
              icon: const Icon(Icons.arrow_forward_rounded, size: 17),
              label: const Text('العودة', style: TextStyle(fontWeight: FontWeight.w800)),
              style: OutlinedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), side: const BorderSide(color: HadirBrand.border)),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh_rounded, size: 17),
              label: const Text('تحديث البيانات', style: TextStyle(fontWeight: FontWeight.w800)),
              style: OutlinedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), side: const BorderSide(color: HadirBrand.border)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _profileHero() {
    final name = _text('name', 'الموظف');
    return _card(
      child: Row(
        children: [
          _avatar(name),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('الملف الشخصي', style: TextStyle(color: HadirBrand.muted, fontSize: 10)),
                const SizedBox(height: 3),
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                const Text('إدارة الصورة الشخصية وأمان الحساب ومعلومات الموظف.', style: TextStyle(color: HadirBrand.muted, fontSize: 10.5, height: 1.35)),
                const SizedBox(height: 8),
                Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(9)), child: const Text('♙  موظف', style: TextStyle(color: HadirBrand.primaryDark, fontSize: 9.5, fontWeight: FontWeight.w800))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _avatar(String name) {
    final initial = name.isEmpty ? 'م' : name.characters.first;
    final headers = _token == null ? null : {'Authorization': 'Bearer $_token'};
    return Container(
      width: 88,
      height: 88,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(24), border: Border.all(color: HadirBrand.primary.withValues(alpha: .3), width: 2)),
      child: _avatarUrl == null
          ? Center(child: Text(initial, style: const TextStyle(color: HadirBrand.primary, fontSize: 30, fontWeight: FontWeight.w900)))
          : Image.network(_avatarUrl!, headers: headers, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Center(child: Text(initial, style: const TextStyle(color: HadirBrand.primary, fontSize: 30, fontWeight: FontWeight.w900)))),
    );
  }

  Widget _digitalCard() {
    final name = _text('name', 'الموظف');
    final job = _text('jobNumber', _text('username', '—'));
    final id = _text('id', job);
    final verifyUrl = id == '—' ? '' : '$_webOrigin/employee/verify/${Uri.encodeComponent(id)}';
    return _card(
      borderColor: HadirBrand.primary.withValues(alpha: .30),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('الهوية الرقمية', style: TextStyle(color: HadirBrand.muted, fontSize: 9.5)), SizedBox(height: 2), Text('بطاقتي الرقمية', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900))])), Text('ID', style: TextStyle(color: HadirBrand.primary, fontWeight: FontWeight.w900, fontSize: 11))]),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: HadirBrand.primary.withValues(alpha: .25))),
            child: Column(children: [
              Row(children: [Container(width: 52, height: 52, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(14)), child: const Center(child: Text('م', style: TextStyle(color: HadirBrand.primary, fontSize: 24, fontWeight: FontWeight.w900)))), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Hadir', style: TextStyle(color: HadirBrand.muted, fontSize: 8.5)), Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)), Text('موظف · الرقم الوظيفي $job', style: const TextStyle(color: HadirBrand.muted, fontSize: 9.5))]))]),
              const SizedBox(height: 10),
              Row(children: [Expanded(child: _statusCell('الحالة', '● نشط')), const SizedBox(width: 8), Expanded(child: _statusCell('التحقق', 'QR آمن'))]),
              const SizedBox(height: 10),
              if (verifyUrl.isNotEmpty) Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFF9FBFA), borderRadius: BorderRadius.circular(16), border: Border.all(color: HadirBrand.border)), child: QrImageView(data: verifyUrl, version: QrVersions.auto, size: 170, backgroundColor: Colors.white)) else const Padding(padding: EdgeInsets.all(18), child: Text('تعذر إنشاء رمز التحقق حالياً.', style: TextStyle(color: HadirBrand.muted))),
              const SizedBox(height: 6),
              const Text('امسح الرمز للتحقق من هوية الموظف', style: TextStyle(color: HadirBrand.muted, fontSize: 9.5)),
            ]),
          ),
          const SizedBox(height: 10),
          SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('طباعة البطاقة متاحة من نسخة الويب حالياً.'))), icon: const Icon(Icons.print_rounded, size: 18), label: const Text('طباعة البطاقة', style: TextStyle(fontWeight: FontWeight.w900)))),
        ],
      ),
    );
  }

  Widget _statusCell(String label, String value) => Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: HadirBrand.border)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: HadirBrand.muted, fontSize: 8.5)), const SizedBox(height: 2), Text(value, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: HadirBrand.primaryDark))]));

  Widget _accountCard() {
    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _heading(Icons.badge_outlined, 'معلومات الحساب', 'بيانات الموظف'),
        const SizedBox(height: 10),
        GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 2.05, children: [
          _dataCell('الاسم', _text('name')),
          InkWell(onTap: _copyJobNumber, borderRadius: BorderRadius.circular(12), child: _dataCell('الرقم الوظيفي', _copied ? 'تم النسخ ✓' : _text('jobNumber', _text('username')))),
          _dataCell('حالة الحساب', '● نشط', valueColor: HadirBrand.primary),
          _dataCell('آخر مزامنة', _lastSync.isEmpty ? '—' : _lastSync),
        ]),
      ]),
    );
  }

  Widget _securityCard() {
    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _heading(Icons.key_rounded, 'أمان الحساب', ''),
        const SizedBox(height: 12),
        _passwordField('كلمة السر الجديدة — 6 أرقام', _newPassword, (v) => setState(() => _newPassword = v.replaceAll(RegExp(r'\D'), '').substring(0, v.replaceAll(RegExp(r'\D'), '').length.clamp(0, 6))), first: true),
        const SizedBox(height: 9),
        _passwordField('تأكيد كلمة السر — 6 أرقام', _confirmPassword, (v) => setState(() => _confirmPassword = v.replaceAll(RegExp(r'\D'), '').substring(0, v.replaceAll(RegExp(r'\D'), '').length.clamp(0, 6)))),
        const SizedBox(height: 11),
        SizedBox(width: double.infinity, child: FilledButton(onPressed: _saving ? null : _savePassword, child: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('حفظ كلمة السر', style: TextStyle(fontWeight: FontWeight.w900)))),
        const SizedBox(height: 10),
        Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(12), border: Border.all(color: HadirBrand.primary.withValues(alpha: .15))), child: const Row(children: [Icon(Icons.verified_user_outlined, color: HadirBrand.primary, size: 17), SizedBox(width: 8), Expanded(child: Text('تُحفظ كلمة السر في الخادم باستخدام PBKDF2 ولا يتم تخزينها كنص مكشوف.', style: TextStyle(color: HadirBrand.muted, fontSize: 9.5, height: 1.4)))])),
      ]),
    );
  }

  Widget _passwordField(String hint, String value, ValueChanged<String> onChanged, {bool first = false}) {
    return TextField(
      obscureText: !_showPassword,
      keyboardType: TextInputType.number,
      maxLength: 6,
      controller: TextEditingController(text: value)..selection = TextSelection.collapsed(offset: value.length),
      onChanged: onChanged,
      decoration: InputDecoration(hintText: hint, counterText: '', filled: true, fillColor: Colors.white, prefixIcon: const Icon(Icons.lock_outline_rounded, size: 19), suffixIcon: first ? IconButton(onPressed: () => setState(() => _showPassword = !_showPassword), icon: Icon(_showPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded)) : null, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: HadirBrand.border)), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: HadirBrand.border))),
    );
  }

  Widget _heading(IconData icon, String eyebrow, String title) => Row(children: [Container(width: 36, height: 36, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: HadirBrand.primary, size: 19)), const SizedBox(width: 9), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(eyebrow, style: const TextStyle(color: HadirBrand.muted, fontSize: 9)), if (title.isNotEmpty) Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900))]))]);

  Widget _dataCell(String label, String value, {Color? valueColor}) => Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFFBFCFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: HadirBrand.border)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: HadirBrand.muted, fontSize: 8.5)), const SizedBox(height: 3), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: valueColor))]));

  Widget _card({required Widget child, Color? borderColor}) => Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: borderColor ?? HadirBrand.border), boxShadow: const [BoxShadow(color: Color(0x12000000), blurRadius: 12, offset: Offset(0, 5))]), child: child);

  Widget _notice(String text, bool good) => Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: good ? HadirBrand.soft : const Color(0xFFFFF3F1), borderRadius: BorderRadius.circular(12), border: Border.all(color: good ? HadirBrand.border : const Color(0xFFF0D8D5))), child: Text(text, style: TextStyle(color: good ? HadirBrand.primaryDark : HadirBrand.danger, fontSize: 10.5, fontWeight: FontWeight.w700)));
}

class _ProfileLoading extends StatelessWidget {
  const _ProfileLoading();
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [for (var i = 0; i < 4; i++) ...[Container(height: i == 0 ? 115 : 190, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: HadirBrand.border))), const SizedBox(height: 12)]]);
}
