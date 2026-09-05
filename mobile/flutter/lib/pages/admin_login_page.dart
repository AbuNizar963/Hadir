import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';

const _adminBrand = Color(0xFF0B6B5A);
const _adminInk = Color(0xFF17322C);
const _adminMuted = Color(0xFF70817B);

class AdminLoginPage extends StatefulWidget {
  const AdminLoginPage({super.key});

  @override
  State<AdminLoginPage> createState() => _AdminLoginPageState();
}

class _AdminLoginPageState extends State<AdminLoginPage> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _session = HadirSession();
  bool _busy = false;
  bool _hidden = true;
  String? _error;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_username.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'أدخل اسم المستخدم وكلمة المرور.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await HadirApi().adminLogin(_username.text, _password.text);
      if (response['kind'] != 'admin' || response['token'] == null) {
        throw Exception('هذا الحساب ليس حساب إدارة.');
      }
      await _session.saveAdminToken(response['token'].toString());
      if (mounted) context.go('/admin');
    } catch (error) {
      if (mounted) setState(() => _error = HadirApi.errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 82,
                    height: 82,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _adminBrand,
                      borderRadius: BorderRadius.circular(26),
                      boxShadow: const [BoxShadow(blurRadius: 24, offset: Offset(0, 10))],
                    ),
                    child: const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 44),
                  ),
                  const SizedBox(height: 24),
                  const Text('إدارة حاضر', textAlign: TextAlign.center, style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: _adminInk)),
                  const SizedBox(height: 7),
                  const Text('دخول آمن إلى لوحة الإدارة', textAlign: TextAlign.center, style: TextStyle(color: _adminMuted, fontSize: 15)),
                  const SizedBox(height: 34),
                  TextField(
                    controller: _username,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.username],
                    decoration: const InputDecoration(labelText: 'اسم المستخدم', prefixIcon: Icon(Icons.person_outline_rounded)),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _password,
                    obscureText: _hidden,
                    onSubmitted: (_) => _login(),
                    autofillHints: const [AutofillHints.password],
                    decoration: InputDecoration(
                      labelText: 'كلمة المرور',
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _hidden = !_hidden),
                        icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(13),
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: .07),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.red.withValues(alpha: .25)),
                      ),
                      child: Text(_error!, style: const TextStyle(color: Colors.red)),
                    ),
                  ],
                  const SizedBox(height: 22),
                  FilledButton.icon(
                    onPressed: _busy ? null : _login,
                    icon: _busy ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.login_rounded),
                    label: Text(_busy ? 'جارٍ التحقق...' : 'دخول الإدارة'),
                  ),
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => context.go('/login'),
                    icon: const Icon(Icons.badge_outlined),
                    label: const Text('دخول الموظفين'),
                  ),
                  const SizedBox(height: 20),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.shield_outlined, size: 16, color: _adminMuted),
                      SizedBox(width: 6),
                      Text('الحساب الإداري منفصل عن حساب الموظف', style: TextStyle(color: _adminMuted, fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
