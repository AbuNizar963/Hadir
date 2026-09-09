import 'package:flutter/material.dart';
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
  bool _loading = true;
  String? _error;

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
      final token = await _session.token();
      final device = await HadirApi(token: token).employeeDeviceStatus();
      if (!mounted) return;
      setState(() {
        _device = device;
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('مركز الموظف'),
          actions: [
            IconButton(
              tooltip: 'تحديث',
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh_rounded),
            ),
            const SizedBox(width: 6),
          ],
        ),
        body: RefreshIndicator(
          color: HadirBrand.primary,
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
            children: [
              _hero(),
              const SizedBox(height: 20),
              _sectionTitle('الوصول السريع', 'كل ما تحتاجه لإنجاز يومك'),
              const SizedBox(height: 10),
              _actionGrid(),
              const SizedBox(height: 20),
              _deviceSecurityCard(),
              const SizedBox(height: 20),
              _sectionTitle('الخدمات الذكية', 'أدوات إضافية داخل HADIR'),
              const SizedBox(height: 10),
              _serviceTile(
                Icons.cloud_outlined,
                'الطقس',
                'حالة الطقس الحالية والتوقعات',
                () => context.go('/weather'),
              ),
              _serviceTile(
                Icons.mosque_outlined,
                'الصلاة والقبلة',
                'مواقيت الصلاة واتجاه القبلة',
                () => context.go('/prayer'),
              ),
              _serviceTile(
                Icons.auto_awesome_rounded,
                'Hadir AI',
                'مساعد ذكي للموظف',
                () => context.go('/ai'),
              ),
              const SizedBox(height: 8),
              _infoBanner(theme),
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

  Widget _hero() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [HadirBrand.primaryDark, HadirBrand.primary],
        ),
        borderRadius: BorderRadius.circular(HadirBrand.radiusXl),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22064B40),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .14),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.grid_view_rounded,
              color: Colors.white,
              size: 28,
            ),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'مساحتك في HADIR',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'كل خدماتك في مكان واحد',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 5),
                Text(
                  'الحضور والسجل والطلبات والإشعارات.',
                  style: TextStyle(color: Colors.white70, fontSize: 12.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 3),
        Text(
          subtitle,
          style: const TextStyle(fontSize: 12, color: HadirBrand.muted),
        ),
      ],
    );
  }

  Widget _actionGrid() {
    final actions = <({IconData icon, String title, String subtitle, String route})>[
      (
        icon: Icons.qr_code_scanner_rounded,
        title: 'تسجيل الحضور',
        subtitle: 'QR + GPS',
        route: '/attendance?type=check-in',
      ),
      (
        icon: Icons.history_rounded,
        title: 'سجل الحضور',
        subtitle: 'عملياتك السابقة',
        route: '/history',
      ),
      (
        icon: Icons.event_note_rounded,
        title: 'الطلبات',
        subtitle: 'إجازات وأذونات',
        route: '/requests',
      ),
      (
        icon: Icons.notifications_none_rounded,
        title: 'الإشعارات',
        subtitle: 'التنبيهات والرسائل',
        route: '/notifications',
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: actions.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.35,
      ),
      itemBuilder: (_, index) {
        final action = actions[index];
        return _actionCard(
          action.icon,
          action.title,
          action.subtitle,
          () => context.go(action.route),
        );
      },
    );
  }

  Widget _actionCard(
    IconData icon,
    String title,
    String subtitle,
    VoidCallback onTap,
  ) {
    return Material(
      color: Theme.of(context).cardColor,
      borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
            border: Border.all(color: Theme.of(context).dividerColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: const BoxDecoration(
                  color: HadirBrand.soft,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: HadirBrand.primary, size: 21),
              ),
              const Spacer(),
              Text(title, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 3),
              const Text('—', style: TextStyle(fontSize: 0)),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 11.5, color: HadirBrand.muted),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _deviceSecurityCard() {
    final bound = _device?['bound'] == true;
    final passkeyCount = (_device?['passkeyCount'] as num?)?.toInt() ?? 0;
    final deviceLabel = '${_device?['deviceLabel'] ?? ''}'.trim();
    final title = _loading
        ? 'جارٍ التحقق من الجهاز…'
        : bound
            ? 'الجهاز مرتبط بالحساب'
            : 'لم يتم ربط الجهاز بعد';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(HadirBrand.radiusLg),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: const BoxDecoration(
                  color: HadirBrand.soft,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  bound ? Icons.verified_user_rounded : Icons.security_rounded,
                  color: HadirBrand.primary,
                  size: 23,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('حماية الجهاز', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 4),
                    Text(
                      title,
                      style: const TextStyle(fontSize: 12, color: HadirBrand.muted),
                    ),
                  ],
                ),
              ),
              if (!_loading) _statusBadge(bound),
            ],
          ),
          if (!_loading) ...[
            const SizedBox(height: 15),
            const Divider(height: 1),
            const SizedBox(height: 12),
            _deviceRow(
              Icons.phone_android_rounded,
              'اسم الجهاز',
              deviceLabel.isEmpty ? 'غير متوفر' : deviceLabel,
            ),
            const SizedBox(height: 11),
            _deviceRow(
              Icons.fingerprint_rounded,
              'مفاتيح الدخول الآمن',
              passkeyCount == 0
                  ? 'غير مسجل'
                  : '$passkeyCount مفتاح${passkeyCount == 1 ? '' : 'ات'}',
            ),
          ],
        ],
      ),
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
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: bound ? HadirBrand.primaryDark : HadirBrand.warning,
        ),
      ),
    );
  }

  Widget _deviceRow(IconData icon, String title, String value) {
    return Row(
      children: [
        Icon(icon, color: HadirBrand.muted, size: 19),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(color: HadirBrand.muted, fontSize: 11),
          ),
        ),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelLarge,
          ),
        ),
      ],
    );
  }

  Widget _serviceTile(
    IconData icon,
    String title,
    String subtitle,
    VoidCallback onTap,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 5),
        leading: Container(
          width: 43,
          height: 43,
          decoration: const BoxDecoration(
            color: HadirBrand.soft,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: HadirBrand.primary, size: 21),
        ),
        title: Text(title, style: Theme.of(context).textTheme.titleSmall),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(
            subtitle,
            style: const TextStyle(fontSize: 12, color: HadirBrand.muted),
          ),
        ),
        trailing: const Icon(Icons.chevron_left_rounded, color: HadirBrand.muted),
      ),
    );
  }

  Widget _infoBanner(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: HadirBrand.soft,
        borderRadius: BorderRadius.circular(HadirBrand.radiusMd),
        border: Border.all(color: HadirBrand.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: HadirBrand.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'تأكد من تفعيل الموقع والسماح بالكاميرا عند تسجيل الحضور لضمان اكتمال التحقق.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: HadirBrand.text,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
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
          Expanded(
            child: Text(
              _error!,
              style: const TextStyle(fontSize: 12, color: HadirBrand.text),
            ),
          ),
          TextButton(onPressed: _load, child: const Text('إعادة المحاولة')),
        ],
      ),
    );
  }
}
