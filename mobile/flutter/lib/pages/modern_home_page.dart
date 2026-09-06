import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;

import '../core/api.dart';
import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _ink = Color(0xFF17322C);
const _muted = Color(0xFF70817B);
const _surface = Color(0xFFFFFFFF);
const _soft = Color(0xFFEAF4F0);

class ModernHomePage extends StatefulWidget {
  const ModernHomePage({super.key});
  @override State<ModernHomePage> createState() => _ModernHomePageState();
}

class _ModernHomePageState extends State<ModernHomePage> {
  final _session = HadirSession();
  String name = 'الموظف';
  List<dynamic> recent = const [];
  bool loading = true;
  String? error;

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
        api.attendance(limit: 5),
      ]);
      final me = results[0] as Map<String, dynamic>;
      final user = me['user'];
      if (!mounted) return;
      setState(() {
        name = user is Map ? '${user['name'] ?? 'الموظف'}' : 'الموظف';
        recent = results[1] as List<dynamic>;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = HadirApi.errorMessage(e);
        loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final firstName = name.trim().split(RegExp(r'\s+')).first;
    final now = DateTime.now();
    final greeting = now.hour < 12 ? 'صباح الخير' : now.hour < 17 ? 'مساء الخير' : 'مساء الخير';

    return Scaffold(
      backgroundColor: const Color(0xFFF7F9F8),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              backgroundColor: const Color(0xFFF7F9F8),
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              pinned: true,
              expandedHeight: 86,
              automaticallyImplyLeading: false,
              titleSpacing: 20,
              title: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(greeting, style: const TextStyle(fontSize: 13, color: _muted)),
                        const SizedBox(height: 2),
                        Text(firstName, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: _ink)),
                      ],
                    ),
                  ),
                  _RoundIconButton(icon: Icons.notifications_none_rounded, onTap: () => context.push('/notifications')),
                  const SizedBox(width: 8),
                  _AvatarButton(onTap: () => context.push('/profile')),
                ],
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 28),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _hero(now),
                  const SizedBox(height: 18),
                  _sectionHeader('يومك اليوم', null),
                  const SizedBox(height: 10),
                  _stats(),
                  const SizedBox(height: 22),
                  _sectionHeader('الوصول السريع', null),
                  const SizedBox(height: 10),
                  _quickGrid(),
                  const SizedBox(height: 22),
                  _sectionHeader('آخر النشاطات', () => context.push('/history')),
                  const SizedBox(height: 8),
                  if (loading) ...const [_ActivitySkeleton(), _ActivitySkeleton()]
                  else if (error != null) _errorCard()
                  else if (recent.isEmpty) _emptyCard()
                  else ...recent.take(4).map(_activityTile),
                ]),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        onDestinationSelected: (index) {
          if (index == 1) context.push('/history');
          if (index == 2) context.push('/requests');
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'الرئيسية'),
          NavigationDestination(icon: Icon(Icons.history_outlined), selectedIcon: Icon(Icons.history_rounded), label: 'السجل'),
          NavigationDestination(icon: Icon(Icons.assignment_outlined), selectedIcon: Icon(Icons.assignment_rounded), label: 'الطلبات'),
        ],
      ),
    );
  }

  Widget _hero(DateTime now) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [Color(0xFF0B6B5A), Color(0xFF084F44)]),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [BoxShadow(blurRadius: 28, offset: Offset(0, 14), color: Color(0x220B6B5A))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(width: 10, height: 10, decoration: const BoxDecoration(color: Color(0xFF8BE0C5), shape: BoxShape.circle)),
          const SizedBox(width: 8),
          const Text('الدوام اليوم', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
          const Spacer(),
          Text(intl.DateFormat('d MMMM', 'ar').format(now), style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ]),
        const SizedBox(height: 20),
        const Text('جاهز للحضور؟', style: TextStyle(color: Colors.white, fontSize: 27, fontWeight: FontWeight.w800, height: 1.1)),
        const SizedBox(height: 7),
        const Text('تحقق ذكي من الموقع وQR والجهاز قبل اعتماد حضورك.', style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.45)),
        const SizedBox(height: 18),
        Row(children: [
          Expanded(child: FilledButton.icon(
            onPressed: () => context.push('/attendance?type=check-in'),
            style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: _brand, minimumSize: const Size.fromHeight(54), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17))),
            icon: const Icon(Icons.login_rounded),
            label: const Text('تسجيل الحضور', style: TextStyle(fontWeight: FontWeight.w800)),
          )),
          const SizedBox(width: 10),
          SizedBox(width: 54, height: 54, child: FilledButton(
            onPressed: () => context.push('/attendance?type=check-out'),
            style: FilledButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: .14), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)), padding: EdgeInsets.zero),
            child: const Icon(Icons.logout_rounded),
          )),
        ]),
      ]),
    );
  }

  Widget _stats() {
    return Row(children: [
      Expanded(child: _stat(Icons.schedule_rounded, 'الساعات', '—', 'اليوم')),
      const SizedBox(width: 10),
      Expanded(child: _stat(Icons.location_on_outlined, 'الموقع', 'جاهز', 'GPS')),
      const SizedBox(width: 10),
      Expanded(child: _stat(Icons.verified_user_outlined, 'الحماية', 'نشطة', 'الجهاز')),
    ]);
  }

  Widget _stat(IconData icon, String title, String value, String caption) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E9E6))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(width: 38, height: 38, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _brand, size: 21)),
        const SizedBox(height: 11),
        Text(title, style: const TextStyle(fontSize: 12, color: _muted)),
        const SizedBox(height: 3),
        Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _ink)),
        const SizedBox(height: 1),
        Text(caption, style: const TextStyle(fontSize: 10, color: _muted)),
      ]),
    );
  }

  Widget _quickGrid() {
    return Row(children: [
      Expanded(child: _quick(Icons.qr_code_scanner_rounded, 'الحضور', 'QR + GPS', () => context.push('/attendance?type=check-in'))),
      const SizedBox(width: 10),
      Expanded(child: _quick(Icons.logout_rounded, 'الانصراف', 'إنهاء الدوام', () => context.push('/attendance?type=check-out'))),
      const SizedBox(width: 10),
      Expanded(child: _quick(Icons.assignment_outlined, 'الطلبات', 'إجازة وطلب', () => context.push('/requests'))),
    ]);
  }

  Widget _quick(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return Material(
      color: _surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.fromLTRB(13, 14, 13, 13),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E9E6))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 42, height: 42, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: _brand)),
            const SizedBox(height: 11),
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: _ink)),
            const SizedBox(height: 3),
            Text(subtitle, style: const TextStyle(fontSize: 10, color: _muted)),
          ]),
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, VoidCallback? action) => Row(children: [
    Expanded(child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _ink))),
    if (action != null) TextButton(onPressed: action, child: const Text('عرض الكل')),
  ]);

  Widget _activityTile(dynamic item) {
    final r = Map<String, dynamic>.from(item as Map);
    final checkout = r['type'] == 'check-out';
    final time = DateTime.tryParse('${r['timestamp']}');
    final distance = r['distanceMeters'];
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE2E9E6))),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 3),
        leading: Container(width: 44, height: 44, decoration: BoxDecoration(color: checkout ? const Color(0xFFFFF1EE) : _soft, borderRadius: BorderRadius.circular(14)), child: Icon(checkout ? Icons.logout_rounded : Icons.login_rounded, color: checkout ? const Color(0xFFB94A3D) : _brand)),
        title: Text(checkout ? 'تسجيل الانصراف' : 'تسجيل الحضور', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: _ink)),
        subtitle: Text(time == null ? 'وقت غير معروف' : intl.DateFormat('EEEE · HH:mm', 'ar').format(time.toLocal()), style: const TextStyle(fontSize: 11, color: _muted)),
        trailing: distance == null ? null : Text('${double.tryParse('$distance')?.toStringAsFixed(0) ?? distance} م', style: const TextStyle(fontSize: 11, color: _muted, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _emptyCard() => Container(padding: const EdgeInsets.all(22), decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE2E9E6))), child: const Row(children: [Icon(Icons.event_available_outlined, color: _brand), SizedBox(width: 12), Text('لا توجد حركات مسجلة بعد', style: TextStyle(color: _muted, fontSize: 13))]));

  Widget _errorCard() => Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: const Color(0xFFFFF4F2), borderRadius: BorderRadius.circular(18)), child: Row(children: [const Icon(Icons.wifi_off_rounded, color: Color(0xFFB94A3D)), const SizedBox(width: 10), Expanded(child: Text(error!, style: const TextStyle(color: Color(0xFF8D332C), fontSize: 12))), TextButton(onPressed: _load, child: const Text('إعادة'))]));
}
