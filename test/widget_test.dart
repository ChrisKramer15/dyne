import 'package:flutter_test/flutter_test.dart';

import 'package:dyne/app.dart';

void main() {
  testWidgets('Landing page renders hero section', (WidgetTester tester) async {
    await tester.pumpWidget(const DyneApp());

    expect(find.text('DYNE'), findsOneWidget);
    expect(find.text('Fantasy Football, Reimagined'), findsOneWidget);
  });
}
