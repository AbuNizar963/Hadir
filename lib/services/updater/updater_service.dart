import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';

class UpdateInfo {
  const UpdateInfo({
    required this.versionCode,
    required this.versionName,
    required this.downloadUrl,
    required this.releaseNotes,
  });

  final int versionCode;
  final String versionName;
  final String downloadUrl;
  final String releaseNotes;
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
      'https://github.com/AbuNizar963/Hadir/releases/latest';
  static const _releasesAtomUrl =
      'https://github.com/AbuNizar963/Hadir/releases.atom';
  static const _releaseDownloadBase =
      'https://github.com/AbuNizar963/Hadir/releases/download';

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Hadir-Flutter-Updater',
      'Cache-Control': 'no-cache, no-store, max-age=0',
      'Pragma': 'no-cache',
    },
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
    return (await _channel.invokeMethod<num>('currentVersionCode'))?.toInt() ?? 1;
  }

  Future<UpdateInfo?> check() async {
    final currentCode = await currentVersionCode();
    Object? lastError;

    // First use GitHub's normal latest-release redirect. Unlike the REST API,
    // this endpoint does not consume the unauthenticated GitHub API quota.
    // GitHub redirects /releases/latest to the actual tag, so the version can
    // be discovered without credentials or an API token.
    try {
      final latest = await _checkLatestRelease(currentCode);
      if (latest != null) return latest;
    } catch (error) {
      lastError = error;
    }

    // Keep the REST API as the richer path because it provides release notes
    // and the exact uploaded APK asset. It remains a fallback for installations
    // where the latest-release redirect is unavailable.
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final response = await _dio.get<dynamic>(
          _releasesUrl,
          queryParameters: {
            'per_page': 20,
            '_t': DateTime.now().millisecondsSinceEpoch,
          },
          options: Options(responseType: ResponseType.json),
        );

        final rawReleases = response.data is String
            ? jsonDecode(response.data as String)
            : response.data;
        if (rawReleases is! List) {
          throw StateError('استجابة التحديث غير صالحة');
        }

        final update = _selectApiRelease(rawReleases, currentCode);
        if (update != null) return update;
        return null;
      } catch (error) {
        lastError = error;
        final status = error is DioException ? error.response?.statusCode : null;
        if (status == 403 || status == 429) break;
        if (attempt < 2) {
          await Future<void>.delayed(
            Duration(milliseconds: 1500 * (attempt + 1)),
          );
        }
      }
    }

    // Final discovery fallback for networks that allow the public Atom feed
    // but block the REST API or the latest-release redirect.
    try {
      final fallback = await _checkAtomFeed(currentCode);
      if (fallback != null) return fallback;
      return null;
    } catch (error) {
      lastError = error;
    }

    throw lastError ?? StateError('تعذر التحقق من وجود تحديث');
  }

  Future<UpdateInfo?> _checkLatestRelease(int currentCode) async {
    final response = await _dio.get<String>(
      _latestReleaseUrl,
      queryParameters: {'_t': DateTime.now().millisecondsSinceEpoch},
      options: Options(
        responseType: ResponseType.plain,
        followRedirects: false,
        validateStatus: (status) => status != null && status >= 200 && status < 400,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'User-Agent': 'Hadir-Flutter-Updater',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          'Pragma': 'no-cache',
        },
      ),
    );

    final location = response.headers.value('location');
    final candidates = <String?>[
      location,
      response.realUri.toString(),
      response.data,
    ];

    int? code;
    String? tag;
    for (final candidate in candidates) {
      if (candidate == null || candidate.isEmpty) continue;
      final match = RegExp(r'(?:^|/)(android-v1\\.0\\.(\\d+))(?:$|[?#&<>"\\'])')
          .firstMatch(candidate);
      if (match != null) {
        code = int.tryParse(match.group(2) ?? '');
        tag = match.group(1);
        if (code != null && tag != null) break;
      }
    }

    if (code == null || tag == null || code <= currentCode) return null;

    return UpdateInfo(
      versionCode: code,
      versionName: '1.0.$code',
      downloadUrl: '$_releaseDownloadBase/$tag/app-release.apk',
      releaseNotes: '',
    );
  }

  UpdateInfo? _selectApiRelease(List<dynamic> rawReleases, int currentCode) {
    Map<String, dynamic>? bestRelease;
    int? bestCode;
    String? bestDownloadUrl;

    for (final rawRelease in rawReleases) {
      if (rawRelease is! Map) continue;
      final release = Map<String, dynamic>.from(rawRelease);
      if (release['draft'] == true || release['prerelease'] == true) continue;

      final tag = (release['tag_name'] ?? '').toString().trim();
      final match = RegExp(r'^android-v1\\.0\\.(\\d+)$').firstMatch(tag);
      final code = int.tryParse(match?.group(1) ?? '');
      if (code == null || code <= currentCode ||
          (bestCode != null && code <= bestCode)) {
        continue;
      }

      final assets = (release['assets'] as List<dynamic>?) ?? const [];
      String? downloadUrl;
      for (final item in assets) {
        if (item is! Map) continue;
        final asset = Map<String, dynamic>.from(item);
        final name = (asset['name'] ?? '').toString();
        if (name == 'app-release.apk' || name == 'app-release-signed.apk') {
          final candidate = asset['browser_download_url']?.toString();
          if (candidate != null && candidate.isNotEmpty) {
            downloadUrl = candidate;
            break;
          }
        }
      }
      if (downloadUrl == null || downloadUrl.isEmpty) continue;

      bestCode = code;
      bestRelease = release;
      bestDownloadUrl = downloadUrl;
    }

    if (bestCode == null || bestRelease == null || bestDownloadUrl == null) {
      return null;
    }
    return UpdateInfo(
      versionCode: bestCode,
      versionName: '1.0.$bestCode',
      downloadUrl: bestDownloadUrl,
      releaseNotes: (bestRelease['body'] ?? '').toString().trim(),
    );
  }

  Future<UpdateInfo?> _checkAtomFeed(int currentCode) async {
    final response = await _dio.get<String>(
      _releasesAtomUrl,
      queryParameters: {'_t': DateTime.now().millisecondsSinceEpoch},
      options: Options(
        responseType: ResponseType.plain,
        headers: {
          'Accept': 'application/atom+xml, application/xml, text/xml, */*',
          'User-Agent': 'Hadir-Flutter-Updater',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          'Pragma': 'no-cache',
        },
      ),
    );

    final xml = response.data ?? '';
    if (xml.isEmpty) throw StateError('استجابة قناة التحديث فارغة');

    final entryPattern = RegExp(
      r'<entry\\b[\\s\\S]*?<\\/entry>',
      caseSensitive: false,
    );
    int? bestCode;
    String? bestTag;

    for (final match in entryPattern.allMatches(xml)) {
      final entry = match.group(0) ?? '';
      final tagMatch = RegExp(
        r'(?:/|%2F)(android-v1\\.0\\.(\\d+))(?:<|&|"|\\?)',
        caseSensitive: false,
      ).firstMatch(entry);
      final code = int.tryParse(tagMatch?.group(2) ?? '');
      if (code == null || code <= currentCode ||
          (bestCode != null && code <= bestCode)) {
        continue;
      }
      bestCode = code;
      bestTag = tagMatch?.group(1);
    }

    if (bestCode == null || bestTag == null) return null;

    final downloadUrl = '$_releaseDownloadBase/$bestTag/app-release.apk';
    return UpdateInfo(
      versionCode: bestCode,
      versionName: '1.0.$bestCode',
      downloadUrl: downloadUrl,
      releaseNotes: '',
    );
  }

  Future<void> downloadAndInstall(UpdateInfo update) async {
    try {
      await _channel.invokeMethod<void>('downloadAndInstall', {
        'versionCode': update.versionCode,
        'downloadUrl': update.downloadUrl,
        'proxyUrl': 'https://hadir-api.abunizar963.workers.dev/api/mobile/update/apk',
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
