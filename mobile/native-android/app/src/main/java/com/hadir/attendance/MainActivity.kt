package com.hadir.attendance

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import com.hadir.attendance.ui.NativeMainApp
import com.hadir.attendance.ui.theme.HadirTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            HadirTheme {
                Surface(color = MaterialTheme.colorScheme.background) { NativeMainApp() }
            }
        }
    }
}
