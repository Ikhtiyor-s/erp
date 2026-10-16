import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/api_client.dart';
import '../utils/dio_error.dart';
import '../utils/num_parse.dart';

class _BarcodeProduct {
  final String name;
  final String? sku;
  final String? barcode;
  final num salePrice;
  final num purchasePrice;
  final String? unitName;

  const _BarcodeProduct({
    required this.name,
    this.sku,
    this.barcode,
    required this.salePrice,
    required this.purchasePrice,
    this.unitName,
  });

  factory _BarcodeProduct.fromJson(Map<String, dynamic> j) => _BarcodeProduct(
        name: j['name']?.toString() ?? '',
        sku: j['sku']?.toString(),
        barcode: j['barcode']?.toString(),
        salePrice: parseNum(j['sale_price']),
        purchasePrice: parseNum(j['purchase_price']),
        unitName: j['unit_name']?.toString(),
      );
}

/// Barcode product-lookup only (DESIGN-merchant-admin.md §4.2/§9) — no
/// checkout, no physical scanner SDK beyond the phone camera. Calls
/// `GET /warehouse/barcode-lookup` directly rather than importing
/// `menu_service.dart` (MA-5 owns that file, runs in parallel, no ordering
/// guarantee between the two tickets — DESIGN §4.2).
class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _manualController = TextEditingController();
  MobileScannerController? _cameraController;
  bool _cameraAvailable = true;
  bool _loading = false;
  String? _notFoundQuery;
  Object? _error;
  _BarcodeProduct? _product;
  String? _lastQuery;

  @override
  void initState() {
    super.initState();
    try {
      _cameraController = MobileScannerController(
        detectionSpeed: DetectionSpeed.normal,
      );
    } catch (_) {
      _cameraAvailable = false;
    }
  }

  @override
  void dispose() {
    _manualController.dispose();
    // Best-effort — the platform camera may already be torn down, and
    // `dispose()` is async, so a synchronous try/catch would not catch it.
    _cameraController?.dispose().catchError((_) {});
    super.dispose();
  }

  Future<void> _lookup(String code) async {
    final trimmed = code.trim();
    if (trimmed.isEmpty || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
      _notFoundQuery = null;
      _product = null;
      _lastQuery = trimmed;
    });
    try {
      final res = await ApiClient.instance
          .get<Map<String, dynamic>>('/warehouse/barcode-lookup', queryParameters: {'q': trimmed});
      if (!mounted) return;
      setState(() {
        _product = _BarcodeProduct.fromJson(res.data ?? const {});
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      if (e.response?.statusCode == 404) {
        setState(() {
          _notFoundQuery = trimmed;
          _loading = false;
        });
      } else {
        setState(() {
          _error = e;
          _loading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  void _onDetect(BarcodeCapture capture) {
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty || _loading) return;
    final value = barcodes.first.rawValue;
    if (value == null || value.isEmpty || value == _lastQuery) return;
    _manualController.text = value;
    _lookup(value);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Shtrix-kod skaner')),
      body: Column(
        children: [
          if (_cameraAvailable)
            SizedBox(
              height: 260,
              child: MobileScanner(
                controller: _cameraController,
                onDetect: _onDetect,
                errorBuilder: (context, error, child) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text(
                        'Kamera ishlamadi — shtrix-kodni qo\'lda kiriting',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  );
                },
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _manualController,
                    decoration: const InputDecoration(
                      labelText: 'Shtrix-kod',
                      isDense: true,
                    ),
                    onSubmitted: _lookup,
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () => _lookup(_manualController.text),
                  child: const Text('Qidirish'),
                ),
              ],
            ),
          ),
          Expanded(child: _buildResult()),
        ],
      ),
    );
  }

  Widget _buildResult() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(child: Text(describeDioError(_error!), textAlign: TextAlign.center));
    }
    if (_notFoundQuery != null) {
      return Center(child: Text('"$_notFoundQuery" bo\'yicha mahsulot topilmadi'));
    }
    final product = _product;
    if (product == null) {
      return const Center(child: Text('Shtrix-kodni skanerlang yoki qo\'lda kiriting'));
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(product.name, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (product.sku != null) Text('SKU: ${product.sku}'),
              if (product.barcode != null) Text('Shtrix-kod: ${product.barcode}'),
              if (product.unitName != null) Text("O'lchov birligi: ${product.unitName}"),
              const SizedBox(height: 8),
              Text('Sotish narxi: ${product.salePrice}'),
              Text('Tannarx: ${product.purchasePrice}'),
            ],
          ),
        ),
      ),
    );
  }
}
