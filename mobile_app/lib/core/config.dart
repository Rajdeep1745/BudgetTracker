/// Build-time configuration supplied using --dart-define-from-file=.env.
/// Never reads device preferences or accepts an address from the app UI.
abstract final class AppConfig {
  static String get apiBaseUrl =>
      normalizeApiUrl(const String.fromEnvironment('API_BASE_URL'));

  static String normalizeApiUrl(String value) {
    final normalized = value.trim().replaceFirst(RegExp(r'/+$'), '');
    final uri = Uri.tryParse(normalized);
    if (uri == null ||
        !['http', 'https'].contains(uri.scheme) ||
        uri.host.isEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        uri.userInfo.isNotEmpty) {
      throw const FormatException(
        'Set API_BASE_URL to a valid HTTP or HTTPS API URL in the build environment.',
      );
    }
    return normalized;
  }
}
