import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../utils/team_defaults.dart';

/// Seeds a league with dummy members, teams, chat messages, and DMs.
class SeedLeagueData {
  static final _firestore = FirebaseFirestore.instance;

  static const _dummyMembers = [
    {'id': 'bot_mike', 'name': 'Mike\'s Monsters', 'abbrev': 'MKM'},
    {'id': 'bot_sarah', 'name': 'Sarah\'s Sharks', 'abbrev': 'SHK'},
    {'id': 'bot_jake', 'name': 'Jake\'s Juggernauts', 'abbrev': 'JJN'},
    {'id': 'bot_emma', 'name': 'Emma\'s Eagles', 'abbrev': 'EGL'},
    {'id': 'bot_tyler', 'name': 'Tyler\'s Titans', 'abbrev': 'TTN'},
    {'id': 'bot_alex', 'name': 'Alex\'s Avalanche', 'abbrev': 'AVL'},
    {'id': 'bot_jordan', 'name': 'Jordan\'s Jets', 'abbrev': 'JTS'},
    {'id': 'bot_casey', 'name': 'Casey\'s Cobras', 'abbrev': 'CBR'},
    {'id': 'bot_drew', 'name': 'Drew\'s Dragons', 'abbrev': 'DRG'},
    {'id': 'bot_riley', 'name': 'Riley\'s Raptors', 'abbrev': 'RPT'},
    {'id': 'bot_morgan', 'name': 'Morgan\'s Mayhem', 'abbrev': 'MYH'},
    {'id': 'bot_sam', 'name': 'Sam\'s Storm', 'abbrev': 'STM'},
    {'id': 'bot_quinn', 'name': 'Quinn\'s Quake', 'abbrev': 'QKE'},
    {'id': 'bot_avery', 'name': 'Avery\'s Aces', 'abbrev': 'ACE'},
    {'id': 'bot_blake', 'name': 'Blake\'s Blitz', 'abbrev': 'BLZ'},
    {'id': 'bot_charlie', 'name': 'Charlie\'s Chargers', 'abbrev': 'CHG'},
    {'id': 'bot_dana', 'name': 'Dana\'s Demons', 'abbrev': 'DMN'},
    {'id': 'bot_ellis', 'name': 'Ellis\'s Empire', 'abbrev': 'EMP'},
    {'id': 'bot_frankie', 'name': 'Frankie\'s Fury', 'abbrev': 'FRY'},
    {'id': 'bot_gray', 'name': 'Gray\'s Ghosts', 'abbrev': 'GHT'},
    {'id': 'bot_harper', 'name': 'Harper\'s Hawks', 'abbrev': 'HWK'},
    {'id': 'bot_indigo', 'name': 'Indigo\'s Inferno', 'abbrev': 'INF'},
    {'id': 'bot_jaden', 'name': 'Jaden\'s Jackals', 'abbrev': 'JKL'},
    {'id': 'bot_kai', 'name': 'Kai\'s Knights', 'abbrev': 'KNT'},
    {'id': 'bot_logan', 'name': 'Logan\'s Legion', 'abbrev': 'LGN'},
    {'id': 'bot_mason', 'name': 'Mason\'s Mavericks', 'abbrev': 'MVK'},
    {'id': 'bot_nova', 'name': 'Nova\'s Ninjas', 'abbrev': 'NNJ'},
    {'id': 'bot_oakley', 'name': 'Oakley\'s Outlaws', 'abbrev': 'OTL'},
    {'id': 'bot_payton', 'name': 'Payton\'s Panthers', 'abbrev': 'PNT'},
    {'id': 'bot_remy', 'name': 'Remy\'s Raiders', 'abbrev': 'RDR'},
    {'id': 'bot_skyler', 'name': 'Skyler\'s Sabres', 'abbrev': 'SBR'},
  ];

  /// Seeds a league with bot teams to fill all slots except the commissioner.
  /// [teamCount] is the total number of teams in the league (including the commissioner).
  static Future<void> seed(String leagueId, {int? teamCount}) async {
    final uid = FirebaseAuth.instance.currentUser!.uid;
    final leagueRef = _firestore.collection('leagues').doc(leagueId);

    // Determine how many bots to seed (all slots minus the commissioner)
    final botsNeeded = teamCount != null
        ? (teamCount - 1).clamp(0, _dummyMembers.length)
        : _dummyMembers.length;
    final botsToSeed = _dummyMembers.sublist(0, botsNeeded);

    // Add dummy member IDs to the league and mark them as AI
    final memberIds = botsToSeed.map((m) => m['id'] as String).toList();
    await leagueRef.update({
      'memberIds': FieldValue.arrayUnion(memberIds),
      'aiTeams': FieldValue.arrayUnion(memberIds),
    });

    // Create team documents for each bot member with random identities
    for (var i = 0; i < botsToSeed.length; i++) {
      final member = botsToSeed[i];
      final botTeam = TeamDefaults.generateRandom();
      await leagueRef.collection('teams').doc(member['id']).set({
        'name': botTeam.name,
        'abbreviation': botTeam.abbreviation,
        'primaryColor': botTeam.primaryColor.value,
        'secondaryColor': botTeam.secondaryColor.value,
        'iconIndex': botTeam.iconIndex,
        'ownerId': member['id'],
        'createdAt': FieldValue.serverTimestamp(),
      });
    }

    // Create a default team for the commissioner so they aren't prompted every time
    final commTeamDoc = await leagueRef.collection('teams').doc(uid).get();
    if (!commTeamDoc.exists) {
      final team = TeamDefaults.generateRandom();
      await leagueRef.collection('teams').doc(uid).set({
        'name': team.name,
        'abbreviation': team.abbreviation,
        'primaryColor': team.primaryColor.value,
        'secondaryColor': team.secondaryColor.value,
        'iconIndex': team.iconIndex,
        'ownerId': uid,
        'createdAt': FieldValue.serverTimestamp(),
      });
    }

    // Ensure channels exist
    await _ensureChannels(leagueRef);

    // Seed channel messages
    await _seedChannelMessages(leagueRef, uid);

    // Seed DMs
    await _seedDms(leagueRef, uid);

    // Seed incoming trade proposals
    await _seedTrades(leagueRef, uid, botsToSeed);
  }

  static Future<void> _ensureChannels(DocumentReference leagueRef) async {
    final channelsRef = leagueRef.collection('channels');

    final general = await channelsRef.doc('general').get();
    if (!general.exists) {
      await channelsRef.doc('general').set({
        'name': 'General',
        'isPrimary': true,
        'createdAt': FieldValue.serverTimestamp(),
      });
    }

    final trades = await channelsRef.doc('trades').get();
    if (!trades.exists) {
      await channelsRef.doc('trades').set({
        'name': 'Trade Talk',
        'isPrimary': false,
        'createdAt': FieldValue.serverTimestamp(),
      });
    }

    final trash = await channelsRef.doc('trashtalk').get();
    if (!trash.exists) {
      await channelsRef.doc('trashtalk').set({
        'name': 'Trash Talk',
        'isPrimary': false,
        'createdAt': FieldValue.serverTimestamp(),
      });
    }
  }

  static Future<void> _seedChannelMessages(
      DocumentReference leagueRef, String uid) async {
    final now = DateTime.now();
    final channelsRef = leagueRef.collection('channels');

    // General channel messages
    final generalMsgs = [
      {'sender': 'bot_mike', 'name': 'Mike\'s Monsters', 'text': 'Who\'s ready to get destroyed this season? 💀'},
      {'sender': 'bot_sarah', 'name': 'Sarah\'s Sharks', 'text': 'Lol you said that last year and finished 8th'},
      {'sender': 'bot_jake', 'name': 'Jake\'s Juggernauts', 'text': 'Draft day can\'t come soon enough'},
      {'sender': 'bot_emma', 'name': 'Emma\'s Eagles', 'text': 'I\'ve been studying film since March. Y\'all aren\'t ready.'},
      {'sender': 'bot_tyler', 'name': 'Tyler\'s Titans', 'text': 'Film? It\'s fantasy football Emma not the combine 😂'},
      {'sender': 'bot_mike', 'name': 'Mike\'s Monsters', 'text': 'Anyone wanna make a side bet? Loser buys winner dinner'},
      {'sender': 'bot_sarah', 'name': 'Sarah\'s Sharks', 'text': 'I\'m in. Easy money.'},
      {'sender': 'bot_jake', 'name': 'Jake\'s Juggernauts', 'text': 'What pick does everyone want? I need that 1.01'},
      {'sender': 'bot_emma', 'name': 'Emma\'s Eagles', 'text': 'Give me the 4th pick honestly. Value is crazy there'},
      {'sender': 'bot_tyler', 'name': 'Tyler\'s Titans', 'text': 'Commish when are we drafting?? Set the date already'},
      {'sender': 'bot_mike', 'name': 'Mike\'s Monsters', 'text': 'Fr we need at least 2 weeks notice'},
      {'sender': 'bot_sarah', 'name': 'Sarah\'s Sharks', 'text': 'Saturday nights work best for me'},
      {'sender': 'bot_jake', 'name': 'Jake\'s Juggernauts', 'text': 'Same. Or Sunday afternoon before games start'},
    ];

    for (var i = 0; i < generalMsgs.length; i++) {
      final msg = generalMsgs[i];
      final time = now.subtract(Duration(minutes: (generalMsgs.length - i) * 3));
      await channelsRef.doc('general').collection('messages').add({
        'senderId': msg['sender'],
        'senderName': msg['name'],
        'text': msg['text'],
        'sentAt': Timestamp.fromDate(time),
      });
    }
    await channelsRef.doc('general').set({
      'lastMessageAt': Timestamp.fromDate(now.subtract(const Duration(minutes: 3))),
    }, SetOptions(merge: true));

    // Trade Talk channel messages
    final tradeMsgs = [
      {'sender': 'bot_emma', 'name': 'Emma\'s Eagles', 'text': 'Anyone interested in moving their 2nd round pick?'},
      {'sender': 'bot_mike', 'name': 'Mike\'s Monsters', 'text': 'Depends what you\'re offering. I\'m loaded on late round value'},
      {'sender': 'bot_emma', 'name': 'Emma\'s Eagles', 'text': 'My 3rd + 5th for your 2nd?'},
      {'sender': 'bot_jake', 'name': 'Jake\'s Juggernauts', 'text': 'That\'s a steal for whoever gets the 2nd'},
      {'sender': 'bot_sarah', 'name': 'Sarah\'s Sharks', 'text': 'I\'d take that deal all day'},
      {'sender': 'bot_mike', 'name': 'Mike\'s Monsters', 'text': 'Let me think about it... I do need depth'},
      {'sender': 'bot_tyler', 'name': 'Tyler\'s Titans', 'text': 'If Mike doesn\'t take it I will. My 2nd for your 3rd+5th Emma?'},
      {'sender': 'bot_emma', 'name': 'Emma\'s Eagles', 'text': 'Deal! Tyler you\'re getting fleeced btw'},
      {'sender': 'bot_tyler', 'name': 'Tyler\'s Titans', 'text': 'We\'ll see 😏'},
    ];

    for (var i = 0; i < tradeMsgs.length; i++) {
      final msg = tradeMsgs[i];
      final time = now.subtract(Duration(minutes: (tradeMsgs.length - i) * 5 + 60));
      await channelsRef.doc('trades').collection('messages').add({
        'senderId': msg['sender'],
        'senderName': msg['name'],
        'text': msg['text'],
        'sentAt': Timestamp.fromDate(time),
      });
    }
    await channelsRef.doc('trades').set({
      'lastMessageAt': Timestamp.fromDate(now.subtract(const Duration(minutes: 65))),
    }, SetOptions(merge: true));

    // Trash Talk channel messages
    final trashMsgs = [
      {'sender': 'bot_tyler', 'name': 'Tyler\'s Titans', 'text': '🏆 Already measuring for the trophy case'},
      {'sender': 'bot_sarah', 'name': 'Sarah\'s Sharks', 'text': 'Tyler you\'ve never even made the playoffs lmaooo'},
      {'sender': 'bot_tyler', 'name': 'Tyler\'s Titans', 'text': 'This is my year. Mark it.'},
      {'sender': 'bot_mike', 'name': 'Mike\'s Monsters', 'text': 'Bold words from the guy who drafted a kicker in round 5'},
      {'sender': 'bot_jake', 'name': 'Jake\'s Juggernauts', 'text': '💀💀💀 I forgot about that'},
      {'sender': 'bot_tyler', 'name': 'Tyler\'s Titans', 'text': 'HE WAS THE #1 KICKER THAT YEAR OK'},
      {'sender': 'bot_emma', 'name': 'Emma\'s Eagles', 'text': 'And you still lost. To me. By 2 points.'},
      {'sender': 'bot_sarah', 'name': 'Sarah\'s Sharks', 'text': 'EMOTIONAL DAMAGE 😂'},
      {'sender': 'bot_mike', 'name': 'Mike\'s Monsters', 'text': 'This chat is why I love fantasy football'},
      {'sender': 'bot_jake', 'name': 'Jake\'s Juggernauts', 'text': 'Honestly though everyone here is getting cooked this year. Just saying.'},
      {'sender': 'bot_tyler', 'name': 'Tyler\'s Titans', 'text': 'Jake the last time you won was before smartphones existed'},
      {'sender': 'bot_jake', 'name': 'Jake\'s Juggernauts', 'text': '...fair'},
    ];

    for (var i = 0; i < trashMsgs.length; i++) {
      final msg = trashMsgs[i];
      final time = now.subtract(Duration(minutes: (trashMsgs.length - i) * 4 + 20));
      await channelsRef.doc('trashtalk').collection('messages').add({
        'senderId': msg['sender'],
        'senderName': msg['name'],
        'text': msg['text'],
        'sentAt': Timestamp.fromDate(time),
      });
    }
    await channelsRef.doc('trashtalk').set({
      'lastMessageAt': Timestamp.fromDate(now.subtract(const Duration(minutes: 24))),
    }, SetOptions(merge: true));
  }

  static Future<void> _seedDms(DocumentReference leagueRef, String uid) async {
    final now = DateTime.now();
    final dmRef = leagueRef.collection('league_dms');

    // DM with Mike
    final mikeDmRef = await dmRef.add({
      'memberIds': [uid, 'bot_mike'],
      'memberNames': {uid: 'You', 'bot_mike': 'Mike\'s Monsters'},
      'lastMessage': 'Don\'t sleep on my sleeper picks this year',
      'lastMessageAt': Timestamp.fromDate(now.subtract(const Duration(minutes: 15))),
    });
    final mikeMsgs = [
      {'sender': 'bot_mike', 'text': 'Yo commish, any chance we can do auction draft instead?', 'min': 45},
      {'sender': uid, 'text': 'We already voted on snake, but I\'ll ask the group', 'min': 40},
      {'sender': 'bot_mike', 'text': 'Fair enough. Just thought it\'d be more fun', 'min': 35},
      {'sender': uid, 'text': 'I\'ll put a poll in the general chat', 'min': 30},
      {'sender': 'bot_mike', 'text': 'Bet. Also don\'t sleep on my sleeper picks this year', 'min': 15},
    ];
    for (final msg in mikeMsgs) {
      await mikeDmRef.collection('messages').add({
        'senderId': msg['sender'],
        'senderName': msg['sender'] == uid ? 'You' : 'Mike\'s Monsters',
        'text': msg['text'],
        'sentAt': Timestamp.fromDate(now.subtract(Duration(minutes: msg['min'] as int))),
      });
    }

    // DM with Emma
    final emmaDmRef = await dmRef.add({
      'memberIds': [uid, 'bot_emma'],
      'memberNames': {uid: 'You', 'bot_emma': 'Emma\'s Eagles'},
      'lastMessage': 'Deal. Let\'s revisit after the draft',
      'lastMessageAt': Timestamp.fromDate(now.subtract(const Duration(hours: 2))),
    });
    final emmaMsgs = [
      {'sender': 'bot_emma', 'text': 'Hey, would you be open to a trade if I get a top 3 pick?', 'min': 180},
      {'sender': uid, 'text': 'Depends what you\'re offering. I\'m not giving up value for nothing', 'min': 170},
      {'sender': 'bot_emma', 'text': 'I was thinking my 1st rounder + a 4th for your 2nd and 3rd', 'min': 160},
      {'sender': uid, 'text': 'Hmm that\'s interesting actually. Let me think about it', 'min': 150},
      {'sender': 'bot_emma', 'text': 'No rush. Just wanted to plant the seed early', 'min': 140},
      {'sender': uid, 'text': 'Smart. I respect the early game planning', 'min': 130},
      {'sender': 'bot_emma', 'text': 'Deal. Let\'s revisit after the draft', 'min': 120},
    ];
    for (final msg in emmaMsgs) {
      await emmaDmRef.collection('messages').add({
        'senderId': msg['sender'],
        'senderName': msg['sender'] == uid ? 'You' : 'Emma\'s Eagles',
        'text': msg['text'],
        'sentAt': Timestamp.fromDate(now.subtract(Duration(minutes: msg['min'] as int))),
      });
    }

    // DM with Tyler
    final tylerDmRef = await dmRef.add({
      'memberIds': [uid, 'bot_tyler'],
      'memberNames': {uid: 'You', 'bot_tyler': 'Tyler\'s Titans'},
      'lastMessage': 'Watch me prove everyone wrong this year',
      'lastMessageAt': Timestamp.fromDate(now.subtract(const Duration(hours: 5))),
    });
    final tylerMsgs = [
      {'sender': 'bot_tyler', 'text': 'Bro I\'m winning it all this year no cap', 'min': 320},
      {'sender': uid, 'text': 'You say that every year Tyler 😂', 'min': 315},
      {'sender': 'bot_tyler', 'text': 'This time is different. I have a system.', 'min': 310},
      {'sender': uid, 'text': 'A system? What is this, blackjack?', 'min': 305},
      {'sender': 'bot_tyler', 'text': 'Watch me prove everyone wrong this year', 'min': 300},
    ];
    for (final msg in tylerMsgs) {
      await tylerDmRef.collection('messages').add({
        'senderId': msg['sender'],
        'senderName': msg['sender'] == uid ? 'You' : 'Tyler\'s Titans',
        'text': msg['text'],
        'sentAt': Timestamp.fromDate(now.subtract(Duration(minutes: msg['min'] as int))),
      });
    }

    // DM with Sarah
    final sarahDmRef = await dmRef.add({
      'memberIds': [uid, 'bot_sarah'],
      'memberNames': {uid: 'You', 'bot_sarah': 'Sarah\'s Sharks'},
      'lastMessage': 'See you draft day! 🦈',
      'lastMessageAt': Timestamp.fromDate(now.subtract(const Duration(hours: 1))),
    });
    final sarahMsgs = [
      {'sender': 'bot_sarah', 'text': 'Hey! Quick q — are we doing FAAB or rolling waivers?', 'min': 90},
      {'sender': uid, 'text': 'FAAB with \$100 budget', 'min': 85},
      {'sender': 'bot_sarah', 'text': 'Perfect. I love FAAB, way more strategic', 'min': 80},
      {'sender': uid, 'text': 'Agreed. Prevents the 0-3 team from hoarding all the waiver pickups', 'min': 75},
      {'sender': 'bot_sarah', 'text': 'Exactly. Also can we get a trash talk channel? I have some things to say 😂', 'min': 70},
      {'sender': uid, 'text': 'Already on it! Check the channels', 'min': 65},
      {'sender': 'bot_sarah', 'text': 'See you draft day! 🦈', 'min': 60},
    ];
    for (final msg in sarahMsgs) {
      await sarahDmRef.collection('messages').add({
        'senderId': msg['sender'],
        'senderName': msg['sender'] == uid ? 'You' : 'Sarah\'s Sharks',
        'text': msg['text'],
        'sentAt': Timestamp.fromDate(now.subtract(Duration(minutes: msg['min'] as int))),
      });
    }

    // DM with Jake
    final jakeDmRef = await dmRef.add({
      'memberIds': [uid, 'bot_jake'],
      'memberNames': {uid: 'You', 'bot_jake': 'Jake\'s Juggernauts'},
      'lastMessage': 'Thanks commish, appreciate you running this',
      'lastMessageAt': Timestamp.fromDate(now.subtract(const Duration(hours: 3))),
    });
    final jakeMsgs = [
      {'sender': 'bot_jake', 'text': 'Hey man, is there a way to see the scoring breakdown before the draft?', 'min': 200},
      {'sender': uid, 'text': 'Yeah go to league settings, it\'s all there under Scoring tab', 'min': 195},
      {'sender': 'bot_jake', 'text': 'Found it. PPR with bonuses for 100+ yard games, nice', 'min': 190},
      {'sender': uid, 'text': 'Yep, wanted to make big games feel rewarding', 'min': 185},
      {'sender': 'bot_jake', 'text': 'Thanks commish, appreciate you running this', 'min': 180},
    ];
    for (final msg in jakeMsgs) {
      await jakeDmRef.collection('messages').add({
        'senderId': msg['sender'],
        'senderName': msg['sender'] == uid ? 'You' : 'Jake\'s Juggernauts',
        'text': msg['text'],
        'sentAt': Timestamp.fromDate(now.subtract(Duration(minutes: msg['min'] as int))),
      });
    }
  }

  static Future<void> _seedTrades(
      DocumentReference leagueRef, String uid, List<Map<String, String>> bots) async {
    if (bots.length < 3) return;
    final tradesRef = leagueRef.collection('trades');

    // Use higher pick numbers that are less likely to be already used
    // In a 10-team league, round 2 starts at pick 11, round 3 at 21, etc.

    // Trade 1: Bot offers their future pick for your future pick
    await tradesRef.add({
      'proposerId': bots[0]['id'],
      'targetId': uid,
      'offeredPicks': [22], // late round pick
      'requestedPicks': [15], // your mid-round pick
      'offeredPlayers': <String>[],
      'requestedPlayers': <String>[],
      'status': 'pending',
      'createdAt': FieldValue.serverTimestamp(),
    });

    // Trade 2: Bot offers two late picks for one earlier pick
    await tradesRef.add({
      'proposerId': bots[1]['id'],
      'targetId': uid,
      'offeredPicks': [35, 45],
      'requestedPicks': [25],
      'offeredPlayers': <String>[],
      'requestedPlayers': <String>[],
      'status': 'pending',
      'createdAt': FieldValue.serverTimestamp(),
    });

    // Trade 3: Bot offers picks for your picks (bigger package deal)
    await tradesRef.add({
      'proposerId': bots[2]['id'],
      'targetId': uid,
      'offeredPicks': [18, 30],
      'requestedPicks': [12, 40],
      'offeredPlayers': <String>[],
      'requestedPlayers': <String>[],
      'status': 'pending',
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}
