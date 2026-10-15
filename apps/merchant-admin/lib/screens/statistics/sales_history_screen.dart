import 'package:flutter/material.dart';
import '../../services/statistics_service.dart';
import '../../utils/dio_error.dart';

DateTimeRange _defaultRange() {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return DateTimeRange(start: today.subtract(const Duration(days: 29)), end: today);
}

String _fmtRange(DateTimeRange r) {
  String fmt(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
  return '${fmt(r.start)} — ${fmt(r.end)}';
}

String _fmtDay(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';

/// `GET /statistics/sales-summary` (`v_sales_summary`) rendered as a
/// day-by-day ledger, most recent first (DESIGN-merchant-admin.md §6.3).
class SalesHistoryScreen extends StatefulWidget {
  final Future<List<SalesSummaryRow>> Function(DateTime, DateTime) loadSummary;

  const SalesHistoryScreen({
    super.key,
    this.loadSummary = StatisticsService.fetchSalesSummary,
  });

  @override
  State<SalesHistoryScreen> createState() => _SalesHistoryScreenState();
}

class _SalesHistoryScreenState extends State<SalesHistoryScreen> {
  DateTimeRange _range = _defaultRange();
  bool _loading = true;
  String? _error;
  List<SalesSummaryRow> _rows = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = List<SalesSummaryRow>.of(await widget.loadSummary(_range.start, _range.end))
        ..sort((a, b) => b.day.compareTo(a.day));
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = describeDioError(e);
        _loading = false;
      });
    }
  }

  Future<void> _pickRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: _range,
    );
    if (picked == null) return;
    setState(() => _range = picked);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Savdolar tarixi'),
        actions: [
          IconButton(
            onPressed: _pickRange,
            icon: const Icon(Icons.date_range_outlined),
            tooltip: 'Sana oralig\'ini tanlash',
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return _ErrorView(message: _error!, onRetry: _load);
    }

    final totalRevenue = _rows.fold<num>(0, (sum, r) => sum + r.revenue);
    final totalDebt = _rows.fold<num>(0, (sum, r) => sum + r.debt);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Chip(
            avatar: const Icon(Icons.calendar_today_outlined, size: 16),
            label: Text(_fmtRange(_range)),
          ),
          const SizedBox(height: 12),
          if (_rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Center(
                child: Text(
                  'Tanlangan davrda savdo topilmadi',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            )
          else ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _SummaryStat(label: 'Jami daromad', value: '${formatMoney(totalRevenue)} so\'m'),
                    _SummaryStat(label: 'Jami qarzdorlik', value: '${formatMoney(totalDebt)} so\'m'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            for (final row in _rows)
              Card(
                child: ListTile(
                  title: Text(_fmtDay(row.day)),
                  subtitle: Text('${row.salesCount} ta savdo · to\'langan ${formatMoney(row.paid)} so\'m'),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('${formatMoney(row.revenue)} so\'m'),
                      if (row.debt > 0)
                        Text(
                          'qarz: ${formatMoney(row.debt)}',
                          style: const TextStyle(color: Colors.red, fontSize: 11),
                        ),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _SummaryStat extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        Text(value, style: Theme.of(context).textTheme.titleMedium),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Qayta urinish')),
          ],
        ),
      ),
    );
  }
}
