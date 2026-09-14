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
      final canonicalStatusFuture = api.dailyStatus(date: _dateKey(_damascusDateTime)).catchError((_) => <String, dynamic>{});
      final results = await Future.wait<dynamic>([
        attendanceFuture,
        requestsFuture,
        locationsFuture,
        deviceFuture,
        api.escapeEvents(employeeId: id.isEmpty ? null : id, limit: 20),
        canonicalStatusFuture,
      ]);
      String? canonicalStatus;
      final canonical = results[5];
      if (canonical is Map) {
        final employees = canonical['employees'];
        if (employees is List) {
          for (final row in employees) {
            if (row is! Map) continue;
            if ('${row['employeeId'] ?? row['id'] ?? ''}'.trim() != id) continue;
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
        _attendance = results[0] as List<dynamic>;
        _requests = results[1] as List<dynamic>;
        _locations = results[2] as List<dynamic>;
        _device = results[3] is Map ? Map<String, dynamic>.from(results[3] as Map) : <String, dynamic>{};
        _escapeEvents = results[4] as List<dynamic>;
        _canonicalStatus = canonicalStatus;
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
      _info(context, 'نوع الدوام', isRotation ? 'تناوبي' : 'إداري', Icons.work_outline),
      _info(context, 'الحالة', status, Icons.info_outline),
      _info(context, 'الفترة', period, Icons.timelapse_outlined),
      _info(context, 'الوقت', time, Icons.access_time_outlined),
      if (isRotation) _info(context, 'التسجيل اليومي', '${_employee['rotationDailyAttendanceEnabled'] == true ? 'مفعل' : 'غير مفعل'}', Icons.event_available_outlined),
    ];
    return _section(
      context,
      'معلومات الدوام',
      'التفاصيل المعتمدة لهذا اليوم',
      Wrap(spacing: 10, runSpacing: 10, children: rows),
    );
  }

  Widget _requestBanner(BuildContext context) {
    final approved = _todayApprovedRequests();
    if (approved.isEmpty) return const SizedBox.shrink();
    final leave = approved.any((r) => _requestType(r) == 'leave');
    final permission = approved.any((r) => _requestType(r) == 'permission');
    final text = leave ? 'لديك إجازة معتمدة اليوم.' : permission ? 'لديك إذن معتمد اليوم.' : 'لديك طلب معتمد اليوم.';
    return _warning(context, text);
  }

  Widget _section(BuildContext context, String title, String subtitle, Widget child) {
    final scheme = Theme.of(context).colorScheme;
    return _card(
      context,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: scheme.onSurface, fontSize: 15, fontWeight: FontWeight.w900)),
          const SizedBox(height: 3),
          Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _stat(BuildContext context, String label, String value, IconData icon) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: scheme.surfaceContainerHighest.withValues(alpha: .38), borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: scheme.primary),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(color: scheme.onSurface, fontSize: 12, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _info(BuildContext context, String label, String value, IconData icon) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: 205,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: scheme.outlineVariant.withValues(alpha: .72)), borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          Icon(icon, size: 18, color: scheme.primary),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9)), const SizedBox(height: 2), Text(value, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurface, fontSize: 10.5, fontWeight: FontWeight.w800))])),
        ],
      ),
    );
  }

  Widget _pill(BuildContext context, IconData icon, String text) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(color: scheme.primaryContainer.withValues(alpha: .45), borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 15, color: scheme.primary), const SizedBox(width: 6), Text(text, style: TextStyle(color: scheme.onSurface, fontSize: 9.5, fontWeight: FontWeight.w800))]),
    );
  }

  Widget _warning(BuildContext context, String text) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: scheme.errorContainer.withValues(alpha: .45), borderRadius: BorderRadius.circular(14)),
      child: Row(children: [Icon(Icons.warning_amber_rounded, size: 18, color: scheme.error), const SizedBox(width: 8), Expanded(child: Text(text, style: TextStyle(color: scheme.onErrorContainer, fontSize: 10, fontWeight: FontWeight.w700)))]),
    );
  }

  Widget _statusIcon(BuildContext context, String status) {
    final scheme = Theme.of(context).colorScheme;
    final icon = switch (status) {
      'حاضر' => Icons.check_circle_rounded,
      'متأخر' => Icons.schedule_rounded,
      'غائب' => Icons.person_off_rounded,
      'هارب' => Icons.directions_run_rounded,
      'إجازة' => Icons.beach_access_rounded,
      'إذن' => Icons.assignment_turned_in_rounded,
      'انصراف معلق' => Icons.pending_actions_rounded,
      _ => Icons.info_outline_rounded,
    };
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(color: scheme.primaryContainer.withValues(alpha: .55), borderRadius: BorderRadius.circular(15)),
      child: Icon(icon, color: scheme.primary, size: 25),
    );
  }

  Widget _card(BuildContext context, {required Widget child, EdgeInsetsGeometry? padding}) {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(padding: padding ?? const EdgeInsets.all(14), child: child),
    );
  }

  String _avatarUrl() {
    final value = _employee['avatarUrl'] ?? _employee['avatar'] ?? _employee['photoUrl'];
    return value == null ? '' : '$value'.trim();
  }

  Widget _avatar(BuildContext context, String url, String name, {required double size}) {
    final scheme = Theme.of(context).colorScheme;
    if (url.isEmpty) {
      return Container(width: size, height: size, decoration: BoxDecoration(color: scheme.primaryContainer, shape: BoxShape.circle), alignment: Alignment.center, child: Text(name.isEmpty ? 'م' : name.characters.first, style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w900, fontSize: size * .34)));
    }
    return ClipOval(child: Image.network(url, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: size, height: size, color: scheme.primaryContainer, alignment: Alignment.center, child: Text(name.isEmpty ? 'م' : name.characters.first, style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w900, fontSize: size * .34))));
  }

  List<dynamic> _todayAttendance() {
    final day = _dateKey(_damascusDateTime);
    return _attendance.where((row) {
      if (row is! Map) return false;
      final stamp = _stamp(row);
      return stamp != null && _dateKey(stamp) == day;
    }).toList();
  }

  dynamic _event(List<dynamic> rows, String type) {
    DateTime? latest;
    dynamic result;
    for (final row in rows) {
      if (_type(row) != type) continue;
      final stamp = _stamp(row);
      if (stamp == null) continue;
      if (latest == null || stamp.isAfter(latest)) {
        latest = stamp;
        result = row;
      }
    }
    return result;
  }

  dynamic _openSession(List<dynamic> rows) {
    final checkIn = _event(rows, 'check-in');
    if (checkIn == null) return null;
    final checkInStamp = _stamp(checkIn);
    final checkOut = _event(rows, 'check-out');
    final checkOutStamp = _stamp(checkOut);
    if (checkOutStamp != null && checkInStamp != null && !checkOutStamp.isBefore(checkInStamp)) return null;
    return checkIn;
  }

  String _workDuration(List<dynamic> rows) {
    final checkIn = _event(rows, 'check-in');
    final checkOut = _event(rows, 'check-out');
    final inStamp = _stamp(checkIn);
    final outStamp = _stamp(checkOut);
    if (inStamp == null) return '—';
    final end = outStamp ?? _damascusNow();
    if (end.isBefore(inStamp)) return '—';
    return _minutesLabel(end.difference(inStamp).inMinutes);
  }

  String _minutesLabel(int minutes) => minutes >= 60 ? '${minutes ~/ 60} ساعة و${minutes % 60} دقيقة' : '$minutes دقيقة';

  String _locationName() {
    if (_locations.isEmpty) return 'الموقع الافتراضي';
    final first = _locations.first;
    if (first is Map) return '${first['name'] ?? first['label'] ?? first['title'] ?? 'الموقع'}';
    return 'الموقع';
  }

  Map<String, dynamic> _schedule() {
    final now = _damascusNow();
    final type = '${_employee['scheduleType'] ?? 'ADMIN'}'.toUpperCase();
    if (type == 'ROTATION') return _rotationSchedule(now);
    final workDays = _workDays();
    final weekday = now.weekday % 7;
    if (!workDays.contains(weekday)) return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null};
    final day = HadirTime.date(now.year, now.month, now.day);
    final start = _localTime(day, '${_employee['workStartTime'] ?? '09:00'}');
    var end = _localTime(day, '${_employee['workEndTime'] ?? '16:00'}');
    if (!end.isAfter(start)) end = end.add(const Duration(days: 1));
    if (!now.isBefore(end)) return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null, 'previousStart': start, 'previousEnd': end};
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
    final first = _localTime(HadirTime.date(parsed.year, parsed.month, parsed.day), '${_employee['workStartTime'] ?? _employee['rotationStartTime'] ?? '09:00'}');
    if (now.isBefore(first)) return {'isWorkDay': false, 'kind': 'NOT_STARTED', 'start': first, 'end': null};
    final dayStart = HadirTime.date(parsed.year, parsed.month, parsed.day);
    final diff = HadirTime.date(now.year, now.month, now.day).difference(dayStart).inDays;
    if (diff < 0) return {'isWorkDay': false, 'kind': 'NOT_STARTED', 'start': first, 'end': null};
    final cycleDay = diff % cycle;
    final periodDay = dayStart.add(Duration(days: diff - cycleDay));
    final start = _localTime(periodDay, '${_employee['workStartTime'] ?? _employee['rotationStartTime'] ?? '09:00'}');
    final end = _localTime(periodDay.add(Duration(days: daysOn)), '${_employee['rotationEndTime'] ?? _employee['workEndTime'] ?? _employee['rotationStartTime'] ?? _employee['workStartTime'] ?? '09:00'}');
    final activeRotation = cycleDay < daysOn;
    if (activeRotation && now.isBefore(start)) {
      return {'isWorkDay': false, 'kind': 'NOT_STARTED', 'start': start, 'end': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
    }
    if (!activeRotation) return {'isWorkDay': false, 'kind': 'OFF', 'start': null, 'end': null, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
    final dailyEnabled = _employee['rotationDailyAttendanceEnabled'] == true || '${_employee['rotationDailyAttendanceEnabled'] ?? ''}'.toLowerCase() == 'true' || '${_employee['rotationDailyAttendanceEnabled'] ?? ''}' == '1';
    if (dailyEnabled) {
      final dailyTime = '${_employee['rotationDailyAttendanceTime'] ?? ''}'.trim();
      final match = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(dailyTime);
      if (match == null) return {'isWorkDay': true, 'kind': 'ROTATION_DAILY_INVALID', 'start': null, 'end': null, 'rotationStart': start, 'rotationEnd': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
      final checkpoint = _localTime(HadirTime.date(now.year, now.month, now.day), dailyTime);
      final rawGrace = _number(_employee['rotationDailyAttendanceGraceMinutes'], 0).clamp(0, 180);
      final graceEnd = checkpoint.add(Duration(minutes: rawGrace));
      final checkpointInRotation = !checkpoint.isBefore(start) && checkpoint.isBefore(end);
      if (!checkpointInRotation) return {'isWorkDay': true, 'kind': 'ROTATION_DAILY_INVALID', 'start': null, 'end': null, 'rotationStart': start, 'rotationEnd': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff};
      return {'isWorkDay': true, 'kind': 'ROTATION_DAILY', 'start': checkpoint, 'end': graceEnd, 'rotationStart': start, 'rotationEnd': end, 'cycleDay': cycleDay, 'daysOn': daysOn, 'daysOff': daysOff, 'dailyAttendanceEnabled': true, 'dailyAttendanceTime': dailyTime, 'dailyAttendanceGraceMinutes': rawGrace};
    }
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

  DateTime _damascusNow() => _now;

  DateTime _localTime(DateTime day, String value) {
    final m = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(value.trim());
    final h = m == null ? 9 : int.parse(m.group(1)!);
    final min = m == null ? 0 : int.parse(m.group(2)!);
    return HadirTime.date(day.year, day.month, day.day, h.clamp(0, 23), min.clamp(0, 59));
  }

  String _scheduleLabel(Map<String, dynamic> s) {
    if (s['kind'] == 'ADMIN') return 'دوام إداري';
    if (s['kind'] == 'ROTATION_DAILY') return 'مناوبة تناوبية · تسجيل يومي';
    if (s['kind'] == 'ROTATION_DAILY_INVALID') return 'تسجيل يومي غير صالح';
    if (s['kind'] == 'ROTATION') return 'مناوبة تناوبية';
    if (s['kind'] == 'NOT_STARTED') return 'لم تبدأ المناوبة';
    return 'فترة راحة';
  }

  String _periodLabel(Map<String, dynamic> s) {
    final start = s['start'];
    final end = s['end'];
    if (start is DateTime && end is DateTime) {
      final suffix = s['kind'] == 'ROTATION_DAILY' ? ' (نافذة التسجيل)' : '';
      return '${intl.DateFormat('HH:mm').format(start)} → ${intl.DateFormat('HH:mm').format(end)}$suffix';
    }
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
    else if (s['kind'] == 'ROTATION_DAILY' && start is DateTime && _damascusNow().isBefore(start)) { target = start; label = 'يبدأ التسجيل اليومي خلال'; }
    else if (s['kind'] == 'ROTATION_DAILY' && end is DateTime && end.isAfter(_damascusNow())) { target = end; label = 'تنتهي مهلة التسجيل خلال'; }
    else if (s['isWorkDay'] == true && end is DateTime && end.isAfter(_damascusNow())) { target = end; label = 'تنتهي المناوبة خلال'; }
    else if (s['kind'] == 'OFF') {
      final raw = '${_employee['rotationStartDate'] ?? ''}'.split('T').first;
      final parsed = DateTime.tryParse(raw);
      if (parsed != null) {
        final on = _number(_employee['rotationDaysOn'], 4).clamp(1, 31);
        final off = _number(_employee['rotationDaysOff'], 4).clamp(0, 31);
        final cycle = on + off;
        if (cycle <= 0) return '';
        final dayStart = HadirTime.date(parsed.year, parsed.month, parsed.day);
        final now = _damascusNow();
        final diff = HadirTime.date(now.year, now.month, now.day).difference(dayStart).inDays;
        final cycleDay = diff % cycle;
        final next = dayStart.add(Duration(days: diff + (cycle - cycleDay)));
        target = _localTime(next, '${_employee['workStartTime'] ?? _employee['rotationStartTime'] ?? '09:00'}');
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
    DateTime? latestStamp;
    Map<String, dynamic>? latest;
    for (final row in _escapeEvents) {
      if (row is! Map) continue;
      final stamp = _stamp(row);
      if (stamp == null) continue;
      if (latestStamp == null || stamp.isAfter(latestStamp)) {
        latestStamp = stamp;
        latest = Map<String, dynamic>.from(row);
      }
    }
    if (latest == null) return null;
    return '${latest['status'] ?? ''}'.trim().toLowerCase() == 'escaped' ? latest : null;
  }

  List<dynamic> _todayApprovedRequests() {
    final day = _dateKey(_damascusDateTime);
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
  DateTime? _stamp(dynamic row) => row is Map ? HadirTime.fromTimestamp(row['timestamp'] ?? row['createdAt']) : null;
  String _dateKey(DateTime date) => HadirTime.dateKey(date);
  String _time(dynamic row) { final d = _stamp(row); return d == null ? '—' : intl.DateFormat('HH:mm').format(d); }
  int _number(dynamic value, int fallback) => int.tryParse('$value') ?? fallback;

  String _status(Map<String, dynamic> schedule, dynamic open, bool checkedIn, dynamic escape, bool leave, bool permission) {
    final canonical = _canonicalStatus?.trim().toUpperCase();
    if (canonical == 'ESCAPED') return 'هارب';
    if (canonical == 'LEAVE') return 'إجازة';
    if (canonical == 'PERMISSION') return 'إذن';
    if (canonical == 'ABSENT') return 'غائب';
    if (canonical == 'REST' || canonical == 'OFF') return 'راحة';
    if (canonical == 'NOT_STARTED') return 'لم تبدأ المناوبة';
    if (canonical == 'INVALID') return 'جدول غير صالح';
    if (canonical == 'OPEN') return 'انصراف معلق';
    if (canonical == 'LATE') return 'متأخر';
    if (canonical == 'PRESENT') return 'حاضر';
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
    'انصراف معلق' => 'تم تسجيل الحضور ولم يُسجل الانصراف بعد.',
    'تسجيل يومي غير صالح' => 'وقت التسجيل اليومي غير صالح. راجع إعدادات الموظف.',
    'جدول غير صالح' => 'تعذر تحديد جدول الدوام المعتمد.',
    'راحة' => 'اليوم ليس ضمن أيام العمل.',
    _ => 'لم يحن وقت بداية المناوبة بعد.',
  };

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