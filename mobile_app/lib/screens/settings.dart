import 'package:flutter/material.dart';

import '../core/store.dart';
import '../widgets/common.dart';

class SettingsPage extends StatefulWidget {
  final AppStore store;
  const SettingsPage({super.key, required this.store});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool busy = false;
  Future<void> action(Future<void> Function() work, String message) async {
    setState(() => busy = true);
    try {
      await work();
      if (mounted) toast(context, message);
    } catch (e) {
      if (mounted) toast(context, '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> addName({bool category = false}) async {
    final controller = TextEditingController();
    final form = GlobalKey<FormState>();
    String group = 'Personal';
    final result = await showDialog<Json>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(category ? 'New category' : 'New fixed cost'),
        content: Form(
          key: form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: controller,
                autofocus: true,
                maxLength: 60,
                decoration: const InputDecoration(labelText: 'Name'),
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? 'Enter a name.' : null,
              ),
              if (category)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: DropdownButtonFormField<String>(
                    initialValue: group,
                    decoration: const InputDecoration(
                      labelText: 'Budget group',
                    ),
                    items: ['Personal', 'Household']
                        .map((g) => DropdownMenuItem(value: g, child: Text(g)))
                        .toList(),
                    onChanged: (v) => group = v!,
                  ),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (form.currentState!.validate()) {
                Navigator.pop(context, {
                  'name': controller.text.trim(),
                  if (category) 'groupName': group,
                  if (!category) 'effectiveMonth': monthKey(DateTime.now()),
                });
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
    // The dialog route finishes its exit animation before its controller is released.
    await Future<void>.delayed(const Duration(milliseconds: 300));
    controller.dispose();
    if (result != null && mounted) {
      await action(
        () => widget.store.mutate(
          category ? '/categories' : '/settings/fixed-costs',
          'POST',
          result,
        ),
        category
            ? 'Category added.'
            : 'Fixed cost added. Set its monthly amount in Plan.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.store;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Section(
          'Make it yours',
          child: Panel(
            child: Column(
              children: [
                DropdownButtonFormField<String>(
                  initialValue: s.currency,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Display currency',
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'INR',
                      child: Text('Indian Rupee · INR'),
                    ),
                    DropdownMenuItem(
                      value: 'USD',
                      child: Text('US Dollar · USD'),
                    ),
                    DropdownMenuItem(value: 'EUR', child: Text('Euro · EUR')),
                    DropdownMenuItem(
                      value: 'GBP',
                      child: Text('British Pound · GBP'),
                    ),
                  ],
                  onChanged: busy
                      ? null
                      : (v) => action(
                          () => s.setPreference('currency', v),
                          'Currency updated. Display only; amounts are not converted.',
                        ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: s.appearance,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Appearance'),
                  items: const [
                    DropdownMenuItem(
                      value: 'system',
                      child: Text('Follow device'),
                    ),
                    DropdownMenuItem(value: 'light', child: Text('Light')),
                    DropdownMenuItem(value: 'dark', child: Text('Dark')),
                  ],
                  onChanged: busy
                      ? null
                      : (v) => action(
                          () => s.setPreference('appearance', v),
                          'Appearance updated.',
                        ),
                ),
                const SizedBox(height: 24),
                ValueRow('Budget alert', '${s.threshold.round()}%'),
                Slider(
                  value: s.threshold,
                  min: 1,
                  max: 100,
                  divisions: 99,
                  label: '${s.threshold.round()}%',
                  onChanged: busy
                      ? null
                      : (v) => s.setPreference('threshold', v),
                ),
                const Text(
                  'An in-app alert appears when either pocket reaches this share of its allocation.',
                ),
              ],
            ),
          ),
        ),
        Section(
          'Monthly setup',
          subtitle: 'Changes apply from the current month forward. Past months stay unchanged.',
          child: Panel(
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Include carry in'),
                  subtitle: const Text(
                    'Use a saved carry-in amount in your allowance.',
                  ),
                  value: s.settings['carryInEnabled'] ?? true,
                  onChanged: busy
                      ? null
                      : (v) => action(
                          () => s.mutate('/settings/carry-in', 'PUT', {
                            'enabled': v,
                            'effectiveMonth': monthKey(DateTime.now()),
                          }),
                          'Carry-in preference saved.',
                        ),
                ),
                const Divider(),
                ...List<Json>.from(s.settings['fixedCosts'] ?? []).map(
                  (c) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(c['name']),
                    trailing: IconButton(
                      tooltip: 'Delete ${c['name']}',
                      onPressed: busy
                          ? null
                          : () async {
                              if (await confirm(
                                context,
                                'Delete ${c['name']}?',
                                'Remove this cost and its amounts from the current and future months? Past months will be preserved.',
                              )) {
                                await action(
                                  () => s.mutate(
                                    '/settings/fixed-costs/${c['id']}?month=${monthKey(DateTime.now())}',
                                    'DELETE',
                                  ),
                                  'Fixed cost removed.',
                                );
                              }
                            },
                      icon: const Icon(Icons.delete_outline),
                    ),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: busy ? null : () => addName(),
                  icon: const Icon(Icons.add),
                  label: const Text('Add fixed cost'),
                ),
              ],
            ),
          ),
        ),
        Section(
          'Your categories',
          subtitle: 'A home for every expense.',
          child: Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: s.categories
                      .map(
                        (c) => Chip(
                          avatar: Icon(categoryIcon(c['name']), size: 18),
                          label: Text('${c['name']} · ${c['group_name']}'),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: busy ? null : () => addName(category: true),
                  icon: const Icon(Icons.add),
                  label: const Text('Add category'),
                ),
              ],
            ),
          ),
        ),
        const Padding(
          padding: EdgeInsets.only(bottom: 24),
          child: Text(
            'Preferences are stored on this device. Budget data is shared with your website.',
          ),
        ),
        const Center(
          child: Text('Pocket Plan  /  A little plan. More possibility.'),
        ),
        if (busy)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          ),
      ],
    );
  }
}
