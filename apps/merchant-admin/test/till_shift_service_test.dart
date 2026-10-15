import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/services/till_shift_service.dart';

void main() {
  group('CashboxSession.fromJson', () {
    test('tolerates unknown/extra keys (DESIGN §8.4 — column set not fully enumerable)', () {
      final session = CashboxSession.fromJson({
        'id': 's1',
        'cashbox_id': 3,
        'cashbox_name': 'Asosiy kassa',
        'status': 'open',
        'opened_balance': '100000.00',
        'total_income': '0',
        'total_expense': '0',
        'sale_count': 0,
        'some_unknown_future_column': 'xyz',
      });
      expect(session.id, 's1');
      expect(session.cashboxId, 3);
      expect(session.openedBalance, 100000.00);
      expect(session.closedBalance, isNull);
    });

    test('parses closed session fields when present', () {
      final session = CashboxSession.fromJson({
        'id': 's1',
        'cashbox_id': 3,
        'status': 'closed',
        'opened_balance': 0,
        'closed_balance': '55000.00',
        'total_income': '55000.00',
        'total_expense': '0',
        'sale_count': 4,
      });
      expect(session.closedBalance, 55000.00);
      expect(session.saleCount, 4);
    });
  });

  group('SessionTotals.fromJson', () {
    test('parses money fields serialized as strings', () {
      final totals = SessionTotals.fromJson({
        'total_income': '150000.00',
        'total_expense': '20000.00',
        'sale_count': 7,
      });
      expect(totals.totalIncome, 150000.00);
      expect(totals.totalExpense, 20000.00);
      expect(totals.saleCount, 7);
    });
  });

  group('CashboxSummary.fromJson', () {
    test('filters only applied by caller — model parses is_active plainly', () {
      final cashbox = CashboxSummary.fromJson({
        'id': 1,
        'name': 'Kassa 1',
        'currency_code': 'UZS',
        'balance': '0',
        'is_active': true,
      });
      expect(cashbox.id, 1);
      expect(cashbox.isActive, isTrue);
    });
  });
}
