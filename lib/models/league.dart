import 'package:cloud_firestore/cloud_firestore.dart';

class League {
  League({
    required this.id,
    required this.name,
    required this.inviteCode,
    required this.commissionerId,
    required this.memberIds,
    required this.maxMembers,
    required this.createdAt,
    this.leagueType = 'Redraft',
    this.salariesEnabled = false,
    this.contractsEnabled = false,
    this.schemesEnabled = false,
    this.practiceSquadEnabled = false,
    this.practiceSquadSize = 10,
    this.scoringFormat = 'PPR',
    this.scoringValues = const {},
    this.scoringEnabled = const {},
    this.rosterPreset = 'Classic',
    this.rosterSlots = const {},
    this.draftType = 'Snake',
    this.roundMode = 'Fill Roster',
    this.roundCount = 15,
    this.regularSeasonWeeks = 14,
    this.playoffTeams = 4,
    this.tradeDeadline = 'Week 10',
    this.waiverFormat = 'Rolling',
    this.faabBudget = 100,
    this.practiceSquadStealing = false,
    this.minimumRosterSize = 10,
    this.scoutCollegePlayers = false,
    this.contractNegotiations = false,
    this.draftCompleted = false,
    this.draftStartTime,
    this.pickTimerSeconds = 120,
    this.sleepModeEnabled = false,
    this.sleepModeStart = '23:00',
    this.sleepModeEnd = '08:00',
    this.sleepModePickTimer = 480,
    this.memberStrikes = const {},
    this.aiTeams = const [],
  });

  final String id;
  final String name;
  final String inviteCode;
  final String commissionerId;
  final List<String> memberIds;
  final int maxMembers;
  final DateTime createdAt;

  // League Info
  final String leagueType;
  final bool salariesEnabled;
  final bool contractsEnabled;
  final bool schemesEnabled;
  final bool practiceSquadEnabled;
  final int practiceSquadSize;

  // Scoring
  final String scoringFormat;
  final Map<String, double> scoringValues;
  final Map<String, bool> scoringEnabled;

  // Roster
  final String rosterPreset;
  final Map<String, int> rosterSlots;

  // Draft Settings
  final String draftType;
  final String roundMode;
  final int roundCount;

  // Season Settings
  final int regularSeasonWeeks;
  final int playoffTeams;
  final String tradeDeadline;

  // Final Touches
  final String waiverFormat;
  final int faabBudget;
  final bool practiceSquadStealing;
  final int minimumRosterSize;
  final bool scoutCollegePlayers;
  final bool contractNegotiations;

  // Draft Status
  final bool draftCompleted;
  final DateTime? draftStartTime;
  final int pickTimerSeconds;
  final bool sleepModeEnabled;
  final String sleepModeStart;
  final String sleepModeEnd;
  final int sleepModePickTimer;

  // Member Management
  final Map<String, int> memberStrikes;
  final List<String> aiTeams;

  factory League.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return League(
      id: doc.id,
      name: data['name'] ?? '',
      inviteCode: data['inviteCode'] ?? '',
      commissionerId: data['commissionerId'] ?? '',
      memberIds: List<String>.from(data['memberIds'] ?? []),
      maxMembers: data['maxMembers'] ?? 12,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      leagueType: data['leagueType'] ?? 'Redraft',
      salariesEnabled: data['salariesEnabled'] ?? false,
      contractsEnabled: data['contractsEnabled'] ?? false,
      schemesEnabled: data['schemesEnabled'] ?? false,
      practiceSquadEnabled: data['practiceSquadEnabled'] ?? false,
      practiceSquadSize: data['practiceSquadSize'] ?? 10,
      scoringFormat: data['scoringFormat'] ?? 'PPR',
      scoringValues: Map<String, double>.from(data['scoringValues'] ?? {}),
      scoringEnabled: Map<String, bool>.from(data['scoringEnabled'] ?? {}),
      rosterPreset: data['rosterPreset'] ?? 'Classic',
      rosterSlots: Map<String, int>.from(data['rosterSlots'] ?? {}),
      draftType: data['draftType'] ?? 'Snake',
      roundMode: data['roundMode'] ?? 'Fill Roster',
      roundCount: data['roundCount'] ?? 15,
      regularSeasonWeeks: data['regularSeasonWeeks'] ?? 14,
      playoffTeams: data['playoffTeams'] ?? 4,
      tradeDeadline: data['tradeDeadline'] ?? 'Week 10',
      waiverFormat: data['waiverFormat'] ?? 'Rolling',
      faabBudget: data['faabBudget'] ?? 100,
      practiceSquadStealing: data['practiceSquadStealing'] ?? false,
      minimumRosterSize: data['minimumRosterSize'] ?? 10,
      scoutCollegePlayers: data['scoutCollegePlayers'] ?? false,
      contractNegotiations: data['contractNegotiations'] ?? false,
      draftCompleted: data['draftCompleted'] ?? false,
      draftStartTime: (data['draftStartTime'] as Timestamp?)?.toDate(),
      pickTimerSeconds: data['pickTimerSeconds'] ?? 120,
      sleepModeEnabled: data['sleepModeEnabled'] ?? false,
      sleepModeStart: data['sleepModeStart'] ?? '23:00',
      sleepModeEnd: data['sleepModeEnd'] ?? '08:00',
      sleepModePickTimer: data['sleepModePickTimer'] ?? 480,
      memberStrikes: Map<String, int>.from(data['memberStrikes'] ?? {}),
      aiTeams: List<String>.from(data['aiTeams'] ?? []),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'inviteCode': inviteCode,
      'commissionerId': commissionerId,
      'memberIds': memberIds,
      'maxMembers': maxMembers,
      'createdAt': Timestamp.fromDate(createdAt),
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
      'draftCompleted': draftCompleted,
      'draftStartTime': draftStartTime != null
          ? Timestamp.fromDate(draftStartTime!)
          : null,
      'pickTimerSeconds': pickTimerSeconds,
      'sleepModeEnabled': sleepModeEnabled,
      'sleepModeStart': sleepModeStart,
      'sleepModeEnd': sleepModeEnd,
      'sleepModePickTimer': sleepModePickTimer,
      'memberStrikes': memberStrikes,
      'aiTeams': aiTeams,
    };
  }

  bool get isFull => memberIds.length >= maxMembers;
}
