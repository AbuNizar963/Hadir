import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _brandDark = Color(0xFF064B40);
const _soft = Color(0xFFE8F5F0);
const _canvas = Color(0xFFF5F8F7);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF72827D);
const _line = Color(0xFFDCE6E2);

class ServicesPage extends StatefulWidget {
  const ServicesPage({super.key});

  @override
  State<ServicesPage> createState() => _ServicesPageState();
}

class _ServicesPageState extends State<ServicesPage> {
  final _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 15),
    ),
  );
  final _session = HadirSession();
  final _question = TextEditingController();

  int _tab = 0;
  bool _loading = true;
  bool _aiBusy = false;
  String? _error;
  Map<String, dynamic> _weather = {};
  Map<String, dynamic> _prayer = {};
  double? _qibla;
  final List<String> _messages = [];

  @override
  void initState() {
    super.initState();
    _loadLocationServices();
  }

  @override
  void dispose() {
    _question.dispose();
    super.dispose();
  }

  Future<Position> _position() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception('فعّل خدمة الموقع أولًا.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      throw Exception('اسمح لتطبيق حاضر باستخدام الموقع.');
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
    );
  }

  Future<void> _loadLocationServices() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final position = await _position();
      final lat = position.latitude.toString();
      final lon = position.longitude.toString();

      final results = await Future.wait<Response<dynamic>>([
        _dio.get(
          'https://api.open-meteo.com/v1/forecast',
          queryParameters: {
            'latitude': lat,
            'longitude': lon,
            'current': 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,uv_index,pressure_msl,visibility',
            'daily': 'sunrise,sunset',
            'forecast_days': 2,
            'timezone': 'auto',
          },
        ),
        _dio.get(
          'https://api.aladhan.com/v1/timings',
          queryParameters: {'latitude': lat, 'longitude': lon, 'method': 4},
        ),
        _dio.get('https://api.aladhan.com/v1/qibla/$lat/$lon'),
      ]);

      final weatherData = Map<String, dynamic>.from(results[0].data as Map);
      final prayerData = Map<String, dynamic>.from(
        (results[1].data as Map)['data'] as Map,
      );
      final qiblaData = Map<String, dynamic>.from(
        (results[2].data as Map)['data'] as Map,
      );

      if (!mounted) return;
      setState(() {
        _weather = weatherData;
        _prayer = prayerData;
        _qibla = double.tryParse('${qiblaData['direction']}');
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _askAi() async {
    final text = _question.text.trim();
    if (text.isEmpty || _aiBusy) return;

    setState(() {
      _aiBusy = true;
      _messages.add('أنت: $text');
      _question.clear();
    });

    try {
      final token = await _session.adminToken() ?? await _session.token();
      final response = await _dio.post(
        'https://hadir-api.abunizar963.workers.dev/api/ai',
        data: {'question': text},
        options: Options(
          headers: token == null ? <String, dynamic>{} : {'Authorization': 'Bearer $token'},
        ),
      );
      final data = Map<String, dynamic>.from(response.data as Map);
      if (mounted) {
        setState(() {
          _messages.add('Hadir AI: ${data['text'] ?? 'تعذر الحصول على إجابة.'}');
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _messages.add('Hadir AI: تعذر الاتصال بالمساعد الآن، حاول مرة أخرى.');
        });
      }
    } finally {
      if (mounted) {
        setState(() => _aiBusy = false);
      }
    }
  }

  String _weatherText(int code) {
    if (code == 0) return 'صافي';
    if (code <= 3) return 'غائم جزئيًا';
    if (code <= 48) return 'ضباب';
    if (code <= 67) return 'أمطار';
    if (code <= 77) return 'ثلوج';
    if (code <= 82) return 'زخات مطر';
    if (code <= 86) return 'زخات ثلج';
    return 'عاصفة';
  }

  ThemeData _theme() {
    final scheme = ColorScheme.fromSeed(seedColor: _brand, brightness: Brightness.light);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme.copyWith(primary: _brand, onPrimary: Colors.white),
      scaffoldBackgroundColor: _canvas,
      appBarTheme: const AppBarTheme(
        backgroundColor: _canvas,
        foregroundColor: _ink,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: _line),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: _line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: _line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: _brand, width: 1.5),
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, String subtitle, IconData icon) {
    return Row(
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(15)),
          child: Icon(icon, color: _brand),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900, color: _ink)),
              const SizedBox(height: 3),
              Text(subtitle, style: const TextStyle(color: _muted, height: 1.4)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _weatherView() {
    final current = Map<String, dynamic>.from((_weather['current'] as Map?) ?? {});
    final daily = Map<String, dynamic>.from((_weather['daily'] as Map?) ?? {});
    final code = int.tryParse('${current['weather_code'] ?? 0}') ?? 0;
    final sunriseList = daily['sunrise'] as List?;
    final sunsetList = daily['sunset'] as List?;
    final sunrise = sunriseList != null && sunriseList.isNotEmpty ? '${sunriseList.first}'.split('T').last : '—';
    final sunset = sunsetList != null && sunsetList.isNotEmpty ? '${sunsetList.first}'.split('T').last : '—';

    return RefreshIndicator(
      onRefresh: _loadLocationServices,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 28),
        children: [
          _sectionHeader('الطقس', 'بيانات حية حسب موقعك الحالي.', Icons.cloud_outlined),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [_brandDark, _brand]),
              borderRadius: BorderRadius.circular(28),
              boxShadow: [BoxShadow(color: _brand.withValues(alpha: .16), blurRadius: 28, offset: const Offset(0, 12))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(child: Text('حالة الطقس الآن', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: .12), borderRadius: BorderRadius.circular(20)),
                      child: Text(_weatherText(code), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${current['temperature_2m'] ?? '—'}°', style: const TextStyle(color: Colors.white, fontSize: 54, height: .9, fontWeight: FontWeight.w900)),
                    const SizedBox(width: 10),
                    const Padding(padding: EdgeInsets.only(bottom: 4), child: Text('الآن', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700))),
                  ],
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _darkMetric('المحسوسة', '${current['apparent_temperature'] ?? '—'}°'),
                    _darkMetric('الرياح', '${current['wind_speed_10m'] ?? '—'} كم/س'),
                    _darkMetric('الرطوبة', '${current['relative_humidity_2m'] ?? '—'}%'),
                    _darkMetric('UV', '${current['uv_index'] ?? '—'}'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _infoCard(Icons.wb_sunny_outlined, 'الشروق', sunrise)),
              const SizedBox(width: 12),
              Expanded(child: _infoCard(Icons.nightlight_outlined, 'الغروب', sunset)),
            ],
          ),
          const SizedBox(height: 14),
          _infoCard(Icons.speed_rounded, 'الضغط الجوي', '${current['pressure_msl'] ?? '—'} hPa'),
        ],
      ),
    );
  }

  Widget _darkMetric(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: .11), borderRadius: BorderRadius.circular(15)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 10)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _infoCard(IconData icon, String title, String value) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(width: 42, height: 42, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: _brand)),
            const SizedBox(width: 11),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 11, color: _muted)), const SizedBox(height: 3), Text(value, style: const TextStyle(fontWeight: FontWeight.w900, color: _ink))])),
          ],
        ),
      ),
    );
  }

  Widget _prayerView() {
    final times = Map<String, dynamic>.from((_prayer['timings'] as Map?) ?? {});
    const names = <String, String>{'Fajr': 'الفجر', 'Sunrise': 'الشروق', 'Dhuhr': 'الظهر', 'Asr': 'العصر', 'Maghrib': 'المغرب', 'Isha': 'العشاء'};
    const icons = <String, IconData>{'Fajr': Icons.wb_twilight_rounded, 'Sunrise': Icons.wb_sunny_outlined, 'Dhuhr': Icons.wb_sunny_rounded, 'Asr': Icons.wb_sunny_rounded, 'Maghrib': Icons.wb_twilight_rounded, 'Isha': Icons.nightlight_round};

    return RefreshIndicator(
      onRefresh: _loadLocationServices,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 28),
        children: [
          _sectionHeader('مواقيت الصلاة', 'توقيت اليوم والقبلة حسب موقعك.', Icons.mosque_outlined),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: _brandDark, borderRadius: BorderRadius.circular(26)),
            child: Row(
              children: [
                Container(width: 52, height: 52, decoration: BoxDecoration(color: Colors.white.withValues(alpha: .1), shape: BoxShape.circle), child: const Icon(Icons.explore_rounded, color: Colors.white)),
                const SizedBox(width: 14),
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('اتجاه القبلة', style: TextStyle(color: Colors.white70)), SizedBox(height: 3), Text('من الشمال', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700))])),
                Text('${_qibla?.toStringAsFixed(1) ?? '—'}°', style: const TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          ...names.entries.map((entry) {
            final time = '${times[entry.key] ?? '—'}'.split(' ').first;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      Container(width: 46, height: 46, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(15)), child: Icon(icons[entry.key] ?? Icons.access_time_rounded, color: _brand)),
                      const SizedBox(width: 13),
                      Expanded(child: Text(entry.value, style: const TextStyle(fontWeight: FontWeight.w800, color: _ink))),
                      Text(time, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: _ink)),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _aiView() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 10),
          child: _sectionHeader('Hadir AI', 'مساعدك الذكي لخدمات حاضر.', Icons.auto_awesome_rounded),
        ),
        Expanded(
          child: _messages.isEmpty
              ? ListView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [_brandDark, _brand]),
                        borderRadius: BorderRadius.circular(26),
                      ),
                      child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 28), SizedBox(height: 16), Text('كيف يمكنني مساعدتك؟', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)), SizedBox(height: 8), Text('اسأل عن الحضور أو الإحصاءات أو الخدمات المتاحة لك.', style: TextStyle(color: Colors.white70, height: 1.5))]),
                    ),
                    const SizedBox(height: 14),
                    const _AiHint(text: 'ما هي حالة حضوري اليوم؟'),
                    const _AiHint(text: 'ما الخدمات المتاحة لي؟'),
                  ],
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                  itemCount: _messages.length,
                  itemBuilder: (_, index) {
                    final message = _messages[index];
                    final isUser = message.startsWith('أنت:');
                    return Align(
                      alignment: isUser ? Alignment.centerLeft : Alignment.centerRight,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 330),
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(15),
                        decoration: BoxDecoration(
                          color: isUser ? Colors.white : _soft,
                          borderRadius: BorderRadius.only(topLeft: const Radius.circular(20), topRight: const Radius.circular(20), bottomLeft: Radius.circular(isUser ? 5 : 20), bottomRight: Radius.circular(isUser ? 20 : 5)),
                          border: Border.all(color: _line),
                        ),
                        child: Text(message, style: const TextStyle(height: 1.55, color: _ink)),
                      ),
                    );
                  },
                ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
            child: Row(
              children: [
                Expanded(child: TextField(controller: _question, minLines: 1, maxLines: 4, textInputAction: TextInputAction.newline, decoration: const InputDecoration(hintText: 'اكتب سؤالك…', prefixIcon: Icon(Icons.chat_bubble_outline_rounded)))),
                const SizedBox(width: 8),
                SizedBox(width: 52, height: 52, child: IconButton.filled(onPressed: _aiBusy ? null : _askAi, icon: _aiBusy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.arrow_upward_rounded))),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final views = [_weatherView(), _prayerView(), _aiView()];
    return Theme(
      data: _theme(),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('الخدمات', style: TextStyle(fontWeight: FontWeight.w900)),
            actions: [IconButton(onPressed: _loadLocationServices, tooltip: 'تحديث', icon: const Icon(Icons.refresh_rounded))],
          ),
          body: _loading
              ? const _ServicesSkeleton()
              : _error != null
                  ? _ErrorView(message: _error!, onRetry: _loadLocationServices)
                  : views[_tab],
          bottomNavigationBar: NavigationBar(
            backgroundColor: Colors.white,
            indicatorColor: _soft,
            selectedIndex: _tab,
            onDestinationSelected: (value) => setState(() => _tab = value),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.cloud_outlined), selectedIcon: Icon(Icons.cloud_rounded), label: 'الطقس'),
              NavigationDestination(icon: Icon(Icons.mosque_outlined), selectedIcon: Icon(Icons.mosque_rounded), label: 'الصلاة'),
              NavigationDestination(icon: Icon(Icons.auto_awesome_outlined), selectedIcon: Icon(Icons.auto_awesome_rounded), label: 'Hadir AI'),
            ],
          ),
        ),
      ),
    );
  }
}

class _AiHint extends StatelessWidget {
  final String text;
  const _AiHint({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)),
      child: Row(children: [const Icon(Icons.arrow_back_rounded, size: 19, color: _brand), const SizedBox(width: 10), Expanded(child: Text(text, style: const TextStyle(fontWeight: FontWeight.w700, color: _ink)))]),
    );
  }
}

class _ServicesSkeleton extends StatelessWidget {
  const _ServicesSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(width: 150, height: 24, decoration: BoxDecoration(color: _line, borderRadius: BorderRadius.circular(8))),
        const SizedBox(height: 9),
        Container(width: 230, height: 14, decoration: BoxDecoration(color: _line, borderRadius: BorderRadius.circular(8))),
        const SizedBox(height: 20),
        Container(height: 280, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), border: Border.all(color: _line))),
        const SizedBox(height: 14),
        Row(children: [Expanded(child: Container(height: 90, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line)))), const SizedBox(width: 12), Expanded(child: Container(height: 90, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _line))))]),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 72, height: 72, decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(24)), child: const Icon(Icons.location_off_rounded, color: _brand, size: 34)),
            const SizedBox(height: 16),
            const Text('تعذر تحميل الخدمات', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _ink)),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: _muted, height: 1.5)),
            const SizedBox(height: 18),
            FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }
}
