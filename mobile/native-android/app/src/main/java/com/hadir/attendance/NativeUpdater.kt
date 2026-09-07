package com.hadir.attendance

import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

private const val RELEASES_URL = "https://api.github.com/repos/AbuNizar963/Hadir/releases?per_page=20"
private const val ASSET_NAME = "app-release-signed.apk"
private const val INSTALL_REQUEST_CODE = 7401

data class NativeUpdateInfo(
    val versionCode: Long,
    val versionName: String,
    val downloadUrl: String,
    val releaseNotes: String
)

class NativeUpdater(private val context: Context) {
    suspend fun check(): NativeUpdateInfo? = withContext(Dispatchers.IO) {
        runCatching {
            val currentCode = currentVersionCode()
            val connection = (URL(RELEASES_URL).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/vnd.github+json")
                setRequestProperty("User-Agent", "Hadir-Android-Updater")
            }
            if (connection.responseCode !in 200..299) error("تعذر التحقق من التحديث")
            val response = connection.inputStream.bufferedReader().use { it.readText() }
            connection.disconnect()

            val releases = org.json.JSONArray(response)
            var best: NativeUpdateInfo? = null
            for (index in 0 until releases.length()) {
                val release = releases.getJSONObject(index)
                if (release.optBoolean("draft") || release.optBoolean("prerelease")) continue
                val tag = release.optString("tag_name")
                val code = Regex("android-v1\\.0\\.(\\d+)").find(tag)?.groupValues?.getOrNull(1)?.toLongOrNull() ?: continue
                if (code <= currentCode || (best != null && code <= best.versionCode)) continue

                val assets = release.optJSONArray("assets") ?: continue
                var downloadUrl: String? = null
                for (assetIndex in 0 until assets.length()) {
                    val asset = assets.getJSONObject(assetIndex)
                    if (asset.optString("name") == ASSET_NAME) {
                        downloadUrl = asset.optString("browser_download_url")
                        break
                    }
                }
                if (!downloadUrl.isNullOrBlank()) {
                    best = NativeUpdateInfo(
                        versionCode = code,
                        versionName = "1.0.$code",
                        downloadUrl = downloadUrl,
                        releaseNotes = release.optString("body").trim()
                    )
                }
            }
            best
        }.getOrNull()
    }

    suspend fun downloadAndInstall(update: NativeUpdateInfo): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !context.packageManager.canRequestPackageInstalls()
            ) {
                throw InstallPermissionRequiredException()
            }

            val apkFile = File(context.cacheDir, "hadir-update-${update.versionCode}.apk")
            val connection = (URL(update.downloadUrl).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 120_000
                instanceFollowRedirects = true
                setRequestProperty("User-Agent", "Hadir-Android-Updater")
            }
            if (connection.responseCode !in 200..299) error("تعذر تنزيل ملف التحديث")
            connection.inputStream.use { input ->
                apkFile.outputStream().use { output -> input.copyTo(output) }
            }
            connection.disconnect()
            if (!apkFile.exists() || apkFile.length() < 1024) error("تعذر تنزيل ملف التحديث")

            installWithPackageInstaller(apkFile)
        }
    }

    private fun installWithPackageInstaller(apkFile: File) {
        val packageInstaller = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setSize(apkFile.length())
        }
        val sessionId = packageInstaller.createSession(params)
        var session: PackageInstaller.Session? = null
        try {
            session = packageInstaller.openSession(sessionId)
            session.openWrite("base.apk", 0, apkFile.length()).use { output ->
                apkFile.inputStream().use { input -> input.copyTo(output) }
                output.fsync()
            }

            val callbackIntent = Intent(context, NativeInstallReceiver::class.java).setPackage(context.packageName)
            val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                INSTALL_REQUEST_CODE,
                callbackIntent,
                pendingFlags
            )
            session.commit(pendingIntent.intentSender)
        } catch (error: Exception) {
            runCatching { packageInstaller.abandonSession(sessionId) }
            throw error
        } finally {
            session?.close()
        }
    }

    fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val uri = android.net.Uri.parse("package:${context.packageName}")
            context.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }
    }

    private fun currentVersionCode(): Long {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
    }
}

class InstallPermissionRequiredException : IllegalStateException()

class NativeInstallReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(
            PackageInstaller.EXTRA_STATUS,
            PackageInstaller.STATUS_FAILURE
        )
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            val confirmationIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(PackageInstaller.EXTRA_INTENT, Intent::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra<Intent>(PackageInstaller.EXTRA_INTENT)
            }
            try {
                confirmationIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)?.let(context::startActivity)
            } catch (_: ActivityNotFoundException) {
                // The system installer is unavailable on this device.
            }
        }
    }
}
