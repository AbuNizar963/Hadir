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
      'https://api.github.com/repos/AbuNizar963/Hadir/releases/latest';
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

  Future<UpdateInfo?> check() async {
    final currentCode = await currentVersionCode();

    // Scan every release page. GitHub orders releases by publication/update
    // time, not by the numeric Android version, so a fixed first page is not
    // sufficient for a repository with a long release history.
    try {
      final update = await _checkAllReleasePages(currentCode);
      if (update != null) return update;
    } catch (_) {}

    // If the paginated API is temporarily unavailable, try the latest-release API.
    try {
      final latest = await _checkLatestRelease(currentCode);
      if (latest != null) return latest;
    } catch (_) {}

    // Final network fallback for environments where GitHub's API is blocked.
    try {
      final fallback = await _checkAtomFeed(currentCode);
      if (fallback != null) return fallback;
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<UpdateInfo?> _checkAllReleasePages(int currentCode) async {
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

      final pageBest = _selectApiRelease(rawReleases, currentCode);
      if (pageBest != null &&
          (best == null || pageBest.versionCode > best.versionCode)) {
        best = pageBest;
      }

      // A short page is the end of the collection. This also prevents
      // unnecessary requests when the repository has fewer than 100 releases.
      if (rawReleases.length < perPage) break;
    }

    return best;
  }

  Future<UpdateInfo?> _checkLatestRelease(int currentCode) async {
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

    return _releaseToUpdate(release, currentCode);
  }

  UpdateInfo? _selectApiRelease(List<dynamic> rawReleases, int currentCode) {
    Map<String, dynamic>? bestRelease;
    int? bestCode;
    String? bestDownloadUrl;

    for (final rawRelease in rawReleases) {
      if (rawRelease is! Map) continue;
      final release = Map<String, dynamic>.from(rawRelease);
      if (release['draft'] == true || release['prerelease'] == true) continue;

      final candidate = _releaseToUpdate(release, currentCode);
      if (candidate == null) continue;
      if (bestCode != null && candidate.versionCode <= bestCode) continue;

      bestCode = candidate.versionCode;
      bestRelease = release;
      bestDownloadUrl = candidate.downloadUrl;
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

  UpdateInfo? _releaseToUpdate(
    Map<String, dynamic> release,
    int currentCode,
  ) {
    final tag = (release['tag_name'] ?? '').toString().trim();
    final match = RegExp(r'^android-v1\.0\.(\d+)$').firstMatch(tag);
    final code = int.tryParse(match?.group(1) ?? '');
    if (code == null || code <= currentCode) return null;

    final assets = (release['assets'] as List<dynamic>?) ?? const [];
    String? downloadUrl;
    for (final item in assets) {
      if (item is! Map) continue;
      final asset = Map<String, dynamic>.from(item);
      final name = (asset['name'] ?? '').toString().trim();
      if (name != 'app-release.apk' && name != 'app-release-signed.apk') {
        continue;
      }
      final candidate = asset['browser_download_url']?.toString().trim();
      if (candidate != null && candidate.isNotEmpty) {
        downloadUrl = candidate;
        break;
      }
    }

    if (downloadUrl == null || downloadUrl.isEmpty) return null;

    return UpdateInfo(
      versionCode: code,
      versionName: '1.0.$code',
      downloadUrl: downloadUrl,
      releaseNotes: (release['body'] ?? '').toString().trim(),
    );
  }

  Future<UpdateInfo?> _checkAtomFeed(int currentCode) async {
    final response = await _dio.get<dynamic>(
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

    final responseData = response.data;
    final xml = responseData is String ? responseData : responseData.toString();
    if (xml.isEmpty) throw StateError('استجابة قناة التحديث فارغة');

    final entryPattern = RegExp(
      r'<entry\b[\s\S]*?</entry>',
      caseSensitive: false,
    );
    final tagPattern = RegExp(
      r'(?:/|%2F)(android-v1\.0\.(\d+))(?:<|&|"|\?)',
      caseSensitive: false,
    );

    int? bestCode;
    String? bestTag;

    for (final match in entryPattern.allMatches(xml)) {
      final entry = match.group(0) ?? '';
      final tagMatch = tagPattern.firstMatch(entry);
      final code = int.tryParse(tagMatch?.group(2) ?? '');
      if (code == null || code <= currentCode ||
          (bestCode != null && code <= bestCode)) {
        continue;
      }
      bestCode = code;
      bestTag = tagMatch?.group(1);
    }

    if (bestCode == null || bestTag == null) return null;

    return UpdateInfo(
      versionCode: bestCode,
      versionName: '1.0.$bestCode',
      downloadUrl: '$_releaseDownloadBase/$bestTag/app-release.apk',
      releaseNotes: '',
    );
  }

  Future<void> downloadAndInstall(UpdateInfo update) async {
    try {
      await _channel.invokeMethod<void>('downloadAndInstall', {
        'versionCode': update.versionCode,
        'downloadUrl': update.downloadUrl,
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
