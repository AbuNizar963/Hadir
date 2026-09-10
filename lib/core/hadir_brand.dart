import 'package:flutter/material.dart';

/// HADIR visual tokens mirrored from the web application's CSS design system.
/// Keep these values shared so every Flutter page inherits the same visual language.
class HadirBrand {
  // Website dark CSS tokens converted from HSL.
  static const darkBackground = Color(0xFF0C1017);
  static const darkCard = Color(0xFF151A22);
  static const darkPanel = Color(0xFF1F232E);
  static const darkText = Color(0xFFF1F4F7);
  static const darkMuted = Color(0xFFA4AAB7);
  static const darkBorder = Color(0xFF292E3D);
  static const darkInput = Color(0xFF252A36);
  static const darkPrimary = Color(0xFF2AC991);
  static const darkPrimaryForeground = Color(0xFF031F15);
  static const darkSecondary = Color(0xFF1F232E);
  static const darkAccent = Color(0xFF32BEEB);
  static const darkWarning = Color(0xFFF4A91F);
  static const darkDanger = Color(0xFFE33D3D);

  // Website light CSS tokens converted from HSL.
  static const lightBackground = Color(0xFFF7F9FC);
  static const lightCard = Color(0xFFFFFFFF);
  static const lightPanel = Color(0xFFEFF2F5);
  static const lightText = Color(0xFF151B28);
  static const lightMuted = Color(0xFF5C6471);
  static const lightBorder = Color(0xFFCED5DE);
  static const lightInput = Color(0xFFDCE1E7);
  static const lightPrimary = Color(0xFF229F70);
  static const lightAccent = Color(0xFF2092B5);
  static const lightDanger = Color(0xFFD52A38);
  static const lightWarning = Color(0xFFDE9E0B);

  // Backward-compatible aliases used by existing pages.
  static const background = darkBackground;
  static const card = darkCard;
  static const panel = darkPanel;
  static const text = darkText;
  static const muted = darkMuted;
  static const border = darkBorder;
  static const input = darkInput;
  static const primary = darkPrimary;
  static const primaryDark = darkPrimary;
  static const soft = darkPanel;
  static const warning = darkWarning;
  static const danger = darkDanger;

  static const radiusSm = 12.0;
  static const radiusMd = 16.0;
  static const radiusLg = 20.0;
  static const radiusXl = 24.0;
  static const controlHeight = 42.0;

  static ThemeData theme({Brightness brightness = Brightness.light}) {
    final dark = brightness == Brightness.dark;
    final background = dark ? darkBackground : lightBackground;
    final surfaceCard = dark ? darkCard : lightCard;
    final surfacePanel = dark ? darkPanel : lightPanel;
    final foreground = dark ? darkText : lightText;
    final secondaryText = dark ? darkMuted : lightMuted;
    final outline = dark ? darkBorder : lightBorder;
    final primaryColor = dark ? darkPrimary : lightPrimary;
    final secondaryColor = dark ? darkSecondary : lightPanel;
    final accentColor = dark ? darkAccent : lightAccent;
    final dangerColor = dark ? darkDanger : lightDanger;

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
      error: dangerColor,
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
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.linux: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.macOS: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.windows: FadeForwardsPageTransitionsBuilder(),
        },
      ),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: background.withValues(alpha: .96),
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
          borderRadius: const BorderRadius.all(Radius.circular(radiusLg)),
          side: BorderSide(color: outline.withValues(alpha: .72)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? darkInput.withValues(alpha: .50) : lightPanel.withValues(alpha: .72),
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
          foregroundColor: dark ? darkText : lightPrimary,
          side: BorderSide(color: outline),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(radiusSm)),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: dark ? darkText : lightPrimary,
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
