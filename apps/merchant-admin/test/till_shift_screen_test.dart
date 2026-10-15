import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/till_shift_screen.dart';
import 'package:merchant_admin/services/permissions_service.dart';
import 'package:provider/provider.dart';
import 'support/fake_http_adapter.dart';
import 'support/test_env.dart';

// `PermissionsService.refresh()` makes a real async `ApiClient` call;
// `testWidgets` only progresses real async work (as opposed to pure
// microtasks) inside `tester.runAsync()` — calling it bare here hangs
// forever instead of throwing or completing.
Future<void> _grantPermission(
  WidgetTester tester,
  FakeHttpClientAdapter fake,
  String code,
) async {
  fake.on('/rbac/me/permissions', (o) => (statusCode: 200, body: {
        'role': {'code': 'manager', 'name': 'Menejer'},
        'permissions': [code],
        'is_superadmin': false,
      }));
  await tester.runAsync(() => PermissionsService.instance.refresh());
}

Widget _wrap(Widget child) {
  return ChangeNotifierProvider.value(
    value: PermissionsService.instance,
    child: MaterialApp(home: child),
  );
}

void main() {
  setUp(() {
    PermissionsService.instance.clear();
  });

  testWidgets('hides screen content when finance.view is missing (cosmetic gate)', (tester) async {
    setUpFakeApi();

    await tester.pumpWidget(_wrap(const TillShiftScreen()));
    await tester.pumpAndSettle();

    expect(find.textContaining('ruxsat yo\'q'), findsOneWidget);
  });

  testWidgets('offers to open a shift when none is active', (tester) async {
    final fake = setUpFakeApi();
    await _grantPermission(tester, fake, 'finance.view');
    fake.on('/finance/cashboxes', (o) => (statusCode: 200, body: [
          {'id': 1, 'name': 'Asosiy kassa', 'currency_code': 'UZS', 'balance': '0', 'is_active': true}
        ]));
    fake.on('/cashbox-sessions/active', (o) => (statusCode: 200, body: null));

    await tester.pumpWidget(_wrap(const TillShiftScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Bu kassada ochiq smena yo\'q'), findsOneWidget);
    expect(find.text('Smenani ochish'), findsOneWidget);
  });

  testWidgets('shows totals and close action when a shift is active', (tester) async {
    final fake = setUpFakeApi();
    await _grantPermission(tester, fake, 'finance.view');
    fake.on('/finance/cashboxes', (o) => (statusCode: 200, body: [
          {'id': 1, 'name': 'Asosiy kassa', 'currency_code': 'UZS', 'balance': '0', 'is_active': true}
        ]));
    fake.on('/cashbox-sessions/active', (o) => (statusCode: 200, body: {
          'id': 's1',
          'cashbox_id': 1,
          'status': 'open',
          'opened_balance': '100000.00',
          'total_income': '0',
          'total_expense': '0',
          'sale_count': 0,
        }));
    fake.on('/cashbox-sessions/s1/totals', (o) => (statusCode: 200, body: {
          'total_income': '50000.00',
          'total_expense': '0',
          'sale_count': 1,
        }));

    await tester.pumpWidget(_wrap(const TillShiftScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Smenani yopish'), findsOneWidget);
    expect(find.text('Ochiq smena'), findsOneWidget);
  });
}
