import 'dart:convert';

import 'package:http/http.dart' as http;

/// Service for fetching NFL data from SportsData.io.
///
/// Sign up for a free developer key at:
/// https://sportsdata.io/developers/api-documentation/nfl
///
/// Free tier (Discovery Lab) provides last season's data.
/// Paid tiers provide real-time in-season data.
class NflStatsService {
  NflStatsService({String? apiKey})
      : _apiKey = apiKey ?? '123b6df4f4b9441d9e668c77b8a9af44';

  final String _apiKey;

  static const _baseUrl = 'https://api.sportsdata.io/v3/nfl';
  static const _scoresBase = '$_baseUrl/scores/json';
  static const _statsBase = '$_baseUrl/stats/json';
  static const _projectionsBase = '$_baseUrl/projections/json';

  Map<String, String> get _headers => {
        'Ocp-Apim-Subscription-Key': _apiKey,
      };

  Future<dynamic> _get(String url) async {
    final response = await http.get(Uri.parse(url), headers: _headers);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw NflApiException(
        'API request failed: ${response.statusCode} ${response.reasonPhrase}',
        statusCode: response.statusCode,
      );
    }
  }

  // ─── Teams & Schedules ───────────────────────────────────────────

  /// Get all active NFL teams.
  Future<List<NflTeam>> getTeams() async {
    final data = await _get('$_scoresBase/Teams') as List;
    return data.map((t) => NflTeam.fromJson(t as Map<String, dynamic>)).toList();
  }

  /// Get the schedule for a given season (e.g. "2024REG", "2024POST").
  Future<List<NflGame>> getSchedule(String season) async {
    final data = await _get('$_scoresBase/Schedules/$season') as List;
    return data.map((g) => NflGame.fromJson(g as Map<String, dynamic>)).toList();
  }

  /// Get scores for a given week (e.g. season="2024REG", week=1).
  Future<List<NflGame>> getScoresByWeek(String season, int week) async {
    final data = await _get('$_scoresBase/ScoresByWeek/$season/$week') as List;
    return data.map((g) => NflGame.fromJson(g as Map<String, dynamic>)).toList();
  }

  /// Get live box scores for games currently in progress.
  Future<List<dynamic>> getLiveBoxScores() async {
    final data = await _get('$_statsBase/LiveBoxScores');
    return data as List;
  }

  // ─── Players ─────────────────────────────────────────────────────

  /// Get all available players.
  Future<List<NflPlayer>> getPlayers() async {
    final data = await _get('$_scoresBase/Players') as List;
    return data.map((p) => NflPlayer.fromJson(p as Map<String, dynamic>)).toList();
  }

  /// Get players by team abbreviation (e.g. "KC", "BUF").
  Future<List<NflPlayer>> getPlayersByTeam(String team) async {
    final data = await _get('$_scoresBase/Players/$team') as List;
    return data.map((p) => NflPlayer.fromJson(p as Map<String, dynamic>)).toList();
  }

  /// Get a single player by ID.
  Future<NflPlayer> getPlayer(int playerId) async {
    final data = await _get('$_scoresBase/Player/$playerId');
    return NflPlayer.fromJson(data as Map<String, dynamic>);
  }

  // ─── Player Stats ────────────────────────────────────────────────

  /// Get player stats for a specific game week.
  Future<List<NflPlayerGameStats>> getPlayerGameStatsByWeek(
      String season, int week) async {
    final data =
        await _get('$_statsBase/PlayerGameStatsByWeek/$season/$week') as List;
    return data
        .map((s) => NflPlayerGameStats.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// Get season-long stats for all players.
  Future<List<NflPlayerSeasonStats>> getPlayerSeasonStats(String season) async {
    final data = await _get('$_statsBase/PlayerSeasonStats/$season') as List;
    return data
        .map((s) => NflPlayerSeasonStats.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// Get a single player's game log for the season.
  Future<List<NflPlayerGameStats>> getPlayerGameLog(
      String season, int playerId) async {
    final data =
        await _get('$_statsBase/PlayerGameStatsBySeason/$season/$playerId') as List;
    return data
        .map((s) => NflPlayerGameStats.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  // ─── Fantasy & Projections ───────────────────────────────────────

  /// Get fantasy points for players in a given week.
  Future<List<NflPlayerGameStats>> getFantasyPlayersByWeek(
      String season, int week) async {
    final data =
        await _get('$_statsBase/FantasyPlayers/$season/$week') as List;
    return data
        .map((s) => NflPlayerGameStats.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// Get player projections for a given week.
  Future<List<NflPlayerProjection>> getProjectionsByWeek(
      String season, int week) async {
    final data =
        await _get('$_projectionsBase/PlayerGameProjectionStatsByWeek/$season/$week')
            as List;
    return data
        .map((p) => NflPlayerProjection.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  // ─── Injuries & News ─────────────────────────────────────────────

  /// Get current injury reports.
  Future<List<dynamic>> getInjuries() async {
    final data = await _get('$_scoresBase/Injuries');
    return data as List;
  }

  /// Get latest NFL news.
  Future<List<NflNews>> getNews() async {
    final data = await _get('$_scoresBase/News') as List;
    return data.map((n) => NflNews.fromJson(n as Map<String, dynamic>)).toList();
  }

  /// Get news for a specific player.
  Future<List<NflNews>> getNewsByPlayer(int playerId) async {
    final data = await _get('$_scoresBase/NewsByPlayerID/$playerId') as List;
    return data.map((n) => NflNews.fromJson(n as Map<String, dynamic>)).toList();
  }

  // ─── Standings & Scores ──────────────────────────────────────────

  /// Get current standings.
  Future<List<NflStanding>> getStandings(String season) async {
    final data = await _get('$_scoresBase/Standings/$season') as List;
    return data
        .map((s) => NflStanding.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// Get current NFL week number.
  Future<int> getCurrentWeek() async {
    final data = await _get('$_scoresBase/CurrentWeek');
    return data as int;
  }

  /// Get current season year.
  Future<int> getCurrentSeason() async {
    final data = await _get('$_scoresBase/CurrentSeason');
    return data as int;
  }
}

// ─── Models ──────────────────────────────────────────────────────────

class NflTeam {
  NflTeam({
    required this.teamId,
    required this.key,
    required this.city,
    required this.name,
    required this.conference,
    required this.division,
    this.byeWeek,
  });

  final int teamId;
  final String key;
  final String city;
  final String name;
  final String conference;
  final String division;
  final int? byeWeek;

  String get fullName => '$city $name';

  factory NflTeam.fromJson(Map<String, dynamic> json) => NflTeam(
        teamId: json['TeamID'] ?? 0,
        key: json['Key'] ?? '',
        city: json['City'] ?? '',
        name: json['Name'] ?? '',
        conference: json['Conference'] ?? '',
        division: json['Division'] ?? '',
        byeWeek: json['ByeWeek'],
      );
}

class NflPlayer {
  NflPlayer({
    required this.playerId,
    required this.name,
    required this.team,
    required this.position,
    this.number,
    this.status,
    this.height,
    this.weight,
    this.college,
    this.experience,
    this.photoUrl,
  });

  final int playerId;
  final String name;
  final String team;
  final String position;
  final int? number;
  final String? status;
  final String? height;
  final int? weight;
  final String? college;
  final int? experience;
  final String? photoUrl;

  factory NflPlayer.fromJson(Map<String, dynamic> json) => NflPlayer(
        playerId: json['PlayerID'] ?? 0,
        name: json['Name'] ?? '${json['FirstName'] ?? ''} ${json['LastName'] ?? ''}',
        team: json['Team'] ?? json['CurrentTeam'] ?? '',
        position: json['Position'] ?? json['FantasyPosition'] ?? '',
        number: json['Number'],
        status: json['Status'],
        height: json['Height'],
        weight: json['Weight'],
        college: json['College'],
        experience: json['Experience'],
        photoUrl: json['PhotoUrl'],
      );
}

class NflGame {
  NflGame({
    required this.gameId,
    required this.season,
    required this.week,
    required this.homeTeam,
    required this.awayTeam,
    this.homeScore,
    this.awayScore,
    this.status,
    this.dateTime,
    this.quarter,
    this.timeRemaining,
  });

  final int gameId;
  final int season;
  final int week;
  final String homeTeam;
  final String awayTeam;
  final int? homeScore;
  final int? awayScore;
  final String? status;
  final String? dateTime;
  final String? quarter;
  final String? timeRemaining;

  bool get isInProgress => status == 'InProgress';
  bool get isFinal => status == 'Final' || status == 'F/OT';

  factory NflGame.fromJson(Map<String, dynamic> json) => NflGame(
        gameId: json['GameID'] ?? json['ScoreID'] ?? 0,
        season: json['Season'] ?? 0,
        week: json['Week'] ?? 0,
        homeTeam: json['HomeTeam'] ?? '',
        awayTeam: json['AwayTeam'] ?? '',
        homeScore: json['HomeScore'],
        awayScore: json['AwayScore'],
        status: json['Status'],
        dateTime: json['DateTime'],
        quarter: json['Quarter'],
        timeRemaining: json['TimeRemaining'],
      );
}

class NflPlayerGameStats {
  NflPlayerGameStats({
    required this.playerId,
    required this.name,
    required this.team,
    required this.position,
    this.passingYards = 0,
    this.passingTouchdowns = 0,
    this.passingInterceptions = 0,
    this.rushingYards = 0,
    this.rushingTouchdowns = 0,
    this.receptions = 0,
    this.receivingYards = 0,
    this.receivingTouchdowns = 0,
    this.fumblesLost = 0,
    this.fantasyPoints = 0.0,
    this.fantasyPointsPpr = 0.0,
    this.fantasyPointsHalfPpr = 0.0,
    this.tackles = 0,
    this.sacks = 0.0,
    this.interceptions = 0,
    this.fieldGoalsMade = 0,
    this.fieldGoalsMissed = 0,
    this.extraPointsMade = 0,
  });

  final int playerId;
  final String name;
  final String team;
  final String position;
  final int passingYards;
  final int passingTouchdowns;
  final int passingInterceptions;
  final int rushingYards;
  final int rushingTouchdowns;
  final int receptions;
  final int receivingYards;
  final int receivingTouchdowns;
  final int fumblesLost;
  final double fantasyPoints;
  final double fantasyPointsPpr;
  final double fantasyPointsHalfPpr;
  final int tackles;
  final double sacks;
  final int interceptions;
  final int fieldGoalsMade;
  final int fieldGoalsMissed;
  final int extraPointsMade;

  factory NflPlayerGameStats.fromJson(Map<String, dynamic> json) =>
      NflPlayerGameStats(
        playerId: json['PlayerID'] ?? 0,
        name: json['Name'] ?? '',
        team: json['Team'] ?? '',
        position: json['Position'] ?? json['FantasyPosition'] ?? '',
        passingYards: json['PassingYards'] ?? 0,
        passingTouchdowns: json['PassingTouchdowns'] ?? 0,
        passingInterceptions: json['PassingInterceptions'] ?? 0,
        rushingYards: json['RushingYards'] ?? 0,
        rushingTouchdowns: json['RushingTouchdowns'] ?? 0,
        receptions: json['Receptions'] ?? 0,
        receivingYards: json['ReceivingYards'] ?? 0,
        receivingTouchdowns: json['ReceivingTouchdowns'] ?? 0,
        fumblesLost: json['FumblesLost'] ?? 0,
        fantasyPoints: (json['FantasyPoints'] ?? 0).toDouble(),
        fantasyPointsPpr: (json['FantasyPointsPPR'] ?? 0).toDouble(),
        fantasyPointsHalfPpr: (json['FantasyPointsHalfPPR'] ??
                json['FantasyPointsFanDuel'] ??
                0)
            .toDouble(),
        tackles: (json['Tackles'] ?? json['SoloTackles'] ?? 0).toInt(),
        sacks: (json['Sacks'] ?? 0).toDouble(),
        interceptions: json['Interceptions'] ?? 0,
        fieldGoalsMade: json['FieldGoalsMade'] ?? 0,
        fieldGoalsMissed: (json['FieldGoalsAttempted'] ?? 0) -
            (json['FieldGoalsMade'] ?? 0),
        extraPointsMade: json['ExtraPointsMade'] ?? 0,
      );
}

class NflPlayerSeasonStats {
  NflPlayerSeasonStats({
    required this.playerId,
    required this.name,
    required this.team,
    required this.position,
    this.games = 0,
    this.fantasyPoints = 0.0,
    this.fantasyPointsPpr = 0.0,
    this.passingYards = 0,
    this.passingTouchdowns = 0,
    this.rushingYards = 0,
    this.rushingTouchdowns = 0,
    this.receptions = 0,
    this.receivingYards = 0,
    this.receivingTouchdowns = 0,
  });

  final int playerId;
  final String name;
  final String team;
  final String position;
  final int games;
  final double fantasyPoints;
  final double fantasyPointsPpr;
  final int passingYards;
  final int passingTouchdowns;
  final int rushingYards;
  final int rushingTouchdowns;
  final int receptions;
  final int receivingYards;
  final int receivingTouchdowns;

  factory NflPlayerSeasonStats.fromJson(Map<String, dynamic> json) =>
      NflPlayerSeasonStats(
        playerId: json['PlayerID'] ?? 0,
        name: json['Name'] ?? '',
        team: json['Team'] ?? '',
        position: json['Position'] ?? json['FantasyPosition'] ?? '',
        games: json['Games'] ?? json['Played'] ?? 0,
        fantasyPoints: (json['FantasyPoints'] ?? 0).toDouble(),
        fantasyPointsPpr: (json['FantasyPointsPPR'] ?? 0).toDouble(),
        passingYards: json['PassingYards'] ?? 0,
        passingTouchdowns: json['PassingTouchdowns'] ?? 0,
        rushingYards: json['RushingYards'] ?? 0,
        rushingTouchdowns: json['RushingTouchdowns'] ?? 0,
        receptions: json['Receptions'] ?? 0,
        receivingYards: json['ReceivingYards'] ?? 0,
        receivingTouchdowns: json['ReceivingTouchdowns'] ?? 0,
      );
}

class NflPlayerProjection {
  NflPlayerProjection({
    required this.playerId,
    required this.name,
    required this.team,
    required this.position,
    this.projectedFantasyPoints = 0.0,
    this.projectedFantasyPointsPpr = 0.0,
  });

  final int playerId;
  final String name;
  final String team;
  final String position;
  final double projectedFantasyPoints;
  final double projectedFantasyPointsPpr;

  factory NflPlayerProjection.fromJson(Map<String, dynamic> json) =>
      NflPlayerProjection(
        playerId: json['PlayerID'] ?? 0,
        name: json['Name'] ?? '',
        team: json['Team'] ?? '',
        position: json['Position'] ?? json['FantasyPosition'] ?? '',
        projectedFantasyPoints: (json['FantasyPoints'] ?? 0).toDouble(),
        projectedFantasyPointsPpr: (json['FantasyPointsPPR'] ?? 0).toDouble(),
      );
}

class NflNews {
  NflNews({
    required this.newsId,
    required this.title,
    this.content,
    this.source,
    this.updated,
    this.playerId,
    this.team,
  });

  final int newsId;
  final String title;
  final String? content;
  final String? source;
  final String? updated;
  final int? playerId;
  final String? team;

  factory NflNews.fromJson(Map<String, dynamic> json) => NflNews(
        newsId: json['NewsID'] ?? 0,
        title: json['Title'] ?? '',
        content: json['Content'],
        source: json['Source'],
        updated: json['Updated'],
        playerId: json['PlayerID'],
        team: json['Team'],
      );
}

class NflStanding {
  NflStanding({
    required this.team,
    required this.wins,
    required this.losses,
    required this.ties,
    required this.conference,
    required this.division,
    this.percentage = 0.0,
    this.pointsFor = 0,
    this.pointsAgainst = 0,
  });

  final String team;
  final int wins;
  final int losses;
  final int ties;
  final String conference;
  final String division;
  final double percentage;
  final int pointsFor;
  final int pointsAgainst;

  String get record => ties > 0 ? '$wins-$losses-$ties' : '$wins-$losses';

  factory NflStanding.fromJson(Map<String, dynamic> json) => NflStanding(
        team: json['Team'] ?? '',
        wins: json['Wins'] ?? 0,
        losses: json['Losses'] ?? 0,
        ties: json['Ties'] ?? 0,
        conference: json['Conference'] ?? '',
        division: json['Division'] ?? '',
        percentage: (json['Percentage'] ?? 0).toDouble(),
        pointsFor: json['PointsFor'] ?? json['Score'] ?? 0,
        pointsAgainst: json['PointsAgainst'] ?? json['OpponentScore'] ?? 0,
      );
}

// ─── Exceptions ────────────────────────────────────────────────────

class NflApiException implements Exception {
  NflApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => 'NflApiException($statusCode): $message';
}
