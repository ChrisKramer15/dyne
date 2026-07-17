import 'package:flutter/material.dart';

class DyneTheme {
  // Core palette
  static const _bgDark = Color(0xFF0B0E1A);
  static const _bgCard = Color(0xFF141829);
  static const _neonCyan = Color(0xFF00E5FF);
  static const _neonGreen = Color(0xFF39FF14);
  static const _textPrimary = Color(0xFFEAECF0);
  static const _textSecondary = Color(0xFF9CA3AF);

  static ThemeData get dark => ThemeData(
        brightness: Brightness.dark,
        colorScheme: const ColorScheme.dark(
          surface: _bgDark,
          primary: _neonCyan,
          secondary: _neonGreen,
          onSurface: _textPrimary,
          onPrimary: Color(0xFF000000),
        ),
        scaffoldBackgroundColor: _bgDark,
        cardTheme: CardThemeData(
          color: _bgCard,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: _neonCyan.withValues(alpha: 0.15),
            ),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: _neonCyan,
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: _neonCyan,
            side: const BorderSide(color: _neonCyan),
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        textTheme: const TextTheme(
          headlineLarge: TextStyle(
            fontSize: 36,
            fontWeight: FontWeight.bold,
            color: _textPrimary,
          ),
          headlineMedium: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w600,
            color: _textPrimary,
          ),
          bodyLarge: TextStyle(
            fontSize: 16,
            color: _textSecondary,
          ),
        ),
      );

  /// Gradient used for the landing page background.
  static const landingGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFF0F1628), // Deep navy blue
      Color(0xFF0B0E1A), // Near-black blue
      Color(0xFF080A14), // Darkest
    ],
    stops: [0.0, 0.5, 1.0],
  );
}
