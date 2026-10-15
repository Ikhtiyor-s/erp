class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8001/api/v1',
  );

  static const String appName = 'Aniq ERP Admin';
  static const String appVersion = '1.0.0';
}
