import 'package:flutter/material.dart';

class BrandColors {
  const BrandColors._();

  static const Color navy = Color(0xFF333A54);
  static const Color navyDark = Color(0xFF262B3F);
  static const Color navyLight = Color(0xFF454C6B);
  static const Color primaryGreen = Color(0xFF327331);
  static const Color accentGreen = Color(0xFF47A547);
  static const Color accentMagenta = Color(0xFF802276);
  static const Color zebraStripe = Color(0xFFF9F9F9);
  static const Color scaffoldBackground = Color(0xFFE9E9EB);
  static const Color cardBackground = Colors.white;
  static const Color borderGray = Color(0xFFDDDDDF);
}

ThemeData buildAppTheme() {
  final baseScheme = ColorScheme.fromSeed(
    seedColor: BrandColors.navy,
    brightness: Brightness.light,
  );
  final colorScheme = baseScheme.copyWith(
    primary: BrandColors.navy,
    onPrimary: Colors.white,
    secondary: BrandColors.primaryGreen,
    onSecondary: Colors.white,
    surface: BrandColors.cardBackground,
    onSurface: const Color(0xFF1C1F2A),
    error: const Color(0xFFB3261E),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: BrandColors.scaffoldBackground,
    appBarTheme: const AppBarTheme(
      backgroundColor: BrandColors.navy,
      foregroundColor: Colors.white,
      centerTitle: false,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: BrandColors.cardBackground,
      elevation: 1,
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: BrandColors.borderGray, width: 0.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: BrandColors.primaryGreen,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: BrandColors.primaryGreen,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: BrandColors.navy,
        side: const BorderSide(color: BrandColors.navy),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: BrandColors.navy),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: BrandColors.primaryGreen,
      foregroundColor: Colors.white,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: BrandColors.borderGray),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: BrandColors.borderGray),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: BrandColors.navy, width: 1.5),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: BrandColors.navy,
      indicatorColor: BrandColors.primaryGreen,
      surfaceTintColor: Colors.transparent,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => const TextStyle(color: Colors.white, fontSize: 11),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected) ? Colors.white : Colors.white70,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(color: BrandColors.borderGray, space: 1),
    chipTheme: ChipThemeData(
      backgroundColor: BrandColors.zebraStripe,
      side: const BorderSide(color: BrandColors.borderGray),
      labelStyle: const TextStyle(color: BrandColors.navy),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
  );
}
