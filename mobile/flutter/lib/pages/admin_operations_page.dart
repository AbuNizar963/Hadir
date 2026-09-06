import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/session.dart';

class AdminOperationsPage extends StatefulWidget {
  const AdminOperationsPage({super.key});

  @override
  State<AdminOperationsPage> createState() => _AdminOperationsPageState();
}

class _AdminOperationsPageState extends State<AdminOperationsPage> {
  static const _baseUrl = 'https://hadir-api.abunizar963.workers.dev';
  final _session = HadirSession();
  late final Dio _dio;
  int _tab = 0;
  bool _loading = true;
  String? _error;
  List<dynamic> _workforce = [];
  List<dynamic> _notifications = [];
  List<dynamic> _locations = [];

  @override
  void initState() {
    super.initState();
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
    ));
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      _dio.options.headers['Authorization'] = 'Bearer $token';
      final results = await Future.wait<Response<dynamic>>([
        _dio.get('/api/workforce/live'),
        _dio.get('/api/notifications'),
        _dio.get('/api/locations'),
      ]);
      if (!mounted) return;
      final workforceData = results[0].data;
      final workforce = workforceData is Map && workforceData['employees'] is List
          ? List<dynamic>.from(workforceData['employees'] as List)
          : workforceData is List ? List<dynamic>.from(workforceData) : <dynamic>[];
      final notifications = results[1].data is List ? List<dynamic>.from(results[1].data as List) : <dynamic>[];
      final locations = results[2].data is List ? List<dynamic>.from(results[2].data as List) : <dynamic>[];
      setState(() {
        _workforce = workforce;
        _notifications = notifications;
        _locations = locations;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = e is DioException ? 'تعذر تحميل بيانات الإدارة (${e.response?.statusCode ?? 'شبكة'}).' : e.toString().replaceFirst('Exception: ', ''); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('عمليات الإدارة', style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48), const SizedBox(height: 12), Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton(onPressed: _load, child: const Text('إعادة المحاولة'))])))
              : IndexedStack(index: _tab, children: [_workforceView(), _notificationsView(), _locationsView()]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (value) => setState(() => _tab = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.groups_rounded), label: 'القوى العاملة'),
          NavigationDestination(icon: Icon(Icons.notifications_none_rounded), label: 'الإشعارات'),
          NavigationDestination(icon: Icon(Icons.location_on_outlined), label: 'المواقع'),
        ],
      ),
    );
  }

  Widget _workforceView() {
    final active = _workforce.where((e) => e is Map && '${e['status'] ?? 'active'}' == 'active').toList();
    return RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(18), children: [
      _hero('التحكم بالقوى العاملة', 'المناوبات، VIP، التحضير والانصراف التلقائي من بيانات الخادم.'),
      const SizedBox(height: 14),
      _statRow('الموظفون الفعالون', '${active.length}', Icons.groups_rounded),
      const SizedBox(height: 12),
      ...active.map((raw) {
        final e = Map<String, dynamic>.from(raw as Map);
        return Card(child: ListTile(
          leading: CircleAvatar(child: Text('${e['name'] ?? 'م'}'.characters.first)),
          title: Text('${e['name'] ?? 'موظف'}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${e['jobNumber'] ?? '—'} · ${e['scheduleType'] ?? 'ADMIN'}'),
          trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (e['isVip'] == true) const Text('★ VIP', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900)),
            Text(e['autoCheckIn'] == true ? 'تلقائي ✓' : 'يدوي', style: const TextStyle(fontSize: 10)),
          ]),
        ));
      }),
    ]));
  }

  Widget _notificationsView() {
    final unread = _notifications.where((e) => e is Map && e['readAt'] == null).length;
    return RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(18), children: [
      _hero('إشعارات الإدارة', '$unread إشعار غير مقروء من صندوق الخادم.'),
      const SizedBox(height: 12),
      ..._notifications.map((raw) {
        final n = Map<String, dynamic>.from(raw as Map);
        return Card(child: ListTile(
          leading: Icon(n['readAt'] == null ? Icons.mark_email_unread_rounded : Icons.mark_email_read_outlined),
          title: Text('${n['title'] ?? 'إشعار'}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${n['message'] ?? n['body'] ?? ''}\n${n['createdAt'] ?? ''}'),
          isThreeLine: true,
        ));
      }),
      if (_notifications.isEmpty) const _Empty(text: 'لا توجد إشعارات حالياً.'),
    ]));
  }

  Widget _locationsView() {
    return RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(18), children: [
      _hero('مواقع العمل', '${_locations.length} موقعًا متاحًا للحساب الإداري.'),
      const SizedBox(height: 12),
      ..._locations.map((raw) {
        final l = Map<String, dynamic>.from(raw as Map);
        return Card(child: ListTile(
          leading: const Icon(Icons.location_on_rounded),
          title: Text('${l['name'] ?? l['title'] ?? 'موقع عمل'}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('lat: ${l['lat'] ?? l['latitude'] ?? '—'} · lng: ${l['lng'] ?? l['longitude'] ?? '—'}\nالنطاق: ${l['radiusMeters'] ?? l['radius'] ?? '—'} م'),
          isThreeLine: true,
        ));
      }),
      if (_locations.isEmpty) const _Empty(text: 'لا توجد مواقع مسجلة.'),
    ]));
  }

  Widget _hero(String title, String subtitle) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [Color(0xFF0B6B5A), Color(0xFF084F44)]), borderRadius: BorderRadius.circular(24)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900)), const SizedBox(height: 6), Text(subtitle, style: const TextStyle(color: Colors.white70, height: 1.45, fontSize: 12))]),
  );

  Widget _statRow(String title, String value, IconData icon) => Card(child: ListTile(leading: const Icon(Icons.analytics_outlined), title: Text(title), trailing: Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900))));
}

class _Empty extends StatelessWidget {
  final String text;
  const _Empty({required this.text});
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(24), child: Center(child: Text(text, style: const TextStyle(color: Colors.black54)))));
}