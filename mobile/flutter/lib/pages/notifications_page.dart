import 'package:flutter/material.dart';
import '../services/notifications_service.dart';

const _brand = Color(0xFF0B6B5A);
const _canvas = Color(0xFFF5F8F7);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF72827D);
const _line = Color(0xFFDCE6E2);

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});
  @override State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  final service = NotificationsService();
  List<HadirNotification> rows = [];
  bool loading = true;
  String? error;

  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { setState(() { loading = true; error = null; }); try { final r = await service.list(); if (mounted) setState(() => rows = r); } catch (e) { if (mounted) setState(() => error = e.toString()); } finally { if (mounted) setState(() => loading = false); } }
  Future<void> _read(HadirNotification n) async { if (!n.read) { await service.markRead(n.id); await _load(); } }
  Future<void> _allRead() async { await service.markAllRead(); await _load(); }

  @override Widget build(BuildContext context) {
    final unread = rows.where((e) => !e.read).length;
    return Directionality(textDirection: TextDirection.rtl, child: Scaffold(
      backgroundColor: _canvas,
      appBar: AppBar(backgroundColor: _canvas, elevation: 0, title: const Text('الإشعارات', style: TextStyle(fontWeight: FontWeight.w900, color: _ink)), actions: [if (unread > 0) IconButton(onPressed: _allRead, icon: const Icon(Icons.done_all_rounded, color: _brand), tooltip: 'تحديد الكل كمقروء')]),
      body: loading ? const Center(child: CircularProgressIndicator(color: _brand)) : error != null ? _Error(message: error!, retry: _load) : RefreshIndicator(color: _brand, onRefresh: _load, child: rows.isEmpty ? ListView(children: const [SizedBox(height: 130), _EmptyNotifications()]) : ListView.separated(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.fromLTRB(18, 10, 18, 30), itemCount: rows.length, separatorBuilder: (_, __) => const SizedBox(height: 10), itemBuilder: (_, i) => _card(rows[i]))),
    ));
  }

  Widget _card(HadirNotification n) {
    final accent = n.read ? _muted : _brand;
    return InkWell(onTap: () => _read(n), borderRadius: BorderRadius.circular(21), child: AnimatedContainer(duration: const Duration(milliseconds: 180), padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: n.read ? Colors.white : _brand.withValues(alpha: .055), borderRadius: BorderRadius.circular(21), border: Border.all(color: n.read ? _line : _brand.withValues(alpha: .18))), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(width: 46, height: 46, decoration: BoxDecoration(color: accent.withValues(alpha: .10), borderRadius: BorderRadius.circular(15)), child: Icon(n.read ? Icons.notifications_none_rounded : Icons.notifications_active_rounded, color: accent)), const SizedBox(width: 13), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Expanded(child: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w700 : FontWeight.w900, color: _ink, fontSize: 15))), if (!n.read) Container(width: 8, height: 8, decoration: const BoxDecoration(color: _brand, shape: BoxShape.circle))]), const SizedBox(height: 6), Text(n.body, style: const TextStyle(color: _muted, height: 1.45)), const SizedBox(height: 8), Text(_date(n.createdAt), style: const TextStyle(color: _muted, fontSize: 11, fontWeight: FontWeight.w700))]))]));
  }
  String _date(DateTime d) => '${d.toLocal().year}/${d.toLocal().month.toString().padLeft(2, '0')}/${d.toLocal().day.toString().padLeft(2, '0')} • ${d.toLocal().hour.toString().padLeft(2, '0')}:${d.toLocal().minute.toString().padLeft(2, '0')}';
}

class _EmptyNotifications extends StatelessWidget { const _EmptyNotifications(); @override Widget build(BuildContext context) => Column(children: [Container(width: 76, height: 76, decoration: BoxDecoration(color: _brand.withValues(alpha: .08), shape: BoxShape.circle), child: const Icon(Icons.notifications_none_rounded, size: 38, color: _brand)), const SizedBox(height: 16), const Text('لا توجد إشعارات', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: _ink)), const SizedBox(height: 5), const Text('سنخبرك هنا بآخر المستجدات.', style: TextStyle(color: _muted))]); }
class _Error extends StatelessWidget { final String message; final VoidCallback retry; const _Error({required this.message, required this.retry}); @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48, color: _muted), const SizedBox(height: 12), Text(message, textAlign: TextAlign.center, style: const TextStyle(color: _muted)), const SizedBox(height: 14), FilledButton(onPressed: retry, child: const Text('إعادة المحاولة'))]))); }
