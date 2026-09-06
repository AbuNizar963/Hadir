package com.hadir.attendance.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val HadirColors = lightColorScheme()

@Composable
fun HadirTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = HadirColors, typography = Typography(), content = content)
}
