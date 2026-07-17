import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models/chat.dart';
import '../services/chat_service.dart';
import '../theme/dyne_theme.dart';
import 'chat_page.dart';

/// Page that lists conversations split into DMs and Group Chats tabs.
class ChatListPage extends StatefulWidget {
  const ChatListPage({super.key});

  @override
  State<ChatListPage> createState() => _ChatListPageState();
}

class _ChatListPageState extends State<ChatListPage>
    with SingleTickerProviderStateMixin {
  final _chatService = ChatService();
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
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
              // App bar
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon:
                          Icon(Icons.arrow_back, color: colorScheme.onSurface),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Messages',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onSurface,
                      ),
                    ),
                  ],
                ),
              ),

              // Tab bar
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                decoration: BoxDecoration(
                  color: const Color(0xFF141829),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicator: BoxDecoration(
                    color: colorScheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: colorScheme.primary.withValues(alpha: 0.4),
                    ),
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  dividerColor: Colors.transparent,
                  labelColor: colorScheme.primary,
                  unselectedLabelColor:
                      colorScheme.onSurface.withValues(alpha: 0.5),
                  labelStyle: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                  tabs: const [
                    Tab(text: 'DMs'),
                    Tab(text: 'Group Chats'),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Tab views
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildChatList(isGroup: false, colorScheme: colorScheme),
                    _buildChatList(isGroup: true, colorScheme: colorScheme),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showNewChatAction(colorScheme),
        backgroundColor: colorScheme.primary,
        child: const Icon(Icons.edit, color: Colors.black),
      ),
    );
  }

  Widget _buildChatList(
      {required bool isGroup, required ColorScheme colorScheme}) {
    return StreamBuilder<List<Chat>>(
      stream: _chatService.getUserChats(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final allChats = snapshot.data ?? [];
        final chats =
            allChats.where((c) => c.isGroup == isGroup).toList();

        if (chats.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isGroup ? Icons.group_outlined : Icons.chat_bubble_outline,
                  size: 48,
                  color: colorScheme.primary.withValues(alpha: 0.4),
                ),
                const SizedBox(height: 12),
                Text(
                  isGroup ? 'No group chats yet' : 'No DMs yet',
                  style: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isGroup
                      ? 'Create a group to chat with multiple people'
                      : 'Message someone to get started',
                  style: TextStyle(
                    fontSize: 13,
                    color: colorScheme.onSurface.withValues(alpha: 0.4),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: chats.length,
          itemBuilder: (context, index) =>
              _buildChatTile(chats[index], colorScheme),
        );
      },
    );
  }

  Widget _buildChatTile(Chat chat, ColorScheme colorScheme) {
    final currentUid = FirebaseAuth.instance.currentUser?.uid ?? '';
    final isUnread = chat.isUnreadFor(currentUid);

    String title;
    if (chat.isGroup) {
      title = chat.name;
    } else {
      // Show the other person's name
      final otherName = chat.memberNames.entries
          .where((e) => e.key != currentUid)
          .map((e) => e.value)
          .firstOrNull;
      title = otherName ?? 'Direct Message';
    }

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ChatPage(chat: chat),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isUnread
              ? colorScheme.primary.withValues(alpha: 0.08)
              : const Color(0xFF141829),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isUnread
                ? colorScheme.primary.withValues(alpha: 0.4)
                : colorScheme.primary.withValues(alpha: 0.1),
          ),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: colorScheme.primary.withValues(alpha: 0.15),
              child: Icon(
                chat.isGroup ? Icons.group : Icons.person,
                color: colorScheme.primary,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight:
                          isUnread ? FontWeight.w700 : FontWeight.w600,
                      color: colorScheme.onSurface,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (chat.lastMessage.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      chat.lastMessage,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight:
                            isUnread ? FontWeight.w500 : FontWeight.normal,
                        color: isUnread
                            ? colorScheme.onSurface.withValues(alpha: 0.8)
                            : colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            if (isUnread)
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: chat.isGroup
                      ? const Color(0xFFFF9100)
                      : const Color(0xFFFF00E5),
                ),
              )
            else
              Icon(
                Icons.chevron_right,
                color: colorScheme.onSurface.withValues(alpha: 0.3),
              ),
          ],
        ),
      ),
    );
  }

  void _showNewChatAction(ColorScheme colorScheme) {
    // Determine which action based on current tab
    if (_tabController.index == 0) {
      _showNewDmDialog(colorScheme);
    } else {
      _showNewGroupDialog(colorScheme);
    }
  }

  void _showNewDmDialog(ColorScheme colorScheme) {
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
            'Start a DM',
            style: TextStyle(color: colorScheme.onSurface),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Enter the username of the person you want to message.',
                style: TextStyle(
                  fontSize: 13,
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: usernameController,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'e.g. gridiron_king',
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
            ],
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
                  final results = await _chatService.searchUsers(username);
                  if (results.isEmpty) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content:
                                Text('No user found with that username.')),
                      );
                    }
                    return;
                  }

                  final user = results.first;
                  final chat = await _chatService.getOrCreateDm(
                    user['uid']!,
                    user['displayName']!,
                  );

                  if (mounted) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ChatPage(chat: chat),
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: $e')),
                    );
                  }
                }
              },
              child: const Text('Start Chat'),
            ),
          ],
        );
      },
    );
  }

  void _showNewGroupDialog(ColorScheme colorScheme) {
    final nameController = TextEditingController();

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
            'Create Group Chat',
            style: TextStyle(color: colorScheme.onSurface),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Name your group. You can add members after.',
                style: TextStyle(
                  fontSize: 13,
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameController,
                autofocus: true,
                maxLength: 30,
                decoration: InputDecoration(
                  hintText: 'e.g. League Trash Talk',
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
                  prefixIcon: Icon(Icons.group, color: colorScheme.primary),
                ),
                style: TextStyle(color: colorScheme.onSurface),
              ),
            ],
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
                final name = nameController.text.trim();
                if (name.isEmpty) return;
                Navigator.pop(ctx);

                try {
                  final chat = await _chatService.createGroupChat(
                    name: name,
                    memberIds: [],
                  );
                  if (mounted) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ChatPage(chat: chat),
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: $e')),
                    );
                  }
                }
              },
              child: const Text('Create'),
            ),
          ],
        );
      },
    );
  }
}
