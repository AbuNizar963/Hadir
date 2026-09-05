import 'package:flutter_test/flutter_test.dart';
import 'package:hadir/main.dart';

void main() {
  testWidgets('HADIR login screen starts', (tester) async {
    await tester.pumpWidget(const HadirApp());
    await tester.pumpAndSettle();

    expect(find.text('حاضر'), findsOneWidget);
    expect(find.text('تسجيل دخول الموظف'), findsOneWidget);
    expect(find.text('دخول'), findsOneWidget);
  });
}
