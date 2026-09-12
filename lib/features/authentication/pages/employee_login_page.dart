import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api.dart';
import '../../../core/hadir_brand.dart';
import '../../../core/session.dart';

class EmployeeLoginPage extends StatefulWidget {
  const EmployeeLoginPage({super.key});

  @override
  State<EmployeeLoginPage> createState() => _EmployeeLoginPageState();
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
  void dispose() {
    _user.dispose();
    _pass.dispose();
    _passFocus.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    final username = _user.text.trim();
    final password = _pass.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'أدخل رقم الموظف ورمز الدخول.');
      return;
    }
    if (!RegExp(r'^\d{6}$').hasMatch(password)) {
      setState(() => _error = 'رمز دخول الموظف يجب أن يتكون من 6 أرقام بالضبط.');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final response = await HadirApi().login(
        username,
        password,
        deviceId: await _session.deviceId(),
        deviceLabel: _session.platformLabel,
        fingerprint: await _session.deviceFingerprint(),
      );
      if (response['kind'] != 'employee' || response['token'] == null) {
        throw Exception('هذا الحساب ليس حساب موظف.');
      }
      await _session.saveToken(response['token'].toString());
      if (!mounted) return;
      context.go('/employee');
    } catch (error) {
      if (mounted) setState(() => _error = HadirApi.errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: SafeArea(
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const _Brand(),
                        TextButton(onPressed: _busy ? null : () => context.go('/'), child: const Text('الرئيسية')),
                      ],
                    ),
                    const SizedBox(height: 40),
                    Container(
                      width: 64,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: scheme.primary.withValues(alpha: .12),
                        borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
                        border: Border.all(color: scheme.primary.withValues(alpha: .25)),
                      ),
                      child: Text('H', style: TextStyle(color: scheme.primary, fontSize: 28, fontWeight: FontWeight.w900)),
                    ),
                    const SizedBox(height: 16),
                    Text('HADIR · بوابة الموظفين', textAlign: TextAlign.center, style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text('أهلاً بك', textAlign: TextAlign.center, style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                    Text('سجّل الدخول لعرض دوامك وتسجيل الحضور والانصراف بأمان.', textAlign: TextAlign.center, style: theme.textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant, height: 1.7)),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: scheme.surface.withValues(alpha: .80),
                        borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
                        border: Border.all(color: scheme.outline.withValues(alpha: .72)),
                        boxShadow: [BoxShadow(color: scheme.shadow.withValues(alpha: .08), blurRadius: 22, offset: const Offset(0, 8))],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          TextField(
                            controller: _user,
                            enabled: !_busy,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.next,
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                            onSubmitted: (_) => _passFocus.requestFocus(),
                            decoration: const InputDecoration(labelText: 'الرقم الوظيفي', hintText: 'مثال: 1001'),
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _pass,
                            focusNode: _passFocus,
                            enabled: !_busy,
                            obscureText: _hidden,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.done,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(6),
                            ],
                            onSubmitted: (_) => _login(),
                            decoration: InputDecoration(
                              labelText: 'رمز الدخول',
                              hintText: 'أدخل 6 أرقام',
                              suffixText: '6 أرقام',
                              suffixIcon: IconButton(
                                onPressed: _busy ? null : () => setState(() => _hidden = !_hidden),
                                icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              ),
                            ),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 14),
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: scheme.error.withValues(alpha: .10),
                                borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
                                border: Border.all(color: scheme.error.withValues(alpha: .35)),
                              ),
                              child: Text(_error!, style: TextStyle(color: scheme.error, fontSize: 13, height: 1.6, fontWeight: FontWeight.w700)),
                            ),
                          ],
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 52,
                            child: FilledButton(
                              onPressed: _busy ? null : _login,
                              child: _busy ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('تسجيل الدخول', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _SecurityTile(icon: '🔐', title: 'حماية الجهاز')),
                      const SizedBox(width: 8),
                      Expanded(child: _SecurityTile(icon: '📍', title: 'تحقق الموقع')),
                    ]),
                    const SizedBox(height: 14),
                    Text('بعد أول دخول يتذكر هذا الهاتف الجلسة، مع بقاء التحقق الأمني على الخادم.', textAlign: TextAlign.center, style: theme.textTheme.bodySmall?.copyWith(height: 1.7)),
                    const SizedBox(height: 18),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      TextButton(onPressed: _busy ? null : () => context.go('/'), child: const Text('← العودة')),
                      TextButton(onPressed: _busy ? null : () => context.go('/manager/login'), child: const Text('دخول الإدارة')),
                    ]),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand();
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 38, height: 38, alignment: Alignment.center, decoration: BoxDecoration(color: scheme.primary, borderRadius: BorderRadius.circular(12)), child: const Text('H', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 19))),
      const SizedBox(width: 9),
      Text('حاضر', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
    ]);
  }
}

class _SecurityTile extends StatelessWidget {
  const _SecurityTile({required this.icon, required this.title});
  final String icon;
  final String title;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(color: scheme.surfaceContainerHighest.withValues(alpha: .35), borderRadius: BorderRadius.circular(HadirBrand.radiusMd)),
      child: Column(children: [Text(icon, style: const TextStyle(fontSize: 15)), const SizedBox(height: 4), Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700))]),
    );
  }
}
