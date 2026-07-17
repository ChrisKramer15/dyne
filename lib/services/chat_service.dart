import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/chat.dart';

/// Service for managing chats and messages in Firestore.
class ChatService {
  final _firestore = FirebaseFirestore.instance;
  final _auth = FirebaseAuth.instance;

  CollectionReference get _chatsRef => _firestore.collection('chats');

  String get _currentUserId => _auth.currentUser!.uid;
  String get _currentUserName =>
      _auth.currentUser?.displayName ?? 'Anonymous';

  /// Get all chats the current user is part of, ordered by last activity.
  Stream<List<Chat>> getUserChats() {
    return _chatsRef
        .where('memberIds', arrayContains: _currentUserId)
        .snapshots()
        .map((snapshot) {
      final chats =
          snapshot.docs.map((doc) => Chat.fromFirestore(doc)).toList();
      chats.sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));
      return chats;
    });
  }

  /// Create or get an existing DM conversation with another user.
  Future<Chat> getOrCreateDm(String otherUserId, String otherUserName) async {
    // Check if a DM already exists between these two users
    final query = await _chatsRef
        .where('isGroup', isEqualTo: false)
        .where('memberIds', arrayContains: _currentUserId)
        .get();

    for (final doc in query.docs) {
      final members = List<String>.from(doc['memberIds'] ?? []);
      if (members.contains(otherUserId) && members.length == 2) {
        return Chat.fromFirestore(doc);
      }
    }

    // Create new DM
    final docRef = await _chatsRef.add({
      'memberIds': [_currentUserId, otherUserId],
      'memberNames': {_currentUserId: _currentUserName, otherUserId: otherUserName},
      'isGroup': false,
      'name': '',
      'lastMessage': '',
      'lastMessageAt': FieldValue.serverTimestamp(),
      'createdBy': _currentUserId,
    });

    final doc = await docRef.get();
    return Chat.fromFirestore(doc);
  }

  /// Create a group chat.
  Future<Chat> createGroupChat({
    required String name,
    required List<String> memberIds,
  }) async {
    final allMembers = {_currentUserId, ...memberIds}.toList();

    final docRef = await _chatsRef.add({
      'memberIds': allMembers,
      'isGroup': true,
      'name': name,
      'lastMessage': '',
      'lastMessageAt': FieldValue.serverTimestamp(),
      'createdBy': _currentUserId,
    });

    final doc = await docRef.get();
    return Chat.fromFirestore(doc);
  }

  /// Get messages for a chat, ordered newest first.
  Stream<List<ChatMessage>> getMessages(String chatId) {
    return _chatsRef
        .doc(chatId)
        .collection('messages')
        .orderBy('sentAt', descending: true)
        .limit(100)
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map((doc) => ChatMessage.fromFirestore(doc)).toList());
  }

  /// Send a message to a chat.
  Future<void> sendMessage(String chatId, String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    final batch = _firestore.batch();

    // Add the message
    final messageRef = _chatsRef.doc(chatId).collection('messages').doc();
    batch.set(messageRef, {
      'senderId': _currentUserId,
      'senderName': _currentUserName,
      'text': trimmed,
      'sentAt': FieldValue.serverTimestamp(),
    });

    // Update the chat's last message
    batch.update(_chatsRef.doc(chatId), {
      'lastMessage': trimmed,
      'lastMessageAt': FieldValue.serverTimestamp(),
    });

    await batch.commit();
  }

  /// Search users by username for starting a DM.
  Future<List<Map<String, String>>> searchUsers(String username) async {
    final query = await _firestore
        .collection('users')
        .where('username', isEqualTo: username.trim().toLowerCase())
        .limit(5)
        .get();

    return query.docs
        .where((doc) => doc.id != _currentUserId)
        .map((doc) {
      final data = doc.data();
      return {
        'uid': doc.id,
        'displayName': data['displayName'] as String? ?? 'Unknown',
        'username': data['username'] as String? ?? '',
        'email': data['email'] as String? ?? '',
      };
    }).toList();
  }

  /// Mark a chat as read by the current user.
  Future<void> markAsRead(String chatId) async {
    await _chatsRef.doc(chatId).update({
      'lastRead.$_currentUserId': FieldValue.serverTimestamp(),
    });
  }

  /// Stream unread counts split by DM and group.
  /// Returns a map: { 'dm': int, 'group': int }
  Stream<Map<String, int>> getUnreadCounts() {
    return _chatsRef
        .where('memberIds', arrayContains: _currentUserId)
        .snapshots()
        .map((snapshot) {
      int dmCount = 0;
      int groupCount = 0;

      for (final doc in snapshot.docs) {
        final data = doc.data() as Map<String, dynamic>;
        final lastMessageAt = (data['lastMessageAt'] as Timestamp?)?.toDate();
        final lastRead = (data['lastRead'] as Map<String, dynamic>?);
        final userLastRead =
            (lastRead?[_currentUserId] as Timestamp?)?.toDate();

        if (lastMessageAt != null &&
            (data['lastMessage'] as String? ?? '').isNotEmpty) {
          final isUnread =
              userLastRead == null || lastMessageAt.isAfter(userLastRead);
          if (isUnread) {
            if (data['isGroup'] == true) {
              groupCount++;
            } else {
              dmCount++;
            }
          }
        }
      }

      return {'dm': dmCount, 'group': groupCount};
    });
  }

  /// Save user profile to Firestore (called after sign-in).
  Future<void> saveUserProfile() async {
    final user = _auth.currentUser;
    if (user == null) return;

    await _firestore.collection('users').doc(user.uid).set({
      'displayName': user.displayName ?? 'Anonymous',
      'email': user.email?.toLowerCase() ?? '',
      'photoURL': user.photoURL ?? '',
      'lastSeen': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  /// Stream a single chat document for real-time updates.
  Stream<Chat> getChatStream(String chatId) {
    return _chatsRef.doc(chatId).snapshots().map(
          (doc) => Chat.fromFirestore(doc),
        );
  }

  /// Add a member to a group chat by username.
  /// Returns the display name of the added user.
  Future<String> addMemberByUsername(String chatId, String username) async {
    final results = await searchUsers(username);
    if (results.isEmpty) {
      throw ChatException('No user found with that username.');
    }

    final user = results.first;
    final uid = user['uid']!;
    final displayName = user['displayName']!;

    // Check if already a member
    final chatDoc = await _chatsRef.doc(chatId).get();
    final members = List<String>.from(
        (chatDoc.data() as Map<String, dynamic>)['memberIds'] ?? []);
    if (members.contains(uid)) {
      throw ChatException('$displayName is already in this group.');
    }

    await _chatsRef.doc(chatId).update({
      'memberIds': FieldValue.arrayUnion([uid]),
    });

    return displayName;
  }

  /// Remove a member from a group chat.
  Future<void> removeMember(String chatId, String userId) async {
    await _chatsRef.doc(chatId).update({
      'memberIds': FieldValue.arrayRemove([userId]),
    });
  }

  /// Get member profiles for a list of user IDs.
  Future<List<Map<String, String>>> getMemberProfiles(
      List<String> userIds) async {
    if (userIds.isEmpty) return [];

    final results = <Map<String, String>>[];
    // Firestore 'in' queries limited to 30 at a time
    for (var i = 0; i < userIds.length; i += 30) {
      final batch = userIds.sublist(
          i, i + 30 > userIds.length ? userIds.length : i + 30);
      final query = await _firestore
          .collection('users')
          .where(FieldPath.documentId, whereIn: batch)
          .get();
      for (final doc in query.docs) {
        final data = doc.data();
        results.add({
          'uid': doc.id,
          'displayName': data['displayName'] as String? ?? 'Unknown',
          'email': data['email'] as String? ?? '',
        });
      }
    }
    return results;
  }
}

class ChatException implements Exception {
  ChatException(this.message);
  final String message;

  @override
  String toString() => message;
}
