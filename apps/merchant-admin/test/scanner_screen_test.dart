import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/scanner_screen.dart';
import 'support/test_env.dart';

void main() {
  testWidgets('shows manual entry field and a hint before any lookup', (tester) async {
    setUpFakeApi();

    await tester.pumpWidget(const MaterialApp(home: ScannerScreen()));
    // No pumpAndSettle — the live camera preview schedules its own frames;
    // a few bounded pumps are enough to let the initial build settle.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.widgetWithText(TextField, 'Shtrix-kod'), findsOneWidget);
    expect(find.text('Qidirish'), findsOneWidget);
    expect(find.text('Shtrix-kodni skanerlang yoki qo\'lda kiriting'), findsOneWidget);
  });

  testWidgets('shows an honest not-found message for a 404 lookup', (tester) async {
    final fake = setUpFakeApi();
    fake.on('/warehouse/barcode-lookup', (o) => (statusCode: 404, body: {'detail': 'Mahsulot topilmadi'}));

    await tester.pumpWidget(const MaterialApp(home: ScannerScreen()));
    await tester.pump();

    await tester.enterText(find.widgetWithText(TextField, 'Shtrix-kod'), '1234567890');
    await tester.tap(find.text('Qidirish'));
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('mahsulot topilmadi'), findsOneWidget);
  });
}
