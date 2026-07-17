import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/league.dart';

/// Service for managing leagues in Firestore.
class LeagueService {
  final _firestore = FirebaseFirestore.instance;
  final _auth = FirebaseAuth.instance;

  CollectionReference get _leaguesRef => _firestore.collection('leagues');

  String get _currentUserId => _auth.currentUser!.uid;

  /// Generate a unique invite code (12 characters, no dashes).
  String _generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final random = Random.secure();
    return List.generate(12, (_) => chars[random.nextInt(chars.length)]).join();
  }

  /// Create a new league. The current user becomes the commissioner.
  Future<League> createLeague({
    required String name,
    int maxMembers = 12,
    String leagueType = 'Redraft',
    bool salariesEnabled = false,
    bool contractsEnabled = false,
    bool schemesEnabled = false,
    bool practiceSquadEnabled = false,
    int practiceSquadSize = 10,
    String scoringFormat = 'PPR',
    Map<String, double> scoringValues = const {},
    Map<String, bool> scoringEnabled = const {},
    String rosterPreset = 'Classic',
    Map<String, int> rosterSlots = const {},
    String draftType = 'Snake',
    String roundMode = 'Fill Roster',
    int roundCount = 15,
    int regularSeasonWeeks = 14,
    int playoffTeams = 4,
    String tradeDeadline = 'Week 10',
    String waiverFormat = 'Rolling',
    int faabBudget = 100,
    bool practiceSquadStealing = false,
    int minimumRosterSize = 10,
    bool scoutCollegePlayers = false,
    bool contractNegotiations = false,
  }) async {
    final inviteCode = _generateInviteCode();

    final docRef = await _leaguesRef.add({
      'name': name,
      'inviteCode': inviteCode,
      'commissionerId': _currentUserId,
      'memberIds': [_currentUserId],
      'maxMembers': maxMembers,
      'createdAt': FieldValue.serverTimestamp(),
      'leagueType': leagueType,
      'salariesEnabled': salariesEnabled,
      'contractsEnabled': contractsEnabled,
      'schemesEnabled': schemesEnabled,
      'practiceSquadEnabled': practiceSquadEnabled,
      'practiceSquadSize': practiceSquadSize,
      'scoringFormat': scoringFormat,
      'scoringValues': scoringValues,
      'scoringEnabled': scoringEnabled,
      'rosterPreset': rosterPreset,
      'rosterSlots': rosterSlots,
      'draftType': draftType,
      'roundMode': roundMode,
      'roundCount': roundCount,
      'regularSeasonWeeks': regularSeasonWeeks,
      'playoffTeams': playoffTeams,
      'tradeDeadline': tradeDeadline,
      'waiverFormat': waiverFormat,
      'faabBudget': faabBudget,
      'practiceSquadStealing': practiceSquadStealing,
      'minimumRosterSize': minimumRosterSize,
      'scoutCollegePlayers': scoutCollegePlayers,
      'contractNegotiations': contractNegotiations,
    });

    final doc = await docRef.get();
    return League.fromFirestore(doc);
  }

  /// Get a single league by ID.
  Future<League> getLeague(String leagueId) async {
    final doc = await _leaguesRef.doc(leagueId).get();
    return League.fromFirestore(doc);
  }

  /// Stream a single league for real-time updates.
  Stream<League> streamLeague(String leagueId) {
    return _leaguesRef.doc(leagueId).snapshots().where((doc) => doc.exists).map(
          (doc) => League.fromFirestore(doc),
        );
  }

  /// Set the draft start time for a league.
  Future<void> setDraftTime(String leagueId, DateTime draftTime) async {
    await _leaguesRef.doc(leagueId).update({
      'draftStartTime': Timestamp.fromDate(draftTime),
    });
  }

  /// Give a strike to a member. Auto-removes on 3rd strike.
  Future<void> giveStrike(String leagueId, String memberId) async {
    final doc = await _leaguesRef.doc(leagueId).get();
    final data = doc.data() as Map<String, dynamic>;
    final strikes = Map<String, int>.from(data['memberStrikes'] ?? {});
    final currentStrikes = (strikes[memberId] ?? 0) + 1;
    strikes[memberId] = currentStrikes;

    if (currentStrikes >= 3) {
      // Auto-remove on 3rd strike and set team to AI
      await _leaguesRef.doc(leagueId).update({
        'memberStrikes': strikes,
        'memberIds': FieldValue.arrayRemove([memberId]),
        'aiTeams': FieldValue.arrayUnion([memberId]),
      });
    } else {
      await _leaguesRef.doc(leagueId).update({
        'memberStrikes': strikes,
      });
    }
  }

  /// Remove a member from the league and set their team to AI.
  Future<void> removeMember(String leagueId, String memberId) async {
    await _leaguesRef.doc(leagueId).update({
      'memberIds': FieldValue.arrayRemove([memberId]),
      'aiTeams': FieldValue.arrayUnion([memberId]),
    });
  }

  /// Delete a league and all its subcollections.
  Future<void> deleteLeague(String leagueId) async {
    final leagueDoc = _leaguesRef.doc(leagueId);

    // Delete the league document — this is the only critical operation
    await leagueDoc.delete();

    // Fire-and-forget cleanup of subcollections
    _cleanupSubcollections(leagueDoc);
  }

  /// Best-effort cleanup of league subcollections after the main doc is deleted.
  Future<void> _cleanupSubcollections(DocumentReference leagueDoc) async {
    try {
      await _deleteSubcollection(leagueDoc.collection('teams'));
      await _deleteSubcollection(leagueDoc.collection('draft_picks'));
      await _deleteSubcollection(leagueDoc.collection('draft_chat'));

      final draftStateDoc = leagueDoc.collection('draft').doc('state');
      await _deleteSubcollection(draftStateDoc.collection('queues'));
      await _deleteSubcollection(leagueDoc.collection('draft'));

      final channels = await leagueDoc.collection('channels').get();
      for (final channel in channels.docs) {
        await _deleteSubcollection(channel.reference.collection('messages'));
        await channel.reference.delete();
      }

      final dms = await leagueDoc.collection('league_dms').get();
      for (final dm in dms.docs) {
        await _deleteSubcollection(dm.reference.collection('messages'));
        await dm.reference.delete();
      }
    } catch (_) {
      // Best-effort — subcollection cleanup may partially fail
    }
  }

  Future<void> _deleteSubcollection(CollectionReference collection) async {
    final snapshots = await collection.get();
    for (final doc in snapshots.docs) {
      await doc.reference.delete();
    }
  }

  /// Toggle a team between user-controlled and AI-controlled.
  Future<void> toggleAiTeam(String leagueId, String memberId, bool isAi) async {
    if (isAi) {
      await _leaguesRef.doc(leagueId).update({
        'aiTeams': FieldValue.arrayUnion([memberId]),
      });
    } else {
      await _leaguesRef.doc(leagueId).update({
        'aiTeams': FieldValue.arrayRemove([memberId]),
      });
    }
  }

  /// Join a league by invite code.
  /// Automatically replaces an AI bot slot with the joining user.
  /// Returns the league on success, throws on failure.
  Future<League> joinLeague(String inviteCode) async {
    final query = await _leaguesRef
        .where('inviteCode', isEqualTo: inviteCode.toUpperCase().trim())
        .limit(1)
        .get();

    if (query.docs.isEmpty) {
      throw LeagueException('Invalid invite code. No league found.');
    }

    final doc = query.docs.first;
    final league = League.fromFirestore(doc);

    if (league.memberIds.contains(_currentUserId)) {
      throw LeagueException('You are already a member of this league.');
    }

    // Check if there's an AI bot slot to replace
    if (league.aiTeams.isNotEmpty) {
      // Replace the first AI bot with this user
      final botId = league.aiTeams.first;
      await replaceBotWithUser(doc.id, botId, _currentUserId);
    } else if (!league.isFull) {
      // No bots available but league has room — just add the user
      await doc.reference.update({
        'memberIds': FieldValue.arrayUnion([_currentUserId]),
      });
    } else {
      throw LeagueException(
          'This league is full (${league.maxMembers} members max).');
    }

    // Return updated league
    final updated = await doc.reference.get();
    return League.fromFirestore(updated);
  }

  /// Replace a bot team with a real user.
  /// Transfers the bot's slot in memberIds, removes from aiTeams,
  /// and deletes the bot's team doc so the user can create their own.
  Future<void> replaceBotWithUser(String leagueId, String botId, String userId) async {
    final leagueRef = _leaguesRef.doc(leagueId);

    // Swap the bot for the user in memberIds and remove from aiTeams
    await leagueRef.update({
      'memberIds': FieldValue.arrayRemove([botId]),
      'aiTeams': FieldValue.arrayRemove([botId]),
    });
    await leagueRef.update({
      'memberIds': FieldValue.arrayUnion([userId]),
    });

    // Delete the bot's team document so the new user can set up their own
    await leagueRef.collection('teams').doc(botId).delete();
  }

  /// Get all leagues the current user belongs to.
  Stream<List<League>> getUserLeagues() {
    return _leaguesRef
        .where('memberIds', arrayContains: _currentUserId)
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map((doc) => League.fromFirestore(doc)).toList());
  }
}

class LeagueException implements Exception {
  LeagueException(this.message);
  final String message;

  @override
  String toString() => message;
}
