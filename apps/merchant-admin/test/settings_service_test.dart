import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_admin/services/settings_service.dart';

void main() {
  group('PushDevice.fromJson', () {
    test('parses a registered device row', () {
      final device = PushDevice.fromJson({
        'id': 1,
        'platform': 'android',
        'device_label': 'android (2026-10-14 12:00)',
        'last_used_at': '2026-10-14T12:00:00Z',
        'created_at': '2026-10-10T08:00:00Z',
      });
      expect(device.id, 1);
      expect(device.platform, 'android');
      expect(device.lastUsedAt, isNotNull);
    });

    test('never carries the raw push token field (not returned by the backend)', () {
      final device = PushDevice.fromJson({'id': 1, 'platform': 'android'});
      expect(device.deviceLabel, isNull);
    });
  });
}
