import 'package:flutter/material.dart';
import 'package:intl/intl.dart' as intl;

import '../core/api.dart';
import '../core/session.dart';

const _green = Color(0xFF0B6B5A);
const _greenDark = Color(0xFF064B40);
const _soft = Color(0xFFE8F5F0);
const _bg = Color(0xFFF6F8F7);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF71817C);
const _line = Color(0xFFE0E8E5);

class AttendanceInsightsPage extends StatefulWidget {
  const AttendanceInsightsPage({super.key});

  @override
  State<AttendanceInsightsPage> createState() => _AttendanceInsightsPageState();
}

class _AttendanceInsightsPageState extends State<AttendanceInsightsPage> {
  final _session = HadirSession();
  List<dynamic> _records = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = HadirApi(token: await _session.token());
      final records = await api.attendance(limit: 100);
      if (!mounted) return;
      setState(() {
        _records = records;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  List<DateTime> _timesIn(DateTime from, DateTime to) => _records
      .whereType<Map>()
      .map((e) => DateTime.tryParse('${e['timestamp']}'))
      .whereType<DateTime>()
      .where((d) => !d.isBefore(from) && d.isBefore(to))
      .toList()
    ..sort();

  Duration _durationFor(List<DateTime> times) {
    Duration total = Duration.zero;
    for (var i = 0; i + 1 < times.length; i += 2) {
      total += times[i + 1].difference(times[i]);
    }
    return total;
  }

  String _hours(Duration d) {
    if (d == Duration.zero) return '0س';
    return '${d.inHours}س ${d.inMinutes.remainder(60)}د';
  }

  int _daysWithActivity(List<DateTime> times) => times
      .map((d) => '${d.year}-${d.month}-${d.day}')
      .toSet()
      .length;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month);
    final nextMonth = DateTime(now.year, now.month + 1);
    final weekStart = now.subtract(Duration(days: now.weekday - 1));
    final week = _timesIn(
      DateTime(weekStart.year, weekStart.month, weekStart.day),
      DateTime(now.year, now.month, now.day + 1),
    );
    final month = _timesIn(monthStart, nextMonth);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _bg,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: _bg,
          foregroundColor: _ink,
          title: const Text('ملخص الحضور', style: TextStyle(fontWeight: FontWeight.w900)),
          actions: [
            IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh_rounded)),
          ],
        ),
        body: RefreshIndicator(
          color: _green,
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
            children: [
              Text(
                intl.DateFormat('MMMM yyyy', 'ar').format(now),
                style: const TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              const Text(
                'صورة سريعة عن ساعات دوامك وحركاتك',
                style: TextStyle(color: _ink, fontSize: 22, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 18),
              if (_loading) ...[
                const _InsightSkeleton(),
                const SizedBox(height: 10),
                const _InsightSkeleton(),
              ] else if (_error != null) ...[
                _MessageCard(_error!, Icons.cloud_off_rounded),
              ] else ...[
                _SummaryCard(
                  title: 'هذا الشهر',
                  hours: _hours(_durationFor(month)),
                  days: '${_daysWithActivity(month)} يوم نشط',
                  movements: '${month.length} حركة',
                ),
                const SizedBox(height: 10),
                _SummaryCard(
                  title: 'هذا الأسبوع',
                  hours: _hours(_durationFor(week)),
                  days: '${_daysWithActivity(week)} يوم نشط',
                  movements: '${week.length} حركة',
                ),
                const SizedBox(height: 18),
                _section('آخر يوم مسجل'),
                const SizedBox(height: 9),
                _lastActivity(month),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _soft,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: _line),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline_rounded, color: _green, size: 19),
                      SizedBox(width: 9),
                      Expanded(
                        child: Text(
                          'الأرقام مبنية على حركات الحضور الفعلية التي يعيدها النظام، وليست تقديرات من الواجهة.',
                          style: TextStyle(color: _greenDark, fontSize: 10.5, height: 1.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _section(String text) => Text(text, style: const TextStyle(color: _ink, fontSize: 14, fontWeight: FontWeight.w900));

  Widget _lastActivity(List<DateTime> month) {
    if (month.isEmpty) return const _MessageCard('لا توجد حركات مسجلة لهذا الشهر.', Icons.event_available_rounded);
    final latest = month.last;
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)),
      child: Row(
        children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.schedule_rounded, color: _green)),
          const SizedBox(width: 11),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(intl.DateFormat('EEEE، d MMMM', 'ar').format(latest), style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 12)),
            const SizedBox(height: 4),
            Text(intl.DateFormat('HH:mm').format(latest), style: const TextStyle(color: _muted, fontSize: 11)),
          ])),
          const Icon(Icons.chevron_left_rounded, color: _muted),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final String hours;
  final String days;
  final String movements;

  const _SummaryCard({required this.title, required this.hours, required this.days, required this.movements});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(17),
        decoration: BoxDecoration(
          gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_green, _greenDark]),
          borderRadius: BorderRadius.circular(22),
          boxShadow: const [BoxShadow(color: Color(0x1C0B6B5A), blurRadius: 22, offset: Offset(0, 9))],
        ),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(hours, style: const TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w900)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(days, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
            const SizedBox(height: 5),
            Text(movements, style: const TextStyle(color: Colors.white70, fontSize: 10)),
          ]),
        ]),
      );
}

class _MessageCard extends StatelessWidget {
  final String text;
  final IconData icon;
  const _MessageCard(this.text, this.icon);
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)),
        child: Row(children: [Icon(icon, color: _green), const SizedBox(width: 10), Expanded(child: Text(text, style: const TextStyle(color: _muted, fontSize: 11, height: 1.4)))]),
      );
}

class _InsightSkeleton extends StatelessWidget {
  const _InsightSkeleton();
  @override
  Widget build(BuildContext context) => Container(height: 96, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)));
}
