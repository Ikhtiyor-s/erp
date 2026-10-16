import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/expenses_service.dart';
import '../services/permissions_service.dart';
import '../utils/dio_error.dart';
import '../widgets/permission_gate.dart';
import '../widgets/zebra_tile.dart';

/// `finance.extra-costs` list + create (DESIGN-merchant-admin.md §6.3).
/// Delete is admin-only (`finance.delete` — `manager` never gets `.delete`
/// suffixes, §1.7).
class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  List<ExtraCost>? _expenses;
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
      final expenses = await ExpensesService.fetchExpenses();
      if (!mounted) return;
      setState(() {
        _expenses = expenses;
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

  Future<void> _addExpense() async {
    List<CashboxOption> cashboxes;
    try {
      cashboxes = await ExpensesService.fetchCashboxes();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
      return;
    }
    if (!mounted) return;
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddExpenseSheet(cashboxes: cashboxes),
    );
    if (created == true) _load();
  }

  Future<void> _delete(ExtraCost expense) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Xarajatni o'chirish"),
        content: Text('"${expense.category}" xarajatini o\'chirishni tasdiqlaysizmi?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Yo\'q')),
          FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Ha')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ExpensesService.deleteExpense(expense.id);
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final perms = context.watch<PermissionsService>();
    return Scaffold(
      appBar: AppBar(title: const Text('Xarajatlar')),
      body: !perms.hasPermission('finance.view')
          ? const Center(child: Text('Sizda bu bo\'limdan foydalanish uchun ruxsat yo\'q'))
          : _buildBody(),
      floatingActionButton: PermissionGate(
        code: 'finance.create',
        child: FloatingActionButton(onPressed: _addExpense, child: const Icon(Icons.add)),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 40, color: Colors.red),
              const SizedBox(height: 12),
              Text(describeDioError(_error!), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: _load, child: const Text('Qayta urinish')),
            ],
          ),
        ),
      );
    }
    final expenses = _expenses ?? const [];
    if (expenses.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(child: Text('0 ta xarajat topildi')),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: expenses.length,
        itemBuilder: (context, i) {
          final e = expenses[i];
          return ZebraTile(
            index: i,
            child: ListTile(
              title: Text(e.category),
              subtitle: Text([
                if (e.costDate != null) e.costDate!.toLocal().toString().substring(0, 10),
                if (e.cashboxName != null) e.cashboxName!,
                if (e.description?.isNotEmpty == true) e.description!,
              ].join(' · ')),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text([
                    e.amount.toString(),
                    if (e.currencyCode != null) e.currencyCode!,
                  ].join(' ')),
                  PermissionGate(
                    code: 'finance.delete',
                    child: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => _delete(e),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _AddExpenseSheet extends StatefulWidget {
  final List<CashboxOption> cashboxes;
  const _AddExpenseSheet({required this.cashboxes});

  @override
  State<_AddExpenseSheet> createState() => _AddExpenseSheetState();
}

class _AddExpenseSheetState extends State<_AddExpenseSheet> {
  final _formKey = GlobalKey<FormState>();
  final _categoryController = TextEditingController();
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  CashboxOption? _cashbox;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.cashboxes.isNotEmpty) _cashbox = widget.cashboxes.first;
  }

  @override
  void dispose() {
    _categoryController.dispose();
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final cashbox = _cashbox;
    if (cashbox == null) {
      setState(() => _error = 'Kassani tanlang');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ExpensesService.createExpense(
        costDate: DateTime.now(),
        category: _categoryController.text.trim(),
        amount: num.parse(_amountController.text.trim()),
        currencyId: cashbox.currencyId,
        cashboxId: cashbox.id,
        description:
            _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on DioException catch (e) {
      setState(() => _error = describeDioError(e));
    } catch (_) {
      setState(() => _error = 'Kutilmagan xatolik yuz berdi');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Xarajat qo\'shish', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 16),
              TextFormField(
                controller: _categoryController,
                decoration: const InputDecoration(labelText: 'Turkum'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Turkumni kiriting' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Summa'),
                validator: (v) {
                  final n = num.tryParse(v?.trim() ?? '');
                  if (n == null || n <= 0) return "To'g'ri summa kiriting";
                  return null;
                },
              ),
              const SizedBox(height: 12),
              if (widget.cashboxes.isEmpty)
                const Text("Tashkilotda faol kassa topilmadi")
              else
                DropdownButtonFormField<CashboxOption>(
                  initialValue: _cashbox,
                  decoration: const InputDecoration(labelText: 'Kassa'),
                  items: [
                    for (final c in widget.cashboxes)
                      DropdownMenuItem(value: c, child: Text(c.name)),
                  ],
                  onChanged: (v) => setState(() => _cashbox = v),
                ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(labelText: 'Izoh (ixtiyoriy)'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Saqlash'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
