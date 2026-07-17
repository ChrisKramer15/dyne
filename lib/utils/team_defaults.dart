import 'dart:math';

import 'package:flutter/material.dart';

/// Shared icon and color options for team customization.
/// Used by team creation, editing, and the draft carousel.
class TeamDefaults {
  TeamDefaults._();

  static const iconOptions = [
    // Sports
    Icons.sports_football,
    Icons.sports_basketball,
    Icons.sports_baseball,
    Icons.sports_hockey,
    Icons.sports_soccer,
    Icons.sports_mma,
    // Nature / Animals
    Icons.pets,
    Icons.pest_control,
    Icons.flutter_dash,
    Icons.cruelty_free,
    // Weather / Elements
    Icons.flash_on,
    Icons.bolt,
    Icons.whatshot,
    Icons.local_fire_department,
    Icons.tsunami,
    Icons.thunderstorm,
    Icons.tornado,
    Icons.ac_unit,
    Icons.water_drop,
    Icons.volcano,
    // Space / Cosmic
    Icons.rocket_launch,
    Icons.star,
    Icons.auto_awesome,
    Icons.nightlight_round,
    Icons.satellite_alt,
    // Military / Power
    Icons.shield,
    Icons.security,
    Icons.gavel,
    Icons.military_tech,
    // Objects / Abstract
    Icons.diamond,
    Icons.hexagon_outlined,
    Icons.catching_pokemon,
    Icons.blur_on,
    Icons.flare,
    Icons.grain,
    Icons.hub,
    Icons.offline_bolt,
    Icons.psychology,
    Icons.webhook,
    Icons.diversity_1,
  ];

  static const colorOptions = [
    // Reds
    Color(0xFFFF2D55),
    Color(0xFFFF5252),
    Color(0xFFD50000),
    Color(0xFFFF1744),
    Color(0xFFC62828),
    // Pinks
    Color(0xFFEC407A),
    Color(0xFFFF4081),
    Color(0xFFE040FB),
    Color(0xFFF50057),
    Color(0xFFFF00E5),
    // Purples
    Color(0xFF7C4DFF),
    Color(0xFFAB47BC),
    Color(0xFF651FFF),
    Color(0xFFD500F9),
    Color(0xFF6200EA),
    Color(0xFF9C27B0),
    // Blues
    Color(0xFF2979FF),
    Color(0xFF448AFF),
    Color(0xFF00B0FF),
    Color(0xFF40C4FF),
    Color(0xFF2962FF),
    Color(0xFF304FFE),
    Color(0xFF0091EA),
    // Cyans / Teals
    Color(0xFF00E5FF),
    Color(0xFF26C6DA),
    Color(0xFF1DE9B6),
    Color(0xFF00BFA5),
    Color(0xFF64FFDA),
    Color(0xFF00897B),
    // Greens
    Color(0xFF00E676),
    Color(0xFF69F0AE),
    Color(0xFF76FF03),
    Color(0xFF00C853),
    Color(0xFF2E7D32),
    // Yellows / Oranges
    Color(0xFFFFD600),
    Color(0xFFFFFF00),
    Color(0xFFFFC400),
    Color(0xFFFFD740),
    Color(0xFFFF8F00),
    Color(0xFFFF6D00),
    Color(0xFFFF3D00),
    Color(0xFFFF6E40),
    Color(0xFFFF9100),
    // Neutrals
    Color(0xFFFFFFFF),
    Color(0xFFB0BEC5),
    Color(0xFF78909C),
    Color(0xFF455A64),
    Color(0xFF263238),
    Color(0xFF000000),
  ];

  static const _teamNamePrefixes = [
    'Thunder', 'Shadow', 'Iron', 'Neon', 'Crimson',
    'Phantom', 'Blaze', 'Storm', 'Venom', 'Frost',
    'Solar', 'Lunar', 'Atomic', 'Cyber', 'Dark',
    'Hyper', 'Ultra', 'Mega', 'Stealth', 'Savage',
    'Royal', 'Golden', 'Silver', 'Emerald', 'Onyx',
    'Crystal', 'Plasma', 'Titan', 'Apex', 'Elite',
    'Chaos', 'Fury', 'Rage', 'Ghost', 'Rogue',
  ];

  static const _teamNameSuffixes = [
    'Hawks', 'Wolves', 'Dragons', 'Vipers', 'Knights',
    'Titans', 'Falcons', 'Sharks', 'Panthers', 'Cobras',
    'Phoenix', 'Raptors', 'Stallions', 'Legends', 'Raiders',
    'Outlaws', 'Mavericks', 'Warriors', 'Ninjas', 'Reapers',
    'Scorpions', 'Bears', 'Jaguars', 'Lions', 'Eagles',
    'Demons', 'Ghosts', 'Sabres', 'Chargers', 'Bulldogs',
    'Spartans', 'Vikings', 'Samurai', 'Gladiators', 'Enforcers',
  ];

  /// Generate a random team identity.
  static TeamIdentity generateRandom() {
    final random = Random();

    final prefix = _teamNamePrefixes[random.nextInt(_teamNamePrefixes.length)];
    final suffix = _teamNameSuffixes[random.nextInt(_teamNameSuffixes.length)];
    final name = '$prefix $suffix';

    // Generate abbreviation from first letters + random char
    final abbrev = '${prefix[0]}${suffix.substring(0, 2)}'.toUpperCase();

    final colorIndex = random.nextInt(colorOptions.length);
    final iconIndex = random.nextInt(iconOptions.length);

    // Pick a dark secondary color
    const secondaryOptions = [
      Color(0xFF0B0E1A),
      Color(0xFF1A1A2E),
      Color(0xFF16213E),
      Color(0xFF0F3460),
      Color(0xFF1B1B2F),
      Color(0xFF162447),
      Color(0xFF1F1F38),
    ];
    final secondaryColor = secondaryOptions[random.nextInt(secondaryOptions.length)];

    return TeamIdentity(
      name: name,
      abbreviation: abbrev,
      primaryColor: colorOptions[colorIndex],
      secondaryColor: secondaryColor,
      iconIndex: iconIndex,
    );
  }
}

class TeamIdentity {
  const TeamIdentity({
    required this.name,
    required this.abbreviation,
    required this.primaryColor,
    required this.secondaryColor,
    required this.iconIndex,
  });

  final String name;
  final String abbreviation;
  final Color primaryColor;
  final Color secondaryColor;
  final int iconIndex;
}
