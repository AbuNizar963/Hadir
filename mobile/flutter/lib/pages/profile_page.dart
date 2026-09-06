import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _soft = Color(0xFFE8F5F0);
const _canvas = Color(0xFFF4F7F6);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF73827E);
const _line = Color(0xFFDCE6E2);

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic>? user;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await HadirApi(token: await HadirSession().token()).me();
      final raw = data['user'] is Map ? data['user'] : data;
      if (mounted) {
        setState(() {
          user = Map<String, dynamic>.from(raw as Map);
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = HadirApi.errorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _canvas,
        appBar: AppBar(
          title: const Text('حسابي', style: TextStyle(fontWeight: FontWeight.w900)),
          backgroundColor: _canvas,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator(color: _brand))
            : error != null
                ? _errorView()
                : RefreshIndicator(
                    color: _brand,
                    onRefresh: _load,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 30),
                      children: [
                        _identityCard(),
                        const SizedBox(height: 12),
                        _section('بيانات الموظف', [
                          _infoTile(Icons.badge_outlined, 'رقم الموظف', '${user?['username'] ?? user?['jobNumber'] ?? '—'}'),
                          _infoTile(Icons.work_outline_rounded, 'الدور', 'موظف'),
                        ]),
                        const SizedBox(height: 12),
                        _section('الأمان والجهاز', [
                          _infoTile(Icons.phone_android_rounded, 'الجهاز', 'مرتبط بحساب الموظف', trailing: const _StatusBadge()),
                          _infoTile(Icons.shield_outlined, 'حماية الحضور', 'الموقع + الجهاز + QR'),
                        ]),
                        const SizedBox(height: 12),
                        _section('المزايا القادمة', [
                          _futureTile(Icons.fingerprint_rounded, 'تسجيل دخول بالبصمة', 'قريباً'),
                          _futureTile(Icons.dark_mode_outlined, 'الوضع الليلي', 'قريباً'),
                        ]),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _identityCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [_brand, Color(0xFF064B40)],
        ),
        borderRadius: BorderRadius.circular(27),
        boxShadow: const [BoxShadow(color: Color(0x220B6B5A), blurRadius: 25, offset: Offset(0, 12))],
      ),
      child: Row(
        children: [
          Container(
            width: 66,
            height: 66,
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: .15), shape: BoxShape.circle),
            child: const Icon(Icons.person_rounded, color: Colors.white, size: 34),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${user?['name'] ?? 'الموظف'}', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                const Text('حساب الموظف', style: TextStyle(color: Colors.white70, fontSize: 11)),
              ],
            ),
          ),
          const Icon(Icons.verified_user_rounded, color: Color(0xFF91E3C6), size: 23),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(15, 11, 15, 5),
            child: Align(
              alignment: Alignment.centerRight,
              child: Text(title, style: const TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.w900)),
            ),
          ),
          ...children,
        ],
      ),
    );
  }

  Widget _infoTile(IconData icon, String title, String subtitle, {Widget? trailing}) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 1),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: _brand, size: 20),
      ),
      title: Text(title, style: const TextStyle(color: _ink, fontSize: 12, fontWeight: FontWeight.w800)),
      subtitle: Text(subtitle, style: const TextStyle(color: _muted, fontSize: 10.5)),
      trailing: trailing,
    );
  }

  Widget _futureTile(IconData icon, String title, String status) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 1),
      leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: const Color(0xFFF1F3F2), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: _muted)),
      title: Text(title, style: const TextStyle(color: _ink, fontSize: 12, fontWeight: FontWeight.w800)),
      subtitle: Text(status, style: const TextStyle(color: Color(0xFFB97822), fontSize: 10)),
      trailing: const Icon(Icons.lock_outline_rounded, color: _muted, size: 18),
    );
  }

  Widget _errorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, color: Color(0xFFB94A3D), size: 44),
            const SizedBox(height: 12),
            Text(error ?? 'تعذر تحميل الحساب.', textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _load, child: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(color: const Color(0xFFE8F5F0), borderRadius: BorderRadius.circular(20)),
      child: const Text('موثّق', style: TextStyle(color: _brand, fontSize: 9, fontWeight: FontWeight.w900)),
    );
  }
}
