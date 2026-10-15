import 'package:flutter/material.dart';
import '../services/dashboard_service.dart';

/// Lightweight bar sparkline for `/statistics/daily-revenue` — plain
/// `Container`-based bars, no chart package added since the dependency
/// wasn't already present and a sparkline this simple doesn't need one
/// (DESIGN-merchant-admin.md §2 leaves the chart package choice to this
/// ticket; "genuinely needed" bar for a new dependency wasn't met here).
class RevenueChart extends StatelessWidget {
  final List<DailyRevenuePoint> points;

  const RevenueChart({super.key, required this.points});

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) {
      return const SizedBox(
        height: 80,
        child: Center(child: Text('Kunlik daromad ma\'lumoti yo\'q')),
      );
    }

    final maxRevenue = points.map((p) => p.revenue).fold<num>(0, (a, b) => a > b ? a : b);
    final colorScheme = Theme.of(context).colorScheme;

    return SizedBox(
      height: 140,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final point in points)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      height: maxRevenue > 0 ? 100 * (point.revenue / maxRevenue) : 0,
                      decoration: BoxDecoration(
                        color: colorScheme.primary,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${point.date.day}',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
