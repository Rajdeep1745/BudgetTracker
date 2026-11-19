import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pocket_plan/core/store.dart';
import 'package:pocket_plan/core/config.dart';
import 'package:pocket_plan/main.dart';
import 'package:pocket_plan/screens/transactions.dart';

Json dashboard() => {
  'totals': {'budget': 10000, 'spent': 500, 'remaining': 9500},
  'budget': {
    'allowance': 12000,
    'carryIn': 0,
    'carryInEnabled': true,
    'alreadySaved': 2000,
    'savingsTarget': 1000,
    'personalPercent': 40,
    'fixedCosts': [],
  },
  'groups': [
    {
      'name': 'Personal',
      'budget': 4000,
      'spent': 500,
      'remaining': 3500,
      'percent': 40,
    },
    {
      'name': 'Household',
      'budget': 6000,
      'spent': 0,
      'remaining': 6000,
      'percent': 60,
    },
  ],
  'categories': [
    {'id': 'one', 'name': 'Food', 'group_name': 'Personal', 'spent': 500},
  ],
  'groupDaily': [],
};
Future<AppStore> makeStore([http.Client? client]) async {
  final handler = FlutterError.onError;
  FlutterError.onError = (details) {
    debugPrint(details.toString());
    handler?.call(details);
  };
  SharedPreferences.setMockInitialValues({});
  return AppStore(
    ApiClient(
      baseUrl: 'https://example.test/api',
      client:
          client ??
          MockClient((request) async {
            if (request.url.path.endsWith('dashboard')) {
              return http.Response(jsonEncode(dashboard()), 200);
            }
            if (request.url.path.endsWith('settings')) {
              return http.Response(
                '{"fixedCosts":[],"carryInEnabled":true}',
                200,
              );
            }
            return http.Response('{"items":[],"total":0}', 200);
          }),
    ),
    await SharedPreferences.getInstance(),
  );
}

void main() {
  setUp(() {
    final original = FlutterError.onError;
    FlutterError.onError = (details) {
      FlutterError.dumpErrorToConsole(details);
      original?.call(details);
    };
  });
  test('report selected day and projection exclude future expenses', () {
    final r = GroupReport.calculate(
      entries: [
        {'date': '2026-11-01', 'amount': 100},
        {'date': '2026-11-03', 'amount': 200},
        {'date': '2026-11-25', 'amount': 900},
      ],
      budget: 1000,
      selectedDay: 3,
      days: 30,
      elapsed: 10,
    );
    expect(r.spent, 300);
    expect(r.onDay, 200);
    expect(r.remaining, 700);
    expect(r.dailyAllowed, closeTo(700 / 27, .001));
    expect(r.projected, 900);
  });
  test('month end and overspending give zero daily allowance', () {
    final r = GroupReport.calculate(
      entries: [
        {'date': '2026-11-30', 'amount': 200},
      ],
      budget: 100,
      selectedDay: 30,
      days: 30,
      elapsed: 30,
    );
    expect(r.remaining, 0);
    expect(r.dailyAllowed, 0);
  });
  test('API handles no-content deletes', () async {
    final api = ApiClient(
      baseUrl: 'https://example.test/api',
      client: MockClient((r) async {
        expect(r.method, 'DELETE');
        expect(r.url.path, '/api/transactions/one');
        return http.Response('', 204);
      }),
    );
    expect(await api.request('/transactions/one', method: 'DELETE'), null);
    api.close();
  });
  test('API preserves backend conflict errors', () async {
    final api = ApiClient(
      baseUrl: 'https://example.test/api',
      client: MockClient(
        (_) async => http.Response(
          '{"error":"Edit the existing daily transaction."}',
          409,
        ),
      ),
    );
    await expectLater(
      api.request('/transactions'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('existing daily'),
        ),
      ),
    );
    api.close();
  });
  test('build configuration validates URLs and preferences persist', () async {
    final s = await makeStore();
    for (final invalid in [
      '',
      'not a url',
      'ftp://host/api',
      'https://host/api?key=x',
      'https://user:password@host/api',
    ]) {
      expect(() => AppConfig.normalizeApiUrl(invalid), throwsFormatException);
    }
    expect(
      AppConfig.normalizeApiUrl(' https://budget.example/api/ '),
      'https://budget.example/api',
    );
    expect(
      AppConfig.normalizeApiUrl('http://10.0.2.2:5000/api'),
      'http://10.0.2.2:5000/api',
    );
    await s.setPreference('currency', 'USD');
    await s.setPreference('threshold', 90.0);
    expect(s.preferences.getString('currency'), 'USD');
    expect(s.threshold, 90);
    s.dispose();
  });
  test('filters and pagination reach existing API', () async {
    late Uri uri;
    final s = await makeStore(
      MockClient((r) async {
        uri = r.url;
        return http.Response('{"items":[],"total":25}', 200);
      }),
    );
    s.search = 'groceries';
    s.categoryId = 'one';
    s.page = 2;
    s.sortBy = 'amount';
    s.direction = 'asc';
    await s.loadTransactions();
    expect(uri.queryParameters['page'], '2');
    expect(uri.queryParameters['search'], 'groceries');
    expect(uri.queryParameters['categoryId'], 'one');
    expect(uri.queryParameters['sortBy'], 'amount');
    expect(s.total, 25);
    s.dispose();
  });
  testWidgets('mobile tabs navigate to plan insights and settings', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final s = await makeStore();
    await s.load();
    await tester.pumpWidget(PocketPlanApp(store: s));
    await tester.pumpAndSettle();
    expect(find.text('Pocket Plan'), findsOneWidget);
    expect(find.text('Add expense'), findsOneWidget);
    await tester.tap(find.text('Plan').last);
    await tester.pumpAndSettle();
    expect(find.text('Give every rupee a purpose.'), findsOneWidget);
    await tester.tap(find.text('Insights').last);
    await tester.pumpAndSettle();
    expect(find.text('See the bigger picture.'), findsOneWidget);
    await tester.tap(find.text('Settings').last);
    await tester.pumpAndSettle();
    expect(find.text('Make it yours'), findsOneWidget);
    final layoutError = tester.takeException();
    if (layoutError is FlutterError) {
      debugPrint(layoutError.toStringDeep());
    }
    expect(layoutError, isNull);
    s.dispose();
  });
  testWidgets('expense validates amount and category', (tester) async {
    final s = await makeStore();
    s.dashboard = dashboard();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ExpenseEditor(store: s)),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Save expense'));
    await tester.tap(find.text('Save expense'));
    await tester.pumpAndSettle();
    expect(find.text('Enter an amount greater than zero.'), findsOneWidget);
    expect(find.text('Choose a category.'), findsOneWidget);
    s.dispose();
  });
  testWidgets('connection error retries without exposing API URL controls', (
    tester,
  ) async {
    final s = await makeStore();
    s.error = 'Unable to connect.';
    await tester.pumpWidget(PocketPlanApp(store: s));
    await tester.pumpAndSettle();
    expect(find.text('Let’s reconnect'), findsOneWidget);
    expect(find.text('Connection settings'), findsNothing);
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('Add expense'), findsOneWidget);
    await tester.tap(find.text('Settings').last);
    await tester.pumpAndSettle();
    expect(find.text('Budget server'), findsNothing);
    expect(find.text('API address'), findsNothing);
    expect(find.byType(TextField), findsNothing);
    s.dispose();
  });
  for (final size in [
    const Size(375, 812),
    const Size(844, 390),
    const Size(800, 1024),
  ]) {
    testWidgets('layout at $size with large text and reduced motion', (
      tester,
    ) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final s = await makeStore();
      await s.load();
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData.dark(),
          home: MediaQuery(
            data: MediaQueryData(
              size: size,
              textScaler: TextScaler.linear(2),
              disableAnimations: true,
            ),
            child: AppShell(store: s),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final layoutError = tester.takeException();
      if (layoutError is FlutterError) {
        debugPrint(layoutError.toStringDeep());
      }
      expect(layoutError, isNull);
      for (final label in ['Plan', 'Insights', 'Settings']) {
        await tester.tap(find.text(label).last);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: '$label at $size');
      }
      s.dispose();
    });
  }
}
