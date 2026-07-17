import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/league.dart';
import '../services/draft_service.dart';
import '../services/league_service.dart';
import '../services/seed_league_data.dart';
import '../theme/dyne_theme.dart';
import '../utils/env_config.dart';
import '../utils/team_defaults.dart';
import '../widgets/dyne_loading.dart';
import 'edit_team_modal.dart';

class LeagueSettingsPage extends StatefulWidget {
  const LeagueSettingsPage({super.key, required this.leagueId});

  final String leagueId;

  @override
  State<LeagueSettingsPage> createState() => _LeagueSettingsPageState();
}

class _LeagueSettingsPageState extends State<LeagueSettingsPage> {
  int _selectedTab = 0;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: DyneTheme.landingGradient),
        child: SafeArea(
          child: StreamBuilder<League>(
            stream: LeagueService().streamLeague(widget.leagueId),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const DyneLoading();
              }

              if (!snapshot.hasData) {
                return Center(
                  child: Text('League not found',
                      style: TextStyle(color: colorScheme.onSurface)),
                );
              }

              final league = snapshot.data!;
              final isCommissioner = FirebaseAuth.instance.currentUser?.uid ==
                  league.commissionerId;

              return Column(
                children: [
                  _buildHeader(context, colorScheme),
                  _buildTabBar(colorScheme, isCommissioner),
                  Expanded(
                      child: _buildSelectedTab(
                          league, colorScheme, isCommissioner)),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildSelectedTab(
      League league, ColorScheme colorScheme, bool isCommissioner) {
    switch (_selectedTab) {
      case 0:
        return _buildLeagueSettingsTab(league, colorScheme);
      case 1:
        return _buildTeamSettingsTab(league, colorScheme);
      case 2:
        if (isCommissioner) {
          return _buildCommishSettingsTab(league, colorScheme);
        }
        return _buildLeagueSettingsTab(league, colorScheme);
      default:
        return _buildLeagueSettingsTab(league, colorScheme);
    }
  }

  Widget _buildHeader(BuildContext context, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colorScheme.onSurface.withValues(alpha: 0.1),
              ),
              child: Icon(Icons.arrow_back,
                  color: colorScheme.onSurface, size: 18),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            'Settings',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar(ColorScheme colorScheme, bool isCommissioner) {
    final tabs = ['League', 'Team'];
    if (isCommissioner) tabs.add('Commish');

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: const Color(0xFF141829),
      ),
      child: Row(
        children: tabs.asMap().entries.map((entry) {
          final index = entry.key;
          final label = entry.value;
          final isSelected = _selectedTab == index;

          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedTab = index),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: isSelected
                      ? colorScheme.primary.withValues(alpha: 0.2)
                      : Colors.transparent,
                ),
                child: Center(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: isSelected
                          ? colorScheme.primary
                          : colorScheme.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ─── League Settings Tab ─────────────────────────────────────────

  Widget _buildLeagueSettingsTab(League league, ColorScheme colorScheme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          _buildSection(
            title: 'General',
            colorScheme: colorScheme,
            children: [
              _buildSettingTile('League Name', league.name, colorScheme),
              _buildSettingTile('League Type', league.leagueType, colorScheme),
              _buildSettingTile('Teams', '${league.maxMembers}', colorScheme),
              _buildSettingTile('Invite Code', league.inviteCode, colorScheme),
            ],
          ),
          const SizedBox(height: 16),
          _buildSection(
            title: 'Scoring',
            colorScheme: colorScheme,
            children: [
              _buildSettingTile('Format', league.scoringFormat, colorScheme),
              ...league.scoringValues.entries
                  .where((e) => league.scoringEnabled[e.key] == true)
                  .map((e) => _buildSettingTile(
                      e.key,
                      e.value.toStringAsFixed(
                          e.value.truncateToDouble() == e.value ? 0 : 2),
                      colorScheme)),
            ],
          ),
          const SizedBox(height: 16),
          _buildSection(
            title: 'Roster',
            colorScheme: colorScheme,
            children: [
              _buildSettingTile('Style', league.rosterPreset, colorScheme),
              ...league.rosterSlots.entries.where((e) => e.value > 0).map(
                  (e) => _buildSettingTile(e.key, '${e.value}', colorScheme)),
            ],
          ),
          const SizedBox(height: 16),
          _buildSection(
            title: 'Draft',
            colorScheme: colorScheme,
            children: [
              _buildSettingTile('Draft Type', league.draftType, colorScheme),
              _buildSettingTile('Round Mode', league.roundMode, colorScheme),
              _buildSettingTile('Rounds', '${league.roundCount}', colorScheme),
            ],
          ),
          const SizedBox(height: 16),
          _buildSection(
            title: 'Season',
            colorScheme: colorScheme,
            children: [
              _buildSettingTile('Regular Season',
                  '${league.regularSeasonWeeks} weeks', colorScheme),
              _buildSettingTile(
                  'Playoff Teams', '${league.playoffTeams}', colorScheme),
              _buildSettingTile(
                  'Trade Deadline', league.tradeDeadline, colorScheme),
            ],
          ),
          const SizedBox(height: 16),
          _buildSection(
            title: 'Waivers',
            colorScheme: colorScheme,
            children: [
              _buildSettingTile('Format', league.waiverFormat, colorScheme),
              if (league.waiverFormat == 'FAAB')
                _buildSettingTile(
                    'FAAB Budget', '\$${league.faabBudget}', colorScheme),
              _buildSettingTile('Min Roster Size',
                  '${league.minimumRosterSize}', colorScheme),
            ],
          ),
          const SizedBox(height: 16),
          _buildSection(
            title: 'Features',
            colorScheme: colorScheme,
            children: [
              _buildToggleTile('Salaries', league.salariesEnabled, colorScheme),
              _buildToggleTile(
                  'Contracts', league.contractsEnabled, colorScheme),
              _buildToggleTile('Schemes', league.schemesEnabled, colorScheme),
              _buildToggleTile(
                  'Practice Squad', league.practiceSquadEnabled, colorScheme),
              if (league.practiceSquadEnabled)
                _buildSettingTile(
                    'PS Size', '${league.practiceSquadSize}', colorScheme),
              _buildToggleTile(
                  'PS Stealing', league.practiceSquadStealing, colorScheme),
              _buildToggleTile(
                  'College Scouting', league.scoutCollegePlayers, colorScheme),
              _buildToggleTile(
                  'AI Negotiations', league.contractNegotiations, colorScheme),
            ],
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  // ─── Team Settings Tab ───────────────────────────────────────────

  Widget _buildTeamSettingsTab(League league, ColorScheme colorScheme) {
    final uid = FirebaseAuth.instance.currentUser?.uid;

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('teams')
          .doc(uid)
          .snapshots(),
      builder: (context, snapshot) {
        final teamData = snapshot.data?.data() as Map<String, dynamic>? ?? {};
        final teamName = teamData['name'] as String? ?? 'Not set';
        final abbreviation = teamData['abbreviation'] as String? ?? '--';
        final primaryColor = teamData['primaryColor'] != null
            ? Color(teamData['primaryColor'] as int)
            : colorScheme.primary;
        final secondaryColor = teamData['secondaryColor'] != null
            ? Color(teamData['secondaryColor'] as int)
            : const Color(0xFF141829);
        final iconIndex = teamData['iconIndex'] as int? ?? 0;

        const iconOptions = [
          Icons.sports_football,
          Icons.flash_on,
          Icons.whatshot,
          Icons.pets,
          Icons.shield,
          Icons.bolt,
          Icons.rocket_launch,
          Icons.star,
          Icons.diamond,
          Icons.tsunami,
          Icons.thunderstorm,
          Icons.local_fire_department,
        ];

        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              // Team identity preview
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: secondaryColor.withValues(alpha: 0.4),
                  border:
                      Border.all(color: primaryColor.withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [
                            primaryColor,
                            primaryColor.withValues(alpha: 0.6)
                          ],
                        ),
                      ),
                      child: Icon(
                        iconOptions[iconIndex.clamp(0, iconOptions.length - 1)],
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            teamName,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: colorScheme.onSurface,
                            ),
                          ),
                          Text(
                            abbreviation,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.5,
                              color: primaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _showEditTeamModal(context, teamData),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: colorScheme.primary.withValues(alpha: 0.15),
                        ),
                        child: Icon(Icons.edit,
                            size: 16, color: colorScheme.primary),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _buildSection(
                title: 'My Team',
                colorScheme: colorScheme,
                children: [
                  _buildSettingTile('Team Name', teamName, colorScheme),
                  _buildSettingTile('Abbreviation', abbreviation, colorScheme),
                  _buildSettingTile(
                      'Primary Color', _colorName(primaryColor), colorScheme),
                  _buildSettingTile('Secondary Color',
                      _colorName(secondaryColor), colorScheme),
                ],
              ),
              const SizedBox(height: 16),
              _buildSection(
                title: 'Notifications',
                colorScheme: colorScheme,
                children: [
                  _buildToggleTile('Trade Offers', true, colorScheme),
                  _buildToggleTile('Waiver Results', true, colorScheme),
                  _buildToggleTile('Matchup Reminders', true, colorScheme),
                  _buildToggleTile('Draft Alerts', true, colorScheme),
                  _buildToggleTile('League Chat', false, colorScheme),
                ],
              ),
              const SizedBox(height: 16),
              _buildSection(
                title: 'Draft Preferences',
                colorScheme: colorScheme,
                children: [
                  _buildSettingTile(
                      'Auto-Draft Strategy', 'Best Available', colorScheme),
                  _buildSettingTile(
                      'Pre-Draft Queue', '0 players queued', colorScheme),
                ],
              ),
              if (league.schemesEnabled) ...[
                const SizedBox(height: 16),
                _buildSection(
                  title: 'Scheme',
                  colorScheme: colorScheme,
                  children: [
                    _buildSettingTile(
                        'Offensive Scheme', 'Not selected', colorScheme),
                    _buildSettingTile(
                        'Defensive Scheme', 'Not selected', colorScheme),
                  ],
                ),
              ],
              const SizedBox(height: 32),
            ],
          ),
        );
      },
    );
  }

  String _colorName(Color color) {
    const colorNames = {
      0xFFFFFFFF: 'White',
      0xFF000000: 'Black',
      0xFFFF2D55: 'Red',
      0xFF00E676: 'Green',
      0xFF2979FF: 'Blue',
      0xFFFFD600: 'Gold',
      0xFF7C4DFF: 'Purple',
      0xFFFF8F00: 'Orange',
      0xFF00E5FF: 'Cyan',
      0xFFEC407A: 'Pink',
      0xFF26C6DA: 'Turquoise',
      0xFFAB47BC: 'Orchid',
      0xFFFF5252: 'Coral',
      0xFF69F0AE: 'Mint',
      0xFF448AFF: 'Sky Blue',
      0xFFFFFF00: 'Yellow',
      0xFFE040FB: 'Magenta',
      0xFFFF6D00: 'Amber',
    };
    return colorNames[color.toARGB32()] ??
        '#${color.toARGB32().toRadixString(16).substring(2).toUpperCase()}';
  }

  void _showDraftSettingsModal(
      BuildContext context, League league, ColorScheme colorScheme) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF141829),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _DraftSettingsSheet(
        leagueId: widget.leagueId,
        league: league,
      ),
    );
  }

  void _showEditTeamModal(BuildContext context, Map<String, dynamic> teamData) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.9,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        expand: false,
        builder: (_, controller) => EditTeamModal(
          leagueId: widget.leagueId,
          currentData: teamData,
        ),
      ),
    );
  }

  // ─── Commish Settings Tab ────────────────────────────────────────

  Widget _buildCommishSettingsTab(League league, ColorScheme colorScheme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          _buildSection(
            title: 'Commissioner Tools',
            colorScheme: colorScheme,
            children: [
              _buildActionTile(
                Icons.edit,
                'Edit League Settings',
                'Modify scoring, roster, and season settings',
                colorScheme,
                onTap: () {},
              ),
              _buildActionTile(
                Icons.person_remove,
                'Manage Members',
                'Remove or ban members from the league',
                colorScheme,
                onTap: () =>
                    _showManageMembersModal(context, league, colorScheme),
              ),
              _buildActionTile(
                Icons.swap_horiz,
                'Force Trade',
                'Push through or veto a trade',
                colorScheme,
                onTap: () {},
              ),
              _buildActionTile(
                Icons.add_circle_outline,
                'Add Player to Team',
                'Manually assign a player to a roster',
                colorScheme,
                onTap: () {},
              ),
              _buildActionTile(
                Icons.schedule,
                'Set Draft Time',
                'Schedule or reschedule the league draft',
                colorScheme,
                onTap: () {},
              ),
              _buildActionTile(
                Icons.timer_outlined,
                'Draft Settings',
                'Pick timer, sleep mode, and draft order',
                colorScheme,
                onTap: () =>
                    _showDraftSettingsModal(context, league, colorScheme),
              ),
              if (EnvConfig.isDev)
                _buildActionTile(
                  Icons.bug_report,
                  'Seed Test Data (Dev)',
                  'Add dummy members, chat messages, and DMs',
                  colorScheme,
                  onTap: () async {
                    await SeedLeagueData.seed(widget.leagueId);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Test data seeded!')),
                      );
                    }
                  },
                ),
            ],
          ),
          const SizedBox(height: 16),
          _buildSection(
            title: 'Season Control',
            colorScheme: colorScheme,
            children: [
              _buildActionTile(
                Icons.pause_circle_outline,
                'Pause Season',
                'Temporarily halt all league activity',
                colorScheme,
                onTap: () {},
              ),
              _buildActionTile(
                Icons.refresh,
                'Reset Draft',
                'Clear all picks and restart the draft',
                colorScheme,
                onTap: () => _confirmResetDraft(colorScheme),
              ),
              _buildActionTile(
                Icons.lock_outline,
                'Lock Rosters',
                'Prevent all roster changes league-wide',
                colorScheme,
                onTap: () {},
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildDangerZone(colorScheme),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  // ─── Shared Widgets ──────────────────────────────────────────────

  Widget _buildSection({
    required String title,
    required ColorScheme colorScheme,
    required List<Widget> children,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141829),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.12),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
              color: colorScheme.primary,
            ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _buildSettingTile(
      String label, String value, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildToggleTile(String label, bool enabled, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: enabled
                  ? const Color(0xFF00E676).withValues(alpha: 0.15)
                  : const Color(0xFFFF2D55).withValues(alpha: 0.1),
            ),
            child: Text(
              enabled ? 'ON' : 'OFF',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color:
                    enabled ? const Color(0xFF00E676) : const Color(0xFFFF2D55),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile(
    IconData icon,
    String title,
    String subtitle,
    ColorScheme colorScheme, {
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: colorScheme.primary.withValues(alpha: 0.1),
              ),
              child: Icon(icon, size: 18, color: colorScheme.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 11,
                      color: colorScheme.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right,
                size: 18, color: colorScheme.onSurface.withValues(alpha: 0.3)),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmResetDraft(ColorScheme colorScheme) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF141829),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded,
                color: const Color(0xFFFF2D55), size: 24),
            const SizedBox(width: 10),
            Text(
              'Reset Draft',
              style: TextStyle(
                color: colorScheme.onSurface,
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
          ],
        ),
        content: Text(
          'This will delete all picks, draft chat messages, and queues. The draft will need to be started again from scratch.\n\nThis action cannot be undone.',
          style: TextStyle(
            color: colorScheme.onSurface.withValues(alpha: 0.7),
            fontSize: 14,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Cancel',
              style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.5)),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFF2D55),
              foregroundColor: Colors.white,
            ),
            child: const Text('Reset Draft',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        final draftService = DraftService(widget.leagueId);
        await draftService.resetDraft();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Draft has been reset successfully.'),
              backgroundColor: Color(0xFF00E676),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to reset draft: $e'),
              backgroundColor: const Color(0xFFFF2D55),
            ),
          );
        }
      }
    }
  }

  Widget _buildDangerZone(ColorScheme colorScheme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFFFF2D55).withValues(alpha: 0.05),
        border: Border.all(
          color: const Color(0xFFFF2D55).withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'DANGER ZONE',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
              color: Color(0xFFFF2D55),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'These actions are irreversible and affect all league members.',
            style: TextStyle(
              fontSize: 12,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _showDeleteConfirmation(context),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFFF2D55),
                side: const BorderSide(color: Color(0xFFFF2D55)),
              ),
              icon: const Icon(Icons.delete_outline, size: 18),
              label: const Text('Delete League'),
            ),
          ),
        ],
      ),
    );
  }

  void _showDeleteConfirmation(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        final colorScheme = Theme.of(ctx).colorScheme;
        bool isDeleting = false;

        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF141829),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              title: Text(
                'Delete League?',
                style: TextStyle(color: colorScheme.onSurface),
              ),
              content: Text(
                'This will permanently delete the league and all associated data. This cannot be undone.',
                style: TextStyle(
                  fontSize: 13,
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isDeleting ? null : () => Navigator.pop(ctx),
                  child: Text(
                    'Cancel',
                    style: TextStyle(
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: isDeleting
                      ? null
                      : () async {
                          setDialogState(() => isDeleting = true);
                          // Close the dialog immediately
                          if (ctx.mounted) Navigator.pop(ctx);
                          // Navigate back to root
                          if (context.mounted) {
                            Navigator.of(context)
                                .popUntil((route) => route.isFirst);
                          }
                          // Fire the delete in the background
                          LeagueService().deleteLeague(widget.leagueId);
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF2D55),
                  ),
                  child: isDeleting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Delete'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showManageMembersModal(
      BuildContext context, League league, ColorScheme colorScheme) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF141829),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.75,
          maxChildSize: 0.9,
          minChildSize: 0.5,
          expand: false,
          builder: (ctx, scrollController) {
            return _ManageMembersSheet(
              league: league,
              leagueId: widget.leagueId,
              scrollController: scrollController,
            );
          },
        );
      },
    );
  }
}

class _ManageMembersSheet extends StatefulWidget {
  const _ManageMembersSheet({
    required this.league,
    required this.leagueId,
    required this.scrollController,
  });

  final League league;
  final String leagueId;
  final ScrollController scrollController;

  @override
  State<_ManageMembersSheet> createState() => _ManageMembersSheetState();
}

class _ManageMembersSheetState extends State<_ManageMembersSheet> {
  final _leagueService = LeagueService();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return StreamBuilder<League>(
      stream: LeagueService().streamLeague(widget.leagueId),
      initialData: widget.league,
      builder: (context, snapshot) {
        final league = snapshot.data ?? widget.league;

        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(2),
                    color: colorScheme.onSurface.withValues(alpha: 0.2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Manage Members',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '3 strikes and they\'re out',
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.builder(
                  controller: widget.scrollController,
                  itemCount: league.maxMembers,
                  itemBuilder: (context, index) {
                    final hasUser = index < league.memberIds.length;
                    final memberId = hasUser ? league.memberIds[index] : null;
                    final isCommissioner = memberId == league.commissionerId;
                    final strikes = memberId != null
                        ? (league.memberStrikes[memberId] ?? 0)
                        : 0;
                    final isAi = memberId != null
                        ? league.aiTeams.contains(memberId)
                        : true; // Default empty slots to AI

                    return _buildMemberTile(
                      context,
                      memberId: memberId,
                      index: index,
                      isCommissioner: isCommissioner,
                      strikes: strikes,
                      isAi: isAi,
                      hasUser: hasUser,
                      colorScheme: colorScheme,
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMemberTile(
    BuildContext context, {
    required String? memberId,
    required int index,
    required bool isCommissioner,
    required int strikes,
    required bool isAi,
    required bool hasUser,
    required ColorScheme colorScheme,
  }) {
    if (memberId == null) {
      return _buildEmptySlotTile(index, colorScheme);
    }

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('teams')
          .doc(memberId)
          .snapshots(),
      builder: (context, teamSnap) {
        final teamData = teamSnap.data?.data() as Map<String, dynamic>? ?? {};
        final teamName = teamData['name'] as String? ?? 'Team ${index + 1}';
        final abbreviation = teamData['abbreviation'] as String? ?? '';
        final primaryColor = teamData['primaryColor'] != null
            ? Color(teamData['primaryColor'] as int)
            : TeamDefaults
                .colorOptions[index % TeamDefaults.colorOptions.length];
        final secondaryColor = teamData['secondaryColor'] != null
            ? Color(teamData['secondaryColor'] as int)
            : const Color(0xFF0B0E1A);
        final iconIndex = teamData['iconIndex'] as int? ?? 0;

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: const Color(0xFF0B0E1A),
            border: Border.all(
              color: primaryColor.withValues(alpha: 0.15),
            ),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [
                          primaryColor,
                          primaryColor.withValues(alpha: 0.7)
                        ],
                      ),
                    ),
                    child: Icon(
                      TeamDefaults.iconOptions[iconIndex.clamp(
                          0, TeamDefaults.iconOptions.length - 1)],
                      size: 20,
                      color: secondaryColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                teamName,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurface,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (isAi) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  color: const Color(0xFF7C4DFF)
                                      .withValues(alpha: 0.2),
                                ),
                                child: const Text(
                                  'AI',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF7C4DFF),
                                  ),
                                ),
                              ),
                            ],
                            if (isCommissioner) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  color: const Color(0xFFFF8F00)
                                      .withValues(alpha: 0.2),
                                ),
                                child: const Text(
                                  'COMMISH',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFFFF8F00),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            if (abbreviation.isNotEmpty) ...[
                              Text(
                                abbreviation,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1,
                                  color: primaryColor.withValues(alpha: 0.7),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            ...List.generate(3, (i) {
                              return Padding(
                                padding: const EdgeInsets.only(right: 3),
                                child: Icon(
                                  Icons.warning_rounded,
                                  size: 12,
                                  color: i < strikes
                                      ? const Color(0xFFFF2D55)
                                      : colorScheme.onSurface
                                          .withValues(alpha: 0.15),
                                ),
                              );
                            }),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (!isCommissioner) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    if (hasUser && !isAi) ...[
                      Expanded(
                        child: _buildMemberAction(
                          icon: Icons.warning_amber_rounded,
                          label: 'Strike',
                          color: const Color(0xFFFF8F00),
                          onTap: () async {
                            await _leagueService.giveStrike(
                                widget.leagueId, memberId);
                            if (context.mounted) {
                              final newStrikes = strikes + 1;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(newStrikes >= 3
                                      ? 'Member removed (3 strikes)'
                                      : 'Strike $newStrikes issued'),
                                ),
                              );
                              if (newStrikes >= 3) Navigator.pop(context);
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      child: _buildMemberAction(
                        icon: isAi ? Icons.swap_horiz : Icons.smart_toy,
                        label: isAi ? 'Swap for User' : 'Set AI',
                        color: const Color(0xFF7C4DFF),
                        onTap: () async {
                          if (isAi) {
                            _showSwapBotDialog(context, memberId, colorScheme);
                          } else {
                            await _leagueService.toggleAiTeam(
                                widget.leagueId, memberId, true);
                          }
                        },
                      ),
                    ),
                    if (hasUser && !isAi) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildMemberAction(
                          icon: Icons.person_remove,
                          label: 'Remove',
                          color: const Color(0xFFFF2D55),
                          onTap: () =>
                              _confirmRemove(context, memberId, colorScheme),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptySlotTile(int index, ColorScheme colorScheme) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF0B0E1A),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.05),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: colorScheme.onSurface.withValues(alpha: 0.05),
            ),
            child: Icon(
              Icons.person_outline,
              size: 20,
              color: colorScheme.onSurface.withValues(alpha: 0.2),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            'Open Slot ${index + 1}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: colorScheme.onSurface.withValues(alpha: 0.3),
            ),
          ),
        ],
      ),
    );
  }

  void _showSwapBotDialog(
      BuildContext context, String botId, ColorScheme colorScheme) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF141829),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(Icons.swap_horiz, color: const Color(0xFF7C4DFF), size: 24),
            const SizedBox(width: 10),
            Text(
              'Replace Bot',
              style: TextStyle(
                color: colorScheme.onSurface,
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'A user joining with your league invite code will automatically replace an AI bot.\n\nOr you can share the invite code directly:',
              style: TextStyle(
                color: colorScheme.onSurface.withValues(alpha: 0.7),
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            FutureBuilder<League>(
              future: LeagueService().getLeague(widget.leagueId),
              builder: (context, snap) {
                if (!snap.hasData) return const SizedBox.shrink();
                final code = snap.data!.inviteCode;
                return Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: const Color(0xFF0B0E1A),
                    border: Border.all(
                      color: colorScheme.primary.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          code,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2,
                            color: colorScheme.primary,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          Clipboard.setData(ClipboardData(text: code));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Invite code copied!')),
                          );
                        },
                        child: Icon(Icons.copy,
                            size: 20, color: colorScheme.primary),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Done',
              style: TextStyle(color: colorScheme.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMemberAction({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: color.withValues(alpha: 0.1),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmRemove(
      BuildContext context, String memberId, ColorScheme colorScheme) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF141829),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(
            'Remove Member?',
            style: TextStyle(color: colorScheme.onSurface),
          ),
          content: Text(
            'This will immediately remove this member from the league.',
            style: TextStyle(
              fontSize: 13,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
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
                Navigator.pop(ctx);
                await _leagueService.removeMember(widget.leagueId, memberId);
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Member removed')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF2D55),
              ),
              child: const Text('Remove'),
            ),
          ],
        );
      },
    );
  }
}

class _DraftSettingsSheet extends StatefulWidget {
  const _DraftSettingsSheet({
    required this.leagueId,
    required this.league,
  });

  final String leagueId;
  final League league;

  @override
  State<_DraftSettingsSheet> createState() => _DraftSettingsSheetState();
}

class _DraftSettingsSheetState extends State<_DraftSettingsSheet> {
  late int _pickTimer;
  late bool _sleepModeEnabled;
  late String _sleepStart;
  late String _sleepEnd;
  bool _isSaving = false;
  int _randomizeCount = 0;
  bool _isRandomizing = false;

  static const _timerOptions = [
    15,
    30,
    45,
    60,
    90,
    120,
    180,
    300,
    600,
    900,
    1800,
    3600,
    7200,
    14400,
    28800,
    43200,
    86400,
  ];

  @override
  void initState() {
    super.initState();
    _pickTimer = widget.league.pickTimerSeconds;
    _sleepModeEnabled = widget.league.sleepModeEnabled;
    _sleepStart = widget.league.sleepModeStart;
    _sleepEnd = widget.league.sleepModeEnd;
  }

  String _formatTimer(int seconds) {
    if (seconds >= 86400) return '${seconds ~/ 86400}d';
    if (seconds >= 3600) return '${seconds ~/ 3600}h';
    if (seconds >= 60) return '${seconds ~/ 60}m';
    return '${seconds}s';
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      await FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .update({
        'pickTimerSeconds': _pickTimer,
        'sleepModeEnabled': _sleepModeEnabled,
        'sleepModeStart': _sleepStart,
        'sleepModeEnd': _sleepEnd,
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e')),
        );
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _randomizeDraftOrder() async {
    setState(() => _isRandomizing = true);
    try {
      final leagueRef =
          FirebaseFirestore.instance.collection('leagues').doc(widget.leagueId);
      final doc = await leagueRef.get();
      final data = doc.data() ?? {};
      final memberIds = List<String>.from(data['memberIds'] ?? []);

      memberIds.shuffle();

      await leagueRef.update({'memberIds': memberIds});
      setState(() {
        _randomizeCount++;
        _isRandomizing = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to randomize: $e')),
        );
        setState(() => _isRandomizing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: colorScheme.onSurface.withValues(alpha: 0.2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Draft Settings',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Configure pick timer, sleep mode, and draft order',
              style: TextStyle(
                fontSize: 13,
                color: colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(height: 24),

            // ─── Randomize Draft Order ───────────────────────────
            Text('Draft Order',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface.withValues(alpha: 0.7),
                )),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: const Color(0xFF0B0E1A),
                border: Border.all(
                  color: colorScheme.primary.withValues(alpha: 0.15),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Icon(Icons.shuffle_rounded,
                          size: 20, color: colorScheme.primary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Randomize Order',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurface,
                                )),
                            Text(
                              'Shuffle the draft pick order',
                              style: TextStyle(
                                fontSize: 11,
                                color: colorScheme.onSurface
                                    .withValues(alpha: 0.4),
                              ),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: _isRandomizing ? null : _randomizeDraftOrder,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            color: colorScheme.primary.withValues(alpha: 0.15),
                            border: Border.all(
                              color: colorScheme.primary.withValues(alpha: 0.4),
                            ),
                          ),
                          child: _isRandomizing
                              ? SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: colorScheme.primary,
                                  ),
                                )
                              : Text(
                                  'Shuffle',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: colorScheme.primary,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                  if (_randomizeCount > 0) ...[
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(6),
                        color: const Color(0xFF00E676).withValues(alpha: 0.1),
                      ),
                      child: Text(
                        'Randomized $_randomizeCount ${_randomizeCount == 1 ? 'time' : 'times'}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF00E676),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ─── Pick Timer ──────────────────────────────────────
            Text('Pick Timer',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface.withValues(alpha: 0.7),
                )),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _timerOptions.map((secs) {
                final isSelected = _pickTimer == secs;
                return GestureDetector(
                  onTap: () => setState(() => _pickTimer = secs),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: isSelected
                          ? colorScheme.primary.withValues(alpha: 0.2)
                          : const Color(0xFF0B0E1A),
                      border: Border.all(
                        color: isSelected
                            ? colorScheme.primary
                            : colorScheme.primary.withValues(alpha: 0.15),
                      ),
                    ),
                    child: Text(
                      _formatTimer(secs),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight:
                            isSelected ? FontWeight.w700 : FontWeight.normal,
                        color: isSelected
                            ? colorScheme.primary
                            : colorScheme.onSurface.withValues(alpha: 0.6),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // ─── Sleep Mode ──────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: const Color(0xFF0B0E1A),
                border: Border.all(
                  color: colorScheme.primary.withValues(alpha: 0.15),
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.nightlight_round,
                      size: 20, color: colorScheme.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Sleep Mode',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: colorScheme.onSurface,
                            )),
                        Text(
                          'Pause the draft during overnight hours',
                          style: TextStyle(
                            fontSize: 11,
                            color: colorScheme.onSurface.withValues(alpha: 0.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _sleepModeEnabled,
                    activeThumbColor: colorScheme.primary,
                    onChanged: (v) => setState(() => _sleepModeEnabled = v),
                  ),
                ],
              ),
            ),

            if (_sleepModeEnabled) ...[
              const SizedBox(height: 8),
              Text(
                'All times are in Eastern Time (ET)',
                style: TextStyle(
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                  color: colorScheme.onSurface.withValues(alpha: 0.35),
                ),
              ),
              const SizedBox(height: 14),
              Text('Sleep Hours',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface.withValues(alpha: 0.7),
                  )),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildTimePicker(
                      label: 'Start',
                      value: _sleepStart,
                      onChanged: (v) => setState(() => _sleepStart = v),
                      colorScheme: colorScheme,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('to',
                        style: TextStyle(
                          color: colorScheme.onSurface.withValues(alpha: 0.4),
                        )),
                  ),
                  Expanded(
                    child: _buildTimePicker(
                      label: 'End',
                      value: _sleepEnd,
                      onChanged: (v) => setState(() => _sleepEnd = v),
                      colorScheme: colorScheme,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 28),

            // Save button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Settings',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildTimePicker({
    required String label,
    required String value,
    required ValueChanged<String> onChanged,
    required ColorScheme colorScheme,
  }) {
    // All 24 hours
    final times =
        List.generate(24, (i) => '${i.toString().padLeft(2, '0')}:00');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: const Color(0xFF0B0E1A),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.2),
        ),
      ),
      child: DropdownButton<String>(
        value: times.contains(value) ? value : times.first,
        isExpanded: true,
        isDense: true,
        underline: const SizedBox.shrink(),
        dropdownColor: const Color(0xFF141829),
        style: TextStyle(fontSize: 13, color: colorScheme.onSurface),
        items: times.map((t) {
          final hour = int.parse(t.split(':')[0]);
          final display = hour == 0
              ? '12:00 AM'
              : hour < 12
                  ? '$hour:00 AM'
                  : hour == 12
                      ? '12:00 PM'
                      : '${hour - 12}:00 PM';
          return DropdownMenuItem(value: t, child: Text(display));
        }).toList(),
        onChanged: (v) {
          if (v != null) onChanged(v);
        },
      ),
    );
  }
}
