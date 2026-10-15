import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

String _fmtDate(DateTime? d) {
  if (d == null) return '—';
  return '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
}

/// Repurposed per DESIGN-merchant-admin.md §1.3 — ERP has no custom/ad-hoc
/// report-builder endpoint, so this is a **fixed list of 3 canned reports**
/// (`sale-by-customer`, `unsold-goods`, `customer-activity`), each with a CSV
/// export button hitting `GET /statistics/export/{report}`. No "create a
/// custom report" form exists here, by design.
class CustomReportsScreen extends StatefulWidget {
  final Future<List<SaleByCustomerRow>> Function(DateTime, DateTime) loadSaleByCustomer;
  final Future<List<UnsoldGoodRow>> Function() loadUnsoldGoods;
  final Future<List<CustomerActivityRow>> Function() loadCustomerActivity;
  final Future<String> Function(String report, {DateTime? dateFrom, DateTime? dateTo}) exportCsv;

  const CustomReportsScreen({
    super.key,
    this.loadSaleByCustomer = StatisticsService.fetchSaleByCustomer,
    this.loadUnsoldGoods = StatisticsService.fetchUnsoldGoods,
    this.loadCustomerActivity = StatisticsService.fetchCustomerActivity,
    this.exportCsv = StatisticsService.exportCsv,
  });

  @override
  State<CustomReportsScreen> createState() => _CustomReportsScreenState();
}

class _CustomReportsScreenState extends State<CustomReportsScreen> {
  DateTimeRange _customerRange = _defaultRange();

  Future<void> _pickCustomerRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: _customerRange,
    );
    if (picked == null) return;
    setState(() => _customerRange = picked);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Qo\'shimcha hisobotlar')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ReportSection<SaleByCustomerRow>(
            key: ValueKey(_customerRange),
            title: 'Mijozlar bo\'yicha savdo',
            emptyLabel: 'Tanlangan davrda savdo topilmadi',
            headerExtra: Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(child: Text(_fmtRange(_customerRange))),
                  TextButton(
                    onPressed: _pickCustomerRange,
                    child: const Text('Davrni o\'zgartirish'),
                  ),
                ],
              ),
            ),
            load: () => widget.loadSaleByCustomer(_customerRange.start, _customerRange.end),
            exportCsv: () => widget.exportCsv(
              'sale-by-customer',
              dateFrom: _customerRange.start,
              dateTo: _customerRange.end,
            ),
            itemBuilder: (context, row) => ListTile(
              title: Text(row.customer),
              subtitle: Text('${row.salesCount} ta savdo · to\'langan ${formatMoney(row.paid)} so\'m'),
              trailing: Text(
                row.debt > 0
                    ? 'qarz: ${formatMoney(row.debt)}'
                    : '${formatMoney(row.revenue)} so\'m',
                style: row.debt > 0 ? const TextStyle(color: Colors.red) : null,
              ),
            ),
          ),
          const SizedBox(height: 16),
          _ReportSection<UnsoldGoodRow>(
            title: 'Sotilmagan mahsulotlar (30 kun)',
            emptyLabel: 'Sotilmagan mahsulot topilmadi',
            load: widget.loadUnsoldGoods,
            exportCsv: () => widget.exportCsv('unsold-goods'),
            itemBuilder: (context, row) => ListTile(
              title: Text(row.name),
              subtitle: Text(
                '${row.sku ?? '—'} · zaxira: ${formatMoney(row.stockQty)} · oxirgi savdo: ${_fmtDate(row.lastSale)}',
              ),
              trailing: Text('${formatMoney(row.salePrice)} so\'m'),
            ),
          ),
          const SizedBox(height: 16),
          _ReportSection<CustomerActivityRow>(
            title: 'Mijozlar faolligi',
            emptyLabel: 'Mijoz topilmadi',
            load: widget.loadCustomerActivity,
            exportCsv: () => widget.exportCsv('customer-activity'),
            itemBuilder: (context, row) => ListTile(
              title: Text(row.name),
              subtitle: Text(
                'oxirgi savdo: ${_fmtDate(row.lastSale)}'
                '${row.daysInactive != null ? ' · ${row.daysInactive} kun faolsiz' : ''}',
              ),
              trailing: Text('${formatMoney(row.revenue)} so\'m'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportSection<T> extends StatefulWidget {
  final String title;
  final String emptyLabel;
  final Widget? headerExtra;
  final Future<List<T>> Function() load;
  final Future<String> Function() exportCsv;
  final Widget Function(BuildContext, T) itemBuilder;

  const _ReportSection({
    super.key,
    required this.title,
    required this.emptyLabel,
    required this.load,
    required this.exportCsv,
    required this.itemBuilder,
    this.headerExtra,
  });

  @override
  State<_ReportSection<T>> createState() => _ReportSectionState<T>();
}

class _ReportSectionState<T> extends State<_ReportSection<T>> {
  bool _loaded = false;
  bool _loading = false;
  bool _exporting = false;
  String? _error;
  List<T> _rows = const [];

  Future<void> _ensureLoaded() async {
    if (_loaded || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await widget.load();
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loaded = true;
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

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final csv = await widget.exportCsv();
      await Clipboard.setData(ClipboardData(text: csv));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('CSV nusxalandi — istalgan ilovaga joylashtiring')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ExpansionTile(
        title: Text(widget.title),
        onExpansionChanged: (expanded) {
          if (expanded) _ensureLoaded();
        },
        trailing: _exporting
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : IconButton(
                icon: const Icon(Icons.ios_share_outlined),
                tooltip: 'CSV nusxalash',
                onPressed: _export,
              ),
        children: [
          if (widget.headerExtra != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: widget.headerExtra!,
            ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () {
                      setState(() => _loaded = false);
                      _ensureLoaded();
                    },
                    child: const Text('Qayta urinish'),
                  ),
                ],
              ),
            )
          else if (_loaded && _rows.isEmpty)
            Padding(padding: const EdgeInsets.all(16), child: Text(widget.emptyLabel))
          else if (_loaded)
            for (final row in _rows) widget.itemBuilder(context, row),
        ],
      ),
    );
  }
}
