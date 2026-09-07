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
  int _tab = 0;
  bool _loading = true;
  String? _error;
  String _name = 'الموظف';
  List<dynamic> _attendance = const [];
  List<dynamic> _requests = const [];
  List<dynamic> _notifications = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = await _session.token();
      final api = HadirApi(token: token);
      final results = await Future.wait<dynamic>([
        api.me(),
        api.attendance(limit: 200),
        api.requests(),
        api.notifications(),
      ]);
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
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _bg,
        body: SafeArea(
          bottom: false,
          child: IndexedStack(
            index: _tab,
            children: [
              _dashboard(),
              _timesheets(),
              _attendanceTab(),
              _requestsTab(),
              _moreTab(),
            ],
          ),
        ),
        bottomNavigationBar: _bottomNav(),
      ),
    );
  }

  Widget _dashboard() {
    final now = DateTime.now();
    final firstName = _name.trim().split(RegExp(r'\s+')).first;
    return RefreshIndicator(
      color: _green,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 30),
        children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(now.hour < 12 ? 'صباح الخير' : 'مساء الخير', style: const TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 3),
              Text(firstName, style: const TextStyle(color: _ink, fontSize: 24, fontWeight: FontWeight.w900)),
            ])),
            _iconButton(Icons.notifications_none_rounded, () => setState(() => _tab = 4)),
            const SizedBox(width: 8),
            _avatar(),
          ]),
          const SizedBox(height: 18),
          _clockCard(now),
          const SizedBox(height: 18),
          _sectionTitle('ملخص اليوم'),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _metric(Icons.schedule_rounded, 'ساعات العمل', _workHours())),
            const SizedBox(width: 9),
            Expanded(child: _metric(Icons.fact_check_outlined, 'الطلبات', '${_requests.length}')),
            const SizedBox(width: 9),
            Expanded(child: _metric(Icons.notifications_none_rounded, 'التنبيهات', '${_unreadCount()}')),
          ]),
          const SizedBox(height: 20),
          _sectionTitle('إجراءات سريعة'),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _quick(Icons.qr_code_scanner_rounded, 'الحضور', 'GPS + QR', () => context.push('/attendance?type=check-in'))),
            const SizedBox(width: 8),
            Expanded(child: _quick(Icons.history_rounded, 'السجل', 'اليومي والشهري', () => setState(() => _tab = 1))),
            const SizedBox(width: 8),
            Expanded(child: _quick(Icons.event_note_outlined, 'طلب جديد', 'إجازة أو إذن', () => setState(() => _tab = 3))),
          ]),
          const SizedBox(height: 20),
          _sectionTitle('آخر الحركات', action: TextButton(onPressed: () => setState(() => _tab = 2), child: const Text('عرض الكل'))),
          const SizedBox(height: 8),
          _attendanceList(limit: 4),
        ],
      ),
    );
  }

  Widget _clockCard(DateTime now) {
    final today = _todayAttendance(now);
    final checkedIn = today.any((x) => x is Map && x['type'] == 'check-in');
    final checkedOut = today.any((x) => x is Map && x['type'] == 'check-out');
    final active = checkedIn && !checkedOut;
    final status = checkedOut ? 'تم إنهاء الدوام' : active ? 'أنت على رأس العمل' : 'جاهز لتسجيل الحضور';
    final type = active ? 'check-out' : 'check-in';
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_green, _greenDark]),
        borderRadius: BorderRadius.circular(26),
        boxShadow: const [BoxShadow(color: Color(0x240B6B5A), blurRadius: 26, offset: Offset(0, 12))],
      ),
      child: Column(children: [
        Row(children: [
          Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF9AE3C8), shape: BoxShape.circle)),
          const SizedBox(width: 7),
          Expanded(child: Text(status, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12))),
          Text(intl.DateFormat('d MMMM', 'ar').format(now), style: const TextStyle(color: Colors.white70, fontSize: 11)),
        ]),
        const SizedBox(height: 17),
        Text(intl.DateFormat('HH:mm').format(now), style: const TextStyle(color: Colors.white, fontSize: 44, height: 1, fontWeight: FontWeight.w900)),
        const SizedBox(height: 7),
        Text(intl.DateFormat('EEEE، d MMMM yyyy', 'ar').format(now), style: const TextStyle(color: Colors.white70, fontSize: 11)),
        const SizedBox(height: 17),
        SizedBox(width: double.infinity, height: 52, child: FilledButton.icon(
          onPressed: checkedOut ? null : () => context.push('/attendance?type=$type'),
          style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: _green, disabledBackgroundColor: Colors.white24, disabledForegroundColor: Colors.white70, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
          icon: Icon(active ? Icons.logout_rounded : Icons.login_rounded, size: 20),
          label: Text(active ? 'تسجيل الانصراف' : 'تسجيل الحضور', style: const TextStyle(fontWeight: FontWeight.w900)),
        )),
        const SizedBox(height: 9),
        const Text('سيتم التحقق من الموقع والجهاز وQR عند التسجيل', style: TextStyle(color: Colors.white70, fontSize: 9.5)),
      ]),
    );
  }

  Widget _timesheets() {
    return RefreshIndicator(
      color: _green,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
        children: [
          _pageHeader('سجل الدوام', 'المراجعة اليومية والشهرية لحركاتك'),
          const SizedBox(height: 15),
          _summaryCard(),
          const SizedBox(height: 16),
          _sectionTitle('الحركات الأخيرة'),
          const SizedBox(height: 9),
          _attendanceList(),
        ],
      ),
    );
  }

  Widget _attendanceTab() {
    return RefreshIndicator(
      color: _green,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
        children: [
          _pageHeader('الحضور والانصراف', 'تسجيل آمن والتحقق من المتطلبات قبل الحفظ'),
          const SizedBox(height: 15),
          _liveStatusCard(),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: _actionCard(Icons.login_rounded, 'تسجيل الحضور', 'بدء الدوام', () => context.push('/attendance?type=check-in'))),
            const SizedBox(width: 10),
            Expanded(child: _actionCard(Icons.logout_rounded, 'تسجيل الانصراف', 'إنهاء الدوام', () => context.push('/attendance?type=check-out'))),
          ]),
          const SizedBox(height: 18),
          _sectionTitle('سجل اليوم'),
          const SizedBox(height: 9),
          _attendanceList(),
        ],
      ),
    );
  }

  Widget _requestsTab() {
    return RefreshIndicator(
      color: _green,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
        children: [
          Row(children: [
            Expanded(child: _pageHeader('الطلبات', 'الإجازات والأذونات وحالة كل طلب')),
            FilledButton.icon(onPressed: () => context.push('/requests'), icon: const Icon(Icons.add_rounded, size: 18), label: const Text('طلب جديد')),
          ]),
          const SizedBox(height: 15),
          if (_loading) const _LoadingCard() else if (_error != null) _messageCard(_error!, Icons.cloud_off_rounded) else if (_requests.isEmpty) _emptyCard('لا توجد طلبات حتى الآن', 'ستظهر هنا طلبات الإجازات والأذونات.', Icons.event_note_outlined) else ..._requests.take(12).map(_requestTile),
        ],
      ),
    );
  }

  Widget _moreTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
      children: [
        _pageHeader('المزيد', 'الوصول السريع إلى خدمات حاضر'),
        const SizedBox(height: 15),
        _profileCard(),
        const SizedBox(height: 14),
        _menuTile(Icons.notifications_none_rounded, 'التنبيهات', '${_unreadCount()} غير مقروءة', () => context.push('/notifications')),
        _menuTile(Icons.history_rounded, 'السجل التفصيلي', 'Timesheets اليومية والشهرية', () => context.push('/history')),
        _menuTile(Icons.miscellaneous_services_outlined, 'الخدمات', 'الخدمات المتاحة في حسابك', () => context.push('/services')),
        _menuTile(Icons.person_outline_rounded, 'الملف الشخصي', 'بيانات الحساب والملف', () => context.push('/profile')),
      ],
    );
  }

  Widget _bottomNav() {
    const items = [
      (Icons.home_rounded, 'الرئيسية'),
      (Icons.calendar_month_rounded, 'الدوام'),
      (Icons.fingerprint_rounded, 'الحضور'),
      (Icons.event_note_outlined, 'الطلبات'),
      (Icons.more_horiz_rounded, 'المزيد'),
    ];
    return NavigationBar(
      selectedIndex: _tab,
      onDestinationSelected: (index) => setState(() => _tab = index),
      backgroundColor: Colors.white,
      indicatorColor: _soft,
      height: 70,
      destinations: [for (final item in items) NavigationDestination(icon: Icon(item.$1), selectedIcon: Icon(item.$1, color: _green), label: item.$2)],
    );
  }

  Widget _summaryCard() => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)),
    child: Row(children: [
      const Icon(Icons.calendar_month_rounded, color: _green),
      const SizedBox(width: 10),
      const Expanded(child: Text('هذا الشهر', style: TextStyle(fontWeight: FontWeight.w900))),
      Text('${_attendance.length} حركة', style: const TextStyle(color: _muted, fontSize: 11)),
    ]),
  );

  Widget _liveStatusCard() {
    final today = _todayAttendance(DateTime.now());
    final active = today.any((x) => x is Map && x['type'] == 'check-in') && !today.any((x) => x is Map && x['type'] == 'check-out');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)),
      child: Row(children: [
        Container(width: 46, height: 46, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(14)), child: Icon(active ? Icons.work_history_rounded : Icons.access_time_rounded, color: _green)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(active ? 'على رأس العمل' : 'غير مسجل حضور الآن', style: const TextStyle(color: _ink, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(active ? 'يمكنك تسجيل الانصراف عند الانتهاء.' : 'يمكنك بدء الدوام من زر تسجيل الحضور.', style: const TextStyle(color: _muted, fontSize: 11))])),
      ]),
    );
  }

  Widget _profileCard() => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: _green, borderRadius: BorderRadius.circular(22)),
    child: Row(children: [
      _avatar(light: true), const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(_name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)), const SizedBox(height: 3), const Text('مساحة الموظف في حاضر', style: TextStyle(color: Colors.white70, fontSize: 11))])),
    ]),
  );

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
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(isIn ? Icons.login_rounded : Icons.logout_rounded, color: _green, size: 19)),
        const SizedBox(width: 11),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(isIn ? 'تسجيل حضور' : 'تسجيل انصراف', style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 12)), const SizedBox(height: 3), Text(stamp == null ? 'وقت غير متاح' : intl.DateFormat('EEEE، d MMMM • HH:mm', 'ar').format(stamp), style: const TextStyle(color: _muted, fontSize: 10))])),
        _chip(isIn ? 'حضور' : 'انصراف', isIn),
      ]),
    );
  }

  Widget _requestTile(dynamic item) {
    final map = item is Map ? item : const <dynamic, dynamic>{};
    final status = '${map['status'] ?? 'pending'}';
    final type = '${map['type'] ?? 'طلب'}';
    final reason = '${map['reason'] ?? ''}';
    final label = status == 'approved' ? 'مقبول' : status == 'rejected' ? 'مرفوض' : status == 'confirmed' ? 'مؤكد' : 'قيد المراجعة';
    return Container(
      margin: const EdgeInsets.only(bottom: 9),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(19), border: Border.all(color: _line)),
      child: Row(children: [
        Container(width: 42, height: 42, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(13)), child: const Icon(Icons.event_note_outlined, color: _green)),
        const SizedBox(width: 11),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(type, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12)), if (reason.isNotEmpty) ...[const SizedBox(height: 3), Text(reason, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 10))]])),
        _statusChip(label, status),
      ]),
    );
  }

  Widget _metric(IconData icon, String title, String value) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(width: 34, height: 34, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: _green, size: 18)), const SizedBox(height: 8), Text(title, style: const TextStyle(color: _muted, fontSize: 9)), const SizedBox(height: 2), Text(value, style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 12))]),
  );

  Widget _quick(IconData icon, String title, String sub, VoidCallback onTap) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(18),
    child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(18), child: Container(padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6), decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)), child: Column(children: [Container(width: 39, height: 39, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _green, size: 19)), const SizedBox(height: 7), Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 10.5)), const SizedBox(height: 2), Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 7.5))]))),
  );

  Widget _actionCard(IconData icon, String title, String sub, VoidCallback onTap) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(20),
    child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(20), child: Padding(padding: const EdgeInsets.all(15), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _green)), const SizedBox(height: 10), Text(title, style: const TextStyle(fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(sub, style: const TextStyle(color: _muted, fontSize: 10))]))),
  );

  Widget _menuTile(IconData icon, String title, String subtitle, VoidCallback onTap) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    elevation: 0,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: _line)),
    child: ListTile(onTap: onTap, leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _green)), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)), subtitle: Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10)), trailing: const Icon(Icons.chevron_left_rounded, color: _muted)),
  );

  Widget _sectionTitle(String title, {Widget? action}) => Row(children: [Expanded(child: Text(title, style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 15))), if (action != null) action]);

  Widget _pageHeader(String title, String subtitle) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: _ink, fontSize: 24, fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text(subtitle, style: const TextStyle(color: _muted, fontSize: 11))]);

  Widget _iconButton(IconData icon, VoidCallback onTap) => Material(color: Colors.white, borderRadius: BorderRadius.circular(14), child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(14), child: Container(width: 43, height: 43, decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)), child: Icon(icon, color: _ink, size: 21))));

  Widget _avatar({bool light = false}) => Container(width: 43, height: 43, decoration: BoxDecoration(color: light ? Colors.white24 : _soft, shape: BoxShape.circle), child: Icon(Icons.person_rounded, color: light ? Colors.white : _green, size: 23));

  Widget _chip(String text, bool positive) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5), decoration: BoxDecoration(color: positive ? _soft : const Color(0xFFF1F3F2), borderRadius: BorderRadius.circular(20)), child: Text(text, style: TextStyle(color: positive ? _green : _muted, fontWeight: FontWeight.w800, fontSize: 9)));

  Widget _statusChip(String text, String status) { final good = status == 'approved' || status == 'confirmed'; return _chip(text, good); }

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
