import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/store.dart';
import '../widgets/common.dart';

Future<void> expenseSheet(
  BuildContext context,
  AppStore store, {
  Json? transaction,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => ExpenseEditor(store: store, transaction: transaction),
  );
}

class ExpenseEditor extends StatefulWidget {
  final AppStore store;
  final Json? transaction;
  const ExpenseEditor({super.key, required this.store, this.transaction});
  @override
  State<ExpenseEditor> createState() => _ExpenseEditorState();
}

class _ExpenseEditorState extends State<ExpenseEditor> {
  final form = GlobalKey<FormState>();
  late final TextEditingController amount, description;
  late DateTime date;
  String? category;
  String? error;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final t = widget.transaction;
    amount = TextEditingController(text: t == null ? '' : '${t['amount']}');
    description = TextEditingController(text: t?['description'] ?? '');
    category = t?['category_id'];
    final now = DateTime.now();
    date = t == null
        ? (monthKey(now) == monthKey(widget.store.month)
              ? now
              : widget.store.month)
        : DateTime.parse(t['transaction_date']);
  }

  @override
  void dispose() {
    amount.dispose();
    description.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final t = widget.transaction;
      await widget.store.mutate(
        t == null ? '/transactions' : '/transactions/${t['id']}',
        t == null ? 'POST' : 'PUT',
        {
          'categoryId': category,
          'amount': double.parse(amount.text),
          'description': description.text.trim(),
          'transactionDate': dayKey(date),
        },
      );
      if (mounted) {
        toast(
          context,
          t == null
              ? 'Expense added. Same-day category entries are combined.'
              : 'Expense updated.',
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> delete() async {
    if (!await confirm(
      context,
      'Delete expense?',
      'This permanently removes the expense from your budget.',
    )) {
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.store.mutate(
        '/transactions/${widget.transaction!['id']}',
        'DELETE',
      );
      if (mounted) {
        toast(context, 'Expense deleted.');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        8,
        24,
        MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.outlineVariant,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              Text(
                widget.transaction == null ? 'Add an expense' : 'Edit expense',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              const Text('A little tracking. A lot more clarity.'),
              const SizedBox(height: 24),
              TextFormField(
                controller: amount,
                autofocus: true,
                enabled: !busy,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                ),
                decoration: InputDecoration(
                  labelText: 'Amount',
                  prefixText: '${widget.store.currency} ',
                ),
                validator: (v) {
                  final n = double.tryParse(v ?? '');
                  return n == null || !n.isFinite || n <= 0
                      ? 'Enter an amount greater than zero.'
                      : null;
                },
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: category,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Category'),
                items: widget.store.categories
                    .map(
                      (c) => DropdownMenuItem(
                        value: '${c['id']}',
                        child: Text(c['name'], overflow: TextOverflow.ellipsis),
                      ),
                    )
                    .toList(),
                onChanged: busy ? null : (v) => category = v,
                validator: (v) => v == null ? 'Choose a category.' : null,
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: busy
                    ? null
                    : () async {
                        final value = await showDatePicker(
                          context: context,
                          initialDate: date,
                          firstDate: DateTime(2000),
                          lastDate: DateTime(2100, 12, 31),
                        );
                        if (value != null) setState(() => date = value);
                      },
                icon: const Icon(Icons.calendar_today_outlined),
                label: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(DateFormat('EEEE, d MMM yyyy').format(date)),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: description,
                enabled: !busy,
                maxLength: widget.transaction == null ? 140 : null,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Note (optional)',
                  hintText: 'What was it for?',
                ),
              ),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: busy ? null : save,
                icon: busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check),
                label: Text(busy ? 'Saving…' : 'Save expense'),
              ),
              if (widget.transaction != null)
                TextButton.icon(
                  onPressed: busy ? null : delete,
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Delete expense'),
                ),
            ],
          ),
        ),
      ),
    ),
  );
}

class TransactionsPage extends StatefulWidget {
  final AppStore store;
  const TransactionsPage({super.key, required this.store});
  @override
  State<TransactionsPage> createState() => _TransactionsPageState();
}

class _TransactionsPageState extends State<TransactionsPage> {
  late final TextEditingController search;
  @override
  void initState() {
    super.initState();
    search = TextEditingController(text: widget.store.search);
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Your activity')),
    body: AnimatedBuilder(
      animation: widget.store,
      builder: (context, _) => ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(
            controller: search,
            maxLength: 140,
            decoration: InputDecoration(
              labelText: 'Search expenses',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                tooltip: 'Search',
                onPressed: () {
                  widget.store.search = search.text;
                  widget.store.page = 1;
                  widget.store.loadTransactions();
                },
                icon: const Icon(Icons.arrow_forward),
              ),
            ),
            onSubmitted: (v) {
              widget.store.search = v;
              widget.store.page = 1;
              widget.store.loadTransactions();
            },
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => filtersSheet(context, widget.store),
            icon: const Icon(Icons.tune),
            label: const Text('Filters & sorting'),
          ),
          TextButton(
            onPressed: () {
              search.clear();
              final s = widget.store;
              s.search = '';
              s.categoryId = '';
              s.from = '';
              s.to = '';
              s.sortBy = 'date';
              s.direction = 'desc';
              s.page = 1;
              s.loadTransactions();
            },
            child: const Text('Clear all filters'),
          ),
          const SizedBox(height: 8),
          TransactionList(store: widget.store),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                tooltip: 'Previous page',
                onPressed:
                    widget.store.page > 1 && !widget.store.transactionsLoading
                    ? () {
                        widget.store.page--;
                        widget.store.loadTransactions();
                      }
                    : null,
                icon: const Icon(Icons.chevron_left),
              ),
              Flexible(
                child: Text(
                  'Page ${widget.store.page} · ${widget.store.total} expenses',
                  textAlign: TextAlign.center,
                ),
              ),
              IconButton(
                tooltip: 'Next page',
                onPressed:
                    widget.store.page * 20 < widget.store.total &&
                        !widget.store.transactionsLoading
                    ? () {
                        widget.store.page++;
                        widget.store.loadTransactions();
                      }
                    : null,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class TransactionList extends StatelessWidget {
  final AppStore store;
  final int? limit;
  const TransactionList({super.key, required this.store, this.limit});
  @override
  Widget build(BuildContext context) {
    if (store.transactionsLoading) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (store.transactionError != null) {
      return EmptyView(
        title: 'Activity unavailable',
        message: store.transactionError!,
        action: TextButton(
          onPressed: store.loadTransactions,
          child: const Text('Try again'),
        ),
      );
    }
    if (store.transactions.isEmpty) {
      return const EmptyView(
        title: 'A fresh start',
        message: 'Add an expense to start tracking, or adjust your filters.',
      );
    }
    return Card(
      child: Column(
        children: store.transactions
            .take(limit ?? 20)
            .map(
              (t) => ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                leading: CircleAvatar(
                  backgroundColor: Theme.of(context)
                      .colorScheme
                      .primaryContainer,
                  child: Icon(
                    categoryIcon(t['category_name']),
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
                title: Text(
                  t['category_name'],
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      store.money(t['amount']),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      '${DateFormat('d MMM').format(DateTime.parse(t['transaction_date']))}${'${t['description']}'.isNotEmpty ? ' · ${t['description']}' : ''}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => expenseSheet(context, store, transaction: t),
                onLongPress: () async {
                  if (await confirm(
                    context,
                    'Delete expense?',
                    'Remove ${store.money(t['amount'])} from ${t['category_name']}? This cannot be undone.',
                  )) {
                    try {
                      await store.mutate('/transactions/${t['id']}', 'DELETE');
                      if (context.mounted) toast(context, 'Expense deleted.');
                    } catch (e) {
                      if (context.mounted) toast(context, '$e');
                    }
                  }
                },
              ),
            )
            .toList(),
      ),
    );
  }
}

Future<void> filtersSheet(BuildContext context, AppStore store) async {
  String category = store.categoryId,
      sort = store.sortBy,
      direction = store.direction;
  DateTime? from = DateTime.tryParse(store.from),
      to = DateTime.tryParse(store.to);
  String? error;
  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => Padding(
        padding: const EdgeInsets.all(24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Make it easier to find',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 24),
              DropdownButtonFormField<String>(
                initialValue: category,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Category'),
                items: [
                  const DropdownMenuItem(
                    value: '',
                    child: Text('All categories'),
                  ),
                  ...store.categories.map(
                    (c) => DropdownMenuItem(
                      value: '${c['id']}',
                      child: Text(c['name']),
                    ),
                  ),
                ],
                onChanged: (v) => category = v!,
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: sort,
                decoration: const InputDecoration(labelText: 'Sort by'),
                items: ['date', 'category', 'description', 'amount']
                    .map(
                      (v) => DropdownMenuItem(
                        value: v,
                        child: Text(toBeginningOfSentenceCase(v)),
                      ),
                    )
                    .toList(),
                onChanged: (v) => sort = v!,
              ),
              const SizedBox(height: 16),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'asc', label: Text('Ascending')),
                  ButtonSegment(value: 'desc', label: Text('Descending')),
                ],
                selected: {direction},
                onSelectionChanged: (v) => setState(() => direction = v.first),
              ),
              const SizedBox(height: 16),
              for (final start in [true, false])
                TextButton.icon(
                  onPressed: () async {
                    final value = await showDatePicker(
                      context: context,
                      initialDate: (start ? from : to) ?? store.month,
                      firstDate: DateTime(2000),
                      lastDate: DateTime(2100, 12, 31),
                    );
                    if (value != null) {
                      setState(() {
                        if (start) {
                          from = value;
                        } else {
                          to = value;
                        }
                      });
                    }
                  },
                  icon: const Icon(Icons.calendar_today_outlined),
                  label: Text(
                    '${start ? 'From' : 'To'}: ${(start ? from : to) == null ? 'Any day' : dayKey((start ? from : to)!)}',
                  ),
                ),
              if (error != null)
                Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  if (from != null && to != null && from!.isAfter(to!)) {
                    setState(
                      () => error = 'Start date must be before the end date.',
                    );
                    return;
                  }
                  store.categoryId = category;
                  store.sortBy = sort;
                  store.direction = direction;
                  store.from = from == null ? '' : dayKey(from!);
                  store.to = to == null ? '' : dayKey(to!);
                  store.page = 1;
                  store.loadTransactions();
                  Navigator.pop(context);
                },
                child: const Text('Apply filters'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
