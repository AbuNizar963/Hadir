package com.hadir.attendance

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.hadir.attendance.ui.NativeAdminApp
import com.hadir.attendance.ui.NativeMainApp
import com.hadir.attendance.ui.NativeMainFeatures
import com.hadir.attendance.ui.NativeRoleEntry
import com.hadir.attendance.ui.theme.HadirTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            HadirTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    var workspace by remember { mutableIntStateOf(0) }
                    var features by remember { mutableStateOf(false) }
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
            }
        }
    }
}
