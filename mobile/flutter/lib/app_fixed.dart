import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;
import 'package:mobile_scanner/mobile_scanner.dart';

import 'core/api.dart';
import 'core/session.dart';
import 'services/attendance_service.dart';
import 'pages/requests_page.dart';
import 'pages/notifications_page.dart';
import 'pages/profile_page.dart';

final _session = HadirSession();

GoRouter buildRouter() => GoRouter(
  initialLocation: '/login',
  redirect: (_, state) async {
    final token = await _session.token();
    if (token == null && state.matchedLocation != '/login') return '/login';
    if (token != null && state.matchedLocation == '/login') return '/home';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/home', builder: (_, __) => const HomePage()),
    GoRoute(path: '/attendance', builder: (_, s) => AttendancePage(type: s.uri.queryParameters['type'] ?? 'check-in')),
    GoRoute(path: '/history', builder: (_, __) => const HistoryPage()),
    GoRoute(path: '/requests', builder: (_, __) => const RequestsPage()),
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationsPage()),
    GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
  ],
);

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override State<LoginPage> createState() => _LoginPageState();
}
class _LoginPageState extends State<LoginPage> {
  final user = TextEditingController(), pass = TextEditingController();
  bool busy = false; String? error;
  @override void dispose() { user.dispose(); pass.dispose(); super.dispose(); }
  Future<void> login() async {
    if (user.text.trim().isEmpty || pass.text.isEmpty) { setState(() => error = 'أدخل رقم الموظف والرمز.'); return; }
    setState(() { busy = true; error = null; });
    try {
      final deviceId = await _session.deviceId();
      final fingerprint = await _session.deviceFingerprint();
      final r = await HadirApi().login(user.text, pass.text, deviceId: deviceId, deviceLabel: _session.platformLabel, fingerprint: fingerprint);
      if (r['kind'] != 'employee' || r['token'] == null) throw Exception('هذا الحساب ليس حساب موظف.');
      await _session.saveToken(r['token'].toString());
      if (mounted) context.go('/home');
    } catch (e) { if (mounted) setState(() => error = HadirApi.errorMessage(e)); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override Widget build(BuildContext context) => Scaffold(body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 480), child: Column(children: [
    const Icon(Icons.how_to_reg, size: 76), const SizedBox(height: 14), const Text('حاضر', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold)), const SizedBox(height: 6), const Text('تسجيل دخول الموظف'), const SizedBox(height: 28),
    TextField(controller: user, decoration: const InputDecoration(labelText: 'رقم الموظف', prefixIcon: Icon(Icons.badge_outlined), border: OutlineInputBorder())), const SizedBox(height: 14),
    TextField(controller: pass, obscureText: true, onSubmitted: (_) => login(), decoration: const InputDecoration(labelText: 'رمز PIN / كلمة المرور', prefixIcon: Icon(Icons.lock_outline), border: OutlineInputBorder())),
    if (error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red))), const SizedBox(height: 20),
    SizedBox(width: double.infinity, height: 52, child: FilledButton(onPressed: busy ? null : login, child: busy ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('دخول'))),
  ]))))));
}

class HomePage extends StatefulWidget { const HomePage({super.key}); @override State<HomePage> createState() => _HomePageState(); }
class _HomePageState extends State<HomePage> {
  String name = 'الموظف';
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { try { final r = await HadirApi(token: await _session.token()).me(); final u = r['user']; if (mounted && u is Map) setState(() => name = '${u['name'] ?? 'الموظف'}'); } catch (_) {} }
  Future<void> logout() async { await HadirApi(token: await _session.token()).logout(); await _session.clear(); if (mounted) context.go('/login'); }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('حاضر'), actions: [IconButton(onPressed: () => context.go('/notifications'), icon: const Icon(Icons.notifications_outlined)), IconButton(onPressed: () => context.go('/profile'), icon: const Icon(Icons.person_outline)), IconButton(onPressed: logout, icon: const Icon(Icons.logout))]),
    body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(20), children: [Text('مرحبًا، $name', style: const TextStyle(fontSize: 27, fontWeight: FontWeight.bold)), const SizedBox(height: 8), const Text('اختر العملية المطلوبة.'), const SizedBox(height: 24),
      _card(Icons.login, 'تسجيل الحضور', 'GPS + QR', () => context.go('/attendance?type=check-in')), _card(Icons.logout, 'تسجيل الانصراف', 'GPS + QR', () => context.go('/attendance?type=check-out')), _card(Icons.history, 'سجل الحضور', 'آخر العمليات من الخادم', () => context.go('/history')), _card(Icons.assignment_outlined, 'الطلبات', 'إجازات واستئذان وانصراف', () => context.go('/requests'))])),
    bottomNavigationBar: const _BottomBar(index: 0),
  );
  Widget _card(IconData i, String t, String s, VoidCallback tap) => Card(child: ListTile(contentPadding: const EdgeInsets.all(16), leading: CircleAvatar(child: Icon(i)), title: Text(t, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)), subtitle: Text(s), trailing: const Icon(Icons.chevron_left), onTap: tap));
}

class _BottomBar extends StatelessWidget { final int index; const _BottomBar({required this.index}); @override Widget build(BuildContext c) => NavigationBar(selectedIndex: index, onDestinationSelected: (i) => c.go(i == 0 ? '/home' : i == 1 ? '/history' : '/requests'), destinations: const [NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'), NavigationDestination(icon: Icon(Icons.history), label: 'السجل'), NavigationDestination(icon: Icon(Icons.assignment_outlined), label: 'الطلبات')]); }

class AttendancePage extends StatefulWidget { final String type; const AttendancePage({super.key, required this.type}); @override State<AttendancePage> createState() => _AttendancePageState(); }
class _AttendancePageState extends State<AttendancePage> {
  final qr = TextEditingController(); final scanner = MobileScannerController(); AttendanceService? service; bool scanning = false, busy = false, ready = false; String? error;
  @override void initState() { super.initState(); _init(); }
  Future<void> _init() async { final token = await _session.token(); if (!mounted) return; if (token == null || token.isEmpty) { setState(() => error = 'انتهت الجلسة. سجّل الدخول مرة أخرى.'); return; } setState(() { service = AttendanceService(HadirApi(token: token), _session); ready = true; }); }
  @override void dispose() { qr.dispose(); scanner.dispose(); super.dispose(); }
  void onDetect(BarcodeCapture capture) { if (qr.text.isNotEmpty) return; for (final b in capture.barcodes) { final v = b.rawValue; if (v != null && v.trim().isNotEmpty) { qr.text = v.trim(); setState(() => scanning = false); scanner.stop(); break; } } }
  Future<void> submit() async {
    final current = service; if (current == null || !ready) { setState(() => error = 'الجلسة غير جاهزة. أعد فتح الصفحة.'); return; } if (qr.text.trim().isEmpty) { setState(() => error = 'امسح رمز QR أولًا.'); return; }
    setState(() { busy = true; error = null; });
    try { final r = await current.record(type: widget.type, qrCode: qr.text.trim()); if (!mounted) return; await showDialog<void>(context: context, builder: (_) => AlertDialog(title: const Text('تم التسجيل بنجاح'), content: Text('${widget.type == 'check-in' ? 'تم تسجيل الحضور' : 'تم تسجيل الانصراف'}\n${intl.DateFormat('yyyy/MM/dd - HH:mm:ss').format(r.time.toLocal())}\nالمسافة: ${r.distance.toStringAsFixed(1)} م'), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('تم'))])); if (mounted) context.go('/home'); }
    catch (e) { if (mounted) setState(() => error = HadirApi.errorMessage(e)); } finally { if (mounted) setState(() => busy = false); }
  }
  @override Widget build(BuildContext context) { final title = widget.type == 'check-in' ? 'تسجيل الحضور' : 'تسجيل الانصراف'; return Scaffold(appBar: AppBar(title: Text(title)), body: ListView(padding: const EdgeInsets.all(20), children: [
    Card(clipBehavior: Clip.antiAlias, child: SizedBox(height: 300, child: scanning ? Stack(children: [MobileScanner(controller: scanner, onDetect: onDetect), Center(child: Container(width: 240, height: 160, decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 3), borderRadius: BorderRadius.circular(18))))]) : Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.qr_code_scanner, size: 82), const SizedBox(height: 12), FilledButton.icon(onPressed: busy ? null : () { setState(() => scanning = true); scanner.start(); }, icon: const Icon(Icons.camera_alt), label: const Text('فتح الكاميرا'))])))), const SizedBox(height: 16),
    TextField(controller: qr, decoration: const InputDecoration(labelText: 'رمز QR (إدخال يدوي عند الحاجة)', border: OutlineInputBorder(), prefixIcon: Icon(Icons.qr_code))), if (error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red))), const SizedBox(height: 18), SizedBox(height: 52, child: FilledButton(onPressed: busy || !ready ? null : submit, child: busy ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2)) : Text('تأكيد $title')))
  ])); }
}

class HistoryPage extends StatefulWidget { const HistoryPage({super.key}); @override State<HistoryPage> createState() => _HistoryPageState(); }
class _HistoryPageState extends State<HistoryPage> {
  List<dynamic> rows = []; bool loading = true; String? error;
  @override void initState() { super.initState(); load(); }
  Future<void> load() async { if (mounted) setState(() { loading = true; error = null; }); try { rows = await HadirApi(token: await _session.token()).attendance(); } catch (e) { error = HadirApi.errorMessage(e); } finally { if (mounted) setState(() => loading = false); } }
  @override Widget build(BuildContext context) { Widget body; if (loading) body = const Center(child: CircularProgressIndicator()); else if (error != null) body = Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(error!), FilledButton(onPressed: load, child: const Text('إعادة المحاولة'))])); else if (rows.isEmpty) body = RefreshIndicator(onRefresh: load, child: ListView(children: const [SizedBox(height: 220), Center(child: Text('لا توجد سجلات حضور'))])); else body = RefreshIndicator(onRefresh: load, child: ListView.separated(padding: const EdgeInsets.all(16), itemCount: rows.length, separatorBuilder: (_, __) => const SizedBox(height: 8), itemBuilder: (_, i) { final r = Map<String, dynamic>.from(rows[i] as Map); final checkout = r['type'] == 'check-out'; final ts = DateTime.tryParse('${r['timestamp']}'); return Card(child: ListTile(leading: CircleAvatar(child: Icon(checkout ? Icons.logout : Icons.login)), title: Text(checkout ? 'انصراف' : 'حضور'), subtitle: Text(ts == null ? 'وقت غير معروف' : intl.DateFormat('yyyy/MM/dd - HH:mm:ss').format(ts.toLocal())), trailing: Text('${r['distanceMeters'] ?? 0} م'))); })); return Scaffold(appBar: AppBar(title: const Text('سجل الحضور')), body: body, bottomNavigationBar: const _BottomBar(index: 1)); }
}
