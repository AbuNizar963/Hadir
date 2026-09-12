import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api.dart';
import '../../../core/session.dart';

class AdminMobileDashboardPage extends StatefulWidget {
  const AdminMobileDashboardPage({super.key});

  @override
  State<AdminMobileDashboardPage> createState() => _AdminMobileDashboardPageState();
}

class _AdminMobileDashboardPageState extends State<AdminMobileDashboardPage> {
  final _session = HadirSession();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _employees = [];
  String _filter = 'all';
  String _search = '';

  Color get _ink => Theme.of(context).colorScheme.onSurface;
  Color get _muted => Theme.of(context).colorScheme.onSurfaceVariant;
  Color get _surface => Theme.of(context).colorScheme.surface;
  Color get _panel => Theme.of(context).colorScheme.surfaceContainerHighest;
  Color get _border => Theme.of(context).colorScheme.outlineVariant;
  Color get _primary => Theme.of(context).colorScheme.primary;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = await _session.adminToken();
      if (token == null || token.isEmpty) {
        if (mounted) context.go('/admin-login');
        return;
      }

      final api = HadirApi(token: token);
      await api.me();

      final daily = await api.dailyStatus(date: _today());
      final rows = _asMapList(daily['employees']);

      if (!mounted) return;
      setState(() {
        _employees = rows;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(error);
      });
    }
  }

  String _today() {
    final now = DateTime.now();
    String two(int value) => value.toString().padLeft(2, '0');
    return '${now.year}-${two(now.month)}-${two(now.day)}';
  }

  List<Map<String, dynamic>> _asMapList(dynamic value) {
    if (value is! List) return [];
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  int _count(String status) => _employees
      .where((row) => '${row['status'] ?? ''}'.toUpperCase() == status)
      .length;

  int get _present => _count('PRESENT') + _count('LATE');
  int get _absent => _count('ABSENT');
  int get _late => _count('LATE');
  int get _rest => _count('REST');
  int get _leave => _count('LEAVE');
  int get _permission => _count('PERMISSION');
  int get _escaped => _count('ESCAPED');

  List<Map<String, dynamic>> get _filteredEmployees {
    final query = _search.trim();
    return _employees.where((row) {
      final name = '${row['employeeName'] ?? ''}';
      final status = '${row['status'] ?? ''}'.toUpperCase();
      if (query.isNotEmpty && !name.contains(query)) return false;
      switch (_filter) {
        case 'present':
          return status == 'PRESENT' || status == 'LATE';
        case 'absent':
          return status == 'ABSENT';
        case 'late':
          return status == 'LATE';
        case 'rest':
          return status == 'REST';
        case 'leave':
          return status == 'LEAVE';
        case 'permission':
          return status == 'PERMISSION';
        case 'escaped':
          return status == 'ESCAPED';
        default:
          return true;
      }
    }).toList();
  }

  String _statusLabel(Map<String, dynamic> row) {
    switch ('${row['status'] ?? ''}'.toUpperCase()) {
      case 'PRESENT':
        return 'حاضر';
      case 'LATE':
        return 'متأخر';
      case 'ABSENT':
        return 'غائب';
      case 'REST':
        return 'مستريح';
      case 'NOT_STARTED':
        return 'لم يبدأ';
      case 'LEAVE':
        return 'إجازة';
      case 'PERMISSION':
        return 'إذن';
      case 'ESCAPED':
        return 'هارب';
      case 'INVALID':
        return 'جدول غير صالح';
      case 'OPEN':
        return 'دوام مفتوح';
      default:
        return 'غير محدد';
    }
  }

  Color _statusColor(Map<String, dynamic> row) {
    final label = _statusLabel(row);
    if (label == 'هارب' || label == 'غائب') return const Color(0xFFB42318);
    if (label == 'متأخر') return const Color(0xFFB54708);
    if (label == 'حاضر') return _primary;
    if (label == 'إجازة') return const Color(0xFF9B72D0);
    if (label == 'إذن') return const Color(0xFF4CC9F0);
    return const Color(0xFF2563A6);
  }

  Color _statusCardColor(_StatusCardData card) {
    switch (card.filter) {
      case 'present':
        return _primary;
      case 'late':
        return const Color(0xFFB54708);
      case 'absent':
      case 'escaped':
        return const Color(0xFFB42318);
      case 'leave':
        return const Color(0xFF9B72D0);
      case 'permission':
        return const Color(0xFF4CC9F0);
      case 'rest':
        return const Color(0xFF2563A6);
      default:
        return _primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filteredEmployees;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        color: Theme.of(context).scaffoldBackgroundColor,
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
            children: [
              const SizedBox(height: 10),
              _operationalCard(),
              if (_error != null) ...[
                const SizedBox(height: 12),
                _errorCard(),
              ],
              const SizedBox(height: 18),
              _statusGrid(),
              const SizedBox(height: 20),
              _employeeSection(rows),
            ],
          ),
        ),
      ),
    );
  }

  Widget _operationalCard() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _primary.withValues(alpha: .34)),
          boxShadow: [
            BoxShadow(
              color: _primary.withValues(alpha: .08),
              blurRadius: 18,
              spreadRadius: 1,
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'الحالة التشغيلية الحالية',
              textAlign: TextAlign.right,
              style: TextStyle(color: _ink, fontSize: 14, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    _loading
                        ? 'جاري مزامنة حالة الدوام من D1…'
                        : 'هذه لوحة تشغيل مباشرة لليوم الحالي. الموظف يقيم وفق جدول دوامه الفعلي؛ يوم الراحة لا يُحتسب غيابًا، والوتيرة التناوبية المعتمدة تبقى فعالة طوال فترة العمل.',
                    textAlign: TextAlign.right,
                    style: TextStyle(color: _muted, fontSize: 12, height: 1.65),
                  ),
                ),
              ],
            ),
          ],
        ),
      );

  Widget _errorCard() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.errorContainer,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Theme.of(context).colorScheme.error.withValues(alpha: .35)),
        ),
        child: Row(
          children: [
            Icon(Icons.error_outline_rounded, color: Theme.of(context).colorScheme.error),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer, fontSize: 11),
              ),
            ),
            TextButton(onPressed: _load, child: const Text('إعادة')),
          ],
        ),
      );

  Widget _statusGrid() {
    final cards = <_StatusCardData>[
      _StatusCardData('إجمالي الموظفين', _employees.length, Icons.groups_rounded, 'all'),
      _StatusCardData('الحضور', _present, Icons.person_rounded, 'present'),
      _StatusCardData('الغياب', _absent, Icons.person_off_rounded, 'absent'),
      _StatusCardData('المتأخرون', _late, Icons.schedule_rounded, 'late'),
      _StatusCardData('الراحة', _rest, Icons.coffee_rounded, 'rest'),
      _StatusCardData('الإجازات', _leave, Icons.event_available_rounded, 'leave'),
      _StatusCardData('الهروب', _escaped, Icons.shield_outlined, 'escaped'),
      _StatusCardData('الاستئذان', _permission, Icons.lightbulb_outline_rounded, 'permission'),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 12,
        childAspectRatio: 1.62,
      ),
      itemCount: cards.length,
      itemBuilder: (_, index) {
        final card = cards[index];
        final active = _filter == card.filter;
        final color = _statusCardColor(card);
        return InkWell(
          borderRadius: BorderRadius.circular(17),
          onTap: () => setState(() => _filter = card.filter),
          child: Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: Color.alphaBlend(color.withValues(alpha: active ? .08 : .025), _surface),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: color.withValues(alpha: active ? .65 : .48),
                width: active ? 1.8 : 1.25,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  card.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: .10),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(card.icon, color: color, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '${card.value}',
                      style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                Text(
                  'عرض القائمة',
                  style: TextStyle(color: color.withValues(alpha: .78), fontSize: 10, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _employeeSection(List<Map<String, dynamic>> rows) => Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'حالة الموظفين الحالية',
                        style: TextStyle(
                          color: _ink,
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'المصدر: D1 · الحالة اليومية',
                        style: TextStyle(color: _muted, fontSize: 10),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: _load,
                  tooltip: 'تحديث',
                  icon: Icon(Icons.refresh_rounded, color: _primary),
                ),
              ],
            ),
            const SizedBox(height: 9),
            TextField(
              textDirection: TextDirection.rtl,
              onChanged: (value) => setState(() => _search = value),
              decoration: InputDecoration(
                hintText: 'بحث باسم الموظف',
                prefixIcon: const Icon(Icons.search_rounded),
                isDense: true,
                filled: true,
                fillColor: _panel.withValues(alpha: .55),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(13),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 10),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              )
            else if (rows.isEmpty)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Center(
                  child: Text(
                    'لا توجد نتائج مطابقة.',
                    style: TextStyle(color: _muted, fontSize: 12),
                  ),
                ),
              )
            else
              ...rows.take(50).map(_employeeRow),
          ],
        ),
      );

  Widget _employeeRow(Map<String, dynamic> row) {
    final color = _statusColor(row);
    final name = '${row['employeeName'] ?? 'موظف'}';
    final jobNumber = '${row['jobNumber'] ?? ''}';
    final schedule = '${row['scheduleType'] ?? 'ADMIN'}'.toUpperCase() == 'ROTATION'
        ? 'تناوبي'
        : 'ثابت';
    return Container(
      margin: const EdgeInsets.only(top: 7),
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .06),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: color.withValues(alpha: .20)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: _ink,
                    fontWeight: FontWeight.w800,
                    fontSize: 12.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$schedule${jobNumber.isNotEmpty ? ' · $jobNumber' : ''}',
                  style: TextStyle(color: _muted, fontSize: 9.5),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
            decoration: BoxDecoration(
              color: _surface.withValues(alpha: .75),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              _statusLabel(row),
              style: TextStyle(
                color: color,
                fontSize: 10.5,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusCardData {
  const _StatusCardData(this.label, this.value, this.icon, this.filter);
  final String label;
  final int value;
  final IconData icon;
  final String filter;
}
