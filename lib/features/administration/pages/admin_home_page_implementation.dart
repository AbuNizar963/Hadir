import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api.dart';
import '../../../core/hadir_brand.dart';
import '../../../core/session.dart';

const _adminBrand = HadirBrand.darkPrimary;
const _adminSoft = HadirBrand.darkSecondary;

class AdminHomePage extends StatefulWidget {
  const AdminHomePage({super.key});
  @override
  State<AdminHomePage> createState() => _AdminHomePageState();
}

class _AdminHomePageState extends State<AdminHomePage> {
  final _session = HadirSession();
  String name = 'الإدارة';
  String role = 'admin';
  bool loading = true;
  String? error;
  int attendanceCount = 0, requestCount = 0, notificationCount = 0, locationCount = 0;
  int employeeCount = 0, presentCount = 0, lateCount = 0, absentCount = 0, restCount = 0, leaveCount = 0;

  @override
  void initState() { super.initState(); _load(); }

  String _todayKey() {
    final now = DateTime.now().toUtc().add(const Duration(hours: 3));
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  Future<void> _load() async {
    if (mounted) setState(() { loading = true; error = null; });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) { if (mounted) context.go('/login'); return; }
      final api = HadirApi(token: token);
      final results = await Future.wait<dynamic>([
        api.me(), api.attendance(limit: 2000), api.requests(), api.notifications(), api.locations(), api.dailyStatus(date: _todayKey()),
      ]);
      final me = Map<String, dynamic>.from(results[0] as Map);
      final user = me['user'];
      final daily = Map<String, dynamic>.from(results[5] as Map);
      final rawEmployees = daily['employees'];
      final employees = rawEmployees is List ? rawEmployees : const <dynamic>[];
      int count(String status) => employees.where((raw) => raw is Map && '${raw['status'] ?? ''}' == status).length;
      if (!mounted) return;
      setState(() {
        name = user is Map ? '${user['name'] ?? 'الإدارة'}' : 'الإدارة';
        role = user is Map ? '${user['role'] ?? 'admin'}' : 'admin';
        attendanceCount = (results[1] as List).length; requestCount = (results[2] as List).length;
        notificationCount = (results[3] as List).length; locationCount = (results[4] as List).length;
        employeeCount = employees.length; presentCount = count('PRESENT'); lateCount = count('LATE');
        absentCount = count('ABSENT'); restCount = count('REST') + count('NOT_STARTED'); leaveCount = count('LEAVE'); loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { error = HadirApi.errorMessage(e); loading = false; });
    }
  }

  Future<void> _logout() async {
    final token = await _session.adminToken();
    await HadirApi(token: token).logout(); await _session.clearAdmin();
    if (!mounted) return; context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final background = Theme.of(context).scaffoldBackgroundColor;
    return Scaffold(
      backgroundColor: background,
      body: RefreshIndicator(
        color: scheme.primary, backgroundColor: scheme.surface, onRefresh: _load,
        child: CustomScrollView(physics: const AlwaysScrollableScrollPhysics(), slivers: [
          SliverAppBar(
            pinned: true, elevation: 0, backgroundColor: background, surfaceTintColor: Colors.transparent,
            automaticallyImplyLeading: false, titleSpacing: 18,
            title: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('لوحة الإدارة', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                Text(name, style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: scheme.onSurface)),
              ])),
              IconButton(onPressed: _logout, tooltip: 'تسجيل الخروج', icon: Icon(Icons.logout_rounded, color: scheme.onSurfaceVariant)),
            ]),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
            sliver: SliverList(delegate: SliverChildListDelegate([
              _overviewCard(),
              if (error != null) ...[const SizedBox(height: 12), _errorCard()],
              const SizedBox(height: 22), Text('حالة الدوام اليوم', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10), _attendanceGrid(),
              const SizedBox(height: 22), Text('نظرة سريعة', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10), _statsGrid(),
              const SizedBox(height: 22), Text('الإدارة', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              _AdminFeature(icon: Icons.groups_rounded, title: 'الموظفون والحسابات', subtitle: 'الموظفون، الأجهزة، المسؤولون والصلاحيات', onTap: () => context.push('/admin/manage')),
              _AdminFeature(icon: Icons.fact_check_rounded, title: 'الحضور والانصراف', subtitle: 'مراجعة السجلات والتحقق من عمليات الحضور', onTap: () => context.push('/admin/manage')),
              _AdminFeature(icon: Icons.event_note_rounded, title: 'الطلبات', subtitle: 'الإجازات والأذونات وطلبات المغادرة', onTap: () => context.push('/admin/manage')),
              _AdminFeature(icon: Icons.location_on_outlined, title: 'المواقع', subtitle: '$locationCount موقعًا مسجلًا في النظام', onTap: () => context.push('/admin/operations')),
              _AdminFeature(icon: Icons.groups_2_rounded, title: 'التحكم بالقوى العاملة', subtitle: 'المناوبات، VIP، والتحضير والانصراف التلقائي', onTap: () => context.push('/admin/operations')),
              _AdminFeature(icon: Icons.notifications_active_outlined, title: 'إشعارات الإدارة', subtitle: '$notificationCount إشعارًا من صندوق الخادم', onTap: () => context.push('/admin/operations')),
              _AdminFeature(icon: Icons.security_rounded, title: 'التدقيق والإعدادات', subtitle: 'العمليات الحساسة وإعدادات النظام', onTap: () => context.push('/admin/manage')),
              const SizedBox(height: 14), Text('حاضر Native', textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11, fontWeight: FontWeight.w600)),
            ])),
          ),
        ]),
      ),
    );
  }

  Widget _overviewCard() => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_adminBrand, Color(0xFF087457)]),
      borderRadius: BorderRadius.circular(24),
      boxShadow: [BoxShadow(blurRadius: 32, offset: const Offset(0, 14), color: _adminBrand.withValues(alpha: .22))],
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(width: 44, height: 44, decoration: BoxDecoration(color: Colors.white.withValues(alpha: .14), borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 25)),
        const Spacer(), Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: Colors.white.withValues(alpha: .12), borderRadius: BorderRadius.circular(20)), child: Text(role, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700))),
      ]),
      const SizedBox(height: 18),
      Text(loading ? 'جارٍ تحديث لوحة الإدارة...' : 'مركز التحكم في حاضر', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
      const SizedBox(height: 7), Text(loading ? 'جارٍ مزامنة حالة الدوام الحالية...' : 'بيانات اليوم: $employeeCount موظفًا · $presentCount حاضر · $lateCount متأخر · $absentCount غائب', style: const TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.45)),
    ]),
  );

  Widget _attendanceGrid() => GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.75, children: [
    _StatusCard(icon: Icons.groups_rounded, title: 'إجمالي الموظفين', value: '$employeeCount', tone: _adminBrand),
    _StatusCard(icon: Icons.check_circle_outline_rounded, title: 'الحضور', value: '$presentCount', tone: HadirBrand.darkPrimary),
    _StatusCard(icon: Icons.schedule_rounded, title: 'المتأخرون', value: '$lateCount', tone: HadirBrand.darkWarning),
    _StatusCard(icon: Icons.person_off_outlined, title: 'الغياب', value: '$absentCount', tone: HadirBrand.darkDanger),
    _StatusCard(icon: Icons.free_breakfast_outlined, title: 'الراحة', value: '$restCount', tone: HadirBrand.darkAccent),
    _StatusCard(icon: Icons.event_available_outlined, title: 'الإجازات', value: '$leaveCount', tone: const Color(0xFF9B72D0)),
  ]);

  Widget _statsGrid() => GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.75, children: [
    _StatCard(icon: Icons.fingerprint_rounded, title: 'سجلات الحضور', value: '$attendanceCount', subtitle: 'آخر البيانات المتاحة'),
    _StatCard(icon: Icons.assignment_rounded, title: 'الطلبات', value: '$requestCount', subtitle: 'طلبات الموظفين'),
    _StatCard(icon: Icons.notifications_none_rounded, title: 'الإشعارات', value: '$notificationCount', subtitle: 'في صندوق الإدارة'),
    _StatCard(icon: Icons.location_on_outlined, title: 'المواقع', value: '$locationCount', subtitle: 'مواقع العمل'),
  ]);

  Widget _errorCard() => Container(
    padding: const EdgeInsets.all(15),
    decoration: BoxDecoration(color: HadirBrand.darkDanger.withValues(alpha: .10), borderRadius: BorderRadius.circular(16), border: Border.all(color: HadirBrand.darkDanger.withValues(alpha: .30))),
    child: Row(children: [const Icon(Icons.cloud_off_rounded, color: HadirBrand.darkDanger), const SizedBox(width: 10), Expanded(child: Text(error!, style: const TextStyle(fontSize: 12))), TextButton(onPressed: _load, child: const Text('إعادة'))]),
  );
}

class _StatusCard extends StatelessWidget {
  final IconData icon; final String title; final String value; final Color tone;
  const _StatusCard({required this.icon, required this.title, required this.value, required this.tone});
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: scheme.surface.withValues(alpha: .80), borderRadius: BorderRadius.circular(16), border: Border.all(color: scheme.outline.withValues(alpha: .70))),
      child: Row(children: [
        Container(width: 42, height: 42, decoration: BoxDecoration(color: tone.withValues(alpha: .09), borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: tone, size: 21)), const SizedBox(width: 11),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)), const SizedBox(height: 2), Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: scheme.onSurface)), Text('اليوم', style: TextStyle(fontSize: 9, color: scheme.onSurfaceVariant))])),
      ]),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon; final String title; final String value; final String subtitle;
  const _StatCard({required this.icon, required this.title, required this.value, required this.subtitle});
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: scheme.surface.withValues(alpha: .80), borderRadius: BorderRadius.circular(16), border: Border.all(color: scheme.outline.withValues(alpha: .70))),
      child: Row(children: [
        Container(width: 42, height: 42, decoration: BoxDecoration(color: _adminSoft.withValues(alpha: .72), borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: scheme.primary, size: 21)), const SizedBox(width: 11),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)), const SizedBox(height: 2), Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: scheme.onSurface)), Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 9, color: scheme.onSurfaceVariant))])),
      ]),
    );
  }
}

class _AdminFeature extends StatelessWidget {
  final IconData icon; final String title; final String subtitle; final VoidCallback onTap;
  const _AdminFeature({required this.icon, required this.title, required this.subtitle, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(color: scheme.surface.withValues(alpha: .80), borderRadius: BorderRadius.circular(16), border: Border.all(color: scheme.outline.withValues(alpha: .70))),
      child: ListTile(onTap: onTap, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), leading: Container(width: 45, height: 45, decoration: BoxDecoration(color: _adminSoft.withValues(alpha: .72), borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: scheme.primary)), title: Text(title, style: TextStyle(fontWeight: FontWeight.w800, color: scheme.onSurface, fontSize: 14)), subtitle: Text(subtitle, style: TextStyle(fontSize: 11.5, color: scheme.onSurfaceVariant)), trailing: Icon(Icons.chevron_left_rounded, color: scheme.onSurfaceVariant)),
    );
  }
}
