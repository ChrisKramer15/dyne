import 'package:cloud_firestore/cloud_firestore.dart';

class Chat {
  Chat({
    required this.id,
    required this.memberIds,
    required this.isGroup,
    required this.name,
    required this.memberNames,
    required this.lastMessage,
    required this.lastMessageAt,
    required this.lastRead,
    required this.createdBy,
  });

  final String id;
  final List<String> memberIds;
  final bool isGroup;
  final String name; // Group name or empty for DMs
  final Map<String, String> memberNames; // uid -> displayName
  final String lastMessage;
  final DateTime lastMessageAt;
  final Map<String, DateTime> lastRead; // uid -> last read timestamp
  final String createdBy;

  factory Chat.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final lastReadRaw = data['lastRead'] as Map<String, dynamic>? ?? {};
    final lastReadParsed = lastReadRaw.map((key, value) =>
        MapEntry(key, (value as Timestamp?)?.toDate() ?? DateTime(2000)));

    return Chat(
      id: doc.id,
      memberIds: List<String>.from(data['memberIds'] ?? []),
      isGroup: data['isGroup'] ?? false,
      name: data['name'] ?? '',
      memberNames: Map<String, String>.from(data['memberNames'] ?? {}),
      lastMessage: data['lastMessage'] ?? '',
      lastMessageAt:
          (data['lastMessageAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      lastRead: lastReadParsed,
      createdBy: data['createdBy'] ?? '',
    );
  }

  /// Whether this chat has unread messages for the given user.
  bool isUnreadFor(String uid) {
    if (lastMessage.isEmpty) return false;
    final userLastRead = lastRead[uid];
    if (userLastRead == null) return true;
    return lastMessageAt.isAfter(userLastRead);
  }
}

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.text,
    required this.sentAt,
  });

  final String id;
  final String senderId;
  final String senderName;
  final String text;
  final DateTime sentAt;

  factory ChatMessage.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ChatMessage(
      id: doc.id,
      senderId: data['senderId'] ?? '',
      senderName: data['senderName'] ?? '',
      text: data['text'] ?? '',
      sentAt: (data['sentAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
