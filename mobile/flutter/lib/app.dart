import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

GoRouter buildRouter() => GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
    GoRoute(path: '/home', builder: (_, __) => const HomePage()),
    GoRoute(path: '/attendance', builder: (_, __) => const AttendancePage()),
    GoRoute(path: '/history', builder: (_, __) => const HistoryPage()),
  ],
);

class LoginPage extends StatelessWidget {
  const LoginPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.how_to_reg, size: 72),
      const SizedBox(height: 16),
      const Text('حاضر', style: TextStyle(fontSize: 34, fontWeight: FontWeight.bold)),
      const SizedBox(height: 8),
      const Text('تسجيل دخول الموظف', style: TextStyle(fontSize: 18)),
      const SizedBox(height: 28),
      const TextField(decoration: InputDecoration(labelText: 'رقم الموظف أو اسم المستخدم')),
      const SizedBox(height: 14),
      const TextField(obscureText: true, decoration: InputDecoration(labelText: 'كلمة المرور / الرمز')),
      const SizedBox(height: 20),
      SizedBox(width: double.infinity, child: FilledButton(onPressed: () => context.go('/home'), child: const Text('دخول'))),
    ]))),
  );
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('حاضر')),
    body: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('مرحبًا بك', style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
      const SizedBox(height: 20),
      FilledButton.icon(onPressed: () => context.go('/attendance'), icon: const Icon(Icons.qr_code_scanner), label: const Text('تسجيل الحضور والانصراف')),
      const SizedBox(height: 12),
      OutlinedButton.icon(onPressed: () => context.go('/history'), icon: const Icon(Icons.history), label: const Text('سجل الحضور')),
    ])),
    bottomNavigationBar: NavigationBar(selectedIndex: 0, onDestinationSelected: (i) { if (i == 1) context.go('/history'); }, destinations: const [NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'), NavigationDestination(icon: Icon(Icons.history), label: 'السجل')]),
  );
}

class AttendancePage extends StatelessWidget {
  const AttendancePage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('الحضور والانصراف')), body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.qr_code_scanner, size: 100), const SizedBox(height: 20), const Text('سيتم تشغيل الكاميرا والتحقق من الموقع ثم إرسال عملية الحضور للخادم.'), const SizedBox(height: 24), FilledButton(onPressed: () {}, child: const Text('فتح الماسح'))])));
}

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('سجل الحضور')), body: const Center(child: Text('سيتم تحميل سجل الحضور من الخادم.')));
}
