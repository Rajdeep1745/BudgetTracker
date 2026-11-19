import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

typedef Json = Map<String, dynamic>;
double number(dynamic value) => double.tryParse('$value') ?? 0;
String dayKey(DateTime date) => DateFormat('yyyy-MM-dd').format(date);
String monthKey(DateTime date) => DateFormat('yyyy-MM').format(date);

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class ApiClient {
  final http.Client client;
  final String baseUrl;
  ApiClient({http.Client? client, required this.baseUrl})
    : client = client ?? http.Client();
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Json? body,
  }) async {
    try {
      final request = http.Request(method, Uri.parse('$baseUrl$path'));
      request.headers['Content-Type'] = 'application/json';
      if (body != null) request.body = jsonEncode(body);
      final response = await client
          .send(request)
          .then(http.Response.fromStream)
          .timeout(const Duration(seconds: 30));
      dynamic result;
      if (response.body.isNotEmpty) {
        try {
          result = jsonDecode(response.body);
        } catch (_) {
          /* Gateways may return HTML. */
        }
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          result is Map
              ? '${result['error'] ?? 'Request failed (${response.statusCode}).'}'
              : 'The server could not complete this request (${response.statusCode}).',
        );
      }
      return result;
    } on TimeoutException {
      throw ApiException('The connection timed out. Please try again.');
    } on http.ClientException {
      throw ApiException(
        'Unable to connect. Check your internet connection and try again.',
      );
    }
  }

  void close() => client.close();
}

class AppStore extends ChangeNotifier {
  final ApiClient api;
  final SharedPreferences preferences;
  DateTime month = DateTime(DateTime.now().year, DateTime.now().month);
  Json? dashboard;
  Json settings = {};
  List<Json> transactions = [];
  int total = 0, page = 1;
  String search = '',
      categoryId = '',
      from = '',
      to = '',
      sortBy = 'date',
      direction = 'desc';
  bool loading = false, transactionsLoading = false;
  String? error, transactionError;
  int _revision = 0, _transactionRevision = 0;
  String currency;
  double threshold;
  String appearance;
  AppStore(this.api, this.preferences)
    : currency = preferences.getString('currency') ?? 'INR',
      threshold = preferences.getDouble('threshold') ?? 80,
      appearance = preferences.getString('appearance') ?? 'system';
  String money(dynamic value) => NumberFormat.currency(
    locale: currency == 'INR' ? 'en_IN' : 'en_US',
    name: currency,
    symbol: {'INR': '₹', 'USD': '\$', 'EUR': '€', 'GBP': '£'}[currency],
    decimalDigits: 2,
  ).format(number(value));
  List<Json> get categories => List<Json>.from(dashboard?['categories'] ?? []);
  List<Json> get groups => List<Json>.from(dashboard?['groups'] ?? []);
  Json get budget => Json.from(dashboard?['budget'] ?? {});
  int get days => DateTime(month.year, month.month + 1, 0).day;
  int get elapsed {
    final now = DateTime.now();
    final current = DateTime(now.year, now.month);
    return month.isBefore(current)
        ? days
        : month.isAfter(current)
        ? 0
        : now.day;
  }

  Future<void> load() async {
    final revision = ++_revision;
    final selected = monthKey(month);
    loading = true;
    error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        api.request('/dashboard?month=$selected'),
        api.request('/settings?month=${monthKey(DateTime.now())}'),
      ]);
      if (revision != _revision) return;
      dashboard = Json.from(results[0]);
      settings = Json.from(results[1]);
    } catch (e) {
      if (revision == _revision) error = '$e';
    } finally {
      if (revision == _revision) {
        loading = false;
        notifyListeners();
      }
    }
    if (revision == _revision) await loadTransactions();
  }

  Future<void> selectMonth(DateTime value) async {
    month = DateTime(value.year, value.month);
    page = 1;
    from = '';
    to = '';
    dashboard = null;
    transactions = [];
    total = 0;
    ++_transactionRevision;
    await load();
  }

  Future<void> loadTransactions() async {
    final revision = ++_transactionRevision;
    transactionsLoading = true;
    transactionError = null;
    notifyListeners();
    try {
      final query = Uri(
        queryParameters: {
          'month': monthKey(month),
          'page': '$page',
          'pageSize': '20',
          'sortBy': sortBy,
          'sortDirection': direction,
          if (search.trim().isNotEmpty) 'search': search.trim(),
          if (categoryId.isNotEmpty) 'categoryId': categoryId,
          if (from.isNotEmpty) 'from': from,
          if (to.isNotEmpty) 'to': to,
        },
      ).query;
      final result = await api.request('/transactions?$query');
      if (revision != _transactionRevision) return;
      total = (result['total'] as num).toInt();
      if (page > 1 && (page - 1) * 20 >= total) {
        page = ((total - 1) / 20).floor().clamp(0, 1000000) + 1;
        await loadTransactions();
        return;
      }
      transactions = List<Json>.from(result['items']);
    } catch (e) {
      if (revision == _transactionRevision) transactionError = '$e';
    } finally {
      if (revision == _transactionRevision) {
        transactionsLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> mutate(String path, String method, [Json? body]) async {
    await api.request(path, method: method, body: body);
    await load();
  }

  Future<void> setPreference(String key, dynamic value) async {
    if (key == 'currency') {
      await preferences.setString(key, value);
      currency = value;
    }
    if (key == 'threshold') {
      await preferences.setDouble(key, value);
      threshold = value;
    }
    if (key == 'appearance') {
      await preferences.setString(key, value);
      appearance = value;
    }
    notifyListeners();
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }
}

/// Reports use cumulative spending through the selected day, matching the website.
class GroupReport {
  final double spent, onDay, remaining, dailyAllowed, projected;
  GroupReport({
    required this.spent,
    required this.onDay,
    required this.remaining,
    required this.dailyAllowed,
    required this.projected,
  });
  factory GroupReport.calculate({
    required List<Json> entries,
    required double budget,
    required int selectedDay,
    required int days,
    required int elapsed,
  }) {
    double spent = 0, onDay = 0, toDate = 0;
    for (final entry in entries) {
      final day = DateTime.parse(entry['date']).day;
      final amount = number(entry['amount']);
      if (day <= selectedDay) spent += amount;
      if (day == selectedDay) onDay += amount;
      if (day <= elapsed) toDate += amount;
    }
    final remaining = (budget - spent).clamp(0.0, double.infinity);
    return GroupReport(
      spent: spent,
      onDay: onDay,
      remaining: remaining,
      dailyAllowed: selectedDay < days ? remaining / (days - selectedDay) : 0,
      projected: elapsed > 0 ? toDate / elapsed * days : 0,
    );
  }
}
