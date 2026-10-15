import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/screens/menu/category_edit_screen.dart';
import 'package:merchant_admin/screens/menu/category_list_screen.dart';
import 'package:merchant_admin/screens/menu/product_detail_screen.dart';
import 'package:merchant_admin/screens/menu/product_list_screen.dart';
import 'package:merchant_admin/services/permissions_service.dart';
import 'package:provider/provider.dart';
import 'support/test_env.dart';

Widget _withProviders(Widget child) {
  return ChangeNotifierProvider.value(
    value: PermissionsService.instance,
    child: MaterialApp(home: child),
  );
}

void main() {
  setUp(() {
    setUpFakeApi();
    PermissionsService.instance.clear();
  });

  group('ProductListScreen', () {
    testWidgets('shows an error state (not a crash) when the network call fails', (tester) async {
      await tester.pumpWidget(_withProviders(const ProductListScreen()));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.error_outline), findsOneWidget);
      expect(find.text('Qayta urinish'), findsOneWidget);
    });

    testWidgets('hides the add-product FAB when warehouse.create is missing', (tester) async {
      await tester.pumpWidget(_withProviders(const ProductListScreen()));
      await tester.pumpAndSettle();

      expect(find.byType(FloatingActionButton), findsNothing);
    });
  });

  group('CategoryListScreen', () {
    testWidgets('shows an error state when the network call fails', (tester) async {
      await tester.pumpWidget(_withProviders(const CategoryListScreen()));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.error_outline), findsOneWidget);
    });

    testWidgets('hides the add-category FAB when warehouse.create is missing', (tester) async {
      await tester.pumpWidget(_withProviders(const CategoryListScreen()));
      await tester.pumpAndSettle();

      expect(find.byType(FloatingActionButton), findsNothing);
    });
  });

  group('ProductDetailScreen (new)', () {
    testWidgets('renders the create form immediately without a network round trip', (tester) async {
      await tester.pumpWidget(_withProviders(const ProductDetailScreen(productId: 'new')));
      await tester.pumpAndSettle();

      expect(find.text('Yangi mahsulot'), findsOneWidget);
      expect(find.text('Nomi *'), findsOneWidget);
    });

    testWidgets('hides the Saqlash button when warehouse.create is missing', (tester) async {
      await tester.pumpWidget(_withProviders(const ProductDetailScreen(productId: 'new')));
      await tester.pumpAndSettle();

      expect(find.text('Saqlash'), findsNothing);
    });
  });

  group('CategoryEditScreen (existing id)', () {
    testWidgets('shows an error state when the category list fetch fails', (tester) async {
      await tester.pumpWidget(_withProviders(const CategoryEditScreen(categoryId: '5')));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.error_outline), findsOneWidget);
    });
  });
}
