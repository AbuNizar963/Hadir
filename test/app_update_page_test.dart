import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hadir/features/app_info/app_update_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const updaterChannel = MethodChannel('hadir/updater');
  const progressChannel = MethodChannel('hadir/updater_progress');

  setUp(() {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(updaterChannel, (call) async {
      switch (call.method) {
        case 'currentVersionName':
          return '1.0.1043';
        case 'currentVersionCode':
          return 1043;
        case 'preferredAbi':
          return 'arm64-v8a';
        default:
          return null;
      }
    });
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(progressChannel, (call) async => null);
  });

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(updaterChannel, null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(progressChannel, null);
  });

  testWidgets('shows app identity and installed Android version', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: AppUpdatePage()),
    );
    await tester.pumpAndSettle();

    expect(find.text('حول التطبيق والتحديثات'), findsOneWidget);
    expect(find.text('حاضر'), findsOneWidget);
    expect(find.text('1.0.1043'), findsOneWidget);
    expect(find.text('رقم البناء: 1043'), findsOneWidget);
    expect(find.text('البحث عن تحديث'), findsOneWidget);
  });
}
