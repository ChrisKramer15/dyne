import 'dart:async';
import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models/league.dart';
import '../pages/chat_list_page.dart';
import '../pages/create_league_wizard.dart';
import '../pages/league_dashboard_page.dart';
import '../pages/league_library_page.dart';
import '../pages/seed_page.dart';
import '../services/auth_service.dart';
import '../services/chat_service.dart';
import '../services/league_service.dart';
import '../theme/dyne_theme.dart';
import '../utils/env_config.dart';
import '../widgets/dyne_loading.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  final _leagueService = LeagueService();
  final _chatService = ChatService();
  Map<String, DateTime> _leagueAccessTimes = {};

  // Persistent color assignments for dashboard leagues (leagueId -> colorIndex)
  final Map<String, int> _leagueColorAssignments = {};

  // Dev: override game day state
  bool? _gameDayOverride;

  // Matchup card cycling
  int _currentLeagueIndex = 0;
  Timer? _cycleTimer;
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;

  // Game day intensity
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _chatService.saveUserProfile();
    _loadLeagueAccessTimes();

    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeInOut,
    );
    _fadeController.value = 1.0;

    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cycleTimer?.cancel();
    _fadeController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadLeagueAccessTimes();
    }
  }

  void _startCycleTimer(int leagueCount) {
    _cycleTimer?.cancel();
    if (leagueCount <= 1) return;
    _cycleTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _fadeController.reverse().then((_) {
        setState(() {
          _currentLeagueIndex = (_currentLeagueIndex + 1) % leagueCount;
        });
        _fadeController.forward();
      });
    });
  }

  Future<void> _loadLeagueAccessTimes() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    final doc = await FirebaseFirestore.instance
        .collection('users')
        .doc(uid)
        .get();
    final data = doc.data();
    if (data != null && data['leagueAccessTimes'] != null) {
      final raw = Map<String, dynamic>.from(data['leagueAccessTimes']);
      if (mounted) {
        setState(() {
          _leagueAccessTimes = raw.map((key, value) =>
              MapEntry(key, (value as Timestamp).toDate()));
        });
      }
    }
  }

  Future<void> _recordLeagueAccess(String leagueId) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    final now = DateTime.now();
    setState(() {
      _leagueAccessTimes[leagueId] = now;
    });
    await FirebaseFirestore.instance.collection('users').doc(uid).update({
      'leagueAccessTimes.$leagueId': Timestamp.fromDate(now),
    });
  }

  List<League> _sortLeaguesByAccess(List<League> leagues) {
    final sorted = List<League>.from(leagues);
    sorted.sort((a, b) {
      final aTime = _leagueAccessTimes[a.id] ?? DateTime(2000);
      final bTime = _leagueAccessTimes[b.id] ?? DateTime(2000);
      return bTime.compareTo(aTime);
    });
    return sorted;
  }

  /// Assigns a stable color to each league in the displayed set.
  /// Once a league gets a color, it keeps it as long as it's in the top 6.
  /// Removed leagues free up their color slot for new entries.
  void _updateColorAssignments(List<League> displayLeagues) {
    final displayIds = displayLeagues.map((l) => l.id).toSet();

    // Remove assignments for leagues no longer in the top 6
    _leagueColorAssignments.removeWhere((id, _) => !displayIds.contains(id));

    // Assign colors to new leagues that entered the top 6
    for (final league in displayLeagues) {
      if (!_leagueColorAssignments.containsKey(league.id)) {
        final usedIndices = _leagueColorAssignments.values.toSet();
        // Find the first available color index
        int colorIndex = 0;
        while (usedIndices.contains(colorIndex) &&
            colorIndex < _leagueColors.length) {
          colorIndex++;
        }
        _leagueColorAssignments[league.id] =
            colorIndex % _leagueColors.length;
      }
    }
  }

  Color _getLeagueColor(String leagueId) {
    final index = _leagueColorAssignments[leagueId] ?? 0;
    return _leagueColors[index % _leagueColors.length];
  }

  bool get _isGameDay {
    if (_gameDayOverride != null) return _gameDayOverride!;
    final now = DateTime.now();
    // Sunday = 7, Thursday = 4, Monday = 1
    return now.weekday == DateTime.sunday ||
        now.weekday == DateTime.thursday ||
        now.weekday == DateTime.monday;
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('users')
          .doc(user?.uid)
          .snapshots(),
      builder: (context, userDocSnapshot) {
        final userData =
            userDocSnapshot.data?.data() as Map<String, dynamic>? ?? {};
        final username = userData['username'] as String? ?? '';

        return Scaffold(
          body: AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (context, child) {
              return Container(
                decoration: BoxDecoration(
                  gradient: _buildBackgroundGradient(
                      colorScheme, _pulseAnimation.value),
                ),
                child: child,
              );
            },
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildAppBar(user, colorScheme),
                          _buildWelcomeBanner(username, colorScheme),
                          const SizedBox(height: 12),
                          _buildLiveMatchupSection(colorScheme),
                          const SizedBox(height: 16),
                          _buildSectionTitle('My Leagues', theme),
                          const SizedBox(height: 8),
                        ],
                      ),
                    ),
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: _buildLeaguesSection(colorScheme),
                    ),
                  ],
                ),
              ),
            ),
          ),
          floatingActionButton: null,
        );
      },
    );
  }

  LinearGradient _buildBackgroundGradient(
      ColorScheme colorScheme, double pulse) {
    if (_isGameDay) {
      // Game day — pulsing intensity with red/purple energy
      return LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color.lerp(
            const Color(0xFF1A0A1E),
            const Color(0xFF2D0A1A),
            pulse,
          )!,
          Color.lerp(
            const Color(0xFF0E0818),
            const Color(0xFF180A20),
            pulse * 0.7,
          )!,
          Color.lerp(
            const Color(0xFF080A14),
            const Color(0xFF0D0510),
            pulse * 0.4,
          )!,
        ],
        stops: const [0.0, 0.5, 1.0],
      );
    } else {
      // Pre-game calm
      return DyneTheme.landingGradient;
    }
  }

  Widget _buildLiveMatchupSection(ColorScheme colorScheme) {
    return StreamBuilder<List<League>>(
      stream: _leagueService.getUserLeagues(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SizedBox(height: 180);
        }

        final allLeagues = snapshot.data ?? [];
        if (allLeagues.isEmpty) return const SizedBox.shrink();

        // Use the same sorted + capped list as the cards below
        final sorted = _sortLeaguesByAccess(allLeagues);
        final displayLeagues = sorted.length > 6
            ? sorted.sublist(0, 6)
            : sorted;

        // Start or restart the cycle timer
        if (_cycleTimer == null ||
            _currentLeagueIndex >= displayLeagues.length) {
          _currentLeagueIndex =
              Random().nextInt(displayLeagues.length);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _startCycleTimer(displayLeagues.length);
          });
        }

        final league =
            displayLeagues[_currentLeagueIndex % displayLeagues.length];

        return FadeTransition(
          opacity: _fadeAnimation,
          child: GestureDetector(
            onTap: () {
              _recordLeagueAccess(league.id);
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => LeagueDashboardPage(leagueId: league.id),
                ),
              );
            },
            child: _buildMatchupCard(league, colorScheme, displayLeagues.length),
          ),
        );
      },
    );
  }

  Widget _buildMatchupCard(
      League league, ColorScheme colorScheme, int totalLeagues) {
    final accentColor = _getLeagueColor(league.id);

    // Simulated record — will be replaced with real data later
    final random = Random(league.id.hashCode);
    final wins = random.nextInt(10);
    final losses = random.nextInt(10);
    final streak = random.nextInt(5) + 1;
    final isWinStreak = random.nextBool();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: _isGameDay
              ? [
                  accentColor.withValues(alpha: 0.3),
                  const Color(0xFF1A0A1E),
                  const Color(0xFF0F0818),
                ]
              : [
                  accentColor.withValues(alpha: 0.2),
                  const Color(0xFF141829),
                  const Color(0xFF0F1225),
                ],
          stops: const [0.0, 0.5, 1.0],
        ),
        border: Border.all(
          color: _isGameDay
              ? accentColor.withValues(alpha: 0.5)
              : accentColor.withValues(alpha: 0.3),
          width: _isGameDay ? 1.8 : 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: _isGameDay
                ? accentColor.withValues(alpha: 0.3)
                : accentColor.withValues(alpha: 0.15),
            blurRadius: _isGameDay ? 32 : 24,
            offset: const Offset(0, 8),
          ),
          if (_isGameDay)
            BoxShadow(
              color: const Color(0xFFFF2D55).withValues(alpha: 0.08),
              blurRadius: 40,
              spreadRadius: 4,
            ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: _isGameDay
                      ? const Color(0xFFFF2D55).withValues(alpha: 0.2)
                      : accentColor.withValues(alpha: 0.15),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_isGameDay) ...[
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFFFF2D55),
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Text(
                        'GAME DAY',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFFF2D55),
                          letterSpacing: 1,
                        ),
                      ),
                    ] else ...[
                      Icon(Icons.schedule,
                          size: 10, color: accentColor),
                      const SizedBox(width: 4),
                      Text(
                        'PRE-GAME',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: accentColor,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const Spacer(),
              if (totalLeagues > 1)
                Text(
                  '${_currentLeagueIndex + 1}/$totalLeagues',
                  style: TextStyle(
                    fontSize: 10,
                    color: colorScheme.onSurface.withValues(alpha: 0.3),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),

          // League name
          Text(
            league.name,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${league.scoringFormat} • ${league.leagueType}',
            style: TextStyle(
              fontSize: 12,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(height: 16),

          // Season record and streak
          Row(
            children: [
              // Record
              _buildStatPill(
                label: 'RECORD',
                value: '$wins-$losses',
                color: colorScheme.primary,
              ),
              const SizedBox(width: 12),
              // Streak
              _buildStatPill(
                label: 'STREAK',
                value: '${isWinStreak ? "W" : "L"}$streak',
                color: isWinStreak
                    ? const Color(0xFF00E676)
                    : const Color(0xFFFF2D55),
              ),
              const Spacer(),
              // Projected score placeholder
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'PROJ',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface.withValues(alpha: 0.4),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${(random.nextDouble() * 50 + 90).toStringAsFixed(1)}',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: colorScheme.onSurface,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatPill({
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: color.withValues(alpha: 0.7),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }


  Widget _buildAppBar(User? user, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Text(
            'DYNE',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: colorScheme.primary,
              letterSpacing: 4,
            ),
          ),
          const Spacer(),
          // Dev: game day toggle
          if (EnvConfig.isDev)
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: GestureDetector(
                onTap: () {
                  setState(() {
                    if (_gameDayOverride == null) {
                      _gameDayOverride = !_isGameDay;
                    } else {
                      _gameDayOverride = !_gameDayOverride!;
                    }
                  });
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: _isGameDay
                        ? const Color(0xFFFF2D55).withValues(alpha: 0.2)
                        : Colors.white.withValues(alpha: 0.06),
                    border: Border.all(
                      color: _isGameDay
                          ? const Color(0xFFFF2D55).withValues(alpha: 0.5)
                          : Colors.white.withValues(alpha: 0.1),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_isGameDay)
                        Container(
                          width: 5,
                          height: 5,
                          margin: const EdgeInsets.only(right: 4),
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Color(0xFFFF2D55),
                          ),
                        ),
                      Text(
                        _isGameDay ? 'LIVE' : 'PRE',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: _isGameDay
                              ? const Color(0xFFFF2D55)
                              : Colors.white.withValues(alpha: 0.4),
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          // Chat button
          StreamBuilder<Map<String, int>>(
            stream: _chatService.getUnreadCounts(),
            builder: (context, snapshot) {
              final counts = snapshot.data ?? {'dm': 0, 'group': 0};
              final dmCount = counts['dm'] ?? 0;
              final groupCount = counts['group'] ?? 0;

              return GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const ChatListPage()),
                  );
                },
                child: SizedBox(
                  width: 40,
                  height: 40,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Center(
                        child: CircleAvatar(
                          radius: 18,
                          backgroundColor:
                              colorScheme.primary.withValues(alpha: 0.15),
                          child: Icon(Icons.chat_bubble_outlined,
                              size: 18, color: colorScheme.primary),
                        ),
                      ),
                      if (dmCount > 0)
                        Positioned(
                          right: -2,
                          top: -2,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 4, vertical: 1),
                            constraints: const BoxConstraints(
                                minWidth: 16, minHeight: 16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFF00E5),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Center(
                              child: Text(
                                dmCount > 9 ? '9+' : '$dmCount',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ),
                      if (groupCount > 0)
                        Positioned(
                          left: -2,
                          top: -2,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 4, vertical: 1),
                            constraints: const BoxConstraints(
                                minWidth: 16, minHeight: 16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFF9100),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Center(
                              child: Text(
                                groupCount > 9 ? '9+' : '$groupCount',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(width: 10),
          // Profile
          GestureDetector(
            onTap: _showProfileMenu,
            child: CircleAvatar(
              radius: 18,
              backgroundImage: null,
              backgroundColor: colorScheme.primary.withValues(alpha: 0.2),
              child: Icon(Icons.person, size: 20, color: colorScheme.primary),
            ),
          ),
        ],
      ),
    );
  }

  void _showProfileMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF141829),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final user = FirebaseAuth.instance.currentUser;
        final colorScheme = Theme.of(ctx).colorScheme;

        return StreamBuilder<DocumentSnapshot>(
          stream: FirebaseFirestore.instance
              .collection('users')
              .doc(user?.uid)
              .snapshots(),
          builder: (ctx, snapshot) {
            final data =
                snapshot.data?.data() as Map<String, dynamic>? ?? {};
            final username = data['username'] as String? ?? '';

            return Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundImage: null,
                    backgroundColor:
                        colorScheme.primary.withValues(alpha: 0.2),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    username,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  Text(
                    user?.email ?? '',
                    style: TextStyle(
                      fontSize: 14,
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        Navigator.pop(ctx);
                        await AuthService().signOut();
                      },
                      icon: const Icon(Icons.logout),
                      label: const Text('Sign Out'),
                    ),
                  ),
                  if (EnvConfig.isDev) ...[
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton.icon(
                        onPressed: () {
                          Navigator.pop(ctx);
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const SeedPage()),
                          );
                        },
                        icon: Icon(Icons.bug_report,
                            color: colorScheme.onSurface
                                .withValues(alpha: 0.4)),
                        label: Text(
                          'Seed Test Users (Dev)',
                          style: TextStyle(
                            color: colorScheme.onSurface
                                .withValues(alpha: 0.4),
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildWelcomeBanner(String username, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: 'Welcome back, ',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w300,
                    color: colorScheme.onSurface.withValues(alpha: 0.8),
                    letterSpacing: -0.5,
                  ),
                ),
                TextSpan(
                  text: username,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: colorScheme.primary,
                    letterSpacing: -0.5,
                  ),
                ),
                const TextSpan(
                  text: ' 👋',
                  style: TextStyle(fontSize: 26),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _isGameDay ? "It's game day. Let's go." : 'Ready for game day?',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w400,
              color: _isGameDay
                  ? const Color(0xFFFF2D55).withValues(alpha: 0.8)
                  : colorScheme.onSurface.withValues(alpha: 0.5),
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, ThemeData theme) {
    return Text(
      title,
      style: theme.textTheme.headlineMedium?.copyWith(fontSize: 18),
    );
  }

  static const _leagueColors = [
    Color(0xFFCC2244), // dark red
    Color(0xFF00B85E), // dark green
    Color(0xFF1E5FCC), // dark blue
    Color(0xFFCCAA00), // dark gold
    Color(0xFF5C3DBF), // dark purple
    Color(0xFFCC7000), // dark orange
    Color(0xFF00B5CC), // dark cyan
    Color(0xFFBB3060), // dark pink
    Color(0xFF1E9EAA), // dark turquoise
    Color(0xFF8A3A99), // dark orchid
  ];

  Widget _buildLeaguesSection(ColorScheme colorScheme) {
    return StreamBuilder<List<League>>(
      stream: _leagueService.getUserLeagues(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const DyneLoading();
        }

        final leagues = _sortLeaguesByAccess(snapshot.data ?? []);

        if (leagues.isEmpty) {
          return _buildEmptyLeagues(colorScheme);
        }

        final displayLeagues = leagues.length > 6
            ? leagues.sublist(0, 6)
            : leagues;

        _updateColorAssignments(displayLeagues);

        return Column(
          children: [
            ...displayLeagues.map((league) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _buildLeagueCard(league, colorScheme),
            )),
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 8),
              child: GestureDetector(
                onTap: _showLeagueLibrary,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.grid_view_rounded,
                      size: 14,
                      color: colorScheme.primary.withValues(alpha: 0.7),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'View All Leagues',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: colorScheme.primary.withValues(alpha: 0.8),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 11,
                      color: colorScheme.primary.withValues(alpha: 0.5),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildLeagueCard(
      League league, ColorScheme colorScheme) {
    final accentColor = _getLeagueColor(league.id);

    // Pick an icon based on league type
    final IconData leagueIcon;
    switch (league.leagueType) {
      case 'Dynasty':
        leagueIcon = Icons.castle;
      case 'Keeper':
        leagueIcon = Icons.lock;
      case 'Best Ball':
        leagueIcon = Icons.auto_awesome;
      default:
        leagueIcon = Icons.sports_football;
    }

    // Generate consistent data from the league id
    final hash = league.id.hashCode;
    final wins = (hash.abs() % 10);
    final losses = ((hash.abs() >> 4) % 10);
    final rank = (hash.abs() % league.memberIds.length) + 1;
    final projScore = (hash.abs() % 50) + 85;
    final oppScore = (hash.abs() >> 8) % 50 + 80;
    final streak = (hash.abs() >> 6) % 5 + 1;
    final isWinStreak = wins > losses;

    return GestureDetector(
      onTap: () {
        _recordLeagueAccess(league.id);
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => LeagueDashboardPage(leagueId: league.id),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: const Color(0xFF1A1D2E),
          border: Border.all(
            color: accentColor.withValues(alpha: 0.25),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: accentColor.withValues(alpha: _isGameDay ? 0.2 : 0.1),
              blurRadius: _isGameDay ? 16 : 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Left accent bar
            Positioned(
              top: 8,
              bottom: 8,
              left: 0,
              width: 3,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: accentColor,
                ),
              ),
            ),
            // Background watermark
            Positioned(
              right: 10,
              top: -10,
              child: Icon(
                leagueIcon,
                size: 80,
                color: accentColor.withValues(alpha: 0.04),
              ),
            ),
            // Content row
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
              child: Row(
                children: [
                  // Left: icon
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: accentColor.withValues(alpha: 0.12),
                    ),
                    child: Icon(
                      leagueIcon,
                      color: accentColor,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Center: name + meta
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          league.name,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Text(
                              '${league.leagueType} • ${league.scoringFormat}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.white.withValues(alpha: 0.4),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(3),
                                color: (isWinStreak
                                        ? const Color(0xFF4ADE80)
                                        : const Color(0xFFFF6B6B))
                                    .withValues(alpha: 0.12),
                              ),
                              child: Text(
                                '${isWinStreak ? "W" : "L"}$streak',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: isWinStreak
                                      ? const Color(0xFF4ADE80)
                                      : const Color(0xFFFF6B6B),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Right: score + record
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Matchup score
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$projScore',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: projScore > oppScore
                                  ? const Color(0xFF4ADE80)
                                  : Colors.white.withValues(alpha: 0.8),
                            ),
                          ),
                          Text(
                            '-',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white.withValues(alpha: 0.25),
                            ),
                          ),
                          Text(
                            '$oppScore',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Colors.white.withValues(alpha: 0.4),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      // Record + rank
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$wins-$losses',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.5),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '#$rank',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: accentColor,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyLeagues(ColorScheme colorScheme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: const Color(0xFF141829),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        children: [
          Icon(
            Icons.add_circle_outline,
            size: 40,
            color: colorScheme.primary.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 12),
          Text(
            'No leagues yet',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Create or join a league to get started',
            style: TextStyle(
              fontSize: 13,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _showCreateLeagueDialog,
            child: const Text('Create League'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _showJoinLeagueDialog,
            icon: const Icon(Icons.vpn_key_outlined),
            label: const Text('Join League'),
          ),
        ],
      ),
    );
  }

  void _showJoinLeagueDialog() {
    final controller = TextEditingController();
    final colorScheme = Theme.of(context).colorScheme;

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF141829),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: colorScheme.primary.withValues(alpha: 0.2),
            ),
          ),
          title: Text(
            'Join a League',
            style: TextStyle(color: colorScheme.onSurface),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Enter the invite code you received from your league commissioner.',
                style: TextStyle(
                  fontSize: 13,
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                autofocus: true,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'e.g. A3F9KX2BNP4T',
                  hintStyle: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.3),
                  ),
                  filled: true,
                  fillColor: const Color(0xFF0B0E1A),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: colorScheme.primary.withValues(alpha: 0.3),
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: colorScheme.primary.withValues(alpha: 0.3),
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: colorScheme.primary),
                  ),
                  prefixIcon: Icon(
                    Icons.vpn_key_outlined,
                    color: colorScheme.primary,
                  ),
                ),
                style: TextStyle(
                  color: colorScheme.onSurface,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                final code = controller.text.trim();
                if (code.isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await _leagueService.joinLeague(code);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Successfully joined league!')),
                    );
                  }
                } on LeagueException catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.message)),
                    );
                  }
                }
              },
              child: const Text('Join'),
            ),
          ],
        );
      },
    );
  }

  void _showCreateLeagueDialog() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const CreateLeagueWizard()),
    );
  }

  void _showLeagueLibrary() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const LeagueLibraryPage()),
    ).then((_) => _loadLeagueAccessTimes());
  }
}
