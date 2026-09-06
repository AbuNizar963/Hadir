import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;

import '../core/api.dart';
import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _brandDark = Color(0xFF064B40);
const _brandSoft = Color(0xFFE8F5F0);
const _canvas = Color(0xFFF4F7F6);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF73827E);
const _line = Color(0xFFDCE6E2);
const _orange = Color(0xFFB97822);
const _red = Color(0xFFB94A3D);

class ModernHomePage extends StatefulWidget {
  const ModernHomePage({super.key});

  @override
  State<ModernHomePage> createState() => _ModernHomePageState();
}

class _ModernHomePageState extends State<ModernHomePage> {
  final _session = HadirSession();
  String _name = 'الموظف';
  List<dynamic> _recent = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final token = await _session.token();
      final api = HadirApi(token: token);
      final results = await Future.wait([
        api.me(),
        api.attendance(limit: 5),
      ]);
      final me = results[0] as Map<String, dynamic>;
      final user = me['user'];
      if (!mounted) return;
      setState(() {
        _name = user is Map ? '${user['name'] ?? 'الموظف'}' : 'الموظف';
        _recent = results[1] as List<dynamic>;
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
    final now = DateTime.now();
    final firstName = _name.trim().split(RegExp(r'\s+')).first;
    final greeting = now.hour < 12 ? 'صباح الخير' : 'مساء الخير';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _canvas,
        body: RefreshIndicator(
          color: _brand,
          onRefresh: _load,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverAppBar(
                pinned: true,
                elevation: 0,
                scrolledUnderElevation: 0,
                backgroundColor: _canvas,
                surfaceTintColor: Colors.transparent,
                automaticallyImplyLeading: false,
                toolbarHeight: 74,
                titleSpacing: 18,
                title: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            greeting,
                            style: const TextStyle(
                              color: _muted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            firstName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: _ink,
                              fontSize: 21,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _CircleAction(
                      icon: Icons.notifications_none_rounded,
                      badge: true,
                      onTap: () => context.push('/notifications'),
                    ),
                    const SizedBox(width: 8),
                    _ProfileAvatar(onTap: () => context.push('/profile')),
                  ],
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 30),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _hero(now, firstName),
                    const SizedBox(height: 16),
                    _sectionTitle('ملخص اليوم'),
                    const SizedBox(height: 10),
                    _dailySummary(),
                    const SizedBox(height: 20),
                    _sectionTitle('الوصول السريع'),
                    const SizedBox(height: 10),
                    _quickActions(),
                    const SizedBox(height: 20),
                    _sectionTitle(
                      'آخر النشاطات',
                      action: TextButton(
                        onPressed: () => context.push('/history'),
                        child: const Text('عرض السجل'),
                      ),
                    ),
                    const SizedBox(height: 10),
                    _recentActivity(),
                    const SizedBox(height: 20),
                    _sectionTitle('المزايا القادمة'),
                    const SizedBox(height: 10),
                    _comingSoonStrip(),
                    const SizedBox(height: 18),
                    _securityBanner(),
                  ]),
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: _bottomNavigation(context),
      ),
    );
  }

  Widget _hero(DateTime now, String firstName) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [_brand, _brandDark],
        ),
        borderRadius: BorderRadius.circular(30),
        boxShadow: const [
          BoxShadow(
            color: Color(0x240B6B5A),
            blurRadius: 30,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 9,
                height: 9,
                decoration: const BoxDecoration(
                  color: Color(0xFF91E3C6),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'دوامك اليوم',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              Text(
                intl.DateFormat('EEEE، d MMMM', 'ar').format(now),
                style: const TextStyle(color: Colors.white70, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'أهلًا $firstName 👋',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 26,
              height: 1.1,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 7),
          const Text(
            'كل ما تحتاجه ليوم عملك في مكان واحد، بتجربة بسيطة وآمنة.',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 12.5,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => context.push('/attendance?type=check-in'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: _brand,
                    minimumSize: const Size.fromHeight(53),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(17),
                    ),
                  ),
                  icon: const Icon(Icons.login_rounded, size: 20),
                  label: const Text(
                    'تسجيل الحضور',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
              const SizedBox(width: 9),
              SizedBox(
                width: 53,
                height: 53,
                child: FilledButton(
                  onPressed: () => context.push('/attendance?type=check-out'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: .14),
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(17),
                    ),
                  ),
                  child: const Icon(Icons.logout_rounded),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _dailySummary() {
    return Row(
      children: [
        Expanded(
          child: _summaryCard(
            Icons.schedule_rounded,
            'ساعات العمل',
            '—',
            'اليوم',
          ),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: _summaryCard(
            Icons.location_on_outlined,
            'الموقع',
            'جاهز',
            'GPS',
          ),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: _summaryCard(
            Icons.shield_outlined,
            'الحماية',
            'نشطة',
            'الجهاز',
          ),
        ),
      ],
    );
  }

  Widget _summaryCard(IconData icon, String title, String value, String caption) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(21),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: _brandSoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: _brand, size: 20),
          ),
          const SizedBox(height: 10),
          Text(title, style: const TextStyle(color: _muted, fontSize: 10.5)),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              color: _ink,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 1),
          Text(caption, style: const TextStyle(color: _muted, fontSize: 9)),
        ],
      ),
    );
  }

  Widget _quickActions() {
    return GridView.count(
      crossAxisCount: 4,
      mainAxisSpacing: 9,
      crossAxisSpacing: 9,
      childAspectRatio: .88,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        _quickAction(
          Icons.qr_code_scanner_rounded,
          'الحضور',
          'GPS + QR',
          onTap: () => context.push('/attendance?type=check-in'),
        ),
        _quickAction(
          Icons.history_rounded,
          'السجل',
          'حركاتي',
          onTap: () => context.push('/history'),
        ),
        _quickAction(
          Icons.description_outlined,
          'الطلبات',
          'إجازات',
          onTap: () => context.push('/requests'),
        ),
        _quickAction(
          Icons.apps_rounded,
          'الخدمات',
          'المزيد',
          onTap: () => context.push('/services'),
        ),
      ],
    );
  }

  Widget _quickAction(
    IconData icon,
    String title,
    String subtitle, {
    VoidCallback? onTap,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(21),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(21),
        child: Container(
          padding: const EdgeInsets.fromLTRB(9, 12, 9, 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(21),
            border: Border.all(color: _line),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _brandSoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: _brand, size: 21),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _ink,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(color: _muted, fontSize: 8.5),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(String title, {Widget? action}) {
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

  Widget _recentActivity() {
    if (_loading) {
      return Column(
        children: const [
          _ActivitySkeleton(),
          SizedBox(height: 8),
          _ActivitySkeleton(),
        ],
      );
    }
    if (_error != null) return _errorCard();
    if (_recent.isEmpty) return _emptyActivity();

    return Column(
      children: _recent.take(4).map(_activityTile).toList(),
    );
  }

  Widget _activityTile(dynamic item) {
    final record = Map<String, dynamic>.from(item as Map);
    final checkout = record['type'] == 'check-out';
    final time = DateTime.tryParse('${record['timestamp']}');
    final distance = double.tryParse('${record['distanceMeters']}');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          Container(
            width: 43,
            height: 43,
            decoration: BoxDecoration(
              color: checkout ? const Color(0xFFFFF1EE) : _brandSoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              checkout ? Icons.logout_rounded : Icons.login_rounded,
              color: checkout ? _red : _brand,
              size: 21,
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
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  time == null
                      ? 'وقت غير معروف'
                      : intl.DateFormat('EEEE · HH:mm', 'ar').format(time.toLocal()),
                  style: const TextStyle(color: _muted, fontSize: 10.5),
                ),
              ],
            ),
          ),
          if (distance != null)
            Text(
              '${distance.toStringAsFixed(0)} م',
              style: const TextStyle(
                color: _muted,
                fontSize: 10,
                fontWeight: FontWeight.w800,
              ),
            ),
        ],
      ),
    );
  }

  Widget _emptyActivity() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: _line),
      ),
      child: const Row(
        children: [
          Icon(Icons.event_available_outlined, color: _brand),
          SizedBox(width: 11),
          Expanded(
            child: Text(
              'لا توجد حركات مسجلة بعد.',
              style: TextStyle(color: _muted, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF4F2),
        borderRadius: BorderRadius.circular(19),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, color: _red),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _error ?? 'تعذر تحميل البيانات.',
              style: const TextStyle(color: Color(0xFF8D332C), fontSize: 11),
            ),
          ),
          TextButton(onPressed: _load, child: const Text('إعادة')),
        ],
      ),
    );
  }

  Widget _comingSoonStrip() {
    return SizedBox(
      height: 126,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _futureCard(Icons.payments_outlined, 'قسائم الراتب', 'قريباً'),
          const SizedBox(width: 10),
          _futureCard(Icons.insights_outlined, 'الأداء والتقييم', 'قريباً'),
          const SizedBox(width: 10),
          _futureCard(Icons.groups_outlined, 'دليل الموظفين', 'قريباً'),
          const SizedBox(width: 10),
          _futureCard(Icons.fingerprint_rounded, 'الدخول بالبصمة', 'قريباً'),
        ],
      ),
    );
  }

  Widget _futureCard(IconData icon, String title, String status) {
    return Container(
      width: 148,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(21),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFFF2F4F3),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: _muted, size: 20),
              ),
              const Spacer(),
              _SoonBadge(),
            ],
          ),
          const Spacer(),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: _ink,
              fontSize: 11.5,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(status, style: const TextStyle(color: _orange, fontSize: 9)),
        ],
      ),
    );
  }

  Widget _securityBanner() {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF4F0),
        borderRadius: BorderRadius.circular(21),
        border: Border.all(color: const Color(0xFFD3E8E0)),
      ),
      child: const Row(
        children: [
          Icon(Icons.verified_user_outlined, color: _brand, size: 22),
          SizedBox(width: 11),
          Expanded(
            child: Text(
              'حاضر يحافظ على أمان عملية الحضور باستخدام الموقع والجهاز ورمز QR قبل الاعتماد.',
              style: TextStyle(
                color: _brandDark,
                fontSize: 10.5,
                height: 1.45,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bottomNavigation(BuildContext context) {
    return NavigationBar(
      height: 72,
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 8,
      selectedIndex: 0,
      onDestinationSelected: (index) {
        if (index == 1) context.push('/history');
        if (index == 2) context.push('/requests');
        if (index == 3) context.push('/profile');
      },
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home_rounded),
          label: 'الرئيسية',
        ),
        NavigationDestination(
          icon: Icon(Icons.history_outlined),
          selectedIcon: Icon(Icons.history_rounded),
          label: 'السجل',
        ),
        NavigationDestination(
          icon: Icon(Icons.description_outlined),
          selectedIcon: Icon(Icons.description_rounded),
          label: 'الطلبات',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline_rounded),
          selectedIcon: Icon(Icons.person_rounded),
          label: 'حسابي',
        ),
      ],
    );
  }
}

class _CircleAction extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final bool badge;

  const _CircleAction({required this.icon, required this.onTap, this.badge = false});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Material(
          color: Colors.white,
          shape: const CircleBorder(),
          child: InkWell(
            onTap: onTap,
            customBorder: const CircleBorder(),
            child: const Padding(
              padding: EdgeInsets.all(11),
              child: Icon(Icons.notifications_none_rounded, color: _ink, size: 21),
            ),
          ),
        ),
        if (badge)
          Positioned(
            top: 1,
            right: 2,
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: _red,
                shape: BoxShape.circle,
                border: Border.all(color: _canvas, width: 1.5),
              ),
            ),
          ),
      ],
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  final VoidCallback onTap;

  const _ProfileAvatar({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _brandSoft,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: const SizedBox(
          width: 43,
          height: 43,
          child: Icon(Icons.person_rounded, color: _brand, size: 22),
        ),
      ),
    );
  }
}

class _SoonBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3DE),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Text(
        'قريباً',
        style: TextStyle(
          color: _orange,
          fontSize: 8,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _ActivitySkeleton extends StatelessWidget {
  const _ActivitySkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 68,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: _line),
      ),
    );
  }
}
