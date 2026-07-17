import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/draft_pick.dart';
import '../models/player.dart';

/// Service for managing a live draft in Firestore.
class DraftService {
  DraftService(this.leagueId);

  final String leagueId;
  final _firestore = FirebaseFirestore.instance;

  String get _currentUserId => FirebaseAuth.instance.currentUser!.uid;

  DocumentReference get _draftRef =>
      _firestore.collection('leagues').doc(leagueId).collection('draft').doc('state');

  CollectionReference get _picksRef =>
      _firestore.collection('leagues').doc(leagueId).collection('draft_picks');

  CollectionReference get _chatRef =>
      _firestore.collection('leagues').doc(leagueId).collection('draft_chat');

  /// Initialize a draft with the pick order based on draft type.
  Future<void> initializeDraft({
    required List<String> teamIds,
    required String draftType,
    required int rounds,
    required int pickTimerSeconds,
  }) async {
    final picks = _generatePickOrder(teamIds, draftType, rounds);

    // Write picks first (in batches of 450 to stay under Firestore limit)
    for (var i = 0; i < picks.length; i += 450) {
      final batch = _firestore.batch();
      final chunk = picks.skip(i).take(450);
      for (final pick in chunk) {
        final docRef = _picksRef.doc('pick_${pick.overallPick}');
        batch.set(docRef, pick.toMap());
      }
      await batch.commit();
    }

    // Only set draft state after picks are fully written
    await _draftRef.set({
      'status': 'active',
      'draftType': draftType,
      'currentPick': 1,
      'totalPicks': picks.length,
      'rounds': rounds,
      'teamCount': teamIds.length,
      'teamIds': teamIds,
      'pickTimerSeconds': pickTimerSeconds,
      'pickStartedAt': FieldValue.serverTimestamp(),
      'draftedPlayerIds': <String>[],
      'startedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Regenerate picks only (when state exists but picks are missing).
  Future<void> regeneratePicks({
    required List<String> teamIds,
    required String draftType,
    required int rounds,
  }) async {
    final testDoc = _picksRef.doc('_test_write');

    try {
      await testDoc.set({'test': true, 'timestamp': FieldValue.serverTimestamp()});
    } catch (e) {
      rethrow;
    }

    try {
      final readBack = await testDoc.get();
      if (!readBack.exists) {
        throw Exception('Write succeeded but read failed. Path: ${testDoc.path}');
      }
    } catch (e) {
      rethrow;
    }

    await testDoc.delete();

    final picks = _generatePickOrder(teamIds, draftType, rounds);

    if (picks.isEmpty) {
      throw Exception('Generated 0 picks. teamIds=${teamIds.length}, rounds=$rounds');
    }

    for (var i = 0; i < picks.length; i += 450) {
      final batch = _firestore.batch();
      final chunk = picks.skip(i).take(450);
      for (final pick in chunk) {
        final docRef = _picksRef.doc('pick_${pick.overallPick}');
        batch.set(docRef, pick.toMap());
      }
      await batch.commit();
    }

    await _draftRef.update({
      'currentPick': 1,
      'totalPicks': picks.length,
      'pickStartedAt': FieldValue.serverTimestamp(),
      'draftedPlayerIds': <String>[],
    });
  }

  List<DraftPick> _generatePickOrder(
      List<String> teamIds, String draftType, int rounds) {
    final picks = <DraftPick>[];
    var overall = 1;

    for (int round = 1; round <= rounds; round++) {
      List<String> order;

      switch (draftType) {
        case 'Snake':
          order = round.isOdd ? teamIds : teamIds.reversed.toList();
          break;
        case 'Linear':
          order = teamIds;
          break;
        case 'Auction':
          // Auction doesn't have a traditional order, but we still track rounds
          order = teamIds;
          break;
        default:
          order = teamIds;
      }

      for (int i = 0; i < order.length; i++) {
        picks.add(DraftPick(
          round: round,
          pick: i + 1,
          overallPick: overall,
          teamId: order[i],
        ));
        overall++;
      }
    }

    return picks;
  }

  /// Stream the draft state.
  Stream<Map<String, dynamic>> streamDraftState() {
    return _draftRef.snapshots().map(
          (doc) => doc.data() as Map<String, dynamic>? ?? {},
        );
  }

  /// Stream all picks.
  Stream<List<DraftPick>> streamPicks() {
    return _picksRef.snapshots().map(
          (snapshot) {
            final picks = snapshot.docs
                .map((doc) => DraftPick.fromMap(doc.data() as Map<String, dynamic>))
                .toList();
            picks.sort((a, b) => a.overallPick.compareTo(b.overallPick));
            return picks;
          },
        );
  }

  /// Make a pick.
  Future<void> makePick(int overallPick, Player player) async {
    final pickRef = _picksRef.doc('pick_$overallPick');

    // Get the team info for the pick announcement
    final pickDoc = await pickRef.get();
    final pickData = pickDoc.data() as Map<String, dynamic>? ?? {};
    final teamId = pickData['teamId'] as String? ?? '';

    await pickRef.update({
      'playerId': player.id,
      'playerName': player.name,
      'playerPosition': player.position,
      'playerTeam': player.team,
      'timestamp': FieldValue.serverTimestamp(),
    });

    // Advance to next pick and reset timer
    await _draftRef.update({
      'currentPick': overallPick + 1,
      'pickStartedAt': FieldValue.serverTimestamp(),
      'draftedPlayerIds': FieldValue.arrayUnion([player.id]),
    });

    // Post pick announcement to draft chat
    // Get team name for the announcement
    final teamDoc = await _firestore
        .collection('leagues')
        .doc(leagueId)
        .collection('teams')
        .doc(teamId)
        .get();
    final teamName = teamDoc.data()?['name'] as String? ?? 'Team';

    await _chatRef.add({
      'senderId': 'system',
      'senderName': 'Draft Bot',
      'text': '🏈 Pick #$overallPick: $teamName selects ${player.name} (${player.position} - ${player.team})',
      'isSystem': true,
      'timestamp': FieldValue.serverTimestamp(),
    });
  }

  /// Auto-pick for a team — uses their queue first, then best available by rank.
  Future<void> autoPick(int overallPick, List<String> draftedPlayerIds, {String? teamId}) async {
    // Check if the team has a queue
    if (teamId != null) {
      final queueDoc = await _draftRef.collection('queues').doc(teamId).get();
      if (queueDoc.exists) {
        final queueIds = List<String>.from(
            (queueDoc.data() as Map<String, dynamic>)['playerIds'] ?? []);

        // Find the first queued player that's still available
        for (final playerId in queueIds) {
          if (!draftedPlayerIds.contains(playerId)) {
            final player = PlayerPool.players.where((p) => p.id == playerId).firstOrNull;
            if (player != null) {
              await makePick(overallPick, player);
              // Remove picked player from queue
              queueIds.remove(playerId);
              await _draftRef.collection('queues').doc(teamId).set({
                'playerIds': queueIds,
              });
              return;
            }
          }
        }
      }
    }

    // Smart fallback: pick based on roster needs
    final available = PlayerPool.players
        .where((p) => !draftedPlayerIds.contains(p.id))
        .toList()
      ..sort((a, b) => a.rank.compareTo(b.rank));

    if (available.isEmpty) return;

    // Try to determine roster needs
    if (teamId != null) {
      try {
        final leagueDoc = await _firestore.collection('leagues').doc(leagueId).get();
        final leagueData = leagueDoc.data() ?? {};
        final rosterSlots = Map<String, int>.from(leagueData['rosterSlots'] ?? {});

        if (rosterSlots.isNotEmpty) {
          // Count what the team has already drafted by position
          final teamPicks = await _picksRef
              .where('teamId', isEqualTo: teamId)
              .get();
          final positionCounts = <String, int>{};
          for (final doc in teamPicks.docs) {
            final data = doc.data() as Map<String, dynamic>;
            final pos = data['playerPosition'] as String?;
            if (pos != null) {
              positionCounts[pos] = (positionCounts[pos] ?? 0) + 1;
            }
          }

          // Map roster slot names to position abbreviations
          final slotNeeds = <String, int>{};
          for (final entry in rosterSlots.entries) {
            final abbrev = _slotToPosition(entry.key);
            if (abbrev != null) {
              slotNeeds[abbrev] = (slotNeeds[abbrev] ?? 0) + entry.value;
            }
          }

          // Find positions that still have unfilled starter slots
          final neededPositions = <String>[];
          for (final entry in slotNeeds.entries) {
            final have = positionCounts[entry.key] ?? 0;
            if (have < entry.value) {
              neededPositions.add(entry.key);
            }
          }

          // If there are unfilled needs, pick the highest-ranked player at a needed position
          if (neededPositions.isNotEmpty) {
            final needPick = available.where(
                (p) => neededPositions.contains(p.position)).firstOrNull;
            if (needPick != null) {
              await makePick(overallPick, needPick);
              return;
            }
          }
        }
      } catch (_) {
        // Fall through to best available if roster logic fails
      }
    }

    // Final fallback: best available by rank
    await makePick(overallPick, available.first);
  }

  /// Map roster slot display names to position abbreviations.
  String? _slotToPosition(String slot) {
    switch (slot) {
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
      default:
        return null; // Flex, Bench, etc. — don't restrict
    }
  }

  /// Get a team's autopick preference.
  Future<Map<String, dynamic>> getAutopickPreference(String teamId) async {
    final doc = await _draftRef.collection('autopick').doc(teamId).get();
    if (!doc.exists) return {'mode': 'never', 'picksRemaining': 0};
    return doc.data() as Map<String, dynamic>;
  }

  /// Update a team's autopick preference.
  /// mode: 'always', 'never', 'next1', 'next2', 'next3', 'next5'
  Future<void> updateAutopickPreference(String teamId, String mode) async {
    int picksRemaining;
    switch (mode) {
      case 'always':
        picksRemaining = -1; // infinite
        break;
      case 'next1':
        picksRemaining = 1;
        break;
      case 'next2':
        picksRemaining = 2;
        break;
      case 'next3':
        picksRemaining = 3;
        break;
      case 'next5':
        picksRemaining = 5;
        break;
      default:
        picksRemaining = 0; // never
    }

    await _draftRef.collection('autopick').doc(teamId).set({
      'mode': mode,
      'picksRemaining': picksRemaining,
    });
  }

  /// Decrement autopick counter after a pick is made. Returns true if autopick should still fire.
  Future<bool> shouldAutopick(String teamId) async {
    final doc = await _draftRef.collection('autopick').doc(teamId).get();
    if (!doc.exists) return false;
    final data = doc.data() as Map<String, dynamic>;
    final mode = data['mode'] as String? ?? 'never';
    final remaining = data['picksRemaining'] as int? ?? 0;

    if (mode == 'never') return false;
    if (mode == 'always') return true;

    // Countdown modes
    if (remaining > 0) {
      await _draftRef.collection('autopick').doc(teamId).update({
        'picksRemaining': remaining - 1,
        'mode': remaining - 1 <= 0 ? 'never' : mode,
      });
      return true;
    }
    return false;
  }

  /// Send a chat message in the draft room.
  Future<void> sendMessage(String text, {String? senderName}) async {
    // Get team name if not provided
    String name = senderName ?? '';
    if (name.isEmpty) {
      final teamDoc = await _firestore
          .collection('leagues')
          .doc(leagueId)
          .collection('teams')
          .doc(_currentUserId)
          .get();
      name = teamDoc.data()?['name'] as String? ?? 'Unknown';
    }

    await _chatRef.add({
      'senderId': _currentUserId,
      'senderName': name,
      'text': text,
      'isSystem': false,
      'timestamp': FieldValue.serverTimestamp(),
    });
  }

  /// Stream draft chat messages.
  Stream<List<Map<String, dynamic>>> streamChat() {
    return _chatRef.orderBy('timestamp', descending: false).snapshots().map(
          (snapshot) => snapshot.docs
              .map((doc) => doc.data() as Map<String, dynamic>)
              .toList(),
        );
  }

  /// Pause the draft. Records how many seconds have elapsed so far.
  Future<void> pauseDraft() async {
    final stateDoc = await _draftRef.get();
    final state = stateDoc.data() as Map<String, dynamic>? ?? {};
    final pickStartedAt = (state['pickStartedAt'] as Timestamp?)?.toDate();
    final elapsed = pickStartedAt != null
        ? DateTime.now().difference(pickStartedAt).inSeconds
        : 0;

    await _draftRef.update({
      'status': 'paused',
      'pausedElapsedSeconds': elapsed,
    });
  }

  /// Resume the draft. Restores the timer from where it was paused.
  Future<void> resumeDraft() async {
    final stateDoc = await _draftRef.get();
    final state = stateDoc.data() as Map<String, dynamic>? ?? {};
    final pausedElapsed = state['pausedElapsedSeconds'] as int? ?? 0;

    // Set pickStartedAt back in time so the elapsed calculation picks up where we left off
    final resumedStartAt = DateTime.now().subtract(Duration(seconds: pausedElapsed));

    await _draftRef.update({
      'status': 'active',
      'pickStartedAt': Timestamp.fromDate(resumedStartAt),
      'pausedElapsedSeconds': FieldValue.delete(),
    });
  }

  /// Complete the draft.
  Future<void> completeDraft() async {
    await _draftRef.update({'status': 'completed'});
    await _firestore.collection('leagues').doc(leagueId).update({
      'draftCompleted': true,
    });
  }

  /// Get the current user's queue.
  Future<List<String>> getQueue() async {
    final doc = await _draftRef.collection('queues').doc(_currentUserId).get();
    if (!doc.exists) return [];
    return List<String>.from((doc.data() as Map<String, dynamic>)['playerIds'] ?? []);
  }

  /// Update the current user's queue.
  Future<void> updateQueue(List<String> playerIds) async {
    await _draftRef.collection('queues').doc(_currentUserId).set({
      'playerIds': playerIds,
    });
  }

  /// Reset the draft — deletes all picks, chat, queues, and clears draft state.
  Future<void> resetDraft() async {
    // Delete all pick documents
    final picksSnapshot = await _picksRef.get();
    final batch = _firestore.batch();
    for (final doc in picksSnapshot.docs) {
      batch.delete(doc.reference);
    }
    await batch.commit();

    // Delete all draft chat messages
    final chatSnapshot = await _chatRef.get();
    if (chatSnapshot.docs.isNotEmpty) {
      final chatBatch = _firestore.batch();
      for (final doc in chatSnapshot.docs) {
        chatBatch.delete(doc.reference);
      }
      await chatBatch.commit();
    }

    // Delete all queues
    final queuesSnapshot = await _draftRef.collection('queues').get();
    if (queuesSnapshot.docs.isNotEmpty) {
      final queueBatch = _firestore.batch();
      for (final doc in queuesSnapshot.docs) {
        queueBatch.delete(doc.reference);
      }
      await queueBatch.commit();
    }

    // Reset the draft state document
    await _draftRef.delete();

    // Reset draftCompleted flag on the league
    await _firestore.collection('leagues').doc(leagueId).update({
      'draftCompleted': false,
    });
  }
}
