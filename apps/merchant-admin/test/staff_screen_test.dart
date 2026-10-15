import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/staff_screen.dart';
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

  testWidgets('hides screen content when hr.view is missing', (tester) async {
    setUpFakeApi();

    await tester.pumpWidget(_wrap(const StaffScreen()));
    await tester.pumpAndSettle();

    expect(find.textContaining('ruxsat yo\'q'), findsOneWidget);
  });

  testWidgets('lists employees honestly when there are none', (tester) async {
    final fake = setUpFakeApi();
    await _grantPermissions(tester, fake, {'hr.view'});
    fake.on('/hr/employees', (o) => (statusCode: 200, body: <dynamic>[]));
    fake.on('/hr/payroll/runs', (o) => (statusCode: 200, body: <dynamic>[]));

    await tester.pumpWidget(_wrap(const StaffScreen()));
    await tester.pumpAndSettle();

    expect(find.text('0 ta xodim topildi'), findsOneWidget);
  });

  testWidgets('clock-in/out actions hidden without hr.create', (tester) async {
    final fake = setUpFakeApi();
    await _grantPermissions(tester, fake, {'hr.view'});
    fake.on('/hr/employees', (o) => (statusCode: 200, body: [
          {'id': 'e1', 'full_name': 'Ali Valiyev', 'position_name': 'Sotuvchi'}
        ]));
    fake.on('/hr/payroll/runs', (o) => (statusCode: 200, body: <dynamic>[]));

    await tester.pumpWidget(_wrap(const StaffScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Ali Valiyev'), findsOneWidget);
    expect(find.byIcon(Icons.login), findsNothing);
    expect(find.byIcon(Icons.logout), findsNothing);
  });

  testWidgets('payroll create FAB hidden without hr.create', (tester) async {
    final fake = setUpFakeApi();
    await _grantPermissions(tester, fake, {'hr.view'});
    fake.on('/hr/employees', (o) => (statusCode: 200, body: <dynamic>[]));
    fake.on('/hr/payroll/runs', (o) => (statusCode: 200, body: <dynamic>[]));

    await tester.pumpWidget(_wrap(const StaffScreen()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ish haqi'));
    await tester.pumpAndSettle();

    expect(find.byType(FloatingActionButton), findsNothing);
  });
}
