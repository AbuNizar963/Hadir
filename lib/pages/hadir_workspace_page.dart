import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;

import '../core/api.dart';
import '../core/session.dart';

const _green = Color(0xFF0B6B5A);
const _greenDark = Color(0xFF064B40);
const _soft = Color(0xFFE8F5F0);
const _bg = Color(0xFFF6F8F7);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF71817C);
const _line = Color(0xFFE0E8E5);

class HadirWorkspacePage extends StatefulWidget {
  const HadirWorkspacePage({super.key});
  @override
  State<HadirWorkspacePage> createState() => _HadirWorkspacePageState();
}

class _HadirWorkspacePageState extends State<HadirWorkspacePage> {
  final _session = HadirSession();
  bool _loading = true;
  String? _error;
  String _name = 'الموظف';
  String _jobNumber = '';
  String _locationName = 'الموقع المخصص للعمل';
  String _deviceStatus = 'مرتبط بالحساب';
  String _scheduleType = 'حسب جدول الموظف';
  String _workStart = '';
  String _workEnd = '';
  int _grace = 0;
  String? _avatarUrl;
  List<dynamic> _attendance = const [];
  List<dynamic> _requests = const [];
  List<dynamic> _notifications = const [];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.token();
      final api = HadirApi(token: token);
      final results = await Future.wait<dynamic>([
        api.me(), api.employeeProfile(), api.attendance(limit: 200), api.requests(), api.notifications(), api.employeeDeviceStatus(),
      ]);
      final me = results[0] as Map<String, dynamic>;
      final profile = results[1] as Map<String, dynamic>;
      final device = results[5] as Map<String, dynamic>;
      final user = _map(me['user']) ?? _map(profile['user']) ?? me;
      final employee = _map(profile['employee']) ?? _map(me['employee']) ?? profile;
      final schedule = _map(employee['schedule']) ?? _map(profile['schedule']) ?? _map(me['schedule']);
      final location = _map(employee['location']) ?? _map(profile['location']);
      final employeeId = '${employee['id'] ?? me['employeeId'] ?? profile['employeeId'] ?? ''}';
      final avatar = '${employee['avatarUrl'] ?? profile['avatarUrl'] ?? user['avatarUrl'] ?? ''}';
      if (!mounted) return;
      setState(() {
        _name = '${employee['name'] ?? user['name'] ?? 'الموظف'}';
        _jobNumber = '${employee['jobNumber'] ?? user['jobNumber'] ?? ''}';
        _locationName = '${location?['name'] ?? employee['locationName'] ?? profile['locationName'] ?? 'الموقع المخصص للعمل'}';
        _deviceStatus = device['bound'] == true || device['bound'] == 'true' ? 'مرتبط' : '${device['status'] ?? 'مرتبط بالحساب'}';
        _scheduleType = '${schedule?['type'] ?? employee['scheduleType'] ?? profile['scheduleType'] ?? 'حسب جدول الموظف'}';
        _workStart = '${schedule?['workStartTime'] ?? employee['workStartTime'] ?? profile['workStartTime'] ?? ''}';
        _workEnd = '${schedule?['workEndTime'] ?? employee['workEndTime'] ?? profile['workEndTime'] ?? ''}';
        _grace = int.tryParse('${schedule?['gracePeriodMinutes'] ?? employee['gracePeriodMinutes'] ?? profile['gracePeriodMinutes'] ?? 0}') ?? 0;
        _avatarUrl = avatar.isNotEmpty ? avatar : (employeeId.isNotEmpty ? api.employeeAvatarUrl(employeeId) : null);
        _attendance = results[2] as List<dynamic>;
        _requests = results[3] as List<dynamic>;
        _notifications = results[4] as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(e); });
    }
  }

  Map<String, dynamic>? _map(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : null;

  @override
  Widget build(BuildContext context) => Directionality(textDirection: TextDirection.rtl, child: Container(color: _bg, child: _dashboard()));

  Widget _dashboard() {
    final now = DateTime.now();
    final today = _todayAttendance(now);
    final checkedIn = today.any((x) => x is Map && x['type'] == 'check-in');
    final checkedOut = today.any((x) => x is Map && x['type'] == 'check-out');
    final active = checkedIn && !checkedOut;
    final checkIn = _firstTodayEvent(today, 'check-in');
    final checkOut = _firstTodayEvent(today, 'check-out');
    final approved = _todayApprovedRequests(now);
    final hasLeave = approved.any((x) => _requestType(x) == 'leave');
    final hasPermission = approved.any((x) => _requestType(x) == 'permission');
    final schedule = _scheduleState(now, checkedIn, checkedOut);
    final status = hasLeave ? 'إجازة' : hasPermission ? 'إذن' : schedule['status'] as String;
    final detail = hasLeave ? 'لديك إجازة معتمدة لهذا اليوم.' : hasPermission ? 'لديك إذن معتمد لهذا اليوم.' : schedule['detail'] as String;
    final canCheckIn = !checkedIn && !checkedOut && !hasLeave && !hasPermission && schedule['canStart'] == true;

    return RefreshIndicator(
      color: _green,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
        children: [
          _employeeHero(now),
          const SizedBox(height: 12),
          _statusCard(now: now, status: status, detail: detail, active: active, checkedOut: checkedOut, countdown: schedule['countdown'] as String?, lateMinutes: schedule['late'] as int),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _dashboardAction(icon: Icons.login_rounded, title: 'تسجيل حضور', subtitle: hasLeave || hasPermission ? status : checkedIn ? 'تم تسجيل الحضور' : schedule['canStart'] == true ? 'مسح رمز QR' : 'خارج وقت الدوام', enabled: canCheckIn, onTap: () => context.push('/attendance?type=check-in'))),
            const SizedBox(width: 10),
            Expanded(child: _dashboardAction(icon: Icons.logout_rounded, title: 'تسجيل انصراف', subtitle: active ? 'إنهاء الدوام' : checkOut != null ? 'تم تسجيل الانصراف' : 'بعد تسجيل الحضور', enabled: active, onTap: () => context.push('/attendance?type=check-out'))),
          ]),
          const SizedBox(height: 12),
          _sectionCard(title: 'ملخص اليوم', subtitle: 'سجل الدوام', child: Row(children: [
            Expanded(child: _summaryItem('الحضور', _eventTime(checkIn), Icons.login_rounded)), const SizedBox(width: 8),
            Expanded(child: _summaryItem('الانصراف', _eventTime(checkOut), Icons.logout_rounded)), const SizedBox(width: 8),
            Expanded(child: _summaryItem('مدة العمل', _workHours(), Icons.schedule_rounded)),
          ])),
          const SizedBox(height: 12),
          _sectionCard(title: 'معلومات الدوام', subtitle: 'الجدول والموقع والجهاز', child: Column(children: [
            _infoRow(Icons.calendar_today_outlined, 'نوع الجدول', _scheduleType),
            _infoRow(Icons.access_time_rounded, 'الفترة', _periodText()),
            _infoRow(Icons.verified_outlined, 'الحالة', status),
            _infoRow(Icons.location_on_outlined, 'الموقع', _locationName),
            _infoRow(Icons.devices_other_rounded, 'الجهاز', _deviceStatus),
          ])),
          const SizedBox(height: 12),
          _requestBanner(),
          if (_loading) ...[const SizedBox(height: 12), const _LoadingCard()],
          if (_error != null) ...[const SizedBox(height: 12), _messageCard(_error!, Icons.cloud_off_rounded)],
        ],
      ),
    );
  }

  Widget _employeeHero(DateTime now) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line), boxShadow: const [BoxShadow(color: Color(0x0A142D27), blurRadius: 16, offset: Offset(0, 6))]),
    child: Row(children: [
      _avatar(), const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('مرحبًا بك', style: TextStyle(color: _muted, fontSize: 10)),
        Text(_name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _ink, fontSize: 16, fontWeight: FontWeight.w900)),
        Text([if (_jobNumber.isNotEmpty) _jobNumber, if (_locationName.isNotEmpty) _locationName].join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _green, fontSize: 9.5, fontWeight: FontWeight.w800)),
      ])),
      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Text(intl.DateFormat('HH:mm').format(now), style: const TextStyle(color: _ink, fontSize: 17, fontWeight: FontWeight.w900)), const SizedBox(height: 2),
        Text(intl.DateFormat('EEEE، d MMMM', 'ar').format(now), style: const TextStyle(color: _muted, fontSize: 9.5)),
      ]),
    ]),
  );

  Widget _statusCard({required DateTime now, required String status, required String detail, required bool active, required bool checkedOut, String? countdown, required int lateMinutes}) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line), boxShadow: const [BoxShadow(color: Color(0x0D142D27), blurRadius: 18, offset: Offset(0, 7))]),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('حالة اليوم', style: TextStyle(color: _muted, fontSize: 10, fontWeight: FontWeight.w700)), const SizedBox(height: 3), Text(status, style: const TextStyle(color: _ink, fontSize: 22, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(detail, style: const TextStyle(color: _muted, fontSize: 10.5))])), Container(width: 48, height: 48, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(15)), child: Icon(checkedOut ? Icons.task_alt_rounded : active ? Icons.work_history_rounded : Icons.access_time_rounded, color: _green))]),
      if (countdown != null && countdown.isNotEmpty) ...[const SizedBox(height: 12), Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10), decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(14)), child: Row(children: [const Icon(Icons.timer_outlined, size: 17, color: _green), const SizedBox(width: 7), const Expanded(child: Text('العد التنازلي للدوام', style: TextStyle(color: _green, fontSize: 10.5, fontWeight: FontWeight.w800))), Text(countdown, style: const TextStyle(color: _green, fontSize: 12, fontWeight: FontWeight.w900))]))],
      if (lateMinutes > 0) ...[const SizedBox(height: 9), Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9), decoration: BoxDecoration(color: const Color(0xFFFFF5E6), borderRadius: BorderRadius.circular(13)), child: Row(children: [const Icon(Icons.warning_amber_rounded, size: 17, color: Color(0xFFB76E00)), const SizedBox(width: 7), Text('تأخر $lateMinutes دقيقة عن بداية الدوام', style: const TextStyle(color: Color(0xFF8A5600), fontSize: 10.5, fontWeight: FontWeight.w800))]))],
      const SizedBox(height: 12), Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10), decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(14)), child: Row(children: [const Icon(Icons.location_on_outlined, size: 16, color: _green), const SizedBox(width: 6), Expanded(child: Text(_locationName, style: const TextStyle(color: _ink, fontSize: 10.5, fontWeight: FontWeight.w800))), Text(intl.DateFormat('d MMMM', 'ar').format(now), style: const TextStyle(color: _muted, fontSize: 9.5))])),
    ]),
  );

  Widget _dashboardAction({required IconData icon, required String title, required String subtitle, required bool enabled, required VoidCallback onTap}) => Material(color: Colors.white, borderRadius: BorderRadius.circular(20), child: InkWell(onTap: enabled ? onTap : null, borderRadius: BorderRadius.circular(20), child: Container(constraints: const BoxConstraints(minHeight: 96), padding: const EdgeInsets.all(14), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: enabled ? _green.withValues(alpha: .22) : _line)), child: Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: enabled ? _soft : _bg, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: enabled ? _green : _muted, size: 19)), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(title, style: TextStyle(color: enabled ? _ink : _muted, fontWeight: FontWeight.w900, fontSize: 12)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 9.5))]))])));
  Widget _sectionCard({required String title, required String subtitle, required Widget child}) => Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(21), border: Border.all(color: _line)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.w900)), const SizedBox(height: 2), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 9.5)), const SizedBox(height: 12), child]));
  Widget _summaryItem(String title, String value, IconData icon) => Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, color: _green, size: 17), const SizedBox(height: 7), Text(title, style: const TextStyle(color: _muted, fontSize: 8.5)), const SizedBox(height: 2), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 10.5))]));
  Widget _infoRow(IconData icon, String title, String value) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(children: [Container(width: 31, height: 31, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: _green, size: 16)), const SizedBox(width: 9), Expanded(child: Text(title, style: const TextStyle(color: _muted, fontSize: 10))), Flexible(child: Text(value, textAlign: TextAlign.end, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _ink, fontSize: 10.5, fontWeight: FontWeight.w800)))]));
  Widget _requestBanner() => Material(color: _soft, borderRadius: BorderRadius.circular(20), child: InkWell(onTap: _showRequestDialog, borderRadius: BorderRadius.circular(20), child: Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFCDE6DD))), child: Row(children: [Container(width: 42, height: 42, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(13)), child: const Icon(Icons.event_note_outlined, color: _green)), const SizedBox(width: 10), const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('طلب استئذان أو إجازة', style: TextStyle(color: _green, fontWeight: FontWeight.w900, fontSize: 12)), SizedBox(height: 3), Text('إرسال طلب للإدارة', style: TextStyle(color: _muted, fontSize: 9.5))])), const Icon(Icons.chevron_left_rounded, color: _green)]))));

  Future<void> _showRequestDialog() async {
    var type = 'permission'; final reason = TextEditingController(); DateTime start = DateTime.now(); DateTime end = DateTime.now();
    final result = await showDialog<bool>(context: context, builder: (dialogContext) => StatefulBuilder(builder: (context, setDialogState) => Directionality(textDirection: TextDirection.rtl, child: AlertDialog(
      title: const Text('طلب استئذان أو إجازة'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<String>(value: type, decoration: const InputDecoration(labelText: 'نوع الطلب'), items: const [DropdownMenuItem(value: 'permission', child: Text('استئذان')), DropdownMenuItem(value: 'leave', child: Text('إجازة')), DropdownMenuItem(value: 'checkout', child: Text('انصراف مبكر'))], onChanged: (v) { if (v != null) setDialogState(() => type = v); }),
        const SizedBox(height: 10),
        if (type != 'checkout') Row(children: [Expanded(child: TextButton.icon(onPressed: () async { final d = await showDatePicker(context: context, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: start); if (d != null) setDialogState(() => start = d); }, icon: const Icon(Icons.calendar_today_outlined), label: Text(intl.DateFormat('yyyy-MM-dd').format(start)))), const SizedBox(width: 6), Expanded(child: TextButton.icon(onPressed: () async { final d = await showDatePicker(context: context, firstDate: start, lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: end.isBefore(start) ? start : end); if (d != null) setDialogState(() => end = d); }, icon: const Icon(Icons.event_outlined), label: Text(intl.DateFormat('yyyy-MM-dd').format(end))))]),
        if (type == 'checkout') Container(width: double.infinity, padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: const Text('سيُرسل الطلب إلى الإدارة للمراجعة قبل اعتماد الانصراف المبكر.', style: TextStyle(fontSize: 11))),
        const SizedBox(height: 10), TextField(controller: reason, minLines: 3, maxLines: 5, decoration: const InputDecoration(labelText: 'السبب', alignLabelWithHint: true, border: OutlineInputBorder())),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('إلغاء')), FilledButton(onPressed: () async { if (reason.text.trim().isEmpty) return; try { final token = await _session.token(); await HadirApi(token: token).createRequest(type: type, reason: reason.text.trim(), startDate: type == 'checkout' ? null : intl.DateFormat('yyyy-MM-dd').format(start), endDate: type == 'checkout' ? null : intl.DateFormat('yyyy-MM-dd').format(end)); if (dialogContext.mounted) Navigator.pop(dialogContext, true); } catch (e) { if (dialogContext.mounted) ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content: Text(HadirApi.errorMessage(e)))); } }, child: const Text('إرسال'))],
    ))));
    reason.dispose();
    if (result == true && mounted) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إرسال الطلب بنجاح'))); await _load(); }
  }

  Map<String, dynamic> _scheduleState(DateTime now, bool checkedIn, bool checkedOut) {
    if (_workStart.isEmpty || _workEnd.isEmpty) return {'status': checkedOut ? 'انتهى الدوام' : checkedIn ? 'حاضر' : 'جاهز لتسجيل الحضور', 'detail': checkedOut ? 'تم تسجيل الانصراف لهذا اليوم.' : checkedIn ? 'أنت مسجل حضور الآن ويمكنك تسجيل الانصراف.' : 'لم يتم تسجيل حضورك بعد.', 'canStart': !checkedIn && !checkedOut, 'countdown': null, 'late': 0};
    final start = _parseTime(_workStart, now); final end = _parseTime(_workEnd, now);
    if (start == null || end == null) return {'status': checkedOut ? 'انتهى الدوام' : checkedIn ? 'حاضر' : 'جاهز لتسجيل الحضور', 'detail': 'تعذر قراءة وقت الجدول.', 'canStart': !checkedIn && !checkedOut, 'countdown': null, 'late': 0};
    if (checkedOut) return {'status': 'انتهى الدوام', 'detail': 'تم تسجيل الانصراف لهذا اليوم.', 'canStart': false, 'countdown': null, 'late': 0};
    if (checkedIn) return {'status': 'حاضر', 'detail': 'أنت مسجل حضور الآن ويمكنك تسجيل الانصراف.', 'canStart': false, 'countdown': _countdown(end.difference(now)), 'late': 0};
    if (now.isBefore(start)) return {'status': 'لم يبدأ الدوام', 'detail': 'دوامك لم يبدأ بعد.', 'canStart': false, 'countdown': _countdown(start.difference(now)), 'late': 0};
    final late = now.difference(start).inMinutes;
    if (now.isAfter(end)) return {'status': 'غائب', 'detail': 'انتهى وقت الدوام المجدول دون تسجيل حضور.', 'canStart': false, 'countdown': null, 'late': late};
    return {'status': late > _grace ? 'متأخر' : 'جاهز لتسجيل الحضور', 'detail': late > _grace ? 'يمكنك تسجيل الحضور مع احتساب التأخر.' : 'وقت الدوام الحالي متاح للتسجيل.', 'canStart': true, 'countdown': _countdown(end.difference(now)), 'late': late > _grace ? late : 0};
  }

  DateTime? _parseTime(String raw, DateTime base) { final match = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(raw.trim()); if (match == null) return null; final h = int.tryParse(match.group(1)!); final m = int.tryParse(match.group(2)!); if (h == null || m == null || h > 23 || m > 59) return null; return DateTime(base.year, base.month, base.day, h, m); }
  String _countdown(Duration d) { final minutes = d.inMinutes.clamp(0, 1439); return '${minutes ~/ 60}س ${minutes % 60}د'; }
  String _periodText() => _workStart.isEmpty && _workEnd.isEmpty ? 'حسب الجدول الإداري' : '${_workStart.isEmpty ? '—' : _workStart} - ${_workEnd.isEmpty ? '—' : _workEnd}';
  String _requestType(Map<dynamic, dynamic> x) => '${x['type'] ?? ''}'.toLowerCase();
  List<Map<dynamic, dynamic>> _todayApprovedRequests(DateTime now) { final day = intl.DateFormat('yyyy-MM-dd').format(now); return _requests.whereType<Map>().where((item) { final status = '${item['status'] ?? ''}'.toLowerCase(); if (status != 'approved' && status != 'confirmed') return false; final a = DateTime.tryParse('${item['startDate'] ?? item['createdAt'] ?? ''}'.split('T').first); final b = DateTime.tryParse('${item['endDate'] ?? item['startDate'] ?? item['createdAt'] ?? ''}'.split('T').first); final c = DateTime.tryParse(day); return a != null && b != null && c != null && !c.isBefore(a) && !c.isAfter(b); }).toList(); }
  List<dynamic> _todayAttendance(DateTime now) => _attendance.where((item) { final date = DateTime.tryParse('${item is Map ? item['timestamp'] : null}'); return date != null && date.year == now.year && date.month == now.month && date.day == now.day; }).toList();
  DateTime? _firstTodayEvent(List<dynamic> today, String type) { for (final item in today) { if (item is Map && item['type'] == type) { final stamp = DateTime.tryParse('${item['timestamp'] ?? ''}'); if (stamp != null) return stamp; } } return null; }
  String _eventTime(DateTime? value) => value == null ? '—' : intl.DateFormat('HH:mm').format(value);
  String _workHours() { final times = _todayAttendance(DateTime.now()).whereType<Map>().map((e) => DateTime.tryParse('${e['timestamp']}')).whereType<DateTime>().toList()..sort(); if (times.length < 2) return '—'; final d = times.last.difference(times.first); return '${d.inHours}س ${d.inMinutes.remainder(60)}د'; }
  Widget _avatar() => Container(width: 56, height: 56, decoration: BoxDecoration(color: _soft, shape: BoxShape.circle, border: Border.all(color: _green.withValues(alpha: .18))), child: _avatarUrl == null ? const Icon(Icons.person_rounded, color: _green, size: 29) : ClipOval(child: Image.network(_avatarUrl!, width: 56, height: 56, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.person_rounded, color: _green, size: 29))));
  Widget _messageCard(String text, IconData icon) => Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)), child: Row(children: [Icon(icon, color: _muted), const SizedBox(width: 10), Expanded(child: Text(text, style: const TextStyle(color: _muted, fontSize: 11)))]));
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();
  @override
  Widget build(BuildContext context) => Container(height: 86, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)), child: const Center(child: CircularProgressIndicator(strokeWidth: 2, color: _green)));
}
