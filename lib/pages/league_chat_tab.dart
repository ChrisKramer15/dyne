import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

/// League-specific chat tab with channels and DMs.
class LeagueChatTab extends StatefulWidget {
  const LeagueChatTab({super.key, required this.leagueId});

  final String leagueId;

  @override
  State<LeagueChatTab> createState() => _LeagueChatTabState();
}

class _LeagueChatTabState extends State<LeagueChatTab>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _messageController = TextEditingController();
  String? _selectedChannelId;

  String get _uid => FirebaseAuth.instance.currentUser!.uid;
  String get _displayName =>
      FirebaseAuth.instance.currentUser?.displayName ?? 'Anonymous';

  DocumentReference get _leagueRef => FirebaseFirestore.instance
      .collection('leagues')
      .doc(widget.leagueId);

  CollectionReference get _channelsRef => _leagueRef.collection('channels');

  CollectionReference get _dmRef => _leagueRef.collection('league_dms');

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _ensurePrimaryChannel();
  }

  Future<void> _ensurePrimaryChannel() async {
    final primary = await _channelsRef.doc('general').get();
    if (!primary.exists) {
      await _channelsRef.doc('general').set({
        'name': 'General',
        'isPrimary': true,
        'createdAt': FieldValue.serverTimestamp(),
      });
    }
  }

  Future<void> _markChannelRead(String channelId) async {
    await _channelsRef.doc(channelId).set({
      'lastRead': {_uid: FieldValue.serverTimestamp()},
    }, SetOptions(merge: true));
  }

  Future<void> _markDmRead(String dmId) async {
    await _dmRef.doc(dmId).set({
      'lastRead': {_uid: FieldValue.serverTimestamp()},
    }, SetOptions(merge: true));
  }

  @override
  void dispose() {
    _tabController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<bool> _isCommissioner() async {
    final doc = await _leagueRef.get();
    final data = doc.data() as Map<String, dynamic>?;
    return data?['commissionerId'] == _uid;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        _buildTabBar(colorScheme),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildChannelsView(colorScheme),
              _buildDmList(colorScheme),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTabBar(ColorScheme colorScheme) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: const Color(0xFF141829),
      ),
      child: TabBar(
        controller: _tabController,
        indicatorSize: TabBarIndicatorSize.tab,
        indicator: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: colorScheme.primary.withValues(alpha: 0.2),
        ),
        labelColor: colorScheme.primary,
        unselectedLabelColor: colorScheme.onSurface.withValues(alpha: 0.4),
        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        dividerHeight: 0,
        tabs: const [
          Tab(text: 'Channels'),
          Tab(text: 'DMs'),
        ],
      ),
    );
  }

  // ─── Channels View ───────────────────────────────────────────────

  Widget _buildChannelsView(ColorScheme colorScheme) {
    if (_selectedChannelId != null) {
      return _buildChannelChat(colorScheme);
    }
    return _buildChannelList(colorScheme);
  }

  Widget _buildChannelList(ColorScheme colorScheme) {
    return Column(
      children: [
        Expanded(
          child: StreamBuilder<QuerySnapshot>(
            stream: _channelsRef.orderBy('createdAt').snapshots(),
            builder: (context, snapshot) {
              final docs = snapshot.data?.docs ?? [];

              return ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: docs.length,
                itemBuilder: (context, index) {
                  final data = docs[index].data() as Map<String, dynamic>;
                  final channelId = docs[index].id;
                  final name = data['name'] as String? ?? 'Channel';
                  final isPrimary = data['isPrimary'] == true;

                  return _buildChannelTile(
                    channelId: channelId,
                    name: name,
                    isPrimary: isPrimary,
                    colorScheme: colorScheme,
                  );
                },
              );
            },
          ),
        ),
        FutureBuilder<bool>(
          future: _isCommissioner(),
          builder: (context, snap) {
            if (snap.data != true) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: GestureDetector(
                onTap: () => _showCreateChannelDialog(colorScheme),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: colorScheme.primary.withValues(alpha: 0.08),
                    border: Border.all(
                        color: colorScheme.primary.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add, size: 18, color: colorScheme.primary),
                      const SizedBox(width: 8),
                      Text('New Channel',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.primary,
                          )),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildChannelTile({
    required String channelId,
    required String name,
    required bool isPrimary,
    required ColorScheme colorScheme,
  }) {
    return StreamBuilder<DocumentSnapshot>(
      stream: _channelsRef.doc(channelId).snapshots(),
      builder: (context, channelSnap) {
        final channelData = channelSnap.data?.data() as Map<String, dynamic>? ?? {};
        final lastRead = (channelData['lastRead'] as Map<String, dynamic>?);
        final userLastRead = (lastRead?[_uid] as Timestamp?)?.toDate();

        return StreamBuilder<QuerySnapshot>(
          stream: _channelsRef
              .doc(channelId)
              .collection('messages')
              .orderBy('sentAt', descending: true)
              .limit(1)
              .snapshots(),
          builder: (context, snap) {
            bool hasUnread = false;
            if (snap.hasData && snap.data!.docs.isNotEmpty) {
              final lastMsg = snap.data!.docs.first.data() as Map<String, dynamic>;
              final msgTime = (lastMsg['sentAt'] as Timestamp?)?.toDate();
              final senderId = lastMsg['senderId'] as String?;
              if (senderId != _uid && msgTime != null) {
                hasUnread = userLastRead == null || msgTime.isAfter(userLastRead);
              }
            }

        return GestureDetector(
          onTap: () {
            _markChannelRead(channelId);
            setState(() => _selectedChannelId = channelId);
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: hasUnread
                  ? const Color(0xFFFF9100).withValues(alpha: 0.08)
                  : const Color(0xFF141829),
              border: Border.all(
                color: hasUnread
                    ? const Color(0xFFFF9100).withValues(alpha: 0.6)
                    : colorScheme.primary.withValues(alpha: 0.1),
                width: hasUnread ? 1.5 : 1,
              ),
              boxShadow: hasUnread
                  ? [
                      BoxShadow(
                        color: const Color(0xFFFF9100).withValues(alpha: 0.2),
                        blurRadius: 8,
                      )
                    ]
                  : null,
            ),
            child: Row(
              children: [
                Icon(Icons.tag, size: 18,
                    color: hasUnread
                        ? const Color(0xFFFF9100)
                        : colorScheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: hasUnread ? FontWeight.w800 : FontWeight.w600,
                      color: hasUnread
                          ? const Color(0xFFFF9100)
                          : colorScheme.onSurface,
                    ),
                  ),
                ),
                if (hasUnread)
                  Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFFFF9100),
                    ),
                  ),
                if (isPrimary && !hasUnread)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      color: colorScheme.primary.withValues(alpha: 0.15),
                    ),
                    child: Text('DEFAULT',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: colorScheme.primary,
                        )),
                  ),
                const SizedBox(width: 6),
                Icon(Icons.chevron_right,
                    size: 18,
                    color: colorScheme.onSurface.withValues(alpha: 0.3)),
              ],
            ),
          ),
        );
      },
        );
      },
    );
  }

  // ─── Channel Chat ────────────────────────────────────────────────

  Widget _buildChannelChat(ColorScheme colorScheme) {
    return Column(
      children: [
        // Channel header with back button
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              GestureDetector(
                onTap: () => setState(() => _selectedChannelId = null),
                child: Icon(Icons.arrow_back,
                    size: 20, color: colorScheme.onSurface),
              ),
              const SizedBox(width: 10),
              Icon(Icons.tag, size: 16, color: colorScheme.primary),
              const SizedBox(width: 6),
              StreamBuilder<DocumentSnapshot>(
                stream: _channelsRef.doc(_selectedChannelId).snapshots(),
                builder: (context, snap) {
                  final name = (snap.data?.data()
                      as Map<String, dynamic>?)?['name'] ?? 'Channel';
                  return Text(name as String,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                      ));
                },
              ),
              const Spacer(),
              FutureBuilder<bool>(
                future: _isCommissioner(),
                builder: (context, snap) {
                  if (snap.data != true) return const SizedBox.shrink();
                  return GestureDetector(
                    onTap: () => _showChannelOptions(colorScheme),
                    child: Icon(Icons.more_vert, size: 20,
                        color: colorScheme.onSurface.withValues(alpha: 0.5)),
                  );
                },
              ),
            ],
          ),
        ),
        // Messages
        Expanded(
          child: StreamBuilder<QuerySnapshot>(
            stream: _channelsRef
                .doc(_selectedChannelId)
                .collection('messages')
                .orderBy('sentAt', descending: false)
                .limitToLast(100)
                .snapshots(),
            builder: (context, snapshot) {
              final docs = snapshot.data?.docs ?? [];

              if (docs.isEmpty) {
                return Center(
                  child: Text('No messages yet',
                      style: TextStyle(
                        color: colorScheme.onSurface.withValues(alpha: 0.4))),
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: docs.length,
                itemBuilder: (context, index) {
                  final data = docs[index].data() as Map<String, dynamic>;
                  final isMe = data['senderId'] == _uid;
                  return _buildMessageBubble(
                    text: data['text'] as String? ?? '',
                    senderName: data['senderName'] as String? ?? 'Unknown',
                    isMe: isMe,
                    colorScheme: colorScheme,
                  );
                },
              );
            },
          ),
        ),
        _buildMessageInput(colorScheme, channelId: _selectedChannelId!),
      ],
    );
  }

  Widget _buildMessageBubble({
    required String text,
    required String senderName,
    required bool isMe,
    required ColorScheme colorScheme,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment:
            isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (!isMe)
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 2),
              child: Text(senderName,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.primary.withValues(alpha: 0.7),
                  )),
            ),
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.7,
            ),
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: isMe
                  ? colorScheme.primary.withValues(alpha: 0.2)
                  : const Color(0xFF141829),
              border: Border.all(
                color: isMe
                    ? colorScheme.primary.withValues(alpha: 0.3)
                    : colorScheme.primary.withValues(alpha: 0.08),
              ),
            ),
            child: Text(text,
                style: TextStyle(
                    fontSize: 13, color: colorScheme.onSurface)),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageInput(ColorScheme colorScheme, {required String channelId}) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
              color: colorScheme.primary.withValues(alpha: 0.1)),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _messageController,
              decoration: InputDecoration(
                hintText: 'Message...',
                hintStyle: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.3)),
                filled: true,
                fillColor: const Color(0xFF141829),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
              ),
              style:
                  TextStyle(color: colorScheme.onSurface, fontSize: 13),
              onSubmitted: (_) => _sendChannelMessage(channelId),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => _sendChannelMessage(channelId),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colorScheme.primary,
              ),
              child:
                  const Icon(Icons.send, size: 16, color: Colors.black),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _sendChannelMessage(String channelId) async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    _messageController.clear();

    await _channelsRef.doc(channelId).collection('messages').add({
      'senderId': _uid,
      'senderName': _displayName,
      'text': text,
      'sentAt': FieldValue.serverTimestamp(),
    });

    // Update channel's lastMessageAt for unread tracking
    await _channelsRef.doc(channelId).set({
      'lastMessageAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  // ─── Channel Management (Commissioner only) ──────────────────────

  void _showCreateChannelDialog(ColorScheme colorScheme) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF141829),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('New Channel',
            style: TextStyle(color: colorScheme.onSurface)),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Channel name',
            hintStyle: TextStyle(
                color: colorScheme.onSurface.withValues(alpha: 0.3)),
            filled: true,
            fillColor: const Color(0xFF0B0E1A),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
          ),
          style: TextStyle(color: colorScheme.onSurface),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.5))),
          ),
          ElevatedButton(
            onPressed: () async {
              final name = controller.text.trim();
              if (name.isEmpty) return;
              Navigator.pop(ctx);
              await _channelsRef.add({
                'name': name,
                'isPrimary': false,
                'createdAt': FieldValue.serverTimestamp(),
              });
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  void _showChannelOptions(ColorScheme colorScheme) async {
    final channelDoc = await _channelsRef.doc(_selectedChannelId).get();
    final data = channelDoc.data() as Map<String, dynamic>? ?? {};
    final isPrimary = data['isPrimary'] == true;
    final currentName = data['name'] as String? ?? '';

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF141829),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!isPrimary) ...[
              ListTile(
                leading: Icon(Icons.edit, color: colorScheme.primary),
                title: Text('Rename Channel',
                    style: TextStyle(color: colorScheme.onSurface)),
                onTap: () {
                  Navigator.pop(ctx);
                  _showRenameDialog(colorScheme, currentName);
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete, color: Color(0xFFFF2D55)),
                title: const Text('Delete Channel',
                    style: TextStyle(color: Color(0xFFFF2D55))),
                onTap: () async {
                  Navigator.pop(ctx);
                  await _channelsRef.doc(_selectedChannelId).delete();
                  setState(() => _selectedChannelId = null);
                },
              ),
            ],
            if (isPrimary)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'This is the primary channel and cannot be renamed or deleted.',
                  style: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                    fontSize: 13,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showRenameDialog(ColorScheme colorScheme, String currentName) {
    final controller = TextEditingController(text: currentName);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF141829),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Rename Channel',
            style: TextStyle(color: colorScheme.onSurface)),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFF0B0E1A),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
          ),
          style: TextStyle(color: colorScheme.onSurface),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.5))),
          ),
          ElevatedButton(
            onPressed: () async {
              final name = controller.text.trim();
              if (name.isEmpty) return;
              Navigator.pop(ctx);
              await _channelsRef.doc(_selectedChannelId).update({'name': name});
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  // ─── DM List ─────────────────────────────────────────────────────

  Widget _buildDmList(ColorScheme colorScheme) {
    return Column(
      children: [
        Expanded(
          child: StreamBuilder<QuerySnapshot>(
            stream: _dmRef.where('memberIds', arrayContains: _uid).snapshots(),
            builder: (context, snapshot) {
              final docs = snapshot.data?.docs ?? [];

              if (docs.isEmpty) return _buildEmptyDms(colorScheme);

              return ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: docs.length + 1,
                itemBuilder: (context, index) {
                  if (index == 0) return _buildNewDmButton(colorScheme);
                  final data =
                      docs[index - 1].data() as Map<String, dynamic>;
                  final dmId = docs[index - 1].id;
                  final memberNames = Map<String, dynamic>.from(
                      data['memberNames'] ?? {});
                  final otherName = memberNames.entries
                      .where((e) => e.key != _uid)
                      .map((e) => e.value as String)
                      .join(', ');
                  final lastMessage = data['lastMessage'] as String? ?? '';

                  return _buildDmTile(
                    dmId: dmId,
                    name: otherName.isEmpty ? 'Unknown' : otherName,
                    lastMessage: lastMessage,
                    colorScheme: colorScheme,
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyDms(ColorScheme colorScheme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.mail_outline,
              size: 40, color: colorScheme.primary.withValues(alpha: 0.3)),
          const SizedBox(height: 8),
          Text('No conversations yet',
              style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.5))),
          const SizedBox(height: 16),
          _buildNewDmButton(colorScheme),
        ],
      ),
    );
  }

  Widget _buildNewDmButton(ColorScheme colorScheme) {
    return GestureDetector(
      onTap: () => _showNewDmDialog(colorScheme),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: colorScheme.primary.withValues(alpha: 0.08),
          border:
              Border.all(color: colorScheme.primary.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add, size: 18, color: colorScheme.primary),
            const SizedBox(width: 8),
            Text('New Conversation',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: colorScheme.primary,
                )),
          ],
        ),
      ),
    );
  }

  Widget _buildDmTile({
    required String dmId,
    required String name,
    required String lastMessage,
    required ColorScheme colorScheme,
  }) {
    return StreamBuilder<DocumentSnapshot>(
      stream: _dmRef.doc(dmId).snapshots(),
      builder: (context, dmDocSnap) {
        final dmData = dmDocSnap.data?.data() as Map<String, dynamic>? ?? {};
        final lastRead = (dmData['lastRead'] as Map<String, dynamic>?);
        final userLastRead = (lastRead?[_uid] as Timestamp?)?.toDate();

        return StreamBuilder<QuerySnapshot>(
          stream: FirebaseFirestore.instance
              .collection('leagues')
              .doc(widget.leagueId)
              .collection('league_dms')
              .doc(dmId)
              .collection('messages')
              .orderBy('sentAt', descending: true)
              .limit(1)
              .snapshots(),
          builder: (context, snap) {
            bool hasUnread = false;
            if (snap.hasData && snap.data!.docs.isNotEmpty) {
              final lastMsg = snap.data!.docs.first.data() as Map<String, dynamic>;
              final msgTime = (lastMsg['sentAt'] as Timestamp?)?.toDate();
              final senderId = lastMsg['senderId'] as String?;
              if (senderId != _uid && msgTime != null) {
                hasUnread = userLastRead == null || msgTime.isAfter(userLastRead);
              }
            }

        return GestureDetector(
          onTap: () => _openDm(dmId, name),
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: hasUnread
                  ? const Color(0xFFFF00E5).withValues(alpha: 0.06)
                  : const Color(0xFF141829),
              border: Border.all(
                color: hasUnread
                    ? const Color(0xFFFF00E5).withValues(alpha: 0.5)
                    : colorScheme.primary.withValues(alpha: 0.08),
                width: hasUnread ? 1.5 : 1,
              ),
              boxShadow: hasUnread
                  ? [
                      BoxShadow(
                        color: const Color(0xFFFF00E5).withValues(alpha: 0.15),
                        blurRadius: 8,
                      )
                    ]
                  : null,
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: hasUnread
                      ? const Color(0xFFFF00E5).withValues(alpha: 0.2)
                      : colorScheme.primary.withValues(alpha: 0.2),
                  child: Icon(Icons.person, size: 18,
                      color: hasUnread
                          ? const Color(0xFFFF00E5)
                          : colorScheme.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight:
                                hasUnread ? FontWeight.w800 : FontWeight.w600,
                            color: hasUnread
                                ? const Color(0xFFFF00E5)
                                : colorScheme.onSurface,
                          )),
                      if (lastMessage.isNotEmpty)
                        Text(lastMessage,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: hasUnread
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                              color: hasUnread
                                  ? colorScheme.onSurface.withValues(alpha: 0.7)
                                  : colorScheme.onSurface.withValues(alpha: 0.4),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
                if (hasUnread)
                  Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFFFF00E5),
                    ),
                  )
                else
                  Icon(Icons.chevron_right,
                      size: 18,
                      color: colorScheme.onSurface.withValues(alpha: 0.3)),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _showDeleteDmDialog(dmId, colorScheme),
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFFF2D55).withValues(alpha: 0.15),
                    ),
                    child: const Icon(Icons.delete_outline,
                        size: 14, color: Color(0xFFFF2D55)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
        );
      },
    );
  }

  void _openDm(String dmId, String otherName) {
    _markDmRead(dmId);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _LeagueDmPage(
          leagueId: widget.leagueId,
          dmId: dmId,
          otherName: otherName,
        ),
      ),
    );
  }

  void _showDeleteDmDialog(String dmId, ColorScheme colorScheme) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF141829),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Delete Conversation?',
            style: TextStyle(color: colorScheme.onSurface)),
        content: Text(
            'This will permanently delete the entire conversation and all messages.',
            style: TextStyle(
              fontSize: 13,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
            )),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.5))),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              // Delete all messages in the DM
              final messages = await _dmRef
                  .doc(dmId)
                  .collection('messages')
                  .get();
              for (final doc in messages.docs) {
                await doc.reference.delete();
              }
              // Delete the DM document
              await _dmRef.doc(dmId).delete();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFF2D55),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showNewDmDialog(ColorScheme colorScheme) async {
    final leagueDoc = await _leagueRef.get();
    final memberIds = List<String>.from(
        (leagueDoc.data() as Map<String, dynamic>)['memberIds'] ?? []);
    memberIds.remove(_uid);

    final teams = await _leagueRef.collection('teams').get();
    final teamNames = <String, String>{};
    for (final doc in teams.docs) {
      teamNames[doc.id] = (doc.data())['name'] as String? ?? 'Team';
    }

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF141829),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Start a Conversation',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                )),
            const SizedBox(height: 16),
            ...memberIds.map((memberId) {
              final name = teamNames[memberId] ?? 'Team';
              return ListTile(
                leading: CircleAvatar(
                  radius: 16,
                  backgroundColor:
                      colorScheme.primary.withValues(alpha: 0.2),
                  child: Icon(Icons.person,
                      size: 16, color: colorScheme.primary),
                ),
                title: Text(name,
                    style: TextStyle(color: colorScheme.onSurface)),
                onTap: () async {
                  Navigator.pop(ctx);
                  await _startDm(memberId, name);
                },
              );
            }),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Future<void> _startDm(String otherUserId, String otherName) async {
    final existing =
        await _dmRef.where('memberIds', arrayContains: _uid).get();

    for (final doc in existing.docs) {
      final members = List<String>.from(
          (doc.data() as Map<String, dynamic>)['memberIds'] ?? []);
      if (members.contains(otherUserId) && members.length == 2) {
        _openDm(doc.id, otherName);
        return;
      }
    }

    final docRef = await _dmRef.add({
      'memberIds': [_uid, otherUserId],
      'memberNames': {_uid: _displayName, otherUserId: otherName},
      'lastMessage': '',
      'lastMessageAt': FieldValue.serverTimestamp(),
    });

    _openDm(docRef.id, otherName);
  }
}

// ─── DM Conversation Page ────────────────────────────────────────────

class _LeagueDmPage extends StatefulWidget {
  const _LeagueDmPage({
    required this.leagueId,
    required this.dmId,
    required this.otherName,
  });

  final String leagueId;
  final String dmId;
  final String otherName;

  @override
  State<_LeagueDmPage> createState() => _LeagueDmPageState();
}

class _LeagueDmPageState extends State<_LeagueDmPage> {
  final _controller = TextEditingController();

  String get _uid => FirebaseAuth.instance.currentUser!.uid;
  String get _displayName =>
      FirebaseAuth.instance.currentUser?.displayName ?? 'Anonymous';

  CollectionReference get _messagesRef => FirebaseFirestore.instance
      .collection('leagues')
      .doc(widget.leagueId)
      .collection('league_dms')
      .doc(widget.dmId)
      .collection('messages');

  DocumentReference get _dmDocRef => FirebaseFirestore.instance
      .collection('leagues')
      .doc(widget.leagueId)
      .collection('league_dms')
      .doc(widget.dmId);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    _controller.clear();

    await _messagesRef.add({
      'senderId': _uid,
      'senderName': _displayName,
      'text': text,
      'sentAt': FieldValue.serverTimestamp(),
    });
    await _dmDocRef.update({
      'lastMessage': text,
      'lastMessageAt': FieldValue.serverTimestamp(),
    });
  }

  void _showDeleteMessageDialog(String messageId, ColorScheme colorScheme) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF141829),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Delete Message?',
            style: TextStyle(color: colorScheme.onSurface)),
        content: Text('This message will be permanently deleted.',
            style: TextStyle(
              fontSize: 13,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
            )),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: TextStyle(
                    color: colorScheme.onSurface.withValues(alpha: 0.5))),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _messagesRef.doc(messageId).delete();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFF2D55),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0E1A),
        title: Text(widget.otherName,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface,
            )),
        iconTheme: IconThemeData(color: colorScheme.onSurface),
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: _messagesRef
                  .orderBy('sentAt', descending: false)
                  .limitToLast(100)
                  .snapshots(),
              builder: (context, snapshot) {
                final docs = snapshot.data?.docs ?? [];

                return ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: docs.length,
                  itemBuilder: (context, index) {
                    final data =
                        docs[index].data() as Map<String, dynamic>;
                    final docId = docs[index].id;
                    final isMe = data['senderId'] == _uid;

                    return Align(
                      alignment: isMe
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: GestureDetector(
                        onTap: isMe
                            ? () => _showDeleteMessageDialog(docId, colorScheme)
                            : null,
                        child: Container(
                          constraints: BoxConstraints(
                            maxWidth:
                                MediaQuery.of(context).size.width * 0.7,
                          ),
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            color: isMe
                                ? colorScheme.primary
                                    .withValues(alpha: 0.2)
                                : const Color(0xFF141829),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Flexible(
                                child: Text(
                                  data['text'] as String? ?? '',
                                  style: TextStyle(
                                      fontSize: 13,
                                      color: colorScheme.onSurface),
                                ),
                              ),
                              if (isMe) ...[
                                const SizedBox(width: 6),
                                Icon(Icons.delete_outline, size: 12,
                                    color: colorScheme.onSurface.withValues(alpha: 0.2)),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(
                    color: colorScheme.primary.withValues(alpha: 0.1)),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: InputDecoration(
                      hintText: 'Message...',
                      hintStyle: TextStyle(
                          color: colorScheme.onSurface
                              .withValues(alpha: 0.3)),
                      filled: true,
                      fillColor: const Color(0xFF141829),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    style: TextStyle(
                        color: colorScheme.onSurface, fontSize: 13),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _send,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: colorScheme.primary,
                    ),
                    child: const Icon(Icons.send,
                        size: 16, color: Colors.black),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
