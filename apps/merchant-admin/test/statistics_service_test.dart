import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/services/statistics_service.dart';

void main() {
  group('formatMoney', () {
    test('groups thousands with spaces for whole numbers', () {
      expect(formatMoney(1500000), '1 500 000');
      expect(formatMoney(999), '999');
      expect(formatMoney(0), '0');
    });

    test('keeps two decimals for fractional values', () {
      expect(formatMoney(1234.5), '1 234.50');
    });

    test('handles negative values', () {
      expect(formatMoney(-125000), '-125 000');
    });
  });

  group('SalesSummaryRow.fromJson (v_sales_summary)', () {
    test('parses day/sales_count/revenue/paid/debt', () {
      final row = SalesSummaryRow.fromJson({
        'day': '2026-10-10',
        'sales_count': 7,
        'revenue': '350000.00',
        'paid': '300000.00',
        'debt': '50000.00',
      });

      expect(row.day, DateTime(2026, 10, 10));
      expect(row.salesCount, 7);
      expect(row.revenue, 350000.0);
      expect(row.paid, 300000.0);
      expect(row.debt, 50000.0);
    });
  });

  group('SaleByCategoryRow.fromJson', () {
    test('parses category/sales_cnt/qty/revenue field names exactly', () {
      final row = SaleByCategoryRow.fromJson({
        'category': 'Ichimliklar',
        'sales_cnt': 12,
        'qty': '40',
        'revenue': '480000.00',
      });

      expect(row.category, 'Ichimliklar');
      expect(row.salesCount, 12);
      expect(row.qty, 40);
      expect(row.revenue, 480000.0);
    });

    test('defaults category to a dash when null (matches backend\'s own fallback)', () {
      final row = SaleByCategoryRow.fromJson({'sales_cnt': 0, 'qty': 0, 'revenue': 0});
      expect(row.category, '—');
    });
  });

  group('SaleByEmployeeRow.fromJson', () {
    test('parses employee/sales_cnt/revenue/avg_check', () {
      final row = SaleByEmployeeRow.fromJson({
        'employee': 'Aliyev Vali',
        'sales_cnt': 5,
        'revenue': '100000',
        'avg_check': '20000.00',
      });

      expect(row.employee, 'Aliyev Vali');
      expect(row.salesCount, 5);
      expect(row.revenue, 100000);
      expect(row.avgCheck, 20000.0);
    });
  });

  group('SaleByPaymentTypeRow.fromJson', () {
    test('parses payment_type/payments_cnt/total', () {
      final row = SaleByPaymentTypeRow.fromJson({
        'payment_type': 'Naqd',
        'payments_cnt': 9,
        'total': '900000.00',
      });

      expect(row.paymentType, 'Naqd');
      expect(row.paymentsCount, 9);
      expect(row.total, 900000.0);
    });
  });

  group('SaleByCustomerRow.fromJson', () {
    test('parses customer/sales_cnt/revenue/paid/debt', () {
      final row = SaleByCustomerRow.fromJson({
        'customer': 'Olimov Botir',
        'sales_cnt': 3,
        'revenue': '60000.00',
        'paid': '40000.00',
        'debt': '20000.00',
      });

      expect(row.customer, 'Olimov Botir');
      expect(row.debt, 20000.0);
    });
  });

  group('UnsoldGoodRow.fromJson', () {
    test('parses id/name/sku/sale_price/stock_qty/last_sale, tolerates null last_sale', () {
      final row = UnsoldGoodRow.fromJson({
        'id': 'a1b2',
        'name': 'Stul',
        'sku': 'SKU-1',
        'sale_price': '150000.00',
        'stock_qty': '10',
        'last_sale': null,
      });

      expect(row.id, 'a1b2');
      expect(row.salePrice, 150000.0);
      expect(row.stockQty, 10);
      expect(row.lastSale, isNull);
    });
  });

  group('CustomerActivityRow.fromJson', () {
    test('parses days_inactive as nullable int', () {
      final row = CustomerActivityRow.fromJson({
        'id': '1',
        'name': 'Mijoz',
        'last_sale': '2026-09-01',
        'sales_cnt': 4,
        'revenue': '80000.00',
        'days_inactive': 43,
      });

      expect(row.daysInactive, 43);
      expect(row.lastSale, DateTime.tryParse('2026-09-01'));
    });

    test('days_inactive stays null when backend sends null', () {
      final row = CustomerActivityRow.fromJson({
        'id': '1',
        'name': 'Mijoz',
        'sales_cnt': 0,
        'revenue': 0,
        'days_inactive': null,
      });
      expect(row.daysInactive, isNull);
    });
  });

  group('CogsReport.fromJson', () {
    test('parses string-typed Decimal totals and nested breakdowns (§8.3)', () {
      final report = CogsReport.fromJson({
        'total_revenue': '1000000.00',
        'total_cogs': '600000.00',
        'gross_profit': '400000.00',
        'gross_margin_pct': 40.0,
        'by_product': [
          {
            'product_id': 'p1',
            'product_name': 'Mahsulot A',
            'sold_qty': 10.0,
            'revenue': '500000.00',
            'cogs': '300000.00',
            'profit': '200000.00',
            'margin_pct': 40.0,
          }
        ],
        'by_category': [
          {
            'category_id': 2,
            'category_name': 'Kategoriya A',
            'revenue': '500000.00',
            'cogs': '300000.00',
            'profit': '200000.00',
            'margin_pct': 40.0,
          }
        ],
        'by_warehouse': [
          {
            'warehouse_id': null,
            'warehouse_name': '— kategoriyasiz —',
            'revenue': '500000.00',
            'cogs': '300000.00',
            'profit': '200000.00',
            'margin_pct': 40.0,
          }
        ],
      });

      expect(report.totalRevenue, 1000000.0);
      expect(report.grossMarginPct, 40.0);
      expect(report.byProduct, hasLength(1));
      expect(report.byProduct.first.productId, 'p1');
      expect(report.byCategory.first.categoryId, 2);
      expect(report.byWarehouse.first.warehouseId, isNull);
    });

    test('empty report arrays parse to empty lists, not null errors', () {
      final report = CogsReport.fromJson({
        'total_revenue': '0',
        'total_cogs': '0',
        'gross_profit': '0',
        'gross_margin_pct': 0,
      });

      expect(report.byProduct, isEmpty);
      expect(report.byCategory, isEmpty);
      expect(report.byWarehouse, isEmpty);
    });
  });
}
