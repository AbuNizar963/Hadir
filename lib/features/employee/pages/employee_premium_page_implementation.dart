import 'package:flutter/material.dart';

import '../../../core/api.dart';
import '../../../core/session.dart';

class EmployeePremiumPage extends StatefulWidget {
  const EmployeePremiumPage({super.key});

  @override
  State<EmployeePremiumPage> createState() => _EmployeePremiumPageState();
}

class _EmployeePremiumPageState extends State<EmployeePremiumPage> {
  final _session = HadirSession();
  int _tab = 0;
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _employee = <String, dynamic>{};
  List<dynamic> _attendance = const [];
  List<dynamic> _requests = const [];

  static const _tabs = <({String title, String subtitle, IconData icon})>[
    (title: 'بطاقتي الرقمية', subtitle: 'بيانات الموظف والتحقق', icon: Icons.badge_outlined),
    (title: 'نشاطي', subtitle: 'الخط الزمني للحضور', icon: Icons.timeline_rounded),
    (title: 'مناوباتي', subtitle: 'الدورة والمناوبة القادمة', icon: Icons.calendar_month_outlined),
    (title: 'أدائي', subtitle: 'الحضور والتأخير والعمل', icon: Icons.insights_outlined),
    (title: 'أمان حسابي', subtitle: 'حالة الحساب والطلبات', icon: Icons.security_outlined),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.token();
      final api = HadirApi(token: token);
      final results = await Future.wait<dynamic>([
        api.employeeProfile(),
        api.attendance(limit: 2000),
        api.requests(),
      ]);
      final profile = results[0] is Map ? Map<String, dynamic>.from(results[0] as Map) : <String, dynamic>{};
      final rawEmployee = profile['employee'];
      final employee = rawEmployee is Map ? Map<String, dynamic>.from(rawEmployee) : profile;
      final employeeId = '${employee['id'] ?? employee['employeeId'] ?? ''}';
      final attendance = results[1] is List ? List<dynamic>.from(results[1] as List).where((row) => row is Map && '${row['employeeId'] ?? ''}' == employeeId).toList() : <dynamic>[];
      final requests = results[2] is List ? List<dynamic>.from(results[2] as List).where((row) => row is Map && '${row['employeeId'] ?? ''}' == employeeId).toList() : <dynamic>[];
      if (!mounted) return;
      setState(() { _employee = employee; _attendance = attendance; _requests = requests; _loading = false; });
    } catch (error) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(error); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: RefreshIndicator(
        color: scheme.primary,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
          children: [
            _header(context),
            const SizedBox(height: 12),
            _tabBar(context),
            const SizedBox(height: 12),
            if (_loading) const _LoadingCard() else if (_error != null) _ErrorCard(message: _error!, onRetry: _load) else _content(context),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final name = '${_employee['name'] ?? 'الموظف'}';
    return _card(context, child: Row(children: [
      Container(width: 52, height: 52, decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(16)), child: Icon(Icons.workspace_premium_outlined, color: scheme.onPrimaryContainer, size: 28)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('مركز ميزات الموظف', style: TextStyle(color: scheme.onSurface, fontSize: 20, fontWeight: FontWeight.w900)),
        const SizedBox(height: 4),
        Text(name, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11)),
      ])),
    ]));
  }

  Widget _tabBar(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: 104,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _tabs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          final tab = _tabs[index];
          final active = index == _tab;
          return InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => setState(() => _tab = index),
            child: Container(
              width: 150,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: active ? scheme.primaryContainer : scheme.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: active ? scheme.primary.withValues(alpha: .35) : scheme.outlineVariant)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(tab.icon, color: active ? scheme.onPrimaryContainer : scheme.onSurfaceVariant, size: 22),
                const Spacer(),
                Text(tab.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: active ? scheme.onPrimaryContainer : scheme.onSurface, fontWeight: FontWeight.w900, fontSize: 11)),
                const SizedBox(height: 2),
                Text(tab.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: active ? scheme.onPrimaryContainer : scheme.onSurfaceVariant, fontSize: 8.5)),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _content(BuildContext context) {
    switch (_tab) {
      case 0: return _digitalCard(context);
      case 1: return _timeline(context);
      case 2: return _schedule(context);
      case 3: return _performance(context);
      default: return _security(context);
    }
  }

  Widget _digitalCard(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _title(context, 'بطاقتي الرقمية', Icons.badge_outlined),
      const SizedBox(height: 16),
      _infoRow(context, 'الاسم', '${_employee['name'] ?? '—'}'),
      _infoRow(context, 'الرقم الوظيفي', '${_employee['jobNumber'] ?? '—'}'),
      _infoRow(context, 'القسم', '${_employee['department'] ?? _employee['role'] ?? 'موظف'}'),
      _infoRow(context, 'الحالة', '${_employee['status'] ?? '—'}'),
      _infoRow(context, 'نوع الدوام', '${_employee['scheduleType'] ?? 'ADMIN'}'),
      const SizedBox(height: 12),
      Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: scheme.primaryContainer.withValues(alpha: .35), borderRadius: BorderRadius.circular(16)), child: Row(children: [Icon(Icons.qr_code_2_rounded, color: scheme.primary, size: 42), const SizedBox(width: 12), Expanded(child: Text('تُستخدم هوية الموظف الرقمية للتحقق داخل منظومة Hadir.', style: TextStyle(color: scheme.onSurface, fontSize: 11, height: 1.5, fontWeight: FontWeight.w700)))])),
    ]));
  }

  Widget _timeline(BuildContext context) {
    final sorted = _attendance.whereType<Map>().toList()..sort((a, b) => '${b['timestamp']}'.compareTo('${a['timestamp']}'));
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _title(context, 'الخط الزمني لنشاطي', Icons.timeline_rounded),
      const SizedBox(height: 14),
      if (sorted.isEmpty) const _EmptyCard(message: 'لا توجد سجلات حضور حتى الآن.') else ...sorted.take(40).map((row) {
        final type = '${row['type'] ?? ''}';
        final isIn = type == 'check-in' || type == 'in';
        return Padding(padding: const EdgeInsets.only(bottom: 9), child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(border: Border.all(color: Theme.of(context).colorScheme.outlineVariant), borderRadius: BorderRadius.circular(14)), child: Row(children: [
          Icon(isIn ? Icons.south_rounded : Icons.north_rounded, color: isIn ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.secondary),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(isIn ? 'تسجيل حضور' : 'تسجيل انصراف', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11)), const SizedBox(height: 3), Text('${row['timestamp'] ?? '—'}', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 9))])),
        ])));
      }),
    ]));
  }

  Widget _schedule(BuildContext context) {
    final rotation = '${_employee['scheduleType'] ?? ''}'.toUpperCase() == 'ROTATION';
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _title(context, 'مناوباتي', Icons.calendar_month_outlined),
      const SizedBox(height: 14),
      Row(children: [
        Expanded(child: _metric(context, 'نوع الجدول', rotation ? 'تناوبي' : 'اعتيادي')),
        const SizedBox(width: 8),
        Expanded(child: _metric(context, 'أيام العمل', '${_employee['rotationDaysOn'] ?? '—'}')),
        const SizedBox(width: 8),
        Expanded(child: _metric(context, 'أيام الراحة', '${_employee['rotationDaysOff'] ?? '—'}')),
      ]),
      const SizedBox(height: 10),
      _infoRow(context, 'بداية الدوام', '${_employee['workStartTime'] ?? _employee['rotationStartTime'] ?? '—'}'),
      _infoRow(context, 'نهاية الدوام', '${_employee['workEndTime'] ?? _employee['rotationEndTime'] ?? '—'}'),
    ]));
  }

  Widget _performance(BuildContext context) {
    final rows = _attendance.whereType<Map>().toList();
    final days = <String>{for (final row in rows) '${row['timestamp']}'.split('T').first}.length;
    final checkIns = rows.where((r) => '${r['type']}' == 'check-in' || '${r['type']}' == 'in').length;
    final checkOuts = rows.where((r) => '${r['type']}' == 'check-out' || '${r['type']}' == 'out').length;
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _title(context, 'أدائي وإحصائياتي', Icons.insights_outlined),
      const SizedBox(height: 14),
      Row(children: [
        Expanded(child: _metric(context, 'أيام النشاط', '$days')),
        const SizedBox(width: 8), Expanded(child: _metric(context, 'الحضور', '$checkIns')),
        const SizedBox(width: 8), Expanded(child: _metric(context, 'الانصراف', '$checkOuts')),
      ]),
      const SizedBox(height: 12),
      Text('هذه الإحصاءات مبنية على سجلات الحضور الفعلية المرتبطة بحساب الموظف.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 10)),
    ]));
  }

  Widget _security(BuildContext context) => _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    _title(context, 'أمان حسابي', Icons.security_outlined),
    const SizedBox(height: 14),
    _infoRow(context, 'حالة الحساب', '${_employee['status'] ?? '—'}'),
    _infoRow(context, 'الرقم الوظيفي', '${_employee['jobNumber'] ?? '—'}'),
    _infoRow(context, 'الطلبات', '${_requests.length} طلب'),
    _infoRow(context, 'الجهاز', 'يُدار من إعدادات الجهاز الموثق في Hadir'),
  ]));

  Widget _title(BuildContext context, String text, IconData icon) => Row(children: [Icon(icon, color: Theme.of(context).colorScheme.primary), const SizedBox(width: 8), Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900))]);

  Widget _infoRow(BuildContext context, String label, String value) => Padding(padding: const EdgeInsets.only(bottom: 9), child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(border: Border.all(color: Theme.of(context).colorScheme.outlineVariant), borderRadius: BorderRadius.circular(13)), child: Row(children: [Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 10)), const Spacer(), Flexible(child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)))])));

  Widget _metric(BuildContext context, String label, String value) => Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .5), borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 9)), const SizedBox(height: 3), Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900))]));

  Widget _card(BuildContext context, {required Widget child}) => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: Theme.of(context).colorScheme.outlineVariant)), child: child);
}

class _LoadingCard extends StatelessWidget { const _LoadingCard(); @override Widget build(BuildContext context) => const SizedBox(height: 220, child: Center(child: CircularProgressIndicator())); }
class _EmptyCard extends StatelessWidget { const _EmptyCard({required this.message}); final String message; @override Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(vertical: 30), child: Center(child: Text(message, style: const TextStyle(fontSize: 11)))); }
class _ErrorCard extends StatelessWidget { const _ErrorCard({required this.message, required this.onRetry}); final String message; final Future<void> Function() onRetry; @override Widget build(BuildContext context) => _ErrorBody(message: message, onRetry: onRetry); }
class _ErrorBody extends StatelessWidget { const _ErrorBody({required this.message, required this.onRetry}); final String message; final Future<void> Function() onRetry; @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: Theme.of(context).colorScheme.error.withValues(alpha: .35))), child: Column(children: [Text(message, textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 11)), const SizedBox(height: 10), OutlinedButton.icon(onPressed: () => onRetry(), icon: const Icon(Icons.refresh_rounded), label: const Text('إعادة المحاولة'))])); }
