import 'package:dio/dio.dart';
import '../utils/num_parse.dart';
import 'api_client.dart';

class Employee {
  final String id;
  final String fullName;
  final String? positionName;
  final String? phone;
  final num? salary;
  final String? currencyCode;

  const Employee({
    required this.id,
    required this.fullName,
    this.positionName,
    this.phone,
    this.salary,
    this.currencyCode,
  });

  factory Employee.fromJson(Map<String, dynamic> j) => Employee(
        id: j['id']?.toString() ?? '',
        fullName: j['full_name']?.toString() ?? '',
        positionName: j['position_name']?.toString(),
        phone: j['phone']?.toString(),
        salary: j['salary'] == null ? null : parseNum(j['salary']),
        currencyCode: j['currency_code']?.toString(),
      );
}

class PayrollRun {
  final String id;
  final DateTime? periodMonth;
  final String status;
  final num employeeCount;
  final num totalNet;

  const PayrollRun({
    required this.id,
    this.periodMonth,
    required this.status,
    required this.employeeCount,
    required this.totalNet,
  });

  factory PayrollRun.fromJson(Map<String, dynamic> j) => PayrollRun(
        id: j['id']?.toString() ?? '',
        periodMonth: DateTime.tryParse(j['period_month']?.toString() ?? ''),
        status: j['status']?.toString() ?? 'draft',
        employeeCount: parseNum(j['employee_count']),
        totalNet: parseNum(j['total_net']),
      );
}

class PayrollItem {
  final int id;
  final String employeeId;
  final String employeeName;
  final num baseSalary;
  final num bonus;
  final num deductions;
  final num advanceDeducted;
  final num netPay;

  const PayrollItem({
    required this.id,
    required this.employeeId,
    required this.employeeName,
    required this.baseSalary,
    required this.bonus,
    required this.deductions,
    required this.advanceDeducted,
    required this.netPay,
  });

  factory PayrollItem.fromJson(Map<String, dynamic> j) => PayrollItem(
        id: int.tryParse(j['id']?.toString() ?? '') ?? 0,
        employeeId: j['employee_id']?.toString() ?? '',
        employeeName: j['employee_name']?.toString() ?? '',
        baseSalary: parseNum(j['base_salary']),
        bonus: parseNum(j['bonus']),
        deductions: parseNum(j['deductions']),
        advanceDeducted: parseNum(j['advance_deducted']),
        netPay: parseNum(j['net_pay']),
      );
}

class PayrollRunDetail {
  final PayrollRun head;
  final List<PayrollItem> items;
  const PayrollRunDetail({required this.head, required this.items});

  factory PayrollRunDetail.fromJson(Map<String, dynamic> j) {
    final head = (j['head'] as Map<String, dynamic>?) ?? const {};
    final items = (j['items'] as List<dynamic>?) ?? const [];
    return PayrollRunDetail(
      head: PayrollRun.fromJson(head),
      items: items.map((e) => PayrollItem.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

/// Employees (`hr/router.py:98`), attendance clock-in/out
/// (`hr/router.py:437,484`), and payroll runs (`hr/payroll_router.py`).
/// Payroll approve/pay stay gated behind `hr.payroll.approve`/`hr.payroll.pay`
/// in the screen — `manager` holds neither (DESIGN-merchant-admin.md §6.4).
class StaffService {
  static Dio get _dio => ApiClient.instance;

  static Future<List<Employee>> fetchEmployees({String? q}) async {
    final res = await _dio.get<List<dynamic>>('/hr/employees', queryParameters: {
      if (q != null && q.isNotEmpty) 'q': q,
    });
    final list = res.data ?? [];
    return list.map((e) => Employee.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> clockIn(String employeeId) {
    return _dio.post('/hr/attendance/clock-in', data: {'employee_id': employeeId});
  }

  static Future<void> clockOut(String employeeId) {
    return _dio.post('/hr/attendance/clock-out', data: {'employee_id': employeeId});
  }

  static Future<List<PayrollRun>> fetchPayrollRuns() async {
    final res = await _dio.get<List<dynamic>>('/hr/payroll/runs');
    final list = res.data ?? [];
    return list.map((e) => PayrollRun.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<PayrollRunDetail> fetchPayrollRunDetail(String runId) async {
    final res = await _dio.get<Map<String, dynamic>>('/hr/payroll/runs/$runId');
    return PayrollRunDetail.fromJson(res.data ?? const {});
  }

  static Future<void> createPayrollRun({required DateTime periodMonth, num taxRate = 0}) {
    final iso = periodMonth.toIso8601String().substring(0, 10);
    return _dio.post('/hr/payroll/runs', data: {'period_month': iso, 'tax_rate': taxRate});
  }

  static Future<void> approvePayrollRun(String runId) {
    return _dio.post('/hr/payroll/runs/$runId/approve');
  }

  static Future<void> payPayrollRun(String runId, int cashboxId) {
    return _dio.post('/hr/payroll/runs/$runId/pay', data: {'cashbox_id': cashboxId});
  }
}
