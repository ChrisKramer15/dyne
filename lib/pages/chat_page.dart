import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models/chat.dart';
import '../services/chat_service.dart';
import '../theme/dyne_theme.dart';

/// Individual chat conversation page with real-time messages.
class ChatPage extends StatefulWidget {
  const ChatPage({super.key, required this.chat});

  final Chat chat;

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _chatService = ChatService();
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    // Mark chat as read when opened
    _chatService.markAsRead(widget.chat.id);
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    _messageController.clear();
    await _chatService.sendMessage(widget.chat.id, text);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final currentUid = FirebaseAuth.instance.currentUser?.uid ?? '';

    return StreamBuilder<Chat>(
      stream: _chatService.getChatStream(widget.chat.id),
      initialData: widget.chat,
      builder: (context, chatSnapshot) {
        final chat = chatSnapshot.data ?? widget.chat;

        String title;
        if (chat.isGroup) {
          title = chat.name;
        } else {
          final otherName = chat.memberNames.entries
              .where((e) => e.key != currentUid)
              .map((e) => e.value)
              .firstOrNull;
          title = otherName ?? 'Direct Message';
        }

        return Scaffold(
          body: Container(
            decoration: BoxDecoration(gradient: DyneTheme.landingGradient),
            child: SafeArea(
              child: Column(
                children: [
                  // App bar
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: Icon(Icons.arrow_back,
                              color: colorScheme.onSurface),
                        ),
                        const SizedBox(width: 8),
                        CircleAvatar(
                          radius: 18,
                          backgroundColor:
                              colorScheme.primary.withValues(alpha: 0.15),
                          child: Icon(
                            chat.isGroup ? Icons.group : Icons.person,
                            color: colorScheme.primary,
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurface,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (chat.isGroup)
                                Text(
                                  '${chat.memberIds.length} members',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (chat.isGroup)
                          IconButton(
                            onPressed: () =>
                                _showMembersPanel(chat, colorScheme),
                            icon: Icon(Icons.people_outline,
                                color: colorScheme.primary),
                          ),
                      ],
                    ),
                  ),

                  // Messages list
                  Expanded(
                    child: StreamBuilder<List<ChatMessage>>(
                      stream: _chatService.getMessages(chat.id),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState ==
                            ConnectionState.waiting) {
                          return const Center(
                              child: CircularProgressIndicator());
                        }

                        final messages = snapshot.data ?? [];

                        if (messages.isEmpty) {
                          return Center(
                            child: Text(
                              'No messages yet. Say something!',
                              style: TextStyle(
                                color: colorScheme.onSurface
                                    .withValues(alpha: 0.4),
                              ),
                            ),
                          );
                        }

                        return ListView.builder(
                          controller: _scrollController,
                          reverse: true,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          itemCount: messages.length,
                          itemBuilder: (context, index) {
                            final msg = messages[index];
                            final isMe = msg.senderId == currentUid;
                            return _buildMessageBubble(
                                msg, isMe, colorScheme);
                          },
                        );
                      },
                    ),
                  ),

                  // Message input
                  Container(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF141829),
                      border: Border(
                        top: BorderSide(
                          color:
                              colorScheme.primary.withValues(alpha: 0.1),
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _messageController,
                            textInputAction: TextInputAction.send,
                            onSubmitted: (_) => _sendMessage(),
                            decoration: InputDecoration(
                              hintText: 'Type a message...',
                              hintStyle: TextStyle(
                                color: colorScheme.onSurface
                                    .withValues(alpha: 0.3),
                              ),
                              filled: true,
                              fillColor: const Color(0xFF0B0E1A),
                              contentPadding:
                                  const EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 12),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(24),
                                borderSide: BorderSide.none,
                              ),
                            ),
                            style:
                                TextStyle(color: colorScheme.onSurface),
                          ),
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: _sendMessage,
                          child: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: colorScheme.primary,
                            ),
                            child: const Icon(
                              Icons.send,
                              color: Colors.black,
                              size: 20,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showMembersPanel(Chat chat, ColorScheme colorScheme) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF141829),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return _MembersPanel(
          chatId: chat.id,
          chatService: _chatService,
          colorScheme: colorScheme,
        );
      },
    );
  }

  Widget _buildMessageBubble(
      ChatMessage msg, bool isMe, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment:
            isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (!isMe && widget.chat.isGroup)
            Padding(
              padding: const EdgeInsets.only(left: 12, bottom: 2),
              child: Text(
                msg.senderName,
                style: TextStyle(
                  fontSize: 11,
                  color: colorScheme.primary.withValues(alpha: 0.7),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.75,
            ),
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isMe
                  ? colorScheme.primary.withValues(alpha: 0.2)
                  : const Color(0xFF1C2038),
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isMe ? 16 : 4),
                bottomRight: Radius.circular(isMe ? 4 : 16),
              ),
              border: Border.all(
                color: isMe
                    ? colorScheme.primary.withValues(alpha: 0.3)
                    : colorScheme.primary.withValues(alpha: 0.08),
              ),
            ),
            child: Text(
              msg.text,
              style: TextStyle(
                fontSize: 14,
                color: colorScheme.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet that shows group members with add/remove functionality.
class _MembersPanel extends StatelessWidget {
  const _MembersPanel({
    required this.chatId,
    required this.chatService,
    required this.colorScheme,
  });

  final String chatId;
  final ChatService chatService;
  final ColorScheme colorScheme;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.8,
      expand: false,
      builder: (context, scrollController) {
        return StreamBuilder<Chat>(
          stream: chatService.getChatStream(chatId),
          builder: (context, chatSnapshot) {
            final chat = chatSnapshot.data;
            final memberIds = chat?.memberIds ?? [];

            return Column(
              children: [
                // Handle bar
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colorScheme.onSurface.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                  child: Row(
                    children: [
                      Text(
                        'Members (${memberIds.length})',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.onSurface,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () =>
                            _showAddMemberDialog(context),
                        icon: Icon(Icons.person_add,
                            color: colorScheme.primary),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: FutureBuilder<List<Map<String, String>>>(
                    future: chatService.getMemberProfiles(memberIds),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState ==
                          ConnectionState.waiting) {
                        return const Center(
                            child: CircularProgressIndicator());
                      }

                      final members = snapshot.data ?? [];

                      return ListView.builder(
                        controller: scrollController,
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: members.length,
                        itemBuilder: (context, index) {
                          final member = members[index];
                          final currentUid = FirebaseAuth
                                  .instance.currentUser?.uid ??
                              '';
                          final isCurrentUser =
                              member['uid'] == currentUid;

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0B0E1A),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: colorScheme.primary
                                    .withValues(alpha: 0.1),
                              ),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 18,
                                  backgroundColor: colorScheme.primary
                                      .withValues(alpha: 0.15),
                                  child: Text(
                                    (member['displayName'] ?? 'U')[0]
                                        .toUpperCase(),
                                    style: TextStyle(
                                      color: colorScheme.primary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            member['displayName'] ??
                                                'Unknown',
                                            style: TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w500,
                                              color:
                                                  colorScheme.onSurface,
                                            ),
                                          ),
                                          if (isCurrentUser)
                                            Padding(
                                              padding:
                                                  const EdgeInsets.only(
                                                      left: 6),
                                              child: Text(
                                                '(you)',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: colorScheme
                                                      .primary
                                                      .withValues(
                                                          alpha: 0.7),
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      Text(
                                        member['email'] ?? '',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colorScheme.onSurface
                                              .withValues(alpha: 0.4),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (!isCurrentUser)
                                  IconButton(
                                    onPressed: () =>
                                        _confirmRemoveMember(
                                            context, member),
                                    icon: Icon(
                                      Icons.remove_circle_outline,
                                      color: Colors.red.shade400,
                                      size: 20,
                                    ),
                                  ),
                              ],
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showAddMemberDialog(BuildContext context) {
    final usernameController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF141829),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: colorScheme.primary.withValues(alpha: 0.2),
            ),
          ),
          title: Text(
            'Add Member',
            style: TextStyle(color: colorScheme.onSurface),
          ),
          content: TextField(
            controller: usernameController,
            autofocus: true,
            decoration: InputDecoration(
              hintText: 'Enter username',
              hintStyle: TextStyle(
                color: colorScheme.onSurface.withValues(alpha: 0.3),
              ),
              filled: true,
              fillColor: const Color(0xFF0B0E1A),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(
                  color: colorScheme.primary.withValues(alpha: 0.3),
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colorScheme.primary),
              ),
              prefixIcon: Icon(Icons.alternate_email,
                  color: colorScheme.primary),
            ),
            style: TextStyle(color: colorScheme.onSurface),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                final username = usernameController.text.trim();
                if (username.isEmpty) return;
                Navigator.pop(ctx);

                try {
                  final name = await chatService
                      .addMemberByUsername(chatId, username);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('$name added to the group')),
                    );
                  }
                } on ChatException catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.message)),
                    );
                  }
                }
              },
              child: const Text('Add'),
            ),
          ],
        );
      },
    );
  }

  void _confirmRemoveMember(
      BuildContext context, Map<String, String> member) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF141829),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(
            'Remove Member',
            style: TextStyle(color: colorScheme.onSurface),
          ),
          content: Text(
            'Remove ${member['displayName']} from this group?',
            style: TextStyle(
              color: colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await chatService.removeMember(chatId, member['uid']!);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text(
                            '${member['displayName']} removed from group')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade700,
              ),
              child: const Text('Remove'),
            ),
          ],
        );
      },
    );
  }
}
