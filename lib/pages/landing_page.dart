import 'package:flutter/material.dart';

import '../widgets/hero_section.dart';
import '../widgets/feature_card.dart';
import '../widgets/cta_section.dart';
import '../theme/dyne_theme.dart';

class LandingPage extends StatelessWidget {
  const LandingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background image
          Image.network(
            'https://images.unsplash.com/photo-1763494392794-a07d77898569?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              decoration: BoxDecoration(gradient: DyneTheme.landingGradient),
            ),
          ),
          // Dark overlay for readability
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.25),
                  Colors.black.withValues(alpha: 0.4),
                  Colors.black.withValues(alpha: 0.55),
                ],
              ),
            ),
          ),
          // Content
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Spacer(flex: 2),
                  const HeroSection(),
                  const Spacer(flex: 5),
                  _buildFeatureCards(),
                  const SizedBox(height: 48),
                  const CtaSection(),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureCards() {
    const features = [
      FeatureCardData(
        icon: Icons.groups,
        title: 'Draft Your Squad',
        description:
            'Draft real players, dominate your league.',
      ),
      FeatureCardData(
        icon: Icons.leaderboard,
        title: 'Live Scoring',
        description:
            'Real-time stats every game day.',
      ),
      FeatureCardData(
        icon: Icons.emoji_events,
        title: 'Win Your League',
        description:
            'Climb the standings and take the championship.',
      ),
    ];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: features
          .map((f) => Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: FeatureCard(data: f),
                ),
              ))
          .toList(),
    );
  }
}
