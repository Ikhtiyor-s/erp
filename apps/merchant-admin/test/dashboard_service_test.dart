import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/services/dashboard_service.dart';

void main() {
  group('DashboardSummary.fromJson', () {
    test('parses number-typed fields (matches /statistics/dashboard float() casts)', () {
      final summary = DashboardSummary.fromJson({
        'today_sales': 3,
        'today_revenue': 150000.5,
        'month_sales': 42,
        'month_revenue': 2500000.0,
        'cash_total': 980000.0,
        'total_debt': 120000.0,
        'stock_value': 15000000.0,
      });

      expect(summary.todaySales, 3);
      expect(summary.todayRevenue, 150000.5);
      expect(summary.monthSales, 42);
      expect(summary.monthRevenue, 2500000.0);
      expect(summary.cashTotal, 980000.0);
      expect(summary.totalDebt, 120000.0);
      expect(summary.stockValue, 15000000.0);
    });

    test('tolerates string-typed Decimal fields (jsonable_encoder quirk, §8.3)', () {
      final summary = DashboardSummary.fromJson({
        'today_sales': '3',
        'today_revenue': '150000.50',
        'month_sales': '42',
        'month_revenue': '2500000.00',
        'cash_total': '980000.00',
        'total_debt': '120000.00',
        'stock_value': '15000000.00',
      });

      expect(summary.todaySales, 3);
      expect(summary.todayRevenue, 150000.5);
      expect(summary.stockValue, 15000000.0);
    });

    test('defaults missing/null fields to 0 instead of throwing', () {
      final summary = DashboardSummary.fromJson({});

      expect(summary.todaySales, 0);
      expect(summary.todayRevenue, 0);
      expect(summary.monthSales, 0);
      expect(summary.monthRevenue, 0);
      expect(summary.cashTotal, 0);
      expect(summary.totalDebt, 0);
      expect(summary.stockValue, 0);
    });
  });

  group('DailyRevenuePoint.fromJson', () {
    test('parses date/count/revenue', () {
      final point = DailyRevenuePoint.fromJson({
        'date': '2026-10-01',
        'count': 5,
        'revenue': '125000.00',
      });

      expect(point.date, DateTime(2026, 10, 1));
      expect(point.count, 5);
      expect(point.revenue, 125000.0);
    });

    test('falls back to now() for an unparseable date instead of throwing', () {
      final point = DailyRevenuePoint.fromJson({'date': null, 'count': 0, 'revenue': 0});
      expect(point.date, isA<DateTime>());
    });
  });
}
