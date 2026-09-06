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
  List<Map<String, dynamic>> _records = const [];
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
        _records = records.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
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

  List<Map<String, dynamic>> _recordsIn(DateTime from, DateTime to) {
    return _records.where((record) {
      final value = DateTime.tryParse('${record['timestamp']}');
      if (value == null) return false;
      final local = value.toLocal();
      return !local.isBefore(from) && local.isBefore(to);
    }).toList()
      ..sort((a, b) {
        final at = DateTime.tryParse('${a['timestamp']}') ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bt = DateTime.tryParse('${b['timestamp']}') ?? DateTime.fromMillisecondsSinceEpoch(0);
        return at.compareTo(bt);
      });
  }

  Duration _durationFor(List<Map<String, dynamic>> records) {
    Duration total = Duration.zero;
    DateTime? checkIn;
    for (final record in records) {
      final time = DateTime.tryParse('${record['timestamp']}')?.toLocal();
      if (time == null) continue;
      final type = record['type'];
      if (type == 'check-in') {
        checkIn = time;
      } else if (type == 'check-out' && checkIn != null && !time.isBefore(checkIn)) {
        total += time.difference(checkIn);
        checkIn = null;
      }
    }
    if (checkIn != null) {
      final now = DateTime.now();
      if (now.isAfter(checkIn)) total += now.difference(checkIn);
    }
    return total;
  }

  String _hours(Duration d) {
    if (d == Duration.zero) return '0س';
    return '${d.inHours}س ${d.inMinutes.remainder(60)}د';
  }

  int _daysWithActivity(List<Map<String, dynamic>> records) => records
      .map((record) => DateTime.tryParse('${record['timestamp']}')?.toLocal())
      .whereType<DateTime>()
      .map((d) => '${d.year}-${d.month}-${d.day}')
      .toSet()
      .length;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month);
    final nextMonth = DateTime(now.year, now.month + 1);
    final weekStart = now.subtract(Duration(days: now.weekday - 1));
    final week = _recordsIn(
      DateTime(weekStart.year, weekStart.month, weekStart.day),
      DateTime(now.year, now.month, now.day + 1),
    );
    final month = _recordsIn(monthStart, nextMonth);
    final monthDuration = _durationFor(month);
    final activeDays = _daysWithActivity(month);
    final average = activeDays == 0 ? Duration.zero : Duration(minutes: monthDuration.inMinutes ~/ activeDays);

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
                  hours: _hours(monthDuration),
                  days: '$activeDays يوم نشط',
                  movements: '${month.length} حركة',
                ),
                const SizedBox(height: 10),
                _SummaryCard(
                  title: 'هذا الأسبوع',
                  hours: _hours(_durationFor(week)),
                  days: '${_daysWithActivity(week)} يوم نشط',
                  movements: '${week.length} حركة',
                ),
                const SizedBox(height: 10),
                _AverageCard(value: _hours(average)),
                const SizedBox(height: 18),
                _section('آخر حركة مسجلة'),
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

  Widget _lastActivity(List<Map<String, dynamic>> month) {
    if (month.isEmpty) return const _MessageCard('لا توجد حركات مسجلة لهذا الشهر.', Icons.event_available_rounded);
    final latest = month.last;
    final time = DateTime.tryParse('${latest['timestamp']}')?.toLocal();
    final checkout = latest['type'] == 'check-out';
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: _line)),
      child: Row(
        children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: checkout ? const Color(0xFFFFEFED) : _soft, borderRadius: BorderRadius.circular(14)), child: Icon(checkout ? Icons.logout_rounded : Icons.login_rounded, color: checkout ? const Color(0xFFB94A3D) : _green)),
          const SizedBox(width: 11),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(checkout ? 'تسجيل الانصراف' : 'تسجيل الحضور', style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 12)),
            const SizedBox(height: 4),
            Text(time == null ? 'وقت غير معروف' : intl.DateFormat('EEEE، d MMMM · HH:mm', 'ar').format(time), style: const TextStyle(color: _muted, fontSize: 10.5)),
          ])),
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

class _AverageCard extends StatelessWidget {
  final String value;
  const _AverageCard({required this.value});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)),
        child: Row(children: [
          Container(width: 38, height: 38, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.insights_rounded, color: _green, size: 20)),
          const SizedBox(width: 10),
          const Expanded(child: Text('متوسط ساعات اليوم النشط', style: TextStyle(color: _ink, fontSize: 11.5, fontWeight: FontWeight.w800))),
          Text(value, style: const TextStyle(color: _green, fontSize: 14, fontWeight: FontWeight.w900)),
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
