import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models/player.dart';
import '../utils/team_defaults.dart';

/// Shows incoming and outgoing trade proposals with accept/reject/counter actions.
class TradeInbox extends StatelessWidget {
  const TradeInbox({super.key, required this.leagueId, this.onCounter});

  final String leagueId;
  final void Function(TradeCounterData data)? onCounter;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final uid = FirebaseAuth.instance.currentUser!.uid;

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(leagueId)
          .collection('trades')
          .where('status', isEqualTo: 'pending')
          .snapshots(),
      builder: (context, snap) {
        final trades = snap.data?.docs ?? [];

        // Auto-cancel trades with picks that are no longer available
        _checkAndCancelInvalidTrades(trades);

        final incoming = trades.where((t) {
          final data = t.data() as Map<String, dynamic>;
          return data['targetId'] == uid;
        }).toList()
          ..sort((a, b) {
            final aTime = ((a.data() as Map<String, dynamic>)['createdAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
            final bTime = ((b.data() as Map<String, dynamic>)['createdAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
            return bTime.compareTo(aTime);
          });
        final outgoing = trades.where((t) {
          final data = t.data() as Map<String, dynamic>;
          return data['proposerId'] == uid;
        }).toList()
          ..sort((a, b) {
            final aTime = ((a.data() as Map<String, dynamic>)['createdAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
            final bTime = ((b.data() as Map<String, dynamic>)['createdAt'] as Timestamp?)?.millisecondsSinceEpoch ?? 0;
            return bTime.compareTo(aTime);
          });

        if (incoming.isEmpty && outgoing.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.swap_horiz, size: 48, color: colorScheme.onSurface.withValues(alpha: 0.1)),
                const SizedBox(height: 8),
                Text('No pending trades', style: TextStyle(fontSize: 13, color: colorScheme.onSurface.withValues(alpha: 0.3))),
              ],
            ),
          );
        }

        return ListView(
          padding: const EdgeInsets.all(16),
          physics: const BouncingScrollPhysics(),
          children: [
            if (incoming.isNotEmpty) ...[
              _buildSectionHeader('INCOMING', const Color(0xFF00E676), colorScheme),
              const SizedBox(height: 8),
              ...incoming.map((doc) => _TradeCard(
                    leagueId: leagueId,
                    tradeDoc: doc,
                    isIncoming: true,
                    onCounter: onCounter,
                  )),
            ],
            if (outgoing.isNotEmpty) ...[
              const SizedBox(height: 16),
              _buildSectionHeader('SENT', const Color(0xFF2979FF), colorScheme),
              const SizedBox(height: 8),
              ...outgoing.map((doc) => _TradeCard(
                    leagueId: leagueId,
                    tradeDoc: doc,
                    isIncoming: false,
                    onCounter: null,
                  )),
            ],
          ],
        );
      },
    );
  }

  void _checkAndCancelInvalidTrades(List<QueryDocumentSnapshot> trades) {
    for (final trade in trades) {
      final data = trade.data() as Map<String, dynamic>;
      final offeredPicks = List<int>.from(data['offeredPicks'] ?? []);
      final requestedPicks = List<int>.from(data['requestedPicks'] ?? []);
      final allPicks = [...offeredPicks, ...requestedPicks];

      if (allPicks.isEmpty) continue;

      // Check each pick asynchronously
      _validateTradePicksAsync(trade.reference, allPicks);
    }
  }

  Future<void> _validateTradePicksAsync(DocumentReference tradeRef, List<int> pickNums) async {
    final picksRef = FirebaseFirestore.instance
        .collection('leagues')
        .doc(leagueId)
        .collection('draft_picks');

    for (final pickNum in pickNums) {
      try {
        final pickDoc = await picksRef.doc('pick_$pickNum').get();
        if (pickDoc.exists) {
          final pickData = pickDoc.data() ?? {};
          if (pickData['playerId'] != null) {
            // Pick has been used — cancel the trade
            await tradeRef.update({'status': 'cancelled 404'});
            return;
          }
        }
      } catch (_) {
        // Ignore errors during validation
      }
    }
  }

  Widget _buildSectionHeader(String title, Color color, ColorScheme colorScheme) {
    return Row(
      children: [
        Container(width: 3, height: 14, decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: color)),
        const SizedBox(width: 8),
        Text(title, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.5, color: color)),
      ],
    );
  }
}

class _TradeCard extends StatelessWidget {
  const _TradeCard({required this.leagueId, required this.tradeDoc, required this.isIncoming, this.onCounter});

  final String leagueId;
  final QueryDocumentSnapshot tradeDoc;
  final bool isIncoming;
  final void Function(TradeCounterData data)? onCounter;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final data = tradeDoc.data() as Map<String, dynamic>;
    final proposerId = data['proposerId'] as String? ?? '';
    final offeredPicks = List<int>.from(data['offeredPicks'] ?? []);
    final requestedPicks = List<int>.from(data['requestedPicks'] ?? []);
    final offeredPlayers = List<String>.from(data['offeredPlayers'] ?? []);
    final requestedPlayers = List<String>.from(data['requestedPlayers'] ?? []);
    final createdAt = data['createdAt'] as Timestamp?;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: const Color(0xFF141829),
        border: Border.all(
          color: isIncoming
              ? const Color(0xFF00E676).withValues(alpha: 0.2)
              : const Color(0xFF2979FF).withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Team name header
          StreamBuilder<DocumentSnapshot>(
            stream: FirebaseFirestore.instance
                .collection('leagues')
                .doc(leagueId)
                .collection('teams')
                .doc(proposerId)
                .snapshots(),
            builder: (context, teamSnap) {
              final teamData = teamSnap.data?.data() as Map<String, dynamic>? ?? {};
              final teamName = teamData['name'] as String? ?? 'Unknown Team';
              final teamColor = teamData['primaryColor'] != null
                  ? Color(teamData['primaryColor'] as int)
                  : colorScheme.primary;
              final iconIndex = teamData['iconIndex'] as int? ?? 0;

              return Row(
                children: [
                  Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: teamColor.withValues(alpha: 0.15),
                      border: Border.all(color: teamColor.withValues(alpha: 0.4)),
                    ),
                    child: Icon(
                      TeamDefaults.iconOptions[iconIndex.clamp(0, TeamDefaults.iconOptions.length - 1)],
                      size: 12, color: teamColor,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      isIncoming ? '$teamName wants to trade' : 'Sent to $teamName',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colorScheme.onSurface),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      color: const Color(0xFFFF8F00).withValues(alpha: 0.15),
                    ),
                    child: const Text('PENDING', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Color(0xFFFF8F00))),
                  ),
                ],
              );
            },
          ),
          if (createdAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                _formatEst(createdAt),
                style: TextStyle(fontSize: 9, color: colorScheme.onSurface.withValues(alpha: 0.25)),
              ),
            ),
          const SizedBox(height: 12),
          // Trade details
          Row(
            children: [
              // They give
              Expanded(
                child: _buildSide(
                  label: isIncoming ? 'They Give' : 'You Give',
                  picks: isIncoming ? offeredPicks : offeredPicks,
                  players: isIncoming ? offeredPlayers : offeredPlayers,
                  color: const Color(0xFF00E676),
                  colorScheme: colorScheme,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Icon(Icons.swap_horiz, size: 18, color: colorScheme.onSurface.withValues(alpha: 0.2)),
              ),
              // They receive
              Expanded(
                child: _buildSide(
                  label: isIncoming ? 'They Want' : 'You Receive',
                  picks: isIncoming ? requestedPicks : requestedPicks,
                  players: isIncoming ? requestedPlayers : requestedPlayers,
                  color: const Color(0xFFFF2D55),
                  colorScheme: colorScheme,
                ),
              ),
            ],
          ),
          // Action buttons (incoming only)
          if (isIncoming) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildActionButton(
                    context, 'Accept', const Color(0xFF00E676),
                    () => _handleAction(context, 'accepted'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildActionButton(
                    context, 'Reject', const Color(0xFFFF2D55),
                    () => _handleAction(context, 'rejected'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildActionButton(
                    context, 'Counter', const Color(0xFFFF8F00),
                    () => _counterTrade(context),
                  ),
                ),
              ],
            ),
          ],
          if (!isIncoming) ...[
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => _cancelTrade(context),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: const Color(0xFFFF2D55).withValues(alpha: 0.08),
                  border: Border.all(color: const Color(0xFFFF2D55).withValues(alpha: 0.3)),
                ),
                child: const Center(
                  child: Text(
                    'Cancel Trade',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFFF2D55)),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSide({
    required String label,
    required List<int> picks,
    required List<String> players,
    required Color color,
    required ColorScheme colorScheme,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color, letterSpacing: 0.5)),
        const SizedBox(height: 4),
        if (picks.isNotEmpty)
          ...picks.map((p) => Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text('Pick #$p', style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withValues(alpha: 0.7))),
              )),
        if (players.isNotEmpty)
          ...players.map((id) {
            final player = PlayerPool.players.where((p) => p.id == id).firstOrNull;
            return Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                player?.name ?? id,
                style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withValues(alpha: 0.7)),
                overflow: TextOverflow.ellipsis,
              ),
            );
          }),
        if (picks.isEmpty && players.isEmpty)
          Text('Nothing', style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withValues(alpha: 0.3))),
      ],
    );
  }

  String _formatEst(Timestamp ts) {
    final utc = ts.toDate().toUtc();
    final year = utc.year;
    final dstStart = DateTime.utc(year, 3, 8 + (7 - DateTime.utc(year, 3, 1).weekday) % 7, 7);
    final dstEnd = DateTime.utc(year, 11, 1 + (7 - DateTime.utc(year, 11, 1).weekday) % 7, 6);
    final isDst = utc.isAfter(dstStart) && utc.isBefore(dstEnd);
    final et = utc.add(Duration(hours: isDst ? -4 : -5));
    final h = et.hour > 12 ? et.hour - 12 : (et.hour == 0 ? 12 : et.hour);
    final amPm = et.hour >= 12 ? 'PM' : 'AM';
    return '${et.month}/${et.day} $h:${et.minute.toString().padLeft(2, '0')} $amPm ET';
  }

  Widget _buildActionButton(BuildContext context, String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: color.withValues(alpha: 0.12),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Center(
          child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
        ),
      ),
    );
  }

  Future<void> _handleAction(BuildContext context, String newStatus) async {
    try {
      if (newStatus == 'accepted') {
        await _executeTrade(context);
      }
      await tradeDoc.reference.update({'status': newStatus});
      if (context.mounted) {
        final msg = switch (newStatus) {
          'accepted' => 'Trade accepted!',
          'rejected' => 'Trade rejected.',
          'countered' => 'Trade countered.',
          'cancelled' => 'Trade cancelled.',
          _ => 'Trade updated.',
        };
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: newStatus == 'accepted' ? const Color(0xFF00E676) : const Color(0xFFFF8F00),
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        // Mark as failed if it was an accept attempt
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Trade failed: $e'),
          backgroundColor: const Color(0xFFFF2D55),
        ));
      }
    }
  }

  Future<void> _cancelTrade(BuildContext context) async {
    try {
      await tradeDoc.reference.update({'status': 'cancelled'});
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Trade cancelled.'), backgroundColor: Color(0xFFFF8F00)),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: const Color(0xFFFF2D55)));
      }
    }
  }

  Future<void> _counterTrade(BuildContext context) async {
    try {
      final data = tradeDoc.data() as Map<String, dynamic>;
      final proposerId = data['proposerId'] as String;
      final offeredPicks = List<int>.from(data['offeredPicks'] ?? []);
      final requestedPicks = List<int>.from(data['requestedPicks'] ?? []);
      final offeredPlayers = List<String>.from(data['offeredPlayers'] ?? []);
      final requestedPlayers = List<String>.from(data['requestedPlayers'] ?? []);

      // Mark the original trade as countered
      await tradeDoc.reference.update({'status': 'countered'});

      // Notify parent to switch to New Trade tab with pre-filled data
      onCounter?.call(TradeCounterData(
        targetTeamId: proposerId,
        myPicks: Set<int>.from(requestedPicks), // what they wanted = what I now offer
        theirPicks: Set<int>.from(offeredPicks), // what they offered = what I now want
        myPlayers: Set<String>.from(requestedPlayers),
        theirPlayers: Set<String>.from(offeredPlayers),
      ));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: const Color(0xFFFF2D55)));
      }
    }
  }

  /// Execute the trade — swap pick ownership and player ownership between the two teams.
  Future<void> _executeTrade(BuildContext context) async {
    final data = tradeDoc.data() as Map<String, dynamic>;
    final proposerId = data['proposerId'] as String;
    final targetId = data['targetId'] as String;
    final offeredPicks = List<int>.from(data['offeredPicks'] ?? []);
    final requestedPicks = List<int>.from(data['requestedPicks'] ?? []);
    final offeredPlayers = List<String>.from(data['offeredPlayers'] ?? []);
    final requestedPlayers = List<String>.from(data['requestedPlayers'] ?? []);

    final picksRef = FirebaseFirestore.instance
        .collection('leagues')
        .doc(leagueId)
        .collection('draft_picks');

    // Validate: ensure no traded picks have already been used
    for (final pickNum in [...offeredPicks, ...requestedPicks]) {
      final pickDoc = await picksRef.doc('pick_$pickNum').get();
      if (!pickDoc.exists) {
        throw Exception('Pick #$pickNum does not exist');
      }
      final pickData = pickDoc.data() ?? {};
      if (pickData['playerId'] != null) {
        throw Exception('Pick #$pickNum has already been used — trade the player instead');
      }
    }

    // Transfer offered picks (proposer → target)
    for (final pickNum in offeredPicks) {
      await picksRef.doc('pick_$pickNum').update({'teamId': targetId});
    }

    // Transfer requested picks (target → proposer)
    for (final pickNum in requestedPicks) {
      await picksRef.doc('pick_$pickNum').update({'teamId': proposerId});
    }

    // Transfer offered players (proposer → target)
    for (final playerId in offeredPlayers) {
      final playerPicks = await picksRef.where('playerId', isEqualTo: playerId).limit(1).get();
      for (final doc in playerPicks.docs) {
        await doc.reference.update({'teamId': targetId});
      }
    }

    // Transfer requested players (target → proposer)
    for (final playerId in requestedPlayers) {
      final playerPicks = await picksRef.where('playerId', isEqualTo: playerId).limit(1).get();
      for (final doc in playerPicks.docs) {
        await doc.reference.update({'teamId': proposerId});
      }
    }
  }
}

class TradeCounterData {
  const TradeCounterData({
    required this.targetTeamId,
    required this.myPicks,
    required this.theirPicks,
    required this.myPlayers,
    required this.theirPlayers,
  });

  final String targetTeamId;
  final Set<int> myPicks;
  final Set<int> theirPicks;
  final Set<String> myPlayers;
  final Set<String> theirPlayers;
}
