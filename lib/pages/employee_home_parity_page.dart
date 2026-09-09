import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

class EmployeeHomeParityPage extends StatefulWidget {
  const EmployeeHomeParityPage({super.key});

  @override
  State<EmployeeHomeParityPage> createState() => _EmployeeHomeParityPageState();
}

class _EmployeeHomeParityPageState extends State<EmployeeHomeParityPage> {
  final _session = HadirSession();
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _profile = const {};
  Map<String, dynamic> _employee = const {};
  List<dynamic> _attendance = const [];
  List<dynamic> _requests = const [];
  Map<String, dynamic> _device = const {};

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
        api.attendance(limit: 500),
        api.requests(),
        api.employeeDeviceStatus(),
      ]);
      final profile = results[0] is Map ? Map<String, dynamic>.from(results[0] as Map) : <String, dynamic>{};
      final nested = profile['employee'];
      final employee = nested is Map ? Map<String, dynamic>.from(nested) : profile;
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _employee = employee;
        _attendance = results[1] is List ? List<dynamic>.from(results[1] as List) : const [];
        _requests = results[2] is List ? List<dynamic>.from(results[2] as List) : const [];
        _device = results[3] is Map ? Map<String, dynamic>.from(results[3] as Map) : const {};
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(e); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        color: HadirBrand.lightBackground,
        child: RefreshIndicator(
          color: HadirBrand.lightPrimary,
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
            children: [
              _hero(),
              const SizedBox(height: 12),
              _todayStatus(),
              const SizedBox(height: 12),
              _actions(),
              const SizedBox(height: 12),
              _dailySummary(),
              const SizedBox(height: 12),
              _workInfo(),
              const SizedBox(height: 12),
              _requestCard(),
              const SizedBox(height: 12),
              _deviceCard(),
              if (_loading) const Padding(padding: EdgeInsets.only(top: 12), child: _LoadingCard()),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: _MessageCard(message: _error!)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero() {
    final name = _text(_employee, ['name', 'employeeName'], fallback: _text(_profile, ['name'], fallback: 'الموظف'));
    final job = _text(_employee, ['jobNumber', 'job_number']);
    final location = _text(_employee, ['locationName', 'location_name', 'location']);
    final avatar = _text(_profile, ['avatarUrl', 'avatar', 'photoUrl', 'imageUrl']);
    final now = DateTime.now();
    return _card(
      child: Row(children: [
        _avatar(avatar, name),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('مرحبًا بك', style: TextStyle(color: HadirBrand.lightMuted, fontSize: 10, fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: HadirBrand.lightText, fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(height: 3),
          Text([if (job.isNotEmpty) job, if (location.isNotEmpty) location].join(' · '), style: const TextStyle(color: HadirBrand.lightMuted, fontSize: 9.5), maxLines: 1, overflow: TextOverflow.ellipsis),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(intl.DateFormat('HH:mm').format(now), style: const TextStyle(color: HadirBrand.lightText, fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(height: 2),
          Text(intl.DateFormat('EEEE، d MMMM', 'ar').format(now), style: const TextStyle(color: HadirBrand.lightMuted, fontSize: 9)),
        ]),
      ]),
    );
  }

  Widget _todayStatus() {
    final now = DateTime.now();
    final today = _todayEvents(now);
    final checkIn = _event(today, 'check-in');
    final checkOut = _event(today, 'check-out');
    final approved = _approvedToday(now);
    final leave = approved.any((r) => _requestType(r) == 'leave');
    final permission = approved.any((r) => _requestType(r) == 'permission');
    final schedule = _scheduleType();
    final workStart = _time(_employee['workStartTime'] ?? _employee['work_start_time']);
    final workEnd = _time(_employee['workEndTime'] ?? _employee['work_end_time']);
    final scheduledStart = _scheduledDate(now, workStart);
    final late = scheduledStart != null && now.isAfter(scheduledStart.add(Duration(minutes: _number(_employee['gracePeriodMinutes'] ?? _employee['grace_period_minutes'])))) && checkIn == null && !leave && !permission;

    String status;
    String detail;
    if (leave) {
      status = 'إجازة';
      detail = 'لديك إجازة معتمدة لهذا اليوم.';
    } else if (permission) {
      status = 'إذن';
      detail = 'لديك إذن معتمد لهذا اليوم.';
    } else if (checkOut != null) {
      status = 'انتهى الدوام';
      detail = 'تم تسجيل الانصراف لهذا اليوم.';
    } else if (checkIn != null) {
      status = 'حاضر';
      detail = 'أنت مسجل حضور الآن ويمكنك تسجيل الانصراف.';
    } else if (late) {
      status = 'متأخر';
      detail = workStart.isEmpty ? 'لم يتم تسجيل الحضور بعد.' : 'بدأ الدوام عند $workStart ولم يتم تسجيل الحضور بعد.';
    } else if (_isRestDay(now)) {
      status = 'مستريح';
      detail = 'اليوم خارج أيام العمل حسب جدولك.';
    } else {
      status = 'جاهز لتسجيل الحضور';
      detail = workStart.isEmpty ? 'لم يتم تسجيل حضورك بعد.' : 'يبدأ دوامك عند $workStart.';
    }
    final color = _statusColor(status);
    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('حالة اليوم', style: TextStyle(color: HadirBrand.lightMuted, fontSize: 10, fontWeight: FontWeight.w700)),
            const SizedBox(height: 3),
            Text(status, style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 3),
            Text(detail, style: const TextStyle(color: HadirBrand.lightMuted, fontSize: 10.5)),
          ])),
          _stateIcon(status, color),
        ]),
        const SizedBox(height: 13),
        Wrap(spacing: 7, runSpacing: 7, children: [
          _pill(Icons.schedule_rounded, schedule.isEmpty ? 'الجدول غير محدد' : schedule, color),
          if (workStart.isNotEmpty || workEnd.isNotEmpty) _pill(Icons.access_time_rounded, '${workStart.isEmpty ? '—' : workStart} - ${workEnd.isEmpty ? '—' : workEnd}', HadirBrand.lightPrimary),
          _pill(Icons.calendar_today_outlined, intl.DateFormat('EEEE، d MMMM', 'ar').format(now), HadirBrand.lightMuted),
        ]),
        if (late && checkIn == null) ...[
          const SizedBox(height: 10),
          _warning('تأخر تسجيل الحضور عن وقت بداية الدوام.'),
        ],
      ]),
    );
  }

  Widget _actions() {
    final today = _todayEvents(DateTime.now());
    final checkedIn = _event(today, 'check-in') != null;
    final checkedOut = _event(today, 'check-out') != null;
    final approved = _approvedToday(DateTime.now());
    final blocked = approved.any((r) => ['leave', 'permission'].contains(_requestType(r)));
    return Row(children: [
      Expanded(child: _action(Icons.login_rounded, 'تسجيل حضور', checkedIn ? 'تم تسجيل الحضور' : blocked ? 'لديك طلب معتمد' : 'التحقق وتسجيل الحضور', !checkedIn && !checkedOut && !blocked, () => context.push('/attendance?type=check-in'))),
      const SizedBox(width: 10),
      Expanded(child: _action(Icons.logout_rounded, 'تسجيل انصراف', checkedOut ? 'تم تسجيل الانصراف' : checkedIn ? 'إنهاء الدوام' : 'بعد تسجيل الحضور', checkedIn && !checkedOut, () => context.push('/attendance?type=check-out'))),
    ]);
  }

  Widget _dailySummary() {
    final today = _todayEvents(DateTime.now());
    final checkIn = _event(today, 'check-in');
    final checkOut = _event(today, 'check-out');
    return _section('ملخص اليوم', 'سجل الدوام', Row(children: [
      Expanded(child: _metric('الحضور', _eventTime(checkIn), Icons.login_rounded)),
      const SizedBox(width: 8),
      Expanded(child: _metric('الانصراف', _eventTime(checkOut), Icons.logout_rounded)),
      const SizedBox(width: 8),
      Expanded(child: _metric('مدة العمل', _workDuration(checkIn, checkOut), Icons.schedule_rounded)),
    ]));
  }

  Widget _workInfo() {
    final schedule = _scheduleType();
    final start = _time(_employee['workStartTime'] ?? _employee['work_start_time']);
    final end = _time(_employee['workEndTime'] ?? _employee['work_end_time']);
    final location = _text(_employee, ['locationName', 'location_name', 'location'], fallback: 'غير محدد');
    final device = _text(_device, ['deviceLabel', 'device_label', 'label'], fallback: _device.isEmpty ? 'غير متاح' : 'مرتبط بالحساب');
    final status = _employee['status'];
    return _section('معلومات الدوام', 'الجدول والموقع والجهاز', Column(children: [
      _info(Icons.calendar_today_outlined, 'نوع الجدول', schedule.isEmpty ? 'غير محدد' : schedule),
      _info(Icons.access_time_rounded, 'الفترة', '${start.isEmpty ? '—' : start} - ${end.isEmpty ? '—' : end}'),
      _info(Icons.verified_outlined, 'الحساب', status == null ? 'نشط' : _statusText(status)),
      _info(Icons.location_on_outlined, 'الموقع', location),
      _info(Icons.devices_other_rounded, 'الجهاز', device),
    ]));
  }

  Widget _requestCard() {
    final pending = _requests.where((r) => r is Map && ['pending', 'قيد الانتظار'].contains('${r['status'] ?? ''}'.toLowerCase())).length;
    return Material(color: HadirBrand.lightSoft, borderRadius: BorderRadius.circular(20), child: InkWell(onTap: () => context.push('/requests'), borderRadius: BorderRadius.circular(20), child: Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: HadirBrand.lightBorder)), child: Row(children: [
      _stateIcon('إذن', HadirBrand.lightPrimary, icon: Icons.event_note_outlined),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('طلب استئذان أو إجازة', style: TextStyle(color: HadirBrand.lightPrimary, fontWeight: FontWeight.w900, fontSize: 12)),
        const SizedBox(height: 3),
        Text(pending == 0 ? 'إرسال طلب للإدارة' : '$pending طلب قيد المراجعة', style: const TextStyle(color: HadirBrand.lightMuted, fontSize: 9.5)),
      ])),
      const Icon(Icons.chevron_left_rounded, color: HadirBrand.lightPrimary),
    ]))));
  }

  Widget _deviceCard() {
    final ok = _device['bound'] == true || _device['registered'] == true || _device['status'] == 'active' || _device['status'] == 'bound';
    final color = ok ? HadirBrand.lightPrimary : HadirBrand.lightWarning;
    return _section('أمان الجهاز', 'حالة ارتباط الجهاز بالحساب', Row(children: [
      _stateIcon(ok ? 'حاضر' : 'إذن', color, icon: Icons.phonelink_lock_outlined),
      const SizedBox(width: 10),
      Expanded(child: Text(ok ? 'الجهاز مرتبط بالحساب ويمكن استخدامه للحضور.' : 'تحقق من ارتباط جهازك قبل تسجيل الحضور.', style: const TextStyle(color: HadirBrand.lightText, fontSize: 10.5, fontWeight: FontWeight.w700))),
    ]));
  }

  Widget _section(String title, String subtitle, Widget child) => Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(21), border: Border.all(color: HadirBrand.lightBorder), boxShadow: const [BoxShadow(color: Color(0x0A142D27), blurRadius: 14, offset: Offset(0, 5))]), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: HadirBrand.lightText, fontSize: 15, fontWeight: FontWeight.w900)), const SizedBox(height: 2), Text(subtitle, style: const TextStyle(color: HadirBrand.lightMuted, fontSize: 9.5)), const SizedBox(height: 12), child]));

  Widget _card({required Widget child}) => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: HadirBrand.lightBorder), boxShadow: const [BoxShadow(color: Color(0x0A142D27), blurRadius: 16, offset: Offset(0, 6))]), child: child);

  Widget _action(IconData icon, String title, String subtitle, bool enabled, VoidCallback onTap) => Material(color: Colors.white, borderRadius: BorderRadius.circular(20), child: InkWell(onTap: enabled ? onTap : null, borderRadius: BorderRadius.circular(20), child: Container(constraints: const BoxConstraints(minHeight: 96), padding: const EdgeInsets.all(14), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: enabled ? HadirBrand.lightPrimary.withValues(alpha: .22) : HadirBrand.lightBorder)), child: Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: enabled ? HadirBrand.lightSoft : HadirBrand.lightBackground, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: enabled ? HadirBrand.lightPrimary : HadirBrand.lightMuted, size: 19)), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(title, style: TextStyle(color: enabled ? HadirBrand.lightText : HadirBrand.lightMuted, fontWeight: FontWeight.w900, fontSize: 12)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: HadirBrand.lightMuted, fontSize: 9.5))]))])));

  Widget _metric(String title, String value, IconData icon) => Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: HadirBrand.lightBackground, borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, color: HadirBrand.lightPrimary, size: 17), const SizedBox(height: 7), Text(title, style: const TextStyle(color: HadirBrand.lightMuted, fontSize: 8.5)), const SizedBox(height: 2), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: HadirBrand.lightText, fontWeight: FontWeight.w900, fontSize: 10.5))]));

  Widget _info(IconData icon, String title, String value) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(children: [Container(width: 31, height: 31, decoration: BoxDecoration(color: HadirBrand.lightPrimary.withValues(alpha: .12), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: HadirBrand.lightPrimary, size: 16)), const SizedBox(width: 9), Expanded(child: Text(title, style: const TextStyle(color: HadirBrand.lightMuted, fontSize: 10))), Flexible(child: Text(value, textAlign: TextAlign.end, overflow: TextOverflow.ellipsis, style: const TextStyle(color: HadirBrand.lightText, fontSize: 10.5, fontWeight: FontWeight.w800)))]));

  Widget _pill(IconData icon, String text, Color color) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7), decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(12)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 14, color: color), const SizedBox(width: 5), Text(text, style: TextStyle(color: color, fontSize: 9.5, fontWeight: FontWeight.w800))]));

  Widget _warning(String text) => Container(width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9), decoration: BoxDecoration(color: HadirBrand.lightWarning.withValues(alpha: .10), borderRadius: BorderRadius.circular(12)), child: Row(children: [const Icon(Icons.warning_amber_rounded, size: 16, color: HadirBrand.lightWarning), const SizedBox(width: 6), Expanded(child: Text(text, style: const TextStyle(color: HadirBrand.lightWarning, fontSize: 9.5, fontWeight: FontWeight.w800)))]));

  Widget _stateIcon(String status, Color color, {IconData? icon}) => Container(width: 48, height: 48, decoration: BoxDecoration(color: color.withValues(alpha: .13), borderRadius: BorderRadius.circular(15), border: Border.all(color: color.withValues(alpha: .22))), child: Icon(icon ?? _statusIcon(status), color: color));

  Widget _avatar(String url, String name) {
    if (url.isNotEmpty) return ClipRRect(borderRadius: BorderRadius.circular(17), child: Image.network(url, width: 58, height: 58, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _avatarFallback(name)));
    return _avatarFallback(name);
  }

  Widget _avatarFallback(String name) => Container(width: 58, height: 58, decoration: BoxDecoration(color: HadirBrand.lightSoft, borderRadius: BorderRadius.circular(17), border: Border.all(color: HadirBrand.lightPrimary.withValues(alpha: .20))), child: Center(child: Text(name.trim().isEmpty ? 'م' : name.trim().substring(0, 1), style: const TextStyle(color: HadirBrand.lightPrimary, fontSize: 20, fontWeight: FontWeight.w900))));

  List<dynamic> _todayEvents(DateTime now) => _attendance.where((x) { if (x is! Map) return false; final stamp = DateTime.tryParse('${x['timestamp'] ?? x['createdAt'] ?? x['created_at'] ?? ''}'); return stamp != null && stamp.year == now.year && stamp.month == now.month && stamp.day == now.day; }).toList();

  Map<String, dynamic>? _event(List<dynamic> events, String type) { for (final x in events) { if (x is Map && '${x['type'] ?? ''}'.toLowerCase() == type) return Map<String, dynamic>.from(x); } return null; }

  List<Map<String, dynamic>> _approvedToday(DateTime now) => _requests.whereType<Map>().map((x) => Map<String, dynamic>.from(x)).where((r) { final status = '${r['status'] ?? ''}'.toLowerCase(); if (!['approved', 'confirmed', 'مقبول', 'معتمد'].contains(status)) return false; final start = DateTime.tryParse('${r['startDate'] ?? r['start_date'] ?? r['createdAt'] ?? ''}'); final end = DateTime.tryParse('${r['endDate'] ?? r['end_date'] ?? r['startDate'] ?? r['start_date'] ?? r['createdAt'] ?? ''}'); if (start == null) return false; final a = DateTime(now.year, now.month, now.day); final b = DateTime(start.year, start.month, start.day); final c = DateTime((end ?? start).year, (end ?? start).month, (end ?? start).day); return !a.isBefore(b) && !a.isAfter(c); }).toList();

  bool _isRestDay(DateTime now) { final days = _employee['workDays'] ?? _employee['work_days'] ?? _employee['workDaysJson'] ?? _employee['work_days_json']; if (days is List && days.isNotEmpty) { final day = now.weekday; return !days.any((x) => _weekdayValue(x) == day); } return false; }

  int _weekdayValue(Object? value) { final s = '$value'.toLowerCase(); if (value is num) return value.toInt().clamp(1, 7); const names = {'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 7, 'الاثنين': 1, 'الثلاثاء': 2, 'الأربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'السبت': 6, 'الأحد': 7}; return names[s] ?? -1; }

  DateTime? _scheduledDate(DateTime now, String time) { if (time.isEmpty) return null; final parts = time.split(':'); if (parts.length < 2) return null; final h = int.tryParse(parts[0]); final m = int.tryParse(parts[1]); if (h == null || m == null) return null; return DateTime(now.year, now.month, now.day, h, m); }

  String _scheduleType() { final value = '${_employee['scheduleType'] ?? _employee['schedule_type'] ?? ''}'.toUpperCase(); if (value == 'ROTATION' || value.contains('تناوب')) return 'مناوبة'; if (value == 'ADMIN' || value.contains('إداري')) return 'جدول إداري'; return value.isEmpty ? '' : value; }

  String _time(Object? value) { final s = '$value'; if (value == null || s == 'null' || s.isEmpty) return ''; final match = RegExp(r'^(\d{1,2}:\d{2})').firstMatch(s); return match?.group(1) ?? s; }

  int _number(Object? value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;

  String _text(Map<String, dynamic> map, List<String> keys, {String fallback = ''}) { for (final key in keys) { final value = map[key]; if (value != null && '$value'.trim().isNotEmpty && '$value' != 'null') return '$value'; } return fallback; }

  String _requestType(Map<String, dynamic> r) => '${r['type'] ?? ''}'.toLowerCase();

  String _eventTime(Map<String, dynamic>? event) { if (event == null) return '—'; final raw = event['timestamp'] ?? event['createdAt'] ?? event['created_at']; final d = DateTime.tryParse('$raw'); return d == null ? '—' : intl.DateFormat('HH:mm').format(d.toLocal()); }

  String _workDuration(Map<String, dynamic>? start, Map<String, dynamic>? end) { final a = start == null ? null : DateTime.tryParse('${start['timestamp'] ?? start['createdAt'] ?? start['created_at'] ?? ''}'); final b = end == null ? DateTime.now() : DateTime.tryParse('${end['timestamp'] ?? end['createdAt'] ?? end['created_at'] ?? ''}'); if (a == null || b == null || b.isBefore(a)) return '—'; final minutes = b.difference(a).inMinutes; return '${minutes ~/ 60}س ${minutes % 60}د'; }

  String _statusText(Object? status) { final s = '$status'.toLowerCase(); if (s == 'active' || s == 'نشط') return 'نشط'; if (s == 'suspended' || s == 'موقوف') return 'موقوف'; return '$status'; }

  Color _statusColor(String status) { switch (status) { case 'حاضر': case 'انتهى الدوام': return HadirBrand.lightPrimary; case 'متأخر': case 'إذن': return HadirBrand.lightWarning; case 'إجازة': return HadirBrand.lightAccent; case 'غائب': case 'هارب': return HadirBrand.lightDanger; case 'مستريح': return const Color(0xFF2563A6); default: return HadirBrand.lightPrimary; } }

  IconData _statusIcon(String status) { switch (status) { case 'حاضر': return Icons.work_history_rounded; case 'انتهى الدوام': return Icons.task_alt_rounded; case 'متأخر': return Icons.schedule_rounded; case 'إذن': return Icons.event_available_rounded; case 'إجازة': return Icons.beach_access_rounded; case 'غائب': return Icons.person_off_rounded; case 'هارب': return Icons.directions_run_rounded; case 'مستريح': return Icons.hotel_rounded; default: return Icons.access_time_rounded; } }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();
  @override
  Widget build(BuildContext context) => Container(height: 82, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)), child: const Center(child: CircularProgressIndicator(strokeWidth: 2)));
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: HadirBrand.lightDanger.withValues(alpha: .08), borderRadius: BorderRadius.circular(18), border: Border.all(color: HadirBrand.lightDanger.withValues(alpha: .18))), child: Row(children: [const Icon(Icons.cloud_off_rounded, color: HadirBrand.lightDanger), const SizedBox(width: 8), Expanded(child: Text(message, style: const TextStyle(color: HadirBrand.lightDanger, fontSize: 10.5, fontWeight: FontWeight.w700)))]));
}
