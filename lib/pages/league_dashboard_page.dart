import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/draft_pick.dart';
import '../models/league.dart';
import '../models/player.dart';
import '../services/draft_service.dart';
import '../services/league_service.dart';
import '../theme/dyne_theme.dart';
import '../utils/team_defaults.dart';
import '../widgets/dyne_loading.dart';
import '../widgets/trade_inbox.dart';
import 'draft_room_page.dart';
import 'matchup_page.dart';
import 'league_chat_tab.dart';
import 'league_settings_page.dart';

class LeagueDashboardPage extends StatefulWidget {
  const LeagueDashboardPage({super.key, required this.leagueId});

  final String leagueId;

  @override
  State<LeagueDashboardPage> createState() => _LeagueDashboardPageState();
}

class _LeagueDashboardPageState extends State<LeagueDashboardPage> {
  int _selectedTab = 0;

  String get leagueId => widget.leagueId;

  @override
  void initState() {
    super.initState();
    _checkTeamExists();
  }

  Future<void> _checkTeamExists() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    try {
      final doc = await FirebaseFirestore.instance
          .collection('leagues')
          .doc(leagueId)
          .collection('teams')
          .doc(uid)
          .get();

      if (!doc.exists && mounted) {
        // Auto-generate a random team — no modal needed
        await _autoCreateTeam(uid);
      }
    } catch (e) {
      debugPrint('Error checking team: $e');
    }
  }

  Future<void> _autoCreateTeam(String uid) async {
    final team = TeamDefaults.generateRandom();
    try {
      await FirebaseFirestore.instance
          .collection('leagues')
          .doc(leagueId)
          .collection('teams')
          .doc(uid)
          .set({
        'name': team.name,
        'abbreviation': team.abbreviation,
        'primaryColor': team.primaryColor.toARGB32(),
        'secondaryColor': team.secondaryColor.toARGB32(),
        'iconIndex': team.iconIndex,
        'ownerId': uid,
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error auto-creating team: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: DyneTheme.landingGradient),
        child: SafeArea(
          child: StreamBuilder<League>(
            stream: LeagueService().streamLeague(leagueId),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const DyneLoading();
              }

              if (snapshot.hasError) {
                return Center(
                  child: Text(
                    'Error loading league',
                    style: TextStyle(color: colorScheme.onSurface),
                  ),
                );
              }

              final league = snapshot.data!;
              return Column(
                children: [
                  Expanded(
                      child: _buildCurrentTab(context, league, colorScheme)),
                  _buildBottomNav(colorScheme),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentTab(
      BuildContext context, League league, ColorScheme colorScheme) {
    switch (_selectedTab) {
      case 0:
        return _buildDashboard(context, league, colorScheme);
      case 1:
        return _buildRosterTab(colorScheme);
      case 2:
        return _buildTradesTab(colorScheme);
      case 3:
        return _buildStandingsTab(colorScheme);
      case 4:
        return _buildScheduleTab(league, colorScheme);
      case 5:
        return LeagueChatTab(leagueId: leagueId);
      default:
        return _buildDashboard(context, league, colorScheme);
    }
  }

  Widget _buildBottomNav(ColorScheme colorScheme) {
    final items = [
      _NavItem(Icons.home_rounded, 'Home'),
      _NavItem(Icons.people_alt_rounded, 'Roster'),
      _NavItem(Icons.swap_horiz_rounded, 'Trades'),
      _NavItem(Icons.leaderboard_rounded, 'Standings'),
      _NavItem(Icons.calendar_month_rounded, 'Schedule'),
      _NavItem(Icons.chat_bubble_rounded, 'Chat'),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF0B0E1A),
        border: Border(
          top: BorderSide(color: colorScheme.primary.withValues(alpha: 0.1)),
        ),
      ),
      child: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('leagues')
            .doc(leagueId)
            .collection('channels')
            .snapshots(),
        builder: (context, channelsSnap) {
          return StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance
                .collection('leagues')
                .doc(leagueId)
                .collection('league_dms')
                .where('memberIds',
                    arrayContains: FirebaseAuth.instance.currentUser?.uid)
                .snapshots(),
            builder: (context, dmSnap) {
              // Check channel unread — any channel with messages newer than lastRead
              bool hasChannelUnread = false;
              if (channelsSnap.hasData) {
                final currentUid = FirebaseAuth.instance.currentUser?.uid;
                for (final channelDoc in channelsSnap.data!.docs) {
                  final channelData = channelDoc.data() as Map<String, dynamic>;
                  final lastRead =
                      (channelData['lastRead'] as Map<String, dynamic>?);
                  final userLastRead =
                      (lastRead?[currentUid] as Timestamp?)?.toDate();
                  final lastMessageAt =
                      (channelData['lastMessageAt'] as Timestamp?)?.toDate();

                  if (lastMessageAt != null) {
                    if (userLastRead == null ||
                        lastMessageAt.isAfter(userLastRead)) {
                      hasChannelUnread = true;
                      break;
                    }
                  }
                }
              }

              // Check DM unread
              bool hasDmUnread = false;
              if (dmSnap.hasData) {
                final currentUid = FirebaseAuth.instance.currentUser?.uid;
                for (final doc in dmSnap.data!.docs) {
                  final data = doc.data() as Map<String, dynamic>;
                  final lastMessageAt =
                      (data['lastMessageAt'] as Timestamp?)?.toDate();
                  final lastRead = (data['lastRead'] as Map<String, dynamic>?);
                  final userLastRead =
                      (lastRead?[currentUid] as Timestamp?)?.toDate();

                  if (lastMessageAt != null) {
                    final isUnread = userLastRead == null ||
                        lastMessageAt.isAfter(userLastRead);
                    if (isUnread) {
                      hasDmUnread = true;
                      break;
                    }
                  }
                }
              }

              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: items.asMap().entries.map((entry) {
                  final index = entry.key;
                  final item = entry.value;
                  final isSelected = _selectedTab == index;
                  final isChatTab = index == 4;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedTab = index),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: EdgeInsets.symmetric(
                        horizontal: isSelected ? 16 : 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        color: isSelected
                            ? colorScheme.primary.withValues(alpha: 0.15)
                            : Colors.transparent,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Icon(
                                item.icon,
                                size: 20,
                                color: isSelected
                                    ? colorScheme.primary
                                    : colorScheme.onSurface
                                        .withValues(alpha: 0.4),
                              ),
                              if (isChatTab && hasChannelUnread)
                                Positioned(
                                  right: -4,
                                  top: -4,
                                  child: Container(
                                    width: 10,
                                    height: 10,
                                    decoration: const BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: Color(
                                          0xFFFF9100), // Orange for channels
                                    ),
                                  ),
                                ),
                              if (isChatTab && hasDmUnread)
                                Positioned(
                                  left: -4,
                                  top: -4,
                                  child: Container(
                                    width: 10,
                                    height: 10,
                                    decoration: const BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: Color(
                                          0xFFFF00E5), // Neon pink for DMs
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          if (isSelected) ...[
                            const SizedBox(width: 6),
                            Text(
                              item.label,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: colorScheme.primary,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          );
        },
      ),
    );
  }

  // ─── Roster Tab (placeholder) ────────────────────────────────────

  Widget _buildRosterTab(ColorScheme colorScheme) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return const SizedBox.shrink();

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(leagueId)
          .snapshots(),
      builder: (context, leagueSnap) {
        final leagueData =
            leagueSnap.data?.data() as Map<String, dynamic>? ?? {};
        final rosterSlots =
            Map<String, int>.from(leagueData['rosterSlots'] ?? {});

        return StreamBuilder<QuerySnapshot>(
          stream: FirebaseFirestore.instance
              .collection('leagues')
              .doc(leagueId)
              .collection('draft_picks')
              .where('teamId', isEqualTo: uid)
              .snapshots(),
          builder: (context, picksSnap) {
            final myPicks = (picksSnap.data?.docs ?? [])
                .map((doc) {
                  final data = doc.data() as Map<String, dynamic>;
                  if (data['playerId'] == null) return null;
                  return _RosterPick(
                    playerName: data['playerName'] as String? ?? '',
                    playerPosition: data['playerPosition'] as String? ?? '',
                    playerTeam: data['playerTeam'] as String? ?? '',
                    round: data['round'] as int? ?? 0,
                    pick: data['pick'] as int? ?? 0,
                  );
                })
                .where((p) => p != null)
                .cast<_RosterPick>()
                .toList();

            final assignments = _buildRosterAssignments(rosterSlots, myPicks);

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      Text(
                        'My Roster',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: colorScheme.onSurface,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          color: colorScheme.primary.withValues(alpha: 0.15),
                        ),
                        child: Text(
                          '${myPicks.length} drafted',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    itemCount: assignments.length,
                    itemBuilder: (context, index) {
                      final slot = assignments[index];
                      if (slot.isHeader) {
                        return _buildRosterHeader(slot.position, colorScheme);
                      }
                      return _buildRosterRow(slot, colorScheme);
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  List<_LeagueRosterSlot> _buildRosterAssignments(
      Map<String, int> rosterSlots, List<_RosterPick> myPicks) {
    final slots = <_LeagueRosterSlot>[];
    final unassigned = List<_RosterPick>.from(myPicks);

    const offensePositions = [
      'Quarterback',
      'Running Back',
      'Wide Receiver',
      'Tight End',
      'Flex',
      'Left Tackle',
      'Left Guard',
      'Center',
      'Right Guard',
      'Right Tackle',
    ];
    const defensePositions = [
      'Defensive End',
      'Defensive Tackle',
      'Outside Linebacker',
      'Middle Linebacker',
      'Linebacker',
      'Cornerback',
      'Strong Safety',
      'Free Safety',
      'Defensive Back',
      'IDP Flex',
      'Defense',
    ];
    const specialTeamsPositions = ['Kicker', 'Punter'];

    String posToPlayerPos(String pos) {
      switch (pos) {
        case 'Quarterback':
          return 'QB';
        case 'Running Back':
          return 'RB';
        case 'Wide Receiver':
          return 'WR';
        case 'Tight End':
          return 'TE';
        case 'Kicker':
          return 'K';
        case 'Defense':
          return 'DEF';
        case 'Punter':
          return 'P';
        default:
          return pos;
      }
    }

    void fillSlots(List<String> positions, String category) {
      bool hasAny = false;
      for (final pos in positions) {
        if ((rosterSlots[pos] ?? 0) > 0) hasAny = true;
      }
      if (!hasAny) return;

      slots.add(_LeagueRosterSlot(position: category, isHeader: true));
      for (final pos in positions) {
        final count = rosterSlots[pos] ?? 0;
        for (var i = 0; i < count; i++) {
          _RosterPick? match;
          if (pos == 'Flex') {
            match = unassigned
                .where((p) =>
                    p.playerPosition == 'RB' ||
                    p.playerPosition == 'WR' ||
                    p.playerPosition == 'TE')
                .firstOrNull;
          } else if (pos == 'IDP Flex') {
            match = unassigned
                .where((p) =>
                    p.playerPosition == 'LB' ||
                    p.playerPosition == 'DL' ||
                    p.playerPosition == 'DB')
                .firstOrNull;
          } else {
            final abbrev = posToPlayerPos(pos);
            match =
                unassigned.where((p) => p.playerPosition == abbrev).firstOrNull;
          }
          if (match != null) unassigned.remove(match);
          slots.add(_LeagueRosterSlot(position: pos, player: match));
        }
      }
    }

    fillSlots(offensePositions, 'OFFENSE');
    fillSlots(defensePositions, 'DEFENSE');
    fillSlots(specialTeamsPositions, 'SPECIAL TEAMS');

    final benchCount = rosterSlots['Bench'] ?? 0;
    if (benchCount > 0) {
      slots.add(_LeagueRosterSlot(position: 'BENCH', isHeader: true));
      for (var i = 0; i < benchCount; i++) {
        final match = unassigned.isNotEmpty ? unassigned.removeAt(0) : null;
        slots.add(_LeagueRosterSlot(position: 'Bench', player: match));
      }
    }

    return slots;
  }

  Widget _buildRosterHeader(String title, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 6),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(2),
              color: colorScheme.primary,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.5,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRosterRow(_LeagueRosterSlot slot, ColorScheme colorScheme) {
    final hasPlayer = slot.player != null;
    final posColor = _leagueRosterPosColor(slot.position);
    final abbrev = _leagueRosterPosAbbrev(slot.position);

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: hasPlayer ? const Color(0xFF141829) : const Color(0xFF0B0E1A),
        border: Border.all(
          color: hasPlayer
              ? posColor.withValues(alpha: 0.2)
              : colorScheme.onSurface.withValues(alpha: 0.05),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 38,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  posColor.withValues(alpha: hasPlayer ? 0.35 : 0.12),
                  posColor.withValues(alpha: hasPlayer ? 0.15 : 0.04),
                ],
              ),
              border: Border.all(
                color: posColor.withValues(alpha: hasPlayer ? 0.6 : 0.2),
                width: 1.5,
              ),
              boxShadow: hasPlayer
                  ? [
                      BoxShadow(
                        color: posColor.withValues(alpha: 0.2),
                        blurRadius: 6,
                        spreadRadius: -1,
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: Text(
                abbrev,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  color: hasPlayer ? posColor : posColor.withValues(alpha: 0.5),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: hasPlayer
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        slot.player!.playerName,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.onSurface,
                        ),
                      ),
                      Text(
                        '${slot.player!.playerPosition} • ${slot.player!.playerTeam}',
                        style: TextStyle(
                          fontSize: 10,
                          color: colorScheme.onSurface.withValues(alpha: 0.4),
                        ),
                      ),
                    ],
                  )
                : Text(
                    'Empty',
                    style: TextStyle(
                      fontSize: 12,
                      color: colorScheme.onSurface.withValues(alpha: 0.2),
                    ),
                  ),
          ),
          if (hasPlayer)
            Text(
              'Rd ${slot.player!.round}.${slot.player!.pick}',
              style: TextStyle(
                fontSize: 10,
                color: colorScheme.onSurface.withValues(alpha: 0.3),
              ),
            ),
        ],
      ),
    );
  }

  String _leagueRosterPosAbbrev(String position) {
    switch (position) {
      case 'Quarterback':
        return 'QB';
      case 'Running Back':
        return 'RB';
      case 'Wide Receiver':
        return 'WR';
      case 'Tight End':
        return 'TE';
      case 'Flex':
        return 'FLEX';
      case 'Kicker':
        return 'K';
      case 'Punter':
        return 'P';
      case 'Defense':
        return 'DEF';
      case 'Left Tackle':
        return 'LT';
      case 'Left Guard':
        return 'LG';
      case 'Center':
        return 'C';
      case 'Right Guard':
        return 'RG';
      case 'Right Tackle':
        return 'RT';
      case 'Defensive End':
        return 'DE';
      case 'Defensive Tackle':
        return 'DT';
      case 'Outside Linebacker':
        return 'OLB';
      case 'Middle Linebacker':
        return 'MLB';
      case 'Linebacker':
        return 'LB';
      case 'Cornerback':
        return 'CB';
      case 'Free Safety':
        return 'FS';
      case 'Strong Safety':
        return 'SS';
      case 'Defensive Back':
        return 'DB';
      case 'IDP Flex':
        return 'IDP';
      case 'Bench':
        return 'BN';
      default:
        return position;
    }
  }

  Color _leagueRosterPosColor(String position) {
    switch (position) {
      case 'Quarterback':
        return const Color(0xFFFF2D55);
      case 'Running Back':
        return const Color(0xFF43A047);
      case 'Wide Receiver':
        return const Color(0xFF1E88E5);
      case 'Tight End':
        return const Color(0xFFFF8F00);
      case 'Flex':
        return const Color(0xFFAB47BC);
      case 'Kicker':
      case 'Punter':
        return const Color(0xFF5E35B1);
      case 'Defense':
        return const Color(0xFF00897B);
      case 'Left Tackle':
      case 'Right Tackle':
        return const Color(0xFFF48FB1);
      case 'Left Guard':
      case 'Right Guard':
        return const Color(0xFFAB47BC);
      case 'Center':
        return const Color(0xFF26C6DA);
      case 'Defensive Tackle':
      case 'Defensive End':
        return const Color(0xFFFFD600);
      case 'Outside Linebacker':
      case 'Middle Linebacker':
      case 'Linebacker':
        return const Color(0xFF5C6BC0);
      case 'Cornerback':
      case 'Defensive Back':
        return const Color(0xFFC62200);
      case 'Free Safety':
      case 'Strong Safety':
      case 'IDP Flex':
        return const Color(0xFF00897B);
      case 'Bench':
        return const Color(0xFF78909C);
      default:
        return const Color(0xFF90A4AE);
    }
  }

  // ─── Matchups Tab (placeholder) ──────────────────────────────────

  Widget _buildTradesTab(ColorScheme colorScheme) {
    return _TradesTabView(leagueId: leagueId);
  }

  // ─── Standings Tab ────────────────────────────────────────────────

  Widget _buildStandingsTab(ColorScheme colorScheme) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(leagueId)
          .collection('teams')
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: DyneLoading());
        }

        final teamDocs = snapshot.data!.docs;
        if (teamDocs.isEmpty) {
          return Center(
            child: Text(
              'No teams yet',
              style: TextStyle(
                color: colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          );
        }

        // Build standings entries with simulated records
        final standings = teamDocs.map((doc) {
          final data = doc.data() as Map<String, dynamic>;
          final hash = doc.id.hashCode;
          final wins = (hash.abs() % 10);
          final losses = ((hash.abs() >> 4) % 10);
          final pointsFor = (hash.abs() % 500) + 800;
          final pointsAgainst = ((hash.abs() >> 3) % 500) + 800;
          return _StandingsEntry(
            teamId: doc.id,
            name: data['name'] as String? ?? 'Unknown',
            abbreviation: data['abbreviation'] as String? ?? '???',
            primaryColor: data['primaryColor'] != null
                ? Color(data['primaryColor'] as int)
                : colorScheme.primary,
            iconIndex: data['iconIndex'] as int? ?? 0,
            wins: wins,
            losses: losses,
            pointsFor: pointsFor.toDouble(),
            pointsAgainst: pointsAgainst.toDouble(),
          );
        }).toList();

        // Sort by wins desc, then points for desc
        standings.sort((a, b) {
          final wDiff = b.wins.compareTo(a.wins);
          if (wDiff != 0) return wDiff;
          return b.pointsFor.compareTo(a.pointsFor);
        });

        final uid = FirebaseAuth.instance.currentUser?.uid;

        return Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: colorScheme.primary.withValues(alpha: 0.1),
                  ),
                ),
              ),
              child: Row(
                children: [
                  SizedBox(
                    width: 28,
                    child: Text(
                      '#',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface.withValues(alpha: 0.4),
                      ),
                    ),
                  ),
                  const Expanded(
                    child: Text(
                      'TEAM',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Colors.white54,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 50,
                    child: Text(
                      'W-L',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface.withValues(alpha: 0.4),
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 50,
                    child: Text(
                      'PF',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface.withValues(alpha: 0.4),
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 50,
                    child: Text(
                      'PA',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface.withValues(alpha: 0.4),
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Team rows
            Expanded(
              child: ListView.builder(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(vertical: 4),
                itemCount: standings.length,
                itemBuilder: (context, index) {
                  final entry = standings[index];
                  final isMe = entry.teamId == uid;
                  final rank = index + 1;

                  return Container(
                    margin: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 3),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: isMe
                          ? entry.primaryColor.withValues(alpha: 0.08)
                          : const Color(0xFF141829),
                      border: Border.all(
                        color: isMe
                            ? entry.primaryColor.withValues(alpha: 0.3)
                            : colorScheme.primary.withValues(alpha: 0.06),
                      ),
                    ),
                    child: Row(
                      children: [
                        // Rank
                        SizedBox(
                          width: 28,
                          child: Text(
                            '$rank',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: rank <= 4
                                  ? colorScheme.primary
                                  : colorScheme.onSurface
                                      .withValues(alpha: 0.4),
                            ),
                          ),
                        ),
                        // Team icon
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: entry.primaryColor.withValues(alpha: 0.15),
                            border: Border.all(
                              color:
                                  entry.primaryColor.withValues(alpha: 0.4),
                            ),
                          ),
                          child: Icon(
                            TeamDefaults.iconOptions[entry.iconIndex
                                .clamp(0, TeamDefaults.iconOptions.length - 1)],
                            size: 14,
                            color: entry.primaryColor,
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Team name
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                entry.name,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight:
                                      isMe ? FontWeight.w800 : FontWeight.w600,
                                  color: colorScheme.onSurface,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                entry.abbreviation,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: entry.primaryColor
                                      .withValues(alpha: 0.7),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Record
                        SizedBox(
                          width: 50,
                          child: Text(
                            '${entry.wins}-${entry.losses}',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: colorScheme.onSurface,
                            ),
                          ),
                        ),
                        // Points For
                        SizedBox(
                          width: 50,
                          child: Text(
                            entry.pointsFor.toStringAsFixed(0),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: colorScheme.onSurface
                                  .withValues(alpha: 0.6),
                            ),
                          ),
                        ),
                        // Points Against
                        SizedBox(
                          width: 50,
                          child: Text(
                            entry.pointsAgainst.toStringAsFixed(0),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: colorScheme.onSurface
                                  .withValues(alpha: 0.6),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  // ─── Schedule Tab ────────────────────────────────────────────────

  Widget _buildScheduleTab(League league, ColorScheme colorScheme) {
    final regularWeeks = league.regularSeasonWeeks;
    final playoffTeams = league.playoffTeams;
    final hasDraftTime = league.draftStartTime != null;

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(leagueId)
          .collection('teams')
          .snapshots(),
      builder: (context, teamSnap) {
        final teamDocs = teamSnap.data?.docs ?? [];
        final teamNames = <String, String>{};
        final teamColors = <String, Color>{};
        for (final doc in teamDocs) {
          final data = doc.data() as Map<String, dynamic>;
          teamNames[doc.id] = data['name'] as String? ?? 'Team';
          teamColors[doc.id] = data['primaryColor'] != null
              ? Color(data['primaryColor'] as int)
              : colorScheme.primary;
        }

        final memberIds = league.memberIds;
        final uid = FirebaseAuth.instance.currentUser?.uid;

        return DefaultTabController(
          length: 3,
          child: Column(
            children: [
              TabBar(
                indicatorColor: colorScheme.primary,
                labelColor: colorScheme.primary,
                unselectedLabelColor:
                    colorScheme.onSurface.withValues(alpha: 0.4),
                labelStyle: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700),
                indicatorWeight: 2,
                tabs: const [
                  Tab(text: 'My Schedule'),
                  Tab(text: 'Full Season'),
                  Tab(text: 'Playoffs'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    _buildMyScheduleView(
                      colorScheme,
                      league: league,
                      memberIds: memberIds,
                      teamNames: teamNames,
                      teamColors: teamColors,
                      uid: uid,
                      regularWeeks: regularWeeks,
                      hasDraftTime: hasDraftTime,
                    ),
                    _buildFullSeasonView(
                      colorScheme,
                      memberIds: memberIds,
                      teamNames: teamNames,
                      teamColors: teamColors,
                      regularWeeks: regularWeeks,
                    ),
                    _buildPlayoffsView(
                      colorScheme,
                      playoffTeams: playoffTeams,
                      regularWeeks: regularWeeks,
                      teamNames: teamNames,
                      teamColors: teamColors,
                      memberIds: memberIds,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  int _playoffRoundsNeeded(int teams) {
    if (teams <= 2) return 1;
    if (teams <= 4) return 2;
    if (teams <= 8) return 3;
    return 4;
  }

  Widget _buildMyScheduleView(
    ColorScheme colorScheme, {
    required League league,
    required List<String> memberIds,
    required Map<String, String> teamNames,
    required Map<String, Color> teamColors,
    required String? uid,
    required int regularWeeks,
    required bool hasDraftTime,
  }) {
    if (uid == null) return const SizedBox.shrink();

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(12),
      itemCount: regularWeeks + (hasDraftTime ? 1 : 0),
      itemBuilder: (context, index) {
        // Draft event at the top
        if (hasDraftTime && index == 0) {
          return _buildScheduleEvent(
            colorScheme,
            icon: Icons.sports_football,
            title: 'Draft Day',
            subtitle: _formatDraftTime(league.draftStartTime!),
            color: const Color(0xFFFF8F00),
            isHighlighted: true,
          );
        }

        final weekIndex = hasDraftTime ? index - 1 : index;
        final week = weekIndex + 1;

        // Generate a consistent opponent for this week
        final opponents = List<String>.from(memberIds)
          ..remove(uid);
        if (opponents.isEmpty) return const SizedBox.shrink();
        final oppIndex =
            (uid.hashCode + week * 7) % opponents.length;
        final opponent = opponents[oppIndex];

        // Check bye week (simulated: each team gets one bye)
        final byeWeek = (uid.hashCode.abs() % regularWeeks) + 1;
        if (week == byeWeek) {
          return _buildScheduleEvent(
            colorScheme,
            icon: Icons.beach_access,
            title: 'Week $week — BYE',
            subtitle: 'No matchup this week',
            color: colorScheme.onSurface.withValues(alpha: 0.3),
            isHighlighted: false,
          );
        }

        final oppName = teamNames[opponent] ?? 'Opponent';
        final oppColor = teamColors[opponent] ?? colorScheme.primary;

        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => MatchupPage(
                  leagueId: leagueId,
                  team1Id: uid,
                  team2Id: opponent,
                  week: week,
                ),
              ),
            );
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: const Color(0xFF141829),
            border: Border.all(
              color: colorScheme.primary.withValues(alpha: 0.06),
            ),
          ),
          child: Row(
            children: [
              // Week number
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: colorScheme.primary.withValues(alpha: 0.1),
                ),
                child: Center(
                  child: Text(
                    '$week',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: colorScheme.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Matchup info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Week $week',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'vs $oppName',
                      style: TextStyle(
                        fontSize: 11,
                        color: oppColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              // Status indicator
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: colorScheme.onSurface.withValues(alpha: 0.05),
                ),
                child: Text(
                  'Upcoming',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface.withValues(alpha: 0.4),
                  ),
                ),
              ),
            ],
          ),
        ),
        );
      },
    );
  }

  Widget _buildFullSeasonView(
    ColorScheme colorScheme, {
    required List<String> memberIds,
    required Map<String, String> teamNames,
    required Map<String, Color> teamColors,
    required int regularWeeks,
  }) {
    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(12),
      itemCount: regularWeeks,
      itemBuilder: (context, index) {
        final week = index + 1;

        // Generate matchups for this week
        final teams = List<String>.from(memberIds);
        final matchups = <_Matchup>[];
        final shuffled = List<String>.from(teams);
        // Deterministic shuffle based on week
        shuffled.sort((a, b) =>
            (a.hashCode * week).compareTo(b.hashCode * week));

        for (var i = 0; i + 1 < shuffled.length; i += 2) {
          matchups.add(_Matchup(shuffled[i], shuffled[i + 1]));
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: const Color(0xFF141829),
            border: Border.all(
              color: colorScheme.primary.withValues(alpha: 0.08),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Week header
              Row(
                children: [
                  Container(
                    width: 3,
                    height: 14,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(2),
                      color: colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'WEEK $week',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                      color: colorScheme.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              // Matchup rows
              ...matchups.map((m) {
                final team1Name = teamNames[m.team1] ?? 'Team';
                final team2Name = teamNames[m.team2] ?? 'Team';
                final team1Color =
                    teamColors[m.team1] ?? colorScheme.primary;
                final team2Color =
                    teamColors[m.team2] ?? colorScheme.primary;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: team1Color,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          team1Name,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurface,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        'vs',
                        style: TextStyle(
                          fontSize: 10,
                          color: colorScheme.onSurface
                              .withValues(alpha: 0.3),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          team2Name,
                          textAlign: TextAlign.end,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurface,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: team2Color,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPlayoffsView(
    ColorScheme colorScheme, {
    required int playoffTeams,
    required int regularWeeks,
    required Map<String, String> teamNames,
    required Map<String, Color> teamColors,
    required List<String> memberIds,
  }) {
    final rounds = _playoffRoundsNeeded(playoffTeams);

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(12),
      itemCount: rounds,
      itemBuilder: (context, index) {
        final round = index + 1;
        final weekNum = regularWeeks + round;
        final teamsInRound = playoffTeams ~/ (1 << index);
        final matchupsInRound = teamsInRound ~/ 2;

        String roundName;
        if (round == rounds) {
          roundName = 'Championship';
        } else if (round == rounds - 1 && rounds > 1) {
          roundName = 'Semifinals';
        } else {
          roundName = 'Round $round';
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                const Color(0xFFFFD600).withValues(alpha: 0.08),
                const Color(0xFF141829),
              ],
            ),
            border: Border.all(
              color: const Color(0xFFFFD600).withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    round == rounds ? Icons.emoji_events : Icons.stadium,
                    size: 16,
                    color: const Color(0xFFFFD600),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    roundName.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                      color: Color(0xFFFFD600),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Week $weekNum',
                    style: TextStyle(
                      fontSize: 10,
                      color: colorScheme.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ...List.generate(matchupsInRound.clamp(1, 8), (i) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: Colors.white.withValues(alpha: 0.03),
                      border: Border.all(
                        color: const Color(0xFFFFD600)
                            .withValues(alpha: 0.1),
                      ),
                    ),
                    child: Row(
                      children: [
                        Text(
                          'Seed ${i * 2 + 1}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurface,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          'vs',
                          style: TextStyle(
                            fontSize: 10,
                            color: colorScheme.onSurface
                                .withValues(alpha: 0.3),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          'Seed ${teamsInRound - i * 2}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurface,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Widget _buildScheduleEvent(
    ColorScheme colorScheme, {
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required bool isHighlighted,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: isHighlighted
            ? color.withValues(alpha: 0.1)
            : const Color(0xFF141829),
        border: Border.all(
          color: isHighlighted
              ? color.withValues(alpha: 0.3)
              : colorScheme.primary.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: color.withValues(alpha: 0.15),
            ),
            child: Icon(icon, size: 18, color: color),
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
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11,
                    color: color.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Home Dashboard ──────────────────────────────────────────────

  Widget _buildDashboard(
      BuildContext context, League league, ColorScheme colorScheme) {
    final uid = FirebaseAuth.instance.currentUser?.uid;

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(leagueId)
          .collection('teams')
          .doc(uid)
          .snapshots(),
      builder: (context, teamSnap) {
        final teamData = teamSnap.data?.data() as Map<String, dynamic>? ?? {};
        final iconIndex = teamData['iconIndex'] as int? ?? 0;
        final primaryColor = teamData['primaryColor'] != null
            ? Color(teamData['primaryColor'] as int)
            : colorScheme.primary;

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

        return Column(
          children: [
            Expanded(
              child: Stack(
                children: [
                  // Background team logo
                  Positioned(
                    right: -40,
                    bottom: -20,
                    child: Icon(
                      iconOptions[iconIndex.clamp(0, iconOptions.length - 1)],
                      size: 280,
                      color: primaryColor.withValues(alpha: 0.06),
                    ),
                  ),
                  // Main content
                  CustomScrollView(
                    slivers: [
                      SliverToBoxAdapter(
                          child:
                              _buildHeroHeader(context, league, colorScheme)),
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        sliver: SliverToBoxAdapter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 20),
                              _buildActionRow(context, league, colorScheme),
                              if (!league.draftCompleted) ...[
                                const SizedBox(height: 20),
                                _buildDraftCard(context, league, colorScheme),
                              ],
                              const SizedBox(height: 24),
                              _buildTeamOverview(league, colorScheme),
                              const SizedBox(height: 20),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            _buildCompactStats(league, colorScheme),
          ],
        );
      },
    );
  }

  // ─── Hero Header ─────────────────────────────────────────────────

  Widget _buildHeroHeader(
      BuildContext context, League league, ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colorScheme.primary.withValues(alpha: 0.15),
            colorScheme.secondary.withValues(alpha: 0.05),
            Colors.transparent,
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  color: colorScheme.primary.withValues(alpha: 0.15),
                  border: Border.all(
                      color: colorScheme.primary.withValues(alpha: 0.4)),
                ),
                child: Text(
                  league.leagueType.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: colorScheme.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            league.name,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: colorScheme.onSurface,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.group,
                  size: 14,
                  color: colorScheme.onSurface.withValues(alpha: 0.5)),
              const SizedBox(width: 4),
              Text(
                '${league.memberIds.length}/${league.maxMembers} teams',
                style: TextStyle(
                  fontSize: 13,
                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
              const SizedBox(width: 16),
              Icon(Icons.sports_football,
                  size: 14,
                  color: colorScheme.onSurface.withValues(alpha: 0.5)),
              const SizedBox(width: 4),
              Text(
                league.scoringFormat,
                style: TextStyle(
                  fontSize: 13,
                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
              const SizedBox(width: 16),
              Icon(Icons.calendar_today,
                  size: 14,
                  color: colorScheme.onSurface.withValues(alpha: 0.5)),
              const SizedBox(width: 4),
              Text(
                '${league.regularSeasonWeeks} weeks',
                style: TextStyle(
                  fontSize: 13,
                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Action Row ──────────────────────────────────────────────────

  Widget _buildActionRow(
      BuildContext context, League league, ColorScheme colorScheme) {
    return Row(
      children: [
        Expanded(
          child: _buildActionButton(
            icon: Icons.copy_rounded,
            label: 'Invite Code',
            sublabel: league.inviteCode,
            color: colorScheme.primary,
            onTap: () {
              Clipboard.setData(ClipboardData(text: league.inviteCode));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Invite code copied!')),
              );
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildActionButton(
            icon: Icons.settings_outlined,
            label: 'Settings',
            sublabel: 'Manage',
            color: colorScheme.onSurface.withValues(alpha: 0.6),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => LeagueSettingsPage(leagueId: leagueId),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required String sublabel,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: color.withValues(alpha: 0.08),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: color,
                    ),
                  ),
                  Text(
                    sublabel,
                    style: TextStyle(
                      fontSize: 11,
                      color: color.withValues(alpha: 0.7),
                      letterSpacing: sublabel.length > 6 ? 1.5 : 0,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Draft Card ───────────────────────────────────────────────────

  Widget _buildDraftCard(
      BuildContext context, League league, ColorScheme colorScheme) {
    final hasDraftTime = league.draftStartTime != null;
    final isUpcoming =
        hasDraftTime && league.draftStartTime!.isAfter(DateTime.now());
    final isLive = hasDraftTime && !isUpcoming;
    final isCommissioner =
        FirebaseAuth.instance.currentUser?.uid == league.commissionerId;

    return GestureDetector(
      onTap: isLive
          ? () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => DraftRoomPage(leagueId: leagueId),
                ),
              )
          : null,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFFFF2D55).withValues(alpha: 0.2),
              const Color(0xFFFF8F00).withValues(alpha: 0.1),
            ],
          ),
          border: Border.all(
            color: const Color(0xFFFF2D55).withValues(alpha: 0.5),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFFF2D55).withValues(alpha: 0.15),
              blurRadius: 12,
              spreadRadius: 0,
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFFF2D55).withValues(alpha: 0.2),
              ),
              child: const Icon(
                Icons.sports_football,
                color: Color(0xFFFF2D55),
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isLive
                        ? 'DRAFT IS LIVE'
                        : isUpcoming
                            ? 'DRAFT DAY'
                            : 'DRAFT DAY INCOMING',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.2,
                      color: Color(0xFFFF2D55),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    isLive
                        ? 'Tap to enter the draft room'
                        : isUpcoming
                            ? _formatDraftTime(league.draftStartTime!)
                            : 'Waiting for commissioner to set a date',
                    style: TextStyle(
                      fontSize: 12,
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ),
            ),
            if (isCommissioner)
              GestureDetector(
                onTap: () => _showDraftTimePicker(context, league),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFFF2D55).withValues(alpha: 0.2),
                    border: Border.all(
                      color: const Color(0xFFFF2D55).withValues(alpha: 0.5),
                    ),
                  ),
                  child: const Icon(
                    Icons.edit_calendar,
                    color: Color(0xFFFF2D55),
                    size: 18,
                  ),
                ),
              )
            else
              Icon(
                Icons.chevron_right,
                color: const Color(0xFFFF2D55).withValues(alpha: 0.7),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _showDraftTimePicker(BuildContext context, League league) async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: league.draftStartTime ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );

    if (pickedDate == null || !context.mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(
          league.draftStartTime ?? now),
    );

    if (pickedTime == null || !context.mounted) return;

    final draftDateTime = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    );

    await LeagueService().setDraftTime(leagueId, draftDateTime);
  }

  String _formatDraftTime(DateTime time) {
    final months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    final hour = time.hour > 12 ? time.hour - 12 : time.hour;
    final amPm = time.hour >= 12 ? 'PM' : 'AM';
    return '${months[time.month - 1]} ${time.day} at $hour:${time.minute.toString().padLeft(2, '0')} $amPm';
  }

  // ─── Team Overview ───────────────────────────────────────────────

  Widget _buildTeamOverview(League league, ColorScheme colorScheme) {
    final uid = FirebaseAuth.instance.currentUser?.uid;

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(leagueId)
          .collection('teams')
          .doc(uid)
          .snapshots(),
      builder: (context, teamSnap) {
        final teamData = teamSnap.data?.data() as Map<String, dynamic>? ?? {};
        final teamName = teamData['name'] as String? ?? 'My Team';

        return _buildTeamOverviewContent(league, colorScheme, teamName);
      },
    );
  }

  Widget _buildTeamOverviewContent(
      League league, ColorScheme colorScheme, String teamName) {
    final totalRoster = league.rosterSlots.values.fold(0, (a, b) => a + b);
    final currentRoster = 0; // Placeholder until roster is filled
    final salaryCap = league.salariesEnabled ? 200 : 0; // Placeholder cap
    final salaryUsed = 0; // Placeholder

    // Position needs — compare required slots vs filled (placeholder: 0 filled)
    final needs = <_PositionNeed>[];
    for (final entry in league.rosterSlots.entries) {
      if (entry.value > 0 && entry.key != 'Bench') {
        final filled = 0; // Placeholder until draft populates
        final grade = _calculateGrade(filled, entry.value);
        needs.add(_PositionNeed(entry.key, filled, entry.value, grade));
      }
    }
    // Sort by worst grade first
    needs.sort((a, b) => a.gradeValue.compareTo(b.gradeValue));
    final topNeeds = needs.take(5).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Team Name
        Text(
          teamName,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: 6),
        // Salary & Roster counts
        Row(
          children: [
            if (league.salariesEnabled) ...[
              Icon(Icons.attach_money,
                  size: 14,
                  color: colorScheme.onSurface.withValues(alpha: 0.5)),
              Text(
                '\$$salaryUsed / \$$salaryCap',
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
              const SizedBox(width: 16),
            ],
            Icon(Icons.people_outline,
                size: 14, color: colorScheme.onSurface.withValues(alpha: 0.5)),
            const SizedBox(width: 4),
            Text(
              '$currentRoster / $totalRoster roster',
              style: TextStyle(
                fontSize: 12,
                color: colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        // Main content row
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left 2/3: Position needs
            Expanded(
              flex: 2,
              child: Container(
                padding: const EdgeInsets.all(14),
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
                      'TOP NEEDS',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                        color: colorScheme.onSurface.withValues(alpha: 0.4),
                      ),
                    ),
                    const SizedBox(height: 10),
                    ...topNeeds.map((need) => _buildNeedRow(need, colorScheme)),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Right 1/3: Ratings
            Expanded(
              flex: 1,
              child: Column(
                children: [
                  Text(
                    'Overall',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 4),
                  _buildRatingCard(
                    rating: '--',
                    color: colorScheme.primary,
                    colorScheme: colorScheme,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Offense',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 4),
                  _buildRatingCard(
                    rating: '--',
                    color: const Color(0xFF00E676),
                    colorScheme: colorScheme,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Defense',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 4),
                  _buildRatingCard(
                    rating: '--',
                    color: const Color(0xFFFF2D55),
                    colorScheme: colorScheme,
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildNeedRow(_PositionNeed need, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              color: _gradeColor(need.grade).withValues(alpha: 0.15),
            ),
            child: Center(
              child: Text(
                need.grade,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: _gradeColor(need.grade),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              need.position,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: colorScheme.onSurface.withValues(alpha: 0.8),
              ),
            ),
          ),
          Text(
            '${need.filled}/${need.required}',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRatingCard({
    required String rating,
    required Color color,
    required ColorScheme colorScheme,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Center(
        child: Text(
          rating,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
      ),
    );
  }

  String _calculateGrade(int filled, int required) {
    if (required == 0) return 'A';
    final ratio = filled / required;
    if (ratio >= 1.0) return 'A';
    if (ratio >= 0.75) return 'B';
    if (ratio >= 0.5) return 'C';
    if (ratio >= 0.25) return 'D';
    return 'F';
  }

  Color _gradeColor(String grade) {
    switch (grade) {
      case 'A':
        return const Color(0xFF00E676);
      case 'B':
        return const Color(0xFF2979FF);
      case 'C':
        return const Color(0xFFFFD600);
      case 'D':
        return const Color(0xFFFF8F00);
      case 'F':
        return const Color(0xFFFF2D55);
      default:
        return const Color(0xFF90A4AE);
    }
  }

  // ─── Quick Stats ─────────────────────────────────────────────────

  Widget _buildCompactStats(League league, ColorScheme colorScheme) {
    final totalRoster = league.rosterSlots.values.fold(0, (a, b) => a + b);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        children: [
          _buildStatCard(
            value: '${league.playoffTeams}',
            label: 'Playoff\nTeams',
            color: const Color(0xFFFF2D55),
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 10),
          _buildStatCard(
            value: '$totalRoster',
            label: 'Roster\nSlots',
            color: const Color(0xFF00E676),
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 10),
          _buildStatCard(
            value: league.draftType,
            label: 'Draft\nType',
            color: const Color(0xFF2979FF),
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 10),
          _buildStatCard(
            value: league.waiverFormat == 'FAAB'
                ? '\$${league.faabBudget}'
                : league.waiverFormat,
            label: 'Waiver\nFormat',
            color: const Color(0xFFFFD600),
            colorScheme: colorScheme,
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard({
    required String value,
    required String label,
    required Color color,
    required ColorScheme colorScheme,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: color.withValues(alpha: 0.1),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: color,
              ),
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: colorScheme.onSurface.withValues(alpha: 0.5),
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _TradesTabView extends StatefulWidget {
  const _TradesTabView({required this.leagueId});
  final String leagueId;

  @override
  State<_TradesTabView> createState() => _TradesTabViewState();
}

class _TradesTabViewState extends State<_TradesTabView>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _proposerKey = GlobalKey<_TradeProposerState>();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Row(
            children: [
              Text(
                'Trades',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: colorScheme.onSurface),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        TabBar(
          controller: _tabController,
          indicatorColor: colorScheme.primary,
          labelColor: colorScheme.primary,
          unselectedLabelColor: colorScheme.onSurface.withValues(alpha: 0.4),
          labelStyle:
              const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          tabs: const [
            Tab(text: 'Pending'),
            Tab(text: 'New Trade'),
            Tab(text: 'History'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              TradeInbox(
                leagueId: widget.leagueId,
                onCounter: (data) {
                  // Switch to New Trade tab first, then prefill after it's built
                  _tabController.animateTo(1);
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    _proposerKey.currentState?.prefill(data);
                  });
                },
              ),
              _TradeProposer(key: _proposerKey, leagueId: widget.leagueId),
              _TradeHistory(leagueId: widget.leagueId),
            ],
          ),
        ),
      ],
    );
  }
}

class _TradeProposer extends StatefulWidget {
  const _TradeProposer({super.key, required this.leagueId});
  final String leagueId;

  @override
  State<_TradeProposer> createState() => _TradeProposerState();
}

class _TradeProposerState extends State<_TradeProposer>
    with AutomaticKeepAliveClientMixin {
  String? _selectedTeamId;
  final Set<int> _myOfferedPicks = {};
  final Set<int> _theirOfferedPicks = {};
  final Set<String> _myOfferedPlayers = {};
  final Set<String> _theirOfferedPlayers = {};
  String _myTab = 'picks';
  String _theirTab = 'picks';

  @override
  bool get wantKeepAlive => true;

  void prefill(TradeCounterData data) {
    setState(() {
      _selectedTeamId = data.targetTeamId;
      _myOfferedPicks
        ..clear()
        ..addAll(data.myPicks);
      _theirOfferedPicks
        ..clear()
        ..addAll(data.theirPicks);
      _myOfferedPlayers
        ..clear()
        ..addAll(data.myPlayers);
      _theirOfferedPlayers
        ..clear()
        ..addAll(data.theirPlayers);
    });
  }

  String get _uid => FirebaseAuth.instance.currentUser!.uid;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        // Team selector
        SizedBox(
          height: 56,
          child: StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance
                .collection('leagues')
                .doc(widget.leagueId)
                .collection('teams')
                .snapshots(),
            builder: (context, snap) {
              final teams = (snap.data?.docs ?? [])
                  .where((doc) => doc.id != _uid)
                  .toList();
              return ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                physics: const BouncingScrollPhysics(),
                itemCount: teams.length,
                itemBuilder: (context, index) {
                  final team = teams[index];
                  final data = team.data() as Map<String, dynamic>;
                  final abbrev = data['abbreviation'] as String? ?? '';
                  final teamColor = data['primaryColor'] != null
                      ? Color(data['primaryColor'] as int)
                      : colorScheme.primary;
                  final iconIndex = data['iconIndex'] as int? ?? 0;
                  final isSelected = _selectedTeamId == team.id;

                  return GestureDetector(
                    onTap: () => setState(() {
                      _selectedTeamId = team.id;
                      _theirOfferedPicks.clear();
                      _theirOfferedPlayers.clear();
                    }),
                    child: Container(
                      width: 52,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: isSelected
                            ? teamColor.withValues(alpha: 0.2)
                            : const Color(0xFF141829),
                        border: Border.all(
                            color: isSelected
                                ? teamColor
                                : colorScheme.onSurface.withValues(alpha: 0.08),
                            width: isSelected ? 2 : 1),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                    color: teamColor.withValues(alpha: 0.2),
                                    blurRadius: 8)
                              ]
                            : null,
                      ),
                      child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                                TeamDefaults.iconOptions[iconIndex.clamp(
                                    0, TeamDefaults.iconOptions.length - 1)],
                                size: 16,
                                color: isSelected
                                    ? teamColor
                                    : colorScheme.onSurface
                                        .withValues(alpha: 0.4)),
                            const SizedBox(height: 2),
                            Text(abbrev,
                                style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: isSelected
                                        ? teamColor
                                        : colorScheme.onSurface
                                            .withValues(alpha: 0.4))),
                          ]),
                    ),
                  );
                },
              );
            },
          ),
        ),
        // Trade content
        Expanded(
          child: _selectedTeamId == null
              ? Center(
                  child: Text('Select a team to trade with',
                      style: TextStyle(
                          fontSize: 13,
                          color: colorScheme.onSurface.withValues(alpha: 0.3))))
              : StreamBuilder<List<DraftPick>>(
                  stream: DraftService(widget.leagueId).streamPicks(),
                  builder: (context, picksSnap) {
                    final allPicks = picksSnap.data ?? [];
                    final myPicks = allPicks
                        .where((p) => p.teamId == _uid && !p.isComplete)
                        .toList();
                    final myPlayers = allPicks
                        .where((p) => p.teamId == _uid && p.isComplete)
                        .toList();
                    final theirPicks = allPicks
                        .where(
                            (p) => p.teamId == _selectedTeamId && !p.isComplete)
                        .toList();
                    final theirPlayers = allPicks
                        .where(
                            (p) => p.teamId == _selectedTeamId && p.isComplete)
                        .toList();

                    return ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      physics: const BouncingScrollPhysics(),
                      children: [
                        _buildPanel(
                            'YOU GIVE',
                            const Color(0xFFFF2D55),
                            myPicks,
                            myPlayers,
                            _myOfferedPicks,
                            _myOfferedPlayers,
                            _myTab,
                            (t) => setState(() => _myTab = t),
                            (p) => setState(() {
                                  if (!_myOfferedPicks.remove(p)) {
                                    _myOfferedPicks.add(p);
                                  }
                                }),
                            (id) => setState(() {
                                  if (!_myOfferedPlayers.remove(id)) {
                                    _myOfferedPlayers.add(id);
                                  }
                                }),
                            colorScheme),
                        const SizedBox(height: 6),
                        Center(
                            child: Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: const Color(0xFFFF8F00)
                                        .withValues(alpha: 0.15),
                                    border: Border.all(
                                        color: const Color(0xFFFF8F00)
                                            .withValues(alpha: 0.4))),
                                child: const Icon(Icons.swap_vert_rounded,
                                    size: 20, color: Color(0xFFFF8F00)))),
                        const SizedBox(height: 6),
                        _buildPanel(
                            'YOU RECEIVE',
                            const Color(0xFF00E676),
                            theirPicks,
                            theirPlayers,
                            _theirOfferedPicks,
                            _theirOfferedPlayers,
                            _theirTab,
                            (t) => setState(() => _theirTab = t),
                            (p) => setState(() {
                                  if (!_theirOfferedPicks.remove(p)) {
                                    _theirOfferedPicks.add(p);
                                  }
                                }),
                            (id) => setState(() {
                                  if (!_theirOfferedPlayers.remove(id)) {
                                    _theirOfferedPlayers.add(id);
                                  }
                                }),
                            colorScheme),
                        const SizedBox(height: 16),
                      ],
                    );
                  },
                ),
        ),
        if (_selectedTeamId != null &&
            (_myOfferedPicks.isNotEmpty || _myOfferedPlayers.isNotEmpty) &&
            (_theirOfferedPicks.isNotEmpty || _theirOfferedPlayers.isNotEmpty))
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () => _submit(context),
                  icon: const Icon(Icons.send_rounded, size: 18),
                  label: const Text('Send Proposal',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                )),
          ),
      ],
    );
  }

  Widget _buildPanel(
      String title,
      Color color,
      List<DraftPick> picks,
      List<DraftPick> players,
      Set<int> selPicks,
      Set<String> selPlayers,
      String tab,
      ValueChanged<String> onTab,
      ValueChanged<int> onPick,
      ValueChanged<String> onPlayer,
      ColorScheme cs) {
    final total = selPicks.length + selPlayers.length;
    return Container(
      decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: color.withValues(alpha: 0.04),
          border: Border.all(color: color.withValues(alpha: 0.2))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
          decoration: BoxDecoration(
              border: Border(
                  bottom: BorderSide(color: color.withValues(alpha: 0.1)))),
          child: Row(children: [
            Text(title,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                    color: color)),
            if (total > 0) ...[
              const SizedBox(width: 8),
              Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: color.withValues(alpha: 0.2)),
                  child: Center(
                      child: Text('$total',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: color))))
            ],
            const Spacer(),
            _miniToggle('Picks', tab == 'picks', color, () => onTab('picks')),
            const SizedBox(width: 6),
            _miniToggle(
                'Players', tab == 'players', color, () => onTab('players')),
          ]),
        ),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 180),
          child: tab == 'picks'
              ? _picksList(picks, selPicks, color, cs, onPick)
              : _playersList(players, selPlayers, color, cs, onPlayer),
        ),
      ]),
    );
  }

  Widget _miniToggle(
      String label, bool active, Color color, VoidCallback onTap) {
    return GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color:
                  active ? color.withValues(alpha: 0.15) : Colors.transparent,
              border: Border.all(
                  color: active
                      ? color.withValues(alpha: 0.4)
                      : Colors.transparent)),
          child: Text(label,
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? color : color.withValues(alpha: 0.4))),
        ));
  }

  Widget _picksList(List<DraftPick> picks, Set<int> sel, Color color,
      ColorScheme cs, ValueChanged<int> onTap) {
    if (picks.isEmpty) {
      return const Padding(
          padding: EdgeInsets.all(16),
          child: Center(
              child: Text('No picks available',
                  style: TextStyle(fontSize: 12, color: Color(0xFF555555)))));
    }
    return ListView.builder(
        shrinkWrap: true,
        padding: const EdgeInsets.all(8),
        itemCount: picks.length,
        itemBuilder: (_, i) {
          final p = picks[i];
          final on = sel.contains(p.overallPick);
          return GestureDetector(
              onTap: () => onTap(p.overallPick),
              child: Container(
                  margin: const EdgeInsets.only(bottom: 4),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: on
                          ? color.withValues(alpha: 0.12)
                          : const Color(0xFF0F1220),
                      border: Border.all(
                          color: on
                              ? color.withValues(alpha: 0.6)
                              : Colors.transparent)),
                  child: Row(children: [
                    Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(6),
                            color: on
                                ? color
                                : cs.onSurface.withValues(alpha: 0.08),
                            border: Border.all(
                                color: on
                                    ? color
                                    : cs.onSurface.withValues(alpha: 0.2))),
                        child: on
                            ? const Icon(Icons.check,
                                size: 14, color: Colors.white)
                            : null),
                    const SizedBox(width: 10),
                    Text('Round ${p.round}, Pick ${p.pick}',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: cs.onSurface)),
                    const Spacer(),
                    Text('#${p.overallPick}',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: cs.primary.withValues(alpha: 0.6)))
                  ])));
        });
  }

  Widget _playersList(List<DraftPick> players, Set<String> sel, Color color,
      ColorScheme cs, ValueChanged<String> onTap) {
    if (players.isEmpty) {
      return const Padding(
          padding: EdgeInsets.all(16),
          child: Center(
              child: Text('No players drafted yet',
                  style: TextStyle(fontSize: 12, color: Color(0xFF555555)))));
    }
    return ListView.builder(
        shrinkWrap: true,
        padding: const EdgeInsets.all(8),
        itemCount: players.length,
        itemBuilder: (_, i) {
          final p = players[i];
          final id = p.playerId ?? '';
          final on = sel.contains(id);
          Color posColor;
          switch (p.playerPosition) {
            case 'QB':
              posColor = const Color(0xFFFF2D55);
              break;
            case 'RB':
              posColor = const Color(0xFF00E676);
              break;
            case 'WR':
              posColor = const Color(0xFF2979FF);
              break;
            case 'TE':
              posColor = const Color(0xFFFF8F00);
              break;
            case 'K':
              posColor = const Color(0xFF5E35B1);
              break;
            case 'DEF':
              posColor = const Color(0xFF00897B);
              break;
            default:
              posColor = const Color(0xFF90A4AE);
          }
          return GestureDetector(
              onTap: () => onTap(id),
              child: Container(
                  margin: const EdgeInsets.only(bottom: 4),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: on
                          ? color.withValues(alpha: 0.12)
                          : const Color(0xFF0F1220),
                      border: Border.all(
                          color: on
                              ? color.withValues(alpha: 0.6)
                              : Colors.transparent)),
                  child: Row(children: [
                    Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(6),
                            color: on
                                ? color
                                : cs.onSurface.withValues(alpha: 0.08),
                            border: Border.all(
                                color: on
                                    ? color
                                    : cs.onSurface.withValues(alpha: 0.2))),
                        child: on
                            ? const Icon(Icons.check,
                                size: 14, color: Colors.white)
                            : null),
                    const SizedBox(width: 10),
                    Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(4),
                            color: posColor.withValues(alpha: 0.15)),
                        child: Text(p.playerPosition ?? '',
                            style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: posColor))),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(p.playerName ?? '',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: cs.onSurface),
                            overflow: TextOverflow.ellipsis)),
                    Text('${p.playerTeam}',
                        style: TextStyle(
                            fontSize: 10,
                            color: cs.onSurface.withValues(alpha: 0.4)))
                  ])));
        });
  }

  Future<void> _submit(BuildContext context) async {
    try {
      await FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('trades')
          .add({
        'proposerId': _uid,
        'targetId': _selectedTeamId,
        'offeredPicks': _myOfferedPicks.toList(),
        'requestedPicks': _theirOfferedPicks.toList(),
        'offeredPlayers': _myOfferedPlayers.toList(),
        'requestedPlayers': _theirOfferedPlayers.toList(),
        'status': 'pending',
        'createdAt': FieldValue.serverTimestamp(),
      });
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Trade proposal sent!'),
            backgroundColor: Color(0xFF00E676)));
        setState(() {
          _myOfferedPicks.clear();
          _theirOfferedPicks.clear();
          _myOfferedPlayers.clear();
          _theirOfferedPlayers.clear();
        });
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed: $e'),
            backgroundColor: const Color(0xFFFF2D55)));
      }
    }
  }
}

class _TradeHistory extends StatelessWidget {
  const _TradeHistory({required this.leagueId});
  final String leagueId;

  String _toEst(Timestamp? ts) {
    if (ts == null) return '';
    final utc = ts.toDate().toUtc();
    final year = utc.year;
    // Simple DST check for Eastern Time
    final dstStart = DateTime.utc(
        year, 3, 8 + (7 - DateTime.utc(year, 3, 1).weekday) % 7, 7);
    final dstEnd = DateTime.utc(
        year, 11, 1 + (7 - DateTime.utc(year, 11, 1).weekday) % 7, 6);
    final isDst = utc.isAfter(dstStart) && utc.isBefore(dstEnd);
    final et = utc.add(Duration(hours: isDst ? -4 : -5));
    final h = et.hour > 12 ? et.hour - 12 : (et.hour == 0 ? 12 : et.hour);
    final amPm = et.hour >= 12 ? 'PM' : 'AM';
    return '${et.month}/${et.day} $h:${et.minute.toString().padLeft(2, '0')} $amPm ET';
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(leagueId)
          .collection('trades')
          .snapshots(),
      builder: (context, snap) {
        if (!snap.hasData) return const SizedBox.shrink();

        final trades = snap.data!.docs.where((doc) {
          final d = doc.data() as Map<String, dynamic>;
          final status = d['status'] as String? ?? 'pending';
          return status != 'pending';
        }).toList()
          ..sort((a, b) {
            final aTime =
                ((a.data() as Map<String, dynamic>)['createdAt'] as Timestamp?)
                        ?.millisecondsSinceEpoch ??
                    0;
            final bTime =
                ((b.data() as Map<String, dynamic>)['createdAt'] as Timestamp?)
                        ?.millisecondsSinceEpoch ??
                    0;
            return bTime.compareTo(aTime);
          });

        if (trades.isEmpty) {
          return Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.history,
                  size: 48,
                  color: colorScheme.onSurface.withValues(alpha: 0.1)),
              const SizedBox(height: 8),
              Text('No trade history yet',
                  style: TextStyle(
                      fontSize: 13,
                      color: colorScheme.onSurface.withValues(alpha: 0.3))),
            ]),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          physics: const BouncingScrollPhysics(),
          itemCount: trades.length,
          itemBuilder: (context, index) {
            final data = trades[index].data() as Map<String, dynamic>;
            final status = data['status'] as String? ?? '';
            final proposerId = data['proposerId'] as String? ?? '';
            final targetId = data['targetId'] as String? ?? '';
            final offeredPicks = List<int>.from(data['offeredPicks'] ?? []);
            final requestedPicks = List<int>.from(data['requestedPicks'] ?? []);
            final offeredPlayers =
                List<String>.from(data['offeredPlayers'] ?? []);
            final requestedPlayers =
                List<String>.from(data['requestedPlayers'] ?? []);
            final createdAt = data['createdAt'] as Timestamp?;

            Color statusColor;
            String statusLabel;
            switch (status) {
              case 'accepted':
                statusColor = const Color(0xFF00E676);
                statusLabel = 'ACCEPTED';
                break;
              case 'rejected':
                statusColor = const Color(0xFFFF2D55);
                statusLabel = 'REJECTED';
                break;
              case 'cancelled':
                statusColor = const Color(0xFF78909C);
                statusLabel = 'CANCELLED';
                break;
              case 'cancelled 404':
                statusColor = const Color(0xFF78909C);
                statusLabel = 'CANCELLED 404';
                break;
              case 'countered':
                statusColor = const Color(0xFFFF8F00);
                statusLabel = 'COUNTERED';
                break;
              default:
                statusColor = const Color(0xFF78909C);
                statusLabel = status.toUpperCase();
            }

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: const Color(0xFF141829),
                border: Border.all(color: statusColor.withValues(alpha: 0.15)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      StreamBuilder<DocumentSnapshot>(
                        stream: FirebaseFirestore.instance
                            .collection('leagues')
                            .doc(leagueId)
                            .collection('teams')
                            .doc(proposerId)
                            .snapshots(),
                        builder: (context, s) {
                          final name =
                              (s.data?.data() as Map<String, dynamic>?)?['name']
                                      as String? ??
                                  'Unknown';
                          return Flexible(
                              child: Text(name,
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: colorScheme.onSurface),
                                  overflow: TextOverflow.ellipsis));
                        },
                      ),
                      Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          child: Icon(Icons.swap_horiz,
                              size: 14,
                              color: colorScheme.onSurface
                                  .withValues(alpha: 0.3))),
                      StreamBuilder<DocumentSnapshot>(
                        stream: FirebaseFirestore.instance
                            .collection('leagues')
                            .doc(leagueId)
                            .collection('teams')
                            .doc(targetId)
                            .snapshots(),
                        builder: (context, s) {
                          final name =
                              (s.data?.data() as Map<String, dynamic>?)?['name']
                                      as String? ??
                                  'Unknown';
                          return Flexible(
                              child: Text(name,
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: colorScheme.onSurface),
                                  overflow: TextOverflow.ellipsis));
                        },
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(4),
                            color: statusColor.withValues(alpha: 0.15)),
                        child: Text(statusLabel,
                            style: TextStyle(
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                                color: statusColor)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                          child: Text(
                        _summarizeSide(offeredPicks, offeredPlayers),
                        style: TextStyle(
                            fontSize: 10,
                            color:
                                colorScheme.onSurface.withValues(alpha: 0.5)),
                      )),
                      Text(' ↔ ',
                          style: TextStyle(
                              fontSize: 10,
                              color: colorScheme.onSurface
                                  .withValues(alpha: 0.2))),
                      Expanded(
                          child: Text(
                        _summarizeSide(requestedPicks, requestedPlayers),
                        style: TextStyle(
                            fontSize: 10,
                            color:
                                colorScheme.onSurface.withValues(alpha: 0.5)),
                        textAlign: TextAlign.end,
                      )),
                    ],
                  ),
                  if (createdAt != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      _toEst(createdAt),
                      style: TextStyle(
                          fontSize: 9,
                          color: colorScheme.onSurface.withValues(alpha: 0.25)),
                    ),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }

  String _summarizeSide(List<int> picks, List<String> players) {
    final parts = <String>[];
    if (picks.isNotEmpty) {
      parts.add('Picks ${picks.map((p) => "#$p").join(", ")}');
    }
    for (final id in players) {
      final player = PlayerPool.players.where((p) => p.id == id).firstOrNull;
      parts.add(player?.name ?? id);
    }
    return parts.isEmpty ? 'Nothing' : parts.join(', ');
  }
}

class _NavItem {
  const _NavItem(this.icon, this.label);
  final IconData icon;
  final String label;
}

class _PositionNeed {
  const _PositionNeed(this.position, this.filled, this.required, this.grade);
  final String position;
  final int filled;
  final int required;
  final String grade;

  int get gradeValue {
    switch (grade) {
      case 'A':
        return 5;
      case 'B':
        return 4;
      case 'C':
        return 3;
      case 'D':
        return 2;
      case 'F':
        return 1;
      default:
        return 0;
    }
  }
}

class _RosterPick {
  const _RosterPick({
    required this.playerName,
    required this.playerPosition,
    required this.playerTeam,
    required this.round,
    required this.pick,
  });
  final String playerName;
  final String playerPosition;
  final String playerTeam;
  final int round;
  final int pick;
}

class _LeagueRosterSlot {
  const _LeagueRosterSlot(
      {required this.position, this.player, this.isHeader = false});
  final String position;
  final _RosterPick? player;
  final bool isHeader;
}

class _StandingsEntry {
  const _StandingsEntry({
    required this.teamId,
    required this.name,
    required this.abbreviation,
    required this.primaryColor,
    required this.iconIndex,
    required this.wins,
    required this.losses,
    required this.pointsFor,
    required this.pointsAgainst,
  });

  final String teamId;
  final String name;
  final String abbreviation;
  final Color primaryColor;
  final int iconIndex;
  final int wins;
  final int losses;
  final double pointsFor;
  final double pointsAgainst;
}

class _Matchup {
  const _Matchup(this.team1, this.team2);
  final String team1;
  final String team2;
}
