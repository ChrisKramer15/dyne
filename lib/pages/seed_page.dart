import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../theme/dyne_theme.dart';

/// Temporary dev page to seed test users into Firebase.
/// Navigate here from the dashboard to create dummy accounts for testing chat.
class SeedPage extends StatefulWidget {
  const SeedPage({super.key});

  @override
  State<SeedPage> createState() => _SeedPageState();
}

class _SeedPageState extends State<SeedPage> {
  final _logs = <String>[];
  bool _running = false;

  static const _testUsers = [
    {
      'email': 'mike.johnson@test.com',
      'password': 'TestPass123!',
      'displayName': 'Mike Johnson',
      'username': 'mike_johnson',
    },
    {
      'email': 'sarah.williams@test.com',
      'password': 'TestPass123!',
      'displayName': 'Sarah Williams',
      'username': 'sarah_w',
    },
    {
      'email': 'james.garcia@test.com',
      'password': 'TestPass123!',
      'displayName': 'James Garcia',
      'username': 'jgarcia',
    },
    {
      'email': 'emma.davis@test.com',
      'password': 'TestPass123!',
      'displayName': 'Emma Davis',
      'username': 'emma_d',
    },
  ];

  Future<void> _seed() async {
    setState(() {
      _running = true;
      _logs.clear();
    });

    final auth = FirebaseAuth.instance;
    final firestore = FirebaseFirestore.instance;

    // Remember current user so we can sign back in after
    final _ = auth.currentUser;

    for (final user in _testUsers) {
      try {
        final credential = await auth.createUserWithEmailAndPassword(
          email: user['email']!,
          password: user['password']!,
        );

        await credential.user?.updateDisplayName(user['displayName']);

        await firestore.collection('users').doc(credential.user!.uid).set({
          'displayName': user['displayName'],
          'email': user['email'],
          'username': user['username'],
          'photoURL': '',
          'lastSeen': FieldValue.serverTimestamp(),
        });

        // Reserve the username
        await firestore
            .collection('usernames')
            .doc(user['username']!)
            .set({
          'uid': credential.user!.uid,
          'createdAt': FieldValue.serverTimestamp(),
        });

        _addLog('✓ Created: ${user['displayName']} (@${user['username']})');
        await auth.signOut();
      } on FirebaseAuthException catch (e) {
        if (e.code == 'email-already-in-use') {
          _addLog('⊘ Already exists: @${user['username']}');

          try {
            final cred = await auth.signInWithEmailAndPassword(
              email: user['email']!,
              password: user['password']!,
            );
            await firestore.collection('users').doc(cred.user!.uid).set({
              'displayName': user['displayName'],
              'email': user['email'],
              'username': user['username'],
              'photoURL': '',
              'lastSeen': FieldValue.serverTimestamp(),
            });
            await firestore
                .collection('usernames')
                .doc(user['username']!)
                .set({
              'uid': cred.user!.uid,
              'createdAt': FieldValue.serverTimestamp(),
            });
            await auth.signOut();
          } catch (inner) {
            _addLog('  → Profile ensured for ${user['email']}');
          }
        } else {
          _addLog('✗ Failed: ${user['email']} — ${e.message}');
        }
      }
    }

    // Sign the original user back in via Google (they'll need to re-auth)
    _addLog('');
    _addLog('Done! Sign out and back in with your Google account.');
    _addLog('');
    _addLog('Test usernames you can DM:');
    for (final user in _testUsers) {
      _addLog('  • @${user['username']}');
    }

    setState(() => _running = false);
  }

  Future<void> _sendTestMessages() async {
    setState(() {
      _running = true;
      _logs.clear();
    });

    final firestore = FirebaseFirestore.instance;
    final currentUser = FirebaseAuth.instance.currentUser;

    if (currentUser == null) {
      _addLog('✗ Not signed in. Sign in first.');
      setState(() => _running = false);
      return;
    }

    final currentUid = currentUser.uid;

    // Find test user UIDs from Firestore
    final usersQuery = await firestore
        .collection('users')
        .where('email', whereIn: [
      'mike.johnson@test.com',
      'sarah.williams@test.com',
      'james.garcia@test.com',
    ]).get();

    if (usersQuery.docs.isEmpty) {
      _addLog('✗ No test users found. Run "Create Test Users" first.');
      setState(() => _running = false);
      return;
    }

    final testUsers = usersQuery.docs.map((doc) => {
      'uid': doc.id,
      'displayName': doc['displayName'] as String,
      'email': doc['email'] as String,
    }).toList();

    // Create DM chats with test messages
    final dmMessages = [
      'Hey! Ready for the draft this weekend?',
      'Did you see that trade? Insane value.',
      'Your lineup looks stacked this week 🔥',
    ];

    for (var i = 0; i < testUsers.length && i < dmMessages.length; i++) {
      final testUser = testUsers[i];
      final uid = testUser['uid']!;
      final name = testUser['displayName']!;

      // Check if DM already exists
      final existingDm = await firestore
          .collection('chats')
          .where('isGroup', isEqualTo: false)
          .where('memberIds', arrayContains: currentUid)
          .get();

      String? chatId;
      for (final doc in existingDm.docs) {
        final members = List<String>.from(doc['memberIds'] ?? []);
        if (members.contains(uid) && members.length == 2) {
          chatId = doc.id;
          break;
        }
      }

      // Create DM if it doesn't exist
      if (chatId == null) {
        final docRef = await firestore.collection('chats').add({
          'memberIds': [currentUid, uid],
          'memberNames': {
            currentUid: currentUser.displayName ?? 'You',
            uid: name,
          },
          'isGroup': false,
          'name': '',
          'lastMessage': dmMessages[i],
          'lastMessageAt': FieldValue.serverTimestamp(),
          'createdBy': uid,
        });
        chatId = docRef.id;
      }

      // Send a message from the test user
      await firestore
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .add({
        'senderId': uid,
        'senderName': name,
        'text': dmMessages[i],
        'sentAt': FieldValue.serverTimestamp(),
      });

      // Update last message
      await firestore.collection('chats').doc(chatId).update({
        'lastMessage': dmMessages[i],
        'lastMessageAt': FieldValue.serverTimestamp(),
      });

      _addLog('✓ DM from $name: "${dmMessages[i]}"');
    }

    // Create a group chat with test messages
    final groupQuery = await firestore
        .collection('chats')
        .where('isGroup', isEqualTo: true)
        .where('memberIds', arrayContains: currentUid)
        .limit(1)
        .get();

    String? groupId;
    if (groupQuery.docs.isNotEmpty) {
      groupId = groupQuery.docs.first.id;
    } else {
      // Create a group
      final groupRef = await firestore.collection('chats').add({
        'memberIds': [currentUid, ...testUsers.map((u) => u['uid']!)],
        'isGroup': true,
        'name': 'League Trash Talk',
        'lastMessage': '',
        'lastMessageAt': FieldValue.serverTimestamp(),
        'createdBy': testUsers.first['uid'],
      });
      groupId = groupRef.id;
      _addLog('✓ Created group: "League Trash Talk"');
    }

    // Send messages from different test users in the group
    final groupMessages = [
      {'user': testUsers[0], 'text': 'Who\'s ready to lose this week? 😂'},
      {'user': testUsers.length > 1 ? testUsers[1] : testUsers[0], 'text': 'Bold talk from last place lol'},
    ];

    for (final msg in groupMessages) {
      final user = msg['user'] as Map<String, String>;
      final text = msg['text'] as String;

      await firestore
          .collection('chats')
          .doc(groupId)
          .collection('messages')
          .add({
        'senderId': user['uid'],
        'senderName': user['displayName'],
        'text': text,
        'sentAt': FieldValue.serverTimestamp(),
      });

      await firestore.collection('chats').doc(groupId).update({
        'lastMessage': text,
        'lastMessageAt': FieldValue.serverTimestamp(),
      });

      _addLog('✓ Group msg from ${user['displayName']}: "$text"');
    }

    _addLog('');
    _addLog('Done! Go back to the dashboard to see unread badges.');

    setState(() => _running = false);
  }

  void _addLog(String msg) {
    setState(() => _logs.add(msg));
  }

  static const _leagueNames = [
    'Gridiron Gladiators',
    'Sunday Scaries',
    'Touchdown Town',
    'The Waiver Wire',
    'Bench Warmers',
    'Draft Day Dummies',
    'End Zone Elite',
    'Fantasy Fiends',
    'Pigskin Posse',
    'Sleeper Cell',
    'Trade Block Party',
    'Sack Attack',
    'Redzone Renegades',
    'The Commissioner\'s League',
    'Fourth & Goal',
    'Hail Mary Heroes',
  ];

  static const _leagueTypes = [
    'Redraft',
    'Dynasty',
    'Keeper',
    'Best Ball',
  ];

  static const _scoringFormats = [
    'PPR',
    'Half PPR',
    'Standard',
    'TE Premium',
  ];

  static const _draftTypes = [
    'Snake',
    'Auction',
    'Linear',
  ];

  Future<void> _seedLeagues() async {
    setState(() {
      _running = true;
      _logs.clear();
    });

    final currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser == null) {
      _addLog('✗ Not signed in. Sign in first.');
      setState(() => _running = false);
      return;
    }

    final firestore = FirebaseFirestore.instance;
    final random = Random();
    final uid = currentUser.uid;

    // Shuffle league names and pick 8
    final names = List<String>.from(_leagueNames)..shuffle(random);
    final count = 8;

    for (var i = 0; i < count; i++) {
      final name = names[i];
      final leagueType = _leagueTypes[random.nextInt(_leagueTypes.length)];
      final scoringFormat =
          _scoringFormats[random.nextInt(_scoringFormats.length)];
      final draftType = _draftTypes[random.nextInt(_draftTypes.length)];
      final maxMembers = [8, 10, 12, 14][random.nextInt(4)];

      // Fill all member slots so draft can start
      final memberIds = <String>[uid];
      for (var m = 1; m < maxMembers; m++) {
        memberIds.add('bot_${random.nextInt(999999).toString().padLeft(6, '0')}');
      }

      final inviteCode = List.generate(
        12,
        (_) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[
            random.nextInt(32)],
      ).join();

      await firestore.collection('leagues').add({
        'name': name,
        'inviteCode': inviteCode,
        'commissionerId': uid,
        'memberIds': memberIds,
        'maxMembers': maxMembers,
        'createdAt': Timestamp.fromDate(
          DateTime.now().subtract(Duration(days: random.nextInt(90))),
        ),
        'leagueType': leagueType,
        'scoringFormat': scoringFormat,
        'draftType': draftType,
        'salariesEnabled': random.nextBool(),
        'contractsEnabled': leagueType == 'Dynasty',
        'schemesEnabled': false,
        'practiceSquadEnabled': random.nextBool(),
        'practiceSquadSize': 10,
        'scoringValues': <String, double>{},
        'scoringEnabled': <String, bool>{},
        'rosterPreset': 'Classic',
        'rosterSlots': <String, int>{},
        'roundMode': 'Custom',
        'roundCount': 15,
        'regularSeasonWeeks': 14,
        'playoffTeams': [4, 6][random.nextInt(2)],
        'tradeDeadline': 'Week ${random.nextInt(4) + 9}',
        'waiverFormat': random.nextBool() ? 'Rolling' : 'FAAB',
        'faabBudget': 100,
        'practiceSquadStealing': false,
        'minimumRosterSize': 10,
        'scoutCollegePlayers': false,
        'contractNegotiations': false,
        'draftCompleted': false,
        'draftStartTime': Timestamp.fromDate(
          DateTime.now().subtract(const Duration(minutes: 5)),
        ),
        'pickTimerSeconds': [60, 90, 120][random.nextInt(3)],
        'sleepModeEnabled': false,
        'sleepModeStart': '23:00',
        'sleepModeEnd': '08:00',
        'sleepModePickTimer': 480,
        'memberStrikes': <String, int>{},
        'aiTeams': <String>[],
      });

      _addLog(
          '✓ Created: "$name" ($leagueType, $scoringFormat, $maxMembers/$maxMembers)');
    }

    _addLog('');
    _addLog('Done! Created $count test leagues.');
    setState(() => _running = false);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: DyneTheme.landingGradient),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(Icons.arrow_back,
                          color: colorScheme.onSurface),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Seed Test Users',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onSurface,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _running ? null : _seed,
                    child: Text(_running ? 'Working...' : 'Create Test Users'),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _running ? null : _sendTestMessages,
                    child: const Text('Send Test Messages'),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _running ? null : _seedLeagues,
                    child: const Text('Seed Test Leagues'),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: _logs.length,
                  itemBuilder: (context, index) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        _logs[index],
                        style: TextStyle(
                          fontSize: 13,
                          fontFamily: 'monospace',
                          color: colorScheme.onSurface.withValues(alpha: 0.8),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
