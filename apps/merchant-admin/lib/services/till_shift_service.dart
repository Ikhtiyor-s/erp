import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/num_parse.dart';
import 'api_client.dart';

class CashboxSummary {
  final int id;
  final String name;
  final String? currencyCode;
  final num balance;
  final bool isActive;

  const CashboxSummary({
    required this.id,
    required this.name,
    this.currencyCode,
    required this.balance,
    required this.isActive,
  });

  factory CashboxSummary.fromJson(Map<String, dynamic> j) => CashboxSummary(
        id: int.tryParse(j['id']?.toString() ?? '') ?? 0,
        name: j['name']?.toString() ?? '',
        currencyCode: j['currency_code']?.toString(),
        balance: parseNum(j['balance']),
        isActive: j['is_active'] == true,
      );
}

/// `cashbox_sessions` row (DESIGN-merchant-admin.md §8.4) — column set not
/// fully enumerable from the router file (`cs.*`), so this model tolerates
/// unknown/missing keys rather than failing strictly.
class CashboxSession {
  final String id;
  final int cashboxId;
  final String? cashboxName;
  final String status;
  final DateTime? openedAt;
  final num openedBalance;
  final num? closedBalance;
  final num totalIncome;
  final num totalExpense;
  final num saleCount;

  const CashboxSession({
    required this.id,
    required this.cashboxId,
    this.cashboxName,
    required this.status,
    this.openedAt,
    required this.openedBalance,
    this.closedBalance,
    required this.totalIncome,
    required this.totalExpense,
    required this.saleCount,
  });

  factory CashboxSession.fromJson(Map<String, dynamic> j) => CashboxSession(
        id: j['id']?.toString() ?? '',
        cashboxId: int.tryParse(j['cashbox_id']?.toString() ?? '') ?? 0,
        cashboxName: j['cashbox_name']?.toString(),
        status: j['status']?.toString() ?? 'open',
        openedAt: DateTime.tryParse(j['opened_at']?.toString() ?? ''),
        openedBalance: parseNum(j['opened_balance']),
        closedBalance: j['closed_balance'] == null ? null : parseNum(j['closed_balance']),
        totalIncome: parseNum(j['total_income']),
        totalExpense: parseNum(j['total_expense']),
        saleCount: parseNum(j['sale_count']),
      );
}

class SessionTotals {
  final num totalIncome;
  final num totalExpense;
  final num saleCount;

  const SessionTotals({
    required this.totalIncome,
    required this.totalExpense,
    required this.saleCount,
  });

  factory SessionTotals.fromJson(Map<String, dynamic> j) => SessionTotals(
        totalIncome: parseNum(j['total_income']),
        totalExpense: parseNum(j['total_expense']),
        saleCount: parseNum(j['sale_count']),
      );
}

/// Calls the existing `mobile` module smena endpoints directly — no
/// client-side reimplementation of cashbox-session logic
/// (DESIGN-merchant-admin.md §1.6/§6.6: this module has zero server-side
/// permission enforcement; the `finance.view` gate on the entry tile is
/// cosmetic only, not a real security boundary).
class TillShiftService {
  static Dio get _dio => ApiClient.instance;
  static const _kSelectedCashboxId = 'selected_cashbox_id';

  static Future<List<CashboxSummary>> fetchCashboxes() async {
    final res = await _dio.get<List<dynamic>>('/finance/cashboxes');
    final list = res.data ?? [];
    return list
        .map((e) => CashboxSummary.fromJson(e as Map<String, dynamic>))
        .where((c) => c.isActive)
        .toList();
  }

  static Future<CashboxSession?> fetchActiveSession(int cashboxId) async {
    final res = await _dio.get<Map<String, dynamic>?>(
      '/cashbox-sessions/active',
      queryParameters: {'cashbox_id': cashboxId},
    );
    final data = res.data;
    if (data == null || data.isEmpty) return null;
    return CashboxSession.fromJson(data);
  }

  static Future<String> openSession({
    required int cashboxId,
    required num openedBalance,
    String? openedNote,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>('/cashbox-sessions/open', data: {
      'cashbox_id': cashboxId,
      'opened_balance': openedBalance,
      'opened_note': openedNote,
    });
    return res.data?['id']?.toString() ?? '';
  }

  static Future<SessionTotals> fetchTotals(String sessionId) async {
    final res = await _dio.get<Map<String, dynamic>>('/cashbox-sessions/$sessionId/totals');
    return SessionTotals.fromJson(res.data ?? const {});
  }

  /// Throws [DioException] verbatim on the backend's REGOS-parity on_hold
  /// rejection (400) — the caller must surface `e.response.data['detail']`
  /// as-is, not retry, not swallow it (ticket DoD).
  static Future<Map<String, dynamic>> closeSession({
    required String sessionId,
    required num closedBalance,
    required num closedDiff,
    String? closedNote,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/cashbox-sessions/$sessionId/close',
      data: {
        'closed_balance': closedBalance,
        'closed_diff': closedDiff,
        'closed_note': closedNote,
      },
    );
    return res.data ?? const {};
  }

  static Future<int?> getSelectedCashboxId() async {
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getInt(_kSelectedCashboxId);
    return id;
  }

  static Future<void> setSelectedCashboxId(int id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kSelectedCashboxId, id);
  }
}
