import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api.dart';
import '../../../core/hadir_brand.dart';
import '../../../core/session.dart';

class AdminLoginPage extends StatefulWidget {
  const AdminLoginPage({super.key});

  @override
  State<AdminLoginPage> createState() => _AdminLoginPageState();
}

class _AdminLoginPageState extends State<AdminLoginPage> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _recoveryCode = TextEditingController();
  final _newPassword = TextEditingController();
  final _ownerName = TextEditingController();
  final _ownerUsername = TextEditingController();
  final _passwordFocus = FocusNode();
  final _session = HadirSession();
  final _api = HadirApi();

  bool _busy = false;
  bool _recoveryLoading = false;
  bool _hidden = true;
  bool _recoveryOpen = false;
  bool _employeeAccessBlocked = false;
  String? _error;
  String? _recoveryError;
  String? _recoveryMessage;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _recoveryCode.dispose();
    _newPassword.dispose();
    _ownerName.dispose();
    _ownerUsername.dispose();
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
      _employeeAccessBlocked = false;
    });
    try {
      final response = await _api.adminLogin(
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
      final message = HadirApi.errorMessage(error);
      final employeeAttempt = message.contains('هذا الحساب مرتبط بجهاز آخر') ||
          message.contains('تعذر الحصول على معرف الجهاز') ||
          message.contains('هذا الحساب موظف وليس حساب إدارة') ||
          message.contains('هذا الحساب موظف');
      if (!mounted) return;
      setState(() {
        _employeeAccessBlocked = employeeAttempt;
        _error = employeeAttempt ? null : message;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _recoverOwner() async {
    FocusScope.of(context).unfocus();
    if (_recoveryLoading) return;
    setState(() {
      _recoveryLoading = true;
      _recoveryError = null;
      _recoveryMessage = null;
    });
    try {
      final response = await _api.dio.post(
        '/api/auth/recover-owner',
        data: {
          'recoveryCode': _recoveryCode.text.trim(),
          'newPassword': _newPassword.text,
          'ownerName': _ownerName.text.trim(),
          'ownerUsername': _ownerUsername.text.trim(),
        },
      );
      final data = response.data is Map
          ? Map<String, dynamic>.from(response.data as Map)
          : <String, dynamic>{};
      if (!mounted) return;
      setState(() {
        _recoveryMessage = data['message']?.toString() ??
            'تم تغيير كلمة مرور المالك. يمكنك تسجيل الدخول الآن.';
        _recoveryCode.clear();
        _newPassword.clear();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _recoveryError = HadirApi.errorMessage(error));
    } finally {
      if (mounted) setState(() => _recoveryLoading = false);
    }
  }

  void _back() {
    if (_busy || _recoveryLoading) return;
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  InputDecoration _inputDecoration({required String hint, required IconData icon}) => InputDecoration(
        hintText: hint,
        prefixIcon: Icon(icon),
        filled: true,
        fillColor: Theme.of(context).colorScheme.surface,
      );

  Widget _messageBox(String text, {required bool error}) {
    final scheme = Theme.of(context).colorScheme;
    final color = error ? scheme.error : scheme.primary;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
        border: Border.all(color: color.withValues(alpha: .40)),
      ),
      child: Text(text, style: TextStyle(color: color, fontSize: 13, height: 1.55)),
    );
  }

  Widget _recoveryForm(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'إذا لم يكن حساب المالك قد أُنشئ بعد، استخدم هذا المسار لإنشائه لأول مرة. العملية محمية برمز الاستعادة السري وتُستهلك مرة واحدة فقط.',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12, height: 1.6),
          ),
          const SizedBox(height: 12),
          TextField(controller: _recoveryCode, enabled: !_recoveryLoading, obscureText: true, decoration: _inputDecoration(hint: 'أدخل رمز الاستعادة', icon: Icons.key_outlined)),
          const SizedBox(height: 12),
          TextField(controller: _ownerName, enabled: !_recoveryLoading, decoration: _inputDecoration(hint: 'اسم المالك', icon: Icons.person_outline_rounded)),
          const SizedBox(height: 12),
          TextField(controller: _ownerUsername, enabled: !_recoveryLoading, decoration: _inputDecoration(hint: 'مثال: owner', icon: Icons.badge_outlined)),
          const SizedBox(height: 12),
          TextField(controller: _newPassword, enabled: !_recoveryLoading, obscureText: true, decoration: _inputDecoration(hint: '12 حرفًا على الأقل', icon: Icons.lock_reset_outlined)),
          if (_recoveryError != null) ...[const SizedBox(height: 12), _messageBox(_recoveryError!, error: true)],
          if (_recoveryMessage != null) ...[const SizedBox(height: 12), _messageBox(_recoveryMessage!, error: false)],
          const SizedBox(height: 12),
          SizedBox(
            height: 48,
            child: FilledButton(
              onPressed: _recoveryLoading ? null : _recoverOwner,
              child: _recoveryLoading ? const SizedBox.square(dimension: 19, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('إنشاء/إعادة تعيين حساب المالك'),
            ),
          ),
        ],
      );

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
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(20),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 36, height: 36, decoration: BoxDecoration(color: scheme.primary, borderRadius: BorderRadius.circular(12)), child: Icon(Icons.fingerprint_rounded, color: scheme.onPrimary, size: 22)),
                      const SizedBox(width: 10),
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('حاضر', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)), Text('HADIR · v1.1', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10, fontFamily: 'monospace'))]),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.fromLTRB(width < 420 ? 20 : 28, 0, width < 420 ? 20 : 28, 40),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 448),
                      child: Card(
                        margin: EdgeInsets.zero,
                        elevation: 0,
                        child: Padding(
                          padding: const EdgeInsets.all(28),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text('MANAGER · لوحة التحكم', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12, fontFamily: 'monospace')),
                              const SizedBox(height: 4),
                              const Text('دخول الإدارة', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 4),
                              Text('الحسابات الإدارية التي تم تفعيلها فقط يمكنها الدخول إلى لوحة التحكم.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13, height: 1.55)),
                              if (_employeeAccessBlocked) ...[
                                const SizedBox(height: 24),
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(20), border: Border.all(color: scheme.primary.withValues(alpha: .30))),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Container(width: 44, height: 44, alignment: Alignment.center, decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(12)), child: const Text('🔒', style: TextStyle(fontSize: 20))),
                                        const SizedBox(width: 12),
                                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Text('هذه الواجهة مخصصة للإدارة', style: TextStyle(fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text('يبدو أن بيانات الدخول تخص حساب موظف. لا يمكن استخدام حساب الموظف للدخول إلى لوحة الإدارة، ولن يتم تغيير ارتباط جهاز الموظف.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13, height: 1.55))])),
                                      ]),
                                      const SizedBox(height: 16),
                                      SizedBox(height: 48, child: FilledButton(onPressed: () => context.go('/login'), child: const Text('الانتقال إلى واجهة دخول الموظفين'))),
                                    ],
                                  ),
                                ),
                              ] else ...[
                                const SizedBox(height: 24),
                                Text('اسم المستخدم', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                                const SizedBox(height: 6),
                                TextField(controller: _username, enabled: !_busy, textInputAction: TextInputAction.next, autofillHints: const [AutofillHints.username], onSubmitted: (_) => _passwordFocus.requestFocus(), decoration: _inputDecoration(hint: 'أدخل اسم المستخدم', icon: Icons.person_outline_rounded)),
                                const SizedBox(height: 16),
                                Text('كلمة المرور', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                                const SizedBox(height: 6),
                                TextField(controller: _password, focusNode: _passwordFocus, enabled: !_busy, obscureText: _hidden, textInputAction: TextInputAction.done, autofillHints: const [AutofillHints.password], onSubmitted: (_) => _login(), decoration: _inputDecoration(hint: 'أدخل كلمة المرور', icon: Icons.lock_outline_rounded).copyWith(suffixIcon: IconButton(onPressed: _busy ? null : () => setState(() => _hidden = !_hidden), icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined)))),
                                if (_error != null) ...[const SizedBox(height: 12), _messageBox(_error!, error: true)],
                                const SizedBox(height: 16),
                                SizedBox(height: 48, child: FilledButton(onPressed: _busy ? null : _login, child: _busy ? const SizedBox.square(dimension: 19, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('دخول الإدارة'))),
                              ],
                              const SizedBox(height: 20),
                              const Divider(),
                              const SizedBox(height: 12),
                              TextButton(onPressed: _busy || _recoveryLoading ? null : () => setState(() { _recoveryOpen = !_recoveryOpen; _recoveryError = null; _recoveryMessage = null; }), child: Text(_recoveryOpen ? 'إغلاق استعادة حساب المالك' : 'نسيت كلمة مرور المالك؟')),
                              if (_recoveryOpen) ...[const SizedBox(height: 4), _recoveryForm(context)],
                              const SizedBox(height: 20),
                              Row(children: [Expanded(child: TextButton(onPressed: _busy ? null : _back, child: const Text('← العودة للرئيسية'))), Expanded(child: TextButton(onPressed: _busy ? null : () => context.go('/login'), child: const Text('دخول الموظفين')))]),
                            ],
                          ),
                        ),
                      ),
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
}
