package com.hadir.attendance.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Keep the native client visually aligned with the HADIR web application:
// deep HUD background, near-black cards, emerald primary, cyan accent, amber warning.
private val HadirColors = darkColorScheme(
    primary = Color(0xFF35C995),
    onPrimary = Color(0xFF06261B),
    primaryContainer = Color(0xFF0D4A37),
    onPrimaryContainer = Color(0xFFB8F5DD),
    secondary = Color(0xFF242A35),
    onSecondary = Color(0xFFF0F3F7),
    tertiary = Color(0xFF35C7F2),
    onTertiary = Color(0xFF03232C),
    tertiaryContainer = Color(0xFF0B4655),
    onTertiaryContainer = Color(0xFFB7EEFA),
    background = Color(0xFF0C1018),
    onBackground = Color(0xFFF0F3F7),
    surface = Color(0xFF171C26),
    onSurface = Color(0xFFF0F3F7),
    surfaceVariant = Color(0xFF202631),
    onSurfaceVariant = Color(0xFFACB4C1),
    outline = Color(0xFF303744),
    outlineVariant = Color(0xFF252C37),
    error = Color(0xFFF05A67),
    onError = Color(0xFF2A060B),
    errorContainer = Color(0xFF4B151C),
    onErrorContainer = Color(0xFFFFDAD9),
)

@Composable
fun HadirTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = HadirColors,
        typography = Typography(),
        content = content
    )
}
