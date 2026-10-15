import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../services/menu_service.dart';
import '../../services/permissions_service.dart';
import '../../utils/dio_error.dart';
import '../../widgets/permission_gate.dart';

class ProductDetailScreen extends StatefulWidget {
  final String productId;

  const ProductDetailScreen({super.key, required this.productId});

  bool get isNew => productId == 'new';

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtl = TextEditingController();
  final _skuCtl = TextEditingController();
  final _barcodeCtl = TextEditingController();
  final _purchasePriceCtl = TextEditingController();
  final _salePriceCtl = TextEditingController();
  final _wholesalePriceCtl = TextEditingController();
  final _imageUrlCtl = TextEditingController();
  final _descriptionCtl = TextEditingController();

  bool _loading = true;
  String? _loadError;
  bool _saving = false;
  bool _archiving = false;

  ProductDetail? _detail;
  List<Category> _categories = [];
  List<Unit> _units = [];
  int? _categoryId;
  int? _unitId;
  bool _isService = false;
  bool _isPublishedOnline = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtl.dispose();
    _skuCtl.dispose();
    _barcodeCtl.dispose();
    _purchasePriceCtl.dispose();
    _salePriceCtl.dispose();
    _wholesalePriceCtl.dispose();
    _imageUrlCtl.dispose();
    _descriptionCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      ProductDetail? detail;
      if (!widget.isNew) {
        detail = await MenuService.fetchProductFull(widget.productId);
      }

      var categories = <Category>[];
      var units = <Unit>[];
      try {
        categories = await MenuService.fetchCategories();
      } catch (_) {
        // Non-critical for the form — dropdown just stays empty.
      }
      try {
        units = await MenuService.fetchUnits();
      } catch (_) {
        // Non-critical for the form — dropdown just stays empty.
      }

      if (!mounted) return;
      setState(() {
        _categories = categories;
        _units = units;
        _detail = detail;
        if (detail != null) {
          _nameCtl.text = detail.name;
          _skuCtl.text = detail.sku ?? '';
          _barcodeCtl.text = detail.barcode ?? '';
          _purchasePriceCtl.text = _formatNum(detail.purchasePrice);
          _salePriceCtl.text = _formatNum(detail.salePrice);
          _wholesalePriceCtl.text = detail.wholesalePrice == null ? '' : _formatNum(detail.wholesalePrice!);
          _imageUrlCtl.text = detail.imageUrl ?? '';
          _descriptionCtl.text = detail.description ?? '';
          _categoryId = detail.categoryId;
          _unitId = detail.unitId;
          _isService = detail.isService;
          _isPublishedOnline = detail.isPublishedOnline;
        }
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = describeDioError(e);
        _loading = false;
      });
    }
  }

  String _formatNum(num v) {
    if (v == v.roundToDouble()) return v.toInt().toString();
    return v.toString();
  }

  num _numOrZero(String s) => num.tryParse(s.trim().replaceAll(',', '.')) ?? 0;

  String? _emptyToNull(String s) => s.trim().isEmpty ? null : s.trim();

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final overrides = <String, dynamic>{
      'name': _nameCtl.text.trim(),
      'sku': _emptyToNull(_skuCtl.text),
      'barcode': _emptyToNull(_barcodeCtl.text),
      'category_id': _categoryId,
      'unit_id': _unitId,
      'purchase_price': _numOrZero(_purchasePriceCtl.text),
      'sale_price': _numOrZero(_salePriceCtl.text),
      'wholesale_price': _wholesalePriceCtl.text.trim().isEmpty ? null : _numOrZero(_wholesalePriceCtl.text),
      'is_service': _isService,
      'image_url': _emptyToNull(_imageUrlCtl.text),
      'description': _emptyToNull(_descriptionCtl.text),
      'is_published_online': _isPublishedOnline,
    };

    try {
      if (widget.isNew) {
        final newId = await MenuService.createProduct(overrides);
        if (!mounted) return;
        if (newId.isEmpty) {
          setState(() => _saving = false);
          return;
        }
        context.pushReplacement('/menu/products/$newId');
      } else {
        final body = _detail!.toMutationBody(overrides);
        await MenuService.updateProduct(widget.productId, body);
        final refreshed = await MenuService.fetchProductFull(widget.productId);
        if (!mounted) return;
        setState(() {
          _detail = refreshed;
          _saving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saqlandi')));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    }
  }

  Future<void> _toggleArchive() async {
    if (_detail == null) return;
    setState(() => _archiving = true);
    try {
      if (_detail!.isArchived) {
        await MenuService.unarchiveProduct(widget.productId);
      } else {
        await MenuService.archiveProduct(widget.productId);
      }
      final refreshed = await MenuService.fetchProductFull(widget.productId);
      if (!mounted) return;
      setState(() {
        _detail = refreshed;
        _archiving = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _archiving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final canEdit = context.watch<PermissionsService>().hasPermission(
          widget.isNew ? 'warehouse.create' : 'warehouse.update',
        );
    final title = widget.isNew ? 'Yangi mahsulot' : 'Mahsulot';

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          if (!widget.isNew && _detail != null)
            PermissionGate(
              code: 'warehouse.product.archive',
              child: IconButton(
                icon: _archiving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(_detail!.isArchived ? Icons.unarchive_outlined : Icons.archive_outlined),
                tooltip: _detail!.isArchived ? 'Arxivdan chiqarish' : 'Arxivlash',
                onPressed: _archiving ? null : _toggleArchive,
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? _ErrorState(message: _loadError!, onRetry: _load)
              : _buildForm(canEdit),
    );
  }

  Widget _buildForm(bool canEdit) {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_detail?.isArchived == true)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: _ArchivedBanner(),
            ),
          TextFormField(
            controller: _nameCtl,
            enabled: canEdit,
            decoration: const InputDecoration(labelText: 'Nomi *'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Nomini kiriting' : null,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _skuCtl,
                  enabled: canEdit,
                  decoration: const InputDecoration(labelText: 'SKU'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: _barcodeCtl,
                  enabled: canEdit,
                  decoration: const InputDecoration(labelText: 'Shtrix-kod'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int?>(
            initialValue: _categoryId,
            decoration: const InputDecoration(labelText: 'Kategoriya'),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('Tanlanmagan')),
              for (final c in _categories) DropdownMenuItem<int?>(value: c.id, child: Text(c.name)),
            ],
            onChanged: canEdit ? (v) => setState(() => _categoryId = v) : null,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int?>(
            initialValue: _unitId,
            decoration: const InputDecoration(labelText: 'O\'lchov birligi'),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('Tanlanmagan')),
              for (final u in _units) DropdownMenuItem<int?>(value: u.id, child: Text(u.displayName)),
            ],
            onChanged: canEdit ? (v) => setState(() => _unitId = v) : null,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _purchasePriceCtl,
                  enabled: canEdit,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Tan narxi'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: _salePriceCtl,
                  enabled: canEdit,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Sotuv narxi'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _wholesalePriceCtl,
            enabled: canEdit,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Ulgurji narx (ixtiyoriy)'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _imageUrlCtl,
            enabled: canEdit,
            decoration: const InputDecoration(labelText: 'Rasm URL (ixtiyoriy)'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _descriptionCtl,
            enabled: canEdit,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Tavsif (ixtiyoriy)'),
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Xizmat'),
            value: _isService,
            onChanged: canEdit ? (v) => setState(() => _isService = v) : null,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Onlaynda ko\'rsatish'),
            value: _isPublishedOnline,
            onChanged: canEdit ? (v) => setState(() => _isPublishedOnline = v) : null,
          ),
          const SizedBox(height: 16),
          if (canEdit)
            ElevatedButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Saqlash'),
            ),
        ],
      ),
    );
  }
}

class _ArchivedBanner extends StatelessWidget {
  const _ArchivedBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.archive_outlined, color: Colors.orange.shade800, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Bu mahsulot arxivlangan',
              style: TextStyle(color: Colors.orange.shade800),
            ),
          ),
        ],
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
