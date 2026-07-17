import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../models/draft_pick.dart';
import '../models/player.dart';
import '../theme/dyne_theme.dart';
import '../utils/team_defaults.dart';

/// Head-to-head matchup page showing two teams' rosters and scores for a week.
class MatchupPage extends StatefulWidget {
  const MatchupPage({
    super.key,
    required this.leagueId,
    required this.team1Id,
    required this.team2Id,
    required this.week,
  });

  final String leagueId;
  final String team1Id;
  final String team2Id;
  final int week;

  @override
  State<MatchupPage> createState() => _MatchupPageState();
}

class _MatchupPageState extends State<MatchupPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  Map<String, dynamic>? _team1Data;
  Map<String, dynamic>? _team2Data;
  List<DraftPick> _team1Picks = [];
  List<DraftPick> _team2Picks = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final firestore = FirebaseFirestore.instance;

    final results = await Future.wait([
      firestore
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('teams')
          .doc(widget.team1Id)
          .get(),
      firestore
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('teams')
          .doc(widget.team2Id)
          .get(),
      firestore
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('draft_picks')
          .where('teamId', isEqualTo: widget.team1Id)
          .get(),
      firestore
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('draft_picks')
          .where('teamId', isEqualTo: widget.team2Id)
          .get(),
    ]);

    final team1Doc = results[0] as DocumentSnapshot;
    final team2Doc = results[1] as DocumentSnapshot;
    final team1PicksSnap = results[2] as QuerySnapshot;
    final team2PicksSnap = results[3] as QuerySnapshot;

    setState(() {
      _team1Data = team1Doc.data() as Map<String, dynamic>?;
      _team2Data = team2Doc.data() as Map<String, dynamic>?;
      _team1Picks = team1PicksSnap.docs
          .map((d) => DraftPick.fromMap(d.data() as Map<String, dynamic>))
          .where((p) => p.isComplete)
          .toList();
      _team2Picks = team2PicksSnap.docs
          .map((d) => DraftPick.fromMap(d.data() as Map<String, dynamic>))
          .where((p) => p.isComplete)
          .toList();
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: DyneTheme.landingGradient),
        child: SafeArea(
          child: _loading ? _buildLoading() : _buildContent(),
        ),
      ),
    );
  }

  Widget _buildLoading() {
    return const Center(
      child: CircularProgressIndicator(color: Color(0xFF00E5FF)),
    );
  }

  Widget _buildContent() {
    final team1Name = _team1Data?['name'] ?? 'Team 1';
    final team2Name = _team2Data?['name'] ?? 'Team 2';
    final team1Color = _parseColor(_team1Data?['primaryColor']);
    final team2Color = _parseColor(_team2Data?['primaryColor']);
    final team1Icon = _getTeamIcon(_team1Data?['iconIndex']);
    final team2Icon = _getTeamIcon(_team2Data?['iconIndex']);

    final team1Roster = _buildRosterData(_team1Picks, widget.team1Id);
    final team2Roster = _buildRosterData(_team2Picks, widget.team2Id);

    final team1Total = _totalActual(team1Roster);
    final team2Total = _totalActual(team2Roster);
    final team1Projected = _totalProjected(team1Roster);
    final team2Projected = _totalProjected(team2Roster);

    return Column(
      children: [
        _buildHeader(),
        const SizedBox(height: 8),
        _buildScoreboard(
          team1Name: team1Name,
          team2Name: team2Name,
          team1Color: team1Color,
          team2Color: team2Color,
          team1Icon: team1Icon,
          team2Icon: team2Icon,
          team1Total: team1Total,
          team2Total: team2Total,
          team1Projected: team1Projected,
          team2Projected: team2Projected,
        ),
        const SizedBox(height: 12),
        _buildStatsSummary(
          team1Roster: team1Roster,
          team2Roster: team2Roster,
          team1Name: team1Name,
          team2Name: team2Name,
          team1Color: team1Color,
          team2Color: team2Color,
        ),
        const SizedBox(height: 12),
        _buildRosterTabs(team1Name, team2Name, team1Color, team2Color),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildRosterList(team1Roster, team1Color),
              _buildRosterList(team2Roster, team2Color),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.arrow_back, color: Colors.white),
          ),
          const Spacer(),
          Text(
            'Week ${widget.week}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          const SizedBox(width: 48), // Balance the back button
        ],
      ),
    );
  }

  Widget _buildScoreboard({
    required String team1Name,
    required String team2Name,
    required Color team1Color,
    required Color team2Color,
    required IconData team1Icon,
    required IconData team2Icon,
    required double team1Total,
    required double team2Total,
    required double team1Projected,
    required double team2Projected,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF141829),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.08),
        ),
      ),
      child: Row(
        children: [
          // Team 1
          Expanded(
            child: _buildTeamScore(
              name: team1Name,
              color: team1Color,
              icon: team1Icon,
              actual: team1Total,
              projected: team1Projected,
              alignment: CrossAxisAlignment.center,
            ),
          ),
          // VS divider
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text(
              'VS',
              style: TextStyle(
                color: Colors.white54,
                fontSize: 14,
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
              ),
            ),
          ),
          // Team 2
          Expanded(
            child: _buildTeamScore(
              name: team2Name,
              color: team2Color,
              icon: team2Icon,
              actual: team2Total,
              projected: team2Projected,
              alignment: CrossAxisAlignment.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTeamScore({
    required String name,
    required Color color,
    required IconData icon,
    required double actual,
    required double projected,
    required CrossAxisAlignment alignment,
  }) {
    return Column(
      crossAxisAlignment: alignment,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(height: 8),
        Text(
          name,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 6),
        Text(
          actual.toStringAsFixed(1),
          style: TextStyle(
            color: color,
            fontSize: 28,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          'Proj: ${projected.toStringAsFixed(1)}',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.5),
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildStatsSummary({
    required List<_RosterEntry> team1Roster,
    required List<_RosterEntry> team2Roster,
    required String team1Name,
    required String team2Name,
    required Color team1Color,
    required Color team2Color,
  }) {
    final team1HighScorer = _highestScorer(team1Roster);
    final team2HighScorer = _highestScorer(team2Roster);
    final team1BenchPts = _benchPoints(team1Roster);
    final team2BenchPts = _benchPoints(team2Roster);
    final team1YetToPlay = _yetToPlay(team1Roster);
    final team2YetToPlay = _yetToPlay(team2Roster);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF141829),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        children: [
          _buildStatRow(
            label: 'Top Scorer',
            team1Value: team1HighScorer,
            team2Value: team2HighScorer,
            team1Color: team1Color,
            team2Color: team2Color,
          ),
          const Divider(color: Colors.white10, height: 16),
          _buildStatRow(
            label: 'Bench Pts',
            team1Value: team1BenchPts.toStringAsFixed(1),
            team2Value: team2BenchPts.toStringAsFixed(1),
            team1Color: team1Color,
            team2Color: team2Color,
          ),
          const Divider(color: Colors.white10, height: 16),
          _buildStatRow(
            label: 'Yet to Play',
            team1Value: '$team1YetToPlay',
            team2Value: '$team2YetToPlay',
            team1Color: team1Color,
            team2Color: team2Color,
          ),
        ],
      ),
    );
  }

  Widget _buildStatRow({
    required String label,
    required String team1Value,
    required String team2Value,
    required Color team1Color,
    required Color team2Color,
  }) {
    return Row(
      children: [
        Expanded(
          child: Text(
            team1Value,
            style: TextStyle(
              color: team1Color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.6),
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        Expanded(
          child: Text(
            team2Value,
            style: TextStyle(
              color: team2Color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _buildRosterTabs(
    String team1Name,
    String team2Name,
    Color team1Color,
    Color team2Color,
  ) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF141829),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: Colors.white.withValues(alpha: 0.1),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        labelColor: Colors.white,
        unselectedLabelColor: Colors.white.withValues(alpha: 0.5),
        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        tabs: [
          Tab(text: team1Name),
          Tab(text: team2Name),
        ],
      ),
    );
  }

  Widget _buildRosterList(List<_RosterEntry> roster, Color accentColor) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: roster.length,
      itemBuilder: (context, index) {
        final entry = roster[index];
        return _buildPlayerCard(entry, accentColor);
      },
    );
  }

  Widget _buildPlayerCard(_RosterEntry entry, Color accentColor) {
    final posColor = _positionColor(entry.position);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF141829),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: accentColor.withValues(alpha: 0.1),
        ),
      ),
      child: Row(
        children: [
          // Position badge
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: posColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: Text(
              entry.position,
              style: TextStyle(
                color: posColor,
                fontSize: 11,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Player info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.playerName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  entry.statLine,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.45),
                    fontSize: 10,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Points
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                entry.hasPlayed
                    ? entry.actualPoints.toStringAsFixed(1)
                    : '—',
                style: TextStyle(
                  color: entry.hasPlayed ? Colors.white : Colors.white38,
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                'Proj ${entry.projectedPoints.toStringAsFixed(1)}',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.4),
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  Color _parseColor(dynamic value) {
    if (value is int) return Color(value);
    if (value is String) {
      final hex = value.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    }
    return const Color(0xFF00E5FF);
  }

  IconData _getTeamIcon(dynamic iconIndex) {
    if (iconIndex is int &&
        iconIndex >= 0 &&
        iconIndex < TeamDefaults.iconOptions.length) {
      return TeamDefaults.iconOptions[iconIndex];
    }
    return Icons.sports_football;
  }

  Color _positionColor(String position) {
    switch (position) {
      case 'QB':
        return const Color(0xFFFF5252);
      case 'RB':
        return const Color(0xFF69F0AE);
      case 'WR':
        return const Color(0xFF448AFF);
      case 'TE':
        return const Color(0xFFFFAB40);
      case 'K':
        return const Color(0xFFB388FF);
      case 'DEF':
        return const Color(0xFF26C6DA);
      default:
        return Colors.grey;
    }
  }

  /// Generates deterministic simulated data from player/team/week hash.
  List<_RosterEntry> _buildRosterData(List<DraftPick> picks, String teamId) {
    final entries = <_RosterEntry>[];

    for (final pick in picks) {
      final playerId = pick.playerId ?? '';
      final player = _findPlayer(playerId);
      final name = player?.name ?? pick.playerName ?? 'Unknown';
      final position = player?.position ?? pick.playerPosition ?? 'WR';

      // Deterministic seed from player ID + team ID + week
      final seed = _hashCode('$playerId-$teamId-${widget.week}');
      final rng = Random(seed);

      final projected = 5.0 + rng.nextDouble() * 25.0;
      final variance = (rng.nextDouble() - 0.4) * 10.0;
      final actual = max(0.0, projected + variance);
      final hasPlayed = rng.nextDouble() > 0.2; // 80% have played
      final isBench = picks.indexOf(pick) >= 9; // First 9 are starters

      final statLine = _generateStatLine(position, actual, rng);

      entries.add(_RosterEntry(
        playerId: playerId,
        playerName: name,
        position: position,
        projectedPoints: double.parse(projected.toStringAsFixed(1)),
        actualPoints: double.parse(actual.toStringAsFixed(1)),
        hasPlayed: hasPlayed,
        isBench: isBench,
        statLine: statLine,
      ));
    }

    // Sort: starters first (by position order), then bench
    entries.sort((a, b) {
      if (a.isBench != b.isBench) return a.isBench ? 1 : -1;
      return _positionOrder(a.position).compareTo(_positionOrder(b.position));
    });

    return entries;
  }

  int _positionOrder(String pos) {
    const order = {'QB': 0, 'RB': 1, 'WR': 2, 'TE': 3, 'K': 4, 'DEF': 5};
    return order[pos] ?? 6;
  }

  Player? _findPlayer(String id) {
    try {
      return PlayerPool.players.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }

  int _hashCode(String input) {
    var hash = 0;
    for (var i = 0; i < input.length; i++) {
      hash = (31 * hash + input.codeUnitAt(i)) & 0x7FFFFFFF;
    }
    return hash;
  }

  String _generateStatLine(String position, double points, Random rng) {
    switch (position) {
      case 'QB':
        final comp = 18 + rng.nextInt(18);
        final att = comp + 5 + rng.nextInt(12);
        final yds = 150 + rng.nextInt(250);
        final td = rng.nextInt(4);
        return '$comp/$att, $yds yds, $td TD';
      case 'RB':
        final car = 10 + rng.nextInt(18);
        final yds = 30 + rng.nextInt(120);
        final td = rng.nextInt(3);
        return '$car car, $yds yds, $td TD';
      case 'WR':
        final rec = 2 + rng.nextInt(9);
        final yds = 20 + rng.nextInt(140);
        final td = rng.nextInt(2);
        return '$rec rec, $yds yds, $td TD';
      case 'TE':
        final rec = 2 + rng.nextInt(7);
        final yds = 15 + rng.nextInt(90);
        final td = rng.nextInt(2);
        return '$rec rec, $yds yds, $td TD';
      case 'K':
        final fg = rng.nextInt(4);
        final xp = 1 + rng.nextInt(5);
        return '$fg FG, $xp XP';
      case 'DEF':
        final sacks = rng.nextInt(5);
        final ints = rng.nextInt(3);
        final pts = rng.nextInt(28);
        return '$sacks sack, $ints INT, $pts PA';
      default:
        return '';
    }
  }

  double _totalActual(List<_RosterEntry> roster) {
    return roster
        .where((e) => !e.isBench && e.hasPlayed)
        .fold(0.0, (sum, e) => sum + e.actualPoints);
  }

  double _totalProjected(List<_RosterEntry> roster) {
    return roster
        .where((e) => !e.isBench)
        .fold(0.0, (sum, e) => sum + e.projectedPoints);
  }

  String _highestScorer(List<_RosterEntry> roster) {
    if (roster.isEmpty) return '—';
    final starters = roster.where((e) => !e.isBench && e.hasPlayed).toList();
    if (starters.isEmpty) return '—';
    starters.sort((a, b) => b.actualPoints.compareTo(a.actualPoints));
    final top = starters.first;
    return '${top.playerName.split(' ').last} ${top.actualPoints.toStringAsFixed(1)}';
  }

  double _benchPoints(List<_RosterEntry> roster) {
    return roster
        .where((e) => e.isBench && e.hasPlayed)
        .fold(0.0, (sum, e) => sum + e.actualPoints);
  }

  int _yetToPlay(List<_RosterEntry> roster) {
    return roster.where((e) => !e.isBench && !e.hasPlayed).length;
  }
}

class _RosterEntry {
  const _RosterEntry({
    required this.playerId,
    required this.playerName,
    required this.position,
    required this.projectedPoints,
    required this.actualPoints,
    required this.hasPlayed,
    required this.isBench,
    required this.statLine,
  });

  final String playerId;
  final String playerName;
  final String position;
  final double projectedPoints;
  final double actualPoints;
  final bool hasPlayed;
  final bool isBench;
  final String statLine;
}
