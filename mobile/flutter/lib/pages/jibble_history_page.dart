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
const _red = Color(0xFFB94A3D);

class JibbleHistoryPage extends StatefulWidget {
  const JibbleHistoryPage({super.key});

  @override
  State<JibbleHistoryPage> createState() => _JibbleHistoryPageState();
}

class _JibbleHistoryPageState extends State<JibbleHistoryPage> {
  final _session = HadirSession();
  List<dynamic> _records = const [];
  bool _loading = true;
  String? _error;
  int _viewMode = 0;

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

  List<dynamic> get _visibleRecords {
    final now = DateTime.now();
    if (_viewMode == 0) {
      return _records.where((raw) {
        final date = _date(raw)?.toLocal();
        return date != null && date.year == now.year && date.month == now.month && date.day == now.day;
      }).toList();
    }
    return _records.where((raw) {
      final date = _date(raw)?.toLocal();
      return date != null && date.year == now.year && date.month == now.month;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _bg,
        appBar: AppBar(
          backgroundColor: _bg,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          title: const Text('السجل', style: TextStyle(color: _ink, fontWeight: FontWeight.w900)),
          centerTitle: false,
          actions: [
            IconButton(
              tooltip: 'تحديث',
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh_rounded, color: _ink),
            ),
          ],
        ),
        body: RefreshIndicator(
          color: _green,
          onRefresh: _load,
          child: _body(),
        ),
      ),
    );
  }

  Widget _body() {
    if (_loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        children: const [
          _SummarySkeleton(),
          SizedBox(height: 16),
          _RowSkeleton(),
          SizedBox(height: 8),
          _RowSkeleton(),
          SizedBox(height: 8),
          _RowSkeleton(),
        ],
      );
    }
    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(18),
        children: [_message(_error!, Icons.cloud_off_rounded)],
      );
    }

    final visible = _visibleRecords;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
      children: [
        _summary(),
        const SizedBox(height: 14),
        _viewSelector(),
        const SizedBox(height: 18),
        Text(_viewMode == 0 ? 'اليوم' : 'هذا الشهر', style: const TextStyle(color: _ink, fontSize: 17, fontWeight: FontWeight.w900)),
        const SizedBox(height: 10),
        if (visible.isEmpty) _message(_viewMode == 0 ? 'لا توجد حركات حضور اليوم.' : 'لا توجد حركات حضور هذا الشهر.', Icons.event_available_rounded),
        ...visible.map(_recordTile),
      ],
    );
  }

  Widget _viewSelector() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(15), border: Border.all(color: _line)),
      child: Row(
        children: [
          Expanded(child: _viewTab('اليومي', 0)),
          Expanded(child: _viewTab('الشهري', 1)),
        ],
      ),
    );
  }

  Widget _viewTab(String label, int value) {
    final selected = _viewMode == value;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(color: selected ? _soft : Colors.transparent, borderRadius: BorderRadius.circular(11)),
        child: Text(label, textAlign: TextAlign.center, style: TextStyle(color: selected ? _green : _muted, fontSize: 11, fontWeight: FontWeight.w900)),
      ),
    );
  }

  Widget _summary() {
    final now = DateTime.now();
    final month = _records.where((raw) {
      final date = _date(raw)?.toLocal();
      return date != null && date.year == now.year && date.month == now.month;
    }).length;
    final today = _records.where((raw) {
      final date = _date(raw)?.toLocal();
      return date != null && date.year == now.year && date.month == now.month && date.day == now.day;
    }).length;
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_green, _greenDark]),
        borderRadius: BorderRadius.circular(25),
        boxShadow: const [BoxShadow(color: Color(0x220B6B5A), blurRadius: 24, offset: Offset(0, 10))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            const Icon(Icons.calendar_month_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 8),
            const Expanded(child: Text('ملخص الدوام', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
            Text(intl.DateFormat('MMMM yyyy', 'ar').format(now), style: const TextStyle(color: Colors.white70, fontSize: 10.5)),
          ]),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _metric('حركات الشهر', '$month')),
            const SizedBox(width: 8),
            Expanded(child: _metric('حركات اليوم', '$today')),
          ]),
        ],
      ),
    );
  }

  Widget _metric(String label, String value) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
    decoration: BoxDecoration(color: Colors.white.withValues(alpha: .12), borderRadius: BorderRadius.circular(16)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(value, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900)),
      const SizedBox(height: 2),
      Text(label, style: const TextStyle(color: Colors.white70, fontSize: 9.5)),
    ]),
  );

  Widget _recordTile(dynamic raw) {
    final item = Map<String, dynamic>.from(raw as Map);
    final checkout = item['type'] == 'check-out';
    final date = _date(item)?.toLocal();
    final distance = double.tryParse('${item['distanceMeters']}');
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(19), border: Border.all(color: _line)),
      child: Row(children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: checkout ? const Color(0xFFFFF1EE) : _soft, borderRadius: BorderRadius.circular(14)),
          child: Icon(checkout ? Icons.logout_rounded : Icons.login_rounded, color: checkout ? _red : _green, size: 21),
        ),
        const SizedBox(width: 11),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(checkout ? 'تسجيل الانصراف' : 'تسجيل الحضور', style: const TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.w900)),
          const SizedBox(height: 3),
          Text(date == null ? 'وقت غير متوفر' : intl.DateFormat('EEEE، d MMMM • HH:mm', 'ar').format(date), style: const TextStyle(color: _muted, fontSize: 10.5)),
          if (distance != null) ...[
            const SizedBox(height: 5),
            Row(children: [const Icon(Icons.near_me_outlined, color: _muted, size: 12), const SizedBox(width: 4), Text('${distance.toStringAsFixed(0)} م من الموقع', style: const TextStyle(color: _muted, fontSize: 9.5))]),
          ],
        ])),
      ]),
    );
  }

  DateTime? _date(dynamic raw) {
    if (raw is! Map) return null;
    return DateTime.tryParse('${raw['timestamp']}');
  }

  Widget _message(String text, IconData icon) => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)),
    child: Column(children: [
      Container(width: 50, height: 50, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(16)), child: Icon(icon, color: _green)),
      const SizedBox(height: 12),
      Text(text, textAlign: TextAlign.center, style: const TextStyle(color: _ink, fontWeight: FontWeight.w700, height: 1.45)),
    ]),
  );
}

class _SummarySkeleton extends StatelessWidget {
  const _SummarySkeleton();
  @override
  Widget build(BuildContext context) => Container(height: 126, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(25), border: Border.all(color: _line)));
}

class _RowSkeleton extends StatelessWidget {
  const _RowSkeleton();
  @override
  Widget build(BuildContext context) => Container(height: 72, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(19), border: Border.all(color: _line)));
}
