import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;

import '../../../core/api.dart';
import '../../../core/session.dart';

class HadirWorkspacePage extends StatefulWidget {
  const HadirWorkspacePage({super.key});

  @override
  State<HadirWorkspacePage> createState() => _HadirWorkspacePageState();
}

class _HadirWorkspacePageState extends State<HadirWorkspacePage> {
  final _session = HadirSession();
  Timer? _ticker;
  bool _loading = true;
  String? _error;
  DateTime _now = DateTime.now();
  String? _sessionToken;
  Map<String, dynamic> _employee = <String, dynamic>{};
  List<dynamic> _attendance = const [];
  List<dynamic> _requests = const [];
  List<dynamic> _locations = const [];
  List<dynamic> _escapeEvents = const [];
  Map<String, dynamic> _device = <String, dynamic>{};

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
    _load();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.token();
      final api = HadirApi(token: token);
      final profileFuture = api.employeeProfile();
      final meFuture = api.me();
      final attendanceFuture = api.attendance(limit: 2000);
      final requestsFuture = api.requests();
      final locationsFuture = api.locations();
      final deviceFuture = api.employeeDeviceStatus();
      final profile = await profileFuture;
      final me = await meFuture;
      final employee = _employeeMap(profile, me);
      final id = '${employee['id'] ?? employee['employeeId'] ?? ''}'.trim();
      final results = await Future.wait<dynamic>([
        attendanceFuture,
        requestsFuture,
        locationsFuture,
        deviceFuture,
        api.escapeEvents(employeeId: id.isEmpty ? null : id, limit: 20),
      ]);
      if (!mounted) return;
      setState(() {
        _sessionToken = token;
        _employee = employee;
        _attendance = results[0] as List<dynamic>;
        _requests = results[1] as List<dynamic>;
        _locations = results[2] as List<dynamic>;
        _device = results[3] is Map ? Map<String, dynamic>.from(results[3] as Map) : <String, dynamic>{};
        _escapeEvents = results[4] as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(e); });
    }
  }

  Map<String, dynamic> _employeeMap(Map<String, dynamic> profile, Map<String, dynamic> me) {
    final p = profile['employee'];
    if (p is Map) return Map<String, dynamic>.from(p);
    final user = me['user'];
    if (user is Map) return Map<String, dynamic>.from(user);
    return profile;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        color: scheme.surface,
        child: RefreshIndicator(
          color: scheme.primary,
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
            children: [
              _hero(context),
              const SizedBox(height: 12),
              _actions(context),
              const SizedBox(height: 12),
              _summary(context),
              const SizedBox(height: 12),
              _workInfo(context),
              const SizedBox(height: 12),
              _requestBanner(context),
              if (_loading) ...[
                const SizedBox(height: 12),
                const _LoadingCard(),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                _messageCard(context, _error!, Icons.cloud_off_rounded),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final name = '${_employee['name'] ?? 'الموظف'}';
    final job = '${_employee['jobNumber'] ?? ''}'.trim();
    final location = _locationName();
    final avatar = _avatarUrl();
    return _card(
      context,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _avatar(context, avatar, name, size: 56),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('مرحبًا بك', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11)),
                    const SizedBox(height: 2),
                    Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurface, fontSize: 17, fontWeight: FontWeight.w900, height: 1.25)),
                    const SizedBox(height: 4),
                    Text([if (job.isNotEmpty) job, location].join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10)),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(intl.DateFormat('HH:mm').format(_now), style: TextStyle(color: scheme.onSurface, fontSize: 18, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text(intl.DateFormat('EEEE، d MMMM', 'ar').format(_now), style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          _statusCard(context),
        ],
      ),
    );
  }

  Widget _statusCard(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final schedule = _schedule();
    final today = _todayAttendance();
    final open = _openSession(today);
    final approved = _todayApprovedRequests();
    final escape = _activeEscape();
    final leave = approved.any((r) => _requestType(r) == 'leave');
    final permission = approved.any((r) => _requestType(r) == 'permission');
    final checkedIn = today.any((r) => _type(r) == 'check-in');
    final status = _status(schedule, open, checkedIn, escape, leave, permission);
    final detail = _statusDetail(status);
    final countdown = _countdown(schedule);
    final late = _lateMinutes(schedule, checkedIn);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('حالة اليوم', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(status, style: TextStyle(color: scheme.onSurface, fontSize: 22, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text(detail, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10.5, height: 1.45)),
              ]),
            ),
            _statusIcon(context, status),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(color: scheme.secondaryContainer.withValues(alpha: .42), borderRadius: BorderRadius.circular(14)),
          child: Column(children: [
            _detailRow(context, Icons.calendar_month_outlined, 'الدوام', _scheduleLabel(schedule)),
            const SizedBox(height: 8),
            _detailRow(context, Icons.access_time_rounded, 'الفترة', _periodLabel(schedule)),
            const SizedBox(height: 8),
            _detailRow(context, Icons.location_on_outlined, 'الموقع', _locationName()),
          ]),
        ),
        if (countdown.isNotEmpty) ...[
          const SizedBox(height: 10),
          _pill(context, Icons.timer_outlined, countdown),
        ],
        if (late > 0) ...[
          const SizedBox(height: 10),
          _warning(context, 'تأخر بمقدار ${_minutesLabel(late)} عن بداية الفترة.'),
        ],
      ],
    );
  }

  Widget _actions(BuildContext context) {
    final schedule = _schedule();
    final today = _todayAttendance();
    final open = _openSession(today);
    final approved = _todayApprovedRequests();
    final escape = _activeEscape();
    final hasLeave = approved.any((r) => _requestType(r) == 'leave');
    final hasPermission = approved.any((r) => _requestType(r) == 'permission');
    final canIn = schedule['isWorkDay'] == true && open == null && !today.any((r) => _type(r) == 'check-in') && !hasLeave && !hasPermission && escape == null;
    final canOut = open != null;
    final checkInSubtitle = schedule['isWorkDay'] != true ? 'أنت في الراحة' : open != null ? 'الدوام جارٍ' : canIn ? 'مسح رمز QR' : 'غير متاح الآن';
    final checkOutSubtitle = open != null ? 'إنهاء الدوام الآن' : today.any((r) => _type(r) == 'check-out') ? 'تم تسجيل الانصراف' : 'بعد تسجيل الحضور';
    return Row(
      children: [
        Expanded(child: _action(context, '↓', 'تسجيل حضور', checkInSubtitle, canIn, () => context.push('/employee/scan/check-in'))),
        const SizedBox(width: 12),
        Expanded(child: _action(context, '↑', 'تسجيل انصراف', checkOutSubtitle, canOut, () => context.push('/employee/scan/check-out'), accent: true)),
      ],
    );
  }

  Widget _action(BuildContext context, String glyph, String title, String subtitle, bool enabled, VoidCallback onTap, {bool accent = false}) {
    final scheme = Theme.of(context).colorScheme;
    final tint = accent ? scheme.secondary : scheme.primary;
    return Material(
      color: scheme.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          constraints: const BoxConstraints(minHeight: 86),
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: enabled ? tint.withValues(alpha: .35) : scheme.outlineVariant.withValues(alpha: .72))),
          child: Row(children: [
            Container(width: 40, height: 40, decoration: BoxDecoration(color: tint.withValues(alpha: enabled ? .12 : .055), borderRadius: BorderRadius.circular(12)), child: Center(child: Text(glyph, style: TextStyle(color: enabled ? tint : scheme.onSurfaceVariant, fontSize: 23, fontWeight: FontWeight.w900, height: 1)))),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(title, style: TextStyle(color: enabled ? scheme.onSurface : scheme.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5))])),
          ]),
        ),
      ),
    );
  }

  Widget _summary(BuildContext context) {
    final today = _todayAttendance();
    final checkIn = _event(today, 'check-in');
    final checkOut = _event(today, 'check-out');
    return _section(context, 'ملخص اليوم', 'سجل الدوام', Row(children: [
      Expanded(child: _stat(context, 'الحضور', _time(checkIn), Icons.arrow_downward_rounded)),
      const SizedBox(width: 8),
      Expanded(child: _stat(context, 'الانصراف', _time(checkOut), Icons.arrow_upward_rounded)),
      const SizedBox(width: 8),
      Expanded(child: _stat(context, 'مدة العمل', _workDuration(today), Icons.schedule_rounded)),
    ]));
  }

  Widget _workInfo(BuildContext context) {
    final schedule = _schedule();
    final today = _todayAttendance();
    final approved = _todayApprovedRequests();
    final status = _status(schedule, _openSession(today), today.any((r) => _type(r) == 'check-in'), _activeEscape(), approved.any((r) => _requestType(r) == 'leave'), approved.any((r) => _requestType(r) == 'permission'));
    final type = '${_employee['scheduleType'] ?? 'ADMIN'}'.toUpperCase();
    return _section(context, 'معلومات الدوام', 'حالتك الحالية', Column(children: [
      _info(context, Icons.calendar_today_outlined, 'الفترة', _periodLabel(schedule)),
      _info(context, Icons.schedule_rounded, type == 'ROTATION' ? 'وقت المناوبة' : 'الفترة', _scheduleLabel(schedule) == 'مناوبة تناوبية' ? _rotationDurationLabel() : _periodLabel(schedule)),
      _info(context, Icons.verified_outlined, 'الحالة', status),
      _info(context, Icons.location_on_outlined, 'الموقع', _locationName()),
      _info(context, Icons.devices_other_rounded, 'الجهاز', _deviceLabel()),
    ]));
  }

  Widget _requestBanner(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.primary.withValues(alpha: .10),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: _showRequestDialog,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: scheme.primary.withValues(alpha: .20))),
          child: Row(children: [
            Container(width: 42, height: 42, decoration: BoxDecoration(color: scheme.surface, borderRadius: BorderRadius.circular(12)), child: Icon(Icons.event_note_outlined, color: scheme.primary)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('طلب استئذان أو إجازة', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w900, fontSize: 12)), const SizedBox(height: 3), Text('إرسال طلب للإدارة', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5))])),
            Icon(Icons.chevron_left_rounded, color: scheme.primary),
          ]),
        ),
      ),
    );
  }

  Future<void> _showRequestDialog() async {
    String type = 'permission';
    String reason = '';
    DateTime start = DateTime(_now.year, _now.month, _now.day);
    DateTime end = start;
    final controller = TextEditingController();
    var sent = false;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(builder: (context, setDialogState) {
        final isCheckout = type == 'checkout';
        final startLabel = type == 'leave' ? 'تاريخ بداية الإجازة' : 'تاريخ بداية الإذن';
        final endLabel = type == 'leave' ? 'تاريخ نهاية الإجازة' : 'تاريخ نهاية الإذن';
        return AlertDialog(
          title: const Text('طلب جديد'),
          content: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('الإدارة', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontSize: 11, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(initialValue: type, decoration: const InputDecoration(labelText: 'نوع الطلب'), items: const [DropdownMenuItem(value: 'permission', child: Text('استئذان')), DropdownMenuItem(value: 'leave', child: Text('إجازة')), DropdownMenuItem(value: 'checkout', child: Text('انصراف مبكر'))], onChanged: (v) => setDialogState(() { type = v ?? 'permission'; if (type == 'checkout') end = start; })),
            if (!isCheckout) ...[
              const SizedBox(height: 12),
              _dateField(context, startLabel, start, (v) => setDialogState(() { start = v; if (end.isBefore(start)) end = start; })),
              const SizedBox(height: 10),
              _dateField(context, endLabel, end, (v) => setDialogState(() { end = v; })),
            ] else ...[
              const SizedBox(height: 12),
              Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Theme.of(context).colorScheme.secondaryContainer.withValues(alpha: .45), borderRadius: BorderRadius.circular(12)), child: const Text('الانصراف المبكر مرتبط بيوم الدوام الحالي ولا يحتاج إلى فترة متعددة الأيام.', style: TextStyle(fontSize: 11))),
            ],
            const SizedBox(height: 12),
            TextField(controller: controller, maxLines: 4, decoration: const InputDecoration(labelText: 'السبب', alignLabelWithHint: true, border: OutlineInputBorder())),
          ])),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('إلغاء')),
            FilledButton(onPressed: sent ? null : () async {
              reason = controller.text.trim();
              if (reason.isEmpty) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('اكتب سبب الطلب أولاً.'))); return; }
              try {
                final token = await _session.token();
                await HadirApi(token: token).createRequest(
                  type: type,
                  reason: reason,
                  startDate: isCheckout ? null : _dateKey(start),
                  endDate: isCheckout ? null : _dateKey(end),
                );
                if (!dialogContext.mounted) return;
                setDialogState(() => sent = true);
                await Future<void>.delayed(const Duration(milliseconds: 500));
                if (!dialogContext.mounted) return;
                if (Navigator.of(dialogContext).canPop()) Navigator.of(dialogContext).pop();
                if (mounted) _load();
              } catch (e) {
                if (!dialogContext.mounted) return;
                ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content: Text(HadirApi.errorMessage(e))));
              }
            }, child: Text(sent ? 'تم إرسال الطلب' : 'إرسال الطلب')),
          ],
        );
      }),
    );
    controller.dispose();
  }

  Widget _dateField(BuildContext context, String label, DateTime value, ValueChanged<DateTime> onChanged) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(context: context, initialDate: value, firstDate: DateTime(_now.year, _now.month, _now.day), lastDate: DateTime(_now.year + 3), locale: const Locale('ar'));
        if (picked != null) onChanged(picked);
      },
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()), child: Text(intl.DateFormat('yyyy-MM-dd').format(value))),
    );
  }

  Widget _section(BuildContext context, String title, String subtitle, Widget child) {
    final scheme = Theme.of(context).colorScheme;
    return _card(context, padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: TextStyle(color: scheme.onSurface, fontSize: 15, fontWeight: FontWeight.w900)), const SizedBox(height: 2), Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)), const SizedBox(height: 12), child]));
  }

  Widget _stat(BuildContext context, String title, String value, IconData icon) {
    final scheme = Theme.of(context).colorScheme;
    return Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: scheme.secondaryContainer.withValues(alpha: .38), borderRadius: BorderRadius.circular(12)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, color: scheme.primary, size: 17), const SizedBox(height: 7), Text(title, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 8.5)), const SizedBox(height: 2), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurface, fontWeight: FontWeight.w900, fontSize: 10.5))]));
  }

  Widget _info(BuildContext context, IconData icon, String title, String value) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [Container(width: 31, height: 31, decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: scheme.primary, size: 16)), const SizedBox(width: 9), Expanded(child: Text(title, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10))), Flexible(child: Text(value, textAlign: TextAlign.end, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurface, fontSize: 10.5, fontWeight: FontWeight.w800)))]));
  }

  Widget _detailRow(BuildContext context, IconData icon, String title, String value) {
    final scheme = Theme.of(context).colorScheme;
    return Row(children: [Icon(icon, size: 15, color: scheme.primary), const SizedBox(width: 7), Text(title, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)), const Spacer(), Flexible(child: Text(value, textAlign: TextAlign.end, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurface, fontSize: 9.5, fontWeight: FontWeight.w800)))]);
  }

  Widget _pill(BuildContext context, IconData icon, String text) {
    final scheme = Theme.of(context).colorScheme;
    return Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8), decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .08), borderRadius: BorderRadius.circular(99), border: Border.all(color: scheme.primary.withValues(alpha: .18))), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 15, color: scheme.primary), const SizedBox(width: 6), Flexible(child: Text(text, style: TextStyle(color: scheme.primary, fontSize: 10, fontWeight: FontWeight.w800)))]));
  }

  Widget _warning(BuildContext context, String text) {
    final scheme = Theme.of(context).colorScheme;
    return Container(width: double.infinity, padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: scheme.errorContainer.withValues(alpha: .55), borderRadius: BorderRadius.circular(12)), child: Row(children: [Icon(Icons.warning_amber_rounded, size: 16, color: scheme.error), const SizedBox(width: 7), Expanded(child: Text(text, style: TextStyle(color: scheme.onErrorContainer, fontSize: 10)))]));
  }

  Widget _statusIcon(BuildContext context, String status) {
    final scheme = Theme.of(context).colorScheme;
    final Color color;
    final IconData icon;
    if (status == 'حاضر' || status == 'متأخر') { color = scheme.primary; icon = Icons.work_history_rounded; }
    else if (status == 'هارب') { color = scheme.error; icon = Icons.warning_amber_rounded; }
    else if (status == 'إجازة' || status == 'إذن') { color = scheme.secondary; icon = Icons.event_available_rounded; }
    else { color = scheme.onSurfaceVariant; icon = Icons.access_time_rounded; }
    return Container(width: 48, height: 48, decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: color));
  }

  Widget _avatar(BuildContext context, String? url, String name, {double size = 56, bool light = false}) {
    final scheme = Theme.of(context).colorScheme;
    final child = url == null ? Center(child: Text(name.trim().isEmpty ? 'م' : name.trim().characters.first, style: TextStyle(color: light ? scheme.primary : scheme.primary, fontSize: size * .34, fontWeight: FontWeight.w900))) : ClipRRect(borderRadius: BorderRadius.circular(14), child: Image.network(url, headers: _sessionTokenCached() == null ? null : {'Authorization': 'Bearer ${_sessionTokenCached()}'}, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Center(child: Text(name.trim().isEmpty ? 'م' : name.trim().characters.first, style: TextStyle(color: scheme.primary, fontSize: size * .34, fontWeight: FontWeight.w900)))));
    return Container(width: size, height: size, decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(14), border: Border.all(color: scheme.primary.withValues(alpha: .28))), child: child);
  }

  Widget _card(BuildContext context, {required Widget child, EdgeInsets padding = const EdgeInsets.all(16)}) {
    final scheme = Theme.of(context).colorScheme;
    return Container(padding: padding, decoration: BoxDecoration(color: scheme.surfaceContainerHighest.withValues(alpha: .55), borderRadius: BorderRadius.circular(16), border: Border.all(color: scheme.outlineVariant.withValues(alpha: .72)), boxShadow: [BoxShadow(color: scheme.shadow.withValues(alpha: .035), blurRadius: 14, offset: const Offset(0, 5))]), child: child);
  }

  String? _avatarUrl() {
    final direct = '${_employee['avatarUrl'] ?? _employee['avatar'] ?? ''}'.trim();
    if (direct.startsWith('http')) return direct;
    final id = '${_employee['id'] ?? _employee['employeeId'] ?? ''}'.trim();
    if (id.isEmpty) return null;
    final token = _sessionTokenCached();
    return token == null ? null : '${HadirApi.baseUrl}/api/employees/${Uri.encodeComponent(id)}/avatar';
  }

  String? _sessionTokenCached() => _sessionToken;

  String _locationName() {
    final id = '${_employee['locationId'] ?? ''}'.trim();
    if (id.isEmpty) return 'المقر الرئيسي';
    for (final row in _locations) {
      if (row is Map && '${row['id'] ?? ''}' == id) return '${row['name'] ?? 'الموقع المخصص'}';
    }
    return 'الموقع المخصص';
  }

  String _deviceLabel() {
    final status = '${_device['status'] ?? _device['state'] ?? ''}'.trim().toLowerCase();
    if (status == 'bound' || status == 'active' || status == 'verified') return 'مرتبط بالحساب';
    if (status.isNotEmpty) return status;
    return 'مرتبط بالحساب';
  }

  List<dynamic> _todayAttendance() {
    final day = _dateKey(_now);
    return _attendance.where((x) {
      final stamp = _stamp(x);
      return stamp != null && _dateKey(stamp) == day;
    }).toList();
  }

  dynamic _event(List<dynamic> rows, String type) {
    dynamic latest;
    DateTime? latestStamp;
    for (final row in rows) {
      if (_type(row) != type) continue;
      final stamp = _stamp(row);
      if (stamp != null && (latestStamp == null || stamp.isAfter(latestStamp))) {
        latest = row;
        latestStamp = stamp;
      }
    }
    return latest;
  }

  dynamic _openSession(List<dynamic> rows) {
    final sorted = rows.where((row) => _stamp(row) != null).toList()
      ..sort((a, b) => _stamp(a)!.compareTo(_stamp(b)!));
    dynamic lastIn;
    for (final row in sorted) {
      final type = _type(row);
      if (type == 'check-in') lastIn = row;
      if (type == 'check-out' && lastIn != null) lastIn = null;
    }
    return lastIn;
  }

  String _workDuration(List<dynamic> rows) {
    final sorted = rows.where((row) => _stamp(row) != null).toList()
      ..sort((a, b) => _stamp(a)!.compareTo(_stamp(b)!));
    DateTime? start;
    var total = Duration.zero;
    for (final row in sorted) {
      final stamp = _stamp(row);
      if (stamp == null) continue;
      if (_type(row) == 'check-in') {
        start = stamp;
      } else if (_type(row) == 'check-out' && start != null && !stamp.isBefore(start)) {
        total += stamp.difference(start);
        start = null;
      }
    }
    if (start != null) total += _now.difference(start);
    if (total.isNegative || total.inMinutes <= 0) return '—';
    return '${total.inHours}:${(total.inMinutes % 60).toString().padLeft(2, '0')}';
  }

  String _status(Map<String, dynamic> schedule, dynamic open, bool checkedIn, dynamic escape, bool leave, bool permission) {
    if (escape != null) return 'هارب';
    if (leave) return 'إجازة';
    if (permission) return 'إذن';
    if (open != null) return _lateMinutes(schedule, checkedIn) > 0 ? 'متأخر' : 'حاضر';
    if (schedule['isWorkDay'] == true) {
      if (checkedIn) return 'حاضر';
      final start = schedule['start'];
      if (start is DateTime && _damascusNow().isAfter(start)) return 'غائب';
      return 'لم تبدأ المناوبة';
    }
    return 'راحة';
  }

  String _statusDetail(String status) => switch (status) {
    'هارب' => 'مسجل كحالة هروب حتى تسجيل العودة.',
    'غائب' => 'بدأت فترة الدوام ولم يُسجل حضور.',
    'إجازة' => 'لديك إجازة معتمدة لهذا اليوم.',
    'إذن' => 'لديك إذن معتمد لهذا اليوم.',
    'حاضر' => 'أنت مسجل حضور الآن.',
    'متأخر' => 'تم تسجيل حضورك بعد بداية الفترة.',
    'راحة' => 'اليوم ليس ضمن أيام العمل.',
    _ => 'لم يحن وقت بداية المناوبة بعد.',
  };

  Map<String, dynamic> _schedule() {
    final now = _damascusNow();
    final type = '${_employee['scheduleType'] ?? 'ADMIN'}'.toUpperCase();
    if (type == 'ROTATION') return _rotationSchedule(now);
    final workDays = _workDays();
    final weekday = now.weekday % 7;
    if (!workDays.contains(weekday)) return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null};
    final day = DateTime(now.year, now.month, now.day);
    final start = _localTime(day, '${_employee['workStartTime'] ?? '09:00'}');
    var end = _localTime(day, '${_employee['workEndTime'] ?? '16:00'}');
    if (!end.isAfter(start)) end = end.add(const Duration(days: 1));
    if (now.isAfter(end)) return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null, 'previousStart': start, 'previousEnd': end};
    return {'isWorkDay': true, 'kind': 'ADMIN', 'start': start, 'end': end};
  }

  Map<String, dynamic> _rotationSchedule([DateTime? target]) {
    final now = target ?? _damascusNow();
    final raw = '${_employee['rotationStartDate'] ?? ''}'.split('T').first;
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return {'isWorkDay': false, 'kind': 'INVALID', 'start': null, 'end': null};
    final daysOn = _number(_employee['rotationDaysOn'], 4).clamp(1, 31);
    final daysOff = _number(_employee['rotationDaysOff'], 4).clamp(0, 31);
    final cycle = daysOn + daysOff;
    final first = _localTime(DateTime(parsed.year, parsed.month, parsed.day), '${_employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
    if (now.isBefore(first)) return {'isWorkDay': false, 'kind': 'NOT_STARTED', 'start': first, 'end': null};
    final dayStart = DateTime(parsed.year, parsed.month, parsed.day);
    final diff = DateTime(now.year, now.month, now.day).difference(dayStart).inDays;
    if (diff < 0) return {'isWorkDay': false, 'kind': 'NOT_STARTED', 'start': first, 'end': null};
    final cycleDay = diff % cycle;
    final periodDay = dayStart.add(Duration(days: diff - cycleDay));
    final start = _localTime(periodDay, '${_employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
    final end = _localTime(periodDay.add(Duration(days: daysOn)), '${_employee['rotationEndTime'] ?? _employee['workEndTime'] ?? _employee['workStartTime'] ?? '09:00'}');
    if (cycleDay < daysOn) {
      return {'isWorkDay': true, 'kind': 'ROTATION', 'start': start, 'end': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
    }
    if (cycleDay == daysOn && now.isBefore(end)) {
      return {'isWorkDay': true, 'kind': 'ROTATION', 'start': start, 'end': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
    }
    return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
  }

  List<int> _workDays() {
    final raw = _employee['workDays'];
    if (raw is List) {
      final result = raw.map((e) => int.tryParse('$e')).whereType<int>().where((e) => e >= 0 && e <= 6).toSet().toList()..sort();
      if (result.isNotEmpty) return result;
    }
    return [0, 1, 2, 3, 4];
  }

  DateTime _damascusNow() {
    final utc = _now.toUtc();
    return utc.add(const Duration(hours: 3));
  }

  DateTime _localTime(DateTime day, String value) {
    final m = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(value.trim());
    final h = m == null ? 9 : int.parse(m.group(1)!);
    final min = m == null ? 0 : int.parse(m.group(2)!);
    return DateTime(day.year, day.month, day.day, h.clamp(0, 23), min.clamp(0, 59));
  }

  String _scheduleLabel(Map<String, dynamic> s) {
    if (s['kind'] == 'ADMIN') return 'دوام إداري';
    if (s['kind'] == 'ROTATION') return 'مناوبة تناوبية';
    if (s['kind'] == 'NOT_STARTED') return 'لم تبدأ المناوبة';
    return 'فترة راحة';
  }

  String _periodLabel(Map<String, dynamic> s) {
    final start = s['start'];
    final end = s['end'];
    if (start is DateTime && end is DateTime) return '${intl.DateFormat('HH:mm').format(start)} → ${intl.DateFormat('HH:mm').format(end)}';
    if (s['kind'] == 'NOT_STARTED' && start is DateTime) return 'تبدأ ${intl.DateFormat('HH:mm').format(start)}';
    return '—';
  }

  String _rotationDurationLabel() {
    final on = _number(_employee['rotationDaysOn'], 4).clamp(1, 31);
    final off = _number(_employee['rotationDaysOff'], 4).clamp(0, 31);
    return '$on أيام عمل + $off أيام راحة';
  }

  String _countdown(Map<String, dynamic> s) {
    final start = s['start'];
    final end = s['end'];
    DateTime? target;
    String label = '';
    if (s['kind'] == 'NOT_STARTED' && start is DateTime) { target = start; label = 'بداية أول مناوبة'; }
    else if (s['isWorkDay'] == true && end is DateTime && end.isAfter(_damascusNow())) { target = end; label = 'تنتهي المناوبة خلال'; }
    else if (s['kind'] == 'OFF') {
      final raw = '${_employee['rotationStartDate'] ?? ''}'.split('T').first;
      final parsed = DateTime.tryParse(raw);
      if (parsed != null) {
        final on = _number(_employee['rotationDaysOn'], 4).clamp(1, 31);
        final off = _number(_employee['rotationDaysOff'], 4).clamp(0, 31);
        final cycle = on + off;
        if (cycle <= 0) return '';
        final dayStart = DateTime(parsed.year, parsed.month, parsed.day);
        final now = _damascusNow();
        final diff = DateTime(now.year, now.month, now.day).difference(dayStart).inDays;
        final cycleDay = diff % cycle;
        final next = dayStart.add(Duration(days: diff + (cycle - cycleDay)));
        target = _localTime(next, '${_employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
        label = 'تبدأ المناوبة القادمة خلال';
      }
    }
    if (target == null) return '';
    final d = target.difference(_damascusNow());
    final total = d.inSeconds.clamp(0, 999999999);
    final h = total ~/ 3600;
    final m = (total % 3600) ~/ 60;
    final sec = total % 60;
    return '$label ${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }

  int _lateMinutes(Map<String, dynamic> s, bool checkedIn) {
    if (!checkedIn || s['start'] is! DateTime) return 0;
    final start = s['start'] as DateTime;
    final now = _damascusNow();
    if (now.isBefore(start)) return 0;
    final event = _event(_todayAttendance(), 'check-in');
    final stamp = _stamp(event);
    if (stamp == null || !stamp.isAfter(start)) return 0;
    final grace = _number(_employee['gracePeriodMinutes'], 10);
    return ((stamp.difference(start).inMinutes) - grace).clamp(0, 1440);
  }

  dynamic _activeEscape() {
    for (final row in _escapeEvents) {
      if (row is! Map) continue;
      final status = '${row['status'] ?? ''}'.toLowerCase();
      if (status == 'escaped') return row;
    }
    return null;
  }

  List<dynamic> _todayApprovedRequests() {
    final day = _dateKey(_now);
    return _requests.where((r) {
      if (r is! Map) return false;
      final status = '${r['status'] ?? ''}'.toLowerCase();
      if (status != 'approved' && status != 'confirmed') return false;
      final start = DateTime.tryParse('${r['startDate'] ?? r['createdAt'] ?? ''}'.split('T').first);
      final end = DateTime.tryParse('${r['endDate'] ?? r['startDate'] ?? r['createdAt'] ?? ''}'.split('T').first);
      final current = DateTime.tryParse(day);
      return start != null && end != null && current != null && !current.isBefore(start) && !current.isAfter(end);
    }).toList();
  }

  String _requestType(dynamic row) => '${row is Map ? row['type'] ?? '' : ''}'.toLowerCase();
  String _type(dynamic row) => '${row is Map ? row['type'] ?? '' : ''}'.toLowerCase();
  DateTime? _stamp(dynamic row) => row is Map ? DateTime.tryParse('${row['timestamp'] ?? row['createdAt'] ?? ''}') : null;
  String _dateKey(DateTime date) => intl.DateFormat('yyyy-MM-dd').format(date);
  String _time(dynamic row) { final d = _stamp(row); return d == null ? '—' : intl.DateFormat('HH:mm').format(d); }
  int _number(dynamic value, int fallback) => int.tryParse('$value') ?? fallback;
  String _minutesLabel(int minutes) => minutes >= 60 ? '${minutes ~/ 60} ساعة و${minutes % 60} دقيقة' : '$minutes دقيقة';

  Widget _messageCard(BuildContext context, String text, IconData icon) {
    final scheme = Theme.of(context).colorScheme;
    return _card(context, child: Row(children: [Icon(icon, color: scheme.error), const SizedBox(width: 10), Expanded(child: Text(text, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11)))]));
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();
  @override
  Widget build(BuildContext context) => Container(height: 92, decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .45), borderRadius: BorderRadius.circular(16)), child: const Center(child: CircularProgressIndicator()));
}