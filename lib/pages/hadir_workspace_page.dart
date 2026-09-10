import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;

import '../core/api.dart';
import '../core/session.dart';

class HadirWorkspacePage extends StatefulWidget {
  const HadirWorkspacePage({super.key});

  @override
  State<HadirWorkspacePage> createState() => _HadirWorkspacePageState();
}

class _HadirWorkspacePageState extends State<HadirWorkspacePage> {
  final _session = HadirSession();
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _profile = <String, dynamic>{};
  List<dynamic> _attendance = const [];
  List<dynamic> _requests = const [];
  List<dynamic> _notifications = const [];
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
        _now = DateTime.now();
      });
    }
    try {
      final token = await _session.token();
      final api = HadirApi(token: token);
      final results = await Future.wait<Object?>([
        api.employeeProfile(),
        api.attendance(limit: 500),
        api.requests(),
        api.notifications(),
      ]);
      if (!mounted) return;
      setState(() {
        _profile = results[0] is Map
            ? Map<String, dynamic>.from(results[0] as Map)
            : <String, dynamic>{};
        _attendance = results[1] is List ? results[1] as List : const [];
        _requests = results[2] is List ? results[2] as List : const [];
        _notifications = results[3] is List ? results[3] as List : const [];
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

  String _text(String key, [String fallback = '']) {
    final value = _profile[key];
    final text = '${value ?? ''}'.trim();
    return text.isEmpty ? fallback : text;
  }

  DateTime? _date(dynamic value) => value == null ? null : DateTime.tryParse('$value');

  List<Map<String, dynamic>> get _attendanceMaps => _attendance
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();

  List<Map<String, dynamic>> get _requestMaps => _requests
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();

  List<Map<String, dynamic>> _todayAttendance() {
    return _attendanceMaps.where((item) {
      final date = _date(item['timestamp'] ?? item['time']);
      return date != null && date.year == _now.year && date.month == _now.month && date.day == _now.day;
    }).toList()
      ..sort((a, b) => '${a['timestamp'] ?? ''}'.compareTo('${b['timestamp'] ?? ''}'));
  }

  List<Map<String, dynamic>> _todayApprovedRequests() {
    final today = intl.DateFormat('yyyy-MM-dd').format(_now);
    return _requestMaps.where((item) {
      final status = '${item['status'] ?? ''}'.toLowerCase();
      if (status != 'approved' && status != 'confirmed') return false;
      final start = '${item['startDate'] ?? item['createdAt'] ?? ''}'.split('T').first;
      final end = '${item['endDate'] ?? item['startDate'] ?? item['createdAt'] ?? ''}'.split('T').first;
      return start.isNotEmpty && end.isNotEmpty && start <= today && today <= end;
    }).toList();
  }

  Map<String, dynamic>? _event(List<Map<String, dynamic>> rows, String type) {
    for (final row in rows) {
      if ('${row['type'] ?? ''}' == type) return row;
    }
    return null;
  }

  String _time(dynamic value) {
    final date = _date(value);
    return date == null ? '—' : intl.DateFormat('HH:mm').format(date);
  }

  String _duration(DateTime? from, DateTime? to) {
    if (from == null) return '—';
    final end = to ?? _now;
    final minutes = end.difference(from).inMinutes;
    if (minutes < 0) return '—';
    return '${minutes ~/ 60}س ${minutes % 60}د';
  }

  String _clock(String value, String fallback) => RegExp(r'^\d{1,2}:\d{2}$').hasMatch(value) ? value : fallback;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        color: colors.surface,
        child: RefreshIndicator(
          color: colors.primary,
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
            children: [
              _employeeHero(colors),
              const SizedBox(height: 12),
              if (_loading && _profile.isEmpty)
                const _LoadingCard()
              else if (_error != null && _profile.isEmpty)
                _messageCard(colors, _error!, Icons.cloud_off_rounded)
              else ...[
                _statusCard(colors),
                const SizedBox(height: 12),
                _actions(colors),
                const SizedBox(height: 12),
                _summaryCard(colors),
                const SizedBox(height: 12),
                _workInfoCard(colors),
                const SizedBox(height: 12),
                _requestBanner(colors),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  _messageCard(colors, _error!, Icons.cloud_off_rounded),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _employeeHero(ColorScheme colors) {
    final name = _text('name', 'الموظف');
    final jobNumber = _text('jobNumber', '—');
    final location = _text('locationName', 'الموقع المخصص');
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: colors.primary.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.primary.withValues(alpha: .25)),
            ),
            child: Icon(Icons.person_rounded, color: colors.primary, size: 29),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('مرحبًا بك', style: TextStyle(color: colors.onSurfaceVariant, fontSize: 12)),
                const SizedBox(height: 2),
                Text(name, style: TextStyle(color: colors.onSurface, fontSize: 18, fontWeight: FontWeight.w900)),
                const SizedBox(height: 2),
                Text('$jobNumber · $location', style: TextStyle(color: colors.onSurfaceVariant, fontSize: 11)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(intl.DateFormat('HH:mm').format(_now), style: TextStyle(color: colors.onSurface, fontSize: 20, fontWeight: FontWeight.w900)),
              const SizedBox(height: 2),
              Text(intl.DateFormat('EEE، d MMM', 'ar').format(_now), style: TextStyle(color: colors.onSurfaceVariant, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statusCard(ColorScheme colors) {
    final today = _todayAttendance();
    final checkIn = _event(today, 'check-in');
    final checkOut = _event(today, 'check-out');
    final approved = _todayApprovedRequests();
    final hasLeave = approved.any((x) => '${x['type'] ?? ''}'.toLowerCase() == 'leave');
    final hasPermission = approved.any((x) => '${x['type'] ?? ''}'.toLowerCase() == 'permission');
    final scheduleType = _text('scheduleType', '').toUpperCase();
    final isRotation = scheduleType == 'ROTATION';
    final workStart = _clock(_text('workStartTime'), '09:00');
    final workEnd = _clock(_text('workEndTime'), '16:00');
    final isWorkDay = _isWorkDay();
    String label;
    String detail;
    Color tone;
    if (hasLeave) {
      label = 'إجازة';
      detail = 'لديك إجازة معتمدة لهذا اليوم.';
      tone = colors.secondary;
    } else if (hasPermission) {
      label = 'إذن';
      detail = 'لديك إذن معتمد لهذا اليوم.';
      tone = colors.secondary;
    } else if (!isWorkDay) {
      label = 'راحة';
      detail = 'اليوم ليس ضمن أيام العمل.';
      tone = colors.secondary;
    } else if (checkIn != null && checkOut == null) {
      final late = _lateMinutes(checkIn, workStart);
      label = late > 0 ? 'متأخر' : 'حاضر';
      detail = late > 0 ? 'تم تسجيل حضورك بعد بداية الفترة.' : 'أنت مسجل حضور الآن.';
      tone = late > 0 ? Colors.orange : colors.primary;
    } else if (checkIn != null && checkOut != null) {
      label = 'حاضر';
      detail = 'تم تسجيل الانصراف لهذا اليوم.';
      tone = colors.primary;
    } else {
      label = 'لم تبدأ المناوبة';
      detail = 'لم يحن وقت بداية المناوبة بعد.';
      tone = colors.secondary;
    }
    final late = checkIn == null ? 0 : _lateMinutes(checkIn, workStart);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tone.withValues(alpha: .32)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('حالة اليوم', style: TextStyle(color: colors.onSurfaceVariant, fontSize: 12)),
                  const SizedBox(height: 2),
                  Text(label, style: TextStyle(color: colors.onSurface, fontSize: 19, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 2),
                  Text(detail, style: TextStyle(color: colors.onSurfaceVariant, fontSize: 11)),
                ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: tone.withValues(alpha: .12), borderRadius: BorderRadius.circular(20)),
                child: Text(label, style: TextStyle(color: tone, fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            isRotation ? '${_text('rotationDaysOn', '4')} أيام عمل + ${_text('rotationDaysOff', '4')} أيام راحة' : '$workStart → $workEnd',
            style: TextStyle(color: colors.onSurfaceVariant, fontSize: 11),
          ),
          if (late > 0) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.orange.withValues(alpha: .10), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.orange.withValues(alpha: .35))),
              child: Text('تم رصد تأخر $late دقيقة عن بداية الفترة.', style: const TextStyle(color: Colors.orange, fontSize: 11)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _actions(ColorScheme colors) {
    final today = _todayAttendance();
    final checkIn = _event(today, 'check-in');
    final checkOut = _event(today, 'check-out');
    final approved = _todayApprovedRequests();
    final blocked = approved.any((x) {
      final type = '${x['type'] ?? ''}'.toLowerCase();
      return type == 'leave' || type == 'permission';
    });
    final canIn = checkIn == null && checkOut == null && !blocked && _isWorkDay();
    final canOut = checkIn != null && checkOut == null;
    return Row(
      children: [
        Expanded(child: _actionCard(colors, 'تسجيل حضور', canIn ? 'مسح رمز QR' : 'غير متاح الآن', Icons.login_rounded, canIn, () => context.push('/employee/scan/check-in'))),
        const SizedBox(width: 12),
        Expanded(child: _actionCard(colors, 'تسجيل انصراف', canOut ? 'إنهاء الدوام' : 'بعد تسجيل الحضور', Icons.logout_rounded, canOut, () => context.push('/employee/scan/check-out'))),
      ],
    );
  }

  Widget _actionCard(ColorScheme colors, String title, String subtitle, IconData icon, bool enabled, VoidCallback onTap) {
    final tone = icon == Icons.logout_rounded ? colors.secondary : colors.primary;
    return Material(
      color: colors.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: enabled ? tone.withValues(alpha: .28) : colors.outlineVariant)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 40, height: 40, decoration: BoxDecoration(color: enabled ? tone.withValues(alpha: .12) : colors.surface, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: enabled ? tone : colors.onSurfaceVariant, size: 20)),
            const SizedBox(height: 10),
            Text(title, style: TextStyle(color: enabled ? colors.onSurface : colors.onSurfaceVariant, fontWeight: FontWeight.w900, fontSize: 13)),
            const SizedBox(height: 2),
            Text(subtitle, style: TextStyle(color: colors.onSurfaceVariant, fontSize: 10)),
          ]),
        ),
      ),
    );
  }

  Widget _summaryCard(ColorScheme colors) {
    final today = _todayAttendance();
    final checkIn = _event(today, 'check-in');
    final checkOut = _event(today, 'check-out');
    return _card(colors, 'ملخص اليوم', 'سجل الدوام', Row(children: [
      Expanded(child: _stat(colors, 'الحضور', _time(checkIn?['timestamp'] ?? checkIn?['time']), Icons.login_rounded)),
      const SizedBox(width: 8),
      Expanded(child: _stat(colors, 'الانصراف', _time(checkOut?['timestamp'] ?? checkOut?['time']), Icons.logout_rounded)),
      const SizedBox(width: 8),
      Expanded(child: _stat(colors, 'مدة العمل', _duration(_date(checkIn?['timestamp'] ?? checkIn?['time']), _date(checkOut?['timestamp'] ?? checkOut?['time'])), Icons.schedule_rounded)),
    ]));
  }

  Widget _workInfoCard(ColorScheme colors) {
    final scheduleType = _text('scheduleType', '').toUpperCase();
    final isRotation = scheduleType == 'ROTATION';
    final start = _clock(_text('workStartTime'), '09:00');
    final end = _clock(_text('workEndTime'), '16:00');
    final status = _statusLabel();
    final device = _text('deviceLabel', 'غير مرتبط');
    final location = _text('locationName', 'الموقع المخصص');
    return _card(colors, 'معلومات الدوام', 'حالتك الحالية', Column(children: [
      _rowInfo(colors, 'الفترة', isRotation ? '${_text('rotationDaysOn', '4')} أيام عمل + ${_text('rotationDaysOff', '4')} أيام راحة' : '$start → $end'),
      _rowInfo(colors, isRotation ? 'وقت المناوبة' : 'الفترة', '$start → $end'),
      _rowInfo(colors, 'الحالة', status),
      _rowInfo(colors, 'الجهاز', device),
      _rowInfo(colors, 'الموقع', location),
    ]));
  }

  Widget _card(ColorScheme colors, String title, String subtitle, Widget child) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: colors.surfaceContainerHighest, borderRadius: BorderRadius.circular(18), border: Border.all(color: colors.outlineVariant)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(color: colors.onSurfaceVariant, fontSize: 12)),
        const SizedBox(height: 2),
        Text(subtitle, style: TextStyle(color: colors.onSurface, fontWeight: FontWeight.w900, fontSize: 15)),
        const SizedBox(height: 12),
        child,
      ]),
    );
  }

  Widget _stat(ColorScheme colors, String title, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: colors.primary, size: 17),
        const SizedBox(height: 7),
        Text(title, style: TextStyle(color: colors.onSurfaceVariant, fontSize: 9)),
        const SizedBox(height: 2),
        Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: colors.onSurface, fontWeight: FontWeight.w900, fontSize: 10.5)),
      ]),
    );
  }

  Widget _rowInfo(ColorScheme colors, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Expanded(child: Text(title, style: TextStyle(color: colors.onSurfaceVariant, fontSize: 11))),
        Flexible(child: Text(value, textAlign: TextAlign.end, overflow: TextOverflow.ellipsis, style: TextStyle(color: colors.onSurface, fontSize: 11, fontWeight: FontWeight.w800))),
      ]),
    );
  }

  Widget _requestBanner(ColorScheme colors) {
    return Material(
      color: colors.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: _openRequestDialog,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: colors.secondary.withValues(alpha: .28))),
          child: Row(children: [
            Container(width: 42, height: 42, decoration: BoxDecoration(color: colors.secondary.withValues(alpha: .12), borderRadius: BorderRadius.circular(13)), child: Icon(Icons.event_note_outlined, color: colors.secondary)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('طلب استئذان أو إجازة', style: TextStyle(color: colors.secondary, fontWeight: FontWeight.w900, fontSize: 13)), const SizedBox(height: 2), Text('إرسال طلب للإدارة', style: TextStyle(color: colors.onSurfaceVariant, fontSize: 10))])),
            Icon(Icons.chevron_left_rounded, color: colors.secondary),
          ]),
        ),
      ),
    );
  }

  Future<void> _openRequestDialog() async {
    String type = 'permission';
    String reason = '';
    String startDate = intl.DateFormat('yyyy-MM-dd').format(_now);
    String endDate = startDate;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final ranged = type == 'permission' || type == 'leave';
          return AlertDialog(
            title: const Text('طلب استئذان أو إجازة'),
            content: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                DropdownButtonFormField<String>(
                  value: type,
                  decoration: const InputDecoration(labelText: 'نوع الطلب'),
                  items: const [
                    DropdownMenuItem(value: 'permission', child: Text('إذن')),
                    DropdownMenuItem(value: 'leave', child: Text('إجازة')),
                    DropdownMenuItem(value: 'checkout', child: Text('انصراف مبكر')),
                  ],
                  onChanged: (value) => setDialogState(() => type = value ?? type),
                ),
                if (ranged) ...[
                  const SizedBox(height: 10),
                  TextFormField(initialValue: startDate, decoration: const InputDecoration(labelText: 'تاريخ البداية'), onChanged: (v) => startDate = v),
                  const SizedBox(height: 8),
                  TextFormField(initialValue: endDate, decoration: const InputDecoration(labelText: 'تاريخ النهاية'), onChanged: (v) => endDate = v),
                ],
                const SizedBox(height: 10),
                TextFormField(maxLines: 3, decoration: const InputDecoration(labelText: 'السبب'), onChanged: (v) => reason = v),
              ]),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('إلغاء')),
              FilledButton(
                onPressed: () async {
                  if (ranged && (startDate.isEmpty || endDate.isEmpty || endDate.compareTo(startDate) < 0)) return;
                  try {
                    final token = await _session.token();
                    final api = HadirApi(token: token);
                    await api.createRequest(type: type, reason: reason.trim(), startDate: ranged ? startDate : null, endDate: ranged ? endDate : null, employeeId: _text('id'));
                    if (!mounted) return;
                    Navigator.of(dialogContext).pop();
                    await _load();
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إرسال الطلب للإدارة.')));
                  } catch (e) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(HadirApi.errorMessage(e))));
                  }
                },
                child: const Text('إرسال'),
              ),
            ],
          );
        },
      ),
    );
  }

  int _lateMinutes(Map<String, dynamic> checkIn, String workStart) {
    final stamp = _date(checkIn['timestamp'] ?? checkIn['time']);
    if (stamp == null) return 0;
    final parts = workStart.split(':');
    if (parts.length != 2) return 0;
    final scheduled = DateTime(stamp.year, stamp.month, stamp.day, int.tryParse(parts[0]) ?? 9, int.tryParse(parts[1]) ?? 0);
    final grace = int.tryParse('${_profile['gracePeriodMinutes'] ?? 10}') ?? 10;
    return ((stamp.difference(scheduled).inMinutes) - grace).clamp(0, 100000);
  }

  bool _isWorkDay() {
    final days = _profile['workDays'];
    if (days is List && days.isNotEmpty) {
      final weekday = _now.weekday;
      return days.any((day) {
        final text = '$day'.toLowerCase();
        return text == '$weekday' || text == _weekdayName(weekday) || text.contains(_weekdayName(weekday));
      });
    }
    return true;
  }

  String _weekdayName(int day) {
    const names = <String>['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return names[day - 1];
  }

  String _statusLabel() {
    final today = _todayAttendance();
    final checkIn = _event(today, 'check-in');
    final checkOut = _event(today, 'check-out');
    final approved = _todayApprovedRequests();
    if (approved.any((x) => '${x['type'] ?? ''}'.toLowerCase() == 'leave')) return 'إجازة';
    if (approved.any((x) => '${x['type'] ?? ''}'.toLowerCase() == 'permission')) return 'إذن';
    if (!_isWorkDay()) return 'راحة';
    if (checkIn != null) return _lateMinutes(checkIn, _clock(_text('workStartTime'), '09:00')) > 0 ? 'متأخر' : 'حاضر';
    if (checkOut != null) return 'حاضر';
    return 'لم تبدأ المناوبة';
  }

  Widget _messageCard(ColorScheme colors, String text, IconData icon) {
    return Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: colors.surfaceContainerHighest, borderRadius: BorderRadius.circular(16), border: Border.all(color: colors.outlineVariant)), child: Row(children: [Icon(icon, color: colors.onSurfaceVariant), const SizedBox(width: 10), Expanded(child: Text(text, style: TextStyle(color: colors.onSurfaceVariant, fontSize: 11)))]));
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(height: 160, child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
  }
}
