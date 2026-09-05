import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';

class ModernHomePage extends StatefulWidget {
  const ModernHomePage({super.key});

  @override
  State<ModernHomePage> createState() => _ModernHomePageState();
}

class _ModernHomePageState extends State<ModernHomePage> {
  static const _brand = Color(0xFF0B7A75);
  final _api = HadirApi();
  Map<String, dynamic>? _me;
  Map<String, dynamic>? _today;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final me = await _api.me();
      final today = await _api.attendance(limit: 1);
      if (!mounted) return;
      setState(() {
        _me = me;
        _today = today.isNotEmpty ? today.first : null;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = (_me?['user'] as Map?)?.cast<String, dynamic>();
    final name = (user?['name'] ?? user?['fullName'] ?? user?['username'] ?? 'موظف').toString();

    return Scaffold(
      backgroundColor: const Color(0xFFF6F8FA),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 110),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('مرحباً،', style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
                        const SizedBox(height: 3),
                        Text(name, style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w900)),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => context.go('/notifications'),
                    icon: const Icon(Icons.notifications_none_rounded),
                    style: IconButton.styleFrom(backgroundColor: Colors.white),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _heroCard(),
              const SizedBox(height: 18),
              _stats(),
              const SizedBox(height: 20),
              const Text('إجراءات سريعة', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _quick('طلب إجازة', Icons.beach_access_rounded, () => context.go('/requests'))),
                  const SizedBox(width: 10),
                  Expanded(child: _quick('السجل', Icons.history_rounded, () => context.go('/history'))),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _quick('الإشعارات', Icons.notifications_active_outlined, () => context.go('/notifications'))),
                  const SizedBox(width: 10),
                  Expanded(child: _quick('الملف الشخصي', Icons.person_outline_rounded, () => context.go('/profile'))),
                ],
              ),
              const SizedBox(height: 20),
              if (!_loading && _today != null) _todayCard(_today!),
            ],
          ),
        ),
      ),
    );
  }

  Widget _heroCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [_brand, Color(0xFF0F5F63)]),
        borderRadius: BorderRadius.circular(26),
        boxShadow: [BoxShadow(color: _brand.withValues(alpha: .18), blurRadius: 24, offset: const Offset(0, 10))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.verified_user_rounded, color: Colors.white, size: 21),
            SizedBox(width: 8),
            Text('حالة الحضور', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 12),
          const Text('جاهز لتسجيل حضورك؟', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          const Text('تحقق ذكي من الموقع وQR والجهاز قبل اعتماد حضورك.', style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.45)),
          const SizedBox(height: 18),
          Row(children: [
            Expanded(child: FilledButton.icon(
              onPressed: () => context.go('/attendance?type=check-in'),
              style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: _brand, minimumSize: const Size.fromHeight(54), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17))),
              icon: const Icon(Icons.login_rounded),
              label: const Text('تسجيل الحضور', style: TextStyle(fontWeight: FontWeight.w800)),
            )),
            const SizedBox(width: 10),
            SizedBox(width: 54, height: 54, child: FilledButton(
              onPressed: () => context.go('/attendance?type=check-out'),
              style: FilledButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: .14), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)), padding: EdgeInsets.zero),
              child: const Icon(Icons.logout_rounded),
            )),
          ]),
        ],
      ),
    );
  }

  Widget _stats() {
    final record = _today;
    final hours = record == null ? '--' : ((record['hours'] ?? record['duration'] ?? '--')).toString();
    return Row(children: [
      Expanded(child: _stat('ساعات اليوم', hours, Icons.schedule_rounded)),
      const SizedBox(width: 10),
      Expanded(child: _stat('آخر تسجيل', record == null ? '--' : (record['type'] ?? 'حضور').toString(), Icons.access_time_rounded)),
    ]);
  }

  Widget _stat(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: _brand.withValues(alpha: .09), borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: _brand, size: 21)),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 11)), const SizedBox(height: 3), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14))])),
      ]),
    );
  }

  Widget _quick(String title, IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Icon(icon, color: _brand),
            const SizedBox(width: 10),
            Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w800))),
            const Icon(Icons.chevron_left_rounded, color: Colors.grey),
          ]),
        ),
      ),
    );
  }

  Widget _todayCard(Map<String, dynamic> record) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('آخر تسجيل', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        const SizedBox(height: 10),
        Text((record['type'] ?? 'حضور').toString(), style: const TextStyle(color: _brand, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text((record['createdAt'] ?? record['timestamp'] ?? '').toString(), style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
      ]),
    );
  }
}
