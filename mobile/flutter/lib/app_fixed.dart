import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/api.dart';
import 'core/session.dart';

final _session = HadirSession();

GoRouter buildRouter() => GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const HomePage(),
        ),
      ],
    );

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
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
      final me = results[0] is Map
          ? Map<String, dynamic>.from(results[0] as Map)
          : <String, dynamic>{};
      final profile = me['user'];
      final attendance = results[1];
      if (!mounted) return;
      setState(() {
        if (profile is Map) name = profile['name']?.toString() ?? 'الموظف';
        recent = attendance is List
            ? List<dynamic>.from(attendance)
            : <dynamic>[];
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('حاضر')),
      body: Center(
        child: loading
            ? const CircularProgressIndicator()
            : Text('مرحباً $name'),
      ),
    );
  }
}
