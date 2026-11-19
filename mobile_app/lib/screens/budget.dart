import 'dart:convert';

import 'package:flutter/material.dart';

import '../core/store.dart';
import '../widgets/common.dart';

class BudgetPage extends StatefulWidget {
  final AppStore store;
  const BudgetPage({super.key, required this.store});
  @override
  State<BudgetPage> createState() => BudgetPageState();
}

class BudgetPageState extends State<BudgetPage> {
  final form = GlobalKey<FormState>();
  final fields = <String, TextEditingController>{};
  final costs = <String, TextEditingController>{};
  late double percent;
  late bool carry;
  bool busy = false, dirty = false;
  String? error;
  String snapshot = '';
  @override
  void initState() {
    super.initState();
    syncBudget();
  }

  @override
  void didUpdateWidget(covariant BudgetPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Refresh server changes without replacing a draft the user is editing.
    if (!dirty && !busy && snapshot != jsonEncode(widget.store.budget)) {
      syncBudget();
    }
  }

  void syncBudget() {
    for (final controller in [...fields.values, ...costs.values]) {
      controller.dispose();
    }
    fields.clear();
    costs.clear();
    final budget = widget.store.budget;
    snapshot = jsonEncode(budget);
    for (final key in [
      'allowance',
      'carryIn',
      'alreadySaved',
      'savingsTarget',
    ]) {
      fields[key] = TextEditingController(text: '${budget[key] ?? 0}');
    }
    for (final cost in List<Json>.from(budget['fixedCosts'] ?? [])) {
      costs[cost['id']] = TextEditingController(text: '${cost['amount']}');
    }
    percent = number(budget['personalPercent']);
    carry = budget['carryInEnabled'] ?? true;
  }

  @override
  void dispose() {
    for (final c in [...fields.values, ...costs.values]) {
      c.dispose();
    }
    super.dispose();
  }

  double get effective =>
      number(fields['allowance']!.text) -
      costs.values.fold(0.0, (sum, c) => sum + number(c.text)) +
      (carry ? number(fields['carryIn']!.text) : 0);
  double get spendable => effective - number(fields['savingsTarget']!.text);
  Widget input(
    String key,
    String label, {
    bool negative = false,
    TextEditingController? controller,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      controller: controller ?? fields[key],
      enabled: !busy,
      keyboardType: TextInputType.numberWithOptions(
        decimal: true,
        signed: negative,
      ),
      decoration: InputDecoration(
        labelText: label,
        prefixText: '${widget.store.currency} ',
      ),
      onChanged: (_) => setState(() => dirty = true),
      validator: (v) {
        final value = double.tryParse(v ?? '');
        return value == null || !value.isFinite || (!negative && value < 0)
            ? 'Enter a valid ${negative ? '' : 'nonnegative '}amount.'
            : null;
      },
    ),
  );
  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.store.mutate('/budgets', 'PUT', {
        'month': monthKey(widget.store.month),
        'allowance': number(fields['allowance']!.text),
        'carryIn': number(fields['carryIn']!.text),
        'carryInEnabled': carry,
        'alreadySaved': number(fields['alreadySaved']!.text),
        'savingsTarget': number(fields['savingsTarget']!.text),
        'personalPercent': percent,
        'fixedCosts': costs.entries
            .map((e) => {'id': e.key, 'amount': number(e.value.text)})
            .toList(),
      });
      if (mounted) {
        setState(() => dirty = false);
        toast(context, 'Your monthly plan is saved.');
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Form(
    key: form,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Give every rupee a purpose.',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        const Text(
          'Start with your allowance. Make room for life and savings.',
        ),
        const SizedBox(height: 24),
        Section(
          '01  Money coming in',
          child: Panel(
            child: Column(
              children: [
                input('allowance', 'Monthly allowance'),
                if (carry)
                  input(
                    'carryIn',
                    'Carry in (can be negative)',
                    negative: true,
                  ),
                Text(
                  carry
                      ? 'Carry in is included for this month.'
                      : 'Carry in is disabled for this month.',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
        Section(
          '02  Your commitments',
          subtitle: 'Fixed costs are deducted before your budget is split.',
          child: Panel(
            child: Column(
              children: [
                if (costs.isEmpty)
                  const Text(
                    'No fixed costs yet. Add rent, bills, or subscriptions in Settings.',
                  ),
                ...List<Json>.from(widget.store.budget['fixedCosts'] ?? []).map(
                  (c) => input(c['id'], c['name'], controller: costs[c['id']]),
                ),
              ],
            ),
          ),
        ),
        Section(
          '03  Save for what matters',
          child: Panel(
            child: Column(
              children: [
                input('alreadySaved', 'Already saved'),
                const Padding(
                  padding: EdgeInsets.only(bottom: 16),
                  child: Text(
                    'Your shared savings balance across all months. It is not deducted again.',
                  ),
                ),
                input('savingsTarget', 'Save this month'),
              ],
            ),
          ),
        ),
        Section(
          '04  Find your balance',
          subtitle: 'Split your spendable amount between two simple pockets.',
          child: Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ValueRow('Effective allowance', widget.store.money(effective)),
                ValueRow('Spendable budget', widget.store.money(spendable)),
                if (spendable < 0)
                  Text(
                    'Your commitments exceed your allowance. Group allocations will be zero.',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                const Divider(height: 32),
                ValueRow('Personal', '${percent.round()}%'),
                Slider(
                  value: percent,
                  min: 0,
                  max: 100,
                  divisions: 100,
                  label: '${percent.round()}% Personal',
                  onChanged: busy
                      ? null
                      : (v) => setState(() {
                          percent = v;
                          dirty = true;
                        }),
                ),
                ValueRow(
                  'Personal allocation',
                  widget.store.money(
                    spendable.clamp(0, double.infinity) * percent / 100,
                  ),
                ),
                ValueRow(
                  'Household · ${100 - percent.round()}%',
                  widget.store.money(
                    spendable.clamp(0, double.infinity) * (100 - percent) / 100,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        FilledButton.icon(
          onPressed: busy ? null : save,
          icon: busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.check),
          label: Text(busy ? 'Saving plan…' : 'Save monthly plan'),
        ),
        const SizedBox(height: 12),
        Text(
          dirty ? 'You have unsaved changes.' : 'Categories organize expenses; they do not have individual budgets.',
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}
