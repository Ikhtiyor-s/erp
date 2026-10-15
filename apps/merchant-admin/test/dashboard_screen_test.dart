import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/dashboard_screen.dart';
import 'package:merchant_admin/services/dashboard_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  const summary = DashboardSummary(
    todaySales: 3,
    todayRevenue: 150000,
    monthSales: 42,
    monthRevenue: 2500000,
    cashTotal: 980000,
    totalDebt: 120000,
    stockValue: 15000000,
  );

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('shows a loading spinner before data arrives', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DashboardScreen(
          fetchSummary: () => Future.delayed(const Duration(milliseconds: 50), () => summary),
          fetchDailyRevenue: ({days = 14}) =>
              Future.delayed(const Duration(milliseconds: 50), () => const []),
        ),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();
  });

  testWidgets('renders KPI values parsed from the backend summary', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DashboardScreen(
          fetchSummary: () async => summary,
          fetchDailyRevenue: ({days = 14}) async => const [],
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.textContaining('150 000'), findsOneWidget);
    expect(find.textContaining('2 500 000'), findsOneWidget);
    expect(find.textContaining('3 ta savdo'), findsOneWidget);
  });

  testWidgets('shows the bare error view when the fetch fails and no cache exists yet (first launch)',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DashboardScreen(
          fetchSummary: () async => throw Exception('network down'),
          fetchDailyRevenue: ({days = 14}) async => const [],
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Kutilmagan xatolik yuz berdi'), findsOneWidget);
    expect(find.text('Qayta urinish'), findsOneWidget);
    expect(find.textContaining('Oflayn'), findsNothing);

    await tester.tap(find.text('Qayta urinish'));
    await tester.pumpAndSettle();

    expect(find.text('Kutilmagan xatolik yuz berdi'), findsOneWidget);
  });

  testWidgets('falls back to the last cached KPIs with an offline badge when a later fetch fails',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DashboardScreen(
          fetchSummary: () async => summary,
          fetchDailyRevenue: ({days = 14}) async => const [],
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('150 000'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(
      MaterialApp(
        home: DashboardScreen(
          fetchSummary: () async => throw Exception('network down'),
          fetchDailyRevenue: ({days = 14}) async => const [],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('150 000'), findsOneWidget);
    expect(find.textContaining('2 500 000'), findsOneWidget);
    expect(find.textContaining('Oflayn'), findsOneWidget);
    expect(find.text('Kutilmagan xatolik yuz berdi'), findsNothing);
  });

  testWidgets('shows empty-state text for the revenue chart when no daily data', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DashboardScreen(
          fetchSummary: () async => summary,
          fetchDailyRevenue: ({days = 14}) async => const [],
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Kunlik daromad ma\'lumoti yo\'q'), findsOneWidget);
  });
}
