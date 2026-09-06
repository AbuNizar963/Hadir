import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' as intl;
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../services/attendance_service.dart';

const _brand = Color(0xFF0B6B5A);
const _brandDark = Color(0xFF064B40);
const _brandSoft = Color(0xFFE8F5F0);
const _canvas = Color(0xFFF5F8F7);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF72827D);
const _line = Color(0xFFDCE6E2);
const _danger = Color(0xFFB33A32);
const _warning = Color(0xFF9A6A18);

class AttendancePage extends StatefulWidget {
  final String type;

  const AttendancePage({super.key, required this.type});

  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage>
    with WidgetsBindingObserver {
  final _session = HadirSession();
  final _qr = TextEditingController();
  final _scanner = MobileScannerController();

  AttendanceService? _service;
  AttendanceChallenge? _challenge;
  AttendanceResult? _result;
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

  bool get _isCheckIn => widget.type == 'check-in';
  String get _title => _isCheckIn ? 'تسجيل الحضور' : 'تسجيل الانصراف';
  String get _actionLabel => _isCheckIn ? 'الحضور' : 'الانصراف';
  double get _radius => double.tryParse('${_place?['radiusMeters']}') ?? 0;
  bool get _inRange =>
      _distance != null && _place != null && _radius > 0 && _distance! <= _radius;
  bool get _challengeActive => _challenge != null && _remainingSeconds > 0;
  bool get _hasQr => _qr.text.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _qr.addListener(_onQrTextChanged);
    _init();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _qr.removeListener(_onQrTextChanged);
    _qr.dispose();
    _scanner.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && _scanning) {
      _stopScanner();
    }
  }

  void _onQrTextChanged() {
    if (!mounted) return;
    setState(() {
      if (_challenge != null) {
        _timer?.cancel();
        _timer = null;
        _challenge = null;
        _remainingSeconds = 0;
      }
      if (_error != null && _hasQr) _error = null;
    });
  }

  Future<void> _init() async {
    try {
      final token = await _session.token();
      if (token == null || token.isEmpty) {
        throw Exception('انتهت الجلسة. سجّل الدخول مرة أخرى.');
      }

      final api = HadirApi(token: token);
      final service = AttendanceService(api, _session);
      final results =
          await Future.wait([service.workplace(), api.employeeDeviceStatus()]);

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
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  Future<void> _refreshLocation() async {
    final service = _service;
    if (service == null) return;

    _stopScanner();
    _clearChallenge();

    setState(() {
      _locating = true;
      _error = null;
    });

    try {
      final place = _place ?? await service.workplace();
      final lat = double.tryParse('${place['lat']}');
      final lng = double.tryParse('${place['lng']}');
      final radius = double.tryParse('${place['radiusMeters']}');

      if (lat == null || lng == null || radius == null || radius <= 0) {
        throw Exception('بيانات موقع العمل غير صالحة.');
      }

      final position = await service.currentPosition();
      final distance = service.distanceMeters(
        position.latitude,
        position.longitude,
        lat,
        lng,
      );

      if (!mounted) return;

      setState(() {
        _place = place;
        _distance = distance;
        _accuracy = position.accuracy;
        _locating = false;
        if (distance > radius) {
          _error =
              'أنت خارج نطاق العمل. المسافة الحالية ${distance.toStringAsFixed(1)} م، والحد ${radius.toStringAsFixed(0)} م.';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _locating = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  void _startScanner() {
    if (!_inRange || _submitting || _checking) return;
    setState(() {
      _scanning = true;
      _error = null;
    });
    _scanner.start();
  }

  void _stopScanner() {
    if (_scanning) _scanner.stop();
    if (mounted && _scanning) {
      setState(() => _scanning = false);
    }
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

  Future<void> _prepareChallenge() async {
    final service = _service;
    final code = _qr.text.trim();

    if (service == null ||
        code.isEmpty ||
        !_inRange ||
        _checking ||
        _submitting) {
      return;
    }

    setState(() {
      _checking = true;
      _error = null;
    });

    try {
      final challenge = await service.prepareChallenge(
        type: widget.type,
        qrCode: code,
      );

      if (!mounted) return;

      final seconds = challenge.expiresAt
          .difference(DateTime.now().toUtc())
          .inSeconds
          .clamp(1, 60)
          .toInt();

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
      setState(() {
        _checking = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  void _startTimer(DateTime expiresAt) {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      final seconds = ((expiresAt
                      .difference(DateTime.now().toUtc())
                      .inMilliseconds +
                  999) ~/
              1000)
          .clamp(0, 60)
          .toInt();

      if (!mounted) return;

      if (seconds <= 0) {
        _timer?.cancel();
        setState(() {
          _challenge = null;
          _remainingSeconds = 0;
          _error =
              'انتهت مهلة التحقق. أعد مسح رمز QR ثم أكّد العملية مرة أخرى.';
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
      if (mounted) {
        setState(() {
          _challenge = null;
          _remainingSeconds = 0;
        });
      }
    }
  }

  Future<void> _submit() async {
    final service = _service;
    final challenge = _challenge;
    final code = _qr.text.trim();

    if (service == null ||
        challenge == null ||
        code.isEmpty ||
        _remainingSeconds <= 0 ||
        _submitting) {
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final result = await service.completeChallenge(
        type: widget.type,
        qrCode: code,
        challenge: challenge,
      );

      if (!mounted) return;

      _timer?.cancel();
      setState(() {
        _submitting = false;
        _success = true;
        _result = result;
        _challenge = null;
        _remainingSeconds = 0;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: _canvas,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Theme(
          data: Theme.of(context).copyWith(
            scaffoldBackgroundColor: _canvas,
            colorScheme: Theme.of(context).colorScheme.copyWith(
                  primary: _brand,
                  surface: Colors.white,
                ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: const Color(0xFFF8FAF9),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(17),
                borderSide: const BorderSide(color: _line),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(17),
                borderSide: const BorderSide(color: _line),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(17),
                borderSide: const BorderSide(color: _brand, width: 1.4),
              ),
              labelStyle: const TextStyle(color: _muted, fontSize: 13),
              prefixIconColor: _muted,
            ),
            filledButtonTheme: FilledButtonThemeData(
              style: FilledButton.styleFrom(
                backgroundColor: _brand,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(17),
                ),
                textStyle: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            outlinedButtonTheme: OutlinedButtonThemeData(
              style: OutlinedButton.styleFrom(
                foregroundColor: _brand,
                minimumSize: const Size.fromHeight(48),
                side: const BorderSide(color: _line),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
                textStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          child: Scaffold(
            body: _loading
                ? _loadingView()
                : _success
                    ? _successView()
                    : _mainView(),
          ),
        ),
      ),
    );
  }

  Widget _loadingView() {
    return SafeArea(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
        children: [
          _topBar(),
          const SizedBox(height: 16),
          _skeleton(height: 170, radius: 28),
          const SizedBox(height: 16),
          _skeleton(height: 86, radius: 22),
          const SizedBox(height: 14),
          _skeleton(height: 165, radius: 22),
          const SizedBox(height: 14),
          _skeleton(height: 125, radius: 22),
          const SizedBox(height: 14),
          _skeleton(height: 300, radius: 22),
        ],
      ),
    );
  }

  Widget _mainView() {
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        color: _brand,
        onRefresh: _refreshLocation,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 34),
          children: [
            _topBar(),
            const SizedBox(height: 14),
            _heroCard(),
            const SizedBox(height: 14),
            _progressCard(),
            const SizedBox(height: 12),
            _locationCard(),
            const SizedBox(height: 12),
            _deviceCard(),
            const SizedBox(height: 12),
            _qrCard(),
            if (_error != null) ...[
              const SizedBox(height: 12),
              _errorCard(_error!),
            ],
            const SizedBox(height: 14),
            _actionArea(),
            const SizedBox(height: 10),
            _securityNote(),
          ],
        ),
      ),
    );
  }

  Widget _topBar() {
    return Row(
      children: [
        Material(
          color: Colors.white,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: _submitting ? null : () => context.pop(),
            child: const SizedBox(
              width: 44,
              height: 44,
              child: Icon(Icons.arrow_forward_rounded, color: _ink, size: 21),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _title,
                style: const TextStyle(
                  color: _ink,
                  fontSize: 21,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -.3,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                _isCheckIn ? 'ابدأ يوم عملك بثقة' : 'أنه يوم عملك بشكل آمن',
                style: const TextStyle(color: _muted, fontSize: 11.5),
              ),
            ],
          ),
        ),
        _miniDateBadge(),
      ],
    );
  }

  Widget _miniDateBadge() {
    final now = DateTime.now();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _line),
      ),
      child: Column(
        children: [
          Text(
            intl.DateFormat('dd').format(now),
            style: const TextStyle(
              color: _brand,
              fontSize: 16,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            intl.DateFormat('MMM', 'ar').format(now),
            style: const TextStyle(
              color: _muted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [_brand, _brandDark],
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x240B6B5A),
            blurRadius: 28,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            left: -42,
            bottom: -55,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: .08),
                  width: 22,
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(17),
                    ),
                    child: Icon(
                      _isCheckIn ? Icons.login_rounded : Icons.logout_rounded,
                      color: Colors.white,
                      size: 27,
                    ),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isCheckIn ? 'حضور آمن' : 'انصراف آمن',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 21,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _isCheckIn
                              ? 'سجّل حضورك من موقع العمل بسهولة.'
                              : 'سجّل انصرافك وأغلق جلسة الدوام.',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 11.5,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _heroStatus(),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .10),
                  borderRadius: BorderRadius.circular(17),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: .08),
                  ),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.shield_outlined, color: Colors.white, size: 19),
                    SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        'العملية محمية بالتحقق من الموقع والجهاز ورمز QR.',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          height: 1.35,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.arrow_back_ios_new_rounded,
                      color: Colors.white54,
                      size: 12,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStatus() {
    final ready = _challengeActive;
    final inside = _inRange;
    final text = ready ? 'جاهز' : inside ? 'موقعك سليم' : 'يلزم الموقع';
    final icon = ready
        ? Icons.verified_rounded
        : inside
            ? Icons.check_circle_outline_rounded
            : Icons.location_off_outlined;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 14),
          const SizedBox(width: 5),
          Text(
            text,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 9.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _progressCard() {
    final current = _challengeActive
        ? 3
        : _hasQr
            ? 2
            : _inRange
                ? 1
                : 0;
    const labels = ['الموقع', 'الجهاز', 'QR', 'اعتماد'];
    const icons = [
      Icons.location_on_outlined,
      Icons.phone_android_rounded,
      Icons.qr_code_rounded,
      Icons.verified_rounded,
    ];

    return _surface(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 12),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            Expanded(
              child: Column(
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    width: 35,
                    height: 35,
                    decoration: BoxDecoration(
                      color: current >= i ? _brand : const Color(0xFFF7FAF8),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: current >= i ? _brand : _line,
                      ),
                    ),
                    child: Icon(
                      icons[i],
                      size: 17,
                      color: current >= i ? Colors.white : _muted,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    labels[i],
                    style: TextStyle(
                      fontSize: 9.5,
                      color: current >= i ? _brand : _muted,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            if (i < labels.length - 1)
              Expanded(
                child: Container(
                  height: 2,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: current > i ? _brand : _line,
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _locationCard() {
    final placeName = '${_place?['name'] ?? 'موقع العمل'}';
    final rangeText = _radius > 0 ? '${_radius.toStringAsFixed(0)} م' : '—';
    final verified = _inRange;
    final progress = _radius > 0 && _distance != null
        ? (_distance! / _radius).clamp(0.0, 1.0)
        : 0.0;

    return _sectionCard(
      icon: Icons.location_on_outlined,
      title: 'موقعك الحالي',
      subtitle: placeName,
      trailing: _statusPill(
        verified ? 'داخل النطاق' : 'بانتظار التحقق',
        verified ? _brand : _muted,
        verified ? _brandSoft : const Color(0xFFF2F5F4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 15),
          Row(
            children: [
              Expanded(
                child: _statTile(
                  Icons.social_distance_rounded,
                  'المسافة',
                  _distance == null
                      ? '—'
                      : '${_distance!.toStringAsFixed(1)} م',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _statTile(
                  Icons.gps_fixed_rounded,
                  'الدقة',
                  _accuracy == null
                      ? '—'
                      : '±${_accuracy!.toStringAsFixed(1)} م',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _statTile(
                  Icons.radar_rounded,
                  'النطاق',
                  rangeText,
                ),
              ),
            ],
          ),
          if (_distance != null) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                const Text(
                  'قربك من موقع العمل',
                  style: TextStyle(
                    color: _muted,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                Text(
                  verified ? 'مسموح' : 'خارج النطاق',
                  style: TextStyle(
                    color: verified ? _brand : _danger,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 7),
            ClipRRect(
              borderRadius: BorderRadius.circular(30),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 7,
                backgroundColor: const Color(0xFFEAF0ED),
                color: verified ? _brand : _danger,
              ),
            ),
          ],
          const SizedBox(height: 13),
          OutlinedButton.icon(
            onPressed: _locating || _checking || _submitting
                ? null
                : _refreshLocation,
            icon: _locating
                ? const SizedBox.square(
                    dimension: 17,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.my_location_rounded, size: 19),
            label: Text(
              _locating
                  ? 'جاري تحديد موقعك...'
                  : verified
                      ? 'تحديث الموقع'
                      : 'تحديد موقعي',
            ),
          ),
        ],
      ),
    );
  }

  Widget _deviceCard() {
    final ok = _deviceStatusKnown && _deviceBound;
    return _sectionCard(
      icon: Icons.phone_android_rounded,
      title: 'الجهاز الموثّق',
      subtitle: ok
          ? 'الهاتف الحالي مرتبط بحساب الموظف.'
          : 'يجب استخدام الجهاز المرتبط بالحساب.',
      trailing: _statusPill(
        ok ? 'موثّق' : 'غير موثّق',
        ok ? _brand : _danger,
        ok ? _brandSoft : const Color(0xFFFFF1F0),
      ),
      child: Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: ok ? const Color(0xFFF7FBF9) : const Color(0xFFFFF8F7),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: ok ? const Color(0xFFDCEDE7) : const Color(0xFFF2D8D4),
          ),
        ),
        child: Row(
          children: [
            Icon(
              ok ? Icons.verified_user_rounded : Icons.phonelink_erase_rounded,
              color: ok ? _brand : _danger,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                ok
                    ? 'تم التحقق من ارتباط الجهاز قبل اعتماد العملية.'
                    : 'تحقق من ربط هذا الجهاز بحسابك قبل المتابعة.',
                style: TextStyle(
                  color: ok ? _ink : _danger,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  height: 1.45,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _qrCard() {
    return _sectionCard(
      icon: Icons.qr_code_scanner_rounded,
      title: 'رمز موقع العمل',
      subtitle: _inRange
          ? 'امسح الرمز الموجود داخل مقر العمل.'
          : 'تحقق من موقعك أولًا لفتح المسح.',
      trailing: _challengeActive
          ? _statusPill('تم التحقق', _brand, _brandSoft)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 14),
          AnimatedContainer(
            duration: const Duration(milliseconds: 260),
            height: _scanning ? 315 : 158,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: const Color(0xFF0D1E1A),
              borderRadius: BorderRadius.circular(21),
              border: Border.all(color: const Color(0xFF1C3730)),
            ),
            child: _scanning ? _scannerView() : _scannerPlaceholder(),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _qr,
            enabled: !_submitting && !_challengeActive,
            textDirection: TextDirection.ltr,
            keyboardType: TextInputType.text,
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              labelText: 'أو أدخل الرمز يدويًا',
              hintText: 'أدخل رمز الموقع',
              prefixIcon: Icon(Icons.key_outlined),
            ),
          ),
          if (_challengeActive) ...[
            const SizedBox(height: 11),
            _challengeBanner(),
          ],
        ],
      ),
    );
  }

  Widget _scannerView() {
    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(controller: _scanner, onDetect: _onBarcode),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: .16),
                  Colors.transparent,
                  Colors.black.withValues(alpha: .26),
                ],
              ),
            ),
          ),
        ),
        Center(
          child: Container(
            width: 244,
            height: 166,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white, width: 2.5),
              borderRadius: BorderRadius.circular(23),
              boxShadow: const [
                BoxShadow(color: Colors.black38, blurRadius: 18),
              ],
            ),
            child: Stack(
              children: [
                Positioned(
                  top: -2,
                  left: 35,
                  right: 35,
                  child: Container(height: 3, color: _brand),
                ),
              ],
            ),
          ),
        ),
        Positioned(
          top: 12,
          right: 12,
          child: Material(
            color: Colors.black45,
            shape: const CircleBorder(),
            child: IconButton(
              onPressed: _stopScanner,
              icon: const Icon(Icons.close_rounded, color: Colors.white),
              tooltip: 'إغلاق الكاميرا',
            ),
          ),
        ),
        const Positioned(
          bottom: 14,
          left: 0,
          right: 0,
          child: Text(
            'وجّه الكاميرا نحو رمز QR',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }

  Widget _scannerPlaceholder() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .08),
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Icon(
              Icons.qr_code_2_rounded,
              color: Colors.white70,
              size: 30,
            ),
          ),
          const SizedBox(height: 9),
          const Text(
            'امسح رمز موقع العمل',
            style: TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 9),
          SizedBox(
            height: 38,
            child: FilledButton.icon(
              onPressed: _inRange && !_checking && !_submitting
                  ? _startScanner
                  : null,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: _ink,
                minimumSize: Size.zero,
                padding: const EdgeInsets.symmetric(horizontal: 13),
              ),
              icon: const Icon(Icons.camera_alt_rounded, size: 16),
              label: const Text('فتح الكاميرا'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _challengeBanner() {
    final urgent = _remainingSeconds <= 10;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: urgent ? const Color(0xFFFFF5E8) : _brandSoft,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: urgent ? const Color(0xFFF1D5A6) : const Color(0xFFCBE5DC),
        ),
      ),
      child: Row(
        children: [
          Icon(
            urgent ? Icons.timer_outlined : Icons.lock_clock_outlined,
            color: urgent ? _warning : _brand,
            size: 20,
          ),
          const SizedBox(width: 9),
          const Expanded(
            child: Text(
              'رمز التحقق صالح لفترة محدودة',
              style: TextStyle(
                color: _ink,
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Text(
            '00:${_remainingSeconds.toString().padLeft(2, '0')}',
            style: TextStyle(
              color: urgent ? _warning : _brand,
              fontSize: 18,
              fontWeight: FontWeight.w900,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionArea() {
    final enabled = _challengeActive;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!enabled && !_checking)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Icon(
                  _inRange && _hasQr
                      ? Icons.check_circle_outline_rounded
                      : Icons.info_outline_rounded,
                  size: 15,
                  color: _inRange && _hasQr ? _brand : _muted,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _inRange && _hasQr
                        ? 'كل المتطلبات الأساسية جاهزة للتحقق.'
                        : 'حدّد موقعك ثم أدخل رمز QR للمتابعة.',
                    style: const TextStyle(
                      color: _muted,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (_checking)
          FilledButton.icon(
            onPressed: null,
            icon: const SizedBox.square(
              dimension: 19,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            ),
            label: const Text('جارٍ التحقق الآمن...'),
          )
        else if (enabled)
          FilledButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: _submitting
                ? const SizedBox.square(
                    dimension: 19,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.verified_rounded, size: 20),
            label: Text(
              _submitting
                  ? 'جارٍ اعتماد العملية...'
                  : 'تأكيد تسجيل $_actionLabel',
            ),
          )
        else
          FilledButton.icon(
            onPressed: _inRange && _hasQr && !_submitting
                ? _prepareChallenge
                : null,
            icon: const Icon(Icons.shield_outlined, size: 20),
            label: const Text('تحقق واستمر'),
          ),
      ],
    );
  }

  Widget _securityNote() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .72),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_outline_rounded, color: _muted, size: 16),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'يتم اعتماد التسجيل من الخادم بعد التحقق من جميع الشروط.',
              style: TextStyle(
                color: _muted,
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                height: 1.4,
              ),
            ),
          ),
          Icon(
            Icons.verified_user_outlined,
            color: _brand.withValues(alpha: .7),
            size: 16,
          ),
        ],
      ),
    );
  }

  Widget _successView() {
    final result = _result;
    final time = result == null ? '—' : intl.DateFormat('HH:mm').format(result.time);

    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(22, 28, 22, 22),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(30),
              border: Border.all(color: _line),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x120B6B5A),
                  blurRadius: 28,
                  offset: Offset(0, 15),
                ),
              ],
            ),
            child: Column(
              children: [
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    color: _brandSoft,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFD2EAE2),
                      width: 7,
                    ),
                  ),
                  child: const Icon(
                    Icons.verified_rounded,
                    color: _brand,
                    size: 45,
                  ),
                ),
                const SizedBox(height: 19),
                const Text(
                  'تم التسجيل بنجاح',
                  style: TextStyle(
                    color: _ink,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -.5,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  _isCheckIn
                      ? 'تم اعتماد حضورك لهذا اليوم.'
                      : 'تم اعتماد انصرافك وإنهاء جلسة الدوام.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: _muted,
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      child: _resultTile('الوقت', time, Icons.schedule_rounded),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _resultTile(
                        'المسافة',
                        result == null
                            ? '—'
                            : '${result.distance.toStringAsFixed(1)} م',
                        Icons.social_distance_rounded,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _resultTile(
                        'الدقة',
                        result == null
                            ? '—'
                            : '±${result.accuracyMeters.toStringAsFixed(1)} م',
                        Icons.gps_fixed_rounded,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 13,
                    vertical: 11,
                  ),
                  decoration: BoxDecoration(
                    color: _brandSoft,
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.shield_rounded, color: _brand, size: 17),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'تم اعتماد العملية من نظام الحضور.',
                          style: TextStyle(
                            color: _brandDark,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 15),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.go('/home'),
                    icon: const Icon(Icons.home_rounded),
                    label: const Text('العودة للرئيسية'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _sectionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? trailing,
    Widget? child,
  }) {
    return _surface(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 43,
                height: 43,
                decoration: BoxDecoration(
                  color: _brandSoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: _brand, size: 21),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: _ink,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: _muted,
                        fontSize: 10.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 8),
                trailing,
              ],
            ],
          ),
          if (child != null) child,
        ],
      ),
    );
  }

  Widget _surface({required Widget child, EdgeInsets? padding}) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x07000000),
            blurRadius: 12,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _statTile(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAF8),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: const Color(0xFFE7EFEC)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: _brand, size: 15),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              color: _muted,
              fontSize: 8.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: _ink,
              fontSize: 11.5,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _resultTile(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAF8),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Column(
        children: [
          Icon(icon, color: _brand, size: 16),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              color: _muted,
              fontSize: 8.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: _ink,
              fontSize: 11.5,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusPill(String text, Color foreground, Color background) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(30),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: foreground,
          fontSize: 9,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  Widget _errorCard(String message) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3F2),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF0CFCC)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(0xFFFFE3E0),
              borderRadius: BorderRadius.circular(11),
            ),
            child: const Icon(
              Icons.error_outline_rounded,
              color: _danger,
              size: 19,
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: _danger,
                fontSize: 11,
                height: 1.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _skeleton({required double height, required double radius}) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFEAF0ED),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}
