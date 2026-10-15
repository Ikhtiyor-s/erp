import 'package:dio/dio.dart';
import '../utils/num_parse.dart';
import 'api_client.dart';

class SaleSummary {
  final String id;
  final String? docNumber;
  final String uuidLabel;
  final String? customerName;
  final String? customerPhone;
  final String? warehouseName;
  final DateTime? saleDate;
  final num totalAmount;
  final num paidAmount;
  final String status;
  final String? kioskStatus;
  final String? currencyCode;
  final String sourceType;
  final String? notes;

  const SaleSummary({
    required this.id,
    this.docNumber,
    required this.uuidLabel,
    this.customerName,
    this.customerPhone,
    this.warehouseName,
    this.saleDate,
    required this.totalAmount,
    required this.paidAmount,
    required this.status,
    this.kioskStatus,
    this.currencyCode,
    required this.sourceType,
    this.notes,
  });

  String get displayStatus =>
      sourceType == 'sale_kiosk' && kioskStatus != null ? kioskStatus! : status;

  factory SaleSummary.fromJson(Map<String, dynamic> j) => SaleSummary(
        id: j['id']?.toString() ?? '',
        docNumber: j['doc_number']?.toString(),
        uuidLabel: j['uuid_label']?.toString() ?? '',
        customerName: j['customer_name']?.toString(),
        customerPhone: j['customer_phone']?.toString(),
        warehouseName: j['warehouse_name']?.toString(),
        saleDate: DateTime.tryParse(j['sale_date']?.toString() ?? ''),
        totalAmount: parseNum(j['total_amount']),
        paidAmount: parseNum(j['paid_amount']),
        status: j['status']?.toString() ?? '',
        kioskStatus: j['kiosk_status']?.toString(),
        currencyCode: j['currency_code']?.toString(),
        sourceType: j['source_type']?.toString() ?? 'sale',
        notes: j['notes']?.toString(),
      );
}

class SaleItemLine {
  final String? productId;
  final String? productName;
  final num quantity;
  final num price;
  final num discount;
  final num amount;

  const SaleItemLine({
    this.productId,
    this.productName,
    required this.quantity,
    required this.price,
    required this.discount,
    required this.amount,
  });

  factory SaleItemLine.fromJson(Map<String, dynamic> j) => SaleItemLine(
        productId: j['product_id']?.toString(),
        productName: j['product_name']?.toString(),
        quantity: parseNum(j['quantity']),
        price: parseNum(j['price']),
        discount: parseNum(j['discount']),
        amount: parseNum(j['amount']),
      );
}

class SaleDetail {
  final SaleSummary head;
  final String? customerAddress;
  final String? customerTin;
  final List<SaleItemLine> items;

  const SaleDetail({
    required this.head,
    this.customerAddress,
    this.customerTin,
    required this.items,
  });

  factory SaleDetail.fromJson(Map<String, dynamic> j) {
    final head = (j['head'] as Map<String, dynamic>?) ?? const {};
    final items = (j['items'] as List<dynamic>?) ?? const [];
    return SaleDetail(
      head: SaleSummary.fromJson(head),
      customerAddress: head['customer_address']?.toString(),
      customerTin: head['customer_tin']?.toString(),
      items: items.map((e) => SaleItemLine.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

/// Read-only sale/order access (`sale/router.py:73,263`). No checkout, no
/// payment capture — DESIGN-merchant-admin.md §9 / SPEC §7 WON'T DO.
class OrdersService {
  static Dio get _dio => ApiClient.instance;

  static Future<List<SaleSummary>> fetchSales({
    int limit = 50,
    int offset = 0,
    String? status,
    String? q,
  }) async {
    final res = await _dio.get<List<dynamic>>('/sale/sales', queryParameters: {
      'limit': limit,
      'offset': offset,
      if (status != null && status.isNotEmpty) 'status': status,
      if (q != null && q.isNotEmpty) 'q': q,
    });
    final list = res.data ?? [];
    return list.map((e) => SaleSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<SaleDetail> fetchSaleDetail(String saleId) async {
    final res = await _dio.get<Map<String, dynamic>>('/sale/sales/$saleId');
    return SaleDetail.fromJson(res.data ?? const {});
  }
}
