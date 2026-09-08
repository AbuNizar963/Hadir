import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

class AdminLoginPage extends StatefulWidget {
  const AdminLoginPage({super.key});

  @override
  State<AdminLoginPage> createState() => _AdminLoginPageState();
}

class _AdminLoginPageState extends State<AdminLoginPage> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();
  final _session = HadirSession();
  bool _busy = false;
  bool _hidden = true;
  String? _error;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    final username = _username.text.trim();
    final password = _password.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'أدخل اسم المستخدم وكلمة المرور.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final response = await HadirApi().adminLogin(
        username,
        password,
        deviceId: await _session.deviceId(),
        deviceLabel: _session.platformLabel,
        fingerprint: await _session.deviceFingerprint(),
      );
      if (response['kind'] != 'admin' || response['token'] == null) {
        throw Exception('هذا الحساب ليس حساب إدارة.');
      }
      await _session.saveAdminToken(response['token'].toString());
      if (!mounted) return;
      context.go('/admin');
    } catch (error) {
      if (mounted) setState(() => _error = HadirApi.errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _back() {
    if (_busy) return;
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final width = MediaQuery.sizeOf(context).width;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.fromLTRB(width < 420 ? 20 : 28, 20, width < 420 ? 20 : 28, 28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 430),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: IconButton(
                        onPressed: _busy ? null : _back,
                        icon: const Icon(Icons.arrow_forward_rounded),
                        tooltip: 'رجوع',
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      width: 62,
                      height: 62,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: scheme.primary,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: scheme.primary.withValues(alpha: .20),
                            blurRadius: 24,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 31),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'تسجيل دخول الإدارة',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      'حاضر',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(color: scheme.primary, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 26),
                    Card(
                      elevation: 0,
                      margin: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextField(
                              controller: _username,
                              enabled: !_busy,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [AutofillHints.username],
                              onSubmitted: (_) => _passwordFocus.requestFocus(),
                              decoration: const InputDecoration(
                                labelText: 'اسم المستخدم',
                                prefixIcon: Icon(Icons.person_outline_rounded),
                              ),
                            ),
                            const SizedBox(height: 14),
                            TextField(
                              controller: _password,
                              focusNode: _passwordFocus,
                              enabled: !_busy,
                              obscureText: _hidden,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [AutofillHints.password],
                              onSubmitted: (_) => _login(),
                              decoration: InputDecoration(
                                labelText: 'كلمة المرور',
                                prefixIcon: const Icon(Icons.lock_outline_rounded),
                                suffixIcon: IconButton(
                                  onPressed: _busy ? null : () => setState(() => _hidden = !_hidden),
                                  icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                                ),
                              ),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 14),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                decoration: BoxDecoration(
                                  color: scheme.error.withValues(alpha: .08),
                                  borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
                                  border: Border.all(color: scheme.error.withValues(alpha: .20)),
                                ),
                                child: Text(
                                  _error!,
                                  style: TextStyle(color: scheme.error, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                            const SizedBox(height: 18),
                            SizedBox(
                              height: 52,
                              child: FilledButton(
                                onPressed: _busy ? null : _login,
                                child: _busy
                                    ? const SizedBox.square(
                                        dimension: 20,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : const Text('تسجيل الدخول'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'حاضر',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                    ),
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
