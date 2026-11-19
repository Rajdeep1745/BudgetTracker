import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

// Rebuild platform icons from the exact website mark, without redrawing it.
void main() {
  testWidgets('generate Pocket Plan launcher assets', (tester) async {
    await tester.runAsync(() async {
      final picture = await vg.loadPicture(
        SvgStringLoader(File('assets/logo.svg').readAsStringSync()),
        null,
      );
      Future<void> save(String path, int size) async {
        final recorder = ui.PictureRecorder();
        final canvas = Canvas(recorder);
        canvas.drawColor(Colors.white, BlendMode.src);
        canvas.scale(size / 64);
        canvas.drawPicture(picture.picture);
        final rendered = recorder.endRecording();
        final image = await rendered.toImage(size, size);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        File(path).writeAsBytesSync(bytes!.buffer.asUint8List());
        image.dispose();
        rendered.dispose();
      }

      for (final entry in {
        'mdpi': 48,
        'hdpi': 72,
        'xhdpi': 96,
        'xxhdpi': 144,
        'xxxhdpi': 192,
      }.entries) {
        await save(
          'android/app/src/main/res/mipmap-${entry.key}/ic_launcher.png',
          entry.value,
        );
      }
      final icons = Directory('ios/Runner/Assets.xcassets/AppIcon.appiconset');
      for (final file in icons.listSync().whereType<File>().where(
        (f) => f.path.endsWith('.png'),
      )) {
        final match = RegExp(r'Icon-App-(\d+(?:\.\d+)?)x.*@(\d)x')
            .firstMatch(file.path);
        if (match != null) {
          await save(
            file.path,
            (double.parse(match[1]!) * int.parse(match[2]!)).round(),
          );
        }
      }
      for (final size in [192, 512]) {
        await save('web/icons/Icon-$size.png', size);
        await save('web/icons/Icon-maskable-$size.png', size);
      }
      await save('web/favicon.png', 32);
      picture.picture.dispose();
    });
  });
}
