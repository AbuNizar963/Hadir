import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;

import '../../../core/api.dart';
import '../../../core/hadir_time.dart';
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
  DateTime _now = HadirTime.now();

  DateTime get _damascusDateTime => _now;
  String? _sessionToken;
  String? _canonicalStatus;
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
      if (mounted) setState(() => _now = HadirTime.now());
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

      // The employee profile is required. The remaining workspace data is
      // optional so a partial backend outage does not break the page.
      final profile = await api.employeeProfile();
      final me = await _optional(() => api.me());
      final employee = _employeeMap(profile, me ?? const <String, dynamic>{});
      final id = '${employee['id'] ?? employee['employeeId'] ?? ''}'.trim();
      if (id.isEmpty) throw StateError('لم يتم العثور على بيانات الموظف.');

      final attendanceFuture = _optional(() => api.attendance(limit: 2000));
      final requestsFuture = _optional(() => api.requests());
      final locationsFuture = _optional(() => api.locations());
      final deviceFuture = _optional(() => api.employeeDeviceStatus());
      final escapeEventsFuture =
          _optional(() => api.escapeEvents(employeeId: id, limit: 20));
      final canonicalFuture =
          _optional(() => api.dailyStatus(date: _dateKey(_damascusDateTime)));

      final attendance = await attendanceFuture;
      final requests = await requestsFuture;
      final locations = await locationsFuture;
      final device = await deviceFuture;
      final escapeEvents = await escapeEventsFuture;
      final canonical = await canonicalFuture;

      String? canonicalStatus;
      if (canonical != null) {
        final employees = canonical['employees'];
        if (employees is List) {
          for (final row in employees) {
            if (row is! Map) continue;
            if ('${row['employeeId'] ?? row['id'] ?? ''}'.trim() != id) {
              continue;
            }
            final value = row['status'];
            if (value is String && value.trim().isNotEmpty) {
              canonicalStatus = value.trim().toUpperCase();
            }
            break;
          }
        }
      }

      if (!mounted) return;
      setState(() {
        _sessionToken = token;
        _employee = employee;
        if (attendance != null) _attendance = attendance;
        if (requests != null) _requests = requests;
        if (locations != null) _locations = locations;
        if (device != null) {
          _device = Map<String, dynamic>.from(device);
        }
        if (escapeEvents != null) _escapeEvents = escapeEvents;
        _canonicalStatus = canonicalStatus;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  Future<T?> _optional<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (_) {
      return null;
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
                  Text(intl.DateFormat('HH:mm').format(_damascusDateTime), style: TextStyle(color: scheme.onSurface, fontSize: 18, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text(intl.DateFormat('EEEE، d MMMM', 'ar').format(_damascusDateTime), style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)),
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
    final now = _damascusNow();
    final dailyMode = schedule['kind'] == 'ROTATION_DAILY';
    final dailyInvalid = schedule['kind'] == 'ROTATION_DAILY_INVALID';
    final scheduledStart = schedule['start'];
    final scheduledEnd = schedule['end'];
    final scheduledWindowOpen = scheduledStart is DateTime &&
        scheduledEnd is DateTime &&
        !now.isBefore(scheduledStart) &&
        now.isBefore(scheduledEnd);
    final dailyWindowOpen = !dailyMode || scheduledWindowOpen;
    final scheduleWindowOpen = dailyMode ? dailyWindowOpen : scheduledWindowOpen;
    final canIn = schedule['isWorkDay'] == true &&
        !dailyInvalid &&
        scheduleWindowOpen &&
        open == null &&
        !today.any((r) => _type(r) == 'check-in') &&
        !hasLeave &&
        !hasPermission &&
        escape == null;
    final canOut = open != null;
    final checkInSubtitle = schedule['isWorkDay'] != true ? 'أنت في الراحة' : dailyInvalid ? 'إعداد التسجيل اليومي غير صالح' : dailyMode && now.isBefore(schedule['start'] as DateTime) ? 'التسجيل يبدأ ${intl.DateFormat('HH:mm').format(schedule['start'] as DateTime)}' : dailyMode && now.isAfter(schedule['end'] as DateTime) ? 'انتهت مهلة التسجيل' : open != null ? 'الدوام جارٍ' : canIn ? 'مسح رمز QR' : 'غير متاح الآن';
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
    final scheme = Theme.of(context).colorScheme;
    final schedule = _schedule();
    final today = _todayAttendance();
    final approved = _todayApprovedRequests();
    final status = _status(
      schedule,
      _openSession(today),
      today.any((r) => _type(r) == 'check-in'),
      _activeEscape(),
      approved.any((r) => _requestType(r) == 'leave'),
      approved.any((r) => _requestType(r) == 'permission'),
    );
    final isRotation = '${_employee['scheduleType'] ?? 'ADMIN'}'.toUpperCase() == 'ROTATION';
    final period = isRotation ? _rotationDurationLabel() : _periodLabel(schedule);
    final time = _periodLabel(schedule);
    final rows = <Widget>[
      _info(context, 'نوع الدوام', isRotation ? 'ت... (truncated)