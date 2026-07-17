/// Represents an NFL player available for drafting.
class Player {
  const Player({
    required this.id,
    required this.name,
    required this.position,
    required this.team,
    required this.rank,
    this.byeWeek = 0,
  });

  final String id;
  final String name;
  final String position;
  final String team;
  final int rank;
  final int byeWeek;

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'position': position,
        'team': team,
        'rank': rank,
        'byeWeek': byeWeek,
      };

  factory Player.fromMap(Map<String, dynamic> map) => Player(
        id: map['id'] ?? '',
        name: map['name'] ?? '',
        position: map['position'] ?? '',
        team: map['team'] ?? '',
        rank: map['rank'] ?? 0,
        byeWeek: map['byeWeek'] ?? 0,
      );
}

/// 2025 NFL player pool for drafting — real players, accurate positions.
class PlayerPool {
  static const List<Player> players = [
    // ─── Quarterbacks ──────────────────────────────────────────────
    Player(id: 'qb1', name: 'Patrick Mahomes', position: 'QB', team: 'KC', rank: 1, byeWeek: 6),
    Player(id: 'qb2', name: 'Josh Allen', position: 'QB', team: 'BUF', rank: 5, byeWeek: 12),
    Player(id: 'qb3', name: 'Jalen Hurts', position: 'QB', team: 'PHI', rank: 8, byeWeek: 14),
    Player(id: 'qb4', name: 'Lamar Jackson', position: 'QB', team: 'BAL', rank: 12, byeWeek: 14),
    Player(id: 'qb5', name: 'Joe Burrow', position: 'QB', team: 'CIN', rank: 20, byeWeek: 12),
    Player(id: 'qb6', name: 'CJ Stroud', position: 'QB', team: 'HOU', rank: 30, byeWeek: 14),
    Player(id: 'qb7', name: 'Dak Prescott', position: 'QB', team: 'DAL', rank: 40, byeWeek: 7),
    Player(id: 'qb8', name: 'Tua Tagovailoa', position: 'QB', team: 'MIA', rank: 55, byeWeek: 6),
    Player(id: 'qb9', name: 'Jordan Love', position: 'QB', team: 'GB', rank: 62, byeWeek: 10),
    Player(id: 'qb10', name: 'Anthony Richardson', position: 'QB', team: 'IND', rank: 68, byeWeek: 14),
    Player(id: 'qb11', name: 'Jayden Daniels', position: 'QB', team: 'WAS', rank: 72, byeWeek: 14),
    Player(id: 'qb12', name: 'Caleb Williams', position: 'QB', team: 'CHI', rank: 78, byeWeek: 7),
    Player(id: 'qb13', name: 'Brock Purdy', position: 'QB', team: 'SF', rank: 85, byeWeek: 9),
    Player(id: 'qb14', name: 'Drake Maye', position: 'QB', team: 'NE', rank: 95, byeWeek: 14),
    // ─── Running Backs ─────────────────────────────────────────────
    Player(id: 'rb1', name: 'Christian McCaffrey', position: 'RB', team: 'SF', rank: 2, byeWeek: 9),
    Player(id: 'rb2', name: 'Bijan Robinson', position: 'RB', team: 'ATL', rank: 3, byeWeek: 12),
    Player(id: 'rb3', name: 'Breece Hall', position: 'RB', team: 'NYJ', rank: 6, byeWeek: 12),
    Player(id: 'rb4', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', rank: 9, byeWeek: 5),
    Player(id: 'rb5', name: 'Saquon Barkley', position: 'RB', team: 'PHI', rank: 11, byeWeek: 14),
    Player(id: 'rb6', name: 'Jonathan Taylor', position: 'RB', team: 'IND', rank: 15, byeWeek: 14),
    Player(id: 'rb7', name: 'Derrick Henry', position: 'RB', team: 'BAL', rank: 18, byeWeek: 14),
    Player(id: 'rb8', name: 'Travis Etienne', position: 'RB', team: 'JAX', rank: 22, byeWeek: 12),
    Player(id: 'rb9', name: 'De\'Von Achane', position: 'RB', team: 'MIA', rank: 25, byeWeek: 6),
    Player(id: 'rb10', name: 'Isiah Pacheco', position: 'RB', team: 'KC', rank: 35, byeWeek: 6),
    Player(id: 'rb11', name: 'Josh Jacobs', position: 'RB', team: 'GB', rank: 38, byeWeek: 10),
    Player(id: 'rb12', name: 'Kyren Williams', position: 'RB', team: 'LAR', rank: 42, byeWeek: 6),
    Player(id: 'rb13', name: 'Kenneth Walker III', position: 'RB', team: 'SEA', rank: 46, byeWeek: 10),
    Player(id: 'rb14', name: 'James Cook', position: 'RB', team: 'BUF', rank: 50, byeWeek: 12),
    Player(id: 'rb15', name: 'Rachaad White', position: 'RB', team: 'TB', rank: 54, byeWeek: 11),
    Player(id: 'rb16', name: 'Najee Harris', position: 'RB', team: 'PIT', rank: 58, byeWeek: 9),
    Player(id: 'rb17', name: 'Jonathon Brooks', position: 'RB', team: 'CAR', rank: 64, byeWeek: 11),
    Player(id: 'rb18', name: 'David Montgomery', position: 'RB', team: 'DET', rank: 70, byeWeek: 5),
    Player(id: 'rb19', name: 'Zamir White', position: 'RB', team: 'LV', rank: 76, byeWeek: 10),
    Player(id: 'rb20', name: 'Rhamondre Stevenson', position: 'RB', team: 'NE', rank: 82, byeWeek: 14),
    Player(id: 'rb21', name: 'Tony Pollard', position: 'RB', team: 'TEN', rank: 88, byeWeek: 5),
    Player(id: 'rb22', name: 'Javonte Williams', position: 'RB', team: 'DEN', rank: 94, byeWeek: 14),
    Player(id: 'rb23', name: 'Zack Moss', position: 'RB', team: 'CIN', rank: 100, byeWeek: 12),
    Player(id: 'rb24', name: 'Aaron Jones', position: 'RB', team: 'MIN', rank: 106, byeWeek: 6),
    // ─── Wide Receivers ────────────────────────────────────────────
    Player(id: 'wr1', name: 'CeeDee Lamb', position: 'WR', team: 'DAL', rank: 4, byeWeek: 7),
    Player(id: 'wr2', name: 'Tyreek Hill', position: 'WR', team: 'MIA', rank: 7, byeWeek: 6),
    Player(id: 'wr3', name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', rank: 10, byeWeek: 12),
    Player(id: 'wr4', name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', rank: 13, byeWeek: 5),
    Player(id: 'wr5', name: 'A.J. Brown', position: 'WR', team: 'PHI', rank: 14, byeWeek: 14),
    Player(id: 'wr6', name: 'Garrett Wilson', position: 'WR', team: 'NYJ', rank: 16, byeWeek: 12),
    Player(id: 'wr7', name: 'Davante Adams', position: 'WR', team: 'NYJ', rank: 19, byeWeek: 12),
    Player(id: 'wr8', name: 'Puka Nacua', position: 'WR', team: 'LAR', rank: 21, byeWeek: 6),
    Player(id: 'wr9', name: 'Chris Olave', position: 'WR', team: 'NO', rank: 24, byeWeek: 12),
    Player(id: 'wr10', name: 'DeVonta Smith', position: 'WR', team: 'PHI', rank: 28, byeWeek: 14),
    Player(id: 'wr11', name: 'Brandon Aiyuk', position: 'WR', team: 'SF', rank: 32, byeWeek: 9),
    Player(id: 'wr12', name: 'DK Metcalf', position: 'WR', team: 'SEA', rank: 36, byeWeek: 10),
    Player(id: 'wr13', name: 'Nico Collins', position: 'WR', team: 'HOU', rank: 39, byeWeek: 14),
    Player(id: 'wr14', name: 'Malik Nabers', position: 'WR', team: 'NYG', rank: 43, byeWeek: 11),
    Player(id: 'wr15', name: 'Mike Evans', position: 'WR', team: 'TB', rank: 47, byeWeek: 11),
    Player(id: 'wr16', name: 'Marvin Harrison Jr.', position: 'WR', team: 'ARI', rank: 51, byeWeek: 11),
    Player(id: 'wr17', name: 'Drake London', position: 'WR', team: 'ATL', rank: 56, byeWeek: 12),
    Player(id: 'wr18', name: 'Stefon Diggs', position: 'WR', team: 'HOU', rank: 60, byeWeek: 14),
    Player(id: 'wr19', name: 'DJ Moore', position: 'WR', team: 'CHI', rank: 65, byeWeek: 7),
    Player(id: 'wr20', name: 'Terry McLaurin', position: 'WR', team: 'WAS', rank: 69, byeWeek: 14),
    Player(id: 'wr21', name: 'Jaylen Waddle', position: 'WR', team: 'MIA', rank: 73, byeWeek: 6),
    Player(id: 'wr22', name: 'Cooper Kupp', position: 'WR', team: 'LAR', rank: 77, byeWeek: 6),
    Player(id: 'wr23', name: 'Keenan Allen', position: 'WR', team: 'CHI', rank: 83, byeWeek: 7),
    Player(id: 'wr24', name: 'George Pickens', position: 'WR', team: 'PIT', rank: 87, byeWeek: 9),
    Player(id: 'wr25', name: 'Rashee Rice', position: 'WR', team: 'KC', rank: 92, byeWeek: 6),
    Player(id: 'wr26', name: 'Tank Dell', position: 'WR', team: 'HOU', rank: 97, byeWeek: 14),
    Player(id: 'wr27', name: 'Zay Flowers', position: 'WR', team: 'BAL', rank: 102, byeWeek: 14),
    Player(id: 'wr28', name: 'Calvin Ridley', position: 'WR', team: 'TEN', rank: 108, byeWeek: 5),
    Player(id: 'wr29', name: 'Courtland Sutton', position: 'WR', team: 'DEN', rank: 112, byeWeek: 14),
    Player(id: 'wr30', name: 'Christian Kirk', position: 'WR', team: 'JAX', rank: 116, byeWeek: 12),
    // ─── Tight Ends ────────────────────────────────────────────────
    Player(id: 'te1', name: 'Travis Kelce', position: 'TE', team: 'KC', rank: 17, byeWeek: 6),
    Player(id: 'te2', name: 'Sam LaPorta', position: 'TE', team: 'DET', rank: 26, byeWeek: 5),
    Player(id: 'te3', name: 'Mark Andrews', position: 'TE', team: 'BAL', rank: 33, byeWeek: 14),
    Player(id: 'te4', name: 'T.J. Hockenson', position: 'TE', team: 'MIN', rank: 45, byeWeek: 6),
    Player(id: 'te5', name: 'George Kittle', position: 'TE', team: 'SF', rank: 48, byeWeek: 9),
    Player(id: 'te6', name: 'Dallas Goedert', position: 'TE', team: 'PHI', rank: 60, byeWeek: 14),
    Player(id: 'te7', name: 'Evan Engram', position: 'TE', team: 'JAX', rank: 75, byeWeek: 12),
    Player(id: 'te8', name: 'David Njoku', position: 'TE', team: 'CLE', rank: 90, byeWeek: 10),
    Player(id: 'te9', name: 'Dalton Kincaid', position: 'TE', team: 'BUF', rank: 96, byeWeek: 12),
    Player(id: 'te10', name: 'Kyle Pitts', position: 'TE', team: 'ATL', rank: 104, byeWeek: 12),
    Player(id: 'te11', name: 'Jake Ferguson', position: 'TE', team: 'DAL', rank: 110, byeWeek: 7),
    Player(id: 'te12', name: 'Pat Freiermuth', position: 'TE', team: 'PIT', rank: 118, byeWeek: 9),
    // ─── Kickers ───────────────────────────────────────────────────
    Player(id: 'k1', name: 'Justin Tucker', position: 'K', team: 'BAL', rank: 150, byeWeek: 14),
    Player(id: 'k2', name: 'Harrison Butker', position: 'K', team: 'KC', rank: 151, byeWeek: 6),
    Player(id: 'k3', name: 'Jake Elliott', position: 'K', team: 'PHI', rank: 152, byeWeek: 14),
    Player(id: 'k4', name: 'Tyler Bass', position: 'K', team: 'BUF', rank: 153, byeWeek: 12),
    Player(id: 'k5', name: 'Evan McPherson', position: 'K', team: 'CIN', rank: 154, byeWeek: 12),
    Player(id: 'k6', name: 'Ka\'imi Fairbairn', position: 'K', team: 'HOU', rank: 155, byeWeek: 14),
    Player(id: 'k7', name: 'Brandon Aubrey', position: 'K', team: 'DAL', rank: 156, byeWeek: 7),
    Player(id: 'k8', name: 'Jason Sanders', position: 'K', team: 'MIA', rank: 157, byeWeek: 6),
    // ─── Team Defense ──────────────────────────────────────────────
    Player(id: 'def1', name: 'San Francisco 49ers', position: 'DEF', team: 'SF', rank: 130, byeWeek: 9),
    Player(id: 'def2', name: 'Dallas Cowboys', position: 'DEF', team: 'DAL', rank: 131, byeWeek: 7),
    Player(id: 'def3', name: 'Baltimore Ravens', position: 'DEF', team: 'BAL', rank: 132, byeWeek: 14),
    Player(id: 'def4', name: 'New York Jets', position: 'DEF', team: 'NYJ', rank: 133, byeWeek: 12),
    Player(id: 'def5', name: 'Cleveland Browns', position: 'DEF', team: 'CLE', rank: 134, byeWeek: 10),
    Player(id: 'def6', name: 'Buffalo Bills', position: 'DEF', team: 'BUF', rank: 135, byeWeek: 12),
    Player(id: 'def7', name: 'Pittsburgh Steelers', position: 'DEF', team: 'PIT', rank: 136, byeWeek: 9),
    Player(id: 'def8', name: 'Kansas City Chiefs', position: 'DEF', team: 'KC', rank: 137, byeWeek: 6),
    Player(id: 'def9', name: 'Miami Dolphins', position: 'DEF', team: 'MIA', rank: 138, byeWeek: 6),
    Player(id: 'def10', name: 'Houston Texans', position: 'DEF', team: 'HOU', rank: 139, byeWeek: 14),
  ];
}
