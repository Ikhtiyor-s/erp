import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/services/menu_service.dart';

void main() {
  group('Warehouse.fromJson', () {
    test('parses int id and name', () {
      final w = Warehouse.fromJson({'id': 1, 'name': 'Asosiy ombor'});
      expect(w.id, 1);
      expect(w.name, 'Asosiy ombor');
    });
  });

  group('Category.fromJson', () {
    test('id and parent_id are plain ints, not UUIDs (DESIGN §8.2)', () {
      final c = Category.fromJson({'id': 3, 'name': 'Ichimliklar', 'parent_id': 1, 'path': '/1/3/'});
      expect(c.id, 3);
      expect(c.parentId, 1);
      expect(c.name, 'Ichimliklar');
    });

    test('null parent_id means root category', () {
      final c = Category.fromJson({'id': 1, 'name': 'Root', 'parent_id': null});
      expect(c.parentId, isNull);
    });
  });

  group('Unit.fromJson', () {
    test('displayName combines name and short_name when present', () {
      final u = Unit.fromJson({'id': 1, 'name': 'Kilogramm', 'short_name': 'kg'});
      expect(u.displayName, 'Kilogramm (kg)');
    });

    test('displayName falls back to name when short_name missing', () {
      final u = Unit.fromJson({'id': 2, 'name': 'Dona', 'short_name': null});
      expect(u.displayName, 'Dona');
    });
  });

  group('ProductListItem.fromJson', () {
    test('product id is a UUID string (DESIGN §8.2)', () {
      final p = ProductListItem.fromJson({
        'id': 'a1b2c3d4-0000-0000-0000-000000000000',
        'name': 'Kola 0.5L',
        'sku': 'SKU-1',
        'product_type': 'good',
        'product_type_label': 'Tovar',
        'category_id': 5,
        'category_name': 'Ichimliklar',
        'unit_id': 2,
        'unit_name': 'dona',
        'on_hand': 12,
        'is_published_online': true,
      });
      expect(p.id, 'a1b2c3d4-0000-0000-0000-000000000000');
      expect(p.categoryId, 5);
      expect(p.onHand, 12);
      expect(p.isPublishedOnline, true);
    });

    test('on_hand parses whole-valued decimal as a plain JSON number', () {
      final p = ProductListItem.fromJson({'id': 'x', 'name': 'n', 'on_hand': 3});
      expect(p.onHand, 3);
    });

    test('missing is_published_online defaults to false, not a crash', () {
      final p = ProductListItem.fromJson({'id': 'x', 'name': 'n', 'on_hand': 0});
      expect(p.isPublishedOnline, false);
    });
  });

  group('ProductPage.fromJson', () {
    test('parses paginated shape and computes hasMore', () {
      final page = ProductPage.fromJson({
        'total': 120,
        'page': 1,
        'limit': 50,
        'items': [
          {'id': 'a', 'name': 'A', 'on_hand': 1},
          {'id': 'b', 'name': 'B', 'on_hand': 2},
        ],
      });
      expect(page.total, 120);
      expect(page.items.length, 2);
      expect(page.hasMore, true);
    });

    test('hasMore is false on the last page', () {
      final page = ProductPage.fromJson({'total': 2, 'page': 1, 'limit': 50, 'items': []});
      expect(page.hasMore, false);
    });
  });

  group('ProductDetail', () {
    test('money fields parse whether they arrive as JSON strings or numbers (DESIGN §8.3)', () {
      final detail = ProductDetail.fromJson({
        'id': 'p1',
        'name': 'Non',
        'sale_price': '12500.00',
        'purchase_price': 9000,
        'wholesale_price': null,
        'is_service': false,
        'is_archived': false,
        'is_published_online': false,
      });
      expect(detail.salePrice, 12500);
      expect(detail.purchasePrice, 9000);
      expect(detail.wholesalePrice, isNull);
    });

    test('isArchived reflects the server flag', () {
      final detail = ProductDetail.fromJson({'id': 'p1', 'name': 'Non', 'is_archived': true});
      expect(detail.isArchived, true);
    });

    test('toMutationBody strips fields whose shape does not match ProductIn and overlays overrides', () {
      final detail = ProductDetail.fromJson({
        'id': 'p1',
        'name': 'Non',
        'sale_price': '5000.00',
        'box_qty': '12.000',
        'is_material': true,
        'extra_barcodes': [
          {'id': 1, 'barcode': '4780000000017', 'is_primary': true, 'is_active': true},
        ],
        'tags': [
          {'id': 1, 'name': 'Aksiya', 'color': 'red'},
        ],
        'variants': [],
      });

      final body = detail.toMutationBody({'name': 'Yangi non', 'sale_price': 5500});

      expect(body['name'], 'Yangi non');
      expect(body['sale_price'], 5500);
      expect(body.containsKey('extra_barcodes'), false);
      expect(body.containsKey('tags'), false);
      expect(body.containsKey('variants'), false);
      // Fields the form never exposes must round-trip unchanged so the
      // backend's full-replace PUT doesn't silently wipe them.
      expect(body['box_qty'], '12.000');
      expect(body['is_material'], true);
    });
  });
}
