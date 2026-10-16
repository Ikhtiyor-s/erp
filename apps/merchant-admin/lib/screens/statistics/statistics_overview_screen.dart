import 'package:flutter/material.dart';
import '../../services/statistics_service.dart';
import '../../utils/dio_error.dart';
import '../../widgets/permission_gate.dart';
import '../../widgets/zebra_tile.dart';

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

/// Statistics tab (`statistics.view`) — sale-by-category/employee/payment-type
/// breakdowns for a selected date range, plus a COGS tile gated on
/// `statistics.cogs.view` (DESIGN-merchant-admin.md §6.3/§6.5). No
/// branch-comparison screen (SPEC §7 WON'T DO, MA-4 ticket's explicit
/// "Done means" line) is built here or anywhere in this file.
class StatisticsOverviewScreen extends StatefulWidget {
  final Future<OverviewData> Function(DateTime, DateTime) loadOverview;

  const StatisticsOverviewScreen({
    super.key,
    this.loadOverview = StatisticsService.fetchOverview,
  });

  @override
  State<StatisticsOverviewScreen> createState() => _StatisticsOverviewScreenState();
}

class _StatisticsOverviewScreenState extends State<StatisticsOverviewScreen> {
  DateTimeRange _range = _defaultRange();
  bool _loading = true;
  String? _error;
  OverviewData? _data;

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
      final data = await widget.loadOverview(_range.start, _range.end);
      if (!mounted) return;
      setState(() {
        _data = data;
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
        title: const Text('Statistika'),
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

    final data = _data!;
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
          const SizedBox(height: 20),
          _Section(
            title: 'Kategoriya bo\'yicha savdo',
            emptyLabel: 'Tanlangan davrda savdo topilmadi',
            rows: [
              for (final row in data.byCategory)
                _BreakdownTile(
                  title: row.category,
                  subtitle: '${row.salesCount} ta savdo · ${formatMoney(row.qty)} dona',
                  trailing: '${formatMoney(row.revenue)} so\'m',
                ),
            ],
          ),
          const SizedBox(height: 20),
          _Section(
            title: 'Xodim bo\'yicha savdo',
            emptyLabel: 'Tanlangan davrda savdo topilmadi',
            rows: [
              for (final row in data.byEmployee)
                _BreakdownTile(
                  title: row.employee,
                  subtitle: '${row.salesCount} ta savdo · o\'rtacha ${formatMoney(row.avgCheck)} so\'m',
                  trailing: '${formatMoney(row.revenue)} so\'m',
                ),
            ],
          ),
          const SizedBox(height: 20),
          _Section(
            title: 'To\'lov turi bo\'yicha',
            emptyLabel: 'Tanlangan davrda to\'lov topilmadi',
            rows: [
              for (final row in data.byPaymentType)
                _BreakdownTile(
                  title: row.paymentType,
                  subtitle: '${row.paymentsCount} ta to\'lov',
                  trailing: '${formatMoney(row.total)} so\'m',
                ),
            ],
          ),
          const SizedBox(height: 20),
          PermissionGate(
            code: 'statistics.cogs.view',
            child: Card(
              child: ListTile(
                leading: const Icon(Icons.pie_chart_outline),
                title: const Text('Tan narx va foyda hisoboti (COGS)'),
                subtitle: const Text('Mahsulot/kategoriya/ombor bo\'yicha marja'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => _CogsDetailScreen(dateFrom: _range.start, dateTo: _range.end),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final String emptyLabel;
  final List<Widget> rows;

  const _Section({required this.title, required this.emptyLabel, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (rows.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(emptyLabel, style: Theme.of(context).textTheme.bodySmall),
              )
            else
              for (var i = 0; i < rows.length; i++) ZebraTile(index: i, child: rows[i]),
          ],
        ),
      ),
    );
  }
}

class _BreakdownTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String trailing;

  const _BreakdownTile({required this.title, required this.subtitle, required this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.bodyMedium),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Text(trailing, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

/// Pushed (not a modal, not a new go_router path — DESIGN's route table
/// stays frozen) when the COGS tile is tapped. A separate page because the
/// data (3 breakdowns) is too much to usefully show in a sheet.
class _CogsDetailScreen extends StatefulWidget {
  final DateTime dateFrom;
  final DateTime dateTo;
  final Future<CogsReport> Function(DateTime, DateTime) loadCogs;

  const _CogsDetailScreen({
    required this.dateFrom,
    required this.dateTo,
    this.loadCogs = StatisticsService.fetchCogs,
  });

  @override
  State<_CogsDetailScreen> createState() => _CogsDetailScreenState();
}

class _CogsDetailScreenState extends State<_CogsDetailScreen> {
  bool _loading = true;
  String? _error;
  CogsReport? _report;

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
      final report = await widget.loadCogs(widget.dateFrom, widget.dateTo);
      if (!mounted) return;
      setState(() {
        _report = report;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('COGS hisoboti')),
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

    final report = _report!;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _TotalsRow(label: 'Daromad', value: '${formatMoney(report.totalRevenue)} so\'m'),
                  _TotalsRow(label: 'Tan narx', value: '${formatMoney(report.totalCogs)} so\'m'),
                  _TotalsRow(label: 'Yalpi foyda', value: '${formatMoney(report.grossProfit)} so\'m'),
                  _TotalsRow(
                    label: 'Marja',
                    value: '${formatMoney(report.grossMarginPct)}%',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          ExpansionTile(
            title: const Text('Mahsulotlar bo\'yicha'),
            initiallyExpanded: true,
            children: report.byProduct.isEmpty
                ? [const Padding(padding: EdgeInsets.all(12), child: Text('Ma\'lumot topilmadi'))]
                : [
                    for (var i = 0; i < report.byProduct.length; i++)
                      ZebraTile(
                        index: i,
                        child: _BreakdownTile(
                          title: report.byProduct[i].productName,
                          subtitle:
                              '${formatMoney(report.byProduct[i].soldQty)} dona · marja ${formatMoney(report.byProduct[i].marginPct)}%',
                          trailing: '${formatMoney(report.byProduct[i].profit)} so\'m',
                        ),
                      ),
                  ],
          ),
          ExpansionTile(
            title: const Text('Kategoriya bo\'yicha'),
            children: report.byCategory.isEmpty
                ? [const Padding(padding: EdgeInsets.all(12), child: Text('Ma\'lumot topilmadi'))]
                : [
                    for (var i = 0; i < report.byCategory.length; i++)
                      ZebraTile(
                        index: i,
                        child: _BreakdownTile(
                          title: report.byCategory[i].categoryName,
                          subtitle: 'marja ${formatMoney(report.byCategory[i].marginPct)}%',
                          trailing: '${formatMoney(report.byCategory[i].profit)} so\'m',
                        ),
                      ),
                  ],
          ),
          ExpansionTile(
            title: const Text('Ombor bo\'yicha'),
            children: report.byWarehouse.isEmpty
                ? [const Padding(padding: EdgeInsets.all(12), child: Text('Ma\'lumot topilmadi'))]
                : [
                    for (var i = 0; i < report.byWarehouse.length; i++)
                      ZebraTile(
                        index: i,
                        child: _BreakdownTile(
                          title: report.byWarehouse[i].warehouseName,
                          subtitle: 'marja ${formatMoney(report.byWarehouse[i].marginPct)}%',
                          trailing: '${formatMoney(report.byWarehouse[i].profit)} so\'m',
                        ),
                      ),
                  ],
          ),
        ],
      ),
    );
  }
}

class _TotalsRow extends StatelessWidget {
  final String label;
  final String value;

  const _TotalsRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
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
