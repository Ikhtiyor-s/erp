import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/services/expenses_service.dart';

void main() {
  group('ExtraCost.fromJson', () {
    test('parses amount serialized as a decimal string', () {
      final cost = ExtraCost.fromJson({
        'id': 'c1',
        'cost_date': '2026-10-14',
        'category': 'Kommunal',
        'amount': '450000.00',
        'description': 'Elektr energiyasi',
        'cashbox_name': 'Asosiy kassa',
        'currency_code': 'UZS',
      });
      expect(cost.category, 'Kommunal');
      expect(cost.amount, 450000.00);
      expect(cost.currencyCode, 'UZS');
    });

    test('whole-valued amount serialized as a number still parses', () {
      final cost = ExtraCost.fromJson({
        'id': 'c1',
        'category': 'Boshqa',
        'amount': 3,
      });
      expect(cost.amount, 3);
    });
  });

  group('CashboxOption.fromJson', () {
    test('parses currency_id as int for the create-expense form', () {
      final option = CashboxOption.fromJson({
        'id': 1,
        'name': 'Asosiy kassa',
        'currency_id': 2,
        'currency_code': 'UZS',
      });
      expect(option.currencyId, 2);
    });
  });
}
