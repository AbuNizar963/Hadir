import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hadir/app/hadir_app.dart';

void main() {
  testWidgets('HADIR app renders', (tester) async {
    await tester.pumpWidget(const HadirApp());
    // _UpdaterBootstrap schedules its non-blocking update check two seconds
    // after the first frame. Advance the fake clock so the test leaves no
    // pending timer behind when the widget tree is disposed.
    await tester.pump(const Duration(seconds: 2));
    await tester.pump();

    expect(find.byType(HadirApp), findsOneWidget);
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
