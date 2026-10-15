import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';

typedef FakeResponder = ({int statusCode, Object? body}) Function(RequestOptions options);

/// In-memory [HttpClientAdapter] for widget/unit tests — maps a request path
/// prefix to a canned JSON response so screens/services can be exercised
/// against `ApiClient.instance` without any real network call.
class FakeHttpClientAdapter implements HttpClientAdapter {
  final Map<String, FakeResponder> _handlers = {};

  void on(String pathPrefix, FakeResponder responder) {
    _handlers[pathPrefix] = responder;
  }

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    for (final entry in _handlers.entries) {
      if (options.path.contains(entry.key)) {
        final result = entry.value(options);
        final text = jsonEncode(result.body);
        return ResponseBody.fromString(
          text,
          result.statusCode,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      }
    }
    return ResponseBody.fromString('{"detail":"not stubbed: ${options.path}"}', 404, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}
