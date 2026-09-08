import 'package:flutter/material.dart';
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
  bool _loggingOut = false;
  String? _avatarUrl;
  String? _token;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => loading = true);
    try {
      final token = await HadirSession().token();
      final api = HadirApi(token: token);
      final results = await Future.wait([api.me(), api.employeeDeviceStatus()]);
      final raw = results[0]['user'] is Map ? results[0]['user'] : results[0];
      final nextUser = Map<String, dynamic>.from(raw as Map);
      final employeeId = '${nextUser['id'] ?? ''}'.trim();
      if (!mounted) return;
      setState(() {
        user = nextUser;
        device = results[1];
        _token = token;
        _avatarUrl = employeeId.isEmpty ? null : api.employeeAvatarUrl(employeeId);
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = HadirApi.errorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _logout() async {
    if (_loggingOut) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: const Text('تسجيل الخروج', style: TextStyle(fontWeight: FontWeight.w900)),
          content: const Text('سيتم إنهاء جلسة الموظف على هذا الجهاز. يمكنك تسجيل الدخول مرة أخرى في أي وقت.'),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('إلغاء')),
            FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('تسجيل الخروج', style: TextStyle(fontWeight: FontWeight.w800))),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _loggingOut = true);
    await HadirSession().clear();
    if (!mounted) return;
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('حسابي'),
          actions: [IconButton(onPressed: loading ? null : _load, tooltip: 'تحديث', icon: const Icon(Icons.refresh_rounded))],
        ),
        body: loading
            ? const _ProfileSkeleton()
            : error != null
                ? _errorView()
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 34),
                      children: [
                        _identityCard(),
                        const SizedBox(height: 18),
                        _sectionHeader('الوصول السريع', 'أهم الخدمات من حسابك'),
                        const SizedBox(height: 9),
                        _quickActions(),
                        const SizedBox(height: 18),
                        _sectionHeader('الملف الشخصي', 'بيانات حسابك في حاضر'),
                        const SizedBox(height: 9),
                        _infoGroup([
                          _infoTile(Icons.badge_outlined, 'رقم الموظف', '${user?['username'] ?? user?['jobNumber'] ?? '—'}'),
                          _infoTile(Icons.work_outline_rounded, 'الدور', '${user?['role'] ?? 'موظف'}'),
                        ]),
                        const SizedBox(height: 18),
                        _sectionHeader('الأمان والحماية', 'حالة الجهاز وطبقات التحقق'),
                        const SizedBox(height: 9),
                        _securityCard(),
                        const SizedBox(height: 18),
                        _logoutCard(),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _identityCard() {
    final name = '${user?['name'] ?? 'الموظف'}';
    final bound = device?['bound'] == true;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [HadirBrand.primary, HadirBrand.primaryDark]),
        borderRadius: BorderRadius.circular(HadirBrand.radiusXl),
        boxShadow: const [BoxShadow(color: Color(0x250B6B5A), blurRadius: 28, offset: Offset(0, 13))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          _avatar(),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900)),
            const SizedBox(height: 5),
            const Text('حساب الموظف', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
          ])),
          Icon(bound ? Icons.verified_user_rounded : Icons.warning_amber_rounded, color: bound ? HadirBrand.darkPrimary : const Color(0xFFFFD27A), size: 25),
        ]),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: .09), borderRadius: BorderRadius.circular(HadirBrand.radiusMd)),
          child: Row(children: [
            Icon(bound ? Icons.shield_rounded : Icons.gpp_maybe_rounded, color: bound ? const Color(0xFFB7EBD8) : const Color(0xFFFFD27A), size: 18),
            const SizedBox(width: 9),
            Expanded(child: Text(bound ? 'الجهاز مرتبط والحساب جاهز للتحقق' : 'الجهاز غير مرتبط بالحساب حالياً', style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700))),
          ]),
        ),
      ]),
    );
  }

  Widget _avatar() {
    final headers = _token == null || _token!.isEmpty ? null : <String, String>{'Authorization': 'Bearer $_token'};
    return Container(
      width: 68,
      height: 68,
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: .14), shape: BoxShape.circle, border: Border.all(color: Colors.white.withValues(alpha: .18))),
      clipBehavior: Clip.antiAlias,
      child: _avatarUrl == null
          ? const Icon(Icons.person_rounded, color: Colors.white, size: 35)
          : Image.network(_avatarUrl!, headers: headers, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.person_rounded, color: Colors.white, size: 35)),
    );
  }

  Widget _quickActions() {
    const actions = [
      ('الحضور', 'تسجيل الدخول والخروج', Icons.fact_check_rounded, '/attendance?type=check-in'),
      ('السجل', 'مراجعة أوقات الحضور', Icons.history_rounded, '/history'),
      ('الطلبات', 'الإجازات والطلبات', Icons.assignment_outlined, '/requests'),
      ('الإشعارات', 'آخر التنبيهات', Icons.notifications_none_rounded, '/notifications'),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.75),
      itemCount: actions.length,
      itemBuilder: (_, index) {
        final action = actions[index];
        return InkWell(
          borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
          onTap: () => context.push(action.$4),
          child: Ink(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusMd), border: Border.all(color: Theme.of(context).dividerColor)),
            child: Row(children: [
              Container(width: 40, height: 40, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(HadirBrand.radiusSm)), child: Icon(action.$3, color: HadirBrand.primary, size: 21)),
              const SizedBox(width: 9),
              Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [Text(action.$1, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(action.$2, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9.5, color: HadirBrand.muted))])),
            ]),
          ),
        );
      },
    );
  }

  Widget _sectionHeader(String title, String subtitle) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)), const SizedBox(height: 2), Text(subtitle, style: const TextStyle(color: HadirBrand.muted, fontSize: 10.5))]);

  Widget _infoGroup(List<Widget> children) => Container(decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusLg), border: Border.all(color: Theme.of(context).dividerColor)), child: Column(children: [for (var i = 0; i < children.length; i++) ...[children[i], if (i < children.length - 1) const Divider(height: 1, indent: 68)]]));

  Widget _infoTile(IconData icon, String title, String value) => ListTile(contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5), leading: Container(width: 42, height: 42, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: HadirBrand.primary, size: 21)), title: Text(title, style: const TextStyle(color: HadirBrand.muted, fontSize: 10.5, fontWeight: FontWeight.w700)), subtitle: Padding(padding: const EdgeInsets.only(top: 2), child: Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900))));

  Widget _securityCard() {
    final bound = device?['bound'] == true;
    final passkeys = device?['passkeyCount'];
    final label = '${device?['deviceLabel'] ?? 'غير معروف'}';
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusLg), border: Border.all(color: Theme.of(context).dividerColor)),
      child: Column(children: [
        _securityRow(Icons.phone_android_rounded, 'الجهاز', label, _badge(bound ? 'مرتبط' : 'غير مرتبط', bound)),
        const Divider(height: 22),
        _securityRow(Icons.key_rounded, 'مفاتيح الدخول', '${passkeys ?? 0} مفتاح مسجل', null),
        const Divider(height: 22),
        _securityRow(Icons.location_on_outlined, 'الموقع', 'يُتحقق منه أثناء تسجيل الحضور', null),
        const Divider(height: 22),
        _securityRow(Icons.qr_code_2_rounded, 'رمز الحضور', 'يُستخدم لإكمال عملية التحقق', null),
      ]),
    );
  }

  Widget _securityRow(IconData icon, String title, String subtitle, Widget? trailing) => Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: HadirBrand.primary, size: 20)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: HadirBrand.muted, fontSize: 10.5))])), if (trailing != null) trailing]);

  Widget _badge(String text, bool good) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5), decoration: BoxDecoration(color: good ? HadirBrand.soft : const Color(0xFFFFEFED), borderRadius: BorderRadius.circular(20)), child: Text(text, style: TextStyle(color: good ? HadirBrand.primary : HadirBrand.danger, fontSize: 9, fontWeight: FontWeight.w900)));

  Widget _logoutCard() => Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusLg), border: Border.all(color: const Color(0xFFE8D9D6))), child: Row(children: [Container(width: 44, height: 44, decoration: BoxDecoration(color: const Color(0xFFFFEFED), borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.logout_rounded, color: HadirBrand.danger)), const SizedBox(width: 12), const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('جلسة الموظف', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900)), SizedBox(height: 3), Text('إنهاء الجلسة على هذا الجهاز بأمان', style: TextStyle(color: HadirBrand.muted, fontSize: 10.5))])), FilledButton.tonal(onPressed: _loggingOut ? null : _logout, child: _loggingOut ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('خروج', style: TextStyle(fontWeight: FontWeight.w900)))]));

  Widget _errorView() => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [Container(width: 72, height: 72, decoration: BoxDecoration(color: const Color(0xFFFFEFED), borderRadius: BorderRadius.circular(22)), child: const Icon(Icons.cloud_off_rounded, color: HadirBrand.danger, size: 35)), const SizedBox(height: 14), Text(error ?? 'تعذر تحميل الحساب.', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 14), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة', style: TextStyle(fontWeight: FontWeight.w800)))]));
}

class _ProfileSkeleton extends StatelessWidget {
  const _ProfileSkeleton();
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [Container(height: 190, decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusXl))), const SizedBox(height: 16), Container(height: 130, decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusLg))), const SizedBox(height: 16), Container(height: 190, decoration: BoxDecoration(color: Theme.of(context).cardColor, borderRadius: BorderRadius.circular(HadirBrand.radiusLg)))]);
}
