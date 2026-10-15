import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/permissions_service.dart';
import '../services/staff_service.dart';
import '../services/till_shift_service.dart';
import '../utils/dio_error.dart';
import '../widgets/permission_gate.dart';

const _kRunStatusLabels = {
  'draft': 'Qoralama',
  'approved': 'Tasdiqlangan',
  'paid': "To'langan",
};

/// Employees (read list) + attendance clock-in/out + payroll runs view with
/// approve/pay actions gated by permission CODE, never role name
/// (DESIGN-merchant-admin.md §6.4 — `manager` holds neither
/// `hr.payroll.approve` nor `hr.payroll.pay`).
class StaffScreen extends StatefulWidget {
  const StaffScreen({super.key});

  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  @override
  Widget build(BuildContext context) {
    final perms = context.watch<PermissionsService>();
    if (!perms.hasPermission('hr.view')) {
      return Scaffold(
        appBar: AppBar(title: const Text('Xodimlar')),
        body: const Center(child: Text('Sizda bu bo\'limdan foydalanish uchun ruxsat yo\'q')),
      );
    }
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Xodimlar'),
          bottom: const TabBar(
            tabs: [Tab(text: 'Xodimlar'), Tab(text: 'Ish haqi')],
          ),
        ),
        body: const TabBarView(
          children: [_EmployeesTab(), _PayrollTab()],
        ),
      ),
    );
  }
}

class _EmployeesTab extends StatefulWidget {
  const _EmployeesTab();

  @override
  State<_EmployeesTab> createState() => _EmployeesTabState();
}

class _EmployeesTabState extends State<_EmployeesTab> {
  List<Employee>? _employees;
  Object? _error;
  bool _loading = true;
  String? _busyEmployeeId;

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
      final employees = await StaffService.fetchEmployees();
      if (!mounted) return;
      setState(() {
        _employees = employees;
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

  Future<void> _clockIn(Employee e) => _runAttendance(e, StaffService.clockIn, 'Kelish belgilandi');
  Future<void> _clockOut(Employee e) => _runAttendance(e, StaffService.clockOut, 'Ketish belgilandi');

  Future<void> _runAttendance(
    Employee e,
    Future<void> Function(String) action,
    String successMessage,
  ) async {
    setState(() => _busyEmployeeId = e.id);
    try {
      await action(e.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(successMessage)));
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(err))));
    } finally {
      if (mounted) setState(() => _busyEmployeeId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(describeDioError(_error!), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _load, child: const Text('Qayta urinish')),
            ],
          ),
        ),
      );
    }
    final employees = _employees ?? const [];
    if (employees.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(child: Text('0 ta xodim topildi')),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: employees.length,
        itemBuilder: (context, i) {
          final e = employees[i];
          final busy = _busyEmployeeId == e.id;
          return ListTile(
            leading: const CircleAvatar(child: Icon(Icons.person_outline)),
            title: Text(e.fullName),
            subtitle: Text([
              if (e.positionName != null) e.positionName!,
              if (e.phone != null) e.phone!,
            ].join(' · ')),
            trailing: PermissionGate(
              code: 'hr.create',
              child: busy
                  ? const SizedBox(
                      width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Kelish',
                          icon: const Icon(Icons.login),
                          onPressed: () => _clockIn(e),
                        ),
                        IconButton(
                          tooltip: 'Ketish',
                          icon: const Icon(Icons.logout),
                          onPressed: () => _clockOut(e),
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

class _PayrollTab extends StatefulWidget {
  const _PayrollTab();

  @override
  State<_PayrollTab> createState() => _PayrollTabState();
}

class _PayrollTabState extends State<_PayrollTab> {
  List<PayrollRun>? _runs;
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
      final runs = await StaffService.fetchPayrollRuns();
      if (!mounted) return;
      setState(() {
        _runs = runs;
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

  Future<void> _createRun() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year, now.month, 1),
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 1),
      helpText: 'Hisob-kitob davri (oy)',
    );
    if (picked == null) return;
    try {
      await StaffService.createPayrollRun(periodMonth: picked);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _buildBody(),
      floatingActionButton: PermissionGate(
        code: 'hr.create',
        child: FloatingActionButton(
          onPressed: _createRun,
          child: const Icon(Icons.add),
        ),
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
              Text(describeDioError(_error!), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _load, child: const Text('Qayta urinish')),
            ],
          ),
        ),
      );
    }
    final runs = _runs ?? const [];
    if (runs.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(child: Text("0 ta hisob-kitob topildi")),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: runs.length,
        itemBuilder: (context, i) {
          final r = runs[i];
          final period = r.periodMonth;
          final periodLabel = period == null
              ? '-'
              : '${period.year}-${period.month.toString().padLeft(2, '0')}';
          return ListTile(
            title: Text(periodLabel),
            subtitle: Text('${_kRunStatusLabels[r.status] ?? r.status} · ${r.employeeCount} xodim'),
            trailing: Text(r.totalNet.toString()),
            onTap: () async {
              await Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => _PayrollRunDetailScreen(runId: r.id),
              ));
              _load();
            },
          );
        },
      ),
    );
  }
}

class _PayrollRunDetailScreen extends StatefulWidget {
  final String runId;
  const _PayrollRunDetailScreen({required this.runId});

  @override
  State<_PayrollRunDetailScreen> createState() => _PayrollRunDetailScreenState();
}

class _PayrollRunDetailScreenState extends State<_PayrollRunDetailScreen> {
  PayrollRunDetail? _detail;
  Object? _error;
  bool _loading = true;
  bool _busy = false;

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
      final detail = await StaffService.fetchPayrollRunDetail(widget.runId);
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

  Future<void> _approve() async {
    setState(() => _busy = true);
    try {
      await StaffService.approvePayrollRun(widget.runId);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pay() async {
    final cashboxId = await _pickCashbox();
    if (cashboxId == null) return;
    setState(() => _busy = true);
    try {
      await StaffService.payPayrollRun(widget.runId, cashboxId);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<int?> _pickCashbox() async {
    List<CashboxSummary> cashboxes;
    try {
      cashboxes = await TillShiftService.fetchCashboxes();
    } catch (e) {
      if (!mounted) return null;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeDioError(e))));
      return null;
    }
    if (!mounted || cashboxes.isEmpty) return null;
    return showDialog<int>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text("To'lov uchun kassa"),
        children: [
          for (final c in cashboxes)
            SimpleDialogOption(
              onPressed: () => Navigator.of(ctx).pop(c.id),
              child: Text(c.name),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hisob-kitob')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(describeDioError(_error!)))
              : _buildBody(_detail!),
    );
  }

  Widget _buildBody(PayrollRunDetail detail) {
    final head = detail.head;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(_kRunStatusLabels[head.status] ?? head.status,
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 16),
        for (final item in detail.items)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(item.employeeName),
            subtitle: Text('Oklad: ${item.baseSalary} · Bonus: ${item.bonus} · Ushlab qolindi: '
                '${item.deductions + item.advanceDeducted}'),
            trailing: Text(item.netPay.toString()),
          ),
        const SizedBox(height: 16),
        if (head.status == 'draft')
          PermissionGate(
            code: 'hr.payroll.approve',
            child: FilledButton(
              onPressed: _busy ? null : _approve,
              child: const Text('Tasdiqlash'),
            ),
          ),
        if (head.status == 'approved')
          PermissionGate(
            code: 'hr.payroll.pay',
            child: FilledButton(
              onPressed: _busy ? null : _pay,
              child: const Text("To'lash"),
            ),
          ),
      ],
    );
  }
}
