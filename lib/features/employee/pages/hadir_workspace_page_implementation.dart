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
  DateTime _now = _damascusNow();
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
      if (mounted) setState(() => _now = _damascusNow());
    });
    _load();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  DateTime _damascusNow() {
    final utc = DateTime.now().toUtc();
    return utc.add(const Duration(hours: 3));
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
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('طلب جديد'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      value: type,
                      decoration: const InputDecoration(labelText: 'نوع الطلب'),
                      items: const [
                        DropdownMenuItem(value: 'permission', child: Text('استئذان')),
                        DropdownMenuItem(value: 'leave', child: Text('إجازة')),
                      ],
                      onChanged: (v) => setDialogState(() => type = v ?? type),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: controller,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(labelText: 'السبب', border: OutlineInputBorder()),
                      onChanged: (v) => reason = v,
                    ),
                    const SizedBox(height: 12),
                    _requestDateField(context, 'من', start, (value) => setDialogState(() => start = value)),
                    const SizedBox(height: 8),
                    _requestDateField(context, 'إلى', end, (value) => setDialogState(() => end = value)),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('إلغاء')),
                FilledButton(
                  onPressed: sent ? null : () async {
                    if (reason.trim().isEmpty) {
                      ScaffoldMessenger.of(this.context).showSnackBar(const SnackBar(content: Text('اكتب سبب الطلب أولاً.')));
                      return;
                    }
                    setDialogState(() => sent = true);
                    try {
                      final token = _sessionToken ?? await _session.token();
                      final api = HadirApi(token: token);
                      await api.createRequest(
                        type: type,
                        reason: reason.trim(),
                        startDate: _dateKey(start),
                        endDate: _dateKey(end),
                      );
                      if (!mounted) return;
                      if (dialogContext.mounted) Navigator.of(dialogContext).pop();
                      await _load();
                      if (mounted) ScaffoldMessenger.of(this.context).showSnackBar(const SnackBar(content: Text('تم إرسال الطلب بنجاح.')));
                    } catch (e) {
                      if (!dialogContext.mounted) return;
                      setDialogState(() => sent = false);
                      ScaffoldMessenger.of(this.context).showSnackBar(SnackBar(content: Text(HadirApi.errorMessage(e))));
                    }
                  },
                  child: const Text('إرسال الطلب'),
                ),
              ],
            );
          },
        );
      },
    );
    controller.dispose();
  }

  Widget _requestDateField(BuildContext context, String label, DateTime value, ValueChanged<DateTime> onChanged) {
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.calendar_month_outlined),
      title: Text(label),
      subtitle: Text(intl.DateFormat('yyyy-MM-dd').format(value)),
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value,
          firstDate: DateTime(_now.year - 1),
          lastDate: DateTime(_now.year + 2),
        );
        if (picked != null) onChanged(picked);
      },
    );
  }

  Widget _card(BuildContext context, {required Widget child, EdgeInsetsGeometry? padding}) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .62)),
        boxShadow: [BoxShadow(color: scheme.shadow.withValues(alpha: .06), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      child: child,
    );
  }

  Widget _section(BuildContext context, String title, String subtitle, Widget child) {
    final scheme = Theme.of(context).colorScheme;
    return _card(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: TextStyle(color: scheme.onSurface, fontSize: 14, fontWeight: FontWeight.w900)),
      const SizedBox(height: 2),
      Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)),
      const SizedBox(height: 13),
      child,
    ]));
  }

  Widget _stat(BuildContext context, String label, String value, IconData icon) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(color: scheme.secondaryContainer.withValues(alpha: .28), borderRadius: BorderRadius.circular(13)),
      child: Column(children: [
        Icon(icon, size: 17, color: scheme.primary),
        const SizedBox(height: 5),
        Text(label, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 8.5)),
        const SizedBox(height: 2),
        Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurface, fontSize: 10.5, fontWeight: FontWeight.w900)),
      ]),
    );
  }

  Widget _info(BuildContext context, IconData icon, String label, String value) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(children: [
        Icon(icon, size: 18, color: scheme.primary),
        const SizedBox(width: 9),
        Expanded(child: Text(label, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10))),
        const SizedBox(width: 8),
        Flexible(child: Text(value, textAlign: TextAlign.end, style: TextStyle(color: scheme.onSurface, fontSize: 10.5, fontWeight: FontWeight.w800))),
      ]),
    );
  }

  Widget _detailRow(BuildContext context, IconData icon, String label, String value) {
    final scheme = Theme.of(context).colorScheme;
    return Row(children: [
      Icon(icon, size: 16, color: scheme.primary),
      const SizedBox(width: 8),
      Expanded(child: Text(label, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5))),
      Flexible(child: Text(value, textAlign: TextAlign.end, style: TextStyle(color: scheme.onSurface, fontSize: 9.5, fontWeight: FontWeight.w800))),
    ]);
  }

  Widget _pill(BuildContext context, IconData icon, String text) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .08), borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 15, color: scheme.primary), const SizedBox(width: 6), Flexible(child: Text(text, style: TextStyle(color: scheme.primary, fontSize: 9.5, fontWeight: FontWeight.w800)))])
    );
  }

  Widget _warning(BuildContext context, String text) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: scheme.errorContainer.withValues(alpha: .45), borderRadius: BorderRadius.circular(12)),
      child: Text(text, style: TextStyle(color: scheme.onErrorContainer, fontSize: 9.5, fontWeight: FontWeight.w700)),
    );
  }

  Widget _statusIcon(BuildContext context, String status) {
    final scheme = Theme.of(context).colorScheme;
    final icon = switch (status) {
      'حاضر' => Icons.check_circle_rounded,
      'متأخر' => Icons.schedule_rounded,
      'غائب' => Icons.person_off_rounded,
      'إجازة' => Icons.beach_access_rounded,
      'إذن' => Icons.event_available_rounded,
      'هارب' => Icons.warning_rounded,
      _ => Icons.hourglass_empty_rounded,
    };
    return Icon(icon, color: scheme.primary, size: 30);
  }

  Widget _avatar(BuildContext context, String url, String name, {double size = 56}) {
    final scheme = Theme.of(context).colorScheme;
    final initials = name.trim().isEmpty ? 'م' : name.trim().substring(0, 1);
    if (url.isEmpty) {
      return Container(width: size, height: size, decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .12), shape: BoxShape.circle), child: Center(child: Text(initials, style: TextStyle(color: scheme.primary, fontSize: size * .32, fontWeight: FontWeight.w900))));
    }
    return ClipOval(child: Image.network(url, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: size, height: size, color: scheme.primary.withValues(alpha: .12), child: Center(child: Text(initials, style: TextStyle(color: scheme.primary, fontSize: size * .32, fontWeight: FontWeight.w900)))));
  }

  String _avatarUrl() {
    for (final key in ['avatarUrl', 'avatar', 'photoUrl', 'imageUrl']) {
      final value = '${_employee[key] ?? ''}'.trim();
      if (value.isNotEmpty) return value;
    }
    return '';
  }

  String _locationName() {
    final currentId = '${_employee['locationId'] ?? _employee['location_id'] ?? ''}'.trim();
    for (final item in _locations) {
      if (item is! Map) continue;
      final map = Map<String, dynamic>.from(item);
      final id = '${map['id'] ?? map['locationId'] ?? ''}'.trim();
      if (currentId.isNotEmpty && id == currentId) return '${map['name'] ?? map['title'] ?? 'الموقع'}';
    }
    final direct = '${_employee['locationName'] ?? _employee['location'] ?? ''}'.trim();
    return direct.isEmpty ? 'غير محدد' : direct;
  }

  String _deviceLabel() {
    if (_device.isEmpty) return 'غير مسجل';
    final verified = _device['verified'] == true || _device['isVerified'] == true;
    final name = '${_device['deviceName'] ?? _device['name'] ?? _device['model'] ?? ''}'.trim();
    if (verified && name.isNotEmpty) return '$name · موثق';
    if (verified) return 'موثق';
    if (name.isNotEmpty) return '$name · غير موثق';
    return 'غير موثق';
  }

  List<dynamic> _todayAttendance() {
    final key = _dateKey(_now);
    return _attendance.where((e) {
      if (e is! Map) return false;
      final m = Map<String, dynamic>.from(e);
      final raw = '${m['date'] ?? m['attendanceDate'] ?? m['createdAt'] ?? m['timestamp'] ?? ''}';
      return _dateKey(_parseDate(raw) ?? _now) == key;
    }).toList();
  }

  List<dynamic> _todayApprovedRequests() {
    final key = _dateKey(_now);
    return _requests.where((e) {
      if (e is! Map) return false;
      final m = Map<String, dynamic>.from(e);
      final status = '${m['status'] ?? ''}'.toLowerCase();
      if (!['approved', 'مقبول', 'approved_by_manager'].contains(status)) return false;
      final start = _parseDate('${m['startDate'] ?? m['start_date'] ?? m['date'] ?? ''}');
      final end = _parseDate('${m['endDate'] ?? m['end_date'] ?? m['date'] ?? ''}') ?? start;
      if (start == null) return false;
      final target = DateTime(_now.year, _now.month, _now.day);
      final a = DateTime(start.year, start.month, start.day);
      final b = DateTime((end ?? start).year, (end ?? start).month, (end ?? start).day);
      return !target.isBefore(a) && !target.isAfter(b) && _dateKey(target) == key;
    }).toList();
  }

  Map<String, dynamic>? _openSession(List<dynamic> items) {
    Map<String, dynamic>? latestIn;
    for (final e in items) {
      if (e is! Map) continue;
      final m = Map<String, dynamic>.from(e);
      if (_type(m) == 'check-in') latestIn = m;
      if (_type(m) == 'check-out' && latestIn != null) latestIn = null;
    }
    return latestIn;
  }

  Map<String, dynamic>? _event(List<dynamic> items, String type) {
    Map<String, dynamic>? result;
    for (final e in items) {
      if (e is Map && _type(e) == type) result = Map<String, dynamic>.from(e);
    }
    return result;
  }

  String _type(dynamic value) {
    if (value is! Map) return '';
    final m = Map<String, dynamic>.from(value);
    final type = '${m['type'] ?? m['eventType'] ?? m['action'] ?? ''}'.toLowerCase();
    if (type.contains('in') || type.contains('حضور')) return 'check-in';
    if (type.contains('out') || type.contains('انصراف')) return 'check-out';
    return type;
  }

  String _requestType(dynamic value) {
    if (value is! Map) return '';
    final m = Map<String, dynamic>.from(value);
    final type = '${m['type'] ?? m['requestType'] ?? ''}'.toLowerCase();
    if (type.contains('leave') || type.contains('إجاز')) return 'leave';
    if (type.contains('permission') || type.contains('إذن')) return 'permission';
    return type;
  }

  String _time(Map<String, dynamic>? event) {
    if (event == null) return '—';
    final raw = '${event['timestamp'] ?? event['createdAt'] ?? event['time'] ?? event['date'] ?? ''}';
    final parsed = _parseDate(raw);
    return parsed == null ? '—' : intl.DateFormat('HH:mm').format(parsed);
  }

  String _workDuration(List<dynamic> items) {
    final start = _parseDate('${_event(items, 'check-in')?['timestamp'] ?? _event(items, 'check-in')?['createdAt'] ?? ''}');
    final end = _parseDate('${_event(items, 'check-out')?['timestamp'] ?? _event(items, 'check-out')?['createdAt'] ?? ''}');
    if (start == null) return '—';
    final duration = (end ?? _now).difference(start);
    if (duration.isNegative) return '—';
    final h = duration.inHours;
    final m = duration.inMinutes % 60;
    return '${h}س ${m}د';
  }

  String _status(Map<String, dynamic> schedule, Map<String, dynamic>? open, bool checkedIn, Map<String, dynamic>? escape, bool leave, bool permission) {
    if (escape != null) return 'هارب';
    if (leave) return 'إجازة';
    if (permission) return 'إذن';
    if (open != null) return 'حاضر';
    if (checkedIn) return 'حاضر';
    if (schedule['kind'] == 'NOT_STARTED') return 'لم تبدأ المناوبة';
    if (schedule['isWorkDay'] != true) return 'راحة';
    final start = schedule['start'];
    if (start is DateTime && _now.isAfter(start)) return 'غائب';
    return 'لم تبدأ';
  }

  int _lateMinutes(Map<String, dynamic> schedule, bool checkedIn) {
    if (!checkedIn || schedule['isWorkDay'] != true) return 0;
    final start = schedule['start'];
    if (start is! DateTime) return 0;
    final inEvent = _event(_todayAttendance(), 'check-in');
    if (inEvent == null) return 0;
    final at = _parseDate('${inEvent['timestamp'] ?? inEvent['createdAt'] ?? inEvent['time'] ?? ''}');
    if (at == null || !at.isAfter(start)) return 0;
    return at.difference(start).inMinutes;
  }

  Map<String, dynamic>? _activeEscape() {
    if (_escapeEvents.isEmpty) return null;
    for (final e in _escapeEvents.reversed) {
      if (e is! Map) continue;
      final m = Map<String, dynamic>.from(e);
      final status = '${m['status'] ?? m['type'] ?? ''}'.toLowerCase();
      if (status.contains('return') || status.contains('returned') || status.contains('عودة')) return null;
      return m;
    }
    return null;
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
    final type = '${_employee['scheduleType'] ?? 'ADMIN'}'.toUpperCase();
    if (type == 'ROTATION') return _rotationSchedule();
    final workDays = _workDays();
    final weekday = _now.weekday % 7;
    if (!workDays.contains(weekday)) return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null};
    final day = DateTime(_now.year, _now.month, _now.day);
    final start = _localTime(day, '${_employee['workStartTime'] ?? '09:00'}');
    var end = _localTime(day, '${_employee['workEndTime'] ?? '16:00'}');
    if (!end.isAfter(start)) end = end.add(const Duration(days: 1));
    if (_now.isAfter(end)) return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null, 'previousStart': start, 'previousEnd': end};
    return {'isWorkDay': true, 'kind': 'ADMIN', 'start': start, 'end': end};
  }

  Map<String, dynamic> _rotationSchedule() {
    final raw = '${_employee['rotationStartDate'] ?? ''}'.split('T').first;
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return {'isWorkDay': false, 'kind': 'INVALID', 'start': null, 'end': null};
    final daysOn = _number(_employee['rotationDaysOn'], 4).clamp(1, 31);
    final daysOff = _number(_employee['rotationDaysOff'], 4).clamp(0, 31);
    final cycle = daysOn + daysOff;
    final first = _localTime(DateTime(parsed.year, parsed.month, parsed.day), '${_employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
    if (_now.isBefore(first)) return {'isWorkDay': false, 'kind': 'NOT_STARTED', 'start': first, 'end': null};
    final dayStart = DateTime(parsed.year, parsed.month, parsed.day);
    final diff = DateTime(_now.year, _now.month, _now.day).difference(dayStart).inDays;
    final cycleDay = diff % cycle;
    final periodDay = dayStart.add(Duration(days: diff - cycleDay));
    if (cycleDay >= daysOn) return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
    final start = _localTime(periodDay, '${_employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
    var end = _localTime(periodDay.add(Duration(days: daysOn)), '${_employee['rotationEndTime'] ?? _employee['workEndTime'] ?? _employee['rotationStartTime'] ?? '09:00'}');
    if (!end.isAfter(start)) end = end.add(const Duration(days: 1));
    return {'isWorkDay': true, 'kind': 'ROTATION', 'start': start, 'end': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
  }

  List<int> _workDays() {
    final raw = _employee['workDays'];
    if (raw is List) {
      final result = raw.map((e) => int.tryParse('$e')).whereType<int>().where((e) => e >= 0 && e <= 6).toSet().toList()..sort();
      if (result.isNotEmpty) return result;
    }
    return [0, 1, 2, 3, 4];
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
    else if (s['isWorkDay'] == true && end is DateTime && end.isAfter(_now)) { target = end; label = 'تنتهي المناوبة خلال'; }
    else if (s['kind'] == 'OFF') {
      final raw = '${_employee['rotationStartDate'] ?? ''}'.split('T').first;
      final parsed = DateTime.tryParse(raw);
      if (parsed != null) {
        final on = _number(_employee['rotationDaysOn'], 4).clamp(1, 31);
        final off = _number(_employee['rotationDaysOff'], 4).clamp(0, 31);
        final cycle = on + off;
        final diff = DateTime(_now.year, _now.month, _now.day).difference(DateTime(parsed.year, parsed.month, parsed.day)).inDays;
        final cycleDay = diff % cycle;
        final nextStart = DateTime(_now.year, _now.month, _now.day).add(Duration(days: cycle - cycleDay));
        target = _localTime(nextStart, '${_employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
        label = 'بداية المناوبة القادمة';
      }
    }
    if (target == null || !target.isAfter(_now)) return '';
    final d = target.difference(_now);
    final h = d.inHours;
    final m = d.inMinutes % 60;
    final sec = d.inSeconds % 60;
    return '$label: ${h}س ${m}د ${sec}ث';
  }

  String _minutesLabel(int value) => value < 60 ? '$value دقيقة' : '${value ~/ 60}س ${value % 60}د';

  String _dateKey(DateTime value) => '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  DateTime? _parseDate(String value) {
    if (value.trim().isEmpty) return null;
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return null;
    return parsed.toUtc().add(const Duration(hours: 3));
  }

  int _number(dynamic value, int fallback) => int.tryParse('$value') ?? fallback;

  Widget _messageCard(BuildContext context, String text, IconData icon) {
    final scheme = Theme.of(context).colorScheme;
    return _card(context, child: Row(children: [Icon(icon, color: scheme.error), const SizedBox(width: 10), Expanded(child: Text(text, style: TextStyle(color: scheme.onSurface, fontSize: 10.5)))]));
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      height: 72,
      decoration: BoxDecoration(color: scheme.surfaceContainerHighest.withValues(alpha: .35), borderRadius: BorderRadius.circular(16)),
      child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
    );
  }
}
