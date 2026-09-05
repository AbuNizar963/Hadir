import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/session.dart';
import '../services/requests_service.dart';

class RequestsPage extends StatefulWidget {
  const RequestsPage({super.key});
  @override State<RequestsPage> createState() => _RequestsPageState();
}

class _RequestsPageState extends State<RequestsPage> {
  RequestsService? service;
  Future<List<Map<String, dynamic>>>? future;

  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    final token = await HadirSession().token();
    final s = RequestsService(HadirApi(token: token));
    if (mounted) setState(() { service = s; future = s.list(); });
  }

  String label(String type) => {'leave': 'إجازة', 'permission': 'استئذان', 'checkout': 'انصراف'}[type] ?? type;
  String status(String value) => {'pending': 'قيد المراجعة', 'approved': 'مقبول', 'rejected': 'مرفوض', 'confirmed': 'مؤكد', 'cancelled': 'ملغى'}[value] ?? value;
  Color statusColor(String value) => value == 'approved' || value == 'confirmed' ? Colors.green : value == 'rejected' || value == 'cancelled' ? Colors.red : Colors.orange;

  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('الطلبات')),
    floatingActionButton: FloatingActionButton.extended(onPressed: service == null ? null : _newRequest, label: const Text('طلب جديد'), icon: const Icon(Icons.add)),
    body: future == null ? const Center(child: CircularProgressIndicator()) : FutureBuilder<List<Map<String, dynamic>>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return Center(child: Text(HadirApi.errorMessage(snapshot.error!)));
        final rows = snapshot.data ?? [];
        if (rows.isEmpty) return const Center(child: Text('لا توجد طلبات'));
        return RefreshIndicator(onRefresh: _load, child: ListView.builder(
          padding: const EdgeInsets.all(12), itemCount: rows.length,
          itemBuilder: (context, i) {
            final r = rows[i];
            final st = '${r['status'] ?? 'pending'}';
            final start = '${r['startDate'] ?? ''}';
            final end = '${r['endDate'] ?? ''}';
            final dates = start.isEmpty ? '' : '\n$start${end.isNotEmpty && end != start ? ' → $end' : ''}';
            return Card(child: ListTile(
              leading: CircleAvatar(child: Icon(st == 'approved' || st == 'confirmed' ? Icons.check : st == 'rejected' ? Icons.close : Icons.hourglass_empty)),
              title: Text(label('${r['type'] ?? ''}')),
              subtitle: Text('${r['reason'] ?? ''}$dates'),
              isThreeLine: true,
              trailing: Text(status(st), style: TextStyle(color: statusColor(st), fontWeight: FontWeight.bold)),
            ));
          },
        ));
      },
    ),
  );

  Future<void> _newRequest() async {
    final s = service;
    if (s == null) return;
    final type = ValueNotifier('leave');
    final reason = TextEditingController();
    DateTime start = DateTime.now();
    DateTime end = DateTime.now();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(builder: (dialogContext, setDialog) => AlertDialog(
        title: const Text('طلب جديد'),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          ValueListenableBuilder<String>(valueListenable: type, builder: (_, value, __) => DropdownButtonFormField<String>(
            initialValue: value,
            items: const [
              DropdownMenuItem(value: 'leave', child: Text('إجازة')),
              DropdownMenuItem(value: 'permission', child: Text('استئذان')),
              DropdownMenuItem(value: 'checkout', child: Text('انصراف')),
            ],
            onChanged: (v) { if (v != null) type.value = v; },
            decoration: const InputDecoration(labelText: 'نوع الطلب'),
          )),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton.icon(onPressed: () async {
              final d = await showDatePicker(context: dialogContext, initialDate: start, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365)));
              if (d != null) setDialog(() => start = d);
            }, icon: const Icon(Icons.calendar_today), label: const Text('من'))),
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton.icon(onPressed: () async {
              final d = await showDatePicker(context: dialogContext, initialDate: end, firstDate: start, lastDate: DateTime.now().add(const Duration(days: 365)));
              if (d != null) setDialog(() => end = d);
            }, icon: const Icon(Icons.event), label: const Text('إلى'))),
          ]),
          const SizedBox(height: 6),
          Text('${start.year}/${start.month.toString().padLeft(2, '0')}/${start.day.toString().padLeft(2, '0')} → ${end.year}/${end.month.toString().padLeft(2, '0')}/${end.day.toString().padLeft(2, '0')}'),
          TextField(controller: reason, maxLines: 4, decoration: const InputDecoration(labelText: 'السبب')),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('إرسال')),
        ],
      )),
    );
    if (ok == true) {
      if (reason.text.trim().isEmpty) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('اكتب سبب الطلب.')));
      } else if (end.isBefore(start)) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تاريخ النهاية غير صحيح.')));
      } else {
        String fmt(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
        try {
          await s.create(type: type.value, reason: reason.text.trim(), startDate: fmt(start), endDate: fmt(end));
          if (mounted) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إرسال الطلب'))); _load(); }
        } catch (e) {
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(HadirApi.errorMessage(e))));
        }
      }
    }
    reason.dispose();
    type.dispose();
  }
}
