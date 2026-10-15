import 'package:dio/dio.dart';
import '../utils/num_parse.dart';
import 'api_client.dart';

/// `GET /statistics/dashboard` response (`statistics/router.py:22`) — derived
/// `statistics.view`, identical for `admin`/`manager` (DESIGN-merchant-admin.md
/// §1.1). Fields are plain floats server-side (explicit `float()` cast), but
/// still routed through `parseNum` per §8.3's blanket rule.
class DashboardSummary {
  final int todaySales;
  final num todayRevenue;
  final int monthSales;
  final num monthRevenue;
  final num cashTotal;
  final num totalDebt;
  final num stockValue;

  const DashboardSummary({
    required this.todaySales,
    required this.todayRevenue,
    required this.monthSales,
    required this.monthRevenue,
    required this.cashTotal,
    required this.totalDebt,
    required this.stockValue,
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> j) => DashboardSummary(
        todaySales: parseNum(j['today_sales']).toInt(),
        todayRevenue: parseNum(j['today_revenue']),
        monthSales: parseNum(j['month_sales']).toInt(),
        monthRevenue: parseNum(j['month_revenue']),
        cashTotal: parseNum(j['cash_total']),
        totalDebt: parseNum(j['total_debt']),
        stockValue: parseNum(j['stock_value']),
      );
}

/// `GET /statistics/daily-revenue` row (`statistics/router.py:71`) — feeds
/// `revenue_chart.dart`'s sparkline on the Dashboard.
class DailyRevenuePoint {
  final DateTime date;
  final int count;
  final num revenue;

  const DailyRevenuePoint({required this.date, required this.count, required this.revenue});

  factory DailyRevenuePoint.fromJson(Map<String, dynamic> j) => DailyRevenuePoint(
        date: DateTime.tryParse(j['date']?.toString() ?? '') ?? DateTime.now(),
        count: parseNum(j['count']).toInt(),
        revenue: parseNum(j['revenue']),
      );
}

class DashboardService {
  static Dio get _dio => ApiClient.instance;

  static Future<DashboardSummary> fetchSummary() async {
    final res = await _dio.get<Map<String, dynamic>>('/statistics/dashboard');
    return DashboardSummary.fromJson(res.data ?? {});
  }

  static Future<List<DailyRevenuePoint>> fetchDailyRevenue({int days = 14}) async {
    final res = await _dio.get<List<dynamic>>(
      '/statistics/daily-revenue',
      queryParameters: {'days': days},
    );
    final list = res.data ?? [];
    return list.map((e) => DailyRevenuePoint.fromJson(e as Map<String, dynamic>)).toList();
  }
}
