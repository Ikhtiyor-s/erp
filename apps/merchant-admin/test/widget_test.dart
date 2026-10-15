import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/login_screen.dart';
import 'package:merchant_admin/services/permissions_service.dart';
import 'package:merchant_admin/widgets/permission_gate.dart';
import 'package:provider/provider.dart';

void main() {
  group('LoginScreen', () {
    testWidgets('shows phone/password fields and no 2FA field by default',
        (tester) async {
      await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

      expect(find.text('Telefon raqam'), findsOneWidget);
      expect(find.text('Parol'), findsOneWidget);
      expect(find.text('2FA kod'), findsNothing);
    });

    testWidgets('submitting empty form shows client-side validation errors',
        (tester) async {
      await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

      await tester.tap(find.text('Kirish'));
      await tester.pump();

      expect(find.text('Telefon raqamni kiriting'), findsOneWidget);
      expect(find.text("Parol kamida 6 belgi bo'lishi kerak"), findsOneWidget);
    });
  });

  group('PermissionGate', () {
    setUp(() => PermissionsService.instance.clear());

    testWidgets('hides child when permission is missing', (tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: PermissionsService.instance,
          child: const MaterialApp(
            home: PermissionGate(
              code: 'finance.view',
              child: Text('gated content'),
            ),
          ),
        ),
      );

      expect(find.text('gated content'), findsNothing);
    });
  });
}
