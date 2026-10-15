import 'package:dio/dio.dart';
import '../utils/num_parse.dart';
import 'api_client.dart';

String formatMoney(num value) {
  final rounded = value.round();
  final isWhole = (value - rounded).abs() < 0.005;
  final display = isWhole ? rounded.toString() : value.toStringAsFixed(2);
  final parts = display.split('.');
  final intPart = parts[0];
  final negative = intPart.startsWith('-');
  final digits = negative ? intPart.substring(1) : intPart;
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  final grouped = '${negative ? '-' : ''}${buffer.toString()}';
  return parts.length > 1 ? '$grouped.${parts[1]}' : grouped;
}

String formatDateQuery(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime? _parseDate(dynamic v) {
  final s = v?.toString();
  if (s == null || s.isEmpty) return null;
  return DateTime.tryParse(s);
}

/// `GET /statistics/sales-summary` row (`v_sales_summary`,
/// `statistics/router.py:99`).
class SalesSummaryRow {
  final DateTime day;
  final int salesCount;
  final num revenue;
  final num paid;
  final num debt;

  const SalesSummaryRow({
    required this.day,
    required this.salesCount,
    required this.revenue,
    required this.paid,
    required this.debt,
  });

  factory SalesSummaryRow.fromJson(Map<String, dynamic> j) => SalesSummaryRow(
        day: _parseDate(j['day']) ?? DateTime.now(),
        salesCount: parseNum(j['sales_count']).toInt(),
        revenue: parseNum(j['revenue']),
        paid: parseNum(j['paid']),
        debt: parseNum(j['debt']),
      );
}

/// `GET /statistics/sale-by-category` row (`statistics/router.py:250`).
class SaleByCategoryRow {
  final String category;
  final int salesCount;
  final num qty;
  final num revenue;

  const SaleByCategoryRow({
    required this.category,
    required this.salesCount,
    required this.qty,
    required this.revenue,
  });

  factory SaleByCategoryRow.fromJson(Map<String, dynamic> j) => SaleByCategoryRow(
        category: j['category']?.toString() ?? '—',
        salesCount: parseNum(j['sales_cnt']).toInt(),
        qty: parseNum(j['qty']),
        revenue: parseNum(j['revenue']),
      );
}

/// `GET /statistics/sale-by-employee` row (`statistics/router.py:277`).
class SaleByEmployeeRow {
  final String employee;
  final int salesCount;
  final num revenue;
  final num avgCheck;

  const SaleByEmployeeRow({
    required this.employee,
    required this.salesCount,
    required this.revenue,
    required this.avgCheck,
  });

  factory SaleByEmployeeRow.fromJson(Map<String, dynamic> j) => SaleByEmployeeRow(
        employee: j['employee']?.toString() ?? '—',
        salesCount: parseNum(j['sales_cnt']).toInt(),
        revenue: parseNum(j['revenue']),
        avgCheck: parseNum(j['avg_check']),
      );
}

/// `GET /statistics/sale-by-payment-type` row (`statistics/router.py:326`).
class SaleByPaymentTypeRow {
  final String paymentType;
  final int paymentsCount;
  final num total;

  const SaleByPaymentTypeRow({
    required this.paymentType,
    required this.paymentsCount,
    required this.total,
  });

  factory SaleByPaymentTypeRow.fromJson(Map<String, dynamic> j) => SaleByPaymentTypeRow(
        paymentType: j['payment_type']?.toString() ?? '—',
        paymentsCount: parseNum(j['payments_cnt']).toInt(),
        total: parseNum(j['total']),
      );
}

/// `GET /statistics/sale-by-customer` row (`statistics/router.py:301`).
class SaleByCustomerRow {
  final String customer;
  final int salesCount;
  final num revenue;
  final num paid;
  final num debt;

  const SaleByCustomerRow({
    required this.customer,
    required this.salesCount,
    required this.revenue,
    required this.paid,
    required this.debt,
  });

  factory SaleByCustomerRow.fromJson(Map<String, dynamic> j) => SaleByCustomerRow(
        customer: j['customer']?.toString() ?? '—',
        salesCount: parseNum(j['sales_cnt']).toInt(),
        revenue: parseNum(j['revenue']),
        paid: parseNum(j['paid']),
        debt: parseNum(j['debt']),
      );
}

/// `GET /statistics/unsold-goods` row (`statistics/router.py:179`).
class UnsoldGoodRow {
  final String id;
  final String name;
  final String? sku;
  final num salePrice;
  final num stockQty;
  final DateTime? lastSale;

  const UnsoldGoodRow({
    required this.id,
    required this.name,
    this.sku,
    required this.salePrice,
    required this.stockQty,
    this.lastSale,
  });

  factory UnsoldGoodRow.fromJson(Map<String, dynamic> j) => UnsoldGoodRow(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '—',
        sku: j['sku']?.toString(),
        salePrice: parseNum(j['sale_price']),
        stockQty: parseNum(j['stock_qty']),
        lastSale: _parseDate(j['last_sale']),
      );
}

/// `GET /statistics/customer-activity` row (`statistics/router.py:352`).
class CustomerActivityRow {
  final String id;
  final String name;
  final DateTime? lastSale;
  final int salesCount;
  final num revenue;
  final int? daysInactive;

  const CustomerActivityRow({
    required this.id,
    required this.name,
    this.lastSale,
    required this.salesCount,
    required this.revenue,
    this.daysInactive,
  });

  factory CustomerActivityRow.fromJson(Map<String, dynamic> j) => CustomerActivityRow(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '—',
        lastSale: _parseDate(j['last_sale']),
        salesCount: parseNum(j['sales_cnt']).toInt(),
        revenue: parseNum(j['revenue']),
        daysInactive: j['days_inactive'] == null ? null : parseNum(j['days_inactive']).toInt(),
      );
}

/// `GET /statistics/cogs` by-product row (`statistics/router.py:433`).
class CogsProductRow {
  final String productId;
  final String productName;
  final num soldQty;
  final num revenue;
  final num cogs;
  final num profit;
  final num marginPct;

  const CogsProductRow({
    required this.productId,
    required this.productName,
    required this.soldQty,
    required this.revenue,
    required this.cogs,
    required this.profit,
    required this.marginPct,
  });

  factory CogsProductRow.fromJson(Map<String, dynamic> j) => CogsProductRow(
        productId: j['product_id']?.toString() ?? '',
        productName: j['product_name']?.toString() ?? '—',
        soldQty: parseNum(j['sold_qty']),
        revenue: parseNum(j['revenue']),
        cogs: parseNum(j['cogs']),
        profit: parseNum(j['profit']),
        marginPct: parseNum(j['margin_pct']),
      );
}

/// `GET /statistics/cogs` by-category row.
class CogsCategoryRow {
  final int? categoryId;
  final String categoryName;
  final num revenue;
  final num cogs;
  final num profit;
  final num marginPct;

  const CogsCategoryRow({
    this.categoryId,
    required this.categoryName,
    required this.revenue,
    required this.cogs,
    required this.profit,
    required this.marginPct,
  });

  factory CogsCategoryRow.fromJson(Map<String, dynamic> j) => CogsCategoryRow(
        categoryId: j['category_id'] == null ? null : parseNum(j['category_id']).toInt(),
        categoryName: j['category_name']?.toString() ?? '—',
        revenue: parseNum(j['revenue']),
        cogs: parseNum(j['cogs']),
        profit: parseNum(j['profit']),
        marginPct: parseNum(j['margin_pct']),
      );
}

/// `GET /statistics/cogs` by-warehouse row.
class CogsWarehouseRow {
  final int? warehouseId;
  final String warehouseName;
  final num revenue;
  final num cogs;
  final num profit;
  final num marginPct;

  const CogsWarehouseRow({
    this.warehouseId,
    required this.warehouseName,
    required this.revenue,
    required this.cogs,
    required this.profit,
    required this.marginPct,
  });

  factory CogsWarehouseRow.fromJson(Map<String, dynamic> j) => CogsWarehouseRow(
        warehouseId: j['warehouse_id'] == null ? null : parseNum(j['warehouse_id']).toInt(),
        warehouseName: j['warehouse_name']?.toString() ?? '—',
        revenue: parseNum(j['revenue']),
        cogs: parseNum(j['cogs']),
        profit: parseNum(j['profit']),
        marginPct: parseNum(j['margin_pct']),
      );
}

/// `GET /statistics/cogs` full response (`statistics/router.py:433-572`).
/// Gated by `statistics.cogs.view` (explicit `require_permission`, §6.3).
class CogsReport {
  final num totalRevenue;
  final num totalCogs;
  final num grossProfit;
  final num grossMarginPct;
  final List<CogsProductRow> byProduct;
  final List<CogsCategoryRow> byCategory;
  final List<CogsWarehouseRow> byWarehouse;

  const CogsReport({
    required this.totalRevenue,
    required this.totalCogs,
    required this.grossProfit,
    required this.grossMarginPct,
    required this.byProduct,
    required this.byCategory,
    required this.byWarehouse,
  });

  factory CogsReport.fromJson(Map<String, dynamic> j) => CogsReport(
        totalRevenue: parseNum(j['total_revenue']),
        totalCogs: parseNum(j['total_cogs']),
        grossProfit: parseNum(j['gross_profit']),
        grossMarginPct: parseNum(j['gross_margin_pct']),
        byProduct: ((j['by_product'] as List<dynamic>?) ?? const [])
            .map((e) => CogsProductRow.fromJson(e as Map<String, dynamic>))
            .toList(),
        byCategory: ((j['by_category'] as List<dynamic>?) ?? const [])
            .map((e) => CogsCategoryRow.fromJson(e as Map<String, dynamic>))
            .toList(),
        byWarehouse: ((j['by_warehouse'] as List<dynamic>?) ?? const [])
            .map((e) => CogsWarehouseRow.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// Bundles the three breakdowns `statistics_overview_screen.dart` renders
/// side by side, fetched in one `Future.wait` round-trip.
class OverviewData {
  final List<SaleByCategoryRow> byCategory;
  final List<SaleByEmployeeRow> byEmployee;
  final List<SaleByPaymentTypeRow> byPaymentType;

  const OverviewData({
    required this.byCategory,
    required this.byEmployee,
    required this.byPaymentType,
  });
}

/// Wraps the `statistics` module endpoints this app calls
/// (DESIGN-merchant-admin.md §6.3), all derived from `statistics.view`
/// except `/cogs` (explicit `statistics.cogs.view`). No endpoint here
/// mutates data — read-only reporting, pull-to-refresh is the only
/// freshness mechanism (§1.2, no realtime layer).
class StatisticsService {
  static Dio get _dio => ApiClient.instance;

  static Future<OverviewData> fetchOverview(DateTime dateFrom, DateTime dateTo) async {
    final results = await Future.wait([
      fetchSaleByCategory(dateFrom, dateTo),
      fetchSaleByEmployee(dateFrom, dateTo),
      fetchSaleByPaymentType(dateFrom, dateTo),
    ]);
    return OverviewData(
      byCategory: results[0] as List<SaleByCategoryRow>,
      byEmployee: results[1] as List<SaleByEmployeeRow>,
      byPaymentType: results[2] as List<SaleByPaymentTypeRow>,
    );
  }

  static Future<List<SalesSummaryRow>> fetchSalesSummary(
    DateTime dateFrom,
    DateTime dateTo,
  ) async {
    final res = await _dio.get<List<dynamic>>(
      '/statistics/sales-summary',
      queryParameters: {'date_from': formatDateQuery(dateFrom), 'date_to': formatDateQuery(dateTo)},
    );
    final list = res.data ?? [];
    return list.map((e) => SalesSummaryRow.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<SaleByCategoryRow>> fetchSaleByCategory(
    DateTime dateFrom,
    DateTime dateTo,
  ) async {
    final res = await _dio.get<List<dynamic>>(
      '/statistics/sale-by-category',
      queryParameters: {'date_from': formatDateQuery(dateFrom), 'date_to': formatDateQuery(dateTo)},
    );
    final list = res.data ?? [];
    return list.map((e) => SaleByCategoryRow.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<SaleByEmployeeRow>> fetchSaleByEmployee(
    DateTime dateFrom,
    DateTime dateTo,
  ) async {
    final res = await _dio.get<List<dynamic>>(
      '/statistics/sale-by-employee',
      queryParameters: {'date_from': formatDateQuery(dateFrom), 'date_to': formatDateQuery(dateTo)},
    );
    final list = res.data ?? [];
    return list.map((e) => SaleByEmployeeRow.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<SaleByPaymentTypeRow>> fetchSaleByPaymentType(
    DateTime dateFrom,
    DateTime dateTo,
  ) async {
    final res = await _dio.get<List<dynamic>>(
      '/statistics/sale-by-payment-type',
      queryParameters: {'date_from': formatDateQuery(dateFrom), 'date_to': formatDateQuery(dateTo)},
    );
    final list = res.data ?? [];
    return list.map((e) => SaleByPaymentTypeRow.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<SaleByCustomerRow>> fetchSaleByCustomer(
    DateTime dateFrom,
    DateTime dateTo,
  ) async {
    final res = await _dio.get<List<dynamic>>(
      '/statistics/sale-by-customer',
      queryParameters: {'date_from': formatDateQuery(dateFrom), 'date_to': formatDateQuery(dateTo)},
    );
    final list = res.data ?? [];
    return list.map((e) => SaleByCustomerRow.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<UnsoldGoodRow>> fetchUnsoldGoods({int days = 30}) async {
    final res = await _dio.get<List<dynamic>>(
      '/statistics/unsold-goods',
      queryParameters: {'days': days},
    );
    final list = res.data ?? [];
    return list.map((e) => UnsoldGoodRow.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<CustomerActivityRow>> fetchCustomerActivity() async {
    final res = await _dio.get<List<dynamic>>('/statistics/customer-activity');
    final list = res.data ?? [];
    return list.map((e) => CustomerActivityRow.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<CogsReport> fetchCogs(DateTime dateFrom, DateTime dateTo) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/statistics/cogs',
      queryParameters: {'date_from': formatDateQuery(dateFrom), 'date_to': formatDateQuery(dateTo)},
    );
    return CogsReport.fromJson(res.data ?? {});
  }

  /// `GET /statistics/export/{report}` (`statistics/router.py:587`) — returns
  /// raw CSV text. `date_from`/`date_to` are omitted for reports that don't
  /// need them (`unsold-goods`, `customer-activity`); `sale-by-customer`
  /// requires both.
  static Future<String> exportCsv(
    String report, {
    DateTime? dateFrom,
    DateTime? dateTo,
  }) async {
    final query = <String, dynamic>{};
    if (dateFrom != null) query['date_from'] = formatDateQuery(dateFrom);
    if (dateTo != null) query['date_to'] = formatDateQuery(dateTo);
    final res = await _dio.get<String>(
      '/statistics/export/$report',
      queryParameters: query,
      options: Options(responseType: ResponseType.plain),
    );
    return res.data ?? '';
  }
}
