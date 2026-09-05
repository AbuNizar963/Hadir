import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hadir/main.dart';

void main() {
  testWidgets('HADIR app renders', (tester) async {
    await tester.pumpWidget(const HadirApp());
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byType(HadirApp), findsOneWidget);
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.byType(MaterialApp).first.evaluate().isNotEmpty, isTrue);
  });
}
