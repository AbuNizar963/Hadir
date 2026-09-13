import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

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
  List<Map<String, dynamic>> _attendance = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _requests = <Map<String, dynamic>>[];
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  static const _tabs = <({String title, String subtitle, IconData icon})>[
    (title: 'البطاقة', subtitle: 'بطاقتك الرقمية وQR', icon: Icons.badge_outlined),
    (title: 'نظرة عامة', subtitle: 'ملخص العمل والالتزام', icon: Icons.insights_outlined),
    (title: 'التقويم', subtitle: 'أيام الحضور والانصراف', icon: Icons.calendar_month_outlined),
    (title: 'النشاط', subtitle: 'الخط الزمني للعمليات', icon: Icons.timeline_rounded),
    (title: 'الدوام', subtitle: 'المناوبة وأوقات العمل', icon: Icons.schedule_outlined),
    (title: 'الطلبات', subtitle: 'الإجازات والاستئذانات', icon: Icons.list_alt_outlined),
    (title: 'الأمان', subtitle: 'الحساب والجهاز الموثق', icon: Icons.security_outlined),
  ];

  Map<String, dynamic> _map(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  List<Map<String, dynamic>> _maps(dynamic value) {
    if (value is! List) return <Map<String, dynamic>>[];
    return value.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.token();
      if (token == null || token.isEmpty) throw StateError('انتهت جلسة الموظف.');
      final api = HadirApi(token: token);
      final results = await Future.wait<dynamic>([api.employeeProfile(), api.attendance(limit: 2000), api.requests()]);
      final profile = _map(results.isNotEmpty ? results[0] : null);
      final nested = _map(profile['employee']);
      final employee = nested.isNotEmpty ? nested : profile;
      final employeeId = '${employee['id'] ?? employee['employeeId'] ?? ''}';
      final attendance = _maps(results.length > 1 ? results[1] : null).where((row) => '${row['employeeId'] ?? ''}' == employeeId).toList();
      final requests = _maps(results.length > 2 ? results[2] : null).where((row) => '${row['employeeId'] ?? ''}' == employeeId).toList();
      if (!mounted) return;
      setState(() { _employee = employee; _attendance = attendance; _requests = requests; _loading = false; });
    } catch (error) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(error); });
    }
  }

  DateTime? _timestamp(Map<String, dynamic> row) => DateTime.tryParse('${row['timestamp'] ?? ''}')?.toLocal();

  bool _isIn(Map<String, dynamic> row) {
    final type = '${row['type'] ?? ''}'.toLowerCase();
    return type == 'check-in' || type == 'in';
  }

  List<Map<String, dynamic>> _forDay(DateTime day) {
    return _attendance.where((row) {
      final value = _timestamp(row);
      return value != null && value.year == day.year && value.month == day.month && value.day == day.day;
    }).toList()..sort((a, b) => (_timestamp(a) ?? DateTime(0)).compareTo(_timestamp(b) ?? DateTime(0)));
  }

  String _clock(DateTime? value) => value == null ? '—' : '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';

  String _date(DateTime value) => '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

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
          children: [_header(context), const SizedBox(height: 12), _tabBar(context), const SizedBox(height: 12), if (_loading) const _LoadingCard() else if (_error != null) _ErrorCard(message: _error!, onRetry: _load) else _content(context)],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return _card(context, child: Row(children: [
      Container(width: 52, height: 52, decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(16)), child: Icon(Icons.workspace_premium_outlined, color: scheme.onPrimaryContainer, size: 28)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('مركز ميزات الموظف', style: TextStyle(color: scheme.onSurface, fontSize: 20, fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text('${_employee['name'] ?? 'الموظف'}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11))])),
      IconButton(onPressed: _load, tooltip: 'تحديث', icon: const Icon(Icons.refresh_rounded)),
    ]));
  }

  Widget _tabBar(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(height: 104, child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: _tabs.length,
      separatorBuilder: (_, __) => const SizedBox(width: 8),
      itemBuilder: (_, index) {
        final tab = _tabs[index];
        final active = index == _tab;
        return InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => setState(() => _tab = index),
          child: Container(width: 150, padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: active ? scheme.primaryContainer : scheme.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: active ? scheme.primary.withValues(alpha: .35) : scheme.outlineVariant)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(tab.icon, color: active ? scheme.onPrimaryContainer : scheme.onSurfaceVariant, size: 22), const Spacer(), Text(tab.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: active ? scheme.onPrimaryContainer : scheme.onSurface, fontWeight: FontWeight.w900, fontSize: 11)), const SizedBox(height: 2), Text(tab.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: active ? scheme.onPrimaryContainer : scheme.onSurfaceVariant, fontSize: 8.5))])));
      },
    ));
  }

  Widget _content(BuildContext context) {
    switch (_tab) {
      case 0: return _digitalCard(context);
      case 1: return _overview(context);
      case 2: return _calendar(context);
      case 3: return _timeline(context);
      case 4: return _schedule(context);
      case 5: return _requestsView(context);
      default: return _security(context);
    }
  }

  Widget _digitalCard(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final id = '${_employee['id'] ?? _employee['employeeId'] ?? ''}';
    final qr = '${Uri.base.origin}/employee/verify/${Uri.encodeComponent(id)}';
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _title(context, 'بطاقتي الرقمية', Icons.badge_outlined),
      const SizedBox(height: 16),
      _infoRow(context, 'الاسم', '${_employee['name'] ?? '—'}'),
      _infoRow(context, 'الرقم الوظيفي', '${_employee['jobNumber'] ?? '—'}'),
      _infoRow(context, 'القسم', '${_employee['department'] ?? _employee['role'] ?? 'موظف'}'),
      _infoRow(context, 'الحالة', '${_employee['status'] ?? '—'}'),
      _infoRow(context, 'نوع الدوام', '${_employee['scheduleType'] ?? 'ADMIN'}'),
      if (id.isNotEmpty) ...[
        const SizedBox(height: 12),
        Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: scheme.primaryContainer.withValues(alpha: .35), borderRadius: BorderRadius.circular(18)), child: Column(children: [QrImageView(data: qr, size: 180, eyeStyle: QrEyeStyle(eyeShape: QrEyeShape.square, color: scheme.onSurface), dataModuleStyle: QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: scheme.onSurface)), const SizedBox(height: 6), Text('رمز تحقق بطاقة الموظف', style: TextStyle(color: scheme.onSurface, fontSize: 11, fontWeight: FontWeight.w800))])),
      ],
      const SizedBox(height: 12),
      FilledButton.icon(onPressed: () => context.push('/employee/profile'), icon: const Icon(Icons.person_outline), label: const Text('فتح الملف الشخصي')),
    ]));
  }

  Widget _overview(BuildContext context) {
    final days = <String>{for (final row in _attendance) '${_timestamp(row)?.year}-${_timestamp(row)?.month}-${_timestamp(row)?.day}'}.where((v) => v != 'null-null-null').length;
    final ins = _attendance.where(_isIn).length;
    final outs = _attendance.where((row) => !_isIn(row)).length;
    final completed = _attendance.where(_isIn).where((row) { final t = _timestamp(row); if (t == null) return false; return _forDay(t).any((other) => !_isIn(other) && (_timestamp(other)?.isAfter(t) ?? false)); }).length;
    final completion = ins == 0 ? 0 : ((completed / ins) * 100).round().clamp(0, 100);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [Expanded(child: _metric(context, 'أيام النشاط', '$days')), const SizedBox(width: 8), Expanded(child: _metric(context, 'الحضور', '$ins')), const SizedBox(width: 8), Expanded(child: _metric(context, 'الانصراف', '$outs'))]),
      const SizedBox(height: 10),
      _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _title(context, 'ملخص الالتزام', Icons.trending_up_rounded), const SizedBox(height: 12), Text('$completion%', style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text('نسبة أيام الحضور التي اكتملت بانصراف مسجل.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 10)), const SizedBox(height: 14), const Text('آخر النشاطات', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)), const SizedBox(height: 8), ..._attendance.reversed.take(6).map((row) => _activityTile(context, row)), if (_attendance.isEmpty) const _EmptyCard(message: 'لا توجد سجلات حضور حتى الآن.'),
      ])),
    ]);
  }

  Widget _calendar(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final count = DateTime(_month.year, _month.month + 1, 0).day;
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [IconButton(onPressed: () => setState(() => _month = DateTime(_month.year, _month.month - 1)), icon: const Icon(Icons.chevron_right)), Expanded(child: Center(child: Text('${_month.year}/${_month.month.toString().padLeft(2, '0')}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)))), IconButton(onPressed: () => setState(() => _month = DateTime(_month.year, _month.month + 1)), icon: const Icon(Icons.chevron_left))]),
      const SizedBox(height: 8),
      GridView.builder(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, mainAxisSpacing: 5, crossAxisSpacing: 5, childAspectRatio: 1), itemCount: count, itemBuilder: (_, index) {
        final day = DateTime(_month.year, _month.month, index + 1);
        final rows = _forDay(day);
        final hasIn = rows.any(_isIn);
        final hasOut = rows.any((row) => !_isIn(row));
        return Container(decoration: BoxDecoration(color: hasIn ? scheme.primaryContainer.withValues(alpha: .55) : scheme.surfaceContainerHighest.withValues(alpha: .25), borderRadius: BorderRadius.circular(9), border: Border.all(color: scheme.outlineVariant)), padding: const EdgeInsets.all(4), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Text('${day.day}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)), const SizedBox(height: 2), Row(mainAxisAlignment: MainAxisAlignment.center, children: [if (hasIn) Icon(Icons.login_rounded, size: 9, color: scheme.primary), if (hasOut) Icon(Icons.logout_rounded, size: 9, color: scheme.secondary)])]));
      }),
      const SizedBox(height: 12),
      Text('التقويم مبني على سجلات الحضور الفعلية المرتبطة بحساب الموظف.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10)),
    ]));
  }

  Widget _timeline(BuildContext context) {
    final sorted = [..._attendance]..sort((a, b) => (_timestamp(b) ?? DateTime(0)).compareTo(_timestamp(a) ?? DateTime(0)));
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_title(context, 'الخط الزمني لنشاطي', Icons.timeline_rounded), const SizedBox(height: 14), if (sorted.isEmpty) const _EmptyCard(message: 'لا توجد سجلات حضور حتى الآن.') else ...sorted.take(50).map((row) => _activityTile(context, row))]));
  }

  Widget _activityTile(BuildContext context, Map<String, dynamic> row) {
    final scheme = Theme.of(context).colorScheme;
    final isIn = _isIn(row);
    final time = _timestamp(row);
    return Padding(padding: const EdgeInsets.only(bottom: 8), child: Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(border: Border.all(color: scheme.outlineVariant), borderRadius: BorderRadius.circular(14)), child: Row(children: [Icon(isIn ? Icons.login_rounded : Icons.logout_rounded, color: isIn ? scheme.primary : scheme.secondary), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(isIn ? 'تسجيل حضور' : 'تسجيل انصراف', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11)), const SizedBox(height: 3), Text('${time == null ? '—' : _date(time)} · ${_clock(time)}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9))])), if ('${row['status'] ?? ''}'.isNotEmpty) Text('${row['status']}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9))])));
  }

  Widget _schedule(BuildContext context) {
    final rotation = '${_employee['scheduleType'] ?? ''}'.toUpperCase() == 'ROTATION';
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_title(context, 'مناوباتي', Icons.calendar_month_outlined), const SizedBox(height: 14), Row(children: [Expanded(child: _metric(context, 'نوع الجدول', rotation ? 'تناوبي' : 'اعتيادي')), const SizedBox(width: 8), Expanded(child: _metric(context, 'أيام العمل', '${_employee['rotationDaysOn'] ?? '—'}')), const SizedBox(width: 8), Expanded(child: _metric(context, 'أيام الراحة', '${_employee['rotationDaysOff'] ?? '—'}'))]), const SizedBox(height: 10), _infoRow(context, 'بداية الدوام', '${_employee['workStartTime'] ?? _employee['rotationStartTime'] ?? '—'}'), _infoRow(context, 'نهاية الدوام', '${_employee['workEndTime'] ?? _employee['rotationEndTime'] ?? '—'}'), _infoRow(context, 'أيام العمل الأسبوعية', '${_employee['workDays'] ?? '—'}')]));
  }

  Widget _requestsView(BuildContext context) {
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [Expanded(child: _title(context, 'طلباتي', Icons.list_alt_outlined)), OutlinedButton.icon(onPressed: () => context.push('/employee/requests'), icon: const Icon(Icons.add, size: 17), label: const Text('طلب جديد'))]),
      const SizedBox(height: 12),
      if (_requests.isEmpty) const _EmptyCard(message: 'لا توجد طلبات مرتبطة بحسابك.') else ..._requests.take(30).map((row) { final type = '${row['type'] ?? row['requestType'] ?? 'طلب'}'; final status = '${row['status'] ?? 'قيد المراجعة'}'; return Padding(padding: const EdgeInsets.only(bottom: 8), child: ListTile(contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant)), leading: const Icon(Icons.assignment_outlined), title: Text(type, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)), subtitle: Text('${row['reason'] ?? row['description'] ?? '—'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9)), trailing: Text(status, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800)))); }),
    ]));
  }

  Widget _security(BuildContext context) => _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_title(context, 'أمان حسابي', Icons.security_outlined), const SizedBox(height: 14), _infoRow(context, 'حالة الحساب', '${_employee['status'] ?? '—'}'), _infoRow(context, 'الرقم الوظيفي', '${_employee['jobNumber'] ?? '—'}'), _infoRow(context, 'الطلبات', '${_requests.length} طلب'), _infoRow(context, 'الجهاز', 'الجهاز الموثق في منظومة Hadir'), const SizedBox(height: 8), OutlinedButton.icon(onPressed: () => context.push('/employee/profile'), icon: const Icon(Icons.manage_accounts_outlined), label: const Text('إدارة الملف والحساب'))]));

  Widget _title(BuildContext context, String text, IconData icon) => Row(children: [Icon(icon, color: Theme.of(context).colorScheme.primary), const SizedBox(width: 8), Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900))]);

  Widget _infoRow(BuildContext context, String label, String value) => Padding(padding: const EdgeInsets.only(bottom: 9), child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(border: Border.all(color: Theme.of(context).colorScheme.outlineVariant), borderRadius: BorderRadius.circular(13)), child: Row(children: [Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 10)), const Spacer(), Flexible(child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)))])));

  Widget _metric(BuildContext context, String label, String value) => Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .5), borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 9)), const SizedBox(height: 3), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900))]));

  Widget _card(BuildContext context, {required Widget child}) => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: Theme.of(context).colorScheme.outlineVariant)), child: child);
}

class _LoadingCard extends StatelessWidget { const _LoadingCard(); @override Widget build(BuildContext context) => const SizedBox(height: 220, child: Center(child: CircularProgressIndicator())); }
class _EmptyCard extends StatelessWidget { const _EmptyCard({required this.message}); final String message; @override Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(vertical: 30), child: Center(child: Text(message, style: const TextStyle(fontSize: 11)))); }
class _ErrorCard extends StatelessWidget { const _ErrorCard({required this.message, required this.onRetry}); final String message; final Future<void> Function() onRetry; @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: Theme.of(context).colorScheme.error.withValues(alpha: .35))), child: Column(children: [Text(message, textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 11)), const SizedBox(height: 10), OutlinedButton.icon(onPressed: () => onRetry(), icon: const Icon(Icons.refresh_rounded), label: const Text('إعادة المحاولة'))])); }
