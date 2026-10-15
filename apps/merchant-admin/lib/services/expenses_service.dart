import 'package:dio/dio.dart';
import '../utils/num_parse.dart';
import 'api_client.dart';

class CashboxOption {
  final int id;
  final String name;
  final int currencyId;
  final String? currencyCode;

  const CashboxOption({
    required this.id,
    required this.name,
    required this.currencyId,
    this.currencyCode,
  });

  factory CashboxOption.fromJson(Map<String, dynamic> j) => CashboxOption(
        id: int.tryParse(j['id']?.toString() ?? '') ?? 0,
        name: j['name']?.toString() ?? '',
        currencyId: int.tryParse(j['currency_id']?.toString() ?? '') ?? 0,
        currencyCode: j['currency_code']?.toString(),
      );
}

class ExtraCost {
  final String id;
  final DateTime? costDate;
  final String category;
  final num amount;
  final String? description;
  final String? cashboxName;
  final String? currencyCode;

  const ExtraCost({
    required this.id,
    this.costDate,
    required this.category,
    required this.amount,
    this.description,
    this.cashboxName,
    this.currencyCode,
  });

  factory ExtraCost.fromJson(Map<String, dynamic> j) => ExtraCost(
        id: j['id']?.toString() ?? '',
        costDate: DateTime.tryParse(j['cost_date']?.toString() ?? ''),
        category: j['category']?.toString() ?? '',
        amount: parseNum(j['amount']),
        description: j['description']?.toString(),
        cashboxName: j['cashbox_name']?.toString(),
        currencyCode: j['currency_code']?.toString(),
      );
}

/// `finance/router.py:452,479,529` — `finance.extra-costs`. Create posts
/// immediately and the caller re-fetches the list (no optimistic insert,
/// server is authoritative for the generated id/derived fields).
class ExpensesService {
  static Dio get _dio => ApiClient.instance;

  static Future<List<CashboxOption>> fetchCashboxes() async {
    final res = await _dio.get<List<dynamic>>('/finance/cashboxes');
    final list = res.data ?? [];
    return list.map((e) => CashboxOption.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<ExtraCost>> fetchExpenses({DateTime? dateFrom, DateTime? dateTo}) async {
    final res = await _dio.get<List<dynamic>>('/finance/extra-costs', queryParameters: {
      if (dateFrom != null) 'date_from': dateFrom.toIso8601String().substring(0, 10),
      if (dateTo != null) 'date_to': dateTo.toIso8601String().substring(0, 10),
    });
    final list = res.data ?? [];
    return list.map((e) => ExtraCost.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> createExpense({
    required DateTime costDate,
    required String category,
    required num amount,
    required int currencyId,
    int? cashboxId,
    String? description,
  }) {
    return _dio.post('/finance/extra-costs', data: {
      'cost_date': costDate.toIso8601String(),
      'category': category,
      'amount': amount,
      'currency_id': currencyId,
      'cashbox_id': cashboxId,
      'description': description,
    });
  }

  static Future<void> deleteExpense(String id) {
    return _dio.delete('/finance/extra-costs/$id');
  }
}
