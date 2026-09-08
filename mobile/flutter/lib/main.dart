import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/hadir_brand.dart';
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
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'حاضر',
      locale: const Locale('ar'),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: Stack(
          children: [
            child ?? const SizedBox.shrink(),
            const _UpdaterBootstrap(),
          ],
        ),
      ),
      theme: HadirBrand.theme(),
      darkTheme: HadirBrand.theme(brightness: Brightness.dark),
      themeMode: ThemeMode.system,
      routerConfig: buildModernRouter(),
    );
  }
}

class _UpdaterBootstrap extends StatefulWidget {
  const _UpdaterBootstrap();

  @override
  State<_UpdaterBootstrap> createState() => _UpdaterBootstrapState();
}

class _UpdaterBootstrapState extends State<_UpdaterBootstrap>
    with WidgetsBindingObserver {
  static const _checkInterval = Duration(minutes: 30);

  final _updater = UpdaterService();
  Timer? _timer;
  bool _started = false;
  bool _dialogVisible = false;
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(_checkInterval, (_) => unawaited(_checkForUpdate()));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(_checkForUpdate());
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_checkForUpdate());
    }
  }

  Future<void> _checkForUpdate() async {
    if (!mounted || _dialogVisible || _checking) return;
    _checking = true;
    try {
      final update = await _updater.check();
      if (!mounted || update == null || _dialogVisible) return;
      _dialogVisible = true;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _UpdateDialog(updater: _updater, update: update),
      );
    } catch (_) {
      // Update checks are non-blocking: the app remains usable if the service is offline.
    } finally {
      _checking = false;
      _dialogVisible = false;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
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
  void dispose() {
    _progressSubscription?.cancel();
    super.dispose();
  }

  Future<void> _install() async {
    setState(() {
      _downloading = true;
      _error = null;
      _permissionHint = false;
    });
    _progressSubscription = widget.updater.progress.listen(
      (progress) {
        if (mounted) setState(() => _progress = progress);
      },
      onError: (Object error) {
        if (mounted) setState(() => _error = error.toString());
      },
    );
    try {
      await widget.updater.downloadAndInstall(widget.update);
    } on InstallPermissionRequiredException {
      if (mounted) {
        setState(() {
          _downloading = false;
          _permissionHint = true;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _downloading = false;
          _error = error.toString();
        });
      }
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
      title: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: .10),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(Icons.system_update_rounded, color: Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text('تحديث حاضر ${widget.update.versionName}')),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('يتوفر إصدار جديد من التطبيق لتحسين الأداء وإضافة التحسينات.'),
            if (widget.update.releaseNotes.isNotEmpty) ...[
              const SizedBox(height: 14),
              const Text('ملاحظات الإصدار', style: TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(widget.update.releaseNotes),
            ],
            if (_downloading) ...[
              const SizedBox(height: 20),
              LinearProgressIndicator(
                value: percent >= 0 ? percent / 100 : null,
                borderRadius: BorderRadius.circular(8),
              ),
              const SizedBox(height: 9),
              Text(
                percent >= 0 ? 'جاري التنزيل: $percent%' : 'جاري تنزيل التحديث…',
                textAlign: TextAlign.center,
              ),
              if (progress != null && progress.totalBytes > 0)
                Text(
                  '${_formatBytes(progress.downloadedBytes)} من ${_formatBytes(progress.totalBytes)}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              if (progress?.etaSeconds != null)
                Text(
                  'الوقت المتبقي التقريبي: ${progress!.etaSeconds} ثانية',
                  textAlign: TextAlign.center,
                ),
            ],
            if (_permissionHint) ...[
              const SizedBox(height: 16),
              const Text('يجب السماح لحاضر بتثبيت التحديث من هذا المصدر.'),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
      ),
      actions: [
        if (!_downloading && !_permissionHint)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('لاحقًا'),
          ),
        if (_permissionHint)
          FilledButton(
            onPressed: () async {
              final navigator = Navigator.of(context);
              await widget.updater.openInstallPermissionSettings();
              if (!mounted) return;
              navigator.pop();
            },
            child: const Text('السماح بالتثبيت'),
          ),
        if (!_downloading && !_permissionHint)
          FilledButton.icon(
            onPressed: _install,
            icon: const Icon(Icons.download_rounded, size: 19),
            label: const Text('تحديث الآن'),
          ),
      ],
    );
  }
}
