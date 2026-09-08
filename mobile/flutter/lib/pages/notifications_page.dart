import 'package:flutter/material.dart';

import '../core/hadir_brand.dart';
import '../services/notifications_service.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  final service = NotificationsService();
  List<HadirNotification> rows = [];
  bool loading = true;
  String? error;
  String _filter = 'all';
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() { loading = true; error = null; });
    try {
      final result = await service.list();
      if (mounted) setState(() => rows = result);
    } catch (e) {
      if (mounted) setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _read(HadirNotification n) async {
    if (n.read) return;
    try {
      await service.markRead(n.id);
      await _load();
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _allRead() async {
    try {
      await service.markAllRead();
      await _load();
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  List<HadirNotification> get _visible {
    final q = _query.trim().toLowerCase();
    return rows.where((n) {
      if (_filter == 'unread' && n.read) return false;
      if (_filter == 'read' && !n.read) return false;
      if (q.isEmpty) return true;
      return '${n.title} ${n.body}'.toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final unread = rows.where((e) => !e.read).length;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('الإشعارات', style: TextStyle(fontWeight: FontWeight.w900)),
          actions: [
            if (unread > 0)
              IconButton(onPressed: _allRead, icon: const Icon(Icons.done_all_rounded), tooltip: 'تحديد الكل كمقروء'),
          ],
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : error != null
                ? _Error(message: error!, retry: _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
                      children: [
                        _UnreadBanner(unread: unread),
                        const SizedBox(height: 12),
                        TextField(
                          onChanged: (value) => setState(() => _query = value),
                          decoration: const InputDecoration(hintText: 'بحث في الإشعارات…', prefixIcon: Icon(Icons.search_rounded)),
                        ),
                        const SizedBox(height: 10),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(children: [
                            _chip('all', 'الكل'),
                            _chip('unread', 'غير المقروءة'),
                            _chip('read', 'المقروءة'),
                          ]),
                        ),
                        const SizedBox(height: 14),
                        if (_visible.isEmpty)
                          const _EmptyNotifications()
                        else
                          ..._visible.map(_card),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _chip(String value, String text) => Padding(
        padding: const EdgeInsets.only(left: 7),
        child: ChoiceChip(selected: _filter == value, label: Text(text), onSelected: (_) => setState(() => _filter = value)),
      );

  Widget _card(HadirNotification n) {
    final accent = n.read ? HadirBrand.muted : Theme.of(context).colorScheme.primary;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: () => _read(n),
        borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 46, height: 46, decoration: BoxDecoration(color: accent.withValues(alpha: .10), borderRadius: BorderRadius.circular(HadirBrand.radiusMd)), child: Icon(n.read ? Icons.notifications_none_rounded : Icons.notifications_active_rounded, color: accent)),
            const SizedBox(width: 13),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Expanded(child: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w700 : FontWeight.w900, fontSize: 15))), if (!n.read) Container(width: 8, height: 8, decoration: BoxDecoration(color: accent, shape: BoxShape.circle))]),
              const SizedBox(height: 6),
              Text(n.body, style: const TextStyle(height: 1.45)),
              const SizedBox(height: 8),
              Text(_date(n.createdAt), style: Theme.of(context).textTheme.bodySmall),
            ])),
          ]),
        ),
      ),
    );
  }

  String _date(DateTime d) {
    final local = d.toLocal();
    return '${local.year}/${local.month.toString().padLeft(2, '0')}/${local.day.toString().padLeft(2, '0')} • ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  void _snack(String text) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text))); }
}

class _UnreadBanner extends StatelessWidget {
  final int unread;
  const _UnreadBanner({required this.unread});
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(15), child: Row(children: [Container(width: 42, height: 42, decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(HadirBrand.radiusMd)), child: Icon(Icons.mark_email_unread_rounded, color: Theme.of(context).colorScheme.primary)), const SizedBox(width: 12), Expanded(child: Text(unread == 0 ? 'لا توجد إشعارات جديدة' : '$unread إشعار غير مقروء', style: const TextStyle(fontWeight: FontWeight.w900)))])));
}

class _EmptyNotifications extends StatelessWidget {
  const _EmptyNotifications();
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(top: 70), child: Column(children: [Icon(Icons.notifications_none_rounded, size: 54, color: Theme.of(context).colorScheme.primary), const SizedBox(height: 14), const Text('لا توجد إشعارات مطابقة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)), const SizedBox(height: 5), const Text('جرّب تغيير البحث أو الفلتر.') ]));
}

class _Error extends StatelessWidget {
  final String message;
  final VoidCallback retry;
  const _Error({required this.message, required this.retry});
  @override
  Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48), const SizedBox(height: 12), Text(message, textAlign: TextAlign.center), const SizedBox(height: 14), FilledButton(onPressed: retry, child: const Text('إعادة المحاولة'))])));
}
