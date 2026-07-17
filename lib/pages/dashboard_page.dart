import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models/league.dart';
import '../pages/chat_list_page.dart';
import '../pages/create_league_wizard.dart';
import '../pages/league_dashboard_page.dart';
import '../pages/seed_page.dart';
import '../services/auth_service.dart';
import '../services/chat_service.dart';
import '../services/league_service.dart';
import '../theme/dyne_theme.dart';
import '../widgets/dyne_loading.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final _leagueService = LeagueService();
  final _chatService = ChatService();
  int _leaguePage = 0;
  Map<String, DateTime> _leagueAccessTimes = {};

  @override
  void initState() {
    super.initState();
    _chatService.saveUserProfile();
    _loadLeagueAccessTimes();
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
      setState(() {
        _leagueAccessTimes = raw.map((key, value) =>
            MapEntry(key, (value as Timestamp).toDate()));
      });
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
      return bTime.compareTo(aTime); // Most recent first
    });
    return sorted;
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
          body: Container(
            decoration: BoxDecoration(gradient: DyneTheme.landingGradient),
            child: SafeArea(
              child: Column(
                children: [
                  _buildAppBar(user, colorScheme),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildWelcomeBanner(username, colorScheme),
                          const SizedBox(height: 24),
                          _buildSectionTitle('My Leagues', theme),
                          const SizedBox(height: 12),
                          _buildLeaguesSection(colorScheme),
                          const SizedBox(height: 24),
                          _buildSectionTitle('This Week', theme),
                          const SizedBox(height: 12),
                          _buildMatchupPlaceholder(colorScheme),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          floatingActionButton: _buildChatFab(colorScheme),
        );
      },
    );
  }

  Widget _buildAppBar(User? user, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
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

  Widget _buildChatFab(ColorScheme colorScheme) {
    return StreamBuilder<Map<String, int>>(
      stream: _chatService.getUnreadCounts(),
      builder: (context, snapshot) {
        final counts = snapshot.data ?? {'dm': 0, 'group': 0};
        final dmCount = counts['dm'] ?? 0;
        final groupCount = counts['group'] ?? 0;

        return SizedBox(
          width: 60,
          height: 60,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              FloatingActionButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const ChatListPage()),
                  );
                },
                backgroundColor: colorScheme.primary,
                elevation: 6,
                child: const Icon(
                  Icons.chat_bubble_rounded,
                  color: Colors.black,
                  size: 26,
                ),
              ),
              if (dmCount > 0)
                Positioned(
                  right: -2,
                  top: -2,
                  child: _UnreadBadge(
                    count: dmCount,
                    color: const Color(0xFFFF00E5), // Neon pink for DMs
                  ),
                ),
              if (groupCount > 0)
                Positioned(
                  left: -2,
                  top: -2,
                  child: _UnreadBadge(
                    count: groupCount,
                    color: const Color(0xFFFF9100),
                  ),
                ),
            ],
          ),
        );
      },
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: [
            colorScheme.primary.withValues(alpha: 0.15),
            colorScheme.secondary.withValues(alpha: 0.05),
          ],
        ),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Welcome back, $username 👋',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Ready for game day?',
            style: TextStyle(
              fontSize: 14,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
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
    Color(0xFFFF2D55), // neon red
    Color(0xFF00E676), // neon green
    Color(0xFF2979FF), // neon blue
    Color(0xFFFFD600), // neon gold
    Color(0xFF7C4DFF), // neon purple
    Color(0xFFFF8F00), // neon orange
    Color(0xFF00E5FF), // neon cyan
    Color(0xFFEC407A), // hot pink
    Color(0xFF26C6DA), // turquoise
    Color(0xFFAB47BC), // orchid
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

        final totalPages = (leagues.length / 5).ceil();
        final start = _leaguePage * 5;
        final end = (start + 5).clamp(0, leagues.length);
        final pageLeagues = leagues.sublist(start, end);

        return Column(
          children: [
            ...pageLeagues.asMap().entries.map((entry) {
              final globalIndex = start + entry.key;
              return _buildLeagueCard(
                  entry.value, colorScheme, globalIndex);
            }),
            if (totalPages > 1) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (_leaguePage > 0)
                    GestureDetector(
                      onTap: () => setState(() => _leaguePage--),
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: colorScheme.primary.withValues(alpha: 0.1),
                        ),
                        child: Icon(Icons.chevron_left,
                            size: 18, color: colorScheme.primary),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      '${_leaguePage + 1} / $totalPages',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                  ),
                  if (_leaguePage < totalPages - 1)
                    GestureDetector(
                      onTap: () => setState(() => _leaguePage++),
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: colorScheme.primary.withValues(alpha: 0.1),
                        ),
                        child: Icon(Icons.chevron_right,
                            size: 18, color: colorScheme.primary),
                      ),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _showJoinLeagueDialog,
                    icon: const Icon(Icons.vpn_key_outlined, size: 18),
                    label: const Text('Join'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _showCreateLeagueDialog,
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Create'),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _buildLeagueCard(
      League league, ColorScheme colorScheme, int index) {
    final accentColor = _leagueColors[index % _leagueColors.length];

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
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: accentColor.withValues(alpha: 0.08),
          border: Border.all(
            color: accentColor.withValues(alpha: 0.35),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: accentColor.withValues(alpha: 0.2),
              ),
              child: Icon(
                Icons.sports_football,
                color: accentColor,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    league.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${league.leagueType} • ${league.memberIds.length}/${league.maxMembers}',
                    style: TextStyle(
                      fontSize: 11,
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: accentColor.withValues(alpha: 0.7),
              size: 20,
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

  Widget _buildMatchupPlaceholder(ColorScheme colorScheme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF141829),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.1),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.sports_football,
            color: colorScheme.primary.withValues(alpha: 0.4),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'No matchups scheduled. Join a league to see your weekly matchup.',
              style: TextStyle(
                fontSize: 13,
                color: colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge({required this.count, required this.color});

  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Center(
        child: Text(
          count > 9 ? '9+' : '$count',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
