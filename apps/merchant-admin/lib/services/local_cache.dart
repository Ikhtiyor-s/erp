import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Read-only TTL cache for offline posture (DESIGN-merchant-admin.md §9 —
/// no offline mutation queue, read-cache only). Written only here, read by
/// MA-4/MA-6's data screens.
class LocalCache {
  static const _kPrefix = 'cache_';
  static const _defaultTtl = Duration(hours: 6);

  static Future<void> set(String key, Object value) async {
    final prefs = await SharedPreferences.getInstance();
    final wrap = {'ts': DateTime.now().toIso8601String(), 'v': value};
    await prefs.setString('$_kPrefix$key', jsonEncode(wrap));
  }

  static Future<CacheEntry<T>?> get<T>(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_kPrefix$key');
    if (raw == null) return null;
    try {
      final wrap = jsonDecode(raw) as Map<String, dynamic>;
      final ts = DateTime.parse(wrap['ts'] as String);
      final age = DateTime.now().difference(ts);
      return CacheEntry<T>(
        value: wrap['v'] as T,
        cachedAt: ts,
        stale: age > _defaultTtl,
      );
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys().where((k) => k.startsWith(_kPrefix)).toList();
    for (final k in keys) {
      await prefs.remove(k);
    }
  }
}

class CacheEntry<T> {
  final T value;
  final DateTime cachedAt;
  final bool stale;
  const CacheEntry({required this.value, required this.cachedAt, required this.stale});
}
