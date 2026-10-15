import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AppStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _kAccessToken = 'access_token';
  static const _kRefreshToken = 'refresh_token';

  static Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: _kAccessToken, value: access);
    await _storage.write(key: _kRefreshToken, value: refresh);
  }

  static Future<String?> getAccessToken() => _storage.read(key: _kAccessToken);
  static Future<String?> getRefreshToken() => _storage.read(key: _kRefreshToken);

  static Future<void> clear() async {
    await _storage.deleteAll();
  }
}
