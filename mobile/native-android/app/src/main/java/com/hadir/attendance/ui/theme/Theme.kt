package com.hadir.attendance.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val HadirColors = lightColorScheme(
    primary = Color(0xFF16A66A),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD7F7E8),
    onPrimaryContainer = Color(0xFF063A25),
    secondary = Color(0xFF5F6B66),
    onSecondary = Color.White,
    background = Color(0xFFF7F9F8),
    onBackground = Color(0xFF17211D),
    surface = Color.White,
    onSurface = Color(0xFF17211D),
    surfaceVariant = Color(0xFFEEF3F0),
    onSurfaceVariant = Color(0xFF66736D),
    outline = Color(0xFFD7DFDB),
    error = Color(0xFFD64545),
)

@Composable
fun HadirTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = HadirColors, typography = Typography(), content = content)
}
