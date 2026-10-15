import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../services/menu_service.dart';
import '../../services/permissions_service.dart';
import '../../utils/dio_error.dart';
import '../../widgets/permission_gate.dart';

class CategoryEditScreen extends StatefulWidget {
  final String categoryId;

  const CategoryEditScreen({super.key, required this.categoryId});

  bool get isNew => categoryId == 'new';

  @override
  State<CategoryEditScreen> createState() => _CategoryEditScreenState();
}

class _CategoryEditScreenState extends State<CategoryEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtl = TextEditingController();

  bool _loading = true;
  String? _loadError;
  bool _saving = false;

  Category? _category;
  List<Category> _allCategories = [];
  int? _parentId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final all = await MenuService.fetchCategories();
      Category? category;
      if (!widget.isNew) {
        final cid = int.tryParse(widget.categoryId);
        for (final c in all) {
          if (c.id == cid) {
            category = c;
            break;
          }
        }
        if (category == null) {
          throw Exception('not-found');
        }
      }
      if (!mounted) return;
      setState(() {
        _allCategories = all;
        _category = category;
        if (category != null) {
          _nameCtl.text = category.name;
          _parentId = category.parentId;
        }
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e is Exception && e.toString().contains('not-found')
            ? 'Kategoriya topilmadi'
            : describeDioError(e);
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      if (widget.isNew) {
        final newId = await MenuService.createCategory(name: _nameCtl.text.trim(), parentId: _parentId);
        if (!mounted) return;
        context.pushReplacement('/menu/categories/$newId');
      } else {
        await MenuService.updateCategory(_category!.id, name: _nameCtl.text.trim(), parentId: _parentId);
        final all = await MenuService.fetchCategories();
        if (!mounted) return;
        setState(() {
          _allCategories = all;
          for (final c in all) {
            if (c.id == _category!.id) _category = c;
          }
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

  Future<void> _delete() async {
    if (_category == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Kategoriyani o\'chirish'),
        content: Text('"${_category!.name}" kategoriyasini o\'chirishni tasdiqlaysizmi?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Bekor qilish')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('O\'chirish')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await MenuService.deleteCategory(_category!.id);
      if (!mounted) return;
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final canEdit = context.watch<PermissionsService>().hasPermission(
          widget.isNew ? 'warehouse.create' : 'warehouse.update',
        );
    final title = widget.isNew ? 'Yangi kategoriya' : 'Kategoriya';

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          if (!widget.isNew && _category != null)
            PermissionGate(
              code: 'warehouse.delete',
              child: IconButton(icon: const Icon(Icons.delete_outline), onPressed: _delete),
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
          TextFormField(
            controller: _nameCtl,
            enabled: canEdit,
            decoration: const InputDecoration(labelText: 'Nomi *'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Nomini kiriting' : null,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int?>(
            initialValue: _parentId,
            decoration: const InputDecoration(labelText: 'Ustki kategoriya'),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('Yo\'q (bosh kategoriya)')),
              for (final c in _allCategories)
                if (!widget.isNew ? c.id != _category?.id : true)
                  DropdownMenuItem<int?>(value: c.id, child: Text(c.name)),
            ],
            onChanged: canEdit ? (v) => setState(() => _parentId = v) : null,
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
