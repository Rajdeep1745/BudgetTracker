import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pocket_plan/main.dart';

import 'widget_test.dart' show makeStore;

void main() {
  testWidgets('render mobile screens with branded fonts for visual review', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final regular = FontLoader('Roboto')
      ..addFont(rootBundle.load('assets/fonts/roboto-regular.ttf'));
    final bold = FontLoader('Roboto')
      ..addFont(rootBundle.load('assets/fonts/roboto-bold.ttf'));
    await regular.load();
    await bold.load();
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    final store = await makeStore();
    await store.load();
    final key = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: PocketPlanApp(store: store),
      ),
    );
    await tester.pumpAndSettle();
    Future<void> capture(String name) async {
      expect(tester.takeException(), isNull);
      if (!const bool.fromEnvironment('WRITE_UI_REVIEW')) return;
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      boundary.markNeedsPaint();
      await tester.pump();
      await tester.runAsync(() async {
        final image = await boundary.toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        final file = File('build/ui-review/$name.png');
        file.parent.createSync(recursive: true);
        file.writeAsBytesSync(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }

    await capture('overview');
    for (final tab in ['Plan', 'Insights', 'Settings']) {
      await tester.tap(find.text(tab).last);
      await tester.pumpAndSettle();
      await capture(tab.toLowerCase());
    }
    await store.setPreference('appearance', 'dark');
    await tester.pumpAndSettle();
    await capture('settings-dark');
    // Mount a fresh scene so captures do not reuse cached layers from another tab.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: PocketPlanApp(store: store),
      ),
    );
    await tester.pumpAndSettle();
    await capture('overview-dark');
    await tester.tap(find.text('Add expense'));
    await tester.pumpAndSettle();
    await capture('add-expense');
    store.dispose();
  });
}
