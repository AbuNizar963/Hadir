import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';

class UpdateInfo {
  const UpdateInfo({
    required this.versionCode,
    required this.versionName,
    required this.downloadUrl,
    this.proxyUrl,
  });

  final int versionCode;
  final String versionName;
  final String downloadUrl;
  final String? proxyUrl;
}

class UpdateProgress {
  const UpdateProgress({required this.received, required this.total});

  final int received;
  final int total;

  double? get fraction => total > 0 ? received / total : null;
}

class InstallPermissionRequiredException implements Exception {
  const InstallPermissionRequiredException();
}

class UpdaterService {
  UpdaterService._();

  static const UpdaterService instance = UpdaterService._();

  static const _channel = MethodChannel('com.hadir.app/updater');
  static const _githubApiReleases =
      'https://api.github.com/repos/AbuNizar963/Hadir/releases';
  static const _latestReleaseUrl = 'https://github.com/AbuNizar963/Hadir/releases/latest';
  static const _atomFeedUrl = 'https://github.com/AbuNizar963/Hadir/releases.atom';
  static const _releaseDownloadBase =
      'https://github.com/AbuNizar963/Hadir/releases/download';

  final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 15),
      followRedirects: true,
      maxRedirects: 5,
      headers: const {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Hadir-Flutter-Updater',
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Pragma': 'no-cache',
      },
    ),
  );

  Stream<UpdateProgress> get progress => _channel
      .receiveBroadcastStream()
      .where((event) => event is Map)
      .map((event) {
        final data = Map<dynamic, dynamic>.from(event as Map);
        return UpdateProgress(
          received: (data['received'] as num?)?.toInt() ?? 0,
          total: (data['total'] as num?)?.toInt() ?? 0,
        );
      });

  Future<int> currentVersionCode() async {
    try {
      final value = await _channel.invokeMethod<num>('currentVersionCode');
      return value?.toInt() ?? 0;
    } on MissingPluginException {
      return 0;
    } on PlatformException {
      return 0;
    }
  }

  Future<UpdateInfo?> check() async {
    final currentCode = await currentVersionCode();
    Object? lastError;

    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final response = await _dio.get<List<dynamic>>(
          _githubApiReleases,
          queryParameters: {
            'per_page': 20,
            'page': 1,
            '_t': DateTime.now().millisecondsSinceEpoch,
          },
          options: Options(
            responseType: ResponseType.json,
            validateStatus: (status) => status != null && status < 500,
          ),
        );

        if (response.statusCode == 403 || response.statusCode == 429) break;
        if (response.statusCode != null &&
            response.statusCode! >= 200 &&
            response.statusCode! < 300) {
          final data = response.data;
          if (data != null) {
            final releases = data
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList(growable: false);
            final result = _selectApiRelease(releases, currentCode);
            if (result != null) return result;
          }
          return null;
        }
      } catch (error) {
        lastError = error;
      }

      if (attempt < 2) {
        await Future<void>.delayed(
          Duration(milliseconds: 1500 * (attempt + 1)),
        );
      }
    }

    try {
      final fallback = await _checkLatestRelease(currentCode);
      if (fallback != null) return fallback;
      return null;
    } catch (error) {
      lastError = error;
    }

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
        validateStatus: (status) =>
            status != null && status >= 200 && status < 400,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'User-Agent': 'Hadir-Flutter-Updater',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          'Pragma': 'no-cache',
        },
      ),
    );

    final location = response.headers.value('location');
    final candidates = <String>[
      if (location != null && location.isNotEmpty) location,
      response.data,
    ];

    int? code;
    String? tag;
    final tagPattern = RegExp(
      r'(?:^|/)(android-v1\.0\.(\d+))(?:$|[?#&<>" ])',
    );
    for (final candidate in candidates) {
      final match = tagPattern.firstMatch(candidate);
      if (match == null) continue;
      final parsed = int.tryParse(match.group(2) ?? '');
      final matchedTag = match.group(1) ?? '';
      if (parsed == null || matchedTag.isEmpty || parsed <= currentCode) {
        continue;
      }
      if (code == null || parsed > code) {
        code = parsed;
        tag = matchedTag;
      }
    }

    if (code == null || tag == null) return null;

    return UpdateInfo(
      versionCode: code,
      versionName: '1.0.$code',
      downloadUrl: '$_releaseDownloadBase/$tag/app-release.apk',
      proxyUrl: '$_releaseDownloadBase/$tag/app-release-signed.apk',
    );
  }

  UpdateInfo? _selectApiRelease(
    List<Map<String, dynamic>> releases,
    int currentCode,
  ) {
    final pattern = RegExp(r'^android-v1\.0\.(\d+)$');
    UpdateInfo? best;

    for (final release in releases) {
      if (release['draft'] == true || release['prerelease'] == true) continue;

      final tagName = release['tag_name'];
      if (tagName is! String) continue;
      final match = pattern.firstMatch(tagName);
      if (match == null) continue;

      final code = int.tryParse(match.group(1) ?? '');
      if (code == null || code <= currentCode) continue;

      final assets = release['assets'];
      if (assets is! List) continue;

      String? downloadUrl;
      String? proxyUrl;
      for (final rawAsset in assets) {
        if (rawAsset is! Map) continue;
        final asset = Map<String, dynamic>.from(rawAsset);
        final name = asset['name'];
        final url = asset['browser_download_url'];
        if (name == 'app-release.apk' && url is String && url.isNotEmpty) {
          downloadUrl = url;
        }
        if (name == 'app-release-signed.apk' &&
            url is String &&
            url.isNotEmpty) {
          proxyUrl = url;
        }
      }

      if (downloadUrl == null) continue;

      final candidate = UpdateInfo(
        versionCode: code,
        versionName: '1.0.$code',
        downloadUrl: downloadUrl,
        proxyUrl: proxyUrl,
      );
      if (best == null || candidate.versionCode > best.versionCode) {
        best = candidate;
      }
    }

    return best;
  }

  Future<UpdateInfo?> _checkAtomFeed(int currentCode) async {
    final response = await _dio.get<String>(
      _atomFeedUrl,
      queryParameters: {'_t': DateTime.now().millisecondsSinceEpoch},
      options: Options(responseType: ResponseType.plain),
    );

    final entryPattern = RegExp(r'<entry\b[\s\S]*?</entry>');
    final tagPattern = RegExp(
      r'(?:/|%2F)(android-v1\.0\.(\d+))(?:<|&|"|\?)',
    );

    int? bestCode;
    String? bestTag;
    for (final entry in entryPattern.allMatches(response.data)) {
      final text = entry.group(0) ?? '';
      final match = tagPattern.firstMatch(text);
      if (match == null) continue;
      final code = int.tryParse(match.group(2) ?? '');
      final tag = match.group(1);
      if (code == null || tag == null || code <= currentCode) continue;
      if (bestCode == null || code > bestCode) {
        bestCode = code;
        bestTag = tag;
      }
    }

    if (bestCode == null || bestTag == null) return null;
    return UpdateInfo(
      versionCode: bestCode,
      versionName: '1.0.$bestCode',
      downloadUrl: '$_releaseDownloadBase/$bestTag/app-release.apk',
      proxyUrl: '$_releaseDownloadBase/$bestTag/app-release-signed.apk',
    );
  }

  Future<void> downloadAndInstall(UpdateInfo update) async {
    try {
      await _channel.invokeMethod<void>('downloadAndInstall', {
        'versionCode': update.versionCode,
        'downloadUrl': update.downloadUrl,
        'proxyUrl': update.proxyUrl,
      });
    } on PlatformException catch (error) {
      if (error.code == 'INSTALL_PERMISSION_REQUIRED') {
        throw const InstallPermissionRequiredException();
      }
      rethrow;
    }
  }

  Future<void> openInstallPermissionSettings() async {
    await _channel.invokeMethod<void>('openInstallPermissionSettings');
  }

  Future<bool> canInstallUnknownApps() async {
    try {
      return await _channel.invokeMethod<bool>('canInstallUnknownApps') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }

  String? decodeJsonString(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    try {
      final decoded = jsonDecode(value);
      return decoded is String ? decoded : null;
    } catch (_) {
      return null;
    }
  }
}
