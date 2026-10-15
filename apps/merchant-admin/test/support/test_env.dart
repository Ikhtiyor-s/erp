import 'package:flutter/services.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/services/api_client.dart';
import 'fake_http_adapter.dart';
import 'fake_secure_storage.dart';

/// Shared setup for widget/service tests that exercise `ApiClient` — points
/// its Dio instance at a [FakeHttpClientAdapter] (no real network call),
/// overrides the `flutter_secure_storage` platform singleton (its real
/// Windows/Linux backends are FFI-based, not `MethodChannel`-mockable, and
/// otherwise hang every test whose widget tree touches `ApiClient`'s
/// per-request token read), and stubs `shared_preferences`'s channel
/// (`MissingPluginException` under `flutter test` otherwise).
FakeHttpClientAdapter setUpFakeApi({String organizationId = 'org-1'}) {
  TestWidgetsFlutterBinding.ensureInitialized();
  FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform();
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
    const MethodChannel('plugins.flutter.io/shared_preferences'),
    (call) async => call.method == 'getAll' ? <String, Object>{} : true,
  );
  final fake = FakeHttpClientAdapter();
  ApiClient.instance.httpClientAdapter = fake;
  ApiClient.activeOrganizationId = organizationId;
  return fake;
}
