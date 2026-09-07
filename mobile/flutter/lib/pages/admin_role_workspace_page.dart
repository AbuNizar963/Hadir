import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _ink = Color(0xFF17322C);
const _muted = Color(0xFF70817B);
const _surface = Color(0xFFFFFFFF);
const _soft = Color(0xFFEAF4F0);

class AdminRoleWorkspacePage extends StatefulWidget {
  const AdminRoleWorkspacePage({super.key});

  @override
  State<AdminRoleWorkspacePage> createState() => _AdminRoleWorkspacePageState();
}

class _AdminRoleWorkspacePageState extends State<AdminRoleWorkspacePage> {
  final _session = HadirSession();
  bool _loading = true;
  String? _error;
  String _name = 'الإدارة';
  String _role = 'admin';
  List<dynamic> _employees = [];
  List<dynamic> _requests = [];
  List<dynamic> _violations = [];
  Map<String, dynamic> _live = {};
  Map<String, dynamic> _daily = {};

  bool get _isOwner => _role == 'owner';
  bool get _isManager => _role == 'manager';
  bool get _isSupervisor => _role == 'supervisor';
  String get _roleLabel => switch (_role) {
        'owner' => 'المالك',
        'manager' => 'المدير',
        'supervisor' => 'المشرف',
        _ => 'الإدارة',
      };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) {
        if (mounted) context.go('/admin-login');
        return;
      }
      final api = HadirApi(token: token);
      final me = await api.me();
      final user = me['user'];
      final role = user is Map ? '${user['role'] ?? 'admin'}'.toLowerCase() : 'admin';
      final results = await Future.wait<dynamic>([
        api.workforceLive(),
        api.dailyStatus(date: _today()),
        api.requests(),
        if (!_isSupervisor || role == 'supervisor') api.violations(limit: 100),
        api.attendance(limit: 2000),
      ]);
      if (!mounted) return;
      setState(() {
        _name = user is Map ? '${user['name'] ?? 'الإدارة'}' : 'الإدارة';
        _role = role;
        _live = results[0] is Map ? Map<String, dynamic>.from(results[0] as Map) : {};
        _daily = results[1] is Map ? Map<String, dynamic>.from(results[1] as Map) : {};
        _requests = results[2] is List ? List<dynamic>.from(results[2] as List) : [];
        _violations = results[3] is List ? List<dynamic>.from(results[3] as List) : [];
        _employees = results.length > 4 && results[4] is List ? List<dynamic>.from(results[4] as List) : [];
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(error);
      });
    }
  }

  String _today() {
    final now = DateTime.now();
    String two(int value) => value.toString().padLeft(2, '0');
    return '${now.year}-${two(now.month)}-${two(now.day)}';
  }

  int _number(Map<String, dynamic> map, List<String> keys) {
    for (final key in keys) {
      final value = map[key];
      if (value is num) return value.toInt();
      final parsed = int.tryParse('$value');
      if (parsed != null) return parsed;
    }
    return 0;
  }

  int get _pendingRequests => _requests.where((raw) => raw is Map && '${raw['status'] ?? ''}' == 'pending').length;
  int get _openViolations => _violations.where((raw) => raw is Map && '${raw['status'] ?? 'open'}' != 'resolved').length;
  int get _present => _number(_live, ['present', 'presentCount', 'checkedIn', 'active']);
  int get _late => _number(_daily, ['late', 'lateCount', 'lateEmployees']);
  int get _absent => _number(_daily, ['absent', 'absentCount']);

  Future<void> _logout() async {
    final token = await _session.adminToken();
    await HadirApi(token: token).logout();
    await _session.clearAdmin();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF7F9F8),
        body: RefreshIndicator(
          onRefresh: _load,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverAppBar(
                pinned: true,
                elevation: 0,
                backgroundColor: const Color(0xFFF7F9F8),
                surfaceTintColor: Colors.transparent,
                titleSpacing: 18,
                title: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_roleLabel, style: const TextStyle(fontSize: 12, color: _muted)),
                    Text(_name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink)),
                  ])),
                  IconButton(onPressed: _logout, tooltip: 'تسجيل الخروج', icon: const Icon(Icons.logout_rounded)),
                ]),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
                sliver: SliverList(delegate: SliverChildListDelegate([
                  _hero(),
                  if (_error != null) ...[const SizedBox(height: 12), _errorCard()],
                  const SizedBox(height: 22),
                  _sectionTitle('ملخص اليوم', 'بيانات حية من نظام حاضر'),
                  const SizedBox(height: 10),
                  _stats(),
                  const SizedBox(height: 22),
                  _sectionTitle('مساحة العمل', 'أدوات $_roleLabel'),
                  const SizedBox(height: 10),
                  ..._features(),
                  const SizedBox(height: 22),
                  if (_isOwner) ...[
                    _sectionTitle('المالك', 'إدارة شاملة وصلاحيات عليا'),
                    const SizedBox(height: 10),
                    _ownerPanel(),
                    const SizedBox(height: 22),
                  ],
                  if (_isManager) ...[
                    _sectionTitle('المدير', 'التشغيل واتخاذ القرار'),
                    const SizedBox(height: 10),
                    _managerPanel(),
                    const SizedBox(height: 22),
                  ],
                  if (_isSupervisor) ...[
                    _sectionTitle('المشرف', 'المتابعة اليومية للفريق'),
                    const SizedBox(height: 10),
                    _supervisorPanel(),
                    const SizedBox(height: 22),
                  ],
                  _recentRequests(),
                ])),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero() => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_brand, Color(0xFF064B40)]),
          borderRadius: BorderRadius.circular(28),
          boxShadow: const [BoxShadow(color: Color(0x220B6B5A), blurRadius: 26, offset: Offset(0, 12))],
        ),
        child: Row(children: [
          Container(width: 54, height: 54, decoration: BoxDecoration(color: Colors.white.withValues(alpha: .14), borderRadius: BorderRadius.circular(17)), child: const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 30)),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_loading ? 'جارٍ تحديث مساحة العمل...' : 'مركز $_roleLabel في حاضر', style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900)),
            const SizedBox(height: 5),
            Text(_roleDescription(), style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.45)),
          ])),
        ]),
      );

  String _roleDescription() {
    if (_isOwner) return 'تحكم كامل في المؤسسة والحسابات والتقارير والإعدادات.';
    if (_isManager) return 'إدارة التشغيل والموظفين والطلبات والتقارير اليومية.';
    if (_isSupervisor) return 'متابعة الفريق والحضور والغيابات والملاحظات التشغيلية.';
    return 'أدوات الإدارة المتاحة لهذا الحساب.';
  }

  Widget _sectionTitle(String title, String subtitle) => Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: _ink)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(fontSize: 11, color: _muted))]))]);

  Widget _stats() => GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.7,
        children: [
          _Stat(icon: Icons.groups_rounded, title: 'الموظفون', value: '${_employees.length}'),
          _Stat(icon: Icons.how_to_reg_rounded, title: 'حاضرون الآن', value: '$_present'),
          _Stat(icon: Icons.pending_actions_rounded, title: 'طلبات معلقة', value: '$_pendingRequests'),
          _Stat(icon: Icons.warning_amber_rounded, title: 'مخالفات مفتوحة', value: '$_openViolations'),
          _Stat(icon: Icons.schedule_rounded, title: 'متأخرون', value: '$_late'),
          _Stat(icon: Icons.person_off_rounded, title: 'غائبون', value: '$_absent'),
        ],
      );

  List<Widget> _features() {
    final features = <Widget>[
      _Feature(icon: Icons.groups_rounded, title: 'الموظفون والحسابات', subtitle: 'إدارة الموظفين وإعادة ربط الأجهزة والحسابات', onTap: () => context.push('/admin/manage')),
      _Feature(icon: Icons.fingerprint_rounded, title: 'الحضور والانصراف', subtitle: 'مراجعة العمليات والسجل اليومي', onTap: () => context.push('/admin/manage')),
      _Feature(icon: Icons.assignment_rounded, title: 'الطلبات', subtitle: 'مراجعة الطلبات واتخاذ الإجراء المناسب', onTap: () => context.push('/admin/manage')),
      _Feature(icon: Icons.assessment_rounded, title: 'التقارير', subtitle: 'تقارير الحضور المهنية والأرشيف', onTap: () => context.push('/admin/reports')),
      _Feature(icon: Icons.location_on_outlined, title: 'المواقع والقوى العاملة', subtitle: 'المواقع والحالة الحية للقوى العاملة', onTap: () => context.push('/admin/operations')),
    ];
    if (_isOwner || _isManager) {
      features.add(_Feature(icon: Icons.admin_panel_settings_outlined, title: 'الحسابات والصلاحيات', subtitle: _isOwner ? 'المديرون والمشرفون وإدارة النظام' : 'المستخدمون الإداريون المتاحون', onTap: () => context.push('/admin/manage')));
    }
    if (_isOwner) {
      features.add(_Feature(icon: Icons.security_rounded, title: 'التدقيق والإعدادات', subtitle: 'السجل الإداري والإعدادات الحساسة', onTap: () => context.push('/admin/manage')));
      features.add(_Feature(icon: Icons.archive_rounded, title: 'أرشيف التقارير', subtitle: 'التقارير المحفوظة والتنزيل والحذف', onTap: () => context.push('/admin/reports/archive')));
    }
    return features;
  }

  Widget _ownerPanel() => _Panel(children: [
        _MiniAction(icon: Icons.verified_user_rounded, title: 'صلاحيات المالك', subtitle: 'صلاحية عليا لإدارة المؤسسة بالكامل.'),
        _MiniAction(icon: Icons.manage_accounts_rounded, title: 'إدارة الإدارة', subtitle: 'إضافة ومتابعة المديرين والمشرفين.'),
        _MiniAction(icon: Icons.policy_outlined, title: 'الرقابة والتدقيق', subtitle: 'الوصول إلى سجل العمليات الحساسة.'),
      ]);

  Widget _managerPanel() => _Panel(children: [
        _MiniAction(icon: Icons.today_rounded, title: 'مؤشرات التشغيل', subtitle: 'الحضور والغياب والتأخير وطلبات الفريق.'),
        _MiniAction(icon: Icons.fact_check_rounded, title: 'اعتماد الطلبات', subtitle: 'مراجعة الطلبات المعلقة من مساحة الإدارة.'),
        _MiniAction(icon: Icons.bar_chart_rounded, title: 'التقارير المهنية', subtitle: 'تحليل الحضور واستخراج التقارير.'),
      ]);

  Widget _supervisorPanel() => _Panel(children: [
        _MiniAction(icon: Icons.groups_2_rounded, title: 'الفريق الآن', subtitle: 'متابعة حالة القوى العاملة في الوقت الحقيقي.'),
        _MiniAction(icon: Icons.schedule_rounded, title: 'التأخير والغياب', subtitle: 'مؤشرات اليوم للمشرف والفريق.'),
        _MiniAction(icon: Icons.report_problem_outlined, title: 'المخالفات', subtitle: 'متابعة الحالات التشغيلية المفتوحة.'),
      ]);

  Widget _recentRequests() {
    final pending = _requests.where((raw) => raw is Map && '${raw['status'] ?? ''}' == 'pending').take(5).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _sectionTitle('آخر الطلبات', '${pending.length} طلب يحتاج المتابعة'),
      const SizedBox(height: 10),
      if (pending.isEmpty)
        const _EmptyCard(text: 'لا توجد طلبات معلقة حاليًا.')
      else
        ...pending.map((raw) {
          final item = Map<String, dynamic>.from(raw as Map);
          return Card(margin: const EdgeInsets.only(bottom: 8), child: ListTile(leading: const Icon(Icons.pending_actions_rounded, color: _brand), title: Text('${item['type'] ?? 'طلب'}', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${item['employeeName'] ?? item['employeeId'] ?? 'موظف'} · ${item['reason'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis), trailing: const Icon(Icons.chevron_left_rounded)));
        }),
    ]);
  }

  Widget _errorCard() => Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xFFFFF4F2), borderRadius: BorderRadius.circular(18)), child: Row(children: [const Icon(Icons.cloud_off_rounded, color: Color(0xFFB94A3D)), const SizedBox(width: 9), Expanded(child: Text(_error!, style: const TextStyle(color: Color(0xFF8D332C), fontSize: 12))), TextButton(onPressed: _load, child: const Text('إعادة'))]));
}

class _Stat extends StatelessWidget {
  final IconData icon; final String title; final String value;
  const _Stat({required this.icon, required this.title, required this.value});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E9E6))), child: Row(children: [Container(width: 42, height: 42, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: _brand, size: 21)), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10.5, color: _muted)), const SizedBox(height: 2), Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink))]))]));
}

class _Feature extends StatelessWidget {
  final IconData icon; final String title; final String subtitle; final VoidCallback onTap;
  const _Feature({required this.icon, required this.title, required this.subtitle, required this.onTap});
  @override
  Widget build(BuildContext context) => Card(margin: const EdgeInsets.only(bottom: 9), child: ListTile(onTap: onTap, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), leading: Container(width: 45, height: 45, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: _brand)), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: _ink, fontSize: 14)), subtitle: Text(subtitle, style: const TextStyle(fontSize: 11.5)), trailing: const Icon(Icons.chevron_left_rounded, color: _muted)));
}

class _Panel extends StatelessWidget {
  final List<Widget> children;
  const _Panel({required this.children});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(22), border: Border.all(color: const Color(0xFFE2E9E6))), child: Column(children: children));
}

class _MiniAction extends StatelessWidget {
  final IconData icon; final String title; final String subtitle;
  const _MiniAction({required this.icon, required this.title, required this.subtitle});
  @override
  Widget build(BuildContext context) => ListTile(leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _brand, size: 20)), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: _ink, fontSize: 13)), subtitle: Text(subtitle, style: const TextStyle(fontSize: 11, color: _muted)));
}

class _EmptyCard extends StatelessWidget {
  final String text;
  const _EmptyCard({required this.text});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE2E9E6))), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [const Icon(Icons.inbox_outlined, color: _muted), const SizedBox(width: 8), Text(text, style: const TextStyle(color: _muted, fontSize: 12))]));
}
