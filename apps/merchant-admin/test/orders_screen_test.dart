import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/orders_screen.dart';
import 'package:merchant_admin/services/permissions_service.dart';
import 'package:provider/provider.dart';
import 'support/test_env.dart';

Widget _wrap(Widget child) {
  return ChangeNotifierProvider.value(
    value: PermissionsService.instance,
    child: MaterialApp(home: child),
  );
}

void main() {
  setUp(() {
    setUpFakeApi();
    PermissionsService.instance.clear();
  });

  testWidgets('shows loading then the sale list', (tester) async {
    final fake = setUpFakeApi();
    fake.on('/sale/sales', (o) => (statusCode: 200, body: [
          {
            'id': '1',
            'doc_number': 'A-1',
            'uuid_label': 'A1',
            'customer_name': 'Alisher',
            'total_amount': '15000.00',
            'paid_amount': '15000.00',
            'status': 'paid',
            'source_type': 'sale',
          }
        ]));

    await tester.pumpWidget(_wrap(const OrdersScreen()));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.pumpAndSettle();
    expect(find.text('A-1'), findsOneWidget);
    expect(find.textContaining('Alisher'), findsOneWidget);
  });

  testWidgets('shows honest empty state (not an error) for zero sales', (tester) async {
    final fake = setUpFakeApi();
    fake.on('/sale/sales', (o) => (statusCode: 200, body: <dynamic>[]));

    await tester.pumpWidget(_wrap(const OrdersScreen()));
    await tester.pumpAndSettle();

    expect(find.text('0 ta buyurtma topildi'), findsOneWidget);
    expect(find.text('Xatolik'), findsNothing);
  });

  testWidgets('shows retry option on server error', (tester) async {
    final fake = setUpFakeApi();
    fake.on('/sale/sales', (o) => (statusCode: 500, body: {'detail': 'Server xatosi'}));

    await tester.pumpWidget(_wrap(const OrdersScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Qayta urinish'), findsOneWidget);
  });

  testWidgets('barcode scan action is hidden without warehouse.product.barcode_view', (tester) async {
    final fake = setUpFakeApi();
    fake.on('/sale/sales', (o) => (statusCode: 200, body: <dynamic>[]));

    await tester.pumpWidget(_wrap(const OrdersScreen()));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.qr_code_scanner_outlined), findsNothing);
  });
}
