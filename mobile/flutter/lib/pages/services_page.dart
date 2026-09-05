import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../core/session.dart';

class ServicesPage extends StatefulWidget {
  const ServicesPage({super.key});
  @override State<ServicesPage> createState() => _ServicesPageState();
}

class _ServicesPageState extends State<ServicesPage> {
  final _dio = Dio(BaseOptions(connectTimeout: const Duration(seconds: 15), receiveTimeout: const Duration(seconds: 15)));
  final _session = HadirSession();
  final question = TextEditingController();
  int tab = 0;
  bool loading = true;
  bool aiBusy = false;
  String? error;
  Map<String, dynamic> weather = {};
  Map<String, dynamic> prayer = {};
  double? qibla;
  final messages = <String>[];

  @override
  void initState() { super.initState(); _loadLocationServices(); }

  @override
  void dispose() { question.dispose(); super.dispose(); }

  Future<Position> _position() async {
    if (!await Geolocator.isLocationServiceEnabled()) throw Exception('فعّل خدمة الموقع أولًا.');
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) throw Exception('اسمح لتطبيق حاضر باستخدام الموقع.');
    return Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium));
  }

  Future<void> _loadLocationServices() async {
    if (mounted) setState(() { loading = true; error = null; });
    try {
      final p = await _position();
      final lat = p.latitude.toString();
      final lon = p.longitude.toString();
      final results = await Future.wait([
        _dio.get('https://api.open-meteo.com/v1/forecast', queryParameters: {
          'latitude': lat,
          'longitude': lon,
          'current': 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,uv_index,pressure_msl,visibility',
          'daily': 'sunrise,sunset',
          'forecast_days': 2,
          'timezone': 'auto',
        }),
        _dio.get('https://api.aladhan.com/v1/timings', queryParameters: {'latitude': lat, 'longitude': lon, 'method': 4}),
        _dio.get('https://api.aladhan.com/v1/qibla/$lat/$lon'),
      ]);
      if (!mounted) return;
      final weatherData = Map<String, dynamic>.from(results[0].data as Map);
      final prayerData = Map<String, dynamic>.from((results[1].data as Map)['data'] as Map);
      final qiblaData = Map<String, dynamic>.from((results[2].data as Map)['data'] as Map);
      setState(() {
        weather = weatherData;
        prayer = prayerData;
        qibla = double.tryParse('${qiblaData['direction']}');
        loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { loading = false; error = e.toString().replaceFirst('Exception: ', ''); });
    }
  }

  Future<void> _askAi() async {
    final text = question.text.trim();
    if (text.isEmpty || aiBusy) return;
    setState(() { aiBusy = true; messages.add('أنت: $text'); question.clear(); });
    try {
      final token = await _session.adminToken() ?? await _session.token();
      final response = await _dio.post(
        'https://hadir-api.abunizar963.workers.dev/api/ai',
        data: {'question': text},
        options: Options(headers: token == null ? <String, dynamic>{} : {'Authorization': 'Bearer $token'}),
      );
      final data = Map<String, dynamic>.from(response.data as Map);
      if (mounted) setState(() => messages.add('Hadir AI: ${data['text'] ?? 'تعذر الحصول على إجابة.'}'));
    } catch (_) {
      if (mounted) setState(() => messages.add('Hadir AI: تعذر الاتصال بالمساعد الآن، حاول مرة أخرى.'));
    } finally {
      if (mounted) setState(() => aiBusy = false);
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

  Widget _weatherView() {
    final current = Map<String, dynamic>.from((weather['current'] as Map?) ?? {});
    final daily = Map<String, dynamic>.from((weather['daily'] as Map?) ?? {});
    final code = int.tryParse('${current['weather_code'] ?? 0}') ?? 0;
    final sunrise = (daily['sunrise'] as List?)?.isNotEmpty == true ? '${(daily['sunrise'] as List).first}' : '—';
    final sunset = (daily['sunset'] as List?)?.isNotEmpty == true ? '${(daily['sunset'] as List).first}' : '—';
    return ListView(padding: const EdgeInsets.all(20), children: [
      Text('الطقس', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
      const SizedBox(height: 6),
      const Text('بيانات حية حسب موقعك الحالي.'),
      const SizedBox(height: 18),
      Card(child: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
        Text('${current['temperature_2m'] ?? '—'}°', style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w900)),
        Text(_weatherText(code), style: const TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        Wrap(spacing: 12, runSpacing: 12, alignment: WrapAlignment.center, children: [
          _metric('المحسوسة', '${current['apparent_temperature'] ?? '—'}°'),
          _metric('الرياح', '${current['wind_speed_10m'] ?? '—'} كم/س'),
          _metric('الرطوبة', '${current['relative_humidity_2m'] ?? '—'}%'),
          _metric('UV', '${current['uv_index'] ?? '—'}'),
        ]),
      ]))),
      const SizedBox(height: 12),
      Card(child: ListTile(leading: const Icon(Icons.wb_sunny_outlined), title: const Text('الشروق'), subtitle: Text(sunrise))),
      Card(child: ListTile(leading: const Icon(Icons.nightlight_outlined), title: const Text('الغروب'), subtitle: Text(sunset))),
    ]);
  }

  Widget _metric(String label, String value) => Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(14)), child: Column(children: [Text(label, style: const TextStyle(fontSize: 11)), const SizedBox(height: 3), Text(value, style: const TextStyle(fontWeight: FontWeight.w800))]));

  Widget _prayerView() {
    final times = Map<String, dynamic>.from((prayer['timings'] as Map?) ?? {});
    const names = {'Fajr': 'الفجر', 'Sunrise': 'الشروق', 'Dhuhr': 'الظهر', 'Asr': 'العصر', 'Maghrib': 'المغرب', 'Isha': 'العشاء'};
    return ListView(padding: const EdgeInsets.all(20), children: [
      Text('مواقيت الصلاة', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
      const SizedBox(height: 6),
      Text('القبلة: ${qibla?.toStringAsFixed(1) ?? '—'}° من الشمال', style: const TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 18),
      ...names.entries.map((entry) => Card(child: ListTile(leading: const Icon(Icons.access_time_rounded), title: Text(entry.value, style: const TextStyle(fontWeight: FontWeight.w800)), trailing: Text('${times[entry.key] ?? '—'}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900))))),
    ]);
  }

  Widget _aiView() => Column(children: [
    Expanded(child: ListView(padding: const EdgeInsets.all(16), children: [
      if (messages.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(18), child: Text('اسأل Hadir AI عن الحضور، الإحصاءات، الطقس أو الخدمات المتاحة لك.'))),
      ...messages.map((message) => Align(alignment: Alignment.centerRight, child: Container(margin: const EdgeInsets.only(bottom: 10), padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(18)), child: Text(message, style: const TextStyle(height: 1.5))))),
    ])),
    SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
      Expanded(child: TextField(controller: question, minLines: 1, maxLines: 4, decoration: const InputDecoration(hintText: 'اكتب سؤالك…', border: OutlineInputBorder()))),
      const SizedBox(width: 8),
      IconButton.filled(onPressed: aiBusy ? null : _askAi, icon: const Icon(Icons.send_rounded)),
    ])),
  ]);

  @override
  Widget build(BuildContext context) {
    final views = [_weatherView(), _prayerView(), _aiView()];
    return Scaffold(
      appBar: AppBar(title: const Text('الخدمات', style: TextStyle(fontWeight: FontWeight.w900)), actions: [IconButton(onPressed: _loadLocationServices, icon: const Icon(Icons.refresh_rounded))]),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.location_off_rounded, size: 48), const SizedBox(height: 12), Text(error!, textAlign: TextAlign.center), const SizedBox(height: 12), FilledButton(onPressed: _loadLocationServices, child: const Text('إعادة المحاولة'))])))
              : views[tab],
      bottomNavigationBar: NavigationBar(selectedIndex: tab, onDestinationSelected: (value) => setState(() => tab = value), destinations: const [NavigationDestination(icon: Icon(Icons.cloud_outlined), label: 'الطقس'), NavigationDestination(icon: Icon(Icons.mosque_outlined), label: 'الصلاة'), NavigationDestination(icon: Icon(Icons.auto_awesome_outlined), label: 'Hadir AI')]),
    );
  }
}
