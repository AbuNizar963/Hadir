package com.hadir.attendance

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import io.flutter.plugin.common.EventChannel
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.max

class UpdateInstaller(private val context: Context) {
    companion object {
        const val PERMISSION_ERROR = "INSTALL_PERMISSION_REQUIRED"
        private const val REQUEST_CODE = 7401
    }

    fun currentVersionCode(): Long {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
    }

    fun downloadAndInstall(versionCode: Long, downloadUrl: String, proxyUrl: String?, sink: EventChannel.EventSink?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            throw InstallPermissionRequiredException()
        }

        val thread = Thread {
            var error: Throwable? = null
            val apk = File(context.cacheDir, "hadir-update-$versionCode.apk")
            try {
                for ((index, url) in listOfNotNull(downloadUrl, proxyUrl).withIndex()) {
                    try {
                        download(url, apk, sink)
                        install(apk)
                        return@Thread
                    } catch (failure: Throwable) {
                        error = failure
                        apk.delete()
                        if (index == 0) Thread.sleep(750L)
                    }
                }
                throw error ?: IllegalStateException("تعذر تنزيل ملف التحديث")
            } catch (failure: Throwable) {
                sink?.error("UPDATE_FAILED", failure.message ?: "تعذر تنزيل أو تثبيت التحديث", null)
                sink?.endOfStream()
            }
        }
        thread.name = "hadir-updater"
        thread.start()
    }

    private fun download(url: String, apk: File, sink: EventChannel.EventSink?) {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 120_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "Hadir-Flutter-Updater")
            setRequestProperty("Cache-Control", "no-cache")
        }
        try {
            if (connection.responseCode !in 200..299) error("تعذر تنزيل ملف التحديث")
            val total = connection.contentLengthLong
            val started = System.currentTimeMillis()
            var downloaded = 0L
            var lastAt = 0L
            connection.inputStream.use { input ->
                apk.outputStream().use { output ->
                    val buffer = ByteArray(32 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        output.write(buffer, 0, count)
                        downloaded += count
                        val now = System.currentTimeMillis()
                        if (now - lastAt >= 250L || (total > 0 && downloaded >= total)) {
                            val elapsed = max(1L, (now - started) / 1000L)
                            val speed = downloaded.toDouble() / elapsed.toDouble()
                            val eta = if (total > 0 && speed > 0) ((total - downloaded).coerceAtLeast(0) / speed).toLong() else null
                            val percent = if (total > 0) ((downloaded * 100L) / total).coerceIn(0L, 100L).toInt() else -1
                            sink?.success(mapOf(
                                "downloadedBytes" to downloaded,
                                "totalBytes" to total,
                                "percent" to percent,
                                "elapsedSeconds" to elapsed,
                                "etaSeconds" to eta,
                            ))
                            lastAt = now
                        }
                    }
                }
            }
            if (!apk.exists() || apk.length() < 1024) error("تعذر تنزيل ملف التحديث")
            sink?.success(mapOf(
                "downloadedBytes" to apk.length(),
                "totalBytes" to if (total > 0) total else apk.length(),
                "percent" to 100,
                "elapsedSeconds" to max(1L, (System.currentTimeMillis() - started) / 1000L),
                "etaSeconds" to 0L,
            ))
        } finally {
            connection.disconnect()
        }
    }

    private fun install(apk: File) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setSize(apk.length())
        }
        val sessionId = installer.createSession(params)
        var session: PackageInstaller.Session? = null
        try {
            session = installer.openSession(sessionId)
            session.openWrite("base.apk", 0, apk.length()).use { output ->
                apk.inputStream().use { input -> input.copyTo(output) }
                session.fsync(output)
            }
            val callback = Intent(context, NativeInstallReceiver::class.java).setPackage(context.packageName)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
            val pending = PendingIntent.getBroadcast(context, REQUEST_CODE, callback, flags)
            session.commit(pending.intentSender)
        } catch (failure: Throwable) {
            runCatching { installer.abandonSession(sessionId) }
            throw failure
        } finally {
            session?.close()
        }
    }

    fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val uri = Uri.parse("package:${context.packageName}")
            context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}

class InstallPermissionRequiredException : IllegalStateException()

class NativeInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            val confirmationIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
            } else {
                @Suppress("DEPRECATION") intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
            }
            confirmationIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)?.let(context::startActivity)
        }
    }
}
