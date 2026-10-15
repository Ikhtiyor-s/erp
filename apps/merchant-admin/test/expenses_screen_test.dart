import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/expenses_screen.dart';
import 'package:merchant_admin/services/permissions_service.dart';
import 'package:provider/provider.dart';
import 'support/fake_http_adapter.dart';
import 'support/test_env.dart';

// `PermissionsService.refresh()` makes a real async `ApiClient` call;
// `testWidgets` only progresses real async work inside `tester.runAsync()`
// — calling it bare here hangs forever instead of completing.
Future<void> _grantPermissions(
  WidgetTester tester,
  FakeHttpClientAdapter fake,
  Set<String> codes,
) async {
  fake.on('/rbac/me/permissions', (o) => (statusCode: 200, body: {
        'role': {'code': 'manager', 'name': 'Menejer'},
        'permissions': codes.toList(),
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

  testWidgets('shows honest empty state for zero expenses', (tester) async {
    final fake = setUpFakeApi();
    await _grantPermissions(tester, fake, {'finance.view'});
    fake.on('/finance/extra-costs', (o) => (statusCode: 200, body: <dynamic>[]));

    await tester.pumpWidget(_wrap(const ExpensesScreen()));
    await tester.pumpAndSettle();

    expect(find.text('0 ta xarajat topildi'), findsOneWidget);
  });

  testWidgets('lists expenses with amount and category', (tester) async {
    final fake = setUpFakeApi();
    await _grantPermissions(tester, fake, {'finance.view', 'finance.create'});
    fake.on('/finance/extra-costs', (o) => (statusCode: 200, body: [
          {
            'id': 'c1',
            'cost_date': '2026-10-14',
            'category': 'Kommunal',
            'amount': '450000.00',
            'currency_code': 'UZS',
          }
        ]));

    await tester.pumpWidget(_wrap(const ExpensesScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Kommunal'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsOneWidget);
  });

  testWidgets('hides add-expense FAB without finance.create', (tester) async {
    final fake = setUpFakeApi();
    await _grantPermissions(tester, fake, {'finance.view'});
    fake.on('/finance/extra-costs', (o) => (statusCode: 200, body: <dynamic>[]));

    await tester.pumpWidget(_wrap(const ExpensesScreen()));
    await tester.pumpAndSettle();

    expect(find.byType(FloatingActionButton), findsNothing);
  });

  testWidgets('hides delete action without finance.delete', (tester) async {
    final fake = setUpFakeApi();
    await _grantPermissions(tester, fake, {'finance.view', 'finance.create'});
    fake.on('/finance/extra-costs', (o) => (statusCode: 200, body: [
          {'id': 'c1', 'category': 'Kommunal', 'amount': 1000}
        ]));

    await tester.pumpWidget(_wrap(const ExpensesScreen()));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.delete_outline), findsNothing);
  });
}
