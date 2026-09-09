import 'package:flutter/material.dart';

/// HADIR visual tokens mirrored from the web application's CSS design system.
class HadirBrand {
  static const darkBackground = Color(0xFF0C0F17);
  static const darkCard = Color(0xFF151820);
  static const darkPanel = Color(0xFF1F222B);
  static const darkText = Color(0xFFF2F5F8);
  static const darkMuted = Color(0xFFA7ABB7);
  static const darkBorder = Color(0xFF292D36);
  static const darkPrimary = Color(0xFF2CD69A);
  static const darkPrimaryForeground = Color(0xFF031611);
  static const darkSecondary = Color(0xFF24262E);
  static const darkAccent = Color(0xFF39C8EA);
  static const darkWarning = Color(0xFFF8B52B);

  static const surface = Color(0xFFF8FAFC);
  static const card = Color(0xFFFFFFFF);
  static const panel = Color(0xFFEFF2F5);
  static const soft = Color(0xFFEFF2F5);
  static const text = Color(0xFF151820);
  static const muted = Color(0xFF59616D);
  static const border = Color(0xFFD1D7DE);
  static const primary = Color(0xFF229D70);
  static const primaryDark = Color(0xFF147A56);
  static const accent = Color(0xFF2096B8);
  static const danger = Color(0xFFD52F3E);
  static const warning = Color(0xFFDE970A);

  static const radiusSm = 12.0;
  static const radiusMd = 16.0;
  static const radiusLg = 20.0;
  static const radiusXl = 24.0;
  static const controlHeight = 42.0;

  static ThemeData theme({Brightness brightness = Brightness.light}) {
    final dark = brightness == Brightness.dark;
    final background = dark ? darkBackground : surface;
    final surfaceCard = dark ? darkCard : card;
    final surfacePanel = dark ? darkPanel : panel;
    final foreground = dark ? darkText : text;
    final secondaryText = dark ? darkMuted : muted;
    final outline = dark ? darkBorder : border;
    final primaryColor = dark ? darkPrimary : primary;
    final secondaryColor = dark ? darkSecondary : panel;
    final accentColor = dark ? darkAccent : accent;

    final scheme = ColorScheme.fromSeed(
      seedColor: primaryColor,
      brightness: brightness,
      primary: primaryColor,
      onPrimary: dark ? darkPrimaryForeground : Colors.white,
      secondary: secondaryColor,
      onSecondary: foreground,
      tertiary: accentColor,
      surface: surfaceCard,
      onSurface: foreground,
      surfaceContainerHighest: surfacePanel,
      outline: outline,
      error: dark ? const Color(0xFFFF6674) : danger,
      onError: Colors.white,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      canvasColor: background,
      visualDensity: VisualDensity.standard,
      fontFamily: 'Cairo',
      splashFactory: NoSplash.splashFactory,
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
        color: surfaceCard.withValues(alpha: dark ? .80 : .94),
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.black.withValues(alpha: dark ? .20 : .08),
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.all(Radius.circular(radiusMd)),
          side: BorderSide(color: outline.withValues(alpha: .72)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: secondaryColor.withValues(alpha: dark ? .50 : .72),
        hintStyle: TextStyle(color: secondaryText),
        labelStyle: TextStyle(color: secondaryText),
        border: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(radiusSm)),
          borderSide: BorderSide(color: outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(radiusSm)),
          borderSide: BorderSide(color: outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(radiusSm)),
          borderSide: BorderSide(color: primaryColor, width: 1.8),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, controlHeight),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          backgroundColor: primaryColor,
          foregroundColor: dark ? darkPrimaryForeground : Colors.white,
          disabledBackgroundColor: outline,
          disabledForegroundColor: secondaryText,
          elevation: 0,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(radiusSm)),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, controlHeight),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          foregroundColor: dark ? darkText : primaryDark,
          side: BorderSide(color: outline),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(radiusSm)),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: dark ? darkText : primaryDark,
          minimumSize: const Size(0, controlHeight),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(radiusSm)),
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        elevation: 2,
        backgroundColor: surfaceCard,
        surfaceTintColor: Colors.transparent,
        indicatorColor: primaryColor.withValues(alpha: .16),
        labelTextStyle: WidgetStatePropertyAll(
          TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: secondaryText),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surfaceCard,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(radiusLg)),
        ),
      ),
      dividerTheme: DividerThemeData(color: outline.withValues(alpha: .72)),
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