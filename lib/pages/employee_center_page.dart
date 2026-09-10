import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/session.dart';

class EmployeeCenterPage extends StatefulWidget {
  const EmployeeCenterPage({super.key});

  @override
  State<EmployeeCenterPage> createState() => _EmployeeCenterPageState();
}

class _EmployeeCenterPageState extends State<EmployeeCenterPage> {
  final _session = HadirSession();
  Map<String, dynamic>? _device;
  Map<String, dynamic>? _profile;
  List<dynamic> _attendance = const [];
  List<dynamic> _requests = const [];
  List<dynamic> _notifications = const [];
  bool _loading = true;
  String? _error;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final token = await _session.token();
      final api = HadirApi(token: token);
      final results = await Future.wait<Object?>([
        api.employeeDeviceStatus(),
        api.employeeProfile(),
        api.attendance(limit: 500),
        api.requests(),
        api.notifications(),
      ]);
      if (!mounted) return;
      setState(() {
        _device = results[0] as Map<String, dynamic>;
        _profile = results[1] as Map<String, dynamic>;
        _attendance = results[2] as List<dynamic>;
        _requests = results[3] as List<dynamic>;
        _notifications = results[4] as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  dynamic _value(Map<String, dynamic>? source, String key) {
    if (source == null) return null;
    return source[key];
  }

  String _text(dynamic value, [String fallback = 'غير متوفر']) {
    final text = '${value ?? ''}'.trim();
    return text.isEmpty ? fallback : text;
  }

  String _profileText(String key, [String fallback = 'غير متوفر']) =>
      _text(_value(_profile, key), fallback);

  DateTime? _date(dynamic value) {
    if (value is DateTime) return value;
    if (value == null) return null;
    return DateTime.tryParse('$value');
  }

  String _dateText(dynamic value) {
    final date = _date(value);
    if (date == null) return 'غير متوفر';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  String _timeText(dynamic value) {
    final date = _date(value);
    if (date == null) return 'غير متوفر';
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  List<Map<String, dynamic>> get _attendanceMaps => _attendance
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();

  List<Map<String, dynamic>> get _requestMaps => _requests
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();

  List<Map<String, dynamic>> get _notificationMaps => _notifications
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();

  int get _presentDays {
    final days = <String>{};
    for (final item in _attendanceMaps) {
      final date = _date(item['timestamp'] ?? item['time']);
      if (date != null && _type(item) == 'check-in') {
        days.add('${date.year}-${date.month}-${date.day}');
      }
    }
    return days.length;
  }

  int get _lateCount => _attendanceMaps.where((item) {
        final type = _text(item['type'], '').toLowerCase();
        return type.contains('late') || type.contains('متأخر');
      }).length;

  int get _unreadNotifications =>
      _notificationMaps.where((item) => item['read'] != true).length;

  String _type(Map<String, dynamic> item) =>
      _text(item['type'], '').toLowerCase();

  String _statusLabel(dynamic value) {
    final status = _text(value, '').toLowerCase();
    if (status.contains('approved') || status.contains('مقبول')) return 'مقبول';
    if (status.contains('rejected') || status.contains('مرفوض')) return 'مرفوض';
    if (status.contains('pending') || status.contains('معلق')) return 'معلق';
    if (status.contains('cancel')) return 'ملغى';
    return _text(value, 'غير محدد');
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('مركز الموظف'),
          actions: [
            if (_unreadNotifications > 0)
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 10),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: HadirBrand.soft,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Text(
                    '$_unreadNotifications',
                    style: const TextStyle(
                      color: HadirBrand.primaryDark,
                      fontWeight: FontWeight.w900,
                      fontSize: 11,
                    ),
                  ),
                ),
              ),
            IconButton(
              tooltip: 'تحديث',
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh_rounded),
            ),
            const SizedBox(width: 6),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(52),
            child: SizedBox(
              height: 52,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                scrollDirection: Axis.horizontal,
                itemCount: _tabs.length,
                separatorBuilder: (_, __) => const SizedBox(width: 7),
                itemBuilder: (_, index) => _tabChip(index),
              ),
            ),
          ),
        ),
        body: RefreshIndicator(
          color: HadirBrand.primary,
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 30),
            children: [
              _hero(),
              const SizedBox(height: 16),
              _tabContent(),
              if (_error != null) ...[
                const SizedBox(height: 12),
                _errorCard(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static const _tabs = <({String title, IconData icon})>[
    (title: 'البطاقة', icon: Icons.badge_outlined),
    (title: 'نظرة عامة', icon: Icons.analytics_outlined),
    (title: 'التقويم', icon: Icons.calendar_month_outlined),
    (title: 'النشاط', icon: Icons.timeline_rounded),
    (title: 'الدوام', icon: Icons.schedule_rounded),
    (title: 'الطلبات', icon: Icons.assignment_outlined),
    (title: 'الأمان', icon: Icons.shield_outlined),
  ];

  Widget _tabChip(int index) {
    final selected = _tab == index;
    return Material(
      color: selected ? HadirBrand.primary : Theme.of(context).cardColor,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        onTap: () => setState(() => _tab = index),
        borderRadius: BorderRadius.circular(22),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          child: Row(
            children: [
              Icon(
                _tabs[index].icon,
                size: 17,
                color: selected ? Colors.white : HadirBrand.muted,
              ),
              const SizedBox(width: 6),
              Text(
                _tabs[index].title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: selected ? Colors.white : Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tabContent() {
    switch (_tab) {
      case 0:
        return _identityTab();
      case 1:
        return _overviewTab();
      case 2:
        return _calendarTab();
      case 3:
        return _activityTab();
      case 4:
        return _scheduleTab();
      case 5:
        return _requestsTab();
      case 6:
        return _securityTab();
    }
    return const SizedBox.shrink();
  }

  Widget _hero() {
    final name = _profileText('name', 'الموظف');
    final jobNumber = _profileText('jobNumber', '—');
    final status = _profileText('status', 'نشط');
    final start = _profileText('workStartTime', _profileText('startTime', '08:00'));
    final end = _profileText('workEndTime', _profileText('endTime', '16:00'));
    final active = status.toLowerCase() == 'active' || status == 'نشط';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(HadirBrand.radiusXl),
        border: Border.all(color: Theme.of(context).dividerColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: HadirBrand.soft,
                  borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
                  border: Border.all(color: HadirBrand.primary.withValues(alpha: .25)),
                ),
                alignment: Alignment.center,
                child: Text(
                  name.characters.first,
                  style: const TextStyle(
                    color: HadirBrand.primaryDark,
                    fontSize: 30,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'بطاقة الموظف الرقمية',
                      style: TextStyle(fontSize: 12, color: HadirBrand.muted),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 5),
                    InkWell(
                      onTap: jobNumber == '—'
                          ? null
                          : () async {
                              await Clipboard.setData(ClipboardData(text: jobNumber));
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('تم نسخ الرقم الوظيفي')),
                              );
                            },
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(jobNumber, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                            const SizedBox(width: 5),
                            const Icon(Icons.copy_rounded, size: 14, color: HadirBrand.muted),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _heroInfo('الحالة', active ? 'نشط' : status)),
              const SizedBox(width: 8),
              Expanded(child: _heroInfo('الدوام', '$start → $end')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroInfo(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
      decoration: BoxDecoration(
        color: HadirBrand.soft,
        borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
        border: Border.all(color: HadirBrand.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: HadirBrand.muted)),
          const SizedBox(height: 3),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _identityTab() {
    final role = _profileText('role', _profileText('jobTitle', 'موظف'));
    final department = _profileText('department', _profileText('departmentName', 'غير محدد'));
    final statusRaw = _profileText('status', 'نشط');
    final status = statusRaw.toLowerCase() == 'active' ? 'نشط' : statusRaw;
    final jobNumber = _profileText('jobNumber', '—');
    final scheduleType = _profileText('scheduleType', 'ثابت');
    final schedule = scheduleType.toLowerCase().contains('rotation') || scheduleType.contains('مناوب') ? 'تناوبي' : 'اعتيادي';
    return Column(
      children: [
        _sectionTitle('هوية الموظف', 'بطاقتك الرقمية وبيانات الهوية الوظيفية'),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(HadirBrand.radiusXl),
            border: Border.all(color: HadirBrand.primary.withValues(alpha: .30)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 92,
                    height: 92,
                    decoration: BoxDecoration(
                      color: HadirBrand.soft,
                      borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      _profileText('name', 'م').characters.first,
                      style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: HadirBrand.primary),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Hadir · بطاقة موظف', style: TextStyle(fontSize: 11, color: HadirBrand.muted)),
                        const SizedBox(height: 4),
                        Text(_profileText('name', 'الموظف'), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 4),
                        Text(department == 'غير محدد' ? role : department, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: HadirBrand.muted)),
                        const SizedBox(height: 5),
                        Text(jobNumber, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: .4)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _heroInfo('الحالة', status)),
                  const SizedBox(width: 8),
                  Expanded(child: _heroInfo('نوع الدوام', schedule)),
                ],
              ),
              const SizedBox(height: 12),
              _infoBanner(),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _actionBanner(
          Icons.person_rounded,
          'الملف الشخصي',
          'عرض وتعديل بيانات حسابك من الصفحة المخصصة.',
          () => context.go('/profile'),
        ),
      ],
    );
  }

  Widget _overviewTab() {
    return Column(
      children: [
        _sectionTitle('نظرة عامة', 'ملخص العمل والالتزام'),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _metricCard('أيام الحضور', '$_presentDays', Icons.event_available_outlined)),
            const SizedBox(width: 10),
            Expanded(child: _metricCard('أيام مكتملة', '${_attendanceMaps.where((x) => _type(x).contains('check-out')).length}', Icons.task_alt_outlined)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _metricCard('التأخير', '$_lateCount', Icons.schedule_outlined)),
            const SizedBox(width: 10),
            Expanded(child: _metricCard('الطلبات', '${_requestMaps.length}', Icons.assignment_outlined)),
          ],
        ),
        const SizedBox(height: 14),
        _sectionTitle('آخر أيام العمل', 'أحدث عمليات الحضور المسجلة'),
        const SizedBox(height: 10),
        if (_attendanceMaps.isEmpty)
          _emptyCard('لا توجد سجلات حضور متاحة حالياً.')
        else
          ..._attendanceMaps.take(8).map(_attendanceTile),
      ],
    );
  }

  Widget _calendarTab() {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final item in _attendanceMaps) {
      final date = _date(item['timestamp'] ?? item['time']);
      if (date == null) continue;
      final key = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      grouped.putIfAbsent(key, () => []).add(item);
    }
    final entries = grouped.entries.take(31).toList();
    return Column(
      children: [
        _sectionTitle('التقويم', 'أيام الحضور والانصراف'),
        const SizedBox(height: 10),
        if (entries.isEmpty)
          _emptyCard('لا توجد أيام حضور مسجلة بعد.')
        else
          ...entries.map((entry) {
            final date = DateTime.tryParse(entry.key);
            final hasIn = entry.value.any((item) => _type(item).contains('check-in'));
            final hasOut = entry.value.any((item) => _type(item).contains('check-out'));
            return _card([
              Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, color: HadirBrand.primary, size: 21),
                  const SizedBox(width: 10),
                  Expanded(child: Text(date == null ? entry.key : _dateText(date), style: Theme.of(context).textTheme.titleSmall)),
                  _miniBadge(hasIn ? 'حضور' : '—', good: hasIn),
                  const SizedBox(width: 6),
                  _miniBadge(hasOut ? 'انصراف' : '—', good: hasOut),
                ],
              ),
            ]);
          }),
      ],
    );
  }

  Widget _activityTab() {
    final items = _attendanceMaps.take(40).toList();
    return Column(
      children: [
        _sectionTitle('النشاط', 'الخط الزمني للعمليات'),
        const SizedBox(height: 10),
        if (items.isEmpty)
          _emptyCard('لا توجد عمليات مسجلة بعد.')
        else
          ...items.map(_activityTile),
        const SizedBox(height: 14),
        _actionBanner(
          Icons.history_rounded,
          'سجل العمل الكامل',
          'فتح صفحة السجل المخصصة مع تفاصيل العمليات.',
          () => context.go('/history'),
        ),
      ],
    );
  }

  Widget _scheduleTab() {
    final scheduleType = _profileText('scheduleType', 'ثابت');
    final start = _profileText('workStartTime', _profileText('startTime', 'غير محدد'));
    final end = _profileText('workEndTime', _profileText('endTime', 'غير محدد'));
    final workDays = _profile?['workDays'];
    final days = workDays is List ? workDays.map((e) => '$e').join('، ') : _text(workDays, 'حسب الجدول');
    final rotationOn = _profileText('rotationDaysOn', '—');
    final rotationOff = _profileText('rotationDaysOff', '—');
    return Column(
      children: [
        _sectionTitle('الدوام', 'المناوبة وأوقات العمل'),
        const SizedBox(height: 10),
        _card([
          _identityRow(Icons.repeat_rounded, 'نوع الجدول', scheduleType),
          _identityRow(Icons.login_rounded, 'بداية العمل', start),
          _identityRow(Icons.logout_rounded, 'نهاية العمل', end),
          _identityRow(Icons.date_range_outlined, 'أيام العمل', days),
          if (scheduleType.toLowerCase().contains('rotation') || scheduleType.contains('مناوب')) ...[
            _identityRow(Icons.event_repeat_rounded, 'أيام العمل في الدورة', rotationOn),
            _identityRow(Icons.event_busy_outlined, 'أيام الراحة في الدورة', rotationOff),
          ],
        ]),
      ],
    );
  }

  Widget _requestsTab() {
    final items = _requestMaps.take(30).toList();
    return Column(
      children: [
        _sectionTitle('الطلبات', 'الإجازات والاستئذانات'),
        const SizedBox(height: 10),
        if (items.isEmpty)
          _emptyCard('لا توجد طلبات مسجلة حالياً.')
        else
          ...items.map(_requestTile),
        const SizedBox(height: 12),
        _actionBanner(
          Icons.add_task_rounded,
          'إنشاء طلب',
          'إرسال طلب إجازة أو استئذان من المسار الحالي.',
          () => context.go('/requests'),
        ),
      ],
    );
  }

  Widget _securityTab() {
    final bound = _device?['bound'] == true;
    final passkeyCount = (_device?['passkeyCount'] as num?)?.toInt() ?? 0;
    final deviceLabel = _text(_device?['deviceLabel']);
    final status = bound ? 'مرتبط وآمن' : 'يحتاج مراجعة';
    return Column(
      children: [
        _sectionTitle('الأمان', 'الحساب والملف الشخصي'),
        const SizedBox(height: 10),
        _deviceSecurityCard(),
        const SizedBox(height: 12),
        _card([
          _identityRow(Icons.verified_user_outlined, 'حالة الحساب', status),
          _identityRow(Icons.badge_outlined, 'الرقم الوظيفي', _profileText('jobNumber', '—'), copy: true),
          _identityRow(Icons.phone_android_outlined, 'الجهاز', deviceLabel),
          _identityRow(Icons.fingerprint_rounded, 'مفاتيح الدخول الآمن', passkeyCount == 0 ? 'غير مسجل' : '$passkeyCount'),
          _identityRow(Icons.assignment_outlined, 'عدد الطلبات', '${_requestMaps.length}'),
        ]),
        const SizedBox(height: 12),
        _actionBanner(
          Icons.person_rounded,
          'إدارة الملف الشخصي',
          'فتح بيانات الحساب من الصفحة المخصصة.',
          () => context.go('/profile'),
        ),
      ],
    );
  }

  Widget _deviceSecurityCard() {
    final bound = _device?['bound'] == true;
    final title = _loading
        ? 'جارٍ التحقق من الجهاز…'
        : bound
            ? 'الجهاز مرتبط بالحساب'
            : 'لم يتم ربط الجهاز بعد';
    return _card([
      Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: const BoxDecoration(color: HadirBrand.soft, shape: BoxShape.circle),
            child: Icon(bound ? Icons.verified_user_rounded : Icons.security_rounded, color: HadirBrand.primary, size: 23),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('حماية الجهاز', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(title, style: const TextStyle(fontSize: 12, color: HadirBrand.muted)),
              ],
            ),
          ),
          if (!_loading) _statusBadge(bound),
        ],
      ),
    ]);
  }

  Widget _attendanceTile(Map<String, dynamic> item) {
    final type = _type(item);
    final isIn = type.contains('check-in');
    final date = item['timestamp'] ?? item['time'];
    return _card([
      Row(
        children: [
          _roundIcon(isIn ? Icons.login_rounded : Icons.logout_rounded),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isIn ? 'تسجيل حضور' : 'تسجيل انصراف', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 3),
                Text(_dateText(date), style: const TextStyle(fontSize: 11, color: HadirBrand.muted)),
              ],
            ),
          ),
          Text(_timeText(date), style: Theme.of(context).textTheme.labelLarge),
        ],
      ),
    ]);
  }

  Widget _activityTile(Map<String, dynamic> item) {
    final type = _type(item);
    final isIn = type.contains('check-in');
    final label = isIn ? 'تسجيل حضور' : type.contains('check-out') ? 'تسجيل انصراف' : _text(item['type'], 'عملية');
    final date = item['timestamp'] ?? item['time'];
    final location = _text(item['locationName'] ?? item['location'], 'الموقع غير متوفر');
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: _card([
        Row(
          children: [
            _roundIcon(isIn ? Icons.login_rounded : Icons.touch_app_rounded),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 3),
                  Text(location, style: const TextStyle(fontSize: 11, color: HadirBrand.muted), overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(_timeText(date), style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 3),
                Text(_dateText(date), style: const TextStyle(fontSize: 10, color: HadirBrand.muted)),
              ],
            ),
          ],
        ),
      ]),
    );
  }

  Widget _requestTile(Map<String, dynamic> item) {
    final type = _text(item['type'], 'طلب');
    final status = _statusLabel(item['status']);
    final reason = _text(item['reason'], 'بدون سبب');
    final created = item['createdAt'] ?? item['timestamp'] ?? item['startDate'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: _card([
        Row(
          children: [
            _roundIcon(Icons.assignment_outlined),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(type, style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 3),
                  Text(reason, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: HadirBrand.muted)),
                ],
              ),
            ),
            _miniBadge(status, good: status == 'مقبول'),
          ],
        ),
        if (created != null) ...[
          const SizedBox(height: 9),
          Text('التاريخ: ${_dateText(created)}', style: const TextStyle(fontSize: 10.5, color: HadirBrand.muted)),
        ],
      ]),
    );
  }

  Widget _sectionTitle(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 3),
        Text(subtitle, style: const TextStyle(fontSize: 12, color: HadirBrand.muted)),
      ],
    );
  }

  Widget _card(List<Widget> children) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(children: children),
    );
  }

  Widget _metricCard(String title, String value, IconData icon) {
    return _card([
      Row(
        children: [
          _roundIcon(icon),
          const SizedBox(width: 10),
          Expanded(child: Text(title, style: const TextStyle(fontSize: 11.5, color: HadirBrand.muted))),
          Text(value, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
        ],
      ),
    ]);
  }

  Widget _identityRow(IconData icon, String title, String value, {bool copy = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, color: HadirBrand.muted, size: 19),
          const SizedBox(width: 10),
          Expanded(child: Text(title, style: const TextStyle(fontSize: 11.5, color: HadirBrand.muted))),
          Flexible(child: Text(value, textAlign: TextAlign.end, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelLarge)),
          if (copy) ...[
            const SizedBox(width: 4),
            IconButton(
              tooltip: 'نسخ',
              visualDensity: VisualDensity.compact,
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: value));
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم نسخ الرقم الوظيفي')));
              },
              icon: const Icon(Icons.copy_rounded, size: 17),
            ),
          ],
        ],
      ),
    );
  }

  Widget _roundIcon(IconData icon) {
    return Container(
      width: 42,
      height: 42,
      decoration: const BoxDecoration(color: HadirBrand.soft, shape: BoxShape.circle),
      child: Icon(icon, color: HadirBrand.primary, size: 21),
    );
  }

  Widget _statusBadge(bool bound) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: bound ? HadirBrand.soft : const Color(0xFFFFF5E6),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        bound ? 'آمن' : 'مراجعة',
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: bound ? HadirBrand.primaryDark : HadirBrand.warning),
      ),
    );
  }

  Widget _miniBadge(String text, {required bool good}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
      decoration: BoxDecoration(
        color: good ? HadirBrand.soft : Theme.of(context).dividerColor.withValues(alpha: .35),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: good ? HadirBrand.primaryDark : HadirBrand.muted)),
    );
  }

  Widget _actionBanner(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return Material(
      color: HadirBrand.soft,
      borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              _roundIcon(icon),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 3),
                    Text(subtitle, style: const TextStyle(fontSize: 11, color: HadirBrand.muted)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left_rounded, color: HadirBrand.muted),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: HadirBrand.soft,
        borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
        border: Border.all(color: HadirBrand.border),
      ),
      child: const Row(
        children: [
          Icon(Icons.info_outline_rounded, color: HadirBrand.primary),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'تأكد من تفعيل الموقع والسماح بالكاميرا عند تسجيل الحضور لضمان اكتمال التحقق.',
              style: TextStyle(fontSize: 12, color: HadirBrand.text, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyCard(String message) {
    return _card([
      const Icon(Icons.inbox_outlined, color: HadirBrand.muted, size: 28),
      const SizedBox(height: 8),
      Text(message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: HadirBrand.muted)),
    ]);
  }

  Widget _errorCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF5F4),
        borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
        border: Border.all(color: const Color(0xFFF0D8D5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: HadirBrand.danger),
          const SizedBox(width: 10),
          Expanded(child: Text(_error!, style: const TextStyle(fontSize: 12, color: HadirBrand.text))),
          TextButton(onPressed: _load, child: const Text('إعادة المحاولة')),
        ],
      ),
    );
  }
}