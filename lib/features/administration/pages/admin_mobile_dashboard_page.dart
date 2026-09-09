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
  String _name = 'الإدارة';
  String _role = 'admin';
  List<Map<String, dynamic>> _employees = [];
  List<dynamic> _requests = [];
  List<dynamic> _violations = [];
  List<dynamic> _escapes = [];
  String _filter = 'all';
  String _search = '';

  Color get _ink => Theme.of(context).colorScheme.onSurface;
  Color get _muted => Theme.of(context).colorScheme.onSurfaceVariant;
  Color get _surface => Theme.of(context).colorScheme.surface;
  Color get _panel => Theme.of(context).colorScheme.surfaceContainerHighest;
  Color get _border => Theme.of(context).colorScheme.outlineVariant;
  Color get _primary => Theme.of(context).colorScheme.primary;

  String get _roleLabel => switch (_role) {
        'owner' => 'المالك',
        'manager' => 'المدير',
        'supervisor' => 'المشرف',
        _ => 'الإدارة',
      };

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
      final me = await api.me();
      final user = me['user'];
      final role = user is Map ? '${user['role'] ?? 'admin'}'.toLowerCase() : 'admin';
      final name = user is Map ? '${user['name'] ?? 'الإدارة'}' : 'الإدارة';

      final daily = await api.dailyStatus(date: _today());
      final rows = _asMapList(daily['employees']);
      final requests = await api.requests();
      final violations = await api.violations(limit: 200);

      List<dynamic> escapes = [];
      try {
        final response = await api.dio.get(
          '/api/escape-events',
          queryParameters: {'limit': 2000},
        );
        escapes = _asList(response.data);
      } catch (_) {
        // Escape events are optional; the core daily dashboard remains usable.
      }

      if (!mounted) return;
      setState(() {
        _name = name;
        _role = role;
        _employees = rows;
        _requests = requests;
        _violations = violations;
        _escapes = escapes;
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

  List<dynamic> _asList(dynamic value) {
    if (value is List) return List<dynamic>.from(value);
    if (value is Map) {
      for (final key in const ['data', 'items', 'entries', 'events']) {
        final nested = value[key];
        if (nested is List) return List<dynamic>.from(nested);
      }
    }
    return [];
  }

  int _count(String status) => _employees
      .where((row) => '${row['status'] ?? ''}'.toUpperCase() == status)
      .length;

  int get _present => _count('PRESENT') + _count('LATE');
  int get _absent => _count('ABSENT');
  int get _late => _count('LATE');
  int get _rest => _employees.where((row) {
        final status = '${row['status'] ?? ''}'.toUpperCase();
        return status == 'REST' || status == 'NOT_STARTED';
      }).length;
  int get _leave => _count('LEAVE');
  int get _pendingRequests => _requests
      .where((raw) => raw is Map && '${raw['status'] ?? ''}'.toLowerCase() == 'pending')
      .length;
  int get _openViolations => _violations
      .where((raw) => raw is Map && '${raw['status'] ?? 'open'}'.toLowerCase() != 'resolved')
      .length;
  int get _escaped => _latestEscapedIds.length;

  Set<String> get _latestEscapedIds {
    final latest = <String, String>{};
    for (final raw in _escapes) {
      if (raw is! Map) continue;
      final id = '${raw['employeeId'] ?? ''}';
      if (id.isEmpty || latest.containsKey(id)) continue;
      latest[id] = '${raw['status'] ?? ''}'.toLowerCase();
    }
    return latest.entries
        .where((entry) => entry.value == 'escaped')
        .map((entry) => entry.key)
        .toSet();
  }

  List<Map<String, dynamic>> get _filteredEmployees {
    final query = _search.trim();
    final escapedIds = _latestEscapedIds;
    return _employees.where((row) {
      final id = '${row['employeeId'] ?? ''}';
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
          return status == 'REST' || status == 'NOT_STARTED';
        case 'leave':
          return status == 'LEAVE';
        case 'escaped':
          return escapedIds.contains(id);
        default:
          return true;
      }
    }).toList();
  }

  String _statusLabel(Map<String, dynamic> row) {
    final escaped = _latestEscapedIds.contains('${row['employeeId'] ?? ''}');
    if (escaped) return 'هارب';
    switch ('${row['status'] ?? ''}'.toUpperCase()) {
      case 'PRESENT':
        return 'حاضر';
      case 'LATE':
        return 'متأخر';
      case 'ABSENT':
        return 'غائب';
      case 'REST':
      case 'NOT_STARTED':
        return 'مستريح';
      case 'LEAVE':
        return 'إجازة';
      case 'PERMISSION':
        return 'إذن';
      case 'INVALID':
        return 'جدول غير صالح';
      default:
        return 'غير محدد';
    }
  }

  Color _statusColor(Map<String, dynamic> row) {
    final label = _statusLabel(row);
    if (label == 'هارب' || label == 'غائب') return const Color(0xFFB42318);
    if (label == 'متأخر') return const Color(0xFFB54708);
    if (label == 'حاضر') return _primary;
    if (label == 'إجازة') return const Color(0xFF6941C6);
    return const Color(0xFF2563A6);
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
              Text(
                '$_roleLabel · لوحة القيادة',
                style: TextStyle(
                  color: _ink,
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _name == 'الإدارة'
                    ? 'نظرة مباشرة على حالة الدوام · ${_today()}'
                    : '$_name · ${_today()}',
                style: TextStyle(color: _muted, fontSize: 12),
              ),
              const SizedBox(height: 16),
              _operationalCard(),
              if (_error != null) ...[
                const SizedBox(height: 12),
                _errorCard(),
              ],
              const SizedBox(height: 18),
              _sectionTitle(
                'حالات الدوام',
                'بيانات مباشرة من D1 · الموظفون + الحضور + الطلبات',
              ),
              const SizedBox(height: 10),
              _statusGrid(),
              const SizedBox(height: 20),
              _employeeSection(rows),
              const SizedBox(height: 20),
              _quickActions(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _operationalCard() => Container(
        padding: const EdgeInsets.all(17),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _border),
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: _primary.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(Icons.monitor_heart_outlined, color: _primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'الحالة التشغيلية الحالية',
                    style: TextStyle(color: _ink, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _loading
                        ? 'جاري مزامنة حالة الدوام من D1…'
                        : '$_present حاضر · $_absent غائب · $_late متأخر · $_openViolations مخالفات مفتوحة',
                    style: TextStyle(
                      color: _muted,
                      fontSize: 11,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
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

  Widget _sectionTitle(String title, String subtitle) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: _ink,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            subtitle,
            style: TextStyle(color: _muted, fontSize: 10.5),
          ),
        ],
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
      _StatusCardData('طلبات معلقة', _pendingRequests, Icons.pending_actions_rounded, 'all'),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.7,
      ),
      itemCount: cards.length,
      itemBuilder: (_, index) {
        final card = cards[index];
        final active = _filter == card.filter;
        return InkWell(
          borderRadius: BorderRadius.circular(17),
          onTap: () => setState(() => _filter = card.filter),
          child: Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: active ? _panel : _surface,
              borderRadius: BorderRadius.circular(17),
              border: Border.all(
                color: active ? _primary.withValues(alpha: .32) : _border,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: _primary.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(card.icon, color: _primary, size: 21),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        card.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: _muted,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${card.value}',
                        style: TextStyle(
                          color: _ink,
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
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

  Widget _quickActions() => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'إجراءات سريعة',
            style: TextStyle(color: _ink, fontSize: 17, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 9),
          _action(Icons.groups_rounded, 'الموظفون', 'إدارة الموظفين والحسابات', '/admin/manage'),
          _action(Icons.assignment_rounded, 'الطلبات', 'مراجعة الطلبات واتخاذ الإجراء', '/manager/requests'),
          _action(Icons.bar_chart_rounded, 'التقارير', 'تقارير الحضور والأرشيف', '/admin/reports'),
          _action(Icons.settings_outlined, 'الإعدادات', 'إعدادات النظام والإدارة', '/admin/settings'),
        ],
      );

  Widget _action(IconData icon, String title, String subtitle, String route) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          onTap: () => context.go(route),
          tileColor: _surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
            side: BorderSide(color: _border),
          ),
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _primary.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: _primary),
          ),
          title: Text(
            title,
            style: TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 12.5),
          ),
          subtitle: Text(
            subtitle,
            style: TextStyle(color: _muted, fontSize: 10),
          ),
          trailing: Icon(Icons.chevron_left_rounded, color: _muted),
        ),
      );
}

class _StatusCardData {
  const _StatusCardData(this.label, this.value, this.icon, this.filter);
  final String label;
  final int value;
  final IconData icon;
  final String filter;
}
