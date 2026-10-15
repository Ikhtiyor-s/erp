import 'package:dio/dio.dart';
import 'api_client.dart';

/// `GET /push/devices` row (`mobile/router.py:1279`, added by MA-2). The
/// endpoint deliberately does not return the raw token (`push_tokens.token`
/// is never selected) — so only the current device (whose token this app
/// already holds via `FcmService`) can be unregistered from this screen;
/// other listed devices are shown read-only (DESIGN-merchant-admin.md §7's
/// "remove a lost device" aspiration is not achievable against the real
/// contract without a backend change — flagged, not silently worked around).
class PushDevice {
  final int id;
  final String? platform;
  final String? deviceLabel;
  final DateTime? lastUsedAt;

  const PushDevice({required this.id, this.platform, this.deviceLabel, this.lastUsedAt});

  factory PushDevice.fromJson(Map<String, dynamic> j) => PushDevice(
        id: int.tryParse(j['id']?.toString() ?? '') ?? 0,
        platform: j['platform']?.toString(),
        deviceLabel: j['device_label']?.toString(),
        lastUsedAt: DateTime.tryParse(j['last_used_at']?.toString() ?? ''),
      );
}

class SettingsService {
  static Dio get _dio => ApiClient.instance;

  static Future<List<PushDevice>> fetchPushDevices() async {
    final res = await _dio.get<List<dynamic>>('/push/devices');
    final list = res.data ?? [];
    return list.map((e) => PushDevice.fromJson(e as Map<String, dynamic>)).toList();
  }
}
