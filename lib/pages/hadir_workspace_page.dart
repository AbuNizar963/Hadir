import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

const _green = HadirBrand.lightPrimary;
const _greenDark = HadirBrand.lightPrimary;
const _soft = Color(0xFFE8F5F0);
const _bg = HadirBrand.lightBackground;
const _ink = HadirBrand.lightText;
const _muted = HadirBrand.lightMuted;
const _line = HadirBrand.lightBorder;

Color _statusColor(String status) {
  switch (status) {
    case 'حاضر':
    case 'انتهى الدوام':
      return HadirBrand.lightPrimary;
    case 'متأخر':
    case 'إذن':
      return HadirBrand.lightWarning;
    case 'إجازة':
      return HadirBrand.lightAccent;
    case 'غائب':
    case 'هارب':
      return HadirBrand.lightDanger;
    default:
      return HadirBrand.lightAccent;
  }
}

class HadirWorkspacePage extends StatefulWidget {
  const HadirWorkspacePage({super.key});
  @override
  State<HadirWorkspacePage> createState() => _HadirWorkspacePageState();
}

class _HadirWorkspacePageState extends State<HadirWorkspacePage> {
  final _session = HadirSession();
  int _tab = 0;
  bool _loading = true;
  String? _error;
  String _name = 'الموظف';
  List<dynamic> _attendance = const [];
  List<dynamic> _requests = const [];
  List<dynamic> _notifications = const [];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.token();
      final api = HadirApi(token: token);
      final results = await Future.wait<dynamic>([api.me(), api.attendance(limit: 200), api.requests(), api.notifications()]);
      final me = results[0] as Map<String, dynamic>;
      final user = me['user'];
      if (!mounted) return;
      setState(() {
        _name = user is Map ? '${user['name'] ?? 'الموظف'}' : 'الموظف';
        _attendance = results[1] as List<dynamic>;
        _requests = results[2] as List<dynamic>;
        _notifications = results[3] as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(e); });
    }
  }

  @override
  Widget build(BuildContext context) {
    // EmployeeMobileShell owns the single app-level header and secondary navigation.
    return Directionality(textDirection: TextDirection.rtl, child: Container(color: _bg, child: _dashboard()));
  }

  Widget _dashboard() {
    final now = DateTime.now();
    final today = _todayAttendance(now);
    final checkedIn = today.any((x) => x is Map && x['type'] == 'check-in');
    final checkedOut = today.any((x) => x is Map && x['type'] == 'check-out');
    final active = checkedIn && !checkedOut;
    final checkIn = _firstTodayEvent(today, 'check-in');
    final checkOut = _firstTodayEvent(today, 'check-out');
    final todayRequests = _todayApprovedRequests(now);
    final hasLeave = todayRequests.any((x) => '${x['type'] ?? ''}'.toLowerCase() == 'leave');
    final hasPermission = todayRequests.any((x) => '${x['type'] ?? ''}'.toLowerCase() == 'permission');
    final status = hasLeave ? 'إجازة' : hasPermission ? 'إذن' : checkedOut ? 'انتهى الدوام' : active ? 'حاضر' : 'جاهز لتسجيل الحضور';
    final statusDetail = hasLeave ? 'لديك إجازة معتمدة لهذا اليوم.' : hasPermission ? 'لديك إذن معتمد لهذا اليوم.' : checkedOut ? 'تم تسجيل الانصراف لهذا اليوم.' : active ? 'أنت مسجل حضور الآن ويمكنك تسجيل الانصراف.' : 'لم يتم تسجيل حضورك بعد.';

    return RefreshIndicator(
      color: _green,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
        children: [
          _employeeHero(now),
          const SizedBox(height: 12),
          _statusCard(now: now, status: status, detail: statusDetail, active: active, checkedOut: checkedOut),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _dashboardAction(icon: Icons.login_rounded, title: 'تسجيل حضور', subtitle: hasLeave || hasPermission ? status : checkedIn ? 'تم تسجيل الحضور' : 'مسح رمز QR', enabled: !checkedIn && !checkedOut && !hasLeave && !hasPermission, onTap: () => context.push('/attendance?type=check-in'))),
            const SizedBox(width: 10),
            Expanded(child: _dashboardAction(icon: Icons.logout_rounded, title: 'تسجيل انصراف', subtitle: active ? 'إنهاء الدوام' : checkOut != null ? 'تم تسجيل الانصراف' : 'بعد تسجيل الحضور', enabled: active, onTap: () => context.push('/attendance?type=check-out'))),
          ]),
          const SizedBox(height: 12),
          _sectionCard(
            title: 'ملخص اليوم',
            subtitle: 'سجل الدوام',
            child: Row(children: [
              Expanded(child: _summaryItem('الحضور', _eventTime(checkIn), Icons.login_rounded)),
              const SizedBox(width: 8),
              Expanded(child: _summaryItem('الانصراف', _eventTime(checkOut), Icons.logout_rounded)),
              const SizedBox(width: 8),
              Expanded(child: _summaryItem('مدة العمل', _workHours(), Icons.schedule_rounded)),
            ]),
          ),
          const SizedBox(height: 12),
          _sectionCard(
            title: 'معلومات الدوام',
            subtitle: 'حالتك الحالية',
            child: Column(children: [
              _infoRow(Icons.calendar_today_outlined, 'نوع الجدول', 'حسب جدول الموظف'),
              _infoRow(Icons.access_time_rounded, 'الفترة', 'حسب الجدول الإداري'),
              _infoRow(Icons.verified_outlined, 'الحالة', status),
              _infoRow(Icons.location_on_outlined, 'الموقع', 'الموقع المخصص'),
              _infoRow(Icons.devices_other_rounded, 'الجهاز', 'مرتبط بالحساب'),
            ]),
          ),
          const SizedBox(height: 12),
          _requestBanner(),
          if (_loading) ...[const SizedBox(height: 12), const _LoadingCard()] else if (_error != null) ...[const SizedBox(height: 12), _messageCard(_error!, Icons.cloud_off_rounded)],
        ],
      ),
    );
  }

  Widget _employeeHero(DateTime now) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line), boxShadow: const [BoxShadow(color: Color(0x0A142D27), blurRadius: 16, offset: Offset(0, 6))]),
      child: Row(children: [
        _avatar(),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('مرحباً بك', style: TextStyle(color: _muted, fontSize: 10)),
          Text(_name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _ink, fontSize: 16, fontWeight: FontWeight.w900)),
          Text('HADIR · EMPLOYEE  ·  لوحة الموظف', style: const TextStyle(color: _green, fontSize: 9.5, fontWeight: FontWeight.w800)),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(intl.DateFormat('HH:mm').format(now), style: const TextStyle(color: _ink, fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(height: 2),
          Text(intl.DateFormat('EEEE، d MMMM', 'ar').format(now), style: const TextStyle(color: _muted, fontSize: 9.5)),
        ]),
      ]),
    );
  }

  Widget _statusCard({required DateTime now, required String status, required String detail, required bool active, required bool checkedOut}) {
    final stateColor = _statusColor(status);
    final stateSoft = stateColor.withValues(alpha: .13);
    final stateIcon = checkedOut ? Icons.task_alt_rounded : active ? Icons.work_history_rounded : status == 'إجازة' ? Icons.beach_access_rounded : status == 'إذن' ? Icons.event_available_rounded : status == 'غائب' ? Icons.person_off_rounded : Icons.access_time_rounded;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line), boxShadow: const [BoxShadow(color: Color(0x0D142D27), blurRadius: 18, offset: Offset(0, 7))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('حالة اليوم', style: TextStyle(color: _muted, fontSize: 10, fontWeight: FontWeight.w700)),
            const SizedBox(height: 3),
            Text(status, style: TextStyle(color: stateColor, fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 3),
            Text(detail, style: const TextStyle(color: _muted, fontSize: 10.5)),
          ])),
          Container(width: 48, height: 48, decoration: BoxDecoration(color: stateSoft, borderRadius: BorderRadius.circular(15), border: Border.all(color: stateColor.withValues(alpha: .22))), child: Icon(stateIcon, color: stateColor)),
        ]),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(14)),
          child: Row(children: [
            Icon(Icons.location_on_outlined, size: 16, color: stateColor),
            const SizedBox(width: 6),
            const Expanded(child: Text('الموقع المخصص للعمل', style: TextStyle(color: _ink, fontSize: 10.5, fontWeight: FontWeight.w800))),
            Text(intl.DateFormat('EEEE، d MMMM', 'ar').format(now), style: const TextStyle(color: _muted, fontSize: 9.5)),
          ]),
        ),
      ]),
    );
  }

  Widget _dashboardAction({required IconData icon, required String title, required String subtitle, required bool enabled, required VoidCallback onTap}) {
    return Material(color: Colors.white, borderRadius: BorderRadius.circular(20), child: InkWell(onTap: enabled ? onTap : null, borderRadius: BorderRadius.circular(20), child: Container(
      constraints: const BoxConstraints(minHeight: 96),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: enabled ? _green.withValues(alpha: .22) : _line)),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: enabled ? _soft : _bg, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: enabled ? _green : _muted, size: 19)),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(title, style: TextStyle(color: enabled ? _ink : _muted, fontWeight: FontWeight.w900, fontSize: 12)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 9.5))])),
      ]),
    )));
  }

  Widget _sectionCard({required String title, required String subtitle, required Widget child}) {
    return Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(21), border: Border.all(color: _line)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.w900)), const SizedBox(height: 2), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 9.5)), const SizedBox(height: 12), child]));
  }

  Widget _summaryItem(String title, String value, IconData icon) {
    return Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, color: _green, size: 17), const SizedBox(height: 7), Text(title, style: const TextStyle(color: _muted, fontSize: 8.5)), const SizedBox(height: 2), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 10.5))]));
  }

  Widget _infoRow(IconData icon, String title, String value) {
    final color = title == 'الحالة' ? _statusColor(value) : _green;
    return Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(children: [Container(width: 31, height: 31, decoration: BoxDecoration(color: color.withValues(alpha: .13), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: color, size: 16)), const SizedBox(width: 9), Expanded(child: Text(title, style: const TextStyle(color: _muted, fontSize: 10))), Flexible(child: Text(value, textAlign: TextAlign.end, overflow: TextOverflow.ellipsis, style: TextStyle(color: title == 'الحالة' ? color : _ink, fontSize: 10.5, fontWeight: FontWeight.w800)))]));
  }

  Widget _requestBanner() {
    return Material(color: _soft, borderRadius: BorderRadius.circular(20), child: InkWell(onTap: () => context.push('/requests'), borderRadius: BorderRadius.circular(20), child: Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFCDE6DD))),
      child: Row(children: [Container(width: 42, height: 42, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(13)), child: const Icon(Icons.event_note_outlined, color: _green)), const SizedBox(width: 10), const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('طلب استئذان أو إجازة', style: TextStyle(color: _green, fontWeight: FontWeight.w900, fontSize: 12)), SizedBox(height: 3), Text('إرسال طلب للإدارة', style: TextStyle(color: _muted, fontSize: 9.5))])), const Icon(Icons.chevron_left_rounded, color: _green)]),
    )));
  }

  DateTime? _firstTodayEvent(List<dynamic> today, String type) {
    for (final item in today) {
      if (item is Map && item['type'] == type) {
        final stamp = DateTime.tryParse('${item['timestamp'] ?? ''}');
        if (stamp != null) return stamp;
      }
    }
    return null;
  }

  List<Map<dynamic, dynamic>> _todayApprovedRequests(DateTime now) {
    final day = intl.DateFormat('yyyy-MM-dd').format(now);
    return _requests.whereType<Map>().where((item) {
      final status = '${item['status'] ?? ''}'.toLowerCase();
      if (status != 'approved' && status != 'confirmed') return false;
      final start = '${item['startDate'] ?? item['createdAt'] ?? ''}'.split('T').first;
      final end = '${item['endDate'] ?? item['startDate'] ?? item['createdAt'] ?? ''}'.split('T').first;
      final startDate = DateTime.tryParse(start);
      final endDate = DateTime.tryParse(end);
      final currentDate = DateTime.tryParse(day);
      return startDate != null && endDate != null && currentDate != null && !currentDate.isBefore(startDate) && !currentDate.isAfter(endDate);
    }).toList();
  }

  String _eventTime(DateTime? value) => value == null ? '—' : intl.DateFormat('HH:mm').format(value);

  // Retained for the existing workspace implementation and future route-level reuse.
  // ignore: unused_element
  Widget _clockCard(DateTime now) {
    final today = _todayAttendance(now);
    final checkedIn = today.any((x) => x is Map && x['type'] == 'check-in');
    final checkedOut = today.any((x) => x is Map && x['type'] == 'check-out');
    final active = checkedIn && !checkedOut;
    final status = checkedOut ? 'تم إنهاء الدوام' : active ? 'أنت على رأس العمل' : 'جاهز لتسجيل الحضور';
    final type = active ? 'check-out' : 'check-in';
    return Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_green, _greenDark]), borderRadius: BorderRadius.circular(26), boxShadow: const [BoxShadow(color: Color(0x240B6B5A), blurRadius: 26, offset: Offset(0, 12))]), child: Column(children: [Row(children: [Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF9AE3C8), shape: BoxShape.circle)), const SizedBox(width: 7), Expanded(child: Text(status, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12))), Text(intl.DateFormat('d MMMM', 'ar').format(now), style: const TextStyle(color: Colors.white70, fontSize: 11))]), const SizedBox(height: 17), Text(intl.DateFormat('HH:mm').format(now), style: const TextStyle(color: Colors.white, fontSize: 44, height: 1, fontWeight: FontWeight.w900)), const SizedBox(height: 7), Text(intl.DateFormat('EEEE، d MMMM yyyy', 'ar').format(now), style: const TextStyle(color: Colors.white70, fontSize: 11)), const SizedBox(height: 17), SizedBox(width: double.infinity, height: 52, child: FilledButton.icon(onPressed: checkedOut ? null : () => context.push('/attendance?type=$type'), style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: _green, disabledBackgroundColor: Colors.white24, disabledForegroundColor: Colors.white70, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))), icon: Icon(active ? Icons.logout_rounded : Icons.login_rounded, size: 20), label: Text(active ? 'تسجيل الانصراف' : 'تسجيل الحضور', style: const TextStyle(fontWeight: FontWeight.w900)))), const SizedBox(height: 9), const Text('سيتم التحقق من الموقع والجهاز وQR عند التسجيل', style: TextStyle(color: Colors.white70, fontSize: 9.5))]));
  }

  // Retained for existing route behavior; EmployeeMobileShell now owns navigation.
  // ignore: unused_element
  Widget _timesheets() => RefreshIndicator(color: _green, onRefresh: _load, child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.fromLTRB(18, 18, 18, 30), children: [_pageHeader('سجل الدوام', 'المراجعة اليومية والشهرية لحركاتك'), const SizedBox(height: 15), _summaryCard(), const SizedBox(height: 16), _sectionTitle('الحركات الأخيرة'), const SizedBox(height: 9), _attendanceList()]));

  // Retained for existing route behavior; EmployeeMobileShell now owns navigation.
  // ignore: unused_element
  Widget _attendanceTab() => RefreshIndicator(color: _green, onRefresh: _load, child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.fromLTRB(18, 18, 18, 30), children: [_pageHeader('الحضور والانصراف', 'تسجيل آمن والتحقق من المتطلبات قبل الحفظ'), const SizedBox(height: 15), _liveStatusCard(), const SizedBox(height: 14), Row(children: [Expanded(child: _actionCard(Icons.login_rounded, 'تسجيل الحضور', 'بدء الدوام', () => context.push('/attendance?type=check-in'))), const SizedBox(width: 10), Expanded(child: _actionCard(Icons.logout_rounded, 'تسجيل الانصراف', 'إنهاء الدوام', () => context.push('/attendance?type=check-out')))]), const SizedBox(height: 18), _sectionTitle('سجل اليوم'), const SizedBox(height: 9), _attendanceList()]));

  // Retained for existing route behavior; EmployeeMobileShell now owns navigation.
  // ignore: unused_element
  Widget _requestsTab() => RefreshIndicator(color: _green, onRefresh: _load, child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.fromLTRB(18, 18, 18, 30), children: [Row(children: [Expanded(child: _pageHeader('الطلبات', 'الإجازات والأذونات وحالة كل طلب')), FilledButton.icon(onPressed: () => context.push('/requests'), icon: const Icon(Icons.add_rounded, size: 18), label: const Text('طلب جديد'))]), const SizedBox(height: 15), if (_loading) const _LoadingCard() else if (_error != null) _messageCard(_error!, Icons.cloud_off_rounded) else if (_requests.isEmpty) _emptyCard('لا توجد طلبات حتى الآن', 'ستظهر هنا طلبات الإجازات والأذونات.', Icons.event_note_outlined) else ..._requests.take(12).map(_requestTile)]));

  // Retained for existing route behavior; EmployeeMobileShell now owns navigation.
  // ignore: unused_element
  Widget _moreTab() => ListView(padding: const EdgeInsets.fromLTRB(18, 18, 18, 30), children: [_pageHeader('المزيد', 'الوصول السريع إلى خدمات حاضر'), const SizedBox(height: 15), _profileCard(), const SizedBox(height: 14), _menuTile(Icons.notifications_none_rounded, 'التنبيهات', '${_unreadCount()} غير مقروءة', () => context.push('/notifications')), _menuTile(Icons.history_rounded, 'السجل التفصيلي', 'Timesheets اليومية والشهرية', () => context.push('/history')), _menuTile(Icons.miscellaneous_services_outlined, 'الخدمات', 'الخدمات المتاحة في حسابك', () => context.push('/services')), _menuTile(Icons.person_outline_rounded, 'الملف الشخصي', 'بيانات الحساب والملف', () => context.push('/profile'))]);

  // Retained as a legacy local navigation definition; the shell owns the visible bar.
  // ignore: unused_element
  Widget _bottomNav() {
    const items = [(Icons.home_rounded, 'الرئيسية'), (Icons.calendar_month_rounded, 'الدوام'), (Icons.fingerprint_rounded, 'الحضور'), (Icons.event_note_outlined, 'الطلبات'), (Icons.more_horiz_rounded, 'المزيد')];
    return NavigationBar(selectedIndex: _tab, onDestinationSelected: (index) => setState(() => _tab = index), backgroundColor: Colors.white, indicatorColor: _soft, height: 70, destinations: [for (final item in items) NavigationDestination(icon: Icon(item.$1), selectedIcon: Icon(item.$1, color: _green), label: item.$2)]);
  }

  Widget _summaryCard() => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)), child: Row(children: [const Icon(Icons.calendar_month_rounded, color: _green), const SizedBox(width: 10), const Expanded(child: Text('هذا الشهر', style: TextStyle(fontWeight: FontWeight.w900))), Text('${_attendance.length} حركة', style: const TextStyle(color: _muted, fontSize: 11))]));

  Widget _liveStatusCard() {
    final today = _todayAttendance(DateTime.now());
    final active = today.any((x) => x is Map && x['type'] == 'check-in') && !today.any((x) => x is Map && x['type'] == 'check-out');
    final stateColor = active ? _statusColor('حاضر') : _statusColor('جاهز');
    return Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)), child: Row(children: [Container(width: 46, height: 46, decoration: BoxDecoration(color: stateColor.withValues(alpha: .13), borderRadius: BorderRadius.circular(14)), child: Icon(active ? Icons.work_history_rounded : Icons.access_time_rounded, color: stateColor)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(active ? 'على رأس العمل' : 'غير مسجل حضور الآن', style: TextStyle(color: stateColor, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(active ? 'يمكنك تسجيل الانصراف عند الانتهاء.' : 'يمكنك بدء الدوام من زر تسجيل الحضور.', style: const TextStyle(color: _muted, fontSize: 11))]))]));
  }

  Widget _profileCard() => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: _green, borderRadius: BorderRadius.circular(22)), child: Row(children: [_avatar(light: true), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(_name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)), const SizedBox(height: 3), const Text('مساحة الموظف في حاضر', style: TextStyle(color: Colors.white70, fontSize: 11))]))]));

  Widget _attendanceList({int? limit}) {
    if (_loading) return const _LoadingCard();
    if (_error != null) return _messageCard(_error!, Icons.cloud_off_rounded);
    if (_attendance.isEmpty) return _emptyCard('لا توجد حركات حضور', 'ابدأ أول تسجيل حضور من زر الحضور.', Icons.event_available_rounded);
    final data = limit == null ? _attendance : _attendance.take(limit);
    return Column(children: data.map(_attendanceTile).toList());
  }

  Widget _attendanceTile(dynamic item) {
    final map = item is Map ? item : const <dynamic, dynamic>{};
    final type = '${map['type'] ?? ''}';
    final stamp = DateTime.tryParse('${map['timestamp'] ?? ''}');
    final isIn = type == 'check-in';
    final eventColor = isIn ? _statusColor('حاضر') : _statusColor('إذن');
    return Container(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(13), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)), child: Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: eventColor.withValues(alpha: .13), borderRadius: BorderRadius.circular(12)), child: Icon(isIn ? Icons.login_rounded : Icons.logout_rounded, color: eventColor, size: 19)), const SizedBox(width: 11), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(isIn ? 'تسجيل حضور' : 'تسجيل انصراف', style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 12)), const SizedBox(height: 3), Text(stamp == null ? 'وقت غير متاح' : intl.DateFormat('EEEE، d MMMM • HH:mm', 'ar').format(stamp), style: const TextStyle(color: _muted, fontSize: 10))])), _chip(isIn ? 'حضور' : 'انصراف', isIn)]));
  }

  Widget _requestTile(dynamic item) {
    final map = item is Map ? item : const <dynamic, dynamic>{};
    final status = '${map['status'] ?? 'pending'}';
    final type = '${map['type'] ?? 'طلب'}';
    final reason = '${map['reason'] ?? ''}';
    final label = status == 'approved' ? 'مقبول' : status == 'rejected' ? 'مرفوض' : status == 'confirmed' ? 'مؤكد' : 'قيد المراجعة';
    final statusColor = _requestStatusColor(status);
    return Container(margin: const EdgeInsets.only(bottom: 9), padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(19), border: Border.all(color: _line)), child: Row(children: [Container(width: 42, height: 42, decoration: BoxDecoration(color: statusColor.withValues(alpha: .13), borderRadius: BorderRadius.circular(13)), child: Icon(Icons.event_note_outlined, color: statusColor)), const SizedBox(width: 11), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(type, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12)), if (reason.isNotEmpty) ...[const SizedBox(height: 3), Text(reason, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 10))]])), _statusChip(label, status)]));
  }

  Color _requestStatusColor(String status) {
    switch (status) {
      case 'approved':
      case 'confirmed':
        return HadirBrand.lightPrimary;
      case 'rejected':
        return HadirBrand.lightDanger;
      case 'pending':
        return HadirBrand.lightWarning;
      default:
        return HadirBrand.lightMuted;
    }
  }

  // ignore: unused_element
  Widget _metric(IconData icon, String title, String value) => Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(width: 34, height: 34, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: _green, size: 18)), const SizedBox(height: 8), Text(title, style: const TextStyle(color: _muted, fontSize: 9)), const SizedBox(height: 2), Text(value, style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 12))]));

  // ignore: unused_element
  Widget _quick(IconData icon, String title, String sub, VoidCallback onTap) {
    return Material(color: Colors.white, borderRadius: BorderRadius.circular(18), child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(18), child: Container(padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6), decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)), child: Column(children: [Container(width: 39, height: 39, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _green, size: 19)), const SizedBox(height: 7), Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 10.5)), const SizedBox(height: 2), Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 7.5))]))));
  }

  Widget _actionCard(IconData icon, String title, String sub, VoidCallback onTap) {
    return Material(color: Colors.white, borderRadius: BorderRadius.circular(20), child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(20), child: Padding(padding: const EdgeInsets.all(15), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _green)), const SizedBox(height: 10), Text(title, style: const TextStyle(fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(sub, style: const TextStyle(color: _muted, fontSize: 10))]))));
  }

  Widget _menuTile(IconData icon, String title, String subtitle, VoidCallback onTap) => Card(margin: const EdgeInsets.only(bottom: 8), elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: _line)), child: ListTile(onTap: onTap, leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _green)), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)), subtitle: Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10)), trailing: const Icon(Icons.chevron_left_rounded, color: _muted)));

  Widget _sectionTitle(String title, {Widget? action}) => Row(children: [Expanded(child: Text(title, style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 15))), if (action != null) action]);
  Widget _pageHeader(String title, String subtitle) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: _ink, fontSize: 24, fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 11))]);

  // ignore: unused_element
  Widget _iconButton(IconData icon, VoidCallback onTap) => Material(color: Colors.white, borderRadius: BorderRadius.circular(14), child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(14), child: Container(width: 43, height: 43, decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)), child: Icon(icon, color: _ink, size: 21))));
  Widget _avatar({bool light = false}) => Container(width: 43, height: 43, decoration: BoxDecoration(color: light ? Colors.white24 : _soft, shape: BoxShape.circle), child: Icon(Icons.person_rounded, color: light ? Colors.white : _green, size: 23));
  Widget _chip(String text, bool positive) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5), decoration: BoxDecoration(color: positive ? _soft : const Color(0xFFF1F3F2), borderRadius: BorderRadius.circular(20)), child: Text(text, style: TextStyle(color: positive ? _green : _muted, fontWeight: FontWeight.w800, fontSize: 9)));
  Widget _statusChip(String text, String status) { final color = _requestStatusColor(status); return Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5), decoration: BoxDecoration(color: color.withValues(alpha: .13), borderRadius: BorderRadius.circular(20)), child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 9))); }
  Widget _messageCard(String text, IconData icon) => Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)), child: Row(children: [Icon(icon, color: _muted), const SizedBox(width: 10), Expanded(child: Text(text, style: const TextStyle(color: _muted, fontSize: 11)))]));
  Widget _emptyCard(String title, String subtitle, IconData icon) => Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)), child: Column(children: [Container(width: 48, height: 48, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(15)), child: Icon(icon, color: _green)), const SizedBox(height: 10), Text(title, style: const TextStyle(fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(color: _muted, fontSize: 10))]));
  List<dynamic> _todayAttendance(DateTime now) => _attendance.where((item) { final date = DateTime.tryParse('${item is Map ? item['timestamp'] : null}'); return date != null && date.year == now.year && date.month == now.month && date.day == now.day; }).toList();
  String _workHours() { final times = _todayAttendance(DateTime.now()).whereType<Map>().map((e) => DateTime.tryParse('${e['timestamp']}')).whereType<DateTime>().toList()..sort(); if (times.length < 2) return '—'; final d = times.last.difference(times.first); return '${d.inHours}س ${d.inMinutes.remainder(60)}د'; }
  int _unreadCount() => _notifications.where((x) => x is Map && x['readAt'] == null && x['read'] != true).length;
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();
  @override
  Widget build(BuildContext context) => Container(height: 86, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)), child: const Center(child: CircularProgressIndicator(strokeWidth: 2, color: _green)));
}
