import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

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
      setState(() => _error = 'أدخل رقم الموظف وكلمة المرور.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

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
      context.go('/home');
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = HadirApi.errorMessage(error));
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
                top: -150,
                left: -100,
                child: _glow(330, scheme.primary.withValues(alpha: .08)),
              ),
              Positioned(
                bottom: -180,
                right: -120,
                child: _glow(360, scheme.secondary.withValues(alpha: .06)),
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
                            final status = _statusCard(context);
                            if (compact) {
                              return Column(
                                children: [form, const SizedBox(height: 12), status],
                              );
                            }
                            return Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(flex: 3, child: form),
                                const SizedBox(width: 12),
                                Expanded(flex: 2, child: status),
                              ],
                            );
                          },
                        ),
                        const SizedBox(height: 12),
                        _flowCard(context),
                        const SizedBox(height: 22),
                        Text(
                          'حاضر · نظام حضور وانصراف موثّق',
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
          child: const Icon(Icons.how_to_reg_rounded, color: Colors.white, size: 25),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('حاضر', style: theme.textTheme.titleLarge),
              Text('دخول الموظفين', style: theme.textTheme.bodySmall),
            ],
          ),
        ),
        if (MediaQuery.sizeOf(context).width >= 520)
          Text('نظام آمن · تحقق متعدد الطبقات', style: theme.textTheme.bodySmall),
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
          _badge(context, 'تسجيل الدخول'),
          const SizedBox(height: 16),
          Text(
            'ادخل إلى مساحة الموظف',
            style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 7),
          Text(
            'استخدم رقمك الوظيفي وكلمة المرور للوصول إلى الحضور والسجل والطلبات.',
            style: theme.textTheme.bodyMedium?.copyWith(height: 1.55),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _user,
            enabled: !_busy,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onSubmitted: (_) => _passFocus.requestFocus(),
            decoration: const InputDecoration(
              labelText: 'رقم الموظف',
              prefixIcon: Icon(Icons.badge_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _pass,
            focusNode: _passFocus,
            enabled: !_busy,
            obscureText: _hidden,
            textInputAction: TextInputAction.done,
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
            label: Text(_busy ? 'جاري التحقق من الحساب…' : 'تسجيل الدخول'),
          ),
        ],
      ),
    );
  }

  Widget _statusCard(BuildContext context) {
    return _card(
      context,
      padding: const EdgeInsets.all(17),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Text('STATUS · طبقات التحقق', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
          SizedBox(height: 10),
          _Layer(index: '01', title: 'الحساب', desc: 'يتم التحقق من الرقم الوظيفي وكلمة المرور.'),
          SizedBox(height: 7),
          _Layer(index: '02', title: 'الجهاز', desc: 'يرتبط الحساب بجهاز الموظف المعتمد.'),
          SizedBox(height: 7),
          _Layer(index: '03', title: 'الحضور', desc: 'الموقع وQR يتحققان قبل اعتماد العملية.'),
          SizedBox(height: 7),
          _Layer(index: '04', title: 'السجل', desc: 'كل عملية ناجحة أو مرفوضة تحفظ في سجل التدقيق.'),
        ],
      ),
    );
  }

  Widget _flowCard(BuildContext context) {
    const items = ['تسجيل الدخول', 'التحقق من الجهاز', 'الحصول على GPS', 'التأكد من النطاق', 'مسح QR', 'تسجيل العملية'];
    return _card(
      context,
      padding: const EdgeInsets.all(17),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('FLOW · تسلسل العملية', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth < 520 ? 2 : 3;
              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: items.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: columns,
                  crossAxisSpacing: 7,
                  mainAxisSpacing: 7,
                  childAspectRatio: columns == 2 ? 2.45 : 2.9,
                ),
                itemBuilder: (_, index) => Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .5),
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: .5)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('STEP ${('${index + 1}').padLeft(2, '0')}', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontSize: 8.5, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 3),
                      Text(items[index], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _badge(BuildContext context, String text) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(30)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: primary, shape: BoxShape.circle)),
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
          BoxShadow(color: Colors.black.withValues(alpha: .08), blurRadius: 24, offset: const Offset(0, 10)),
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

class _Layer extends StatelessWidget {
  const _Layer({required this.index, required this.title, required this.desc});
  final String index;
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
          Text(index, style: TextStyle(color: scheme.primary, fontSize: 9.5, fontWeight: FontWeight.w900)),
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
