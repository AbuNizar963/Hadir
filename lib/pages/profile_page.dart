import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic>? user;
  Map<String, dynamic>? device;
  String? error;
  bool loading = true;
  bool savingPassword = false;
  bool loggingOut = false;
  bool showPassword = false;
  String newPassword = '';
  String confirmPassword = '';
  String message = '';
  String? avatarUrl;
  String? token;
  String lastSync = '';
  bool copied = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    if (mounted) setState(() => loading = true);
    try {
      final nextToken = await HadirSession().token();
      final api = HadirApi(token: nextToken);
      final results = await Future.wait([api.employeeProfile(), api.employeeDeviceStatus()]);
      final nextUser = Map<String, dynamic>.from(results[0]);
      final id = '${nextUser['id'] ?? ''}'.trim();
      if (!mounted) return;
      setState(() {
        user = nextUser;
        device = results[1];
        token = nextToken;
        avatarUrl = id.isEmpty ? null : api.employeeAvatarUrl(id);
        error = null;
        lastSync = TimeOfDay.now().format(context);
      });
    } catch (e) {
      if (mounted) setState(() => error = HadirApi.errorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _savePassword() async {
    setState(() { error = null; message = ''; });
    if (!RegExp(r'^\d{6}$').hasMatch(newPassword)) { setState(() => error = 'كلمة سر الموظف يجب أن تتكون من 6 أرقام بالضبط.'); return; }
    if (newPassword != confirmPassword) { setState(() => error = 'تأكيد كلمة السر غير مطابق.'); return; }
    final id = '${user?['id'] ?? ''}'.trim();
    if (id.isEmpty) { setState(() => error = 'تعذر تحديد الموظف الحالي. يرجى تسجيل الدخول مرة أخرى.'); return; }
    setState(() => savingPassword = true);
    try {
      final authToken = token ?? await HadirSession().token();
      await HadirApi(token: authToken).updateEmployeeProfile({'employeeId': id, 'password': newPassword});
      if (!mounted) return;
      setState(() { newPassword = ''; confirmPassword = ''; showPassword = false; message = 'تم تغيير كلمة السر بنجاح'; });
    } catch (e) {
      if (mounted) setState(() => error = HadirApi.errorMessage(e));
    } finally { if (mounted) setState(() => savingPassword = false); }
  }

  Future<void> _copyJobNumber() async {
    final value = '${user?['jobNumber'] ?? user?['username'] ?? ''}'.trim();
    if (value.isEmpty) return;
    try {
      await Clipboard.setData(ClipboardData(text: value));
      if (!mounted) return;
      setState(() => copied = true);
      Future<void>.delayed(const Duration(milliseconds: 1500), () { if (mounted) setState(() => copied = false); });
    } catch (_) { if (mounted) setState(() => error = 'تعذر نسخ الرقم الوظيفي.'); }
  }

  Future<void> _refresh() async {
    setState(() { error = null; message = ''; });
    await _load();
    if (mounted) setState(() => message = 'تم تحديث بيانات الملف الشخصي.');
  }

  Future<void> _logout() async {
    if (loggingOut) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => Directionality(textDirection: TextDirection.rtl, child: AlertDialog(
        title: const Text('تسجيل الخروج', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('سيتم إنهاء جلسة الموظف على هذا الجهاز. يمكنك تسجيل الدخول مرة أخرى في أي وقت.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('تسجيل الخروج', style: TextStyle(fontWeight: FontWeight.w800))),
        ],
      )),
    );
    if (confirmed != true || !mounted) return;
    setState(() => loggingOut = true);
    await HadirSession().clear();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.rtl,
    child: Scaffold(
      appBar: AppBar(title: const Text('الملف الشخصي'), actions: [IconButton(onPressed: loading ? null : _refresh, tooltip: 'تحديث البيانات', icon: const Icon(Icons.refresh_rounded))]),
      body: loading ? const _ProfileSkeleton() : (error != null && user == null) ? _errorView() : RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 34),
          children: [
            _profileHero(),
            const SizedBox(height: 16),
            _accountCard(),
            const SizedBox(height: 16),
            _securityCard(),
            if (message.isNotEmpty) ...[const SizedBox(height: 12), _notice(message, good: true)],
            if (error != null) ...[const SizedBox(height: 12), _notice(error!, good: false)],
            const SizedBox(height: 16),
            _deviceCard(),
            const SizedBox(height: 16),
            _logoutCard(),
          ],
        ),
      ),
    ),
  );

  Widget _profileHero() {
    final name = '${user?['name'] ?? 'الموظف'}';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusXl), border: Border.all(color: Theme.of(context).dividerColor)),
      child: Row(children: [
        _avatar(),
        const SizedBox(width: 15),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('الملف الشخصي', style: TextStyle(color: HadirBrand.muted, fontSize: 11, fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
          const SizedBox(height: 5),
          const Text('إدارة أمان الحساب ومعلومات الموظف.', style: TextStyle(color: HadirBrand.muted, fontSize: 10.5)),
          const SizedBox(height: 10),
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(10)), child: const Text('♙  موظف', style: TextStyle(color: HadirBrand.primary, fontSize: 10, fontWeight: FontWeight.w800))),
        ])),
      ]),
    );
  }

  Widget _avatar() {
    final headers = token == null || token!.isEmpty ? null : <String, String>{'Authorization': 'Bearer $token'};
    final name = '${user?['name'] ?? 'م'}'.trim();
    final initial = name.isEmpty ? 'م' : name.characters.first;
    return Container(
      width: 88,
      height: 88,
      decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(24), border: Border.all(color: HadirBrand.primary.withValues(alpha: .3), width: 2)),
      clipBehavior: Clip.antiAlias,
      child: avatarUrl == null ? Center(child: Text(initial, style: const TextStyle(color: HadirBrand.primary, fontSize: 30, fontWeight: FontWeight.w900))) : Image.network(avatarUrl!, headers: headers, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Center(child: Text(initial, style: const TextStyle(color: HadirBrand.primary, fontSize: 30, fontWeight: FontWeight.w900)))),
    );
  }

  Widget _accountCard() {
    final name = '${user?['name'] ?? '—'}';
    final job = '${user?['jobNumber'] ?? user?['username'] ?? '—'}';
    final status = '${user?['status'] ?? 'active'}';
    return _sectionCard(
      title: 'بيانات الموظف', eyebrow: 'معلومات الحساب', icon: Icons.badge_outlined,
      child: GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.75, children: [
        _dataCell('الاسم', name),
        InkWell(onTap: _copyJobNumber, borderRadius: BorderRadius.circular(14), child: _dataCell('الرقم الوظيفي', copied ? 'تم النسخ ✓' : job)),
        _dataCell('حالة الحساب', status == 'active' ? '● نشط' : status, valueColor: status == 'active' ? HadirBrand.primary : HadirBrand.warning),
        _dataCell('آخر مزامنة', lastSync.isEmpty ? '—' : lastSync),
      ]),
    );
  }

  Widget _securityCard() => _sectionCard(
    title: 'أمان الحساب', eyebrow: 'الحساب والحماية', icon: Icons.key_rounded,
    child: Column(children: [
      TextField(obscureText: !showPassword, keyboardType: TextInputType.number, maxLength: 6, enabled: !savingPassword, decoration: InputDecoration(labelText: 'كلمة السر الجديدة', hintText: '6 أرقام', counterText: '', prefixIcon: const Icon(Icons.lock_outline_rounded), suffixIcon: IconButton(onPressed: savingPassword ? null : () => setState(() => showPassword = !showPassword), icon: Icon(showPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded))), onChanged: (value) => setState(() => newPassword = value.replaceAll(RegExp(r'\D'), '').clampString(0, 6))),
      const SizedBox(height: 10),
      TextField(obscureText: !showPassword, keyboardType: TextInputType.number, maxLength: 6, enabled: !savingPassword, decoration: const InputDecoration(labelText: 'تأكيد كلمة السر', hintText: '6 أرقام', counterText: '', prefixIcon: Icon(Icons.verified_user_outlined)), onChanged: (value) => setState(() => confirmPassword = value.replaceAll(RegExp(r'\D'), '').clampString(0, 6))),
      const SizedBox(height: 12),
      SizedBox(width: double.infinity, child: FilledButton(onPressed: savingPassword ? null : _savePassword, child: savingPassword ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('حفظ كلمة السر', style: TextStyle(fontWeight: FontWeight.w900)))),
      const SizedBox(height: 12),
      _infoBanner('تُحفظ كلمة السر في الخادم باستخدام PBKDF2 ولا يتم تخزينها كنص مكشوف.'),
    ]),
  );

  Widget _deviceCard() {
    final bound = device?['bound'] == true;
    final label = '${device?['deviceLabel'] ?? 'غير معروف'}';
    final passkeys = '${device?['passkeyCount'] ?? 0}';
    return _sectionCard(title: 'حالة الجهاز', eyebrow: 'الجهاز والتحقق', icon: Icons.phone_android_rounded, child: Column(children: [
      _securityRow(Icons.phone_android_rounded, 'الجهاز', label, _statusBadge(bound ? 'مرتبط' : 'غير مرتبط', bound)),
      const Divider(height: 22),
      _securityRow(Icons.key_rounded, 'مفاتيح الدخول', '$passkeys مفتاح مسجل', null),
      const Divider(height: 22),
      _securityRow(Icons.location_on_outlined, 'الموقع', 'يُتحقق منه أثناء تسجيل الحضور', null),
      const Divider(height: 22),
      _securityRow(Icons.qr_code_2_rounded, 'رمز الحضور', 'يُستخدم لإكمال عملية التحقق', null),
    ]));
  }

  Widget _sectionCard({required String title, required String eyebrow, required IconData icon, required Widget child}) => Container(
    padding: const EdgeInsets.all(17),
    decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusXl), border: Border.all(color: Theme.of(context).dividerColor)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: HadirBrand.primary, size: 20)), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(eyebrow, style: const TextStyle(color: HadirBrand.muted, fontSize: 9.5)), const SizedBox(height: 2), Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900))]))]),
      const SizedBox(height: 15), child,
    ]),
  );

  Widget _dataCell(String label, String value, {Color? valueColor}) => Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Theme.of(context).colorScheme.secondary.withValues(alpha: .25), borderRadius: BorderRadius.circular(14), border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: .5))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(label, style: const TextStyle(color: HadirBrand.muted, fontSize: 9.5)), const SizedBox(height: 5), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: valueColor))]));

  Widget _securityRow(IconData icon, String title, String subtitle, Widget? trailing) => Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: HadirBrand.primary, size: 20)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: HadirBrand.muted, fontSize: 10.5))])), if (trailing != null) trailing]);

  Widget _statusBadge(String text, bool good) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5), decoration: BoxDecoration(color: good ? HadirBrand.soft : HadirBrand.danger.withValues(alpha: .10), borderRadius: BorderRadius.circular(20)), child: Text(text, style: TextStyle(color: good ? HadirBrand.primary : HadirBrand.danger, fontSize: 9, fontWeight: FontWeight.w900)));

  Widget _infoBanner(String text) => Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: HadirBrand.primary.withValues(alpha: .06), border: Border.all(color: HadirBrand.primary.withValues(alpha: .18)), borderRadius: BorderRadius.circular(12)), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('✓', style: TextStyle(color: HadirBrand.primary, fontWeight: FontWeight.w900)), const SizedBox(width: 8), Expanded(child: Text(text, style: const TextStyle(color: HadirBrand.muted, fontSize: 9.5, height: 1.5)))]));

  Widget _notice(String text, {required bool good}) { final color = good ? HadirBrand.primary : HadirBrand.danger; return Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: color.withValues(alpha: .08), border: Border.all(color: color.withValues(alpha: .2)), borderRadius: BorderRadius.circular(13)), child: Text(text, style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w800))); }

  Widget _logoutCard() => Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusLg), border: Border.all(color: HadirBrand.danger.withValues(alpha: .18))), child: Row(children: [Container(width: 44, height: 44, decoration: BoxDecoration(color: HadirBrand.danger.withValues(alpha: .08), borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.logout_rounded, color: HadirBrand.danger)), const SizedBox(width: 12), const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('جلسة الموظف', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900)), SizedBox(height: 3), Text('إنهاء الجلسة على هذا الجهاز بأمان', style: TextStyle(color: HadirBrand.muted, fontSize: 10.5))])), FilledButton.tonal(onPressed: loggingOut ? null : _logout, child: loggingOut ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('خروج', style: TextStyle(fontWeight: FontWeight.w900)))]));

  Widget _errorView() => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [Container(width: 72, height: 72, decoration: BoxDecoration(color: HadirBrand.danger.withValues(alpha: .08), borderRadius: BorderRadius.circular(22)), child: const Icon(Icons.cloud_off_rounded, color: HadirBrand.danger, size: 35)), const SizedBox(height: 14), Text(error ?? 'تعذر تحميل الملف الشخصي.', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 14), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة', style: TextStyle(fontWeight: FontWeight.w800)))])));
}

extension on String {
  String clampString(int start, int maxLength) => substring(start, length.clamp(start, maxLength));
}

class _ProfileSkeleton extends StatelessWidget {
  const _ProfileSkeleton();
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [_SkeletonBlock(height: 150, radius: HadirBrand.radiusXl), const SizedBox(height: 16), _SkeletonBlock(height: 210, radius: HadirBrand.radiusXl), const SizedBox(height: 16), _SkeletonBlock(height: 310, radius: HadirBrand.radiusXl), const SizedBox(height: 16), _SkeletonBlock(height: 210, radius: HadirBrand.radiusXl)]);
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height, required this.radius});
  final double height;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(height: height, decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(radius), border: Border.all(color: Theme.of(context).dividerColor)));
}
