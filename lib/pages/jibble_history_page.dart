import 'package:flutter/material.dart';
import 'package:intl/intl.dart' as intl;

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

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
    if (mounted) setState(() { _loading = true; _error = null; });
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
    final records = _records.where((raw) {
      final date = _date(raw)?.toLocal();
      if (date == null || date.year != now.year || date.month != now.month) return false;
      return _viewMode == 1 || date.day == now.day;
    }).toList();
    records.sort((a, b) {
      final ad = _date(a) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bd = _date(b) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bd.compareTo(ad);
    });
    return records;
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: RefreshIndicator(
        color: HadirBrand.primary,
        onRefresh: _load,
        child: _body(),
      ),
    );
  }

  Widget _body() {
    if (_loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: const [
          _SummarySkeleton(),
          SizedBox(height: 14),
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
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [_message(_error!, Icons.cloud_off_rounded)],
      );
    }

    final visible = _visibleRecords;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        _summary(),
        const SizedBox(height: 14),
        _viewSelector(),
        const SizedBox(height: 18),
        Text(
          _viewMode == 0 ? 'اليوم' : 'هذا الشهر',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 10),
        if (visible.isEmpty)
          _message(
            _viewMode == 0 ? 'لا توجد حركات حضور اليوم.' : 'لا توجد حركات حضور هذا الشهر.',
            Icons.event_available_rounded,
          ),
        ...visible.map(_recordTile),
      ],
    );
  }

  Widget _viewSelector() {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .45),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .7)),
      ),
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
    final scheme = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? scheme.primary.withValues(alpha: .12) : Colors.transparent,
          borderRadius: BorderRadius.circular(11),
          border: selected ? Border.all(color: scheme.primary.withValues(alpha: .25)) : null,
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: selected ? scheme.primary : scheme.onSurfaceVariant,
            fontSize: 11,
            fontWeight: FontWeight.w900,
          ),
        ),
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
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [scheme.primary, HadirBrand.primaryDark],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: scheme.primary.withValues(alpha: .18), blurRadius: 24, offset: const Offset(0, 10)),
        ],
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
    final checkout = item['type'] == 'check-out' || item['type'] == 'out';
    final date = _date(item)?.toLocal();
    final distance = double.tryParse('${item['distanceMeters']}');
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .75)),
      ),
      child: Row(children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: checkout ? scheme.error.withValues(alpha: .10) : scheme.primary.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(checkout ? Icons.logout_rounded : Icons.login_rounded, color: checkout ? scheme.error : scheme.primary, size: 21),
        ),
        const SizedBox(width: 11),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(checkout ? 'تسجيل الانصراف' : 'تسجيل الحضور', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 3),
          Text(date == null ? 'وقت غير متوفر' : intl.DateFormat('EEEE، d MMMM • HH:mm', 'ar').format(date), style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10.5)),
          if (distance != null) ...[
            const SizedBox(height: 5),
            Row(children: [Icon(Icons.near_me_outlined, color: scheme.onSurfaceVariant, size: 12), const SizedBox(width: 4), Text('${distance.toStringAsFixed(0)} م من الموقع', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9.5))]),
          ],
        ])),
      ]),
    );
  }

  DateTime? _date(dynamic raw) {
    if (raw is! Map) return null;
    return DateTime.tryParse('${raw['timestamp'] ?? raw['time']}');
  }

  Widget _message(String text, IconData icon) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .75)),
      ),
      child: Column(children: [
        Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .10), borderRadius: BorderRadius.circular(16)),
          child: Icon(icon, color: scheme.primary),
        ),
        const SizedBox(height: 12),
        Text(text, textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurface, fontWeight: FontWeight.w700, height: 1.45)),
      ]),
    );
  }
}

class _SummarySkeleton extends StatelessWidget {
  const _SummarySkeleton();
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      height: 126,
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .45),
        borderRadius: BorderRadius.circular(25),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .7)),
      ),
    );
  }
}

class _RowSkeleton extends StatelessWidget {
  const _RowSkeleton();
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      height: 72,
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .45),
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .7)),
      ),
    );
  }
}
