import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'core/api.dart';
import 'core/session.dart';
import 'services/attendance_service.dart';

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
    GoRoute(path: '/attendance', builder: (_, state) => AttendancePage(type: state.uri.queryParameters['type'] ?? 'check-in')),
    GoRoute(path: '/history', builder: (_, __) => const HistoryPage()),
  ],
);

class LoginPage extends StatefulWidget { const LoginPage({super.key}); @override State<LoginPage> createState() => _LoginPageState(); }
class _LoginPageState extends State<LoginPage> {
  final user = TextEditingController(); final pass = TextEditingController(); bool busy = false; String? error;
  @override void dispose() { user.dispose(); pass.dispose(); super.dispose(); }
  Future<void> login() async {
    if (user.text.trim().isEmpty || pass.text.isEmpty) { setState(() => error = 'أدخل رقم الموظف والرمز.'); return; }
    setState(() { busy = true; error = null; });
    try {
      final deviceId = await _session.deviceId();
      final api = HadirApi();
      final data = await api.login(user.text, pass.text, deviceId: deviceId, deviceLabel: '${_session.platformLabel} · حاضر');
      if (data['kind'] != 'employee' || data['token'] == null) throw Exception('هذا الحساب ليس حساب موظف.');
      await _session.saveToken(data['token'].toString());
      if (mounted) context.go('/home');
    } catch (e) { if (mounted) setState(() => error = HadirApi.errorMessage(e)); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override Widget build(BuildContext context) => Scaffold(body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 480), child: Column(children: [
    const Icon(Icons.how_to_reg, size: 76), const SizedBox(height: 14), const Text('حاضر', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold)),
    const SizedBox(height: 6), const Text('تسجيل دخول الموظف'), const SizedBox(height: 28),
    TextField(controller: user, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'رقم الموظف', prefixIcon: Icon(Icons.badge_outlined), border: OutlineInputBorder())),
    const SizedBox(height: 14), TextField(controller: pass, obscureText: true, textDirection: TextDirection.ltr, onSubmitted: (_) => login(), decoration: const InputDecoration(labelText: 'رمز PIN / كلمة المرور', prefixIcon: Icon(Icons.lock_outline), border: OutlineInputBorder())),
    if (error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(error!, textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.error))),
    const SizedBox(height: 20), SizedBox(width: double.infinity, height: 52, child: FilledButton(onPressed: busy ? null : login, child: busy ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('دخول'))),
  ]))))));
}

class HomePage extends StatefulWidget { const HomePage({super.key}); @override State<HomePage> createState() => _HomePageState(); }
class _HomePageState extends State<HomePage> {
  String name = 'الموظف';
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { try { final data = await HadirApi(token: await _session.token()).me(); final u = data['user']; if (mounted && u is Map) setState(() => name = (u['name'] ?? 'الموظف').toString()); } catch (_) {} }
  Future<void> logout() async { await HadirApi(token: await _session.token()).logout(); await _session.clear(); if (mounted) context.go('/login'); }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('حاضر'), actions: [IconButton(onPressed: logout, tooltip: 'تسجيل الخروج', icon: const Icon(Icons.logout))]), body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(20), children: [
    Text('مرحبًا، $name', style: const TextStyle(fontSize: 27, fontWeight: FontWeight.bold)), const SizedBox(height: 8), const Text('اختر العملية المطلوبة.'), const SizedBox(height: 24),
    _ActionCard(icon: Icons.login, title: 'تسجيل الحضور', subtitle: 'GPS + QR', onTap: () => context.go('/attendance?type=check-in')),
    const SizedBox(height: 12), _ActionCard(icon: Icons.logout, title: 'تسجيل الانصراف', subtitle: 'GPS + QR', onTap: () => context.go('/attendance?type=check-out')),
    const SizedBox(height: 12), _ActionCard(icon: Icons.history, title: 'سجل الحضور', subtitle: 'آخر العمليات من الخادم', onTap: () => context.go('/history')),
  ])), bottomNavigationBar: const _BottomBar(index: 0));
}
class _ActionCard extends StatelessWidget { final IconData icon; final String title, subtitle; final VoidCallback onTap; const _ActionCard({required this.icon, required this.title, required this.subtitle, required this.onTap}); @override Widget build(BuildContext c) => Card(child: ListTile(contentPadding: const EdgeInsets.all(16), leading: CircleAvatar(child: Icon(icon)), title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)), subtitle: Text(subtitle), trailing: const Icon(Icons.chevron_left), onTap: onTap)); }
class _BottomBar extends StatelessWidget { final int index; const _BottomBar({required this.index}); @override Widget build(BuildContext context) => NavigationBar(selectedIndex: index, onDestinationSelected: (i) => context.go(i == 0 ? '/home' : '/history'), destinations: const [NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'), NavigationDestination(icon: Icon(Icons.history), label: 'السجل')]); }

class AttendancePage extends StatefulWidget { final String type; const AttendancePage({super.key, required this.type}); @override State<AttendancePage> createState() => _AttendancePageState(); }
class _AttendancePageState extends State<AttendancePage> {
  final qr = TextEditingController(); final scanner = MobileScannerController(); late final AttendanceService service; bool scanning = false, busy = false; String? error; double? distance;
  @override void initState() { super.initState(); service = AttendanceService(HadirApi(token: null), _session); _initApi(); }
  Future<void> _initApi() async { service.api.dio.options.headers['Authorization'] = 'Bearer ${await _session.token() ?? ''}'; }
  @override void dispose() { qr.dispose(); scanner.dispose(); super.dispose(); }
  void onDetect(BarcodeCapture capture) { if (qr.text.isNotEmpty) return; final value = capture.barcodes.map((b) => b.rawValue).firstWhere((v) => v != null && v.trim().isNotEmpty, orElse: () => null); if (value != null) { qr.text = value; setState(() => scanning = false); scanner.stop(); } }
  Future<void> submit() async {
    if (qr.text.trim().isEmpty) { setState(() => error = 'امسح رمز QR أولًا.'); return; }
    setState(() { busy = true; error = null; });
    try { final result = await service.record(type: widget.type, qrCode: qr.text.trim()); distance = result.distance; if (mounted) await showDialog(context: context, builder: (_) => AlertDialog(title: const Text('تم التسجيل بنجاح'), content: Text('${widget.type == 'check-in' ? 'تم تسجيل الحضور' : 'تم تسجيل الانصراف'}\n${DateFormat('yyyy/MM/dd - HH:mm:ss').format(result.time.toLocal())}\nالمسافة: ${result.distance.toStringAsFixed(1)} م'), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('تم'))])); if (mounted) context.go('/home'); }
    catch (e) { if (mounted) setState(() => error = HadirApi.errorMessage(e)); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override Widget build(BuildContext context) { final title = widget.type == 'check-in' ? 'تسجيل الحضور' : 'تسجيل الانصراف'; return Scaffold(appBar: AppBar(title: Text(title)), body: ListView(padding: const EdgeInsets.all(20), children: [
    Card(clipBehavior: Clip.antiAlias, child: SizedBox(height: 300, child: scanning ? Stack(children: [MobileScanner(controller: scanner, onDetect: onDetect), Center(child: Container(width: 240, height: 160, decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 3), borderRadius: BorderRadius.circular(18))))]) : Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.qr_code_scanner, size: 82), const SizedBox(height: 12), FilledButton.icon(onPressed: busy ? null : () { setState(() => scanning = true); scanner.start(); }, icon: const Icon(Icons.camera_alt), label: const Text('فتح الكاميرا'))]))),
    const SizedBox(height: 16), TextField(controller: qr, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'رمز QR (إدخال يدوي عند الحاجة)', border: OutlineInputBorder(), prefixIcon: Icon(Icons.qr_code))),
    const SizedBox(height: 12), Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), color: Theme.of(context).colorScheme.surfaceContainerHighest), child: const Row(children: [Icon(Icons.location_on_outlined), SizedBox(width: 10), Expanded(child: Text('سيحدد التطبيق GPS بدقة ويتحقق من نطاق موقع العمل قبل التسجيل.'))])),
    if (error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(error!, textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.error))),
    const SizedBox(height: 18), SizedBox(height: 52, child: FilledButton(onPressed: busy ? null : submit, child: busy ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2)) : Text('تأكيد $title'))),
  ])); }
}

class HistoryPage extends StatefulWidget { const HistoryPage({super.key}); @override State<HistoryPage> createState() => _HistoryPageState(); }
class _HistoryPageState extends State<HistoryPage> {
  List<dynamic> rows = []; bool loading = true; String? error;
  @override void initState() { super.initState(); load(); }
  Future<void> load() async { setState(() { loading = true; error = null; }); try { rows = await HadirApi(token: await _session.token()).attendance(); } catch (e) { error = HadirApi.errorMessage(e); } finally { if (mounted) setState(() => loading = false); } }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('سجل الحضور')), body: loading ? const Center(child: CircularProgressIndicator()) : error != null ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [Text(error!, textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton(onPressed: load, child: const Text('إعادة المحاولة'))])) : RefreshIndicator(onRefresh: load, child: rows.isEmpty ? ListView(children: const [SizedBox(height: 220), Center(child: Text('لا توجد عمليات حضور مسجلة.'))]) : ListView.separated(padding: const EdgeInsets.all(16), itemCount: rows.length, separatorBuilder: (_, __) => const SizedBox(height: 8), itemBuilder: (_, i) { final r = Map<String, dynamic>.from(rows[i] as Map); final type = r['type']?.toString() == 'check-out'; final ts = DateTime.tryParse(r['timestamp']?.toString() ?? ''); return Card(child: ListTile(leading: CircleAvatar(child: Icon(type ? Icons.logout : Icons.login)), title: Text(type ? 'انصراف' : 'حضور', style: const TextStyle(fontWeight: FontWeight.bold)), subtitle: Text(ts == null ? 'وقت غير معروف' : DateFormat('yyyy/MM/dd - HH:mm:ss').format(ts.toLocal())), trailing: Text('${double.tryParse('${r['distanceMeters'] ?? 0}')?.toStringAsFixed(0) ?? '0'} م'))); })), bottomNavigationBar: const _BottomBar(index: 1));
}
