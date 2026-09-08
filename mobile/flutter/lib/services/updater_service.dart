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

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Hadir-Flutter-Updater',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  ));

  Stream<UpdateProgress> get progress => _progressChannel.receiveBroadcastStream().map((event) {
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
    Object? lastError;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final currentCode = await currentVersionCode();
        final response = await _dio.get<dynamic>(
          'https://api.github.com/repos/AbuNizar963/Hadir/releases/latest',
          options: Options(responseType: ResponseType.json),
        );
        final release = response.data is String
            ? jsonDecode(response.data as String) as Map<String, dynamic>
            : Map<String, dynamic>.from(response.data as Map);
        if (release['draft'] == true || release['prerelease'] == true) return null;

        final tag = (release['tag_name'] ?? '').toString();
        final match = RegExp(r'^android-v1\.0\.(\d+)$').firstMatch(tag);
        final code = int.tryParse(match?.group(1) ?? '');
        if (code == null || code <= currentCode) return null;

        final assets = (release['assets'] as List<dynamic>?) ?? const [];
        String? downloadUrl;
        for (final preferredName in const ['app-release.apk', 'app-release-signed.apk']) {
          for (final item in assets) {
            final asset = Map<String, dynamic>.from(item as Map);
            if (asset['name'] == preferredName) {
              downloadUrl = asset['browser_download_url']?.toString();
              break;
            }
          }
          if (downloadUrl != null && downloadUrl.isNotEmpty) break;
        }
        if (downloadUrl == null || downloadUrl.isEmpty) return null;

        return UpdateInfo(
          versionCode: code,
          versionName: '1.0.$code',
          downloadUrl: downloadUrl,
          releaseNotes: (release['body'] ?? '').toString().trim(),
        );
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await Future<void>.delayed(Duration(milliseconds: 1500 * (attempt + 1)));
        }
      }
    }
    throw lastError ?? StateError('تعذر التحقق من التحديث');
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
