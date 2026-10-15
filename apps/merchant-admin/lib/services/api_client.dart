import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config.dart';
import 'storage.dart';

/// Dio HTTP client — every authenticated request gets `Authorization: Bearer`
/// + `X-Organization-Id` (DESIGN-merchant-admin.md §6.2). `/auth/login` and
/// `/auth/refresh` are the only calls exempt from the 401-refresh-retry loop.
class ApiClient {
  static Dio? _instance;

  /// Set by `AuthState` once an organization is selected (post-login or
  /// restored from `shared_preferences`). Cleared on logout.
  static String? activeOrganizationId;

  /// Set once in `main.dart` so a failed token refresh can force a clean
  /// logout + redirect to `/login` without this file depending on `AuthState`.
  static void Function()? onSessionExpired;

  static void reset() {
    activeOrganizationId = null;
    _instance?.close(force: true);
    _instance = null;
  }

  static Dio get instance {
    if (_instance != null) return _instance!;

    final dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await AppStorage.getAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        final orgId = activeOrganizationId;
        if (orgId != null && orgId.isNotEmpty) {
          options.headers['X-Organization-Id'] = orgId;
        }
        return handler.next(options);
      },
      onError: (err, handler) async {
        if (err.response?.statusCode == 401 && !_isAuthCall(err.requestOptions)) {
          final refreshed = await _tryRefresh(dio);
          if (refreshed) {
            final token = await AppStorage.getAccessToken();
            final retryOptions = err.requestOptions;
            retryOptions.headers['Authorization'] = 'Bearer $token';
            try {
              final response = await dio.fetch(retryOptions);
              return handler.resolve(response);
            } catch (_) {}
          } else {
            onSessionExpired?.call();
          }
        }
        return handler.next(err);
      },
    ));

    _instance = dio;
    return dio;
  }

  static bool _isAuthCall(RequestOptions options) {
    return options.path.contains('/auth/login') || options.path.contains('/auth/refresh');
  }

  static Future<bool> _tryRefresh(Dio dio) async {
    try {
      final refreshToken = await AppStorage.getRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) return false;
      final res = await dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refresh_token': refreshToken},
        options: Options(headers: {'Authorization': null}),
      );
      final data = res.data;
      final newAccess = data?['access_token'] as String?;
      final newRefresh = data?['refresh_token'] as String? ?? refreshToken;
      if (newAccess == null || newAccess.isEmpty) return false;
      await AppStorage.saveTokens(newAccess, newRefresh);
      return true;
    } catch (e) {
      debugPrint('[ApiClient] refresh failed: $e');
      return false;
    }
  }
}
