import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/num_parse.dart';
import 'api_client.dart';

int _toInt(dynamic v) => v is int ? v : int.tryParse(v?.toString() ?? '') ?? 0;

int? _toIntOrNull(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  return int.tryParse(v.toString());
}

/// `GET /warehouse/warehouses` row (`warehouse/router.py:45`).
class Warehouse {
  final int id;
  final String name;

  const Warehouse({required this.id, required this.name});

  factory Warehouse.fromJson(Map<String, dynamic> j) => Warehouse(
        id: _toInt(j['id']),
        name: j['name']?.toString() ?? '',
      );
}

/// `GET /warehouse/categories` row (`warehouse/router.py:126`). `id`/`parent_id`
/// are plain ints, not UUIDs (DESIGN-merchant-admin.md §8.2).
class Category {
  final int id;
  final String name;
  final int? parentId;

  const Category({required this.id, required this.name, this.parentId});

  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: _toInt(j['id']),
        name: j['name']?.toString() ?? '',
        parentId: _toIntOrNull(j['parent_id']),
      );
}

/// `GET /reference/units` row — used only to populate the product form's
/// unit dropdown.
class Unit {
  final int id;
  final String name;
  final String? shortName;

  const Unit({required this.id, required this.name, this.shortName});

  factory Unit.fromJson(Map<String, dynamic> j) => Unit(
        id: _toInt(j['id']),
        name: j['name']?.toString() ?? '',
        shortName: j['short_name']?.toString(),
      );

  String get displayName => shortName != null && shortName!.isNotEmpty ? '$name ($shortName)' : name;
}

/// One row of the paginated `GET /warehouse/products?warehouse_id=` response
/// (DESIGN-merchant-admin.md §8.1 — this app always passes `warehouse_id`,
/// never the legacy flat-array mode). Product `id` is a UUID string
/// (DESIGN §8.2).
class ProductListItem {
  final String id;
  final String name;
  final String? sku;
  final String? productType;
  final String? productTypeLabel;
  final int? categoryId;
  final String? categoryName;
  final int? unitId;
  final String? unitName;
  final num onHand;
  final bool isPublishedOnline;

  const ProductListItem({
    required this.id,
    required this.name,
    this.sku,
    this.productType,
    this.productTypeLabel,
    this.categoryId,
    this.categoryName,
    this.unitId,
    this.unitName,
    required this.onHand,
    required this.isPublishedOnline,
  });

  factory ProductListItem.fromJson(Map<String, dynamic> j) => ProductListItem(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        sku: j['sku']?.toString(),
        productType: j['product_type']?.toString(),
        productTypeLabel: j['product_type_label']?.toString(),
        categoryId: _toIntOrNull(j['category_id']),
        categoryName: j['category_name']?.toString(),
        unitId: _toIntOrNull(j['unit_id']),
        unitName: j['unit_name']?.toString(),
        onHand: parseNum(j['on_hand']),
        isPublishedOnline: j['is_published_online'] == true,
      );
}

/// `{total, page, limit, items}` shape of the paginated product endpoint.
class ProductPage {
  final int total;
  final int page;
  final int limit;
  final List<ProductListItem> items;

  const ProductPage({
    required this.total,
    required this.page,
    required this.limit,
    required this.items,
  });

  bool get hasMore => page * limit < total;

  factory ProductPage.fromJson(Map<String, dynamic> j) => ProductPage(
        total: _toInt(j['total']),
        page: _toInt(j['page']),
        limit: _toInt(j['limit']),
        items: ((j['items'] as List<dynamic>?) ?? const [])
            .map((e) => ProductListItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// `GET /warehouse/products/{pid}/full` response (`warehouse/router.py:424`
/// — `SELECT p.*` plus joined display columns, plus computed
/// `extra_barcodes`/`tags`/`variants` arrays). Kept as a raw-JSON wrapper
/// rather than a fully-typed model: the backend does a full-replace `PUT`
/// (`_PRODUCT_FIELDS`, `warehouse/router.py:307-334`) against every
/// `ProductIn` field, including several this app's form never exposes
/// (box dimensions, MXIK, variants, tags). [toMutationBody] round-trips the
/// untouched fields through unchanged so saving the exposed fields can never
/// silently wipe the rest of a product's data.
class ProductDetail {
  final Map<String, dynamic> raw;

  const ProductDetail(this.raw);

  factory ProductDetail.fromJson(Map<String, dynamic> j) => ProductDetail(j);

  String get id => raw['id']?.toString() ?? '';
  String get name => raw['name']?.toString() ?? '';
  String? get sku => raw['sku']?.toString();
  String? get barcode => raw['barcode']?.toString();
  int? get categoryId => _toIntOrNull(raw['category_id']);
  String? get categoryName => raw['category_name']?.toString();
  int? get unitId => _toIntOrNull(raw['unit_id']);
  String? get unitName => raw['unit_name']?.toString();
  num get salePrice => parseNum(raw['sale_price']);
  num get purchasePrice => parseNum(raw['purchase_price']);
  num? get wholesalePrice => raw['wholesale_price'] == null ? null : parseNum(raw['wholesale_price']);
  bool get isService => raw['is_service'] == true;
  bool get isArchived => raw['is_archived'] == true;
  bool get isPublishedOnline => raw['is_published_online'] == true;
  String? get imageUrl => raw['image_url']?.toString();
  String? get description => raw['description']?.toString();

  Map<String, dynamic> toMutationBody(Map<String, dynamic> overrides) {
    final body = Map<String, dynamic>.from(raw);
    body.remove('extra_barcodes');
    body.remove('tags');
    body.remove('variants');
    body.addAll(overrides);
    return body;
  }
}

/// All catalog (product + category) HTTP calls for `MA-5`'s four screens.
/// `GET /warehouse/products` is ALWAYS called with `warehouse_id` set
/// (DESIGN-merchant-admin.md §8.1 binding decision) — the legacy flat-array
/// mode is never used by this app.
class MenuService {
  static Dio get _dio => ApiClient.instance;

  static const _kSelectedWarehouseId = 'selected_warehouse_id';

  static Future<List<Warehouse>> fetchWarehouses() async {
    final res = await _dio.get<List<dynamic>>('/warehouse/warehouses');
    return (res.data ?? const [])
        .map((e) => Warehouse.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<int?> getSelectedWarehouseId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_kSelectedWarehouseId);
  }

  static Future<void> setSelectedWarehouseId(int id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kSelectedWarehouseId, id);
  }

  static Future<ProductPage> fetchProducts({
    required int warehouseId,
    int page = 1,
    int limit = 50,
    String? q,
    int? categoryId,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/warehouse/products',
      queryParameters: {
        'warehouse_id': warehouseId,
        'page': page,
        'limit': limit,
        if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
        if (categoryId != null) 'category_id': categoryId,
      },
    );
    return ProductPage.fromJson(res.data ?? const {});
  }

  static Future<ProductDetail> fetchProductFull(String productId) async {
    final res = await _dio.get<Map<String, dynamic>>('/warehouse/products/$productId/full');
    return ProductDetail.fromJson(res.data ?? const {});
  }

  static Future<String> createProduct(Map<String, dynamic> body) async {
    final res = await _dio.post<Map<String, dynamic>>('/warehouse/products', data: body);
    return res.data?['id']?.toString() ?? '';
  }

  static Future<void> updateProduct(String productId, Map<String, dynamic> body) async {
    await _dio.put('/warehouse/products/$productId', data: body);
  }

  static Future<void> archiveProduct(String productId) async {
    await _dio.post('/warehouse/products/$productId/archive');
  }

  static Future<void> unarchiveProduct(String productId) async {
    await _dio.post('/warehouse/products/$productId/unarchive');
  }

  static Future<List<Category>> fetchCategories() async {
    final res = await _dio.get<List<dynamic>>('/warehouse/categories');
    return (res.data ?? const [])
        .map((e) => Category.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<int> createCategory({required String name, int? parentId}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/warehouse/categories',
      data: {'name': name, 'parent_id': parentId},
    );
    return _toInt(res.data?['id']);
  }

  static Future<void> updateCategory(int categoryId, {required String name, int? parentId}) async {
    await _dio.put(
      '/warehouse/categories/$categoryId',
      data: {'name': name, 'parent_id': parentId},
    );
  }

  static Future<void> deleteCategory(int categoryId) async {
    await _dio.delete('/warehouse/categories/$categoryId');
  }

  static Future<List<Unit>> fetchUnits() async {
    final res = await _dio.get<List<dynamic>>('/reference/units');
    return (res.data ?? const []).map((e) => Unit.fromJson(e as Map<String, dynamic>)).toList();
  }
}
