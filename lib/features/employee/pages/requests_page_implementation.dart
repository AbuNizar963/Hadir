import 'package:flutter/material.dart';

import '../../../core/api.dart';
import '../../../core/hadir_brand.dart';
import '../../../core/session.dart';
import '../../../services/requests_service.dart';

class RequestsPage extends StatefulWidget {
  const RequestsPage({super.key});

  @override
  State<RequestsPage> createState() => _RequestsPageState();
}

class _RequestsPageState extends State<RequestsPage> {
  RequestsService? service;
  Future<List<Map<String, dynamic>>>? future;
  String _filter = 'all';
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = await HadirSession().token();
    final current = RequestsService(HadirApi(token: token));
    if (!mounted) return;
    setState(() {
      service = current;
      future = current.list();
    });
  }

  String label(String type) => const {
        'leave': 'إجازة',
        'permission': 'استئذان',
        'checkout': 'انصراف',
      }[type] ?? type;

  String status(String value) => const {
        'pending': 'قيد المراجعة',
        'approved': 'مقبول',
        'rejected': 'مرفوض',
        'confirmed': 'مؤكد',
        'cancelled': 'ملغى',
      }[value] ?? value;

  Color statusColor(BuildContext context, String value) {
    final scheme = Theme.of(context).colorScheme;
    if (value == 'approved' || value == 'confirmed') return scheme.primary;
    if (value == 'rejected' || value == 'cancelled') return HadirBrand.danger;
    return HadirBrand.warning;
  }

  IconData statusIcon(String value) {
    if (value == 'approved' || value == 'confirmed') return Icons.check_circle_rounded;
    if (value == 'rejected' || value == 'cancelled') return Icons.cancel_rounded;
    return Icons.schedule_rounded;
  }

  List<Map<String, dynamic>> _visible(List<Map<String, dynamic>> rows) {
    final q = _query.trim().toLowerCase();
    return rows.where((row) {
      final state = '${row['status'] ?? 'pending'}';
      if (_filter != 'all' && state != _filter) return false;
      if (q.isEmpty) return true;
      final haystack = [
        row['type'], row['reason'], row['status'], row['employeeName'],
        row['employeeId'], row['startDate'], row['endDate'],
      ].map((e) => '$e').join(' ').toLowerCase();
      return haystack.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('الطلبات', style: TextStyle(fontWeight: FontWeight.w900)),
          actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded))],
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: service == null ? null : _newRequest,
          icon: const Icon(Icons.add_rounded),
          label: const Text('طلب جديد', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
        body: future == null
            ? const Center(child: CircularProgressIndicator())
            : FutureBuilder<List<Map<String, dynamic>>>(
                future: future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const _RequestSkeleton();
                  }
                  if (snapshot.hasError) {
                    return _ErrorState(
                      message: HadirApi.errorMessage(snapshot.error!),
                      onRetry: _load,
                    );
                  }
                  final all = snapshot.data ?? <Map<String, dynamic>>[];
                  final rows = _visible(all);
                  final pending = all.where((e) => e['status'] == 'pending').length;
                  return RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                      children: [
                        _SummaryStrip(total: all.length, pending: pending),
                        const SizedBox(height: 14),
                        TextField(
                          onChanged: (value) => setState(() => _query = value),
                          decoration: const InputDecoration(
                            hintText: 'بحث في الطلبات…',
                            prefixIcon: Icon(Icons.search_rounded),
                          ),
                        ),
                        const SizedBox(height: 10),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              _filterChip('all', 'الكل'),
                              _filterChip('pending', 'قيد المراجعة'),
                              _filterChip('approved', 'مقبول'),
                              _filterChip('rejected', 'مرفوض'),
                              _filterChip('cancelled', 'ملغى'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                        if (rows.isEmpty)
                          const _EmptyRequests()
                        else
                          ...rows.map(_requestCard),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }

  Widget _filterChip(String value, String text) {
    return Padding(
      padding: const EdgeInsets.only(left: 7),
      child: ChoiceChip(
        selected: _filter == value,
        label: Text(text),
        onSelected: (_) => setState(() => _filter = value),
      ),
    );
  }

  Widget _requestCard(Map<String, dynamic> row) {
    final state = '${row['status'] ?? 'pending'}';
    final start = '${row['startDate'] ?? ''}';
    final end = '${row['endDate'] ?? ''}';
    final date = start.isEmpty
        ? 'بدون تاريخ'
        : '$start${end.isNotEmpty && end != start ? '  →  $end' : ''}';
    final color = statusColor(context, state);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: const EdgeInsets.all(14),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
          ),
          child: Icon(statusIcon(state), color: color),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                label('${row['type'] ?? ''}'),
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            _StatusPill(text: status(state), color: color),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 7),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if ('${row['reason'] ?? ''}'.isNotEmpty)
                Text('${row['reason']}', maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 7),
              Text(date, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _newRequest() async {
    final current = service;
    if (current == null) return;
    final type = ValueNotifier<String>('leave');
    final reason = TextEditingController();
    DateTime start = DateTime.now();
    DateTime end = DateTime.now();
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialog) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(dialogContext).bottom),
          child: Material(
            color: Theme.of(dialogContext).colorScheme.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(child: Container(width: 42, height: 4, decoration: BoxDecoration(color: HadirBrand.border, borderRadius: BorderRadius.circular(4)))),
                  const SizedBox(height: 18),
                  const Text('إنشاء طلب', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 6),
                  const Text('أدخل التفاصيل ثم أرسل الطلب للمراجعة.'),
                  const SizedBox(height: 18),
                  ValueListenableBuilder<String>(
                    valueListenable: type,
                    builder: (_, value, __) => DropdownButtonFormField<String>(
                      initialValue: value,
                      items: const [
                        DropdownMenuItem(value: 'leave', child: Text('إجازة')),
                        DropdownMenuItem(value: 'permission', child: Text('استئذان')),
                        DropdownMenuItem(value: 'checkout', child: Text('انصراف')),
                      ],
                      onChanged: (v) { if (v != null) type.value = v; },
                      decoration: const InputDecoration(labelText: 'نوع الطلب', prefixIcon: Icon(Icons.category_outlined)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: _dateButton(dialogContext, 'من', start, () async {
                      final d = await showDatePicker(context: dialogContext, initialDate: start, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365)));
                      if (d != null) setDialog(() => start = d);
                    })),
                    const SizedBox(width: 10),
                    Expanded(child: _dateButton(dialogContext, 'إلى', end, () async {
                      final d = await showDatePicker(context: dialogContext, initialDate: end.isBefore(start) ? start : end, firstDate: start, lastDate: DateTime.now().add(const Duration(days: 365)));
                      if (d != null) setDialog(() => end = d);
                    })),
                  ]),
                  const SizedBox(height: 12),
                  TextField(controller: reason, maxLines: 4, decoration: const InputDecoration(labelText: 'السبب', prefixIcon: Icon(Icons.notes_rounded))),
                  const SizedBox(height: 18),
                  FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('إرسال الطلب', style: TextStyle(fontWeight: FontWeight.w900))),
                  TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('إلغاء')),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    if (submitted == true) {
      if (reason.text.trim().isEmpty) {
        _snack('اكتب سبب الطلب.');
      } else if (end.isBefore(start)) {
        _snack('تاريخ النهاية غير صحيح.');
      } else {
        String fmt(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
        try {
          await current.create(type: type.value, reason: reason.text.trim(), startDate: fmt(start), endDate: fmt(end));
          if (mounted) { _snack('تم إرسال الطلب بنجاح.'); await _load(); }
        } catch (e) {
          _snack(HadirApi.errorMessage(e));
        }
      }
    }
    reason.dispose();
    type.dispose();
  }

  Widget _dateButton(BuildContext c, String title, DateTime date, VoidCallback onTap) => OutlinedButton.icon(onPressed: onTap, icon: const Icon(Icons.calendar_month_rounded, size: 18), label: Text('$title: ${date.year}/${date.month}/${date.day}'));
  void _snack(String text) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text))); }
}

class _SummaryStrip extends StatelessWidget {
  final int total;
  final int pending;
  const _SummaryStrip({required this.total, required this.pending});
  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(child: _Metric(value: '$total', label: 'كل الطلبات', icon: Icons.list_alt_rounded)),
        const SizedBox(width: 10),
        Expanded(child: _Metric(value: '$pending', label: 'قيد المراجعة', icon: Icons.pending_actions_rounded)),
      ]);
}

class _Metric extends StatelessWidget {
  final String value;
  final String label;
  final IconData icon;
  const _Metric({required this.value, required this.label, required this.icon});
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [Icon(icon, color: Theme.of(context).colorScheme.primary), const SizedBox(width: 10), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(value, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900)), Text(label, style: Theme.of(context).textTheme.bodySmall)])])));
}

class _StatusPill extends StatelessWidget {
  final String text;
  final Color color;
  const _StatusPill({required this.text, required this.color});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(20)), child: Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w900)));
}

class _EmptyRequests extends StatelessWidget {
  const _EmptyRequests();
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(top: 70), child: Column(children: [Icon(Icons.inbox_rounded, size: 54, color: Theme.of(context).colorScheme.primary), const SizedBox(height: 14), const Text('لا توجد طلبات مطابقة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)), const SizedBox(height: 5), const Text('جرّب تغيير البحث أو الفلتر.') ]));
}

class _RequestSkeleton extends StatelessWidget {
  const _RequestSkeleton();
  @override
  Widget build(BuildContext context) => ListView.builder(padding: const EdgeInsets.all(18), itemCount: 5, itemBuilder: (_, __) => const Card(child: SizedBox(height: 105)));
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48), const SizedBox(height: 12), Text(message, textAlign: TextAlign.center), const SizedBox(height: 14), FilledButton(onPressed: onRetry, child: const Text('إعادة المحاولة'))])));
}
