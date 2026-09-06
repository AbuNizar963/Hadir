import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;

import '../core/api.dart';
import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _brandDark = Color(0xFF064B40);
const _brandSoft = Color(0xFFE8F5F0);
const _canvas = Color(0xFFF5F7F6);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF73827E);
const _line = Color(0xFFDCE6E2);
const _danger = Color(0xFFB94A3D);

class ModernHomePage extends StatefulWidget {
  const ModernHomePage({super.key});

  @override
  State<ModernHomePage> createState() => _ModernHomePageState();
}

class _ModernHomePageState extends State<ModernHomePage> {
  final _session = HadirSession();
  String _name = 'الموظف';
  List<dynamic> _attendance = const [];
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
        api.attendance(limit: 100),
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
      if (e is DioException && e.response?.statusCode == 401) {
        await _session.clear();
        if (!mounted) return;
        context.go('/login');
        return;
      }
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  List<Map<String, dynamic>> get _todayRecords {
    final today = DateTime.now();
    return _attendance
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .where((item) {
          final value = DateTime.tryParse('${item['timestamp']}');
          return value != null && value.toLocal().year == today.year && value.toLocal().month == today.month && value.toLocal().day == today.day;
        })
        .toList();
  }

  bool get _clockedIn {
    final records = _todayRecords;
    if (records.isEmpty) return false;
    records.sort((a, b) {
      final at = DateTime.tryParse('${a['timestamp']}') ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bt = DateTime.tryParse('${b['timestamp']}') ?? DateTime.fromMillisecondsSinceEpoch(0);
      return at.compareTo(bt);
    });
    return records.last['type'] != 'check-out';
  }

  String get _trackedHours {
    final records = _todayRecords;
    records.sort((a, b) {
      final at = DateTime.tryParse('${a['timestamp']}') ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bt = DateTime.tryParse('${b['timestamp']}') ?? DateTime.fromMillisecondsSinceEpoch(0);
      return at.compareTo(bt);
    });
    Duration total = Duration.zero;
    DateTime? checkIn;
    for (final item in records) {
      final time = DateTime.tryParse('${item['timestamp']}')?.toLocal();
      if (time == null) continue;
      if (item['type'] == 'check-in') {
        checkIn = time;
      } else if (item['type'] == 'check-out' && checkIn != null) {
        total += time.difference(checkIn);
        checkIn = null;
      }
    }
    if (checkIn != null) total += DateTime.now().difference(checkIn);
    final hours = total.inHours;
    final minutes = total.inMinutes.remainder(60);
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final firstName = _name.trim().split(RegExp(r'\s+')).first;
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
                backgroundColor: _canvas,
                surfaceTintColor: Colors.transparent,
                elevation: 0,
                scrolledUnderElevation: 0,
                automaticallyImplyLeading: false,
                toolbarHeight: 68,
                titleSpacing: 16,
                title: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('مرحباً $firstName', style: const TextStyle(color: _ink, fontSize: 18, fontWeight: FontWeight.w900)),
                          const SizedBox(height: 2),
                          Text(intl.DateFormat('EEEE، d MMMM', 'ar').format(now), style: const TextStyle(color: _muted, fontSize: 10.5)),
                        ],
                      ),
                    ),
                    _HeaderButton(icon: Icons.notifications_none_rounded, onTap: () => context.push('/notifications')),
                    const SizedBox(width: 8),
                    _HeaderAvatar(onTap: () => context.push('/profile')),
                  ],
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _dashboardFilter(now),
                    const SizedBox(height: 12),
                    _timeClock(),
                    const SizedBox(height: 14),
                    _trackedHoursCard(),
                    const SizedBox(height: 14),
                    _scheduleCard(),
                    const SizedBox(height: 14),
                    _dashboardActions(),
                    const SizedBox(height: 18),
                    _sectionHeader('آخر الحركات', action: TextButton(onPressed: () => context.push('/history'), child: const Text('عرض الكل'))),
                    const SizedBox(height: 8),
                    _recentActivity(),
                    const SizedBox(height: 14),
                    _securityNote(),
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

  Widget _dashboardFilter(DateTime now) {
    return Row(
      children: [
        Expanded(
          child: _FilterPill(icon: Icons.calendar_today_outlined, label: 'اليوم', value: intl.DateFormat('d MMM', 'ar').format(now)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _FilterPill(icon: Icons.person_outline_rounded, label: 'الموظف', value: _name.trim().split(RegExp(r'\s+')).first),
        ),
      ],
    );
  }

  Widget _timeClock() {
    final active = _clockedIn;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.access_time_rounded, color: _ink, size: 20),
              const SizedBox(width: 8),
              const Expanded(child: Text('ساعة الدوام', style: TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.w900))),
              _StatusPill(label: active ? 'على رأس العمل' : 'خارج الدوام', active: active),
            ],
          ),
          const SizedBox(height: 16),
          Text(active ? 'تم تسجيل الحضور' : 'جاهز لتسجيل الحضور', textAlign: TextAlign.center, style: const TextStyle(color: _ink, fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 5),
          Text(active ? 'يمكنك تسجيل الانصراف عند انتهاء دوامك.' : 'استخدم الموقع والجهاز وQR لإكمال عملية التحقق.', textAlign: TextAlign.center, style: const TextStyle(color: _muted, fontSize: 11, height: 1.4)),
          const SizedBox(height: 16),
          SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: () => context.push('/attendance?type=${active ? 'check-out' : 'check-in'}'),
              style: FilledButton.styleFrom(backgroundColor: _brand, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              icon: Icon(active ? Icons.logout_rounded : Icons.play_arrow_rounded, size: 22),
              label: Text(active ? 'تسجيل الانصراف' : 'تسجيل الحضور', style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _trackedHoursCard() {
    return Row(
      children: [
        Expanded(child: _MetricCard(icon: Icons.timer_outlined, title: 'الساعات المتتبعة', value: _loading ? '—' : _trackedHours)),
        const SizedBox(width: 9),
        Expanded(child: _MetricCard(icon: Icons.event_available_outlined, title: 'حركات اليوم', value: '${_todayRecords.length}')),
      ],
    );
  }

  Widget _scheduleCard() {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)),
      child: Row(
        children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: _brandSoft, borderRadius: BorderRadius.circular(13)), child: const Icon(Icons.schedule_outlined, color: _brand, size: 21)),
          const SizedBox(width: 12),
          const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('جدول العمل', style: TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.w900)), SizedBox(height: 3), Text('لا توجد بيانات جدول متاحة من الخادم حالياً.', style: TextStyle(color: _muted, fontSize: 10.5))])),
          const Icon(Icons.chevron_left_rounded, color: _muted),
        ],
      ),
    );
  }

  Widget _dashboardActions() {
    return Row(
      children: [
        Expanded(child: _ActionCard(icon: Icons.history_rounded, label: 'السجل', onTap: () => context.push('/history'))),
        const SizedBox(width: 9),
        Expanded(child: _ActionCard(icon: Icons.description_outlined, label: 'الطلبات', onTap: () => context.push('/requests'))),
        const SizedBox(width: 9),
        Expanded(child: _ActionCard(icon: Icons.apps_rounded, label: 'الخدمات', onTap: () => context.push('/services'))),
      ],
    );
  }

  Widget _sectionHeader(String title, {Widget? action}) {
    return Row(children: [Expanded(child: Text(title, style: const TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.w900))), if (action != null) action]);
  }

  Widget _recentActivity() {
    if (_loading) return const Column(children: [_ActivitySkeleton(), SizedBox(height: 8), _ActivitySkeleton()]);
    if (_error != null) return _errorCard();
    if (_attendance.isEmpty) {
      return _emptyCard('لا توجد حركات مسجلة بعد.', Icons.event_available_outlined);
    }
    return Column(children: _attendance.take(4).map(_activityTile).toList());
  }

  Widget _activityTile(dynamic item) {
    final record = Map<String, dynamic>.from(item as Map);
    final checkout = record['type'] == 'check-out';
    final time = DateTime.tryParse('${record['timestamp']}')?.toLocal();
    final distance = double.tryParse('${record['distanceMeters']}');
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(17), border: Border.all(color: _line)),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: checkout ? const Color(0xFFFFEFED) : _brandSoft, borderRadius: BorderRadius.circular(12)), child: Icon(checkout ? Icons.logout_rounded : Icons.login_rounded, color: checkout ? _danger : _brand, size: 20)),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(checkout ? 'تسجيل الانصراف' : 'تسجيل الحضور', style: const TextStyle(color: _ink, fontSize: 12.5, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(time == null ? 'وقت غير معروف' : intl.DateFormat('EEEE · HH:mm', 'ar').format(time), style: const TextStyle(color: _muted, fontSize: 10))])),
        if (distance != null) Text('${distance.toStringAsFixed(0)} م', style: const TextStyle(color: _muted, fontSize: 9.5, fontWeight: FontWeight.w800)),
      ]),
    );
  }

  Widget _errorCard() {
    return _emptyCard(_error ?? 'تعذر تحميل البيانات.', Icons.cloud_off_rounded, action: TextButton(onPressed: _load, child: const Text('إعادة')));
  }

  Widget _emptyCard(String text, IconData icon, {Widget? action}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(17), border: Border.all(color: _line)),
      child: Row(children: [Icon(icon, color: _brand), const SizedBox(width: 10), Expanded(child: Text(text, style: const TextStyle(color: _muted, fontSize: 11))), if (action != null) action]),
    );
  }

  Widget _securityNote() {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(color: _brandSoft, borderRadius: BorderRadius.circular(17)),
      child: const Row(children: [Icon(Icons.verified_user_outlined, color: _brand, size: 20), SizedBox(width: 9), Expanded(child: Text('الحضور في HADIR يعتمد على التحقق من الموقع والجهاز ورمز QR قبل اعتماد الحركة.', style: TextStyle(color: _brandDark, fontSize: 10, height: 1.45, fontWeight: FontWeight.w600)))]),
    );
  }

  Widget _bottomNavigation(BuildContext context) {
    return NavigationBar(
      height: 70,
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 6,
      selectedIndex: 0,
      onDestinationSelected: (index) {
        if (index == 1) context.push('/history');
        if (index == 2) context.push('/requests');
        if (index == 3) context.push('/profile');
      },
      destinations: const [
        NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'الرئيسية'),
        NavigationDestination(icon: Icon(Icons.access_time_outlined), selectedIcon: Icon(Icons.access_time_filled), label: 'السجل'),
        NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description_rounded), label: 'الطلبات'),
        NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'حسابي'),
      ],
    );
  }
}

class _HeaderButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _HeaderButton({required this.icon, required this.onTap});
  @override
  Widget build(BuildContext context) => Material(color: Colors.white, shape: const CircleBorder(), child: InkWell(onTap: onTap, customBorder: const CircleBorder(), child: Padding(padding: const EdgeInsets.all(10), child: Icon(icon, color: _ink, size: 20))));
}

class _HeaderAvatar extends StatelessWidget {
  final VoidCallback onTap;
  const _HeaderAvatar({required this.onTap});
  @override
  Widget build(BuildContext context) => Material(color: _brandSoft, shape: const CircleBorder(), child: InkWell(onTap: onTap, customBorder: const CircleBorder(), child: const SizedBox(width: 40, height: 40, child: Icon(Icons.person_rounded, color: _brand, size: 21))));
}

class _FilterPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _FilterPill({required this.icon, required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)), child: Row(children: [Icon(icon, color: _muted, size: 17), const SizedBox(width: 8), Expanded(child: Text(label, style: const TextStyle(color: _muted, fontSize: 9.5))), Text(value, style: const TextStyle(color: _ink, fontSize: 10.5, fontWeight: FontWeight.w900))]));
}

class _StatusPill extends StatelessWidget {
  final String label;
  final bool active;
  const _StatusPill({required this.label, required this.active});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5), decoration: BoxDecoration(color: active ? _brandSoft : const Color(0xFFF0F2F1), borderRadius: BorderRadius.circular(20)), child: Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 6, height: 6, decoration: BoxDecoration(color: active ? _brand : _muted, shape: BoxShape.circle)), const SizedBox(width: 5), Text(label, style: TextStyle(color: active ? _brand : _muted, fontSize: 8.5, fontWeight: FontWeight.w900))]));
}

class _MetricCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  const _MetricCard({required this.icon, required this.title, required this.value});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(13), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)), child: Row(children: [Container(width: 38, height: 38, decoration: BoxDecoration(color: _brandSoft, borderRadius: BorderRadius.circular(11)), child: Icon(icon, color: _brand, size: 19)), const SizedBox(width: 9), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 9.5)), const SizedBox(height: 3), Text(value, style: const TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.w900))]))]));
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _ActionCard({required this.icon, required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) => Material(color: Colors.white, borderRadius: BorderRadius.circular(17), child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(17), child: Container(padding: const EdgeInsets.symmetric(vertical: 13), decoration: BoxDecoration(borderRadius: BorderRadius.circular(17), border: Border.all(color: _line)), child: Column(children: [Icon(icon, color: _brand, size: 22), const SizedBox(height: 7), Text(label, style: const TextStyle(color: _ink, fontSize: 10.5, fontWeight: FontWeight.w900))]))));
}

class _ActivitySkeleton extends StatelessWidget {
  const _ActivitySkeleton();
  @override
  Widget build(BuildContext context) => Container(height: 64, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(17), border: Border.all(color: _line)));
}
