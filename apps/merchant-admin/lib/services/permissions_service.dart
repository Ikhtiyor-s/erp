import 'package:flutter/foundation.dart';
import 'api_client.dart';

/// `GET /rbac/me/permissions` response, cached for the session.
class PermissionsSnapshot {
  final String? roleCode;
  final String? roleName;
  final Set<String> permissions;
  final bool isSuperadmin;

  const PermissionsSnapshot({
    this.roleCode,
    this.roleName,
    this.permissions = const {},
    this.isSuperadmin = false,
  });

  bool get hasAnyPermission => isSuperadmin || permissions.isNotEmpty;
}

/// Wraps `GET /rbac/me/permissions` (`rbac/router.py:27`) — the single source
/// of truth for what the current user can see/do in this app. Every nav/button
/// gate in this app MUST call [hasPermission], never compare a role name/code
/// directly (DESIGN-merchant-admin.md §6.1, SPEC §2/§6 MUST).
///
/// Registered as a top-level `ChangeNotifierProvider` in `main.dart` (sibling
/// to `AuthState`, not owned by it) so `PermissionGate`/`AppShell` can
/// `context.watch` it independently.
class PermissionsService extends ChangeNotifier {
  PermissionsService._();
  static final PermissionsService instance = PermissionsService._();

  PermissionsSnapshot _snapshot = const PermissionsSnapshot();
  bool _loading = false;

  PermissionsSnapshot get snapshot => _snapshot;
  bool get loading => _loading;
  String? get roleCode => _snapshot.roleCode;
  String? get roleName => _snapshot.roleName;

  bool hasPermission(String code) =>
      _snapshot.isSuperadmin || _snapshot.permissions.contains(code);

  /// Called after login/restore, and again on every app resume from
  /// background (DESIGN-merchant-admin.md §6.1 point 4) — cheap, and defends
  /// against a role change made from the web admin mid-session. Requires
  /// `X-Organization-Id` to already be set on `ApiClient`.
  Future<void> refresh() async {
    _loading = true;
    notifyListeners();
    try {
      final res = await ApiClient.instance.get<Map<String, dynamic>>('/rbac/me/permissions');
      final data = res.data ?? {};
      final role = data['role'] as Map<String, dynamic>?;
      final perms = (data['permissions'] as List<dynamic>?) ?? const [];
      _snapshot = PermissionsSnapshot(
        roleCode: role?['code']?.toString(),
        roleName: role?['name']?.toString(),
        permissions: perms.map((e) => e.toString()).toSet(),
        isSuperadmin: data['is_superadmin'] == true,
      );
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void clear() {
    _snapshot = const PermissionsSnapshot();
    notifyListeners();
  }
}
