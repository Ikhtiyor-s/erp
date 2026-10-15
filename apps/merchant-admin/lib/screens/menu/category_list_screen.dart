import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/menu_service.dart';
import '../../utils/dio_error.dart';
import '../../widgets/permission_gate.dart';

class CategoryListScreen extends StatefulWidget {
  const CategoryListScreen({super.key});

  @override
  State<CategoryListScreen> createState() => _CategoryListScreenState();
}

class _CategoryListScreenState extends State<CategoryListScreen> {
  bool _loading = true;
  String? _error;
  List<Category> _categories = [];

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
      final categories = await MenuService.fetchCategories();
      if (!mounted) return;
      setState(() {
        _categories = categories;
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

  Future<void> _delete(Category c) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Kategoriyani o\'chirish'),
        content: Text('"${c.name}" kategoriyasini o\'chirishni tasdiqlaysizmi?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Bekor qilish')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('O\'chirish')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await MenuService.deleteCategory(c.id);
      if (!mounted) return;
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kategoriyalar')),
      floatingActionButton: PermissionGate(
        code: 'warehouse.create',
        child: FloatingActionButton.extended(
          onPressed: () => context.push('/menu/categories/new'),
          icon: const Icon(Icons.add),
          label: const Text('Kategoriya'),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return _ErrorState(message: _error!, onRetry: _load);
    }
    if (_categories.isEmpty) {
      return Center(
        child: Text('0 ta kategoriya topildi', style: TextStyle(color: Colors.grey.shade600)),
      );
    }
    final byId = {for (final c in _categories) c.id: c};
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 88),
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          final c = _categories[index];
          final parentName = c.parentId != null ? byId[c.parentId]?.name : null;
          return ListTile(
            leading: const Icon(Icons.category_outlined, color: Colors.grey),
            title: Text(c.name),
            subtitle: parentName != null ? Text(parentName) : null,
            trailing: PermissionGate(
              code: 'warehouse.delete',
              child: IconButton(
                icon: const Icon(Icons.delete_outline),
                onPressed: () => _delete(c),
              ),
            ),
            onTap: () => context.push('/menu/categories/${c.id}'),
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
