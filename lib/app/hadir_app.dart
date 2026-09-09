import 'dart:async';

import 'package:flutter/material.dart';

import '../core/hadir_brand.dart';
import '../core/hadir_theme_controller.dart';
import '../services/updater_service.dart';
import 'router.dart';

class HadirApp extends StatefulWidget {
  const HadirApp({super.key});

  @override
  State<HadirApp> createState() => _HadirAppState();
}

class _HadirAppState extends State<HadirApp> {
  final _themeController = HadirThemeController.instance;

  @override
  void initState() {
    super.initState();
    _themeController.addListener(_themeChanged);
    unawaited(_themeController.load());
  }

  void _themeChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _themeController.removeListener(_themeChanged);
    super.dispose();
  }

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
      themeMode: _themeController.mode,
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
  bool _checking = false;

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
  bool _completed = false;
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
    if (_downloading || _completed) return;
    await _progressSubscription?.cancel();
    setState(() {
      _downloading = true;
      _completed = false;
      _error = null;
      _permissionHint = false;
      _progress = null;
    });

    _progressSubscription = widget.updater.progress.listen(
      (progress) {
        if (!mounted) return;
        setState(() {
          _progress = progress;
          if (progress.percent >= 100) {
            _completed = true;
            _downloading = false;
          }
        });
      },
      onError: (Object error) {
        if (mounted) {
          setState(() {
            _downloading = false;
            _error = error.toString();
          });
        }
      },
    );

    try {
      await widget.updater.downloadAndInstall(widget.update);
      if (!mounted) return;
      final progress = _progress;
      if (progress != null && progress.percent >= 100) {
        setState(() {
          _completed = true;
          _downloading = false;
        });
      }
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

  String _statusText(UpdateProgress? progress) {
    if (_completed) return 'اكتمل تنزيل التحديث بنجاح';
    if (progress == null || progress.percent < 0) return 'جارٍ تنزيل التحديث…';
    if (progress.percent >= 90) return 'جارٍ إنهاء التحديث…';
    if (progress.percent >= 50) return 'جارٍ تنزيل ملفات التحديث…';
    return 'جارٍ بدء تنزيل التحديث…';
  }

  Widget _progressView(BuildContext context) {
    final progress = _progress;
    final rawPercent = progress?.percent ?? 0;
    final target = rawPercent < 0 ? null : (rawPercent.clamp(0, 100) / 100).toDouble();
    final primary = Theme.of(context).colorScheme.primary;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: primary.withValues(alpha: .06),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: primary.withValues(alpha: .14)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 350),
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _completed ? primary.withValues(alpha: .14) : Colors.white,
                  shape: BoxShape.circle,
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: _completed
                      ? Icon(Icons.check_rounded, key: const ValueKey('done'), color: primary, size: 25)
                      : SizedBox(
                          key: const ValueKey('loading'),
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            value: target,
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _statusText(progress),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    if (target != null)
                      Text(
                        '${(target * 100).round()}%${progress != null && progress.totalBytes > 0 ? ' · ${_formatBytes(progress.downloadedBytes)} من ${_formatBytes(progress.totalBytes)}' : ''}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 13),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: TweenAnimationBuilder<double>(
              tween: Tween<double>(end: target ?? 0),
              duration: const Duration(milliseconds: 450),
              curve: Curves.easeOutCubic,
              builder: (_, value, __) => LinearProgressIndicator(
                value: target == null ? null : value,
                minHeight: 8,
              ),
            ),
          ),
          if (progress?.etaSeconds != null && !_completed) ...[
            const SizedBox(height: 7),
            Text(
              'الوقت المتبقي التقريبي: ${progress!.etaSeconds} ثانية',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
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
            if (widget.update.releaseNotes.isNotEmpty && !_downloading && !_completed) ...[
              const SizedBox(height: 14),
              const Text('ملاحظات الإصدار', style: TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(widget.update.releaseNotes),
            ],
            if (_downloading || _completed) ...[
              const SizedBox(height: 18),
              _progressView(context),
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
        if (!_downloading && !_permissionHint && !_completed)
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
        if (!_downloading && !_permissionHint && !_completed)
          FilledButton.icon(
            onPressed: _install,
            icon: const Icon(Icons.download_rounded, size: 19),
            label: const Text('تحديث الآن'),
          ),
        if (_completed)
          FilledButton.icon(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.check_rounded, size: 19),
            label: const Text('تم'),
          ),
      ],
    );
  }
}
