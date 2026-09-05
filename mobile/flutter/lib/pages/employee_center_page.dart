import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';

class EmployeeCenterPage extends StatefulWidget {
  const EmployeeCenterPage({super.key});
  @override State<EmployeeCenterPage> createState() => _EmployeeCenterPageState();
}

class _EmployeeCenterPageState extends State<EmployeeCenterPage> {
  final _session = HadirSession();
  Map<String, dynamic>? device;
  bool loading = true;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async { try { final d = await HadirApi(token: await _session.token()).employeeDeviceStatus(); if (mounted) setState(() { device = d; loading = false; }); } catch (_) { if (mounted) setState(() => loading = false); } }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('مركز الموظف', style: TextStyle(fontWeight: FontWeight.w900))),
    body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(20), children: [
      const Text('كل خدماتك في مكان واحد', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900)),
      const SizedBox(height: 6),
      const Text('الحضور، السجل، الطلبات، الإشعارات والخدمات الذكية.', style: TextStyle(color: Colors.black54)),
      const SizedBox(height: 20),
      _tile(Icons.qr_code_scanner_rounded, 'تسجيل الحضور', 'QR + GPS + تحقق الجهاز', () => context.go('/attendance?type=check-in')),
      _tile(Icons.history_rounded, 'سجل الحضور', 'راجع كل عملياتك وأوقاتك', () => context.go('/history')),
      _tile(Icons.event_note_rounded, 'الطلبات', 'إجازة أو إذن ومتابعة الحالة', () => context.go('/requests')),
      _tile(Icons.notifications_none_rounded, 'الإشعارات', 'الرسائل والتنبيهات الخاصة بك', () => context.go('/notifications')),
      _tile(Icons.cloud_outlined, 'الطقس والصلاة', 'الطقس، مواقيت الصلاة والقبلة', () => context.go('/services')),
      _tile(Icons.auto_awesome_outlined, 'Hadir AI', 'مساعد ذكي للموظف', () => context.go('/services')),
      const SizedBox(height: 12),
      Card(child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [const Icon(Icons.security_rounded, color: Color(0xFF0B6B5A)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('حماية الجهاز', style: TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 4), Text(loading ? 'جارٍ التحقق…' : (device?['bound'] == true ? 'الجهاز مرتبط بالحساب' : 'لم يتم ربط الجهاز بعد'), style: const TextStyle(fontSize: 12, color: Colors.black54))]))]))),
    ])),
  );

  Widget _tile(IconData icon, String title, String subtitle, VoidCallback onTap) => Card(margin: const EdgeInsets.only(bottom: 10), child: ListTile(onTap: onTap, leading: CircleAvatar(backgroundColor: const Color(0xFFEAF4F0), foregroundColor: const Color(0xFF0B6B5A), child: Icon(icon)), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text(subtitle), trailing: const Icon(Icons.chevron_left_rounded)));
}
