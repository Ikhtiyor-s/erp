import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../services/permissions_service.dart';
import '../state/auth_state.dart';

class _NavTab {
  final String route;
  final IconData icon;
  final String label;
  final bool Function(PermissionsService) visible;
  const _NavTab(this.route, this.icon, this.label, this.visible);
}

bool _alwaysVisible(PermissionsService _) => true;

/// Bottom-nav shell for the 5 tab roots (DESIGN-merchant-admin.md §5). Tab
/// visibility is identical for every role — gated purely by permission code,
/// never by role name. If none of the 4 data-tab permissions is present
/// (e.g. a custom role with no statistics/sale/warehouse access at all), a
/// centered message replaces the nav bar instead of showing dead tabs.
class AppShell extends StatelessWidget {
  final String location;
  final Widget child;

  const AppShell({super.key, required this.location, required this.child});

  static final List<_NavTab> _dataTabs = [
    _NavTab('/dashboard', Icons.home_outlined, 'Bosh sahifa',
        (p) => p.hasPermission('statistics.view')),
    _NavTab('/orders', Icons.receipt_long_outlined, 'Buyurtmalar',
        (p) => p.hasPermission('sale.view')),
    _NavTab('/menu/products', Icons.inventory_2_outlined, 'Katalog',
        (p) => p.hasPermission('warehouse.view') && p.hasPermission('warehouse.product.view')),
    _NavTab('/statistics/overview', Icons.bar_chart_outlined, 'Statistika',
        (p) => p.hasPermission('statistics.view')),
  ];

  static final _NavTab _moreTab =
      _NavTab('/more', Icons.more_horiz, 'Ko\'proq', _alwaysVisible);

  @override
  Widget build(BuildContext context) {
    final perms = context.watch<PermissionsService>();
    final visibleDataTabs = _dataTabs.where((t) => t.visible(perms)).toList();

    if (visibleDataTabs.isEmpty) {
      return _NoPermissionsScreen(onLogout: () => context.read<AuthState>().logout());
    }

    final tabs = [...visibleDataTabs, _moreTab];
    final currentIndex = tabs.indexWhere((t) => t.route == location);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex < 0 ? 0 : currentIndex,
        onDestinationSelected: (i) => context.go(tabs[i].route),
        destinations: [
          for (final tab in tabs)
            NavigationDestination(icon: Icon(tab.icon), label: tab.label),
        ],
      ),
    );
  }
}

class _NoPermissionsScreen extends StatelessWidget {
  final VoidCallback onLogout;
  const _NoPermissionsScreen({required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_outline, size: 48),
                const SizedBox(height: 16),
                const Text(
                  'Sizda bu ilovadan foydalanish uchun ruxsatlar yo\'q — '
                  'administratorga murojaat qiling',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                OutlinedButton(onPressed: onLogout, child: const Text('Chiqish')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
