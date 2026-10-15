import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';

/// `GET /organizations/mine` response row (DESIGN-merchant-admin.md §6.1 step 2).
class Organization {
  final String id;
  final String name;
  final String code;
  final bool isDefault;

  const Organization({
    required this.id,
    required this.name,
    required this.code,
    required this.isDefault,
  });

  factory Organization.fromJson(Map<String, dynamic> j) => Organization(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        code: j['code']?.toString() ?? '',
        isDefault: j['is_default'] == true,
      );
}

/// `GET /organizations/mine` + local active-org selection/persistence.
/// Org ids are not secrets — persisted in `shared_preferences`, not secure
/// storage (DESIGN-merchant-admin.md §2, stack table).
class OrgService {
  static const _kActiveOrgId = 'active_organization_id';

  static Dio get _dio => ApiClient.instance;

  /// No `X-Organization-Id` header is required for this specific call
  /// (`organization/router.py:13` only depends on `get_current_user_id`) —
  /// it is deliberately the bootstrap call used before an org is chosen.
  static Future<List<Organization>> fetchMine() async {
    final res = await _dio.get<List<dynamic>>('/organizations/mine');
    final list = res.data ?? [];
    return list
        .map((e) => Organization.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<String?> getActiveOrganizationId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kActiveOrgId);
  }

  static Future<void> setActiveOrganizationId(String id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kActiveOrgId, id);
  }

  static Future<void> clearActiveOrganization() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kActiveOrgId);
  }
}
