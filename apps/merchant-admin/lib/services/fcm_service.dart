import 'dart:io' show Platform;
import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';

/// Registration-only FCM wiring (DESIGN-merchant-admin.md §7). No sender
/// exists anywhere in ERP's backend — this file deliberately does NOT
/// register `onMessage`/`onBackgroundMessage`/`onMessageOpenedApp` listeners,
/// because nothing will ever call them in v1. It does exactly three things:
/// init Firebase (try/catch, placeholder project), register the device token
/// on login, unregister it on logout.
class FcmService {
  static Dio get _dio => ApiClient.instance;

  /// `settings_screen.dart` (MA-6) reads/writes this same key for its push
  /// toggle.
  static const String pushPreferenceKey = 'push_notifications_enabled';

  static Future<bool> isPushPreferenceEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(pushPreferenceKey) ?? true;
  }

  static Future<void> setPushPreferenceEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(pushPreferenceKey, enabled);
  }

  /// Called once from `main.dart`, before `runApp()`. Wrapped in try/catch so
  /// a missing/placeholder Firebase project never stops the app from
  /// launching (graceful-degradation rule).
  static Future<void> init() async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
    } catch (e) {
      debugPrint('[FcmService] init error: $e');
    }
  }

  /// Called from `AuthState` after a successful login/restore, only if the
  /// push preference is on. `POST /push/register` (`mobile/router.py:1247`).
  static Future<void> registerForCurrentUser() async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[FcmService] push permission denied');
        return;
      }
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;
      await _dio.post('/push/register', data: {
        'token': token,
        'platform': 'android',
        'device_label': _currentDeviceLabel(),
      });
    } catch (e) {
      debugPrint('[FcmService] registerForCurrentUser error: $e');
    }
  }

  /// Called from `AuthState.logout()` BEFORE secure storage is cleared — the
  /// DELETE call needs a still-valid JWT (DESIGN-merchant-admin.md §7).
  /// `DELETE /push/{token}` (`mobile/router.py:1265`).
  static Future<void> unregisterCurrentDevice() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;
      await _dio.delete('/push/${Uri.encodeComponent(token)}');
    } catch (e) {
      debugPrint('[FcmService] unregisterCurrentDevice error: $e');
    }
  }

  static String _currentDeviceLabel() {
    final ts = DateTime.now().toIso8601String().substring(0, 16).replaceFirst('T', ' ');
    return '${Platform.operatingSystem} ($ts)';
  }
}
