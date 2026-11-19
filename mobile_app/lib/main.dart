import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/store.dart';
import 'core/config.dart';
import 'widgets/common.dart';
import 'screens/budget.dart';
import 'screens/reports.dart';
import 'screens/settings.dart';
import 'screens/transactions.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  String apiUrl;
  try {
    apiUrl = AppConfig.apiBaseUrl;
  } on FormatException {
    runApp(
      MaterialApp(
        title: 'Pocket Plan',
        debugShowCheckedModeBanner: false,
        theme: appTheme(Brightness.light),
        home: const Scaffold(
          body: SafeArea(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: EmptyView(
                  title: 'Service unavailable',
                  message: 'This version of Pocket Plan could not connect to its service. Please contact the app provider.',
                  icon: Icons.cloud_off_outlined,
                ),
              ),
            ),
          ),
        ),
      ),
    );
    return;
  }
  final store = AppStore(ApiClient(baseUrl: apiUrl), preferences);
  runApp(PocketPlanApp(store: store));
  store.load();
}

class PocketPlanApp extends StatelessWidget {
  final AppStore store;
  const PocketPlanApp({super.key, required this.store});
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: store,
    builder: (context, _) => MaterialApp(
      title: 'Pocket Plan',
      debugShowCheckedModeBanner: false,
      theme: appTheme(Brightness.light),
      darkTheme: appTheme(Brightness.dark),
      themeMode: store.appearance == 'system'
          ? ThemeMode.system
          : store.appearance == 'dark'
          ? ThemeMode.dark
          : ThemeMode.light,
      home: AppShell(store: store),
    ),
  );
}

class AppShell extends StatefulWidget {
  final AppStore store;
  const AppShell({super.key, required this.store});
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int tab = 0;
  String dismissed = '';
  final budgetKey = GlobalKey<BudgetPageState>();

  Future<bool> canLeavePlan() async {
    final state = budgetKey.currentState;
    if (state?.busy ?? false) return false;
    if (!(state?.dirty ?? false)) return true;
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Leave this plan?'),
            content: const Text('Your budget has unsaved changes.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Keep editing'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Discard changes'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> pickMonth() async {
    if (!await canLeavePlan() || !mounted) return;
    var year = widget.store.month.year;
    final selected = await showDialog<DateTime>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                tooltip: 'Previous year',
                onPressed: year > 2000 ? () => setState(() => year--) : null,
                icon: const Icon(Icons.chevron_left),
              ),
              Text('$year'),
              IconButton(
                tooltip: 'Next year',
                onPressed: year < 2100 ? () => setState(() => year++) : null,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          content: SizedBox(
            width: 320,
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List.generate(
                12,
                (i) => SizedBox(
                  width: 88,
                  child: TextButton(
                    onPressed: () =>
                        Navigator.pop(context, DateTime(year, i + 1)),
                    child: Text(
                      DateFormat('MMM').format(DateTime(year, i + 1)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    if (selected != null) widget.store.selectMonth(selected);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.store;
    final labels = ['Overview', 'Plan', 'Insights', 'Settings'];
    Widget content;
    if (tab == 3) {
      content = SettingsPage(store: s);
    } else if (s.loading && s.dashboard == null) {
      content = const Padding(
        padding: EdgeInsets.only(top: 120),
        child: Center(
          child: Column(
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 20),
              Text('Getting your pockets ready…'),
            ],
          ),
        ),
      );
    } else if (s.error != null && s.dashboard == null) {
      content = EmptyView(
        title: 'Let’s reconnect',
        message: s.error!,
        icon: Icons.cloud_off_outlined,
        action: FilledButton(onPressed: s.load, child: const Text('Try again')),
      );
    } else if (tab == 1) {
      content = BudgetPage(key: budgetKey, store: s);
    } else if (tab == 2) {
      content = ReportsPage(key: ValueKey(monthKey(s.month)), store: s);
    } else {
      content = overview(context, s);
    }
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 80,
        title: Row(
          children: [
            SvgPicture.asset(
              'assets/logo.svg',
              width: 40,
              height: 40,
              semanticsLabel: 'Pocket Plan logo',
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Pocket Plan',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -.6,
                ),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'About Pocket Plan',
            onPressed: () => showAboutDialog(
              context: context,
              applicationName: 'Pocket Plan',
              applicationVersion: '1.0.0',
              applicationIcon: SvgPicture.asset(
                'assets/logo.svg',
                width: 48,
                height: 48,
              ),
              children: [
                const Text(
                  'A little plan. More possibility. Track your monthly budget across Personal and Household pockets. Tap an expense to edit or delete it. Expenses in the same category on the same day are combined.',
                ),
              ],
            ),
            icon: const Icon(Icons.info_outline),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: s.load,
          child: ListView(
            key: PageStorageKey('tab-$tab-${monthKey(s.month)}'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(
              MediaQuery.sizeOf(context).width > 700
                  ? (MediaQuery.sizeOf(context).width - 640) / 2
                  : 24,
              8,
              MediaQuery.sizeOf(context).width > 700
                  ? (MediaQuery.sizeOf(context).width - 640) / 2
                  : 24,
              110,
            ),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      labels[tab],
                      style: Theme.of(context).textTheme.headlineLarge,
                    ),
                  ),
                  if (tab != 3)
                    TextButton.icon(
                      onPressed: s.loading ? null : pickMonth,
                      icon: const Icon(Icons.calendar_month_outlined, size: 18),
                      label: Text(DateFormat('MMM yyyy').format(s.month)),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              if (s.loading && s.dashboard != null)
                const LinearProgressIndicator(),
              if (s.error != null && s.dashboard != null && tab != 3)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: MaterialBanner(
                    content: Text('Could not refresh: ${s.error}'),
                    actions: [
                      TextButton(onPressed: s.load, child: const Text('Retry')),
                    ],
                  ),
                ),
              content,
            ],
          ),
        ),
      ),
      floatingActionButton: tab == 0 && s.dashboard != null
          ? FloatingActionButton.extended(
              onPressed: () => expenseSheet(context, s),
              icon: const Icon(Icons.add),
              label: const Text('Add expense'),
              backgroundColor: Theme.of(context).colorScheme.primary,
              foregroundColor: Theme.of(context).colorScheme.onPrimary,
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (v) async {
          if (v == tab || !await canLeavePlan() || !mounted) return;
          HapticFeedback.selectionClick();
          setState(() => tab = v);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Plan',
          ),
          NavigationDestination(
            icon: Icon(Icons.insights_outlined),
            selectedIcon: Icon(Icons.insights),
            label: 'Insights',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }

  Widget overview(BuildContext context, AppStore s) {
    final totals = Json.from(s.dashboard?['totals'] ?? {});
    final budget = number(totals['budget']), spent = number(totals['spent']);
    final remaining = number(totals['remaining']);
    final remainingDays = s.days - s.elapsed;
    final alert = s.groups.any(
      (g) =>
          number(g['budget']) > 0 &&
          number(g['spent']) / number(g['budget']) * 100 >= s.threshold,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'A little plan. More possibility.',
          style: TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: deepPurple,
            borderRadius: BorderRadius.circular(28),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.account_balance_wallet_outlined,
                    color: cream,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'LEFT TO SPEND',
                    style: TextStyle(
                      color: cream,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.4,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  s.money(remaining),
                  style: const TextStyle(
                    fontSize: 42,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -1.5,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'of ${s.money(budget)} this month',
                style: const TextStyle(color: cream),
              ),
              const SizedBox(height: 24),
              LinearProgressIndicator(
                value: budget > 0 ? (spent / budget).clamp(0, 1) : 0,
                minHeight: 8,
                borderRadius: BorderRadius.circular(8),
                color: cream,
                backgroundColor: plum,
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 24,
                runSpacing: 12,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Spent so far',
                        style: TextStyle(color: cream),
                      ),
                      Text(
                        s.money(spent),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        remainingDays > 0
                            ? 'Per day after today'
                            : 'Month complete',
                        style: const TextStyle(color: cream),
                      ),
                      Text(
                        s.money(
                          remainingDays > 0 ? remaining / remainingDays : 0,
                        ),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        if (budget <= 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: EmptyView(
              title: 'Start with a simple plan',
              message: 'Set your allowance, savings goal, and pocket split for this month.',
              icon: Icons.auto_awesome_outlined,
              action: FilledButton(
                onPressed: () => setState(() => tab = 1),
                child: const Text('Set up my plan'),
              ),
            ),
          ),
        if (alert && dismissed != monthKey(s.month))
          Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.notifications_active_outlined),
                  const SizedBox(height: 8),
                  Text(
                    'Time for a budget check-in',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    'One of your pockets has reached ${s.threshold.round()}% of its allocation.',
                  ),
                  TextButton(
                    onPressed: () =>
                        setState(() => dismissed = monthKey(s.month)),
                    child: const Text('Got it'),
                  ),
                ],
              ),
            ),
          ),
        Section(
          'Your two pockets',
          child: Column(
            children: s.groups.map((g) {
              final personal = g['name'] == 'Personal';
              final ratio = number(g['budget']) > 0
                  ? number(g['spent']) / number(g['budget'])
                  : 0.0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Panel(
                  child: Column(
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: Theme.of(context)
                                .colorScheme
                                .primaryContainer,
                            child: Icon(
                              personal
                                  ? Icons.person_outline
                                  : Icons.home_outlined,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              g['name'],
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          Text(
                            '${number(g['percent']).round()}%',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      ValueRow('Remaining', s.money(g['remaining'])),
                      LinearProgressIndicator(
                        value: ratio.clamp(0, 1),
                        minHeight: 6,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '${s.money(g['spent'])} spent of ${s.money(g['budget'])} · ${(ratio * 100).round()}% used',
                      ),
                      if (ratio > 1)
                        Text(
                          'Over allocation by ${s.money(number(g['spent']) - number(g['budget']))}',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        Panel(
          child: Row(
            children: [
              const Icon(Icons.savings_outlined, size: 32),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Saved for your future'),
                    Text(
                      s.money(s.budget['alreadySaved']),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    Text(
                      '${s.money(s.budget['savingsTarget'])} goal this month',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'Recent activity',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => TransactionsPage(store: s),
                ),
              ),
              child: const Text('See all'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        TransactionList(store: s, limit: 5),
      ],
    );
  }
}
