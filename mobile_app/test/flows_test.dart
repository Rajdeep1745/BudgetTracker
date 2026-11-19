import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:pocket_plan/core/store.dart';
import 'package:pocket_plan/screens/transactions.dart';
import 'package:pocket_plan/screens/budget.dart';
import 'package:pocket_plan/widgets/common.dart';
import 'package:pocket_plan/main.dart';

import 'widget_test.dart' show makeStore, dashboard;

void main() {
  testWidgets(
    'refreshed budget updates clean fields and preserves an edited draft',
    (tester) async {
      final store = await makeStore();
      store.dashboard = dashboard();
      Widget page() => MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: BudgetPage(store: store)),
        ),
      );
      await tester.pumpWidget(page());
      await tester.pumpAndSettle();
      store.dashboard!['budget']['allowance'] = 14000;
      await tester.pumpWidget(page());
      await tester.pumpAndSettle();
      expect(find.text('14000'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).first, '15500');
      store.dashboard!['budget']['allowance'] = 18000;
      await tester.pumpWidget(page());
      await tester.pumpAndSettle();
      expect(find.text('15500'), findsOneWidget);
      expect(tester.takeException(), isNull);
      store.dispose();
    },
  );
  testWidgets(
    'leaving an edited plan keeps changes until explicitly discarded',
    (tester) async {
      final store = await makeStore();
      await store.load();
      await tester.pumpWidget(PocketPlanApp(store: store));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Plan').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '20000');
      await tester.tap(find.text('Insights').last);
      await tester.pumpAndSettle();
      expect(find.text('Leave this plan?'), findsOneWidget);
      await tester.tap(find.text('Keep editing'));
      await tester.pumpAndSettle();
      expect(find.text('20000'), findsOneWidget);
      await tester.tap(find.text('Insights').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Discard changes'));
      await tester.pumpAndSettle();
      expect(find.text('See the bigger picture.'), findsOneWidget);
      expect(tester.takeException(), isNull);
      store.dispose();
    },
  );
  for (final fails in [false, true]) {
    testWidgets(
      'expense edit ${fails ? 'retains inputs on conflict' : 'sends existing API payload'}',
      (tester) async {
        Json? payload;
        final s = await makeStore(
          MockClient((request) async {
            if (request.method == 'PUT') {
              payload = Json.from(jsonDecode(request.body));
              return fails
                  ? http.Response(
                      '{"error":"Edit the existing daily transaction."}',
                      409,
                    )
                  : http.Response('{}', 200);
            }
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
        );
        s.dashboard = dashboard();
        await tester.pumpWidget(
          MaterialApp(
            theme: appTheme(Brightness.light),
            home: Scaffold(
              body: Builder(
                builder: (context) => FilledButton(
                  onPressed: () => expenseSheet(
                    context,
                    s,
                    transaction: {
                      'id': 'expense',
                      'amount': 20,
                      'description': 'Lunch',
                      'category_id': 'one',
                      'transaction_date': '2026-11-01',
                    },
                  ),
                  child: const Text('Open expense'),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Open expense'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextFormField).first, '75.50');
        await tester.ensureVisible(find.text('Save expense'));
        await tester.tap(find.text('Save expense'));
        await tester.pumpAndSettle();
        expect(payload?['amount'], 75.5);
        expect(payload?['categoryId'], 'one');
        expect(payload?['transactionDate'], '2026-11-01');
        if (fails) {
          expect(
            find.text('Edit the existing daily transaction.'),
            findsOneWidget,
          );
          expect(find.text('75.50'), findsOneWidget);
        } else {
          expect(find.text('Expense updated.'), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
        s.dispose();
      },
    );
  }
  testWidgets('budget saves fixed costs and split with existing contract', (
    tester,
  ) async {
    Json? payload;
    final s = await makeStore(
      MockClient((request) async {
        if (request.method == 'PUT') {
          payload = Json.from(jsonDecode(request.body));
          return http.Response('{}', 200);
        }
        if (request.url.path.endsWith('dashboard')) {
          return http.Response(jsonEncode(dashboard()), 200);
        }
        if (request.url.path.endsWith('settings')) {
          return http.Response('{"fixedCosts":[],"carryInEnabled":true}', 200);
        }
        return http.Response('{"items":[],"total":0}', 200);
      }),
    );
    s.dashboard = dashboard();
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(Brightness.light),
        home: Scaffold(
          body: SingleChildScrollView(child: BudgetPage(store: s)),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, '15000');
    await tester.ensureVisible(find.text('Save monthly plan'));
    await tester.tap(find.text('Save monthly plan'));
    await tester.pumpAndSettle();
    expect(payload?['allowance'], 15000);
    expect(payload?['personalPercent'], 40);
    expect(payload?['carryInEnabled'], true);
    expect(payload?['alreadySaved'], 2000);
    expect(payload?['fixedCosts'], isEmpty);
    expect(find.text('Your monthly plan is saved.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    s.dispose();
  });
}
