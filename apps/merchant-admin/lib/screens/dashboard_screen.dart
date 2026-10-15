import 'package:flutter/material.dart';
import '../services/connectivity.dart';
import '../services/dashboard_service.dart';
import '../services/local_cache.dart';
import '../services/statistics_service.dart';
import '../utils/dio_error.dart';
import '../widgets/revenue_chart.dart';

/// Dashboard tab (`statistics.view`, DESIGN-merchant-admin.md §1.1 — identical
/// for `admin`/`manager`, no role-based redirect). Pull-to-refresh is the
/// only freshness mechanism (§1.2, no realtime layer); switching away from
/// and back to this tab also re-fetches since `ShellRoute` recreates this
/// widget on location change.
class DashboardScreen extends StatefulWidget {
  final Future<DashboardSummary> Function() fetchSummary;
  final Future<List<DailyRevenuePoint>> Function({int days}) fetchDailyRevenue;

  const DashboardScreen({
    super.key,
    this.fetchSummary = DashboardService.fetchSummary,
    this.fetchDailyRevenue = DashboardService.fetchDailyRevenue,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  static const _cacheKey = 'dashboard_summary';

  bool _loading = true;
  String? _error;
  DashboardSummary? _summary;
  List<DailyRevenuePoint> _daily = const [];
  bool _showingCachedData = false;
  DateTime? _cachedAt;

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
      final summary = await widget.fetchSummary();
      final daily = await widget.fetchDailyRevenue(days: 14);
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _daily = daily;
        _showingCachedData = false;
        _loading = false;
      });
      await LocalCache.set(_cacheKey, {
        'summary': {
          'today_sales': summary.todaySales,
          'today_revenue': summary.todayRevenue,
          'month_sales': summary.monthSales,
          'month_revenue': summary.monthRevenue,
          'cash_total': summary.cashTotal,
          'total_debt': summary.totalDebt,
          'stock_value': summary.stockValue,
        },
        'daily': [
          for (final d in daily) {'date': d.date.toIso8601String(), 'count': d.count, 'revenue': d.revenue},
        ],
      });
    } catch (e) {
      final cached = await LocalCache.get<Map<String, dynamic>>(_cacheKey);
      if (!mounted) return;
      if (cached == null) {
        setState(() {
          _error = describeDioError(e);
          _loading = false;
        });
        return;
      }
      final cachedDaily = (cached.value['daily'] as List<dynamic>?) ?? const [];
      setState(() {
        _summary = DashboardSummary.fromJson(cached.value['summary'] as Map<String, dynamic>);
        _daily = cachedDaily.map((e) => DailyRevenuePoint.fromJson(e as Map<String, dynamic>)).toList();
        _showingCachedData = true;
        _cachedAt = cached.cachedAt;
        _error = null;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bosh sahifa')),
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

    final summary = _summary!;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          if (_showingCachedData) ...[
            _OfflineBanner(cachedAt: _cachedAt),
            const SizedBox(height: 16),
          ],
          _KpiGrid(cards: [
            _KpiCard(
              label: 'Bugungi daromad',
              value: '${formatMoney(summary.todayRevenue)} so\'m',
              caption: '${summary.todaySales} ta savdo',
              icon: Icons.today_outlined,
            ),
            _KpiCard(
              label: 'Oylik daromad',
              value: '${formatMoney(summary.monthRevenue)} so\'m',
              caption: '${summary.monthSales} ta savdo',
              icon: Icons.calendar_month_outlined,
            ),
            _KpiCard(
              label: 'Kassadagi mablag\'',
              value: '${formatMoney(summary.cashTotal)} so\'m',
              icon: Icons.point_of_sale_outlined,
            ),
            _KpiCard(
              label: 'Umumiy qarzdorlik',
              value: '${formatMoney(summary.totalDebt)} so\'m',
              icon: Icons.warning_amber_outlined,
            ),
            _KpiCard(
              label: 'Ombordagi zaxira qiymati',
              value: '${formatMoney(summary.stockValue)} so\'m',
              icon: Icons.inventory_2_outlined,
            ),
          ]),
          const SizedBox(height: 24),
          Text('Oxirgi 14 kunlik daromad', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          RevenueChart(points: _daily),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String? caption;
  final IconData icon;

  const _KpiCard({required this.label, required this.value, required this.icon, this.caption});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (caption != null)
              Text(caption!, style: Theme.of(context).textTheme.labelSmall),
          ],
        ),
      ),
    );
  }
}

/// Plain `Column`-of-`Row`s instead of `GridView.count` — a `shrinkWrap`
/// `GridView` nested in a `ListView` creates its own inner viewport, which
/// pushes everything after it (the chart) past the outer sliver's default
/// cache extent and silently stops it from being laid out at all.
class _KpiGrid extends StatelessWidget {
  final List<_KpiCard> cards;

  const _KpiGrid({required this.cards});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < cards.length; i += 2)
          Padding(
            padding: EdgeInsets.only(bottom: i + 2 < cards.length ? 12 : 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: SizedBox(height: 120, child: cards[i])),
                const SizedBox(width: 12),
                Expanded(
                  child: i + 1 < cards.length
                      ? SizedBox(height: 120, child: cards[i + 1])
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  final DateTime? cachedAt;

  const _OfflineBanner({this.cachedAt});

  @override
  Widget build(BuildContext context) {
    final at = cachedAt;
    final timeLabel = at != null
        ? '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}'
        : null;
    return ListenableBuilder(
      listenable: ConnectivityMonitor(),
      builder: (context, _) {
        final online = ConnectivityMonitor().online;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.orange.shade50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.orange.shade200),
          ),
          child: Row(
            children: [
              Icon(
                online ? Icons.cloud_off_outlined : Icons.wifi_off_outlined,
                size: 18,
                color: Colors.orange.shade800,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  timeLabel == null
                      ? 'Oflayn — oxirgi yangilangan ma\'lumot'
                      : 'Oflayn — oxirgi yangilangan ma\'lumot ($timeLabel)',
                  style: TextStyle(color: Colors.orange.shade800),
                ),
              ),
            ],
          ),
        );
      },
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
