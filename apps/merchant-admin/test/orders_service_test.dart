import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/services/orders_service.dart';

void main() {
  group('SaleSummary.fromJson', () {
    test('parses money fields serialized as strings', () {
      final sale = SaleSummary.fromJson({
        'id': 'abc',
        'doc_number': 'A-100',
        'uuid_label': 'A100',
        'total_amount': '12500.00',
        'paid_amount': '12500.00',
        'status': 'paid',
        'source_type': 'sale',
      });
      expect(sale.totalAmount, 12500.00);
      expect(sale.paidAmount, 12500.00);
      expect(sale.displayStatus, 'paid');
    });

    test('kiosk source_type prefers kiosk_status over status', () {
      final sale = SaleSummary.fromJson({
        'id': 'abc',
        'uuid_label': 'A1',
        'total_amount': 1000,
        'paid_amount': 0,
        'status': 'confirmed',
        'source_type': 'sale_kiosk',
        'kiosk_status': 'awaiting_payment',
      });
      expect(sale.displayStatus, 'awaiting_payment');
    });

    test('non-kiosk sale always shows plain status', () {
      final sale = SaleSummary.fromJson({
        'id': 'abc',
        'uuid_label': 'A1',
        'total_amount': 1000,
        'paid_amount': 0,
        'status': 'confirmed',
        'source_type': 'sale',
        'kiosk_status': null,
      });
      expect(sale.displayStatus, 'confirmed');
    });
  });

  group('SaleDetail.fromJson', () {
    test('parses head + items', () {
      final detail = SaleDetail.fromJson({
        'head': {
          'id': 'abc',
          'uuid_label': 'A1',
          'total_amount': '500.50',
          'paid_amount': '0',
          'status': 'confirmed',
          'source_type': 'sale',
          'customer_address': 'Toshkent',
        },
        'items': [
          {
            'product_id': 'p1',
            'product_name': 'Non',
            'quantity': 2,
            'price': '1000.00',
            'discount': 0,
            'amount': '2000.00',
          }
        ],
      });
      expect(detail.head.totalAmount, 500.50);
      expect(detail.customerAddress, 'Toshkent');
      expect(detail.items, hasLength(1));
      expect(detail.items.first.productName, 'Non');
      expect(detail.items.first.amount, 2000.00);
    });

    test('missing items list defaults to empty, does not throw', () {
      final detail = SaleDetail.fromJson({
        'head': {'id': 'abc', 'uuid_label': 'A1', 'total_amount': 0, 'paid_amount': 0, 'status': 'paid'},
      });
      expect(detail.items, isEmpty);
    });
  });
}
