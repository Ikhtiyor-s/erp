import 'package:dio/dio.dart';
import 'api_client.dart';
import 'storage.dart';

/// Thrown by [AuthService.login] when the backend rejects the first attempt
/// with `401 {"detail": "2FA code required"}` (`auth/router.py:273`). The
/// login screen reacts by showing a second field and resubmitting with
/// `twofa_code` — this app supports 2FA-enabled accounts, not just the
/// simple case.
class TwoFaRequiredException implements Exception {}

/// `GET /auth/me` response (`UserOut`). Deliberately carries no role/permission
/// data — ERP's `/auth/me` never returns that (SPEC-merchant-admin.md §2);
/// `permissions_service.dart` is the only source of truth for RBAC.
class AppUser {
  final String id;
  final String? phone;
  final String? email;
  final String fullName;
  final String locale;

  const AppUser({
    required this.id,
    this.phone,
    this.email,
    required this.fullName,
    required this.locale,
  });

  factory AppUser.fromJson(Map<String, dynamic> j) {
    final rawName = j['full_name']?.toString().trim();
    return AppUser(
      id: j['id']?.toString() ?? '',
      phone: j['phone']?.toString(),
      email: j['email']?.toString(),
      fullName: (rawName != null && rawName.isNotEmpty)
          ? rawName
          : (j['phone']?.toString() ?? j['email']?.toString() ?? 'Foydalanuvchi'),
      locale: j['locale']?.toString() ?? 'ru',
    );
  }
}

class AuthService {
  static Dio get _dio => ApiClient.instance;

  static Future<void> login({
    required String phone,
    required String password,
    String? twofaCode,
  }) async {
    final body = <String, dynamic>{'phone': phone, 'password': password};
    if (twofaCode != null && twofaCode.isNotEmpty) {
      body['twofa_code'] = twofaCode;
    }
    try {
      final res = await _dio.post<Map<String, dynamic>>('/auth/login', data: body);
      final data = res.data!;
      final access = data['access_token'] as String;
      final refresh = data['refresh_token'] as String;
      await AppStorage.saveTokens(access, refresh);
    } on DioException catch (e) {
      final detail = e.response?.data is Map ? (e.response?.data as Map)['detail'] : null;
      if (e.response?.statusCode == 401 && detail == '2FA code required') {
        throw TwoFaRequiredException();
      }
      rethrow;
    }
  }

  static Future<AppUser> fetchCurrentUser() async {
    final res = await _dio.get<Map<String, dynamic>>('/auth/me');
    return AppUser.fromJson(res.data!);
  }

  static Future<void> logout() async {
    await AppStorage.clear();
  }
}
