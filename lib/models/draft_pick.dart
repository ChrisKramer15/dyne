import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents a single draft pick.
class DraftPick {
  const DraftPick({
    required this.round,
    required this.pick,
    required this.overallPick,
    required this.teamId,
    this.playerId,
    this.playerName,
    this.playerPosition,
    this.playerTeam,
    this.timestamp,
  });

  final int round;
  final int pick;
  final int overallPick;
  final String teamId;
  final String? playerId;
  final String? playerName;
  final String? playerPosition;
  final String? playerTeam;
  final DateTime? timestamp;

  bool get isComplete => playerId != null;

  Map<String, dynamic> toMap() => {
        'round': round,
        'pick': pick,
        'overallPick': overallPick,
        'teamId': teamId,
        'playerId': playerId,
        'playerName': playerName,
        'playerPosition': playerPosition,
        'playerTeam': playerTeam,
        'timestamp': timestamp != null ? Timestamp.fromDate(timestamp!) : null,
      };

  factory DraftPick.fromMap(Map<String, dynamic> map) => DraftPick(
        round: map['round'] ?? 0,
        pick: map['pick'] ?? 0,
        overallPick: map['overallPick'] ?? 0,
        teamId: map['teamId'] ?? '',
        playerId: map['playerId'],
        playerName: map['playerName'],
        playerPosition: map['playerPosition'],
        playerTeam: map['playerTeam'],
        timestamp: (map['timestamp'] as Timestamp?)?.toDate(),
      );
}
