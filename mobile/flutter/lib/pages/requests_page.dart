import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../services/requests_service.dart';

const _brand = Color(0xFF0B6B5A);
const _canvas = Color(0xFFF5F8F7);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF72827D);
const _line = Color(0xFFDCE6E2);

class RequestsPage extends StatefulWidget {
  const RequestsPage({super.key});
  @override
  State<RequestsPage> createState() => _RequestsPageState();
}

class _RequestsPageState extends State<RequestsPage> {
  RequestsService? service;
  Future<List<Map<String, dynamic>>>? future;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final token = await HadirSession().token();
    final current = RequestsService(HadirApi(token: token));
    if (!mounted) return;
    setState(() { service = current; future = current.list(); });
  }

  String label(String type) => const {'leave': 'إجازة', 'permission': 'استئذان', 'checkout': 'انصراف'}[type] ?? type;
  String status(String value) => const {'pending': 'قيد المراجعة', 'approved': 'مقبول', 'rejected': 'مرفوض', 'confirmed': 'مؤكد', 'cancelled': 'ملغى'}[value] ?? value;

  Color statusColor(String value) {
    if (value == 'approved' || value == 'confirmed') return const Color(0xFF237A54);
    if (value == 'rejected' || value == 'cancelled') return const Color(0xFFB33A32);
    return const Color(0xFF9A6A18);
  }

  IconData statusIcon(String value) {
    if (value == 'approved' || value == 'confirmed') return Icons.check_circle_rounded;
    if (value == 'rejected' || value == 'cancelled') return Icons.cancel_rounded;
    return Icons.schedule_rounded;
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _canvas,
        appBar: AppBar(
          backgroundColor: _canvas,
          elevation: 0,
          title: const Text('الطلبات', style: TextStyle(fontWeight: FontWeight.w900, color: _ink)),
          actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded, color: _ink))],
        ),
        floatingActionButton: FloatingActionButton.extended(
          backgroundColor: _brand,
          foregroundColor: Colors.white,
          onPressed: service == null ? null : _newRequest,
          icon: const Icon(Icons.add_rounded),
          label: const Text('طلب جديد', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
        body: future == null
            ? const Center(child: CircularProgressIndicator(color: _brand))
            : FutureBuilder<List<Map<String, dynamic>>>(
                future: future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) return const _RequestSkeleton();
                  if (snapshot.hasError) return _ErrorState(message: HadirApi.errorMessage(snapshot.error!), onRetry: _load);
                  final rows = snapshot.data ?? [];
                  return RefreshIndicator(
                    color: _brand,
                    onRefresh: _load,
                    child: rows.isEmpty
                        ? ListView(children: const [SizedBox(height: 120), _EmptyRequests()])
                        : ListView.separated(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(18, 8, 18, 100),
                            itemCount: rows.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (_, index) => _requestCard(rows[index]),
                          ),
                  );
                },
              ),
      ),
    );
  }

  Widget _requestCard(Map<String, dynamic> row) {
    final state = '${row['status'] ?? 'pending'}';
    final start = '${row['startDate'] ?? ''}';
    final end = '${row['endDate'] ?? ''}';
    final date = start.isEmpty ? 'بدون تاريخ' : '$start${end.isNotEmpty && end != start ? '  →  $end' : ''}';
    final color = statusColor(state);
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line), boxShadow: const [BoxShadow(blurRadius: 18, offset: Offset(0, 7), color: Color(0x0A142D27))]),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(width: 48, height: 48, decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(16)), child: Icon(statusIcon(state), color: color)),
          const SizedBox(width: 13),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text(label('${row['type'] ?? ''}'), style: const TextStyle(fontWeight: FontWeight.w900, color: _ink, fontSize: 16))), _StatusPill(text: status(state), color: color)]),
            if ('${row['reason'] ?? ''}'.isNotEmpty) ...[const SizedBox(height: 7), Text('${row['reason']}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, height: 1.35))],
            const SizedBox(height: 8),
            Row(children: [const Icon(Icons.calendar_today_rounded, size: 14, color: _muted), const SizedBox(width: 6), Text(date, style: const TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w700))]),
          ])),
        ],
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
      builder: (dialogContext) => StatefulBuilder(builder: (dialogContext, setDialog) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(dialogContext).bottom),
        child: Container(
          decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(child: Container(width: 42, height: 4, decoration: BoxDecoration(color: _line, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 18),
            const Text('إنشاء طلب', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: _ink)),
            const SizedBox(height: 5), const Text('أدخل تفاصيل الطلب ثم أرسله للمراجعة.', style: TextStyle(color: _muted)),
            const SizedBox(height: 18),
            ValueListenableBuilder<String>(valueListenable: type, builder: (_, value, __) => DropdownButtonFormField<String>(initialValue: value, items: const [DropdownMenuItem(value: 'leave', child: Text('إجازة')), DropdownMenuItem(value: 'permission', child: Text('استئذان')), DropdownMenuItem(value: 'checkout', child: Text('انصراف'))], onChanged: (v) { if (v != null) type.value = v; }, decoration: _input('نوع الطلب', Icons.category_outlined))),
            const SizedBox(height: 12),
            Row(children: [Expanded(child: _dateButton(dialogContext, 'من', start, () async { final d = await showDatePicker(context: dialogContext, initialDate: start, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365))); if (d != null) setDialog(() => start = d); })), const SizedBox(width: 10), Expanded(child: _dateButton(dialogContext, 'إلى', end, () async { final d = await showDatePicker(context: dialogContext, initialDate: end.isBefore(start) ? start : end, firstDate: start, lastDate: DateTime.now().add(const Duration(days: 365))); if (d != null) setDialog(() => end = d); }))]),
            const SizedBox(height: 12),
            TextField(controller: reason, maxLines: 4, decoration: _input('السبب', Icons.notes_rounded)),
            const SizedBox(height: 18),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), style: FilledButton.styleFrom(backgroundColor: _brand, padding: const EdgeInsets.symmetric(vertical: 15)), child: const Text('إرسال الطلب', style: TextStyle(fontWeight: FontWeight.w900))),
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('إلغاء')),
          ]),),
        ),
      )),
    );
    if (submitted == true) {
      if (reason.text.trim().isEmpty) { _snack('اكتب سبب الطلب.'); }
      else if (end.isBefore(start)) { _snack('تاريخ النهاية غير صحيح.'); }
      else { String fmt(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}'; try { await current.create(type: type.value, reason: reason.text.trim(), startDate: fmt(start), endDate: fmt(end)); if (mounted) { _snack('تم إرسال الطلب بنجاح.'); await _load(); } } catch (e) { _snack(HadirApi.errorMessage(e)); } }
    }
    reason.dispose(); type.dispose();
  }

  Widget _dateButton(BuildContext c, String title, DateTime date, VoidCallback onTap) => OutlinedButton.icon(onPressed: onTap, icon: const Icon(Icons.calendar_month_rounded, size: 18), label: Text('$title: ${date.year}/${date.month}/${date.day}'), style: OutlinedButton.styleFrom(foregroundColor: _ink, side: const BorderSide(color: _line), padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))));
  InputDecoration _input(String label, IconData icon) => InputDecoration(labelText: label, prefixIcon: Icon(icon), filled: true, fillColor: _canvas, border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none));
  void _snack(String text) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text))); }
}

class _StatusPill extends StatelessWidget { final String text; final Color color; const _StatusPill({required this.text, required this.color}); @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(20)), child: Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w900))); }
class _EmptyRequests extends StatelessWidget { const _EmptyRequests(); @override Widget build(BuildContext context) => Column(children: [Container(width: 76, height: 76, decoration: BoxDecoration(color: _brand.withValues(alpha: .08), shape: BoxShape.circle), child: const Icon(Icons.inbox_rounded, size: 34, color: _brand)), const SizedBox(height: 16), const Text('لا توجد طلبات', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: _ink)), const SizedBox(height: 5), const Text('يمكنك إنشاء طلب جديد من الزر أدناه.', style: TextStyle(color: _muted))]); }
class _RequestSkeleton extends StatelessWidget { const _RequestSkeleton(); @override Widget build(BuildContext context) => ListView.builder(padding: const EdgeInsets.all(18), itemCount: 5, itemBuilder: (_, __) => Container(height: 105, margin: const EdgeInsets.only(bottom: 10), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22)))); }
class _ErrorState extends StatelessWidget { final String message; final VoidCallback onRetry; const _ErrorState({required this.message, required this.onRetry}); @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_rounded, size: 48, color: _muted), const SizedBox(height: 12), Text(message, textAlign: TextAlign.center, style: const TextStyle(color: _muted)), const SizedBox(height: 14), FilledButton(onPressed: onRetry, child: const Text('إعادة المحاولة'))]))); }
