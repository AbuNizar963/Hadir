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

class JibbleWorkspacePage extends StatefulWidget {
  const JibbleWorkspacePage({super.key});

  @override
  State<JibbleWorkspacePage> createState() => _JibbleWorkspacePageState();
}

class _JibbleWorkspacePageState extends State<JibbleWorkspacePage> {
  final _session = HadirSession();
  String _name = 'الموظف';
  List<dynamic> _attendance = const [];
  bool _loading = true;
  String? _error;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = HadirApi(token: await _session.token());
      final results = await Future.wait([
        api.me(),
        api.attendance(limit: 20),
      ]);
      final me = results[0] as Map<String, dynamic>;
      final user = me['user'];
      if (!mounted) return;
      setState(() {
        _name = user is Map ? '${user['name'] ?? 'الموظف'}' : 'الموظف';
        _attendance = results[1] as List<dynamic>;
        _loading = false;
        _error = null;
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
              _homeTab(),
              _timesheetTab(),
              _moreTab(),
            ],
          ),
        ),
        bottomNavigationBar: _navigation(),
      ),
    );
  }

  Widget _homeTab() {
    final firstName = _name.trim().split(RegExp(r'\s+')).first;
    final now = DateTime.now();
    return RefreshIndicator(
      color: _green,
      onRefresh: _load,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            now.hour < 12 ? 'صباح الخير' : 'مساء الخير',
                            style: const TextStyle(
                              color: _muted,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            firstName,
                            style: const TextStyle(
                              color: _ink,
                              fontSize: 23,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _iconButton(
                      Icons.notifications_none_rounded,
                      () => context.push('/notifications'),
                    ),
                    const SizedBox(width: 8),
                    _avatar(),
                  ],
                ),
                const SizedBox(height: 18),
                _clockCard(now),
                const SizedBox(height: 18),
                _section('اليوم'),
                const SizedBox(height: 10),
                _todayStats(),
                const SizedBox(height: 20),
                _section('اختصارات'),
                const SizedBox(height: 10),
                _shortcuts(),
                const SizedBox(height: 20),
                _section(
                  'آخر الحركات',
                  action: TextButton(
                    onPressed: () => setState(() => _tab = 1),
                    child: const Text('كل السجل'),
                  ),
                ),
                const SizedBox(height: 8),
                _recent(),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _clockCard(DateTime now) {
    final today = _todayAttendance(now);
    final checkedIn = today.any(
      (item) => item is Map && item['type'] == 'check-in',
    );
    final checkedOut = today.any(
      (item) => item is Map && item['type'] == 'check-out',
    );
    final active = checkedIn && !checkedOut;
    final status = checkedOut
        ? 'تم إنهاء الدوام'
        : active
            ? 'أنت على رأس العمل'
            : 'جاهز لتسجيل الحضور';
    final type = active ? 'check-out' : 'check-in';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [_green, _greenDark],
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x240B6B5A),
            blurRadius: 28,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFF9AE3C8),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  status,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
              ),
              Text(
                intl.DateFormat('d MMMM', 'ar').format(now),
                style: const TextStyle(color: Colors.white70, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            intl.DateFormat('HH:mm').format(now),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 44,
              height: 1,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            intl.DateFormat('EEEE، d MMMM yyyy', 'ar').format(now),
            style: const TextStyle(color: Colors.white70, fontSize: 11),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton.icon(
              onPressed: checkedOut
                  ? null
                  : () => context.push('/attendance?type=$type'),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: _green,
                disabledBackgroundColor: Colors.white24,
                disabledForegroundColor: Colors.white70,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(17),
                ),
              ),
              icon: Icon(
                active ? Icons.logout_rounded : Icons.login_rounded,
                size: 20,
              ),
              label: Text(
                active ? 'تسجيل الانصراف' : 'تسجيل الحضور',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
          const SizedBox(height: 9),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.gps_fixed_rounded, color: Colors.white70, size: 14),
              SizedBox(width: 5),
              Text(
                'سيتم التحقق من الموقع والجهاز وQR عند التسجيل',
                style: TextStyle(color: Colors.white70, fontSize: 9.5),
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<dynamic> _todayAttendance(DateTime now) {
    return _attendance.where((item) {
      final date = DateTime.tryParse('${item is Map ? item['timestamp'] : null}');
      return date != null &&
          date.year == now.year &&
          date.month == now.month &&
          date.day == now.day;
    }).toList();
  }

  Widget _todayStats() {
    return Row(
      children: [
        _stat(Icons.schedule_rounded, 'ساعات العمل', _workHours()),
        const SizedBox(width: 9),
        _stat(Icons.verified_user_outlined, 'الحماية', 'نشطة'),
        const SizedBox(width: 9),
        _stat(Icons.location_on_outlined, 'الموقع', 'جاهز'),
      ],
    );
  }

  Widget _stat(IconData icon, String title, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(19),
          border: Border.all(color: _line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: _soft,
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, color: _green, size: 19),
            ),
            const SizedBox(height: 9),
            Text(title, style: const TextStyle(color: _muted, fontSize: 9.5)),
            const SizedBox(height: 2),
            Text(
              value,
              style: const TextStyle(
                color: _ink,
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _workHours() {
    final now = DateTime.now();
    final times = _todayAttendance(now)
        .whereType<Map>()
        .map((e) => DateTime.tryParse('${e['timestamp']}'))
        .whereType<DateTime>()
        .toList()
      ..sort();
    if (times.length < 2) return '—';
    final duration = times.last.difference(times.first);
    return '${duration.inHours}س ${duration.inMinutes.remainder(60)}د';
  }

  Widget _shortcuts() {
    final items = <({IconData icon, String title, String sub, String route})>[
      (
        icon: Icons.qr_code_scanner_rounded,
        title: 'الحضور',
        sub: 'GPS + QR',
        route: '/attendance?type=check-in',
      ),
      (
        icon: Icons.history_rounded,
        title: 'السجل',
        sub: 'الدوام',
        route: '/history',
      ),
      (
        icon: Icons.event_note_outlined,
        title: 'الطلبات',
        sub: 'إجازات وأذونات',
        route: '/requests',
      ),
      (
        icon: Icons.auto_awesome_rounded,
        title: 'الخدمات',
        sub: 'المزيد',
        route: '/services',
      ),
    ];

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: _shortcut(
              items[i].icon,
              items[i].title,
              items[i].sub,
              () => context.push(items[i].route),
            ),
          ),
        ],
      ],
    );
  }

  Widget _shortcut(
    IconData icon,
    String title,
    String subtitle,
    VoidCallback onTap,
  ) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(19),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(19),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(19),
            border: Border.all(color: _line),
          ),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _soft,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(icon, color: _green, size: 20),
              ),
              const SizedBox(height: 7),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _ink,
                  fontWeight: FontWeight.w900,
                  fontSize: 10.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: _muted, fontSize: 7.5),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _recent() {
    if (_loading) {
      return const Column(
        children: [
          _LineSkeleton(),
          SizedBox(height: 8),
          _LineSkeleton(),
        ],
      );
    }
    if (_error != null) {
      return _messageCard(_error!, Icons.cloud_off_rounded);
    }
    if (_attendance.isEmpty) {
      return _messageCard(
        'لا توجد حركات حضور بعد.',
        Icons.event_available_rounded,
      );
    }
    return Column(
      children: _attendance.take(4).map(_attendanceTile).toList(),
    );
  }

  Widget _timesheetTab() {
    return RefreshIndicator(
      color: _green,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
        children: [
          _pageHeader('السجل', 'راجع حضورك وانصرافك وحركات الدوام'),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: _line),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_month_rounded, color: _green),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'هذا الشهر',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                Text(
                  '${_attendance.length} حركة',
                  style: const TextStyle(color: _muted, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (_loading)
            const _LineSkeleton()
          else if (_attendance.isEmpty)
            _messageCard(
              'سيظهر سجل الحضور هنا بعد أول عملية.',
              Icons.history_rounded,
            )
          else
            ..._attendance.map(_attendanceTile),
        ],
      ),
    );
  }

  Widget _moreTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
      children: [
        _pageHeader('المزيد', 'كل أدوات حاضر في مكان واحد'),
        const SizedBox(height: 18),
        _profileCard(),
        const SizedBox(height: 14),
        _menuTile(
          Icons.event_note_outlined,
          'الطلبات',
          'إجازات وأذونات ومتابعة الحالة',
          '/requests',
        ),
        _menuTile(
          Icons.notifications_none_rounded,
          'الإشعارات',
          'التنبيهات والرسائل',
          '/notifications',
        ),
        _menuTile(
          Icons.apps_rounded,
          'الخدمات',
          'الطقس، الصلاة وHadir AI',
          '/services',
        ),
        _menuTile(
          Icons.security_rounded,
          'مركز الموظف',
          'الجهاز وحالة الأمان',
          '/center',
        ),
        _menuTile(
          Icons.person_outline_rounded,
          'حسابي',
          'بيانات الحساب والجهاز',
          '/profile',
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: _soft,
            borderRadius: BorderRadius.circular(19),
            border: Border.all(color: const Color(0xFFD3E8E0)),
          ),
          child: const Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: _green),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'ميزات مثل الرواتب، الأداء والقياسات الحيوية جاهزة لتظهر هنا لاحقاً دون تغيير بنية التطبيق.',
                  style: TextStyle(
                    color: _greenDark,
                    fontSize: 11,
                    height: 1.45,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _navigation() {
    return NavigationBar(
      selectedIndex: _tab,
      onDestinationSelected: (value) => setState(() => _tab = value),
      backgroundColor: Colors.white,
      elevation: 0,
      indicatorColor: _soft,
      height: 70,
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home_rounded),
          label: 'الرئيسية',
        ),
        NavigationDestination(
          icon: Icon(Icons.schedule_outlined),
          selectedIcon: Icon(Icons.schedule_rounded),
          label: 'السجل',
        ),
        NavigationDestination(
          icon: Icon(Icons.more_horiz_rounded),
          selectedIcon: Icon(Icons.apps_rounded),
          label: 'المزيد',
        ),
      ],
    );
  }

  Widget _attendanceTile(dynamic raw) {
    if (raw is! Map) return const SizedBox.shrink();
    final item = Map<String, dynamic>.from(raw);
    final checkout = item['type'] == 'check-out';
    final date = DateTime.tryParse('${item['timestamp']}');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: checkout ? const Color(0xFFFFF1EE) : _soft,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
              checkout ? Icons.logout_rounded : Icons.login_rounded,
              color: checkout ? const Color(0xFFB94A3D) : _green,
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  checkout ? 'تسجيل الانصراف' : 'تسجيل الحضور',
                  style: const TextStyle(
                    color: _ink,
                    fontWeight: FontWeight.w900,
                    fontSize: 12.5,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  date == null
                      ? 'وقت غير متوفر'
                      : intl.DateFormat('EEEE، d MMM • HH:mm', 'ar')
                          .format(date),
                  style: const TextStyle(color: _muted, fontSize: 10.5),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_left_rounded, color: _muted),
        ],
      ),
    );
  }

  Widget _profileCard() {
    return InkWell(
      onTap: () => context.push('/profile'),
      borderRadius: BorderRadius.circular(22),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [_green, _greenDark]),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Row(
          children: [
            _avatar(light: true),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 3),
                  const Text(
                    'حساب الموظف',
                    style: TextStyle(color: Colors.white70, fontSize: 10),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_left_rounded, color: Colors.white70),
          ],
        ),
      ),
    );
  }

  Widget _menuTile(
    IconData icon,
    String title,
    String subtitle,
    String route,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _line),
      ),
      child: ListTile(
        onTap: () => context.push(route),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: _soft,
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(icon, color: _green),
        ),
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w900,
            color: _ink,
            fontSize: 12.5,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(color: _muted, fontSize: 10),
        ),
        trailing: const Icon(Icons.chevron_left_rounded, color: _muted),
      ),
    );
  }

  Widget _section(String title, {Widget? action}) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              color: _ink,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        if (action != null) action,
      ],
    );
  }

  Widget _pageHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: _ink,
            fontSize: 25,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: const TextStyle(color: _muted, fontSize: 11.5),
        ),
      ],
    );
  }

  Widget _messageCard(String message, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          Icon(icon, color: _green),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: _muted, fontSize: 11, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _iconButton(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(11),
          child: Icon(icon, color: _ink, size: 21),
        ),
      ),
    );
  }

  Widget _avatar({bool light = false}) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: light ? Colors.white24 : _soft,
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.person_rounded,
        color: light ? Colors.white : _green,
        size: 22,
      ),
    );
  }
}

class _LineSkeleton extends StatelessWidget {
  const _LineSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 68,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _line),
      ),
    );
  }
}
