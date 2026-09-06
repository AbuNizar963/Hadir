import 'package:flutter/material.dart';

/// Shared visual language for the native HADIR application.
/// Kept independent from Web UI to support Android and iOS Flutter screens.
class HadirBrand {
  static const primary = Color(0xFF0B6B5A);
  static const primaryDark = Color(0xFF064B40);
  static const surface = Color(0xFFF5F7F6);
  static const soft = Color(0xFFE8F5F0);
  static const text = Color(0xFF142D27);
  static const muted = Color(0xFF73827E);
  static const border = Color(0xFFDCE6E2);

  static ThemeData theme() {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: surface,
      colorScheme: ColorScheme.fromSeed(seedColor: primary),
      fontFamily: 'Roboto',
    );
  }
}
