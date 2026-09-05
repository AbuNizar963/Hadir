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
const _brand = Color(0xFF0B6B5A);
const _ink = Color(0xFF17322C);
const _muted = Color(0xFF70817B);
const _soft = Color(0xFFEAF4F0);
const _danger = Color(0xFF9D3029);

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
    GoRoute(
      path: '/attendance',
      builder: (_, state) => AttendancePage(
        type: state.uri.queryParameters['type'] ?? 'check-in',
      ),
    ),
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
  final user = TextEditingController();
  final pass = TextEditingController();
  bool busy = false;
  bool hidden = true;
  String? error;

  @override
  void dispose() {
    user.dispose();
    pass.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (user.text.trim().isEmpty || pass.text.isEmpty) {
      setState(() => error = 'أدخل رقم الموظف وكلمة المرور.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final deviceId = await _session.deviceId();
      final fingerprint = await _session.deviceFingerprint();
      final response = await HadirApi().login(
        user.text,
        pass.text,
        deviceId: deviceId,
        deviceLabel: _session.platformLabel,
        fingerprint: fingerprint,
      );
      if (response['kind'] != 'employee' || response['token'] == null) {
        throw Exception('هذا الحساب ليس حساب موظف.');
      }
      await _session.saveToken(response['token'].toString());
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) setState(() => error = HadirApi.errorMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 82,
                    height: 82,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _brand,
                      borderRadius: BorderRadius.circular(26),
                      boxShadow: const [BoxShadow(blurRadius: 24, offset: Offset(0, 10))],
                    ),
                    child: const Icon(Icons.how_to_reg_rounded, color: Colors.white, size: 44),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'حاضر',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 38, fontWeight: FontWeight.w800, color: _ink),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'حضورك أسهل، يومك أوضح',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: _muted, fontSize: 16),
                  ),
                  const SizedBox(height: 36),
                  TextField(
                    controller: user,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'رقم الموظف',
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: pass,
                    obscureText: hidden,
                    onSubmitted: (_) => _login(),
                    decoration: InputDecoration(
                      labelText: 'كلمة المرور',
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => hidden = !hidden),
                        icon: Icon(hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                      ),
                    ),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 14),
                    _ErrorBox(message: error!),
                  ],
                  const SizedBox(height: 22),
                  FilledButton.icon(
                    onPressed: busy ? null : _login,
                    icon: busy
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.arrow_forward_rounded),
                    label: Text(busy ? 'جارٍ التحقق...' : 'تسجيل الدخول'),
                  ),
                  const SizedBox(height: 20),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.shield_outlined, size: 16, color: _muted),
                      SizedBox(width: 6),
                      Text('دخول آمن مرتبط بجهازك', style: TextStyle(color: _muted, fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  String name = 'الموظف';
  List<dynamic> recent = [];
  bool loading = true;

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
        api.attendance(limit: 3),
      ]);
      final me = results[0];
      final profile = me['user'];
      if (!mounted) return;
      setState(() {
        if (profile is Map) name = '${profile['name'] ?? 'الموظف'}';
        recent = List<dynamic>.from(results[1] as List);
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('حاضر', style: TextStyle(fontWeight: FontWeight.w800, color: _ink)),
        actions: [
          IconButton(
            onPressed: () => context.go('/notifications'),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 8),
            child: InkWell(
              onTap: () => context.go('/profile'),
              borderRadius: BorderRadius.circular(24),
              child: const CircleAvatar(
                radius: 19,
                backgroundColor: _soft,
                child: Icon(Icons.person_outline_rounded, color: _brand),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 30),
          children: [
            const Text('مساء الخير 👋', style: TextStyle(color: _muted, fontSize: 14)),
            const SizedBox(height: 4),
            Text(name, style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w800, color: _ink)),
            const SizedBox(height: 22),
            _TodayCard(onTap: () => context.go('/attendance?type=check-in')),
            const SizedBox(height: 22),
            const Text('إجراءات سريعة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _ink)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _QuickAction(icon: Icons.qr_code_scanner_rounded, title: 'تسجيل الحضور', onTap: () => context.go('/attendance?type=check-in'))),
                const SizedBox(width: 10),
                Expanded(child: _QuickAction(icon: Icons.logout_rounded, title: 'تسجيل الانصراف', onTap: () => context.go('/attendance?type=check-out'))),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _QuickAction(icon: Icons.assignment_outlined, title: 'الطلبات', onTap: () => context.go('/requests'))),
                const SizedBox(width: 10),
                Expanded(child: _QuickAction(icon: Icons.history_rounded, title: 'السجل', onTap: () => context.go('/history'))),
              ],
            ),
            const SizedBox(height: 22),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('آخر الحركات', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _ink)),
                TextButton(onPressed: () => context.go('/history'), child: const Text('عرض الكل')),
              ],
            ),
            if (loading) ...[const _Skeleton(), const _Skeleton()] else if (recent.isEmpty) const _EmptyRecent() else ...recent.map(_RecentTile.new),
          ],
        ),
      ),
      bottomNavigationBar: const _BottomBar(index: 0),
    );
  }
}

class _TodayCard extends StatelessWidget {
  final VoidCallback onTap;
  const _TodayCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _brand,
        borderRadius: BorderRadius.circular(26),
        boxShadow: const [BoxShadow(blurRadius: 26, offset: Offset(0, 12))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const _LiveDot(),
              const SizedBox(width: 8),
              const Text('حالة اليوم', style: TextStyle(color: Colors.white70, fontSize: 14)),
              const Spacer(),
              Text(
                intl.DateFormat('d MMMM', 'ar').format(DateTime.now()),
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Text('جاهز لتسجيل حضورك', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('تحقق من الموقع ورمز QR قبل اعتماد العملية.', style: TextStyle(color: Colors.white70, height: 1.45)),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: onTap,
            style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: _brand, minimumSize: const Size.fromHeight(54)),
            icon: const Icon(Icons.fingerprint_rounded),
            label: const Text('ابدأ تسجيل الحضور', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(14)),
                child: Icon(icon, color: _brand),
              ),
              const SizedBox(height: 13),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: _ink)),
              const SizedBox(height: 4),
              const Icon(Icons.arrow_back_rounded, size: 17, color: _muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecentTile extends StatelessWidget {
  final dynamic item;
  const _RecentTile(this.item);

  @override
  Widget build(BuildContext context) {
    final record = Map<String, dynamic>.from(item as Map);
    final checkout = record['type'] == 'check-out';
    final timestamp = DateTime.tryParse('${record['timestamp']}');
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(13)),
          child: Icon(checkout ? Icons.logout_rounded : Icons.login_rounded, color: _brand),
        ),
        title: Text(checkout ? 'تسجيل الانصراف' : 'تسجيل الحضور', style: const TextStyle(fontWeight: FontWeight.w700, color: _ink)),
        subtitle: Text(
          timestamp == null ? 'وقت غير معروف' : intl.DateFormat('yyyy/MM/dd · HH:mm').format(timestamp.toLocal()),
          style: const TextStyle(color: _muted),
        ),
        trailing: Text('${record['distanceMeters'] ?? 0} م', style: const TextStyle(color: _muted, fontSize: 12)),
      ),
    );
  }
}

class _EmptyRecent extends StatelessWidget {
  const _EmptyRecent();
  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(22),
        child: Row(
          children: [
            Icon(Icons.event_available_outlined, color: _muted),
            SizedBox(width: 12),
            Text('لا توجد حركات مسجلة اليوم', style: TextStyle(color: _muted)),
          ],
        ),
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();
  @override
  Widget build(BuildContext context) => Card(child: const SizedBox(height: 76));
}

class _LiveDot extends StatelessWidget {
  const _LiveDot();
  @override
  Widget build(BuildContext context) => Container(width: 10, height: 10, decoration: const BoxDecoration(color: Color(0xFF8BE0C5), shape: BoxShape.circle));
}

class AttendancePage extends StatefulWidget {
  final String type;
  const AttendancePage({super.key, required this.type});
  @override State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage> {
  final qr = TextEditingController();
  final scanner = MobileScannerController();
  AttendanceService? service;
  bool scanning = false;
  bool busy = false;
  bool ready = false;
  int step = 0;
  String? error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final token = await _session.token();
    if (!mounted) return;
    if (token == null || token.isEmpty) {
      setState(() => error = 'انتهت الجلسة. سجّل الدخول مرة أخرى.');
      return;
    }
    setState(() {
      service = AttendanceService(HadirApi(token: token), _session);
      ready = true;
      step = 0;
    });
  }

  @override
  void dispose() {
    qr.dispose();
    scanner.dispose();
    super.dispose();
  }

  void _detect(BarcodeCapture capture) {
    if (qr.text.trim().isNotEmpty) return;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value != null && value.trim().isNotEmpty) {
        qr.text = value.trim();
        setState(() {
          scanning = false;
          step = 2;
        });
        scanner.stop();
        return;
      }
    }
  }

  Future<void> _submit() async {
    final code = qr.text.trim();
    final current = service;
    if (current == null || !ready) {
      setState(() => error = 'الجلسة غير جاهزة.');
      return;
    }
    if (code.isEmpty) {
      setState(() => error = 'امسح رمز QR أو أدخله يدويًا.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
      step = 0;
    });
    try {
      final result = await current.record(type: widget.type, qrCode: code);
      if (!mounted) return;
      setState(() {
        busy = false;
        step = 3;
      });
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('تم التسجيل بنجاح'),
          content: Text('تم اعتماد العملية على بُعد ${result.distance.toStringAsFixed(1)} متر.'),
          actions: [
            FilledButton(onPressed: () => Navigator.pop(context), child: const Text('حسنًا')),
          ],
        ),
      );
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) {
        setState(() {
          busy = false;
          error = HadirApi.errorMessage(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isIn = widget.type == 'check-in';
    return Scaffold(
      appBar: AppBar(
        title: Text(isIn ? 'تسجيل الحضور' : 'تسجيل الانصراف'),
        actions: [IconButton(onPressed: () => context.go('/home'), icon: const Icon(Icons.close_rounded))],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 30),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(22)),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(15)),
                  child: Icon(isIn ? Icons.login_rounded : Icons.logout_rounded, color: _brand),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(isIn ? 'تسجيل حضور آمن' : 'تسجيل انصراف آمن', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: _ink)),
                      const SizedBox(height: 3),
                      const Text('الموقع + QR + الجهاز', style: TextStyle(color: _muted, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _StepIndicator(current: step),
          const SizedBox(height: 18),
          Card(
            clipBehavior: Clip.antiAlias,
            child: SizedBox(
              height: 300,
              child: scanning
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        MobileScanner(controller: scanner, onDetect: _detect),
                        Center(
                          child: Container(
                            width: 250,
                            height: 170,
                            decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 3), borderRadius: BorderRadius.circular(22)),
                          ),
                        ),
                        const Positioned(
                          bottom: 18,
                          left: 0,
                          right: 0,
                          child: Text('وجّه الكاميرا نحو رمز QR', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    )
                  : Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 82,
                            height: 82,
                            decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(25)),
                            child: const Icon(Icons.qr_code_scanner_rounded, size: 46, color: _brand),
                          ),
                          const SizedBox(height: 15),
                          const Text('امسح رمز موقع العمل', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: _ink)),
                          const SizedBox(height: 12),
                          FilledButton.icon(
                            onPressed: busy ? null : () {
                              setState(() {
                                scanning = true;
                                step = 2;
                              });
                              scanner.start();
                            },
                            icon: const Icon(Icons.camera_alt_rounded),
                            label: const Text('فتح الكاميرا'),
                          ),
                        ],
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: qr,
            onChanged: (_) {
              if (qr.text.trim().isNotEmpty && step < 2) setState(() => step = 2);
            },
            decoration: const InputDecoration(labelText: 'أو أدخل الرمز يدويًا', prefixIcon: Icon(Icons.key_outlined)),
          ),
          if (error != null) ...[
            const SizedBox(height: 14),
            _ErrorBox(message: error!),
          ],
          const SizedBox(height: 18),
          FilledButton(
            onPressed: busy || !ready ? null : _submit,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: busy
                  ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(isIn ? 'تأكيد تسجيل الحضور' : 'تأكيد تسجيل الانصراف'),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int current;
  const _StepIndicator({required this.current});

  @override
  Widget build(BuildContext context) {
    const labels = ['الموقع', 'الجهاز', 'QR', 'تحقق'];
    const icons = [Icons.location_on_outlined, Icons.phone_android_rounded, Icons.qr_code_rounded, Icons.verified_rounded];
    return Row(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          Expanded(
            child: Column(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: current >= i ? _brand : Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: current >= i ? _brand : const Color(0xFFD8E2DE)),
                  ),
                  child: Icon(icons[i], size: 18, color: current >= i ? Colors.white : _muted),
                ),
                const SizedBox(height: 6),
                Text(labels[i], style: TextStyle(fontSize: 11, color: current >= i ? _brand : _muted, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          if (i < labels.length - 1) Expanded(child: Container(height: 2, color: current > i ? _brand : const Color(0xFFD8E2DE))),
        ],
      ],
    );
  }
}

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});
  @override State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  List<dynamic> rows = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      rows = await HadirApi(token: await _session.token()).attendance();
    } catch (e) {
      error = HadirApi.errorMessage(e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (error != null) {
      body = Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: _load, child: const Text('إعادة المحاولة')),
            ],
          ),
        ),
      );
    } else if (rows.isEmpty) {
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView(children: const [SizedBox(height: 220), Center(child: Text('لا توجد سجلات حضور'))]),
      );
    } else {
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
          itemCount: rows.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, index) => _RecentTile(rows[index]),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('سجل الحضور')),
      body: body,
      bottomNavigationBar: const _BottomBar(index: 1),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  final String message;
  const _ErrorBox({required this.message});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(13),
    decoration: BoxDecoration(color: const Color(0xFFFFF1F0), borderRadius: BorderRadius.circular(14)),
    child: Row(
      children: [
        const Icon(Icons.error_outline, color: Colors.redAccent),
        const SizedBox(width: 9),
        Expanded(child: Text(message, style: const TextStyle(color: _danger))),
      ],
    ),
  );
}

class _BottomBar extends StatelessWidget {
  final int index;
  const _BottomBar({required this.index});
  @override
  Widget build(BuildContext context) => NavigationBar(
    selectedIndex: index,
    onDestinationSelected: (value) => context.go(value == 0 ? '/home' : value == 1 ? '/history' : '/requests'),
    destinations: const [
      NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'الرئيسية'),
      NavigationDestination(icon: Icon(Icons.history_outlined), selectedIcon: Icon(Icons.history_rounded), label: 'السجل'),
      NavigationDestination(icon: Icon(Icons.assignment_outlined), selectedIcon: Icon(Icons.assignment_rounded), label: 'الطلبات'),
    ],
  );
}
