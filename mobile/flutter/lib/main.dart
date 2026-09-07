import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'modern_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ar', null);
  runApp(const HadirApp());
}

class HadirApp extends StatelessWidget {
  const HadirApp({super.key});

  @override
  Widget build(BuildContext context) {
    const green = Color(0xFF35C995);
    const cyan = Color(0xFF35C7F2);
    const background = Color(0xFF0C1018);
    const card = Color(0xFF171C26);
    const panel = Color(0xFF202631);
    const border = Color(0xFF303744);
    const text = Color(0xFFF0F3F7);
    const muted = Color(0xFFACB4C1);
    final scheme = ColorScheme.fromSeed(
      seedColor: green,
      brightness: Brightness.dark,
      primary: green,
      secondary: cyan,
      surface: card,
      onSurface: text,
      onPrimary: const Color(0xFF07150F),
      outline: border,
    );

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'حاضر',
      locale: const Locale('ar'),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: scheme,
        scaffoldBackgroundColor: background,
        canvasColor: background,
        visualDensity: VisualDensity.standard,
        fontFamily: 'Cairo',
        appBarTheme: const AppBarTheme(
          centerTitle: false,
          elevation: 0,
          scrolledUnderElevation: 0,
          backgroundColor: background,
          surfaceTintColor: Colors.transparent,
          foregroundColor: text,
        ),
        cardTheme: const CardThemeData(
          elevation: 0,
          margin: EdgeInsets.symmetric(vertical: 6),
          color: card,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(20)),
            side: BorderSide(color: border),
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: panel,
          hintStyle: TextStyle(color: muted),
          labelStyle: TextStyle(color: muted),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
            borderSide: BorderSide(color: border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
            borderSide: BorderSide(color: border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
            borderSide: BorderSide(color: green, width: 2),
          ),
          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            backgroundColor: green,
            foregroundColor: const Color(0xFF07150F),
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.all(Radius.circular(14)),
            ),
          ),
        ),
        navigationBarTheme: const NavigationBarThemeData(
          height: 72,
          elevation: 2,
          backgroundColor: card,
          surfaceTintColor: Colors.transparent,
          indicatorColor: Color(0x2635C995),
          labelTextStyle: WidgetStatePropertyAll(
            TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: muted),
          ),
        ),
        dividerTheme: const DividerThemeData(color: border),
        iconTheme: const IconThemeData(color: muted),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: text),
          bodyMedium: TextStyle(color: text),
          bodySmall: TextStyle(color: muted),
          titleLarge: TextStyle(color: text, fontWeight: FontWeight.w900),
          titleMedium: TextStyle(color: text, fontWeight: FontWeight.w800),
          labelLarge: TextStyle(color: text, fontWeight: FontWeight.w700),
        ),
      ),
      routerConfig: buildModernRouter(),
    );
  }
}
