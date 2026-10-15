import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config.dart';
import '../services/fcm_service.dart';
import '../services/permissions_service.dart';
import '../services/settings_service.dart';
import '../state/auth_state.dart';
import '../utils/dio_error.dart';

/// Push preference + registered-devices view, plus profile summary.
/// DESIGN-merchant-admin.md §7: registration-only, no sender exists — the
/// disclaimer text below is mandatory, not optional copy.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _pushEnabled = true;
  bool _pushBusy = false;
  List<PushDevice>? _devices;
  Object? _devicesError;
  bool _devicesLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPushPreference();
    _loadDevices();
  }

  Future<void> _loadPushPreference() async {
    final enabled = await FcmService.isPushPreferenceEnabled();
    if (!mounted) return;
    setState(() => _pushEnabled = enabled);
  }

  Future<void> _loadDevices() async {
    setState(() {
      _devicesLoading = true;
      _devicesError = null;
    });
    try {
      final devices = await SettingsService.fetchPushDevices();
      if (!mounted) return;
      setState(() {
        _devices = devices;
        _devicesLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _devicesError = e;
        _devicesLoading = false;
      });
    }
  }

  Future<void> _togglePush(bool value) async {
    setState(() {
      _pushEnabled = value;
      _pushBusy = true;
    });
    await FcmService.setPushPreferenceEnabled(value);
    if (value) {
      await FcmService.registerForCurrentUser();
    } else {
      await FcmService.unregisterCurrentDevice();
    }
    if (!mounted) return;
    setState(() => _pushBusy = false);
    _loadDevices();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final perms = context.watch<PermissionsService>();
    final user = auth.user;
    return Scaffold(
      appBar: AppBar(title: const Text('Sozlamalar')),
      body: ListView(
        children: [
          if (user != null)
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text(user.fullName),
              subtitle: Text([
                if (user.phone != null) user.phone!,
                if (perms.roleName != null) perms.roleName!,
              ].join(' · ')),
            ),
          const Divider(height: 1),
          SwitchListTile(
            title: const Text('Bildirishnomalar'),
            subtitle: const Text(
              "Bildirishnoma funksiyasi hali faol emas — backend tomonidan jo'natish "
              'xizmati ulanmagan',
            ),
            value: _pushEnabled,
            onChanged: _pushBusy ? null : _togglePush,
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              "Ro'yxatdan o'tgan qurilmalar",
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          _buildDevicesSection(),
          const Divider(height: 1),
          ListTile(
            title: const Text('Ilova versiyasi'),
            trailing: Text(AppConfig.appVersion),
          ),
        ],
      ),
    );
  }

  Widget _buildDevicesSection() {
    if (_devicesLoading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_devicesError != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(describeDioError(_devicesError!)),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: _loadDevices, child: const Text('Qayta urinish')),
          ],
        ),
      );
    }
    final devices = _devices ?? const [];
    if (devices.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Text("0 ta qurilma ro'yxatdan o'tgan"),
      );
    }
    return Column(
      children: [
        for (final d in devices)
          ListTile(
            leading: const Icon(Icons.phone_android_outlined),
            title: Text(d.deviceLabel ?? d.platform ?? "Noma'lum qurilma"),
            subtitle: d.lastUsedAt != null
                ? Text('Oxirgi faollik: ${d.lastUsedAt!.toLocal().toString().substring(0, 16)}')
                : null,
          ),
      ],
    );
  }
}
