import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'modern_router.dart';
import 'services/updater_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ar', null);
  runApp(const HadirApp());
}

class HadirApp extends StatelessWidget {
  const HadirApp({super.key});

  @override
  Widget build(BuildContext context) {
    const green = Color(0xFF35C995);
    const cyan = Color(0xFF35C7F2);
    const background = Color(0xFF0C1018);
    const card = Color(0xFF171C26);
    const panel = Color(0xFF202631);
    const border = Color(0xFF303744);
    const text = Color(0xFFF0F3F7);
    const muted = Color(0xFFACB4C1);
    final scheme = ColorScheme.fromSeed(seedColor: green, brightness: Brightness.dark, primary: green, secondary: cyan, surface: card, onSurface: text, onPrimary: const Color(0xFF07150F), outline: border);
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'حاضر',
      locale: const Locale('ar'),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: Stack(children: [child ?? const SizedBox.shrink(), const _UpdaterBootstrap()]),
      ),
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: scheme,
        scaffoldBackgroundColor: background,
        canvasColor: background,
        visualDensity: VisualDensity.standard,
        fontFamily: 'Cairo',
        appBarTheme: const AppBarTheme(centerTitle: false, elevation: 0, scrolledUnderElevation: 0, backgroundColor: background, surfaceTintColor: Colors.transparent, foregroundColor: text),
        cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.symmetric(vertical: 6), color: card, surfaceTintColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(20)), side: BorderSide(color: border))),
        inputDecorationTheme: const InputDecorationTheme(filled: true, fillColor: panel, hintStyle: TextStyle(color: muted), labelStyle: TextStyle(color: muted), border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(14)), borderSide: BorderSide(color: border)), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(14)), borderSide: BorderSide(color: border)), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(14)), borderSide: BorderSide(color: green, width: 2)), contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16)),
        filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), backgroundColor: green, foregroundColor: const Color(0xFF07150F), shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(14))))),
        navigationBarTheme: const NavigationBarThemeData(height: 72, elevation: 2, backgroundColor: card, surfaceTintColor: Colors.transparent, indicatorColor: Color(0x2635C995), labelTextStyle: WidgetStatePropertyAll(TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: muted))),
        dividerTheme: const DividerThemeData(color: border),
        iconTheme: const IconThemeData(color: muted),
        textTheme: const TextTheme(bodyLarge: TextStyle(color: text), bodyMedium: TextStyle(color: text), bodySmall: TextStyle(color: muted), titleLarge: TextStyle(color: text, fontWeight: FontWeight.w900), titleMedium: TextStyle(color: text, fontWeight: FontWeight.w800), labelLarge: TextStyle(color: text, fontWeight: FontWeight.w700)),
      ),
      routerConfig: buildModernRouter(),
    );
  }
}

class _UpdaterBootstrap extends StatefulWidget {
  const _UpdaterBootstrap();
  @override
  State<_UpdaterBootstrap> createState() => _UpdaterBootstrapState();
}

class _UpdaterBootstrapState extends State<_UpdaterBootstrap> {
  final _updater = UpdaterService();
  bool _started = false;
  bool _dialogVisible = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addPostFrameCallback((_) { Future<void>.delayed(const Duration(seconds: 2), _checkForUpdate); });
  }

  Future<void> _checkForUpdate() async {
    if (!mounted || _dialogVisible) return;
    try {
      final update = await _updater.check();
      if (!mounted || update == null || _dialogVisible) return;
      _dialogVisible = true;
      await showDialog<void>(context: context, barrierDismissible: false, builder: (_) => _UpdateDialog(updater: _updater, update: update));
    } catch (_) {
      // Update checks are non-blocking: the app remains usable if the service is offline.
    } finally {
      _dialogVisible = false;
    }
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class _UpdateDialog extends StatefulWidget {
  const _UpdateDialog({required this.updater, required this.update});
  final UpdaterService updater;
  final UpdateInfo update;
  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  bool _downloading = false;
  bool _permissionHint = false;
  String? _error;
  StreamSubscription<UpdateProgress>? _progressSubscription;
  UpdateProgress? _progress;

  @override
  void dispose() { _progressSubscription?.cancel(); super.dispose(); }

  Future<void> _install() async {
    setState(() { _downloading = true; _error = null; _permissionHint = false; });
    _progressSubscription = widget.updater.progress.listen((progress) { if (mounted) setState(() => _progress = progress); }, onError: (Object error) { if (mounted) setState(() => _error = error.toString()); });
    try {
      await widget.updater.downloadAndInstall(widget.update);
    } on InstallPermissionRequiredException {
      if (mounted) setState(() { _downloading = false; _permissionHint = true; });
    } catch (error) {
      if (mounted) setState(() { _downloading = false; _error = error.toString(); });
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final progress = _progress;
    final percent = progress?.percent ?? 0;
    return AlertDialog(
      title: Row(children: [const Icon(Icons.system_update_rounded), const SizedBox(width: 10), Text('تحديث حاضر ${widget.update.versionName}')]),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('يتوفر إصدار جديد من التطبيق.'),
        if (widget.update.releaseNotes.isNotEmpty) ...[const SizedBox(height: 14), const Text('ملاحظات الإصدار', style: TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 6), Text(widget.update.releaseNotes)],
        if (_downloading) ...[
          const SizedBox(height: 20), LinearProgressIndicator(value: percent >= 0 ? percent / 100 : null), const SizedBox(height: 8), Text(percent >= 0 ? 'جاري التنزيل: $percent%' : 'جاري تنزيل التحديث…', textAlign: TextAlign.center),
          if (progress != null && progress.totalBytes > 0) Text('${_formatBytes(progress.downloadedBytes)} من ${_formatBytes(progress.totalBytes)}', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
          if (progress?.etaSeconds != null) Text('الوقت المتبقي التقريبي: ${progress!.etaSeconds} ثانية', textAlign: TextAlign.center),
        ],
        if (_permissionHint) ...[const SizedBox(height: 16), const Text('يجب السماح لحاضر بتثبيت التحديث من هذا المصدر.')],
        if (_error != null) ...[const SizedBox(height: 16), Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))],
      ])),
      actions: [
        if (!_downloading && !_permissionHint) TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('لاحقًا')),
        if (_permissionHint) FilledButton(onPressed: () async { await widget.updater.openInstallPermissionSettings(); if (!context.mounted) return; Navigator.of(context).pop(); }, child: const Text('السماح بالتثبيت')),
        if (!_downloading && !_permissionHint) FilledButton(onPressed: _install, child: const Text('تحديث الآن')),
      ],
    );
  }
}
