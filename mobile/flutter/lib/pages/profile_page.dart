import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _brandDark = Color(0xFF064B40);
const _soft = Color(0xFFE8F5F0);
const _canvas = Color(0xFFF4F7F6);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF73827E);
const _line = Color(0xFFDCE6E2);

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic>? user;
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
      final data = await api.me();
      final raw = data['user'] is Map ? data['user'] : data;
      final nextUser = Map<String, dynamic>.from(raw as Map);
      final employeeId = '${nextUser['id'] ?? ''}'.trim();
      if (mounted) {
        setState(() {
          user = nextUser;
          _token = token;
          _avatarUrl = employeeId.isEmpty ? null : api.employeeAvatarUrl(employeeId);
          error = null;
        });
      }
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
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: _brand),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('تسجيل الخروج', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
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
        backgroundColor: _canvas,
        appBar: AppBar(
          title: const Text('حسابي', style: TextStyle(fontWeight: FontWeight.w900, color: _ink)),
          backgroundColor: _canvas,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          actions: [IconButton(onPressed: loading ? null : _load, icon: const Icon(Icons.refresh_rounded, color: _ink))],
        ),
        body: loading
            ? const _ProfileSkeleton()
            : error != null
                ? _errorView()
                : RefreshIndicator(
                    color: _brand,
                    onRefresh: _load,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 34),
                      children: [
                        _identityCard(),
                        const SizedBox(height: 16),
                        _sectionHeader('الملف الشخصي', 'بيانات حسابك في HADIR'),
                        const SizedBox(height: 9),
                        _infoGroup([
                          _infoTile(Icons.badge_outlined, 'رقم الموظف', '${user?['username'] ?? user?['jobNumber'] ?? '—'}'),
                          _infoTile(Icons.work_outline_rounded, 'الدور', '${user?['role'] ?? 'موظف'}'),
                        ]),
                        const SizedBox(height: 18),
                        _sectionHeader('الأمان والحماية', 'عناصر التحقق المستخدمة في الحضور'),
                        const SizedBox(height: 9),
                        _securityCard(),
                        const SizedBox(height: 18),
                        _sectionHeader('الجلسة', 'التحكم في جلسة هذا الجهاز'),
                        const SizedBox(height: 9),
                        _logoutCard(),
                        const SizedBox(height: 18),
                        _sectionHeader('مزايا قادمة', 'مساحة جاهزة لتوسعات التطبيق'),
                        const SizedBox(height: 9),
                        _futureCard(Icons.fingerprint_rounded, 'تسجيل الدخول بالبصمة', 'قريباً'),
                        const SizedBox(height: 9),
                        _futureCard(Icons.dark_mode_outlined, 'الوضع الليلي', 'قريباً'),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _identityCard() {
    final name = '${user?['name'] ?? 'الموظف'}';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_brand, _brandDark]),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [BoxShadow(color: Color(0x250B6B5A), blurRadius: 28, offset: Offset(0, 13))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _avatar(),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 5),
                  const Text('حساب الموظف', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
                ]),
              ),
              const Icon(Icons.verified_user_rounded, color: Color(0xFF91E3C6), size: 24),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: .09), borderRadius: BorderRadius.circular(16)),
            child: const Row(children: [Icon(Icons.shield_rounded, color: Color(0xFFB7EBD8), size: 18), SizedBox(width: 9), Expanded(child: Text('الحساب محمي بطبقات تحقق الحضور', style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700)))]),
          ),
        ],
      ),
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
          : Image.network(
              _avatarUrl!,
              headers: headers,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const Icon(Icons.person_rounded, color: Colors.white, size: 35),
            ),
    );
  }

  Widget _sectionHeader(String title, String subtitle) {
    return Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.w900)), const SizedBox(height: 2), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10.5))]))]);
  }

  Widget _infoGroup(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)),
      child: Column(children: [for (var i = 0; i < children.length; i++) ...[children[i], if (i < children.length - 1) const Divider(height: 1, indent: 68, color: _line)]]),
    );
  }

  Widget _infoTile(IconData icon, String title, String value) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
      leading: Container(width: 42, height: 42, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: _brand, size: 21)),
      title: Text(title, style: const TextStyle(color: _muted, fontSize: 10.5, fontWeight: FontWeight.w700)),
      subtitle: Padding(padding: const EdgeInsets.only(top: 2), child: Text(value, style: const TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.w900))),
    );
  }

  Widget _securityCard() {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)),
      child: Column(children: [
        _securityRow(Icons.phone_android_rounded, 'الجهاز', 'مرتبط بحساب الموظف', const _StatusBadge()),
        const Divider(height: 22, color: _line),
        _securityRow(Icons.location_on_outlined, 'الموقع', 'يُتحقق منه أثناء تسجيل الحضور', null),
        const Divider(height: 22, color: _line),
        _securityRow(Icons.qr_code_2_rounded, 'رمز الحضور', 'يُستخدم لإكمال عملية التحقق', null),
      ]),
    );
  }

  Widget _securityRow(IconData icon, String title, String subtitle, Widget? trailing) {
    return Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _brand, size: 20)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: _ink, fontSize: 12, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10.5))])), if (trailing != null) trailing]);
  }

  Widget _logoutCard() {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: const Color(0xFFE8D9D6))),
      child: Row(children: [
        Container(width: 44, height: 44, decoration: BoxDecoration(color: const Color(0xFFFFEFED), borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.logout_rounded, color: Color(0xFFB94A3D))),
        const SizedBox(width: 12),
        const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('جلسة الموظف', style: TextStyle(color: _ink, fontSize: 12.5, fontWeight: FontWeight.w900)), SizedBox(height: 3), Text('إنهاء الجلسة على هذا الجهاز بأمان', style: TextStyle(color: _muted, fontSize: 10.5))])),
        FilledButton.tonal(onPressed: _loggingOut ? null : _logout, child: _loggingOut ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('خروج', style: TextStyle(fontWeight: FontWeight.w900))),
      ]),
    );
  }

  Widget _futureCard(IconData icon, String title, String status) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)),
      child: Row(children: [Container(width: 44, height: 44, decoration: BoxDecoration(color: const Color(0xFFF1F3F2), borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: _muted)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: _ink, fontSize: 12.5, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(status, style: const TextStyle(color: Color(0xFFB97822), fontSize: 10, fontWeight: FontWeight.w800))])), const Icon(Icons.lock_outline_rounded, color: _muted, size: 18)]),
    );
  }

  Widget _errorView() {
    return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [Container(width: 72, height: 72, decoration: BoxDecoration(color: const Color(0xFFFFEFED), borderRadius: BorderRadius.circular(22)), child: const Icon(Icons.cloud_off_rounded, color: Color(0xFFB94A3D), size: 35)), const SizedBox(height: 14), Text(error ?? 'تعذر تحميل الحساب.', textAlign: TextAlign.center, style: const TextStyle(color: _ink, fontWeight: FontWeight.w800)), const SizedBox(height: 14), FilledButton(onPressed: _load, style: FilledButton.styleFrom(backgroundColor: _brand), child: const Text('إعادة المحاولة', style: TextStyle(fontWeight: FontWeight.w800)))])));
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(20)),
      child: const Text('نشط', style: TextStyle(color: _brand, fontSize: 9, fontWeight: FontWeight.w900)),
    );
  }
}

class _ProfileSkeleton extends StatelessWidget {
  const _ProfileSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Container(height: 190, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28))),
        const SizedBox(height: 16),
        Container(height: 116, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22))),
        const SizedBox(height: 16),
        Container(height: 170, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22))),
      ],
    );
  }
}
