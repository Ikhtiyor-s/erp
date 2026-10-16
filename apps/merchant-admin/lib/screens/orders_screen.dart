import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/orders_service.dart';
import '../utils/dio_error.dart';
import '../widgets/app_search_field.dart';
import '../widgets/permission_gate.dart';
import '../widgets/zebra_tile.dart';

const _kStatusLabels = <String, String>{
  'confirmed': 'Tasdiqlangan',
  'paid': "To'langan",
  'partial': "Qisman to'langan",
  'on_hold': 'Kutish rejimida',
  'cancelled': 'Bekor qilingan',
  'awaiting_payment': "To'lov kutilmoqda",
  'payment_failed': "To'lov muvaffaqiyatsiz",
};

String _statusLabel(String status) => _kStatusLabels[status] ?? status;

String _money(num v, String? currency) {
  final s = v.toStringAsFixed(v % 1 == 0 ? 0 : 2);
  return currency != null ? '$s $currency' : s;
}

/// Read-only sale/order list (DESIGN-merchant-admin.md §9 / SPEC §7 WON'T
/// DO — no checkout, no payment capture anywhere in this screen).
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<SaleSummary>? _sales;
  Object? _error;
  bool _loading = true;
  String? _statusFilter;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final sales = await OrdersService.fetchSales(
        status: _statusFilter,
        q: _searchController.text.trim().isEmpty ? null : _searchController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _sales = sales;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Buyurtmalar'),
        actions: [
          PermissionGate(
            code: 'warehouse.product.barcode_view',
            child: IconButton(
              tooltip: 'Shtrix-kod bo\'yicha qidirish',
              icon: const Icon(Icons.qr_code_scanner_outlined),
              onPressed: () => context.push('/scanner'),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: AppSearchField(
                    controller: _searchController,
                    hintText: 'Hujjat raqami, mijoz...',
                    onSubmitted: (_) => _load(),
                  ),
                ),
                const SizedBox(width: 8),
                PopupMenuButton<String?>(
                  initialValue: _statusFilter,
                  icon: const Icon(Icons.filter_list),
                  onSelected: (v) {
                    setState(() => _statusFilter = v);
                    _load();
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: null, child: Text('Barchasi')),
                    for (final entry in _kStatusLabels.entries)
                      PopupMenuItem(value: entry.key, child: Text(entry.value)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return _ErrorState(message: describeDioError(_error!), onRetry: _load);
    }
    final sales = _sales ?? const [];
    if (sales.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(child: Text("0 ta buyurtma topildi")),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: sales.length,
        itemBuilder: (context, i) {
          final s = sales[i];
          return ZebraTile(
            index: i,
            child: ListTile(
              leading: CircleAvatar(
                child: Text(
                  s.sourceType == 'sale_kiosk' ? 'K' : 'S',
                  style: const TextStyle(fontSize: 14),
                ),
              ),
              title: Text(s.docNumber?.isNotEmpty == true ? s.docNumber! : s.uuidLabel),
              subtitle: Text(
                [
                  if (s.customerName != null) s.customerName!,
                  _statusLabel(s.displayStatus),
                ].join(' · '),
              ),
              trailing: Text(_money(s.totalAmount, s.currencyCode)),
              onTap: () => context.push('/orders/${s.id}'),
            ),
          );
        },
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: Colors.red),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Qayta urinish')),
          ],
        ),
      ),
    );
  }
}

/// Order detail — DESIGN-merchant-admin.md §5 leaves this inline-vs-route
/// choice to MA-6; implemented as a push route (`/orders/:id`, router.dart)
/// backed by this class, kept in the one frozen `orders_screen.dart` file
/// rather than a new file (no detail screen is listed in DESIGN §4's tree).
class OrderDetailScreen extends StatefulWidget {
  final String saleId;
  const OrderDetailScreen({super.key, required this.saleId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  SaleDetail? _detail;
  Object? _error;
  bool _loading = true;

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
      final detail = await OrdersService.fetchSaleDetail(widget.saleId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Buyurtma tafsilotlari')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorState(message: describeDioError(_error!), onRetry: _load)
              : _buildDetail(_detail!),
    );
  }

  Widget _buildDetail(SaleDetail detail) {
    final head = detail.head;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          head.docNumber?.isNotEmpty == true ? head.docNumber! : head.uuidLabel,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 4),
        Text(_statusLabel(head.displayStatus)),
        const Divider(height: 24),
        if (head.customerName != null) _InfoRow('Mijoz', head.customerName!),
        if (head.customerPhone != null) _InfoRow('Telefon', head.customerPhone!),
        if (detail.customerAddress != null) _InfoRow('Manzil', detail.customerAddress!),
        if (head.warehouseName != null) _InfoRow('Ombor', head.warehouseName!),
        if (head.saleDate != null) _InfoRow('Sana', head.saleDate!.toLocal().toString()),
        _InfoRow('Jami summa', _money(head.totalAmount, head.currencyCode)),
        _InfoRow("To'langan", _money(head.paidAmount, head.currencyCode)),
        if (head.notes?.isNotEmpty == true) _InfoRow('Izoh', head.notes!),
        const Divider(height: 24),
        Text('Mahsulotlar', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (detail.items.isEmpty)
          const Text("Mahsulotlar topilmadi")
        else
          for (final item in detail.items)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(item.productName ?? item.productId ?? '-'),
              subtitle: Text('${item.quantity} x ${_money(item.price, head.currencyCode)}'),
              trailing: Text(_money(item.amount, head.currencyCode)),
            ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label, style: const TextStyle(color: Colors.grey))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
