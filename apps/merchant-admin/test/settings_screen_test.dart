import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/settings_screen.dart';
import 'package:merchant_admin/services/permissions_service.dart';
import 'package:merchant_admin/state/auth_state.dart';
import 'package:provider/provider.dart';
import 'support/test_env.dart';

void main() {
  setUp(() {
    PermissionsService.instance.clear();
  });

  Widget wrap(Widget child) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthState()),
        ChangeNotifierProvider.value(value: PermissionsService.instance),
      ],
      child: MaterialApp(home: child),
    );
  }

  testWidgets('shows the mandatory "no sender" disclaimer and an honest empty device list',
      (tester) async {
    final fake = setUpFakeApi();
    fake.on('/push/devices', (o) => (statusCode: 200, body: <dynamic>[]));

    await tester.pumpWidget(wrap(const SettingsScreen()));
    await tester.pumpAndSettle();

    expect(
      find.textContaining("backend tomonidan jo'natish xizmati ulanmagan"),
      findsOneWidget,
    );
    expect(find.text("0 ta qurilma ro'yxatdan o'tgan"), findsOneWidget);
  });

  testWidgets('lists registered push devices without exposing the raw token', (tester) async {
    final fake = setUpFakeApi();
    fake.on('/push/devices', (o) => (statusCode: 200, body: [
          {
            'id': 1,
            'platform': 'android',
            'device_label': 'android (2026-10-14 10:00)',
            'last_used_at': '2026-10-14T10:00:00Z',
          }
        ]));

    await tester.pumpWidget(wrap(const SettingsScreen()));
    await tester.pumpAndSettle();

    expect(find.textContaining('android (2026-10-14 10:00)'), findsOneWidget);
  });
}
