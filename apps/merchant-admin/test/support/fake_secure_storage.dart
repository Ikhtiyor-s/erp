import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';

/// `flutter_secure_storage`'s Windows backend is FFI-based, not a
/// `MethodChannel` — `TestDefaultBinaryMessengerBinding`'s mock handler never
/// intercepts it under `flutter test` on this host, which otherwise hangs
/// every widget test touching `ApiClient` (its request interceptor reads a
/// token on every call). Overriding the platform-interface singleton is the
/// supported seam for this, independent of host OS.
class FakeSecureStoragePlatform extends FlutterSecureStoragePlatform {
  final Map<String, String> _store = {};

  @override
  Future<void> write({
    required String key,
    required String value,
    required Map<String, String> options,
  }) async {
    _store[key] = value;
  }

  @override
  Future<String?> read({required String key, required Map<String, String> options}) async {
    return _store[key];
  }

  @override
  Future<bool> containsKey({required String key, required Map<String, String> options}) async {
    return _store.containsKey(key);
  }

  @override
  Future<void> delete({required String key, required Map<String, String> options}) async {
    _store.remove(key);
  }

  @override
  Future<Map<String, String>> readAll({required Map<String, String> options}) async {
    return Map.of(_store);
  }

  @override
  Future<void> deleteAll({required Map<String, String> options}) async {
    _store.clear();
  }
}
