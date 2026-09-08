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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: SafeArea(
          child: Stack(
            children: [
              Positioned(
                top: -160,
                left: -110,
                child: _glow(350, scheme.primary.withValues(alpha: .09)),
              ),
              Positioned(
                bottom: -190,
                right: -130,
                child: _glow(380, scheme.secondary.withValues(alpha: .06)),
              ),
              SingleChildScrollView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 760),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _header(context),
                        const SizedBox(height: 18),
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final compact = constraints.maxWidth < 620;
                            final form = _formCard(context);
                            final security = _securityCard(context);
                            if (compact) {
                              return Column(
                                children: [form, const SizedBox(height: 12), security],
                              );
                            }
                            return Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(flex: 3, child: form),
                                const SizedBox(width: 12),
                                Expanded(flex: 2, child: security),
                              ],
                            );
                          },
                        ),
                        const SizedBox(height: 12),
                        _adminInfo(context),
                        const SizedBox(height: 22),
                        Text(
                          'حاضر · بوابة الإدارة الآمنة',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        IconButton.filledTonal(
          onPressed: _busy ? null : () => context.pop(),
          icon: const Icon(Icons.arrow_forward_rounded),
          tooltip: 'رجوع',
        ),
        const SizedBox(width: 10),
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
              colors: [theme.colorScheme.primary, HadirBrand.primaryDark],
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: theme.colorScheme.primary.withValues(alpha: .22),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 25),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('حاضر', style: theme.textTheme.titleLarge),
              Text('بوابة الإدارة', style: theme.textTheme.bodySmall),
            ],
          ),
        ),
        if (MediaQuery.sizeOf(context).width >= 520)
          Text('حساب إداري · وصول محمي', style: theme.textTheme.bodySmall),
      ],
    );
  }

  Widget _formCard(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return _card(
      context,
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _badge(context, 'ADMIN · تسجيل آمن'),
          const SizedBox(height: 16),
          Text(
            'مرحباً بك في لوحة الإدارة',
            style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 7),
          Text(
            'استخدم بيانات الحساب الإداري للوصول إلى الموظفين والعمليات والتقارير والإعدادات.',
            style: theme.textTheme.bodyMedium?.copyWith(height: 1.55),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _username,
            enabled: !_busy,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.username],
            onSubmitted: (_) => _passwordFocus.requestFocus(),
            decoration: const InputDecoration(
              labelText: 'اسم المستخدم الإداري',
              prefixIcon: Icon(Icons.person_outline_rounded),
            ),
          ),
          const SizedBox(height: 12),
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
                tooltip: _hidden ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور',
                icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: scheme.error.withValues(alpha: .08),
                borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
                border: Border.all(color: scheme.error.withValues(alpha: .25)),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline_rounded, color: scheme.error, size: 19),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: TextStyle(color: scheme.error, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _busy ? null : _login,
            icon: _busy
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.login_rounded),
            label: Text(_busy ? 'جاري التحقق من الحساب…' : 'دخول لوحة الإدارة'),
          ),
        ],
      ),
    );
  }

  Widget _securityCard(BuildContext context) {
    return _card(
      context,
      padding: const EdgeInsets.all(17),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Text('SECURITY · الحماية', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
          SizedBox(height: 10),
          _SecurityItem(icon: Icons.admin_panel_settings_outlined, title: 'حساب مستقل', desc: 'بوابة الإدارة منفصلة عن حساب الموظف.'),
          SizedBox(height: 8),
          _SecurityItem(icon: Icons.devices_other_rounded, title: 'هوية الجهاز', desc: 'يتم إرسال هوية الجهاز ضمن عملية المصادقة.'),
          SizedBox(height: 8),
          _SecurityItem(icon: Icons.vpn_key_outlined, title: 'جلسة محمية', desc: 'يُحفظ رمز الإدارة في جلسة الإدارة المخصصة.'),
          SizedBox(height: 8),
          _SecurityItem(icon: Icons.fact_check_outlined, title: 'وصول موثّق', desc: 'لا يتم فتح لوحة الإدارة إلا بعد التحقق من نوع الحساب.'),
        ],
      ),
    );
  }

  Widget _adminInfo(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return _card(
      context,
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: .10),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(Icons.verified_user_outlined, color: scheme.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('صلاحيات الإدارة', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 3),
                Text(
                  'الموظفون · العمليات · التقارير · التدقيق · الإعدادات',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _badge(BuildContext context, String text) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: primary.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: primary, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
          Text(text, style: TextStyle(color: primary, fontSize: 11, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _card(BuildContext context, {required Widget child, required EdgeInsets padding}) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: scheme.surface.withValues(alpha: .94),
        borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
        border: Border.all(color: scheme.outline.withValues(alpha: .7)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .08),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _glow(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      );
}

class _SecurityItem extends StatelessWidget {
  const _SecurityItem({required this.icon, required this.title, required this.desc});
  final IconData icon;
  final String title;
  final String desc;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outline.withValues(alpha: .5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: scheme.primary, size: 19),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(desc, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 9.2, height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
