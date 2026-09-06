package com.hadir.attendance

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.hadir.attendance.ui.NativeAdminApp
import com.hadir.attendance.ui.NativeMainApp
import com.hadir.attendance.ui.NativeMainFeatures
import com.hadir.attendance.ui.NativeRoleEntry
import com.hadir.attendance.ui.theme.HadirTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var resumeNonce by mutableIntStateOf(0)

    override fun onResume() {
        super.onResume()
        resumeNonce++
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            HadirTheme {
                val context = LocalContext.current
                val updater = remember(context) { NativeUpdater(context) }
                val scope = rememberCoroutineScope()
                var workspace by remember { mutableIntStateOf(0) }
                var features by remember { mutableStateOf(false) }
                var updateInfo by remember { mutableStateOf<NativeUpdateInfo?>(null) }
                var updating by remember { mutableStateOf(false) }
                var updateError by remember { mutableStateOf<String?>(null) }

                LaunchedEffect(resumeNonce) {
                    if (!updating) updateInfo = updater.check()
                }

                Surface(color = MaterialTheme.colorScheme.background) {
                    when (workspace) {
                        0 -> NativeRoleEntry(onEmployee = { workspace = 1 }, onAdmin = { workspace = 2 })
                        1 -> if (features) NativeMainFeatures(onBack = { features = false }) else Box(Modifier.fillMaxSize()) {
                            NativeMainApp()
                            FloatingActionButton(onClick = { features = true }, modifier = Modifier.align(Alignment.TopEnd)) {
                                Icon(Icons.Default.AutoAwesome, contentDescription = "ميزات حاضر")
                            }
                        }
                        else -> NativeAdminApp(onBack = { workspace = 0 })
                    }
                }

                updateInfo?.let { info ->
                    AlertDialog(
                        onDismissRequest = { if (!updating) updateInfo = null },
                        title = { Text("تحديث جديد لحاضر") },
                        text = {
                            Text(
                                if (info.releaseNotes.isBlank()) {
                                    "الإصدار ${info.versionName} متاح الآن."
                                } else {
                                    "الإصدار ${info.versionName} متاح الآن.\n\n${info.releaseNotes}"
                                }
                            )
                        },
                        confirmButton = {
                            Button(
                                enabled = !updating,
                                onClick = {
                                    scope.launch {
                                        updating = true
                                        updateError = null
                                        val result = updater.downloadAndInstall(info)
                                        updating = false
                                        result.exceptionOrNull()?.let { error ->
                                            if (error is InstallPermissionRequiredException) {
                                                updater.openInstallPermissionSettings()
                                            } else {
                                                updateError = error.message ?: "تعذر تثبيت التحديث"
                                            }
                                        } ?: run { updateInfo = null }
                                    }
                                }
                            ) {
                                Text(if (updating) "جاري التنزيل…" else "تحديث الآن")
                            }
                        },
                        dismissButton = {
                            if (!updating) {
                                Button(onClick = { updateInfo = null }) { Text("لاحقًا") }
                            }
                        }
                    )
                }

                updateError?.let { error ->
                    AlertDialog(
                        onDismissRequest = { updateError = null },
                        title = { Text("تعذر التحديث") },
                        text = { Text(error) },
                        confirmButton = { Button(onClick = { updateError = null }) { Text("حسنًا") } }
                    )
                }
            }
        }
    }
}
