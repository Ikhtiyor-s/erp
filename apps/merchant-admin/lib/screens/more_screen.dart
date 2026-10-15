import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../state/auth_state.dart';
import '../widgets/permission_gate.dart';

/// Nav hub for the back-office areas that don't get their own bottom-nav
/// slot (DESIGN-merchant-admin.md §4.1): Staff / Expenses / Settings /
/// Till-shift. Static tile list of route-pushes + logout — no service calls
/// of its own.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final user = auth.user;
    return Scaffold(
      appBar: AppBar(title: const Text('Ko\'proq')),
      body: ListView(
        children: [
          if (user != null)
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text(user.fullName),
              subtitle: Text(user.phone ?? user.email ?? ''),
            ),
          const Divider(height: 1),
          PermissionGate(
            code: 'hr.view',
            child: ListTile(
              leading: const Icon(Icons.groups_outlined),
              title: const Text('Xodimlar'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/staff'),
            ),
          ),
          PermissionGate(
            code: 'finance.view',
            child: ListTile(
              leading: const Icon(Icons.point_of_sale_outlined),
              title: const Text('Smena (kassa)'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/till-shift'),
            ),
          ),
          PermissionGate(
            code: 'finance.view',
            child: ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: const Text('Xarajatlar'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/expenses'),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.settings_outlined),
            title: const Text('Sozlamalar'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings'),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Chiqish', style: TextStyle(color: Colors.red)),
            onTap: () => auth.logout(),
          ),
        ],
      ),
    );
  }
}
