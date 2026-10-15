import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'screens/dashboard_screen.dart';
import 'screens/expenses_screen.dart';
import 'screens/login_screen.dart';
import 'screens/menu/category_edit_screen.dart';
import 'screens/menu/category_list_screen.dart';
import 'screens/menu/product_detail_screen.dart';
import 'screens/menu/product_list_screen.dart';
import 'screens/more_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/scanner_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/staff_screen.dart';
import 'screens/statistics/custom_reports_screen.dart';
import 'screens/statistics/sales_history_screen.dart';
import 'screens/statistics/statistics_overview_screen.dart';
import 'screens/till_shift_screen.dart';
import 'state/auth_state.dart';
import 'widgets/app_shell.dart';

/// Full route table (DESIGN-merchant-admin.md §5). `/orders/:id` is a push
/// route backed by `OrderDetailScreen` (defined in `orders_screen.dart`,
/// MA-6's call per DESIGN §5).
GoRouter buildRouter(AuthState auth) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: auth,
    redirect: (context, state) {
      if (auth.loading) return null;

      final loggedIn = auth.isAuthenticated;
      final loggingIn = state.matchedLocation == '/login';
      final atRoot = state.matchedLocation == '/';

      if (!loggedIn && !loggingIn) return '/login';
      if (loggedIn && (atRoot || loggingIn)) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const _Splash()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      ShellRoute(
        builder: (context, state, child) =>
            AppShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/dashboard', builder: (_, _) => const DashboardScreen()),
          GoRoute(path: '/orders', builder: (_, _) => const OrdersScreen()),
          GoRoute(path: '/menu/products', builder: (_, _) => const ProductListScreen()),
          GoRoute(
            path: '/statistics/overview',
            builder: (_, _) => const StatisticsOverviewScreen(),
          ),
          GoRoute(path: '/more', builder: (_, _) => const MoreScreen()),
        ],
      ),
      GoRoute(path: '/till-shift', builder: (_, _) => const TillShiftScreen()),
      GoRoute(path: '/scanner', builder: (_, _) => const ScannerScreen()),
      GoRoute(
        path: '/orders/:id',
        builder: (_, state) => OrderDetailScreen(saleId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/menu/products/:id',
        builder: (_, state) => ProductDetailScreen(productId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/menu/categories', builder: (_, _) => const CategoryListScreen()),
      GoRoute(
        path: '/menu/categories/:id',
        builder: (_, state) => CategoryEditScreen(categoryId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/statistics/sales-history',
        builder: (_, _) => const SalesHistoryScreen(),
      ),
      GoRoute(
        path: '/statistics/custom-reports',
        builder: (_, _) => const CustomReportsScreen(),
      ),
      GoRoute(path: '/staff', builder: (_, _) => const StaffScreen()),
      GoRoute(path: '/expenses', builder: (_, _) => const ExpensesScreen()),
      GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(child: Text('Xato: ${state.error}')),
    ),
  );
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
