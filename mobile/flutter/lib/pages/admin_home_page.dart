import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';

const _adminBrand = Color(0xFF0B6B5A);
const _adminInk = Color(0xFF17322C);
const _adminMuted = Color(0xFF70817B);

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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final token = await _session.adminToken();
      final me = await HadirApi(token: token).me();
      final user = me['user'];
      if (user is Map && mounted) {
        setState(() {
          name = '${user['name'] ?? 'الإدارة'}';
          role = '${user['role'] ?? 'admin'}';
        });
      }
    } catch (_) {
      final token = await _session.adminToken();
      if (!mounted) return;
      if (token == null) {
        context.go('/login');
        return;
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _logout() async {
    final token = await _session.adminToken();
    await HadirApi(token: token).logout();
    await _session.clearAdmin();
    if (!mounted) return;
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('لوحة الإدارة', style: TextStyle(fontWeight: FontWeight.w800, color: _adminInk)),
        actions: [
          IconButton(onPressed: _logout, tooltip: 'تسجيل الخروج', icon: const Icon(Icons.logout_rounded)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: _adminBrand,
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [BoxShadow(blurRadius: 22, offset: Offset(0, 10))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 34),
                  const SizedBox(height: 14),
                  Text(
                    loading ? 'جارٍ تحميل الحساب...' : 'مرحبًا، $name',
                    style: const TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 5),
                  Text('صلاحية الحساب: $role', style: TextStyle(color: Colors.white.withValues(alpha: .82))),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text('إدارة حاضر', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: _adminInk)),
            const SizedBox(height: 10),
            _AdminFeature(icon: Icons.groups_rounded, title: 'الموظفون', subtitle: 'إضافة وتعديل وحذف الموظفين وإعادة ربط الأجهزة', onTap: () => context.push('/admin/manage')),
            _AdminFeature(icon: Icons.fact_check_rounded, title: 'الحضور والانصراف', subtitle: 'تقارير ومراجعة عمليات التحضير والانصراف', onTap: () => context.push('/admin/manage')),
            _AdminFeature(icon: Icons.event_note_rounded, title: 'الطلبات', subtitle: 'مراجعة الإجازات والأذونات والموافقة أو الرفض', onTap: () => context.push('/admin/manage')),
            _AdminFeature(icon: Icons.security_rounded, title: 'سجل التدقيق', subtitle: 'متابعة العمليات الحساسة وأحداث النظام', onTap: () => context.push('/admin/manage')),
            _AdminFeature(icon: Icons.admin_panel_settings_rounded, title: 'حسابات الإدارة', subtitle: 'إدارة المدراء والمشرفين والصلاحيات', onTap: () => context.push('/admin/manage')),
            _AdminFeature(icon: Icons.settings_rounded, title: 'إعدادات النظام', subtitle: 'عرض إعدادات المؤسسة ومكونات نظام حاضر', onTap: () => context.push('/admin/manage')),
            const SizedBox(height: 18),
            const Text('تم تسجيل الدخول بحساب إداري مستقل عن حساب الموظف.', textAlign: TextAlign.center, style: TextStyle(color: _adminMuted, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _AdminFeature extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _AdminFeature({required this.icon, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFEAF4F0),
          foregroundColor: _adminBrand,
          child: Icon(icon),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: _adminInk)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_left_rounded),
      ),
    );
  }
}
