import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/store.dart';
import '../widgets/common.dart';

class ReportsPage extends StatefulWidget {
  final AppStore store;
  const ReportsPage({super.key, required this.store});
  @override
  State<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<ReportsPage> {
  late int selected;
  String group = 'Personal';
  @override
  void initState() {
    super.initState();
    selected = widget.store.elapsed.clamp(1, widget.store.days);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.store;
    final entries = List<Json>.from(s.dashboard?['groupDaily'] ?? [])
        .where((e) => e['group_name'] == group)
        .toList();
    final allocation = s.groups.firstWhere(
      (g) => g['name'] == group,
      orElse: () => {},
    );
    final budget = number(allocation['budget']);
    final report = GroupReport.calculate(
      entries: entries,
      budget: budget,
      selectedDay: selected,
      days: s.days,
      elapsed: s.elapsed,
    );
    final categories =
        s.categories
            .where((c) => c['group_name'] == group && number(c['spent']) > 0)
            .toList()
          ..sort((a, b) => number(b['spent']).compareTo(number(a['spent'])));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'See the bigger picture.',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        const Text('Small habits. Meaningful progress.'),
        const SizedBox(height: 24),
        if (MediaQuery.textScalerOf(context).scale(16) > 22)
          DropdownButtonFormField<String>(
            initialValue: group,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Budget pocket'),
            items: ['Personal', 'Household']
                .map((name) => DropdownMenuItem(value: name, child: Text(name)))
                .toList(),
            onChanged: (value) => setState(() => group = value!),
          )
        else
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                value: 'Personal',
                icon: Icon(Icons.person_outline),
                label: Text('Personal'),
              ),
              ButtonSegment(
                value: 'Household',
                icon: Icon(Icons.home_outlined),
                label: Text('Household'),
              ),
            ],
            selected: {group},
            onSelectionChanged: (v) => setState(() => group = v.first),
          ),
        const SizedBox(height: 24),
        Section(
          'Your spending rhythm',
          subtitle: 'Cumulative spending against your ideal daily pace.',
          child: Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ValueRow('Allocated', s.money(budget)),
                ValueRow('Projected month-end', s.money(report.projected)),
                const SizedBox(height: 20),
                Semantics(
                  label:
                      '$group spending pace. Allocation ${s.money(budget)}. Projected month-end ${s.money(report.projected)}. Through day $selected: ${s.money(report.spent)}.',
                  child: SizedBox(
                    height: 180,
                    child: CustomPaint(
                      painter: PacePainter(
                        entries: entries,
                        budget: budget,
                        days: s.days,
                        elapsed: s.elapsed,
                        selected: selected,
                        color: Theme.of(context).colorScheme.primary,
                        ideal: Theme.of(context).colorScheme.outline,
                        projection: Theme.of(context).colorScheme.secondary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [const Text('Day 1'), Text('Day ${s.days}')],
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 16,
                  runSpacing: 8,
                  children: [
                    legend(
                      context,
                      'Actual',
                      Theme.of(context).colorScheme.primary,
                    ),
                    legend(
                      context,
                      'Ideal',
                      Theme.of(context).colorScheme.outline,
                    ),
                    legend(
                      context,
                      'Projected',
                      Theme.of(context).colorScheme.secondary,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        Section(
          'One day at a time',
          child: Panel(
            child: Column(
              children: [
                ValueRow('Selected day', '$selected / ${s.days}'),
                Slider(
                  value: selected.toDouble(),
                  min: 1,
                  max: s.days.toDouble(),
                  divisions: s.days - 1,
                  label: 'Day $selected',
                  onChanged: (v) => setState(() => selected = v.round()),
                ),
                ValueRow('Spent on day $selected', s.money(report.onDay)),
                ValueRow('Spent through day $selected', s.money(report.spent)),
                ValueRow(
                  'Remaining after day $selected',
                  s.money(report.remaining),
                ),
                const Divider(),
                ValueRow(
                  'Per day after day $selected',
                  s.money(report.dailyAllowed),
                ),
                Text(
                  selected == s.days
                      ? 'This month is complete; no days remain.'
                      : '${s.days - selected} days remaining after the selected day.',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
        Section(
          'Where it goes',
          subtitle: 'Your five largest $group expense categories.',
          child: categories.isEmpty
              ? const EmptyView(
                  title: 'Nothing here yet',
                  message: 'Your spending breakdown will appear after your first expense.',
                  icon: Icons.donut_large_outlined,
                )
              : Panel(
                  child: Column(
                    children: categories
                        .take(5)
                        .map(
                          (c) => Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: Column(
                              children: [
                                ValueRow(c['name'], s.money(c['spent'])),
                                LinearProgressIndicator(
                                  value: number(allocation['spent']) > 0
                                      ? (number(c['spent']) /
                                                number(allocation['spent']))
                                            .clamp(0, 1)
                                      : 0,
                                  minHeight: 8,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ],
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
        ),
        Section(
          'Monthly totals',
          child: Panel(
            child: Column(
              children: [
                ValueRow(
                  'Spendable budget',
                  s.money(s.dashboard?['totals']?['budget']),
                ),
                ValueRow('Spent', s.money(s.dashboard?['totals']?['spent'])),
                ValueRow(
                  'Remaining',
                  s.money(s.dashboard?['totals']?['remaining']),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget legend(BuildContext context, String text, Color color) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(width: 16, height: 4, color: color),
      const SizedBox(width: 6),
      Text(text, style: Theme.of(context).textTheme.bodySmall),
    ],
  );
}

class PacePainter extends CustomPainter {
  final List<Json> entries;
  final double budget;
  final int days, elapsed, selected;
  final Color color, ideal, projection;
  PacePainter({
    required this.entries,
    required this.budget,
    required this.days,
    required this.elapsed,
    required this.selected,
    required this.color,
    required this.ideal,
    required this.projection,
  });
  @override
  void paint(Canvas canvas, Size size) {
    final amounts = <int, double>{};
    for (final e in entries) {
      final d = DateTime.parse(e['date']).day;
      amounts[d] = (amounts[d] ?? 0) + number(e['amount']);
    }
    double sum = 0;
    final actual = List.generate(days, (i) {
      sum += amounts[i + 1] ?? 0;
      return sum;
    });
    final spent = elapsed > 0 ? actual[elapsed - 1] : 0.0;
    final projected = elapsed > 0 ? spent / elapsed * days : 0.0;
    final maxValue =
        math.max(
          1.0,
          math.max(budget, math.max(projected, actual.fold(0.0, math.max))),
        ) *
        1.12;
    Offset point(int d, double amount) => Offset(
      (d - 1) / (days - 1) * size.width,
      size.height - amount / maxValue * size.height,
    );
    for (var i = 0; i < 4; i++) {
      final y = size.height * i / 3;
      canvas.drawLine(
        Offset(0, y),
        Offset(size.width, y),
        Paint()..color = ideal.withValues(alpha: .15),
      );
    }
    canvas.drawLine(
      point(1, budget / days),
      point(days, budget),
      Paint()
        ..color = ideal
        ..strokeWidth = 2,
    );
    if (elapsed > 0) {
      final path = Path()
        ..moveTo(point(1, actual[0]).dx, point(1, actual[0]).dy);
      for (var d = 2; d <= elapsed; d++) {
        final p = point(d, actual[d - 1]);
        path.lineTo(p.dx, p.dy);
      }
      final fill = Path.from(path)
        ..lineTo(point(elapsed, 0).dx, size.height)
        ..lineTo(0, size.height)
        ..close();
      canvas.drawPath(
        fill,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [color.withValues(alpha: .2), color.withValues(alpha: 0)],
          ).createShader(Offset.zero & size),
      );
      canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..strokeWidth = 3
          ..style = PaintingStyle.stroke
          ..strokeJoin = StrokeJoin.round,
      );
      if (elapsed < days) {
        final a = point(elapsed, spent), b = point(days, projected);
        final distance = (b - a).distance;
        for (double v = 0; v < distance; v += 10) {
          canvas.drawLine(
            Offset.lerp(a, b, v / distance)!,
            Offset.lerp(a, b, math.min((v + 5) / distance, 1))!,
            Paint()
              ..color = projection
              ..strokeWidth = 2,
          );
        }
      }
    }
    final marker = point(selected, actual[selected - 1]);
    canvas.drawLine(
      Offset(marker.dx, 0),
      Offset(marker.dx, size.height),
      Paint()..color = color.withValues(alpha: .3),
    );
    canvas.drawCircle(marker, 5, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant PacePainter old) => true;
}
