import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _brandDark = Color(0xFF064B40);
const _soft = Color(0xFFE8F5F0);
const _canvas = Color(0xFFF5F8F7);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF72827D);
const _line = Color(0xFFDCE6E2);
const _danger = Color(0xFFB33A32);

class EmployeeLoginPage extends StatefulWidget {
  const EmployeeLoginPage({super.key});
  @override State<EmployeeLoginPage> createState() => _EmployeeLoginPageState();
}

class _EmployeeLoginPageState extends State<EmployeeLoginPage> {
  final _session = HadirSession();
  final _user = TextEditingController();
  final _pass = TextEditingController();
  final _passFocus = FocusNode();
  bool _busy = false;
  bool _hidden = true;
  String? _error;

  @override
  void dispose() { _user.dispose(); _pass.dispose(); _passFocus.dispose(); super.dispose(); }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    if (_user.text.trim().isEmpty || _pass.text.isEmpty) { setState(() => _error = 'أدخل رقم الموظف وكلمة المرور.'); return; }
    setState(() { _busy = true; _error = null; });
    try {
      final response = await HadirApi().login(
        _user.text.trim(), _pass.text,
        deviceId: await _session.deviceId(),
        deviceLabel: _session.platformLabel,
        fingerprint: await _session.deviceFingerprint(),
      );
      if (response['kind'] != 'employee' || response['token'] == null) throw Exception('هذا الحساب ليس حساب موظف.');
      await _session.saveToken(response['token'].toString());
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) setState(() => _error = HadirApi.errorMessage(e));
    } finally { if (mounted) setState(() => _busy = false); }
  }

  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.rtl,
    child: Scaffold(
      backgroundColor: _canvas,
      body: SafeArea(
        child: Stack(children: [
          Positioned(top: -120, right: -100, child: _orb(280, _brand.withValues(alpha: .07))),
          Positioned(bottom: -160, left: -100, child: _orb(320, _brand.withValues(alpha: .05))),
          SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 30),
            child: Center(child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 470),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Align(alignment: AlignmentDirectional.centerStart, child: IconButton.filledTonal(onPressed: _busy ? null : () => context.pop(), icon: const Icon(Icons.arrow_forward_rounded), style: IconButton.styleFrom(backgroundColor: Colors.white, foregroundColor: _ink))),
                const SizedBox(height: 22),
                Center(child: Container(width: 78, height: 78, decoration: BoxDecoration(gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_brand, _brandDark]), borderRadius: BorderRadius.circular(25), boxShadow: const [BoxShadow(color: Color(0x250B6B5A), blurRadius: 28, offset: Offset(0, 12))]), child: const Icon(Icons.how_to_reg_rounded, color: Colors.white, size: 39))),
                const SizedBox(height: 18),
                const Text('مساحة الموظف', textAlign: TextAlign.center, style: TextStyle(color: _ink, fontSize: 29, fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                const Text('سجّل دخولك للوصول إلى حضورك وسجلك وطلباتك.', textAlign: TextAlign.center, style: TextStyle(color: _muted, fontSize: 12.5, height: 1.45)),
                const SizedBox(height: 26),
                Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), border: Border.all(color: _line), boxShadow: const [BoxShadow(color: Color(0x0A142D27), blurRadius: 28, offset: Offset(0, 12))]), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('بيانات الدخول', style: TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 14),
                  TextField(controller: _user, enabled: !_busy, textInputAction: TextInputAction.next, onSubmitted: (_) => _passFocus.requestFocus(), decoration: _input('رقم الموظف', Icons.badge_outlined)),
                  const SizedBox(height: 12),
                  TextField(controller: _pass, focusNode: _passFocus, enabled: !_busy, obscureText: _hidden, textInputAction: TextInputAction.done, onSubmitted: (_) => _login(), decoration: _input('كلمة المرور', Icons.lock_outline_rounded, IconButton(onPressed: _busy ? null : () => setState(() => _hidden = !_hidden), icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined)))),
                  if (_error != null) ...[const SizedBox(height: 12), Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: const Color(0xFFFFEFED), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFF2D0CC))), child: Row(children: [const Icon(Icons.error_outline_rounded, color: _danger, size: 19), const SizedBox(width: 8), Expanded(child: Text(_error!, style: const TextStyle(color: _danger, fontSize: 11, fontWeight: FontWeight.w700)))]))],
                  const SizedBox(height: 16),
                  SizedBox(height: 54, child: FilledButton.icon(onPressed: _busy ? null : _login, style: FilledButton.styleFrom(backgroundColor: _brand, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))), icon: _busy ? const SizedBox.square(dimension: 19, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.login_rounded), label: Text(_busy ? 'جارٍ التحقق...' : 'دخول إلى مساحة الموظف', style: const TextStyle(fontWeight: FontWeight.w900)))),
                ])),
                const SizedBox(height: 14),
                Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFD3E8E0))), child: const Row(children: [Icon(Icons.verified_user_outlined, color: _brand, size: 20), SizedBox(width: 9), Expanded(child: Text('دخول آمن مع التحقق من الجهاز قبل اعتماد الحضور.', style: TextStyle(color: _brandDark, fontSize: 10.5, height: 1.4, fontWeight: FontWeight.w700)))])),
                const SizedBox(height: 14),
                const Text('يتم ربط الجلسة بجهاز الموظف للتحقق الآمن من عمليات الحضور.', textAlign: TextAlign.center, style: TextStyle(color: _muted, fontSize: 10.5, height: 1.45)),
              ]),
            )),
          ),
        ]),
      ),
    ),
  );

  InputDecoration _input(String label, IconData icon, [Widget? suffix]) => InputDecoration(labelText: label, prefixIcon: Icon(icon), suffixIcon: suffix, filled: true, fillColor: const Color(0xFFF8FAF9), labelStyle: const TextStyle(color: _muted, fontSize: 12), border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: _line)), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: _line)), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: _brand, width: 1.4)));
  Widget _orb(double size, Color color) => Container(width: size, height: size, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}
