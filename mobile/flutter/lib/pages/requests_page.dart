import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../services/requests_service.dart';

class RequestsPage extends StatefulWidget {
  const RequestsPage({super.key});

  @override
  State<RequestsPage> createState() => _RequestsPageState();
}

class _RequestsPageState extends State<RequestsPage> {
  RequestsService? service;
  Future<List<Map<String, dynamic>>>? future;

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

  String label(String type) {
    return const {
      'leave': 'إجازة',
      'permission': 'استئذان',
      'checkout': 'انصراف',
    }[type] ?? type;
  }

  String status(String value) {
    return const {
      'pending': 'قيد المراجعة',
      'approved': 'مقبول',
      'rejected': 'مرفوض',
      'confirmed': 'مؤكد',
      'cancelled': 'ملغى',
    }[value] ?? value;
  }

  Color statusColor(String value) {
    if (value == 'approved' || value == 'confirmed') return Colors.green;
    if (value == 'rejected' || value == 'cancelled') return Colors.red;
    return Colors.orange;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الطلبات')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: service == null ? null : _newRequest,
        label: const Text('طلب جديد'),
        icon: const Icon(Icons.add),
      ),
      body: future == null
          ? const Center(child: CircularProgressIndicator())
          : FutureBuilder<List<Map<String, dynamic>>>(
              future: future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(child: Text(HadirApi.errorMessage(snapshot.error!)));
                }
                final rows = snapshot.data ?? [];
                if (rows.isEmpty) return const Center(child: Text('لا توجد طلبات'));
                return RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: rows.length,
                    itemBuilder: (context, index) {
                      final row = rows[index];
                      final state = '${row['status'] ?? 'pending'}';
                      final start = '${row['startDate'] ?? ''}';
                      final end = '${row['endDate'] ?? ''}';
                      final dates = start.isEmpty
                          ? ''
                          : '\n$start${end.isNotEmpty && end != start ? ' → $end' : ''}';
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            child: Icon(
                              state == 'approved' || state == 'confirmed'
                                  ? Icons.check
                                  : state == 'rejected'
                                      ? Icons.close
                                      : Icons.hourglass_empty,
                            ),
                          ),
                          title: Text(label('${row['type'] ?? ''}')),
                          subtitle: Text('${row['reason'] ?? ''}$dates'),
                          isThreeLine: true,
                          trailing: Text(
                            status(state),
                            style: TextStyle(
                              color: statusColor(state),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
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

    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (dialogContext, setDialog) {
            return AlertDialog(
              title: const Text('طلب جديد'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ValueListenableBuilder<String>(
                      valueListenable: type,
                      builder: (_, value, __) {
                        return DropdownButtonFormField<String>(
                          initialValue: value,
                          items: const [
                            DropdownMenuItem(value: 'leave', child: Text('إجازة')),
                            DropdownMenuItem(value: 'permission', child: Text('استئذان')),
                            DropdownMenuItem(value: 'checkout', child: Text('انصراف')),
                          ],
                          onChanged: (next) {
                            if (next != null) type.value = next;
                          },
                          decoration: const InputDecoration(labelText: 'نوع الطلب'),
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () async {
                              final date = await showDatePicker(
                                context: dialogContext,
                                initialDate: start,
                                firstDate: DateTime.now().subtract(const Duration(days: 365)),
                                lastDate: DateTime.now().add(const Duration(days: 365)),
                              );
                              if (date != null) setDialog(() => start = date);
                            },
                            icon: const Icon(Icons.calendar_today),
                            label: const Text('من'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () async {
                              final date = await showDatePicker(
                                context: dialogContext,
                                initialDate: end.isBefore(start) ? start : end,
                                firstDate: start,
                                lastDate: DateTime.now().add(const Duration(days: 365)),
                              );
                              if (date != null) setDialog(() => end = date);
                            },
                            icon: const Icon(Icons.event),
                            label: const Text('إلى'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${start.year}/${start.month.toString().padLeft(2, '0')}/${start.day.toString().padLeft(2, '0')} '
                      '→ ${end.year}/${end.month.toString().padLeft(2, '0')}/${end.day.toString().padLeft(2, '0')}',
                    ),
                    TextField(
                      controller: reason,
                      maxLines: 4,
                      decoration: const InputDecoration(labelText: 'السبب'),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('إلغاء'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(dialogContext, true),
                  child: const Text('إرسال'),
                ),
              ],
            );
          },
        );
      },
    );

    if (submitted == true) {
      if (reason.text.trim().isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('اكتب سبب الطلب.')),
          );
        }
      } else if (end.isBefore(start)) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('تاريخ النهاية غير صحيح.')),
          );
        }
      } else {
        String formatDate(DateTime date) {
          return '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
        }
        try {
          await current.create(
            type: type.value,
            reason: reason.text.trim(),
            startDate: formatDate(start),
            endDate: formatDate(end),
          );
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('تم إرسال الطلب')),
            );
            await _load();
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(HadirApi.errorMessage(e))),
            );
          }
        }
      }
    }

    reason.dispose();
    type.dispose();
  }
}
