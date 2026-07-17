import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models/league.dart';
import '../pages/create_league_wizard.dart';
import '../pages/league_dashboard_page.dart';
import '../services/league_service.dart';
import '../theme/dyne_theme.dart';
import '../widgets/dyne_loading.dart';

class LeagueLibraryPage extends StatefulWidget {
  const LeagueLibraryPage({super.key});

  @override
  State<LeagueLibraryPage> createState() => _LeagueLibraryPageState();
}

class _LeagueLibraryPageState extends State<LeagueLibraryPage> {
  final _leagueService = LeagueService();

  Future<void> _recordLeagueAccess(String leagueId) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    final now = DateTime.now();
    await FirebaseFirestore.instance.collection('users').doc(uid).update({
      'leagueAccessTimes.$leagueId': Timestamp.fromDate(now),
    });
  }

  static const _leagueColors = [
    Color(0xFFFF2D55),
    Color(0xFF00E676),
    Color(0xFF2979FF),
    Color(0xFFFFD600),
    Color(0xFF7C4DFF),
    Color(0xFFFF8F00),
    Color(0xFF00E5FF),
    Color(0xFFEC407A),
    Color(0xFF26C6DA),
    Color(0xFFAB47BC),
  ];

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: DyneTheme.landingGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(colorScheme),
              Expanded(
                child: StreamBuilder<List<League>>(
                  stream: _leagueService.getUserLeagues(),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: DyneLoading());
                    }

                    final leagues = snapshot.data ?? [];

                    if (leagues.isEmpty) {
                      return _buildEmptyState(colorScheme);
                    }

                    return GridView.builder(
                      padding: const EdgeInsets.all(20),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        childAspectRatio: 0.8,
                      ),
                      itemCount: leagues.length,
                      itemBuilder: (context, i) {
                        return _buildLeagueCard(leagues[i], colorScheme, i);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showActions(colorScheme),
        icon: const Icon(Icons.add),
        label: const Text('New'),
      ),
    );
  }

  Widget _buildHeader(ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colorScheme.primary.withValues(alpha: 0.1),
              ),
              child: Icon(
                Icons.arrow_back_ios_new_rounded,
                size: 16,
                color: colorScheme.primary,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            'League Library',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: colorScheme.onSurface,
            ),
          ),
        ],
      ),
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
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              accentColor,
              accentColor.withValues(alpha: 0.7),
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: accentColor.withValues(alpha: 0.35),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: Colors.white.withValues(alpha: 0.2),
                ),
                child: const Icon(
                  Icons.sports_football,
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                league.name,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 2,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 3),
              Text(
                '${league.memberIds.length}/${league.maxMembers}',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: Colors.white.withValues(alpha: 0.75),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(ColorScheme colorScheme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.collections_bookmark_outlined,
            size: 48,
            color: colorScheme.primary.withValues(alpha: 0.4),
          ),
          const SizedBox(height: 16),
          Text(
            'No leagues yet',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Create or join a league to get started',
            style: TextStyle(
              fontSize: 14,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
        ],
      ),
    );
  }

  void _showActions(ColorScheme colorScheme) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF141829),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: Icon(Icons.add_circle_outline,
                      color: colorScheme.primary),
                  title: Text(
                    'Create League',
                    style: TextStyle(color: colorScheme.onSurface),
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const CreateLeagueWizard()),
                    );
                  },
                ),
                ListTile(
                  leading: Icon(Icons.vpn_key_outlined,
                      color: colorScheme.primary),
                  title: Text(
                    'Join League',
                    style: TextStyle(color: colorScheme.onSurface),
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showJoinLeagueDialog();
                  },
                ),
              ],
            ),
          ),
        );
      },
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
          content: TextField(
            controller: controller,
            autofocus: true,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              hintText: 'Enter invite code',
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
}
