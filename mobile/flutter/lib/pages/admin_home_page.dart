import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';

const _adminBrand = Color(0xFF0B6B5A);
const _adminInk = Color(0xFF17322C);
const _adminMuted = Color(0xFF70817B);
const _adminSurface = Color(0xFFFFFFFF);
const _adminSoft = Color(0xFFEAF4F0);

class AdminHomePage extends StatefulWidget {
  const AdminHomePage({super.key});
  @override State<AdminHomePage> createState() => _AdminHomePageState();
}

class _AdminHomePageState extends State<AdminHomePage> {
  final _session = HadirSession();
  String name = 'الإدارة';
  String role = 'admin';
  bool loading = true;
  String? error;
  int attendanceCount = 0;
  int requestCount = 0;
  int notificationCount = 0;
  int locationCount = 0;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) { if (mounted) context.go('/login'); return; }
      final api = HadirApi(token: token);
      final results = await Future.wait<dynamic>([api.me(), api.attendance(limit: 2000), api.requests(), api.notifications(), api.locations()]);
      final me = Map<String, dynamic>.from(results[0] as Map);
      final user = me['user'];
      if (!mounted) return;
      setState(() {
        name = user is Map ? '${user['name'] ?? 'الإدارة'}' : 'الإدارة';
        role = user is Map ? '${user['role'] ?? 'admin'}' : 'admin';
        attendanceCount = (results[1] as List).length;
        requestCount = (results[2] as List).length;
        notificationCount = (results[3] as List).length;
        locationCount = (results[4] as List).length;
        loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { error = HadirApi.errorMessage(e); loading = false; });
    }
  }

  Future<void> _logout() async {
    final token = await _session.adminToken();
    await HadirApi(token: token).logout();
    await _session.clearAdmin();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF7F9F8),
    body: RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverAppBar(pinned: true, elevation: 0, backgroundColor: const Color(0xFFF7F9F8), surfaceTintColor: Colors.transparent, automaticallyImplyLeading: false, titleSpacing: 18, title: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('لوحة الإدارة', style: TextStyle(fontSize: 12, color: _adminMuted)), Text(name, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: _adminInk))])), IconButton(onPressed: _logout, tooltip: 'تسجيل الخروج', icon: const Icon(Icons.logout_rounded))])),
          SliverPadding(padding: const EdgeInsets.fromLTRB(18, 8, 18, 28), sliver: SliverList(delegate: SliverChildListDelegate([
            _overviewCard(),
            if (error != null) ...[const SizedBox(height: 12), _errorCard()],
            const SizedBox(height: 22), const Text('نظرة سريعة', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: _adminInk)), const SizedBox(height: 10), _statsGrid(),
            const SizedBox(height: 22), const Text('الإدارة', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: _adminInk)), const SizedBox(height: 10),
            _AdminFeature(icon: Icons.groups_rounded, title: 'الموظفون والحسابات', subtitle: 'الموظفون، الأجهزة، المسؤولون والصلاحيات', onTap: () => context.push('/admin/manage')),
            _AdminFeature(icon: Icons.fact_check_rounded, title: 'الحضور والانصراف', subtitle: 'مراجعة السجلات والتحقق من عمليات الحضور', onTap: () => context.push('/admin/manage')),
            _AdminFeature(icon: Icons.analytics_rounded, title: 'التقارير العالمية', subtitle: 'الحضور، الساعات، الاستثناءات والتتبع التفصيلي', onTap: () => context.push('/admin/reports')),
            _AdminFeature(icon: Icons.event_note_rounded, title: 'الطلبات', subtitle: 'الإجازات والأذونات وطلبات المغادرة', onTap: () => context.push('/admin/manage')),
            _AdminFeature(icon: Icons.location_on_outlined, title: 'المواقع', subtitle: '$locationCount موقعًا مسجلًا في النظام', onTap: () => context.push('/admin/operations')),
            _AdminFeature(icon: Icons.groups_2_rounded, title: 'التحكم بالقوى العاملة', subtitle: 'المناوبات، VIP، والتحضير والانصراف التلقائي', onTap: () => context.push('/admin/operations')),
            _AdminFeature(icon: Icons.notifications_active_outlined, title: 'إشعارات الإدارة', subtitle: '$notificationCount إشعارًا من صندوق الخادم', onTap: () => context.push('/admin/operations')),
            _AdminFeature(icon: Icons.security_rounded, title: 'التدقيق والإعدادات', subtitle: 'العمليات الحساسة وإعدادات النظام', onTap: () => context.push('/admin/manage')),
            const SizedBox(height: 14), const Text('حاضر Native', textAlign: TextAlign.center, style: TextStyle(color: _adminMuted, fontSize: 11, fontWeight: FontWeight.w600)),
          ]))),
        ],
      ),
    ),
  );

  Widget _overviewCard() => Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_adminBrand, Color(0xFF084F44)]), borderRadius: BorderRadius.circular(27), boxShadow: const [BoxShadow(blurRadius: 25, offset: Offset(0, 12), color: Color(0x220B6B5A))]), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Container(width: 44, height: 44, decoration: BoxDecoration(color: Colors.white.withValues(alpha: .14), borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 25)), const Spacer(), Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: Colors.white.withValues(alpha: .12), borderRadius: BorderRadius.circular(20)), child: Text(role, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)))]), const SizedBox(height: 18), Text(loading ? 'جارٍ تحديث لوحة الإدارة...' : 'مركز التحكم في حاضر', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)), const SizedBox(height: 7), const Text('كل أدوات الإدارة الأساسية في مكان واحد، مع بيانات مباشرة من خادم حاضر.', style: TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.45))]));
  Widget _statsGrid() => GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.75, children: [_StatCard(icon: Icons.fingerprint_rounded, title: 'سجلات الحضور', value: '$attendanceCount', subtitle: 'آخر البيانات المتاحة'), _StatCard(icon: Icons.assignment_rounded, title: 'الطلبات', value: '$requestCount', subtitle: 'طلبات الموظفين'), _StatCard(icon: Icons.notifications_none_rounded, title: 'الإشعارات', value: '$notificationCount', subtitle: 'في صندوق الإدارة'), _StatCard(icon: Icons.location_on_outlined, title: 'المواقع', value: '$locationCount', subtitle: 'مواقع العمل')]);
  Widget _errorCard() => Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: const Color(0xFFFFF4F2), borderRadius: BorderRadius.circular(18)), child: Row(children: [const Icon(Icons.cloud_off_rounded, color: Color(0xFFB94A3D)), const SizedBox(width: 10), Expanded(child: Text(error!, style: const TextStyle(color: Color(0xFF8D332C), fontSize: 12))), TextButton(onPressed: _load, child: const Text('إعادة'))]));
}

class _StatCard extends StatelessWidget { final IconData icon; final String title; final String value; final String subtitle; const _StatCard({required this.icon, required this.title, required this.value, required this.subtitle}); @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: _adminSurface, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E9E6))), child: Row(children: [Container(width: 42, height: 42, decoration: BoxDecoration(color: _adminSoft, borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: _adminBrand, size: 21)), const SizedBox(width: 11), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: _adminMuted)), const SizedBox(height: 2), Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: _adminInk)), Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9, color: _adminMuted))]))])); }
class _AdminFeature extends StatelessWidget { final IconData icon; final String title; final String subtitle; final VoidCallback onTap; const _AdminFeature({required this.icon, required this.title, required this.subtitle, required this.onTap}); @override Widget build(BuildContext context) => Container(margin: const EdgeInsets.only(bottom: 10), decoration: BoxDecoration(color: _adminSurface, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E9E6))), child: ListTile(onTap: onTap, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), leading: Container(width: 45, height: 45, decoration: BoxDecoration(color: _adminSoft, borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: _adminBrand)), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: _adminInk, fontSize: 14)), subtitle: Text(subtitle, style: const TextStyle(fontSize: 11.5)), trailing: const Icon(Icons.chevron_left_rounded, color: _adminMuted)));
}
