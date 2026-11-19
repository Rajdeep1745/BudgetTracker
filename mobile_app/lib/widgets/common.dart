import 'package:flutter/material.dart';

// Shared with the website and the supplied brand palette.
const deepPurple = Color(0xFF290044);
const brandPurple = Color(0xFF500071);
const plum = Color(0xFF8A2A78);
const cream = Color(0xFFEEE3B0);

ThemeData appTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme =
      ColorScheme.fromSeed(
        seedColor: brandPurple,
        brightness: brightness,
      ).copyWith(
        primary: dark ? cream : brandPurple,
        onPrimary: dark ? deepPurple : Colors.white,
        primaryContainer: dark ? brandPurple : cream,
        onPrimaryContainer: dark ? cream : deepPurple,
        secondary: dark ? const Color(0xFFE4B9DC) : plum,
        onSecondary: dark ? deepPurple : Colors.white,
        secondaryContainer: dark
            ? const Color(0xFF492039)
            : const Color(0xFFF4E6F0),
        onSecondaryContainer: dark ? const Color(0xFFF4E6F0) : brandPurple,
        tertiary: dark ? cream : deepPurple,
        onTertiary: dark ? deepPurple : cream,
        surface: dark ? const Color(0xFF1B1024) : const Color(0xFFF9FAFB),
        onSurface: dark ? const Color(0xFFF7EFF8) : deepPurple,
        onSurfaceVariant: dark
            ? const Color(0xFFD5C3D9)
            : const Color(0xFF625367),
        surfaceContainerLow: dark
            ? const Color(0xFF24152F)
            : const Color(0xFFF4F0F6),
      );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    brightness: brightness,
    scaffoldBackgroundColor: scheme.surface,
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      backgroundColor: Colors.transparent,
      scrolledUnderElevation: 0,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: dark ? const Color(0xFF2B1738) : Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surfaceContainerLow,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.all(18),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 54),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? const Color(0xFF2B1738) : Colors.white,
      indicatorColor: scheme.primaryContainer,
    ),
    textTheme: ThemeData(brightness: brightness).textTheme
        .apply(fontFamily: 'Roboto')
        .copyWith(
          headlineLarge: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w800,
            letterSpacing: -1.2,
            color: scheme.onSurface,
          ),
          headlineSmall: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            letterSpacing: -.6,
            color: scheme.onSurface,
          ),
          titleLarge: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            letterSpacing: -.3,
            color: scheme.onSurface,
          ),
        ),
  );
}

class Section extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget child;
  const Section(this.title, {super.key, required this.child, this.subtitle});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        if (subtitle != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              subtitle!,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        const SizedBox(height: 12),
        child,
      ],
    ),
  );
}

class Panel extends StatelessWidget {
  final Widget child;
  const Panel({super.key, required this.child});
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(padding: const EdgeInsets.all(20), child: child),
  );
}

class EmptyView extends StatelessWidget {
  final String title, message;
  final IconData icon;
  final Widget? action;
  const EmptyView({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.receipt_long_outlined,
    this.action,
  });
  @override
  Widget build(BuildContext context) => Panel(
    child: SizedBox(
      width: double.infinity,
      child: Column(
        children: [
          Icon(icon, size: 36, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 16),
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
          if (action != null)
            Padding(padding: const EdgeInsets.only(top: 16), child: action!),
        ],
      ),
    ),
  );
}

class ValueRow extends StatelessWidget {
  final String label, value;
  const ValueRow(this.label, this.value, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Wrap(
      alignment: WrapAlignment.spaceBetween,
      spacing: 16,
      runSpacing: 4,
      children: [
        Text(label),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    ),
  );
}

void toast(BuildContext context, String message) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
Future<bool> confirm(
  BuildContext context,
  String title,
  String message,
) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    ) ??
    false;
IconData categoryIcon(String name) {
  final lower = name.toLowerCase();
  if (RegExp('food|meat|fish|vegetable').hasMatch(lower)) {
    return Icons.restaurant_outlined;
  }
  if (RegExp('grocer|shopping').hasMatch(lower)) {
    return Icons.shopping_bag_outlined;
  }
  if (lower.contains('transport')) return Icons.directions_transit_outlined;
  if (lower.contains('medical')) return Icons.health_and_safety_outlined;
  if (lower.contains('bill')) return Icons.bolt_outlined;
  return Icons.category_outlined;
}
