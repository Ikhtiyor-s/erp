import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/menu_service.dart';
import '../../utils/dio_error.dart';
import '../../widgets/permission_gate.dart';

class ProductListScreen extends StatefulWidget {
  const ProductListScreen({super.key});

  @override
  State<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends State<ProductListScreen> {
  final _searchCtl = TextEditingController();
  final _scrollCtl = ScrollController();
  Timer? _debounce;

  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  bool _noWarehouses = false;

  List<Warehouse> _warehouses = [];
  int? _selectedWarehouseId;
  List<Category> _categories = [];
  int? _selectedCategoryId;

  List<ProductListItem> _products = [];
  int _page = 1;
  final int _limit = 50;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _scrollCtl.addListener(_onScroll);
    _bootstrap();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtl.dispose();
    _scrollCtl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_loading || _loadingMore) return;
    if (_page * _limit >= _total) return;
    if (_scrollCtl.position.pixels > _scrollCtl.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
      _noWarehouses = false;
    });
    try {
      final warehouses = await MenuService.fetchWarehouses();
      if (warehouses.isEmpty) {
        if (!mounted) return;
        setState(() {
          _warehouses = [];
          _noWarehouses = true;
          _loading = false;
        });
        return;
      }

      final savedId = await MenuService.getSelectedWarehouseId();
      final selected = warehouses.any((w) => w.id == savedId) ? savedId! : warehouses.first.id;
      await MenuService.setSelectedWarehouseId(selected);

      List<Category> categories = [];
      try {
        categories = await MenuService.fetchCategories();
      } catch (_) {
        // Category filter is a nicety — its failure shouldn't block the list.
      }

      if (!mounted) return;
      setState(() {
        _warehouses = warehouses;
        _selectedWarehouseId = selected;
        _categories = categories;
      });
      await _loadProducts(reset: true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = describeDioError(e);
        _loading = false;
      });
    }
  }

  Future<void> _loadProducts({bool reset = false}) async {
    if (_selectedWarehouseId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await MenuService.fetchProducts(
        warehouseId: _selectedWarehouseId!,
        page: 1,
        limit: _limit,
        q: _searchCtl.text,
        categoryId: _selectedCategoryId,
      );
      if (!mounted) return;
      setState(() {
        _products = result.items;
        _page = result.page;
        _total = result.total;
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

  Future<void> _loadMore() async {
    if (_selectedWarehouseId == null) return;
    setState(() => _loadingMore = true);
    try {
      final result = await MenuService.fetchProducts(
        warehouseId: _selectedWarehouseId!,
        page: _page + 1,
        limit: _limit,
        q: _searchCtl.text,
        categoryId: _selectedCategoryId,
      );
      if (!mounted) return;
      setState(() {
        _products = [..._products, ...result.items];
        _page = result.page;
        _total = result.total;
        _loadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    }
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _loadProducts(reset: true));
  }

  Future<void> _onWarehouseChanged(int? id) async {
    if (id == null || id == _selectedWarehouseId) return;
    await MenuService.setSelectedWarehouseId(id);
    setState(() => _selectedWarehouseId = id);
    await _loadProducts(reset: true);
  }

  void _onCategoryChanged(int? categoryId) {
    setState(() => _selectedCategoryId = categoryId);
    _loadProducts(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Katalog')),
      floatingActionButton: PermissionGate(
        code: 'warehouse.create',
        child: FloatingActionButton.extended(
          onPressed: () => context.push('/menu/products/new'),
          icon: const Icon(Icons.add),
          label: const Text('Mahsulot'),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchCtl,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Mahsulot nomi yoki SKU bo\'yicha qidirish',
                prefixIcon: const Icon(Icons.search),
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          if (_warehouses.length > 1 || _categories.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  if (_warehouses.length > 1)
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        initialValue: _selectedWarehouseId,
                        isDense: true,
                        decoration: const InputDecoration(labelText: 'Ombor', isDense: true),
                        items: [
                          for (final w in _warehouses)
                            DropdownMenuItem(value: w.id, child: Text(w.name, overflow: TextOverflow.ellipsis)),
                        ],
                        onChanged: _onWarehouseChanged,
                      ),
                    ),
                  if (_warehouses.length > 1 && _categories.isNotEmpty) const SizedBox(width: 12),
                  if (_categories.isNotEmpty)
                    Expanded(
                      child: DropdownButtonFormField<int?>(
                        initialValue: _selectedCategoryId,
                        isDense: true,
                        decoration: const InputDecoration(labelText: 'Kategoriya', isDense: true),
                        items: [
                          const DropdownMenuItem<int?>(value: null, child: Text('Barchasi')),
                          for (final c in _categories)
                            DropdownMenuItem<int?>(value: c.id, child: Text(c.name, overflow: TextOverflow.ellipsis)),
                        ],
                        onChanged: _onCategoryChanged,
                      ),
                    ),
                ],
              ),
            ),
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
      return _ErrorState(message: _error!, onRetry: _bootstrap);
    }
    if (_noWarehouses) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Omborlar mavjud emas — mahsulotlarni ko\'rish uchun avval ombor yaratilishi kerak',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    if (_products.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            '0 ta mahsulot topildi',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey.shade600),
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _loadProducts(reset: true),
      child: ListView.builder(
        controller: _scrollCtl,
        padding: const EdgeInsets.only(bottom: 88),
        itemCount: _products.length + (_loadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= _products.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final p = _products[index];
          return ListTile(
            leading: const CircleAvatar(
              backgroundColor: Colors.transparent,
              child: Icon(Icons.inventory_2_outlined, color: Colors.grey),
            ),
            title: Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text(_subtitleFor(p), maxLines: 1, overflow: TextOverflow.ellipsis),
            trailing: p.isPublishedOnline
                ? const Icon(Icons.public, size: 18, color: Colors.green)
                : null,
            onTap: () => context.push('/menu/products/${p.id}'),
          );
        },
      ),
    );
  }

  String _subtitleFor(ProductListItem p) {
    final parts = <String>[];
    if (p.categoryName != null && p.categoryName!.isNotEmpty) parts.add(p.categoryName!);
    final qty = p.onHand == p.onHand.roundToDouble() ? p.onHand.toInt().toString() : p.onHand.toStringAsFixed(2);
    parts.add('Qoldiq: $qty${p.unitName != null ? ' ${p.unitName}' : ''}');
    return parts.join(' • ');
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
            Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
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
