import 'package:flutter/widgets.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app/hadir_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ar', null);
  runApp(const HadirApp());
}
