import 'package:dio/dio.dart';

String describeDioError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    final detail = data is Map ? data['detail'] : null;
    if (detail is String && detail.isNotEmpty) return detail;
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return 'Server javob bermadi — internet aloqasini tekshiring';
    }
    if (error.response == null) return 'Tarmoq xatosi — internet aloqasini tekshiring';
    return 'Xatolik yuz berdi (${error.response?.statusCode})';
  }
  return 'Kutilmagan xatolik yuz berdi';
}
