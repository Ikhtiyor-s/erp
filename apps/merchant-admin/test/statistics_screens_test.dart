import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/statistics/custom_reports_screen.dart';
import 'package:merchant_admin/screens/statistics/sales_history_screen.dart';
import 'package:merchant_admin/screens/statistics/statistics_overview_screen.dart';
import 'package:merchant_admin/services/permissions_service.dart';
import 'package:merchant_admin/services/statistics_service.dart';
import 'package:merchant_admin/widgets/permission_gate.dart';
import 'package:provider/provider.dart';

Widget _withPermissions(Widget child) => ChangeNotifierProvider.value(
      value: PermissionsService.instance,
      child: MaterialApp(home: child),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(SystemChannels.platform, (call) async {
    if (call.method == 'Clipboard.setData') return null;
    return null;
  });

  setUp(() => PermissionsService.instance.clear());

  group('StatisticsOverviewScreen', () {
    testWidgets('shows loading spinner before data arrives', (tester) async {
      await tester.pumpWidget(_withPermissions(StatisticsOverviewScreen(
        loadOverview: (from, to) => Future.delayed(
          const Duration(milliseconds: 50),
          () => const OverviewData(byCategory: [], byEmployee: [], byPaymentType: []),
        ),
      )));

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.pumpAndSettle();
    });

    testWidgets('renders category/employee/payment-type breakdown rows', (tester) async {
      await tester.pumpWidget(_withPermissions(StatisticsOverviewScreen(
        loadOverview: (from, to) async => const OverviewData(
          byCategory: [SaleByCategoryRow(category: 'Ichimliklar', salesCount: 2, qty: 5, revenue: 50000)],
          byEmployee: [SaleByEmployeeRow(employee: 'Ali', salesCount: 2, revenue: 50000, avgCheck: 25000)],
          byPaymentType: [SaleByPaymentTypeRow(paymentType: 'Naqd', paymentsCount: 2, total: 50000)],
        ),
      )));

      await tester.pumpAndSettle();

      expect(find.text('Ichimliklar'), findsOneWidget);
      expect(find.text('Ali'), findsOneWidget);
      expect(find.text('Naqd'), findsOneWidget);
    });

    testWidgets('shows per-section empty labels, not a generic error, when lists are empty',
        (tester) async {
      await tester.pumpWidget(_withPermissions(StatisticsOverviewScreen(
        loadOverview: (from, to) async =>
            const OverviewData(byCategory: [], byEmployee: [], byPaymentType: []),
      )));

      await tester.pumpAndSettle();

      expect(find.text('Tanlangan davrda savdo topilmadi'), findsNWidgets(2));
      expect(find.text('Tanlangan davrda to\'lov topilmadi'), findsOneWidget);
    });

    testWidgets('shows error view with retry on fetch failure', (tester) async {
      await tester.pumpWidget(_withPermissions(StatisticsOverviewScreen(
        loadOverview: (from, to) async => throw Exception('boom'),
      )));

      await tester.pumpAndSettle();

      expect(find.text('Kutilmagan xatolik yuz berdi'), findsOneWidget);
      expect(find.text('Qayta urinish'), findsOneWidget);
    });

    testWidgets('COGS tile is gated by the statistics.cogs.view permission code', (tester) async {
      await tester.pumpWidget(_withPermissions(StatisticsOverviewScreen(
        loadOverview: (from, to) async =>
            const OverviewData(byCategory: [], byEmployee: [], byPaymentType: []),
      )));

      await tester.pumpAndSettle();

      final gate = tester.widget<PermissionGate>(find.byType(PermissionGate));
      expect(gate.code, 'statistics.cogs.view');
      expect(find.text('Tan narx va foyda hisoboti (COGS)'), findsNothing);
    });
  });

  group('SalesHistoryScreen', () {
    testWidgets('renders daily rows sorted most-recent-first', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: SalesHistoryScreen(
          loadSummary: (from, to) async => [
            SalesSummaryRow(day: DateTime(2026, 10, 1), salesCount: 2, revenue: 50000, paid: 50000, debt: 0),
            SalesSummaryRow(day: DateTime(2026, 10, 5), salesCount: 3, revenue: 70000, paid: 60000, debt: 10000),
          ],
        ),
      ));

      await tester.pumpAndSettle();

      final titles = tester
          .widgetList<ListTile>(find.byType(ListTile))
          .map((t) => (t.title as Text).data)
          .toList();
      expect(titles.first, '05.10.2026');
      expect(titles.last, '01.10.2026');
    });

    testWidgets('shows honest empty state for a range with no sales', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: SalesHistoryScreen(loadSummary: (from, to) async => const []),
      ));

      await tester.pumpAndSettle();

      expect(find.text('Tanlangan davrda savdo topilmadi'), findsOneWidget);
    });

    testWidgets('shows error view on failure', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: SalesHistoryScreen(loadSummary: (from, to) async => throw Exception('fail')),
      ));

      await tester.pumpAndSettle();

      expect(find.text('Qayta urinish'), findsOneWidget);
    });
  });

  group('CustomReportsScreen', () {
    testWidgets('is a fixed list of 3 canned reports, no custom report form', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: CustomReportsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Mijozlar bo\'yicha savdo'), findsOneWidget);
      expect(find.text('Sotilmagan mahsulotlar (30 kun)'), findsOneWidget);
      expect(find.text('Mijozlar faolligi'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
    });

    testWidgets('lazily loads a section only once expanded', (tester) async {
      var callCount = 0;
      await tester.pumpWidget(MaterialApp(
        home: CustomReportsScreen(
          loadCustomerActivity: () async {
            callCount++;
            return [
              const CustomerActivityRow(id: '1', name: 'Mijoz A', salesCount: 2, revenue: 40000, daysInactive: 5),
            ];
          },
        ),
      ));
      await tester.pumpAndSettle();

      expect(callCount, 0);

      await tester.tap(find.text('Mijozlar faolligi'));
      await tester.pumpAndSettle();

      expect(callCount, 1);
      expect(find.text('Mijoz A'), findsOneWidget);
    });

    testWidgets('export button copies CSV to clipboard and shows a confirmation', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: CustomReportsScreen(
          loadCustomerActivity: () async => const [],
          exportCsv: (report, {dateFrom, dateTo}) async => 'name,revenue\nMijoz A,40000\n',
        ),
      ));
      await tester.pumpAndSettle();

      final exportButtons = find.widgetWithIcon(IconButton, Icons.ios_share_outlined);
      await tester.tap(exportButtons.last);
      await tester.pumpAndSettle();

      expect(find.text('CSV nusxalandi — istalgan ilovaga joylashtiring'), findsOneWidget);
    });
  });
}
