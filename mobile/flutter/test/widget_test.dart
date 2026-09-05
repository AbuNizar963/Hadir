import 'package:flutter_test/flutter_test.dart';
import 'package:hadir/main.dart';

void main() {
  testWidgets('HADIR app starts', (tester) async {
    await tester.pumpWidget(const HadirApp());
    await tester.pump();
    expect(find.text('حاضر'), findsWidgets);
  });
}
