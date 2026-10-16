import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'config.dart';
import 'router.dart';
import 'services/api_client.dart';
import 'services/fcm_service.dart';
import 'services/permissions_service.dart';
import 'state/auth_state.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await FcmService.init();

  final auth = AuthState();
  ApiClient.onSessionExpired = () => auth.forceLogout();
  await auth.restoreFromStorage();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider.value(value: PermissionsService.instance),
      ],
      child: MerchantAdminApp(auth: auth),
    ),
  );
}

class MerchantAdminApp extends StatefulWidget {
  final AuthState auth;
  const MerchantAdminApp({super.key, required this.auth});

  @override
  State<MerchantAdminApp> createState() => _MerchantAdminAppState();
}

class _MerchantAdminAppState extends State<MerchantAdminApp> with WidgetsBindingObserver {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _router = buildRouter(widget.auth);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      widget.auth.refreshPermissions();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: _router,
    );
  }
}
