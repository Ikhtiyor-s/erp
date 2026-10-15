import 'dart:async' show unawaited;
import 'package:flutter/foundation.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/fcm_service.dart';
import '../services/org_service.dart';
import '../services/permissions_service.dart';
import '../services/storage.dart';

/// Auth + session bootstrap state, distributed via `Provider` to every
/// screen. Owns the login flow's two steps (DESIGN-merchant-admin.md §6.1):
/// 1) [login] authenticates and returns the user's organizations so the
///    caller (login_screen.dart) can resolve/prompt for the active one.
/// 2) [completeLogin] finishes the bootstrap once an organization id is
///    known — fetches the user profile, permissions, and registers push.
///
/// No socket.io lifecycle to own here (DESIGN-merchant-admin.md §1.2 — ERP
/// has no realtime layer at all).
class AuthState extends ChangeNotifier {
  AppUser? _user;
  bool _loading = true;

  AppUser? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get loading => _loading;

  Future<void> restoreFromStorage() async {
    _loading = true;
    notifyListeners();
    try {
      final token = await AppStorage.getAccessToken();
      final savedOrgId = await OrgService.getActiveOrganizationId();
      if (token == null || token.isEmpty || savedOrgId == null || savedOrgId.isEmpty) {
        _user = null;
      } else {
        ApiClient.activeOrganizationId = savedOrgId;
        _user = await AuthService.fetchCurrentUser();
        await PermissionsService.instance.refresh();
        if (await FcmService.isPushPreferenceEnabled()) {
          unawaited(FcmService.registerForCurrentUser());
        }
      }
    } catch (_) {
      _user = null;
      await _clearLocalSession();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Step 1 — authenticates and saves tokens. Does NOT set [user] yet; the
  /// caller must resolve an organization id and call [completeLogin].
  Future<List<Organization>> login({
    required String phone,
    required String password,
    String? twofaCode,
  }) async {
    await AuthService.login(phone: phone, password: password, twofaCode: twofaCode);
    return OrgService.fetchMine();
  }

  /// Step 2 — call once the active organization id is known (auto-resolved
  /// by the caller, or picked by the user from a one-time org picker).
  Future<void> completeLogin(String organizationId) async {
    await OrgService.setActiveOrganizationId(organizationId);
    ApiClient.activeOrganizationId = organizationId;
    _user = await AuthService.fetchCurrentUser();
    await PermissionsService.instance.refresh();
    if (await FcmService.isPushPreferenceEnabled()) {
      unawaited(FcmService.registerForCurrentUser());
    }
    notifyListeners();
  }

  /// Re-fetches permissions only — cheap, called on every app resume from
  /// background (DESIGN-merchant-admin.md §6.1 point 4).
  Future<void> refreshPermissions() {
    if (!isAuthenticated) return Future.value();
    return PermissionsService.instance.refresh();
  }

  Future<void> logout() async {
    await FcmService.unregisterCurrentDevice();
    await AuthService.logout();
    await _clearLocalSession();
    _user = null;
    notifyListeners();
  }

  /// Called by `ApiClient.onSessionExpired` when a token refresh fails
  /// (expired/revoked refresh token) — local-only cleanup, no server call
  /// since the JWT is no longer valid.
  Future<void> forceLogout() async {
    await AppStorage.clear();
    await _clearLocalSession();
    _user = null;
    notifyListeners();
  }

  Future<void> _clearLocalSession() async {
    await OrgService.clearActiveOrganization();
    PermissionsService.instance.clear();
    ApiClient.reset();
  }
}
