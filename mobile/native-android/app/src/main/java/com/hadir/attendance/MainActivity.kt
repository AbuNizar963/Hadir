package com.hadir.attendance

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.hadir.attendance.data.HadirRepository
import com.hadir.attendance.ui.NativeAdminApp
import com.hadir.attendance.ui.NativeEmployeeScreenshotApp
import com.hadir.attendance.ui.NativeRoleEntry
import com.hadir.attendance.ui.theme.HadirTheme
import kotlinx.coroutines.launch
import kotlin.math.max

class MainActivity : ComponentActivity() {
    private var resumeNonce by mutableIntStateOf(0)

    override fun onResume() { super.onResume(); resumeNonce++ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            HadirTheme {
                val context = LocalContext.current
                val updater = remember(context) { NativeUpdater(context) }
                val repository = remember(context) { HadirRepository(context) }
                val scope = rememberCoroutineScope()
                var workspace by remember { mutableIntStateOf(0) }
                var restoringSession by remember { mutableStateOf(true) }
                var updateInfo by remember { mutableStateOf<NativeUpdateInfo?>(null) }
                var updating by remember { mutableStateOf(false) }
                var updateError by remember { mutableStateOf<String?>(null) }
                var downloadProgress by remember { mutableStateOf<NativeDownloadProgress?>(null) }

                LaunchedEffect(Unit) {
                    workspace = when (repository.savedRole()) { "employee" -> 1; "admin" -> 2; else -> 0 }
                    restoringSession = false
                }
                LaunchedEffect(resumeNonce) { if (!updating) updateInfo = updater.check() }

                Surface(color = MaterialTheme.colorScheme.background) {
                    if (restoringSession) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("جارٍ استعادة الجلسة…") }
                    } else {
                        when (workspace) {
                            0 -> NativeRoleEntry(onEmployee = { workspace = 1 }, onAdmin = { workspace = 2 })
                            1 -> CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                                NativeEmployeeScreenshotApp(onEmployeeAuthenticated = {}, onEmployeeLoggedOut = { workspace = 0 })
                            }
                            else -> NativeAdminApp(onBack = { workspace = 0 })
                        }
                    }
                }

                updateInfo?.let { info ->
                    AlertDialog(
                        onDismissRequest = { if (!updating) updateInfo = null },
                        title = { Text("تحديث جديد لحاضر") },
                        text = {
                            if (updating) {
                                val progress = downloadProgress
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Text("جاري تنزيل الإصدار ${info.versionName}…")
                                    if (progress != null) {
                                        if (progress.percent >= 0) { LinearProgressIndicator(progress = { progress.percent / 100f }, modifier = Modifier.padding(vertical = 4.dp)); Text("${progress.percent}%") }
                                        else { LinearProgressIndicator(modifier = Modifier.padding(vertical = 4.dp)); Text("جارٍ حساب حجم الملف…") }
                                        Text("تم تنزيل ${formatBytes(progress.downloadedBytes)}" + if (progress.totalBytes > 0) " من ${formatBytes(progress.totalBytes)}" else "")
                                        progress.etaSeconds?.let { eta -> Text("الوقت المتبقي التقريبي: ${formatDuration(eta)}") }
                                        Text("المدة المنقضية: ${formatDuration(max(0L, progress.elapsedSeconds))}")
                                    }
                                    Text("يرجى إبقاء التطبيق مفتوحًا حتى يكتمل التنزيل.")
                                }
                            } else Text(if (info.releaseNotes.isBlank()) "الإصدار ${info.versionName} متاح الآن." else "الإصدار ${info.versionName} متاح الآن.\n\n${info.releaseNotes}")
                        },
                        confirmButton = {
                            if (!updating) Button(onClick = { scope.launch { updating = true; updateError = null; downloadProgress = null; val result = updater.downloadAndInstall(info) { downloadProgress = it }; updating = false; result.exceptionOrNull()?.let { error -> if (error is InstallPermissionRequiredException) { updateInfo = null; updater.openInstallPermissionSettings() } else updateError = error.message ?: "تعذر تثبيت التحديث" } ?: run { downloadProgress = null; updateInfo = null } } }) { Text("تحديث الآن") }
                        },
                        dismissButton = { if (!updating) Button(onClick = { updateInfo = null }) { Text("لاحقًا") } }
                    )
                }
                updateError?.let { error -> AlertDialog(onDismissRequest = { updateError = null }, title = { Text("تعذر التحديث") }, text = { Text(error) }, confirmButton = { Button(onClick = { updateError = null }) { Text("حسنًا") } }) }
            }
        }
    }
}

private fun formatBytes(bytes: Long): String { if (bytes < 1024L) return "$bytes B"; val kb = bytes / 1024.0; if (kb < 1024.0) return "%.1f KB".format(kb); val mb = kb / 1024.0; if (mb < 1024.0) return "%.1f MB".format(mb); return "%.2f GB".format(mb / 1024.0) }
private fun formatDuration(seconds: Long): String { if (seconds < 60L) return "${seconds}ث"; val minutes = seconds / 60L; val remainingSeconds = seconds % 60L; return if (minutes < 60L) "${minutes}د ${remainingSeconds}ث" else "${minutes / 60L}س ${minutes % 60L}د" }
