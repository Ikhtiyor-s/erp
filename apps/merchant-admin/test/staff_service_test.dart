import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/services/staff_service.dart';

void main() {
  group('Employee.fromJson', () {
    test('parses decimal salary serialized as string', () {
      final employee = Employee.fromJson({
        'id': 'e1',
        'full_name': 'Ali Valiyev',
        'position_name': 'Sotuvchi',
        'phone': '+998901234567',
        'salary': '3500000.00',
        'currency_code': 'UZS',
      });
      expect(employee.fullName, 'Ali Valiyev');
      expect(employee.salary, 3500000.00);
    });

    test('null salary stays null, does not throw', () {
      final employee = Employee.fromJson({'id': 'e1', 'full_name': 'Ali'});
      expect(employee.salary, isNull);
    });
  });

  group('PayrollRun.fromJson', () {
    test('parses period_month and totals', () {
      final run = PayrollRun.fromJson({
        'id': 'r1',
        'period_month': '2026-10-01',
        'status': 'draft',
        'employee_count': 5,
        'total_net': '17500000.00',
      });
      expect(run.status, 'draft');
      expect(run.employeeCount, 5);
      expect(run.totalNet, 17500000.00);
      expect(run.periodMonth?.month, 10);
    });
  });

  group('PayrollRunDetail.fromJson', () {
    test('parses head + items', () {
      final detail = PayrollRunDetail.fromJson({
        'head': {
          'id': 'r1',
          'status': 'approved',
          'employee_count': 1,
          'total_net': '3000000.00',
        },
        'items': [
          {
            'id': 1,
            'employee_id': 'e1',
            'employee_name': 'Ali Valiyev',
            'base_salary': '3500000.00',
            'bonus': 0,
            'deductions': '500000.00',
            'advance_deducted': 0,
            'net_pay': '3000000.00',
          }
        ],
      });
      expect(detail.head.status, 'approved');
      expect(detail.items, hasLength(1));
      expect(detail.items.first.netPay, 3000000.00);
    });
  });
}
