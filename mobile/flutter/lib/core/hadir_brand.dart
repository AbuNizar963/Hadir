import 'package:flutter/material.dart';

/// Shared visual language for the HADIR Flutter application.
/// Mirrors the main web application's core colors, typography and geometry.
class HadirBrand {
  // Web light theme: --background 210 25% 98%, --foreground 222 30% 12%.
  static const primary = Color(0xFF229F76);
  static const primaryDark = Color(0xFF167A59);
  static const accent = Color(0xFF1F9FC1);
  static const cyan = Color(0xFF1F9FC1);
  static const surface = Color(0xFFF7F9FB);
  static const card = Color(0xFFFFFFFF);
  static const panel = Color(0xFFEFF2F4);
  static const soft = Color(0xFFE7F4EF);
  static const text = Color(0xFF151A20);
  static const muted = Color(0xFF5B636C);
  static const border = Color(0xFFD1D6DC);
  static const danger = Color(0xFFD93030);
  static const warning = Color(0xFFDE8D0A);

  // Web dark theme: --background 222 32% 7%, --card 222 26% 11%.
  static const darkBackground = Color(0xFF0C1017);
  static const darkCard = Color(0xFF151A22);
  static const darkPanel = Color(0xFF202630);
  static const darkText = Color(0xFFF1F5F9);
  static const darkMuted = Color(0xFFA6AFBC);
  static const darkBorder = Color(0xFF2B323D);
  static const darkPrimary = Color(0xFF2BD39A);
  static const darkAccent = Color(0xFF42C5E7);

  static const radiusSm = 12.0;
  static const radiusMd = 16.0;
  static const radiusLg = 20.0;
  static const radiusXl = 24.0;
  static const controlHeight = 52.0;
  static const pageMaxWidth = 1280.0;

  static ThemeData theme({Brightness brightness = Brightness.light}) {
    final dark = brightness == Brightness.dark;
    final background = dark ? darkBackground : surface;
    final surfaceCard = dark ? darkCard : card;
    final surfacePanel = dark ? darkPanel : panel;
    final foreground = dark ? darkText : text;
    final secondaryText = dark ? darkMuted : muted;
    final outline = dark ? darkBorder : border;
    final primaryColor = dark ? darkPrimary : primary;
    final secondaryColor = dark ? darkAccent : accent;

    final scheme = ColorScheme.fromSeed(
      seedColor: primaryColor,
      brightness: brightness,
      primary: primaryColor,
      secondary: secondaryColor,
      surface: surfaceCard,
      onSurface: foreground,
      onPrimary: dark ? darkBackground : Colors.white,
      outline: outline,
      error: dark ? const Color(0xFFFF6B78) : danger,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      canvasColor: background,
      visualDensity: VisualDensity.standard,
      fontFamily: 'Cairo',
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: background,
        surfaceTintColor: Colors.transparent,
        foregroundColor: foreground,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: const EdgeInsets.symmetric(vertical: 6),
        color: surfaceCard,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.all(Radius.circular(radiusLg)),
          side: BorderSide(color: outline),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfacePanel,
        hintStyle: TextStyle(color: secondaryText),
        labelStyle: TextStyle(color: secondaryText),
        border: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(radiusMd)),
          borderSide: BorderSide(color: outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(radiusMd)),
          borderSide: BorderSide(color: outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(radiusMd)),
          borderSide: BorderSide(color: primaryColor, width: 1.8),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(controlHeight),
          backgroundColor: primaryColor,
          foregroundColor: dark ? darkBackground : Colors.white,
          disabledBackgroundColor: dark ? darkBorder : const Color(0xFFE2E9E6),
          disabledForegroundColor: secondaryText,
          elevation: 0,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(radiusMd)),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          foregroundColor: dark ? darkPrimary : primaryDark,
          side: BorderSide(color: outline),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(radiusMd)),
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        elevation: 2,
        backgroundColor: surfaceCard,
        surfaceTintColor: Colors.transparent,
        indicatorColor: primaryColor.withValues(alpha: .12),
        labelTextStyle: WidgetStatePropertyAll(
          TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: secondaryText),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surfaceCard,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(radiusXl)),
        ),
        titleTextStyle: TextStyle(
          color: foreground,
          fontSize: 20,
          fontWeight: FontWeight.w900,
          fontFamily: 'Cairo',
        ),
        contentTextStyle: TextStyle(
          color: secondaryText,
          fontSize: 13,
          height: 1.5,
          fontFamily: 'Cairo',
        ),
      ),
      dividerTheme: DividerThemeData(color: outline),
      iconTheme: IconThemeData(color: secondaryText),
      textTheme: TextTheme(
        bodyLarge: TextStyle(color: foreground),
        bodyMedium: TextStyle(color: foreground),
        bodySmall: TextStyle(color: secondaryText),
        titleLarge: TextStyle(color: foreground, fontWeight: FontWeight.w900),
        titleMedium: TextStyle(color: foreground, fontWeight: FontWeight.w800),
        labelLarge: TextStyle(color: foreground, fontWeight: FontWeight.w700),
      ),
    );
  }
}
