import 'package:flutter/material.dart';
import 'app_fixed.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HadirApp());
}

class HadirApp extends StatelessWidget {
  const HadirApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'حاضر',
      locale: const Locale('ar'),
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF0B6B5A),
        scaffoldBackgroundColor: const Color(0xFFF7F9F8),
      ),
      routerConfig: buildRouter(),
    );
  }
}
