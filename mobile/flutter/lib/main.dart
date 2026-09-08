import 'dart:async';

import 'package:flutter/material.dart';

import 'modern_router.dart';
import 'services/updater_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const _UpdaterBootstrap(child: HadirApp()));
}

class HadirApp extends StatelessWidget {
  const HadirApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'حاضر',
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'sans',
      ),
      routerConfig: createRouter(),
    );
  }
}

class _UpdaterBootstrap extends StatefulWidget {
  const _UpdaterBootstrap({required this.child});

  final Widget child;

  @override
  State<_UpdaterBootstrap> createState() => _UpdaterBootstrapState();
}

class _UpdaterBootstrapState extends State<_UpdaterBootstrap> {
  final UpdaterService _updater = UpdaterService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future<void>.delayed(const Duration(seconds: 2), _checkForUpdate);
    });
  }

  Future<void> _checkForUpdate() async {
    try {
      final update = await _updater.check();
      if (!mounted || update == null) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _UpdateDialog(update: update, updater: _updater),
      );
    } catch (_) {
      // Update checks are best-effort and must never block app startup.
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _UpdateDialog extends StatefulWidget {
  const _UpdateDialog({required this.update, required this.updater});

  final UpdateInfo update;
  final UpdaterService updater;

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  StreamSubscription<UpdateProgress>? _progressSubscription;
  UpdateProgress? _progress;
  bool _downloading = false;
  bool _permissionHint = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _progressSubscription = widget.updater.progress.listen((progress) {
      if (!mounted) return;
      setState(() => _progress = progress);
    });
  }

  @override
  void dispose() {
    _progressSubscription?.cancel();
    super.dispose();
  }

  Future<void> _install() async {
    if (_downloading) return;
    setState(() {
      _downloading = true;
      _permissionHint = false;
      _error = null;
    });
    try {
      await widget.updater.downloadAndInstall(widget.update);
    } on InstallPermissionRequiredException {
      if (!mounted) return;
      setState(() {
        _downloading = false;
        _permissionHint = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _downloading = false;
        _error = error.toString();
      });
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final progress = _progress;
    return AlertDialog(
      title: const Text('يتوفر تحديث جديد لحاضر'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('الإصدار ${widget.update.versionName}'),
            if (widget.update.releaseNotes.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(widget.update.releaseNotes, textAlign: TextAlign.right),
            ],
            if (_downloading) ...[
              const SizedBox(height: 20),
              LinearProgressIndicator(value: progress?.percent == null || progress!.percent < 0 ? null : progress.percent / 100),
              if (progress != null && progress.totalBytes > 0)
                Text(
                  '${_formatBytes(progress.downloadedBytes)} من ${_formatBytes(progress.totalBytes)}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              if (progress?.etaSeconds != null)
                Text('الوقت المتبقي التقريبي: ${progress!.etaSeconds} ثانية', textAlign: TextAlign.center),
            ],
            if (_permissionHint) ...[
              const SizedBox(height: 16),
              const Text('يجب السماح لحاضر بتثبيت التحديث من هذا المصدر.'),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
          ],
        ),
      ),
      actions: [
        if (!_downloading && !_permissionHint)
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('لاحقًا')),
        if (_permissionHint)
          FilledButton(
            onPressed: () async {
              await widget.updater.openInstallPermissionSettings();
              if (!context.mounted) return;
              Navigator.of(context).pop();
            },
            child: const Text('السماح بالتثبيت'),
          ),
        if (!_downloading && !_permissionHint)
          FilledButton(onPressed: _install, child: const Text('تحديث الآن')),
      ],
    );
  }
}
