package com.hadir.attendance

import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity(), MethodChannel.MethodCallHandler, EventChannel.StreamHandler {
    companion object {
        private const val METHOD_CHANNEL = "hadir/updater"
        private const val PROGRESS_CHANNEL = "hadir/updater_progress"
    }

    private lateinit var installer: UpdateInstaller
    private var progressSink: EventChannel.EventSink? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installer = UpdateInstaller(this)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL).setMethodCallHandler(this)
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, PROGRESS_CHANNEL).setStreamHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "currentVersionCode" -> result.success(installer.currentVersionCode())
            "currentVersionName" -> result.success(installer.currentVersionName())
            "preferredAbi" -> result.success(installer.preferredAbi())
            "downloadAndInstall" -> {
                val versionCode = (call.argument<Number>("versionCode"))?.toLong()
                val downloadUrl = call.argument<String>("downloadUrl")
                val proxyUrl = call.argument<String>("proxyUrl")
                val expectedSize = (call.argument<Number>("expectedSize"))?.toLong()
                val expectedSha256 = call.argument<String>("expectedSha256")
                if (versionCode == null ||
                    downloadUrl.isNullOrBlank() ||
                    expectedSize == null ||
                    expectedSize <= 0 ||
                    expectedSha256.isNullOrBlank()
                ) {
                    result.error("INVALID_UPDATE", "بيانات التحديث والتحقق غير مكتملة", null)
                    return
                }
                try {
                    installer.downloadAndInstall(
                        versionCode,
                        downloadUrl,
                        proxyUrl,
                        expectedSize,
                        expectedSha256,
                        progressSink
                    )
                    result.success(null)
                } catch (_: InstallPermissionRequiredException) {
                    result.error(UpdateInstaller.PERMISSION_ERROR, "يلزم السماح بتثبيت التطبيقات من هذا المصدر", null)
                } catch (error: Throwable) {
                    result.error("UPDATE_FAILED", error.message ?: "تعذر بدء التحديث", null)
                }
            }
            "openInstallPermissionSettings" -> {
                installer.openInstallPermissionSettings()
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        progressSink = events
    }

    override fun onCancel(arguments: Any?) {
        progressSink = null
    }
}
