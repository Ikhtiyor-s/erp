import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import '../services/permissions_service.dart';

/// Shows [child] only if the current user holds [code] in
/// `GET /rbac/me/permissions`'s `permissions` array — never a role-name
/// comparison (SPEC-merchant-admin.md §2/§6 MUST). Used by every screen
/// ticket for button/section-level gating; `app_shell.dart` uses the same
/// `PermissionsService.hasPermission` check directly for tab visibility.
class PermissionGate extends StatelessWidget {
  final String code;
  final Widget child;
  final Widget? fallback;

  const PermissionGate({
    super.key,
    required this.code,
    required this.child,
    this.fallback,
  });

  @override
  Widget build(BuildContext context) {
    final granted = context.watch<PermissionsService>().hasPermission(code);
    if (granted) return child;
    return fallback ?? const SizedBox.shrink();
  }
}
