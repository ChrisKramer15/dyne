import 'package:flutter/material.dart';

class HeroSection extends StatelessWidget {
  const HeroSection({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      children: [
        // App icon / logo
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [colorScheme.primary, colorScheme.secondary],
            ),
            boxShadow: [
              BoxShadow(
                color: colorScheme.primary.withValues(alpha: 0.4),
                blurRadius: 20,
                spreadRadius: 2,
              ),
            ],
          ),
          child: const Icon(
            Icons.sports_football,
            size: 32,
            color: Colors.black,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'DYNE',
          style: theme.textTheme.headlineLarge?.copyWith(
            letterSpacing: 6,
            fontSize: 36,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Fantasy Football, Reimagined',
          style: theme.textTheme.bodyLarge?.copyWith(
            fontSize: 15,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
