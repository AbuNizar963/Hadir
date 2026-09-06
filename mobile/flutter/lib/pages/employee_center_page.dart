import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/session.dart';

const _green = Color(0xFF0B6B5A);
const _greenDark = Color(0xFF064B40);
const _soft = Color(0xFFE8F5F0);
const _bg = Color(0xFFF5F8F7);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF72827D);
const _line = Color(0xFFDCE6E2);

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
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _bg,
        appBar: AppBar(
          backgroundColor: _bg,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          title: const Text(
            'مركز الموظف',
            style: TextStyle(fontWeight: FontWeight.w900, color: _ink),
          ),
          actions: [
            IconButton(
              tooltip: 'تحديث',
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh_rounded, color: _ink),
            ),
            const SizedBox(width: 6),
          ],
        ),
        body: RefreshIndicator(
          color: _green,
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
            children: [
              _hero(),
              const SizedBox(height: 20),
              _sectionTitle('الوصول السريع', 'كل ما تحتاجه لإنجاز يومك'),
              const SizedBox(height: 10),
              _actionGrid(),
              const SizedBox(height: 20),
              _securityCard(),
              const SizedBox(height: 20),
              _sectionTitle('الخدمات الذكية', 'أدوات إضافية داخل HADIR'),
              const SizedBox(height: 10),
              _serviceTile(
                Icons.cloud_outlined,
                'الطقس والصلاة',
                'الطقس، مواقيت الصلاة والقبلة',
                () => context.go('/services'),
              ),
              _serviceTile(
                Icons.auto_awesome_rounded,
                'Hadir AI',
                'مساعد ذكي للموظف',
                () => context.go('/services'),
              ),
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
          colors: [_greenDark, _green],
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(color: Color(0x18064B40), blurRadius: 22, offset: Offset(0, 10)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .14),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.grid_view_rounded, color: Colors.white, size: 27),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'مساحتك في HADIR',
                  style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
                ),
                SizedBox(height: 4),
                Text(
                  'كل خدماتك في مكان واحد',
                  style: TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900),
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
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: _ink)),
              const SizedBox(height: 3),
              Text(subtitle, style: const TextStyle(fontSize: 12, color: _muted)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _actionGrid() {
    final actions = <({IconData icon, String title, String subtitle, String route})>[
      (icon: Icons.qr_code_scanner_rounded, title: 'تسجيل الحضور', subtitle: 'QR + GPS', route: '/attendance?type=check-in'),
      (icon: Icons.history_rounded, title: 'سجل الحضور', subtitle: 'عملياتك السابقة', route: '/history'),
      (icon: Icons.event_note_rounded, title: 'الطلبات', subtitle: 'إجازات وأذونات', route: '/requests'),
      (icon: Icons.notifications_none_rounded, title: 'الإشعارات', subtitle: 'التنبيهات والرسائل', route: '/notifications'),
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
        return _actionCard(action.icon, action.title, action.subtitle, () => context.go(action.route));
      },
    );
  }

  Widget _actionCard(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: const BoxDecoration(color: _soft, shape: BoxShape.circle),
                child: Icon(icon, color: _green, size: 21),
              ),
              const Spacer(),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: _ink)),
              const SizedBox(height: 3),
              Text(subtitle, style: const TextStyle(fontSize: 11.5, color: _muted)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _securityCard() {
    final bound = _device?['bound'] == true;
    final title = _loading
        ? 'جارٍ التحقق من الجهاز…'
        : bound
            ? 'الجهاز مرتبط بالحساب'
            : 'لم يتم ربط الجهاز بعد';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(color: _soft, shape: BoxShape.circle),
            child: Icon(
              bound ? Icons.verified_user_rounded : Icons.security_rounded,
              color: _green,
              size: 22,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('حماية الجهاز', style: TextStyle(fontWeight: FontWeight.w900, color: _ink)),
                const SizedBox(height: 4),
                Text(title, style: const TextStyle(fontSize: 12, color: _muted)),
              ],
            ),
          ),
          if (!_loading)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
              decoration: BoxDecoration(
                color: bound ? _soft : const Color(0xFFFFF5E6),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                bound ? 'آمن' : 'مراجعة',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: bound ? _greenDark : const Color(0xFF9A6A18),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _serviceTile(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _line),
      ),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 5),
        leading: Container(
          width: 43,
          height: 43,
          decoration: const BoxDecoration(color: _soft, shape: BoxShape.circle),
          child: Icon(icon, color: _green, size: 21),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: _ink)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(subtitle, style: const TextStyle(fontSize: 12, color: _muted)),
        ),
        trailing: const Icon(Icons.chevron_left_rounded, color: _muted),
      ),
    );
  }

  Widget _errorCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF5F4),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF0D8D5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFB33A32)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(_error!, style: const TextStyle(fontSize: 12, color: _ink)),
          ),
          TextButton(onPressed: _load, child: const Text('إعادة المحاولة')),
        ],
      ),
    );
  }
}
