import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../services/attendance_service.dart';

const _brand = Color(0xFF0B6B5A);
const _ink = Color(0xFF17322C);
const _muted = Color(0xFF70817B);
const _soft = Color(0xFFEAF4F0);
const _line = Color(0xFFD8E2DE);
const _danger = Color(0xFF9D3029);

class AttendancePage extends StatefulWidget {
  final String type;
  const AttendancePage({super.key, required this.type});
  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage> with WidgetsBindingObserver {
  final _session = HadirSession();
  final _qr = TextEditingController();
  final _scanner = MobileScannerController();
  AttendanceService? _service;
  AttendanceChallenge? _challenge;
  Timer? _timer;
  Map<String, dynamic>? _place;
  bool _loading = true;
  bool _locating = false;
  bool _scanning = false;
  bool _checking = false;
  bool _submitting = false;
  bool _deviceBound = false;
  bool _deviceStatusKnown = false;
  bool _success = false;
  double? _distance;
  double? _accuracy;
  int _remainingSeconds = 0;
  String? _error;
  AttendanceResult? _result;

  bool get _isCheckIn => widget.type == 'check-in';
  String get _title => _isCheckIn ? 'تسجيل الحضور' : 'تسجيل الانصراف';
  bool get _inRange => _distance != null && _place != null && _distance! <= _radius;
  double get _radius => double.tryParse('${_place?['radiusMeters']}') ?? 0;
  bool get _challengeActive => _challenge != null && _remainingSeconds > 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _qr.dispose();
    _scanner.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && _scanning) _stopScanner();
  }

  Future<void> _init() async {
    try {
      final token = await _session.token();
      if (token == null || token.isEmpty) throw Exception('انتهت الجلسة. سجّل الدخول مرة أخرى.');
      final api = HadirApi(token: token);
      final service = AttendanceService(api, _session);
      final results = await Future.wait([service.workplace(), api.employeeDeviceStatus()]);
      if (!mounted) return;
      final place = Map<String, dynamic>.from(results[0] as Map);
      final device = Map<String, dynamic>.from(results[1] as Map);
      setState(() {
        _service = service;
        _place = place;
        _deviceBound = device['bound'] == true;
        _deviceStatusKnown = true;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = HadirApi.errorMessage(e); });
    }
  }

  Future<void> _refreshLocation() async {
    final service = _service;
    if (service == null) return;
    _stopScanner();
    _clearChallenge();
    setState(() { _locating = true; _error = null; });
    try {
      final place = _place ?? await service.workplace();
      final lat = double.tryParse('${place['lat']}');
      final lng = double.tryParse('${place['lng']}');
      final radius = double.tryParse('${place['radiusMeters']}');
      if (lat == null || lng == null || radius == null || radius <= 0) throw Exception('بيانات موقع العمل غير صالحة.');
      final position = await service.currentPosition();
      final distance = service.distanceMeters(position.latitude, position.longitude, lat, lng);
      if (!mounted) return;
      setState(() {
        _place = place;
        _distance = distance;
        _accuracy = position.accuracy;
        _locating = false;
        if (distance > radius) _error = 'أنت خارج نطاق العمل. المسافة الحالية ${distance.toStringAsFixed(1)} م، والحد ${radius.toStringAsFixed(0)} م.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _locating = false; _error = HadirApi.errorMessage(e); });
    }
  }

  void _startScanner() {
    if (!_inRange || _submitting || _checking) return;
    setState(() { _scanning = true; _error = null; });
    _scanner.start();
  }

  void _stopScanner() {
    if (_scanning) _scanner.stop();
    if (mounted && _scanning) setState(() => _scanning = false);
  }

  void _onBarcode(BarcodeCapture capture) {
    if (!_scanning || _checking || _challengeActive) return;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value == null || value.isEmpty) continue;
      _qr.text = value;
      _stopScanner();
      _prepareChallenge();
      return;
    }
  }

  void _onQrChanged(String value) {
    if (_challenge != null) _clearChallenge();
    if (_error != null && value.trim().isNotEmpty) setState(() => _error = null);
  }

  Future<void> _prepareChallenge() async {
    final service = _service;
    final code = _qr.text.trim();
    if (service == null || code.isEmpty || !_inRange || _checking || _submitting) return;
    setState(() { _checking = true; _error = null; });
    try {
      final challenge = await service.prepareChallenge(type: widget.type, qrCode: code);
      if (!mounted) return;
      final seconds = challenge.expiresAt.difference(DateTime.now().toUtc()).inSeconds.clamp(1, 60).toInt();
      setState(() {
        _challenge = challenge;
        _remainingSeconds = seconds;
        _checking = false;
        _distance = challenge.distance;
        _accuracy = challenge.accuracyMeters;
      });
      _startTimer(challenge.expiresAt);
    } catch (e) {
      if (!mounted) return;
      setState(() { _checking = false; _error = HadirApi.errorMessage(e); });
    }
  }

  void _startTimer(DateTime expiresAt) {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      final seconds = ((expiresAt.difference(DateTime.now().toUtc()).inMilliseconds + 999) ~/ 1000).clamp(0, 60).toInt();
      if (!mounted) return;
      if (seconds <= 0) {
        _timer?.cancel();
        setState(() {
          _challenge = null;
          _remainingSeconds = 0;
          _error = 'انتهت مهلة التحقق. أعد مسح رمز QR ثم أكّد العملية مرة أخرى.';
        });
      } else {
        setState(() => _remainingSeconds = seconds);
      }
    });
  }

  void _clearChallenge() {
    _timer?.cancel();
    _timer = null;
    if (_challenge != null || _remainingSeconds != 0) {
      if (mounted) setState(() { _challenge = null; _remainingSeconds = 0; });
    }
  }

  Future<void> _submit() async {
    final service = _service;
    final challenge = _challenge;
    final code = _qr.text.trim();
    if (service == null || challenge == null || code.isEmpty || _remainingSeconds <= 0 || _submitting) return;
    setState(() { _submitting = true; _error = null; });
    try {
      final result = await service.completeChallenge(type: widget.type, qrCode: code, challenge: challenge);
      if (!mounted) return;
      _timer?.cancel();
      setState(() { _submitting = false; _success = true; _result = result; _challenge = null; _remainingSeconds = 0; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _submitting = false; _error = HadirApi.errorMessage(e); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9F8),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7F9F8),
        title: Text(_title, style: const TextStyle(fontWeight: FontWeight.w800, color: _ink)),
        leading: IconButton(onPressed: _submitting ? null : () => context.pop(), icon: const Icon(Icons.arrow_back_rounded, color: _ink)),
      ),
      body: _loading ? const Center(child: CircularProgressIndicator()) : _success ? _successView() : RefreshIndicator(
        onRefresh: _refreshLocation,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 30),
          children: [
            _headerCard(),
            const SizedBox(height: 14),
            _steps(),
            const SizedBox(height: 14),
            _locationCard(),
            const SizedBox(height: 12),
            _deviceCard(),
            const SizedBox(height: 12),
            _qrCard(),
            if (_error != null) ...[const SizedBox(height: 12), _errorCard(_error!)],
            const SizedBox(height: 14),
            _actionArea(),
          ],
        ),
      ),
    );
  }

  Widget _headerCard() => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_brand, Color(0xFF084F44)]),
      borderRadius: BorderRadius.circular(26),
      boxShadow: const [BoxShadow(blurRadius: 24, offset: Offset(0, 12), color: Color(0x220B6B5A))],
    ),
    child: Row(children: [
      Container(width: 54, height: 54, decoration: BoxDecoration(color: Colors.white.withValues(alpha: .14), borderRadius: BorderRadius.circular(17)), child: Icon(_isCheckIn ? Icons.login_rounded : Icons.logout_rounded, color: Colors.white, size: 28)),
      const SizedBox(width: 13),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_isCheckIn ? 'حضور آمن' : 'انصراف آمن', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        const Text('يتم اعتماد العملية بعد التحقق من GPS والجهاز ورمز QR.', style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.4)),
      ])),
    ]),
  );

  Widget _steps() {
    final current = _challengeActive ? 3 : _inRange ? (_qr.text.trim().isNotEmpty ? 2 : 1) : 0;
    const labels = ['الموقع', 'الجهاز', 'QR', 'اعتماد'];
    const icons = [Icons.location_on_outlined, Icons.phone_android_rounded, Icons.qr_code_rounded, Icons.verified_rounded];
    return Row(children: [
      for (var i = 0; i < labels.length; i++) ...[
        Expanded(child: Column(children: [
          Container(width: 34, height: 34, decoration: BoxDecoration(color: current >= i ? _brand : Colors.white, shape: BoxShape.circle, border: Border.all(color: current >= i ? _brand : _line)), child: Icon(icons[i], size: 17, color: current >= i ? Colors.white : _muted)),
          const SizedBox(height: 5),
          Text(labels[i], style: TextStyle(fontSize: 10, color: current >= i ? _brand : _muted, fontWeight: FontWeight.w700)),
        ])),
        if (i < labels.length - 1) Expanded(child: Container(height: 2, color: current > i ? _brand : _line)),
      ],
    ]);
  }

  Widget _locationCard() {
    final placeName = '${_place?['name'] ?? 'موقع العمل'}';
    final rangeText = _radius > 0 ? '${_radius.toStringAsFixed(0)} م' : 'غير معروف';
    final verified = _inRange;
    return _panel(icon: Icons.location_on_outlined, title: 'موقعك الحالي', subtitle: placeName, trailing: verified ? _statusPill('داخل النطاق', _brand, _soft) : _statusPill('بانتظار التحقق', _muted, const Color(0xFFF1F4F2)), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 13),
      Row(children: [Expanded(child: _metric('المسافة', _distance == null ? '—' : '${_distance!.toStringAsFixed(1)} م')), const SizedBox(width: 10), Expanded(child: _metric('الدقة', _accuracy == null ? '—' : '±${_accuracy!.toStringAsFixed(1)} م')), const SizedBox(width: 10), Expanded(child: _metric('النطاق', rangeText))]),
      const SizedBox(height: 12),
      OutlinedButton.icon(onPressed: _locating || _checking || _submitting ? null : _refreshLocation, icon: _locating ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.my_location_rounded), label: Text(_locating ? 'جاري تحديد موقعك...' : verified ? 'تحديث الموقع' : 'تحديد موقعي')),
    ]));
  }

  Widget _deviceCard() {
    final ok = _deviceStatusKnown && _deviceBound;
    return _panel(icon: Icons.phone_android_rounded, title: 'الجهاز الموثّق', subtitle: ok ? 'هذا الهاتف مرتبط بحساب الموظف.' : 'يجب استخدام الجهاز المرتبط بالحساب.', trailing: _statusPill(ok ? 'موثّق' : 'غير موثّق', ok ? _brand : _danger, ok ? _soft : const Color(0xFFFFF1F0)));
  }

  Widget _qrCard() => _panel(
    icon: Icons.qr_code_scanner_rounded,
    title: 'رمز موقع العمل',
    subtitle: _inRange ? 'امسح الرمز الموجود داخل مقر العمل.' : 'تحقق من موقعك أولًا لفتح المسح.',
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 13),
      Container(
        height: _scanning ? 300 : 132,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: const Color(0xFF10201C), borderRadius: BorderRadius.circular(20)),
        child: _scanning ? Stack(fit: StackFit.expand, children: [
          MobileScanner(controller: _scanner, onDetect: _onBarcode),
          Center(child: Container(width: 245, height: 165, decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 3), borderRadius: BorderRadius.circular(22)))),
          const Positioned(bottom: 15, left: 0, right: 0, child: Text('وجّه الكاميرا نحو رمز QR', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
          Positioned(top: 12, right: 12, child: IconButton.filledTonal(onPressed: _stopScanner, icon: const Icon(Icons.close_rounded))),
        ]) : Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.qr_code_2_rounded, color: Colors.white70, size: 42),
          const SizedBox(height: 6),
          FilledButton.icon(onPressed: _inRange && !_checking && !_submitting ? _startScanner : null, icon: const Icon(Icons.camera_alt_rounded), label: const Text('فتح الكاميرا')),
        ])),
      ),
      const SizedBox(height: 12),
      TextField(controller: _qr, enabled: !_submitting && !_challengeActive, onChanged: _onQrChanged, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'أو أدخل الرمز يدويًا', prefixIcon: Icon(Icons.key_outlined))),
      if (_challengeActive) ...[
        const SizedBox(height: 10),
        Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(16), border: Border.all(color: _brand.withValues(alpha: .25))), child: Row(children: [const Icon(Icons.timer_outlined, color: _brand), const SizedBox(width: 9), const Expanded(child: Text('مهلة اعتماد العملية', style: TextStyle(fontWeight: FontWeight.w700, color: _ink))), Text('00:${_remainingSeconds.toString().padLeft(2, '0')}', style: const TextStyle(fontWeight: FontWeight.w900, color: _brand, fontSize: 18))])),
      ],
    ]),
  );

  Widget _actionArea() {
    if (_challengeActive) return FilledButton.icon(onPressed: _submitting ? null : _submit, icon: _submitting ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.verified_rounded), label: Text(_submitting ? 'جارٍ اعتماد العملية...' : 'تأكيد ${_isCheckIn ? 'تسجيل الحضور' : 'تسجيل الانصراف'}'));
    return FilledButton.icon(onPressed: _checking || _submitting || !_inRange || _qr.text.trim().isEmpty ? null : _prepareChallenge, icon: _checking ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.security_rounded), label: Text(_checking ? 'جارٍ التحقق...' : 'تحقق واستمر'));
  }

  Widget _successView() {
    final result = _result;
    return Center(child: SingleChildScrollView(padding: const EdgeInsets.all(22), child: Container(padding: const EdgeInsets.all(24), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), border: Border.all(color: _line)), child: Column(children: [
      Container(width: 78, height: 78, decoration: const BoxDecoration(color: _soft, shape: BoxShape.circle), child: const Icon(Icons.verified_rounded, color: _brand, size: 44)),
      const SizedBox(height: 18),
      const Text('تم التسجيل بنجاح', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w900, color: _ink)),
      const SizedBox(height: 7),
      Text(_isCheckIn ? 'تم اعتماد حضورك لهذا اليوم.' : 'تم اعتماد انصرافك وإنهاء جلسة الدوام.', textAlign: TextAlign.center, style: const TextStyle(color: _muted, height: 1.5)),
      const SizedBox(height: 20),
      Row(children: [Expanded(child: _metric('الوقت', result == null ? '—' : intl.DateFormat('HH:mm').format(result.time))), const SizedBox(width: 10), Expanded(child: _metric('المسافة', result == null ? '—' : '${result.distance.toStringAsFixed(1)} م')), const SizedBox(width: 10), Expanded(child: _metric('الدقة', result == null ? '—' : '±${result.accuracyMeters.toStringAsFixed(1)} م'))]),
      const SizedBox(height: 20),
      SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: () => context.go('/home'), icon: const Icon(Icons.home_rounded), label: const Text('العودة للرئيسية')),
    ])));
  }

  Widget _panel({required IconData icon, required String title, required String subtitle, Widget? trailing, Widget? child}) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(21), border: Border.all(color: _line)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [Container(width: 42, height: 42, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(13)), child: Icon(icon, color: _brand, size: 21)), const SizedBox(width: 11), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: _ink)), const SizedBox(height: 2), Text(subtitle, style: const TextStyle(fontSize: 11, color: _muted))])), if (trailing != null) trailing]),
      if (child != null) child,
    ]),
  );

  Widget _metric(String label, String value) => Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10), decoration: BoxDecoration(color: const Color(0xFFF7F9F8), borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 9, color: _muted)), const SizedBox(height: 3), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: _ink))]));

  Widget _statusPill(String text, Color foreground, Color background) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6), decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(30)), child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: foreground)));

  Widget _errorCard(String message) => Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xFFFFF1F0), borderRadius: BorderRadius.circular(17), border: Border.all(color: const Color(0xFFF0C8C4))), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.error_outline_rounded, color: _danger), const SizedBox(width: 9), Expanded(child: Text(message, style: const TextStyle(color: _danger, fontSize: 12, height: 1.45)))]));
}
