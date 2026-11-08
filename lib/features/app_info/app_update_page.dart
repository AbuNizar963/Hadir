import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../services/updater/updater_service.dart';

class AppUpdatePage extends StatefulWidget {
  const AppUpdatePage({super.key, this.androidSupportOverride});

  @visibleForTesting
  final bool? androidSupportOverride;

  @override
  State<AppUpdatePage> createState() => _AppUpdatePageState();
}

class _AppUpdatePageState extends State<AppUpdatePage> {
  final UpdaterService _updater = UpdaterService();
  StreamSubscription<UpdateProgress>? _progressSubscription;

  String _currentVersion = '—';
  int? _currentBuild;
  bool _loadingVersion = true;
  bool _checking = false;
  bool _installing = false;
  UpdateInfo? _update;
  UpdateProgress? _progress;
  String? _error;
  String? _status;

  bool get _supportsAndroid =>
      widget.androidSupportOverride ??
      (!kIsWeb && defaultTargetPlatform == TargetPlatform.android);

  @override
  void initState() {
    super.initState();
    _loadCurrentVersion();
    if (_supportsAndroid) {
      _progressSubscription = _updater.progress.listen(
        _onProgress,
        onError: _onProgressError,
      );
    }
  }

  Future<void> _loadCurrentVersion() async {
    if (!_supportsAndroid) {
      if (mounted) setState(() => _loadingVersion = false);
      return;
    }
    try {
      final values = await Future.wait<dynamic>([
        _updater.currentVersionName(),
        _updater.currentVersionCode(),
      ]);
      if (!mounted) return;
      setState(() {
        _currentVersion = values[0] as String;
        _currentBuild = values[1] as int;
        _loadingVersion = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingVersion = false;
        _error = 'تعذر قراءة معلومات الإصدار من الجهاز.';
      });
    }
  }

  Future<void> _checkForUpdate() async {
    if (!_supportsAndroid || _checking || _installing) return;
    setState(() {
      _checking = true;
      _error = null;
      _status = null;
      _update = null;
      _progress = null;
    });
    try {
      final update = await _updater.check();
      if (!mounted) return;
      setState(() {
        _update = update;
        _status = update == null ? 'أنت تستخدم أحدث إصدار منشور.' : null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Bad state: ', ''));
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _startUpdate() async {
    final update = _update;
    if (update == null || _installing) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          icon: const Icon(Icons.system_update_alt_rounded, size: 38),
          title: const Text(
            'تأكيد تحديث التطبيق',
            textAlign: TextAlign.center,
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('الإصدار الجديد: ${update.versionName}'),
                const SizedBox(height: 6),
                Text('حجم الملف: ${_formatBytes(update.expectedSize)}'),
                if (update.releaseNotes.trim().isNotEmpty) ...[
                  const SizedBox(height: 14),
                  const Text(
                    'ملاحظات الإصدار',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 6),
                  Text(update.releaseNotes),
                ],
                const SizedBox(height: 12),
                const Text(
                  'سيتم التحقق من حجم الملف وبصمة SHA-256 وهوية التطبيق قبل فتح مُثبّت Android.',
                  style: TextStyle(fontSize: 12, height: 1.5),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('لاحقًا'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('متابعة التحديث'),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() {
      _installing = true;
      _progress = null;
      _error = null;
      _status = 'جارٍ تجهيز تنزيل التحديث...';
    });

    try {
      await _updater.downloadAndInstall(update);
    } on InstallPermissionRequiredException {
      if (!mounted) return;
      setState(() {
        _installing = false;
        _status = 'يلزم السماح لحاضر بتثبيت التحديثات.';
      });
      await _showInstallPermissionDialog();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _installing = false;
        _error = error.toString().replaceFirst('Bad state: ', '');
        _status = null;
      });
    }
  }

  void _onProgress(UpdateProgress progress) {
    if (!mounted) return;
    setState(() {
      _progress = progress;
      _status = progress.percent >= 100
          ? 'اكتمل التنزيل والتحقق. أكمل التثبيت من نافذة Android.'
          : 'جارٍ تنزيل التحديث والتحقق منه...';
      if (progress.percent >= 100) _installing = false;
    });
  }

  void _onProgressError(Object error) {
    if (!mounted) return;
    setState(() {
      _installing = false;
      _status = null;
      _error = error.toString();
    });
  }

  Future<void> _showInstallPermissionDialog() async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: const Text('السماح بتثبيت التحديث'),
          content: const Text(
            'يتطلب Android السماح لتطبيق حاضر بتثبيت التحديثات من هذا المصدر. فعّل الإذن ثم ارجع إلى هذه الصفحة واضغط تحديث الآن.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('إلغاء'),
            ),
            FilledButton(
              onPressed: () async {
                Navigator.pop(dialogContext);
                try {
                  await _updater.openInstallPermissionSettings();
                } catch (error) {
                  if (mounted) {
                    setState(() => _error = error.toString());
                  }
                }
              },
              child: const Text('فتح الإعدادات'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  void dispose() {
    _progressSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('حول التطبيق والتحديثات')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
          children: [
            Center(
              child: Container(
                width: 88,
                height: 88,
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: scheme.primaryContainer,
                  borderRadius: BorderRadius.circular(25),
                ),
                child: Image.asset(
                  'assets/branding/hadir_logo_transparent.png',
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Icon(
                    Icons.access_time_filled_rounded,
                    color: scheme.primary,
                    size: 48,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'حاضر',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              'نظام الحضور والانصراف',
              textAlign: TextAlign.center,
              style: TextStyle(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 22),
            Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: scheme.primaryContainer,
                  child: Icon(Icons.verified_outlined, color: scheme.primary),
                ),
                title: const Text(
                  'الإصدار المثبت',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  _loadingVersion
                      ? 'جارٍ قراءة معلومات الإصدار...'
                      : _supportsAndroid
                          ? 'رقم البناء: ${_currentBuild ?? '—'}'
                          : 'تحديث APK متاح لأجهزة Android',
                ),
                trailing: _loadingVersion
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        _currentVersion,
                        textDirection: TextDirection.ltr,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.system_update_alt_rounded,
                            color: scheme.primary),
                        const SizedBox(width: 9),
                        const Expanded(
                          child: Text(
                            'التحديثات الرسمية',
                            style: TextStyle(fontWeight: FontWeight.w900),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _supportsAndroid
                          ? 'تحقق من أحدث إصدار رسمي منشور لحاضر. لن يبدأ التنزيل أو التثبيت إلا بعد موافقتك.'
                          : 'تحديث APK التلقائي مخصص لأجهزة Android. استخدم قناة التوزيع المعتمدة لنظام جهازك.',
                      style: TextStyle(
                        color: scheme.onSurfaceVariant,
                        height: 1.55,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 14),
                    FilledButton.icon(
                      onPressed: !_supportsAndroid || _checking || _installing
                          ? null
                          : _checkForUpdate,
                      icon: _checking
                          ? const SizedBox.square(
                              dimension: 17,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.manage_search_rounded),
                      label: Text(
                        _checking ? 'جارٍ البحث...' : 'البحث عن تحديث',
                      ),
                    ),
                    if (_update != null) ...[
                      const SizedBox(height: 16),
                      Divider(color: scheme.outlineVariant),
                      Text(
                        'يتوفر إصدار أحدث: ${_update!.versionName}',
                        style: TextStyle(
                          color: scheme.primary,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        'حجم التحديث: ${_formatBytes(_update!.expectedSize)}',
                        style: TextStyle(color: scheme.onSurfaceVariant),
                      ),
                      if (_update!.releaseNotes.trim().isNotEmpty) ...[
                        const SizedBox(height: 9),
                        const Text(
                          'ملاحظات الإصدار',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          _update!.releaseNotes,
                          style: TextStyle(
                            color: scheme.onSurfaceVariant,
                            height: 1.5,
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),
                      FilledButton.icon(
                        onPressed: _installing ? null : _startUpdate,
                        icon: const Icon(Icons.download_rounded),
                        label: const Text('تحديث التطبيق الآن'),
                      ),
                    ],
                    if (_installing && _progress != null) ...[
                      const SizedBox(height: 15),
                      LinearProgressIndicator(
                        value: _progress!.percent < 0
                            ? null
                            : _progress!.percent / 100,
                      ),
                      const SizedBox(height: 7),
                      Text(
                        _progress!.percent < 0
                            ? '${_formatBytes(_progress!.downloadedBytes)} تم تنزيلها'
                            : 'تم تنزيل ${_progress!.percent}%',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: scheme.onSurfaceVariant,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    if (_status != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _status!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: scheme.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: scheme.error,
                          fontSize: 12,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'يتم التحقق من رقم الإصدار وحجم ملف APK وبصمة SHA-256 وهوية الحزمة قبل فتح مُثبّت Android.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: scheme.onSurfaceVariant,
                fontSize: 11,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
