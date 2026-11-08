import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';

class UpdateInfo {
  const UpdateInfo({
    required this.versionCode,
    required this.versionName,
    required this.downloadUrl,
    required this.releaseNotes,
    required this.expectedSize,
    required this.expectedSha256,
  });

  final int versionCode;
  final String versionName;
  final String downloadUrl;
  final String releaseNotes;
  final int expectedSize;
  final String expectedSha256;
}

class UpdateProgress {
  const UpdateProgress({
    required this.downloadedBytes,
    required this.totalBytes,
    required this.percent,
    required this.elapsedSeconds,
    this.etaSeconds,
  });

  final int downloadedBytes;
  final int totalBytes;
  final int percent;
  final int elapsedSeconds;
  final int? etaSeconds;
}

class InstallPermissionRequiredException implements Exception {}

class UpdaterService {
  static const _channel = MethodChannel('hadir/updater');
  static const _progressChannel = EventChannel('hadir/updater_progress');
  static const _releasesUrl =
      'https://api.github.com/repos/AbuNizar963/Hadir/releases';
  static const _latestReleaseUrl =
      'https://api.github.com/repos/AbuNizar963/Hadir/releases/latest';

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Hadir-Flutter-Updater',
      'Cache-Control': 'no-cache, no-store, max-age=0',
      'Pragma': 'no-cache',
    },
    validateStatus: (status) => status != null && status >= 200 && status < 300,
  ));

  Stream<UpdateProgress> get progress =>
      _progressChannel.receiveBroadcastStream().map((event) {
        final map = Map<Object?, Object?>.from(event as Map);
        return UpdateProgress(
          downloadedBytes: (map['downloadedBytes'] as num?)?.toInt() ?? 0,
          totalBytes: (map['totalBytes'] as num?)?.toInt() ?? 0,
          percent: (map['percent'] as num?)?.toInt() ?? -1,
          elapsedSeconds: (map['elapsedSeconds'] as num?)?.toInt() ?? 0,
          etaSeconds: (map['etaSeconds'] as num?)?.toInt(),
        );
      });

  Future<int> currentVersionCode() async {
    final value = await _channel.invokeMethod<num>('currentVersionCode');
    return value?.toInt() ?? 1;
  }

  Future<String> currentVersionName() async {
    final value = await _channel.invokeMethod<String>('currentVersionName');
    final version = value?.trim();
    return version == null || version.isEmpty ? '—' : version;
  }

  Future<String?> preferredAbi() async {
    final value = await _channel.invokeMethod<String>('preferredAbi');
    return value?.trim().isEmpty == true ? null : value?.trim();
  }

  Future<UpdateInfo?> check() async {
    final currentCode = await currentVersionCode();
    final abi = await preferredAbi();

    try {
      // GitHub orders releases by publication time, not numeric Android
      // version. Scan the paginated history and select the highest versionCode.
      return await _checkAllReleasePages(currentCode, abi);
    } catch (_) {
      // Keep a smaller fallback request for temporary pagination/API failures.
      try {
        return await _checkLatestRelease(currentCode, abi);
      } catch (_) {
        throw StateError(
          'تعذر الاتصال بخدمة تحديث حاضر على GitHub. تحقق من الإنترنت ثم أعد المحاولة.',
        );
      }
    }
  }

  Future<UpdateInfo?> _checkAllReleasePages(
    int currentCode,
    String? abi,
  ) async {
    const perPage = 100;
    UpdateInfo? best;

    for (var page = 1; page <= 100; page++) {
      final response = await _dio.get<dynamic>(
        _releasesUrl,
        queryParameters: {
          'per_page': perPage,
          'page': page,
          '_t': DateTime.now().millisecondsSinceEpoch,
        },
        options: Options(responseType: ResponseType.json),
      );

      final rawReleases = response.data is String
          ? jsonDecode(response.data as String)
          : response.data;
      if (rawReleases is! List) {
        throw StateError('استجابة قائمة التحديثات غير صالحة');
      }

      if (rawReleases.isEmpty) break;

      final pageBest = _selectApiRelease(rawReleases, currentCode, abi);
      if (pageBest != null &&
          (best == null || pageBest.versionCode > best.versionCode)) {
        best = pageBest;
      }

      if (rawReleases.length < perPage) break;
    }

    return best;
  }

  Future<UpdateInfo?> _checkLatestRelease(int currentCode, String? abi) async {
    final response = await _dio.get<dynamic>(
      _latestReleaseUrl,
      queryParameters: {'_t': DateTime.now().millisecondsSinceEpoch},
      options: Options(responseType: ResponseType.json),
    );

    final rawRelease = response.data is String
        ? jsonDecode(response.data as String)
        : response.data;
    if (rawRelease is! Map) {
      throw StateError('استجابة أحدث إصدار غير صالحة');
    }

    final release = Map<String, dynamic>.from(rawRelease);
    if (release['draft'] == true || release['prerelease'] == true) return null;

    return _releaseToUpdate(release, currentCode, abi);
  }

  UpdateInfo? _selectApiRelease(
    List<dynamic> rawReleases,
    int currentCode,
    String? abi,
  ) {
    UpdateInfo? best;

    for (final rawRelease in rawReleases) {
      if (rawRelease is! Map) continue;
      final release = Map<String, dynamic>.from(rawRelease);
      if (release['draft'] == true || release['prerelease'] == true) continue;

      final candidate = _releaseToUpdate(release, currentCode, abi);
      if (candidate == null) continue;
      if (best != null && candidate.versionCode <= best.versionCode) continue;
      best = candidate;
    }

    return best;
  }

  UpdateInfo? _releaseToUpdate(
    Map<String, dynamic> release,
    int currentCode,
    String? abi,
  ) {
    final tag = (release['tag_name'] ?? '').toString().trim();
    final match = RegExp(r'^android-v1\.0\.(\d+)$').firstMatch(tag);
    final code = int.tryParse(match?.group(1) ?? '');
    if (code == null || code <= currentCode) return null;

    final assets = (release['assets'] as List<dynamic>?) ?? const [];
    Map<String, dynamic>? universalAsset;
    Map<String, dynamic>? abiAsset;

    for (final item in assets) {
      if (item is! Map) continue;
      final asset = Map<String, dynamic>.from(item);
      final name = (asset['name'] ?? '').toString().trim();
      final isUniversal = name == 'app-universal-release.apk' ||
          name == 'app-release.apk' ||
          name == 'app-release-signed.apk';
      final isAbi = abi != null && name == 'app-$abi-release.apk';
      if (!isUniversal && !isAbi) continue;

      final downloadUrl = Uri.tryParse(
        (asset['browser_download_url'] ?? '').toString().trim(),
      );
      final digest = (asset['digest'] ?? '').toString().trim();
      final digestMatch =
          RegExp(r'^sha256:([a-f0-9]{64})$', caseSensitive: false)
              .firstMatch(digest);
      final size = (asset['size'] as num?)?.toInt();

      // Do not offer an APK unless GitHub provides its SHA-256 and size.
      if (downloadUrl == null ||
          downloadUrl.scheme != 'https' ||
          downloadUrl.host != 'github.com' ||
          !downloadUrl.path.contains('/releases/download/') ||
          digestMatch == null ||
          size == null ||
          size <= 0) {
        continue;
      }

      if (isAbi) {
        abiAsset = asset;
      } else if (universalAsset == null ||
          name == 'app-universal-release.apk') {
        universalAsset = asset;
      }
    }

    final selectedAsset = abiAsset ?? universalAsset;
    if (selectedAsset == null) return null;

    final downloadUrl =
        (selectedAsset['browser_download_url'] ?? '').toString().trim();
    final digest = (selectedAsset['digest'] ?? '').toString().trim();
    final digestMatch =
        RegExp(r'^sha256:([a-f0-9]{64})$', caseSensitive: false)
            .firstMatch(digest);
    final size = (selectedAsset['size'] as num?)?.toInt();
    if (digestMatch == null || size == null || size <= 0) return null;

    return UpdateInfo(
      versionCode: code,
      versionName: '1.0.$code',
      downloadUrl: downloadUrl,
      releaseNotes: (release['body'] ?? '').toString().trim(),
      expectedSize: size,
      expectedSha256: digestMatch.group(1)!.toLowerCase(),
    );
  }

  Future<void> downloadAndInstall(UpdateInfo update) async {
    try {
      await _channel.invokeMethod<void>('downloadAndInstall', {
        'versionCode': update.versionCode,
        'downloadUrl': update.downloadUrl,
        'expectedSize': update.expectedSize,
        'expectedSha256': update.expectedSha256,
        'proxyUrl':
            'https://hadir-api.abunizar963.workers.dev/api/mobile/update/apk',
      });
    } on PlatformException catch (error) {
      if (error.code == 'INSTALL_PERMISSION_REQUIRED') {
        throw InstallPermissionRequiredException();
      }
      throw StateError(error.message ?? 'تعذر تثبيت التحديث');
    }
  }

  Future<void> openInstallPermissionSettings() async {
    await _channel.invokeMethod<void>('openInstallPermissionSettings');
  }
}
