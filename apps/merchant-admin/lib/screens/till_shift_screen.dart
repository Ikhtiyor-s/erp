import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/permissions_service.dart';
import '../services/till_shift_service.dart';
import '../utils/dio_error.dart';

/// Till-shift (smena) open/close against the already-built
/// `/cashbox-sessions/*` endpoints — no client-side reimplementation of the
/// backend's smena logic (ticket text, §1.6). Gating here is cosmetic only
/// (DESIGN-merchant-admin.md §6.6) — stated plainly, not hidden.
class TillShiftScreen extends StatefulWidget {
  const TillShiftScreen({super.key});

  @override
  State<TillShiftScreen> createState() => _TillShiftScreenState();
}

class _TillShiftScreenState extends State<TillShiftScreen> {
  List<CashboxSummary>? _cashboxes;
  CashboxSummary? _selected;
  CashboxSession? _activeSession;
  SessionTotals? _totals;
  Object? _error;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final cashboxes = await TillShiftService.fetchCashboxes();
      if (cashboxes.isEmpty) {
        setState(() {
          _cashboxes = cashboxes;
          _loading = false;
        });
        return;
      }
      final savedId = await TillShiftService.getSelectedCashboxId();
      final selected = cashboxes.firstWhere(
        (c) => c.id == savedId,
        orElse: () => cashboxes.first,
      );
      await _selectCashbox(cashboxes, selected);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _selectCashbox(List<CashboxSummary> cashboxes, CashboxSummary selected) async {
    setState(() {
      _cashboxes = cashboxes;
      _selected = selected;
      _loading = true;
    });
    await TillShiftService.setSelectedCashboxId(selected.id);
    await _refreshSession();
  }

  Future<void> _refreshSession() async {
    final selected = _selected;
    if (selected == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await TillShiftService.fetchActiveSession(selected.id);
      SessionTotals? totals;
      if (session != null) {
        totals = await TillShiftService.fetchTotals(session.id);
      }
      if (!mounted) return;
      setState(() {
        _activeSession = session;
        _totals = totals;
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

  Future<void> _openShift() async {
    final selected = _selected;
    if (selected == null) return;
    final result = await showDialog<_OpenShiftInput>(
      context: context,
      builder: (_) => const _OpenShiftDialog(),
    );
    if (result == null) return;
    setState(() => _busy = true);
    try {
      await TillShiftService.openSession(
        cashboxId: selected.id,
        openedBalance: result.openedBalance,
        openedNote: result.openedNote,
      );
      await _refreshSession();
    } catch (e) {
      if (!mounted) return;
      _showError(describeDioError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _closeShift() async {
    final session = _activeSession;
    final totals = _totals;
    if (session == null || totals == null) return;
    final expected = session.openedBalance + totals.totalIncome - totals.totalExpense;
    final result = await showDialog<_CloseShiftInput>(
      context: context,
      builder: (_) => _CloseShiftDialog(expectedBalance: expected),
    );
    if (result == null) return;
    setState(() => _busy = true);
    try {
      await TillShiftService.closeSession(
        sessionId: session.id,
        closedBalance: result.closedBalance,
        closedDiff: result.closedBalance - expected,
        closedNote: result.closedNote,
      );
      await _refreshSession();
    } catch (e) {
      if (!mounted) return;
      // Ticket DoD: the on_hold rejection (and any other backend error) is
      // surfaced verbatim — no retry, no silent swallow.
      _showError(describeDioError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showError(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xatolik'),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Yopish')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final perms = context.watch<PermissionsService>();
    return Scaffold(
      appBar: AppBar(title: const Text('Smena (kassa)')),
      body: !perms.hasPermission('finance.view')
          ? const _InaccessibleMessage()
          : _buildBody(),
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
              OutlinedButton(onPressed: _bootstrap, child: const Text('Qayta urinish')),
            ],
          ),
        ),
      );
    }
    final cashboxes = _cashboxes ?? const [];
    if (cashboxes.isEmpty) {
      return const Center(child: Text("Tashkilotda faol kassa topilmadi"));
    }
    return RefreshIndicator(
      onRefresh: _refreshSession,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (cashboxes.length > 1)
            DropdownButtonFormField<int>(
              initialValue: _selected?.id,
              decoration: const InputDecoration(labelText: 'Kassa'),
              items: [
                for (final c in cashboxes)
                  DropdownMenuItem(value: c.id, child: Text(c.name)),
              ],
              onChanged: _busy
                  ? null
                  : (id) {
                      final c = cashboxes.firstWhere((e) => e.id == id);
                      _selectCashbox(cashboxes, c);
                    },
            ),
          const SizedBox(height: 16),
          if (_activeSession == null) _buildNoActiveShift() else _buildActiveShift(),
        ],
      ),
    );
  }

  Widget _buildNoActiveShift() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Bu kassada ochiq smena yo\'q'),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _openShift,
              child: const Text('Smenani ochish'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveShift() {
    final session = _activeSession!;
    final totals = _totals!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Ochiq smena', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            _Row('Ochilgan balans', session.openedBalance.toString()),
            _Row('Tushum', totals.totalIncome.toString()),
            _Row('Chiqim', totals.totalExpense.toString()),
            _Row('Sotuvlar soni', totals.saleCount.toString()),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: _busy ? null : _closeShift,
              child: const Text('Smenani yopish'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label), Text(value)],
      ),
    );
  }
}

class _InaccessibleMessage extends StatelessWidget {
  const _InaccessibleMessage();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Sizda bu bo\'limdan foydalanish uchun ruxsat yo\'q',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

class _OpenShiftInput {
  final num openedBalance;
  final String? openedNote;
  const _OpenShiftInput(this.openedBalance, this.openedNote);
}

class _OpenShiftDialog extends StatefulWidget {
  const _OpenShiftDialog();

  @override
  State<_OpenShiftDialog> createState() => _OpenShiftDialogState();
}

class _OpenShiftDialogState extends State<_OpenShiftDialog> {
  final _balanceController = TextEditingController(text: '0');
  final _noteController = TextEditingController();

  @override
  void dispose() {
    _balanceController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Smenani ochish'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _balanceController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Boshlang\'ich balans'),
          ),
          TextField(
            controller: _noteController,
            decoration: const InputDecoration(labelText: 'Izoh (ixtiyoriy)'),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Bekor qilish')),
        FilledButton(
          onPressed: () {
            final balance = num.tryParse(_balanceController.text.trim()) ?? 0;
            Navigator.of(context).pop(_OpenShiftInput(
              balance,
              _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
            ));
          },
          child: const Text('Ochish'),
        ),
      ],
    );
  }
}

class _CloseShiftInput {
  final num closedBalance;
  final String? closedNote;
  const _CloseShiftInput(this.closedBalance, this.closedNote);
}

class _CloseShiftDialog extends StatefulWidget {
  final num expectedBalance;
  const _CloseShiftDialog({required this.expectedBalance});

  @override
  State<_CloseShiftDialog> createState() => _CloseShiftDialogState();
}

class _CloseShiftDialogState extends State<_CloseShiftDialog> {
  late final _balanceController =
      TextEditingController(text: widget.expectedBalance.toString());
  final _noteController = TextEditingController();

  @override
  void dispose() {
    _balanceController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Smenani yopish'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Kutilayotgan balans: ${widget.expectedBalance}'),
          TextField(
            controller: _balanceController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Haqiqiy balans'),
          ),
          TextField(
            controller: _noteController,
            decoration: const InputDecoration(labelText: 'Izoh (ixtiyoriy)'),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Bekor qilish')),
        FilledButton(
          onPressed: () {
            final balance = num.tryParse(_balanceController.text.trim()) ?? widget.expectedBalance;
            Navigator.of(context).pop(_CloseShiftInput(
              balance,
              _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
            ));
          },
          child: const Text('Yopish'),
        ),
      ],
    );
  }
}
