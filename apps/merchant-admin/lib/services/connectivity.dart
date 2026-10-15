import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

class ConnectivityMonitor extends ChangeNotifier {
  static final ConnectivityMonitor _instance = ConnectivityMonitor._();
  factory ConnectivityMonitor() => _instance;
  ConnectivityMonitor._() {
    _init();
  }

  bool _online = true;
  bool get online => _online;

  // ignore: unused_field
  StreamSubscription<List<ConnectivityResult>>? _sub;

  Future<void> _init() async {
    try {
      final initial = await Connectivity().checkConnectivity();
      _online = _isOnline(initial);
      notifyListeners();
      _sub = Connectivity().onConnectivityChanged.listen((results) {
        final wasOnline = _online;
        _online = _isOnline(results);
        if (wasOnline != _online) notifyListeners();
      });
    } catch (e) {
      debugPrint('[Connectivity] init error: $e');
    }
  }

  bool _isOnline(List<ConnectivityResult> results) {
    return results.any((r) =>
        r == ConnectivityResult.wifi ||
        r == ConnectivityResult.mobile ||
        r == ConnectivityResult.ethernet ||
        r == ConnectivityResult.vpn);
  }
}
