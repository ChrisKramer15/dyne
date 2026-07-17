import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models/draft_pick.dart';
import '../models/player.dart';
import '../services/draft_service.dart';
import '../theme/dyne_theme.dart';
import '../utils/team_defaults.dart';
import '../widgets/dyne_loading.dart';

class DraftRoomPage extends StatefulWidget {
  const DraftRoomPage({super.key, required this.leagueId});

  final String leagueId;

  @override
  State<DraftRoomPage> createState() => _DraftRoomPageState();
}

class _DraftRoomPageState extends State<DraftRoomPage>
    with SingleTickerProviderStateMixin {
  late final DraftService _draftService;
  late final TabController _tabController;
  final _chatController = TextEditingController();
  final _searchController = TextEditingController();

  String _positionFilter = 'All';
  String _searchQuery = '';
  List<String> _queue = [];
  Timer? _timer;
  int _secondsLeft = 0;
  String _autopickMode = 'never';
  final ScrollController _playersScrollController = ScrollController();
  final ScrollController _picksScrollController = ScrollController();
  bool _showScrollToTop = false;
  bool _hasUnreadChat = false;
  int _lastSeenChatCount = -1;
  bool _chatShowUsersOnly = true;

  String get _currentUserId => FirebaseAuth.instance.currentUser!.uid;

  bool _sleepModeEnabled = false;
  String _sleepStart = '23:00';
  String _sleepEnd = '08:00';

  @override
  void initState() {
    super.initState();
    _draftService = DraftService(widget.leagueId);
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(_onTabChanged);
    _loadQueue();
    _loadSleepSettings();
    _playersScrollController.addListener(_onPlayersScroll);
    _listenToChat();
  }

  void _onTabChanged() {
    if (_tabController.index == 3) {
      // User switched to chat tab — mark as read
      setState(() => _hasUnreadChat = false);
    }
  }

  void _listenToChat() {
    _draftService.streamChat().listen((messages) {
      if (!mounted) return;
      // Skip the first emission (initial load) — don't mark as unread
      if (_lastSeenChatCount == -1) {
        _lastSeenChatCount = messages.length;
        return;
      }
      if (_tabController.index != 3 && messages.length > _lastSeenChatCount) {
        // Only mark as unread if the new message is from a user (not system)
        final newMessages = messages.skip(_lastSeenChatCount);
        final hasUserMessage = newMessages
            .any((m) => m['isSystem'] != true && m['senderId'] != 'system');
        if (hasUserMessage) {
          setState(() => _hasUnreadChat = true);
        }
      }
      _lastSeenChatCount = messages.length;
    });
  }

  void _onPlayersScroll() {
    final show = _playersScrollController.offset > 200;
    if (show != _showScrollToTop) {
      setState(() => _showScrollToTop = show);
    }
  }

  Future<void> _loadSleepSettings() async {
    final doc = await FirebaseFirestore.instance
        .collection('leagues')
        .doc(widget.leagueId)
        .get();
    final data = doc.data() ?? {};
    if (mounted) {
      setState(() {
        _sleepModeEnabled = data['sleepModeEnabled'] as bool? ?? false;
        _sleepStart = data['sleepModeStart'] as String? ?? '23:00';
        _sleepEnd = data['sleepModeEnd'] as String? ?? '08:00';
      });
    }
  }

  Future<void> _loadQueue() async {
    final q = await _draftService.getQueue();
    final pref = await _draftService.getAutopickPreference(_currentUserId);
    if (mounted) {
      setState(() {
        _queue = q;
        _autopickMode = pref['mode'] as String? ?? 'never';
      });
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _chatController.dispose();
    _searchController.dispose();
    _draftStripScrollController.dispose();
    _playersScrollController.dispose();
    _picksScrollController.dispose();
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer(int totalSeconds, DateTime pickStartedAt) {
    _timer?.cancel();
    final elapsed = DateTime.now().difference(pickStartedAt).inSeconds;
    _secondsLeft = (totalSeconds - elapsed).clamp(0, totalSeconds);

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        _secondsLeft--;
        if (_secondsLeft <= 0) {
          timer.cancel();
          _handleAutoPick();
        }
      });
    });
  }

  Future<void> _handleAutoPick() async {
    // Only trigger autopick once — read current state and verify timer actually expired
    try {
      final stateDoc = await FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('draft')
          .doc('state')
          .get();

      if (!stateDoc.exists) return;
      final state = stateDoc.data() as Map<String, dynamic>;
      final currentPick = state['currentPick'] as int? ?? 1;
      final totalPicks = state['totalPicks'] as int? ?? 0;
      final status = state['status'] as String? ?? '';
      final draftedIds = List<String>.from(state['draftedPlayerIds'] ?? []);

      if (status != 'active' || currentPick > totalPicks) return;

      // Check if timer truly expired (server-side verification)
      final pickStartedAt = (state['pickStartedAt'] as Timestamp?)?.toDate();
      final pickTimerSeconds = state['pickTimerSeconds'] as int? ?? 120;
      if (pickStartedAt == null) return;

      final elapsed = DateTime.now().difference(pickStartedAt).inSeconds;
      if (elapsed >= pickTimerSeconds) {
        // Get the team on the clock
        final pickDoc = await FirebaseFirestore.instance
            .collection('leagues')
            .doc(widget.leagueId)
            .collection('draft_picks')
            .doc('pick_$currentPick')
            .get();
        final pickTeamId = (pickDoc.data())?['teamId'] as String?;

        // Check if user has autopick enabled
        if (pickTeamId != null) {
          final shouldAuto = await _draftService.shouldAutopick(pickTeamId);
          if (shouldAuto || pickTeamId != _currentUserId) {
            await _draftService.autoPick(currentPick, draftedIds,
                teamId: pickTeamId);
          }
        } else {
          await _draftService.autoPick(currentPick, draftedIds);
        }
      }
    } catch (_) {
      // Silently fail — another client may have already auto-picked
    }
  }

  int? _lastAiPickTriggered;

  Future<void> _checkAiAutoPick(
      String teamId, int currentPick, List<String> draftedIds) async {
    // Prevent re-triggering for the same pick
    if (_lastAiPickTriggered == currentPick) return;

    try {
      final leagueDoc = await FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .get();
      final leagueData = leagueDoc.data() ?? {};
      final aiTeams = List<String>.from(leagueData['aiTeams'] ?? []);

      if (aiTeams.contains(teamId)) {
        _lastAiPickTriggered = currentPick;
        // Small delay to make it feel natural
        await Future.delayed(const Duration(seconds: 2));
        if (!mounted) return;
        await _draftService.autoPick(currentPick, draftedIds, teamId: teamId);
      }
    } catch (_) {
      // Another client may have handled it
    }
  }

  int? _lastUserAutoPickTriggered;

  Future<void> _checkUserAutoPick(
      int currentPick, List<String> draftedIds) async {
    if (_lastUserAutoPickTriggered == currentPick) return;

    try {
      final shouldAuto = await _draftService.shouldAutopick(_currentUserId);
      if (shouldAuto) {
        _lastUserAutoPickTriggered = currentPick;
        await Future.delayed(const Duration(seconds: 1));
        if (!mounted) return;
        await _draftService.autoPick(currentPick, draftedIds,
            teamId: _currentUserId);
        // Refresh autopick mode from Firestore since it may have decremented to 'never'
        final pref = await _draftService.getAutopickPreference(_currentUserId);
        if (mounted) {
          setState(() => _autopickMode = pref['mode'] as String? ?? 'never');
        }
      }
    } catch (_) {
      // Another client may have handled it
    }
  }

  bool _isInSleepWindow(String sleepStart, String sleepEnd) {
    // Convert current time to Eastern Time (UTC-5, or UTC-4 during DST)
    final nowUtc = DateTime.now().toUtc();
    // Determine if Eastern Daylight Time is active (second Sunday in March to first Sunday in November)
    final year = nowUtc.year;
    final dstStart =
        _nthDayOfMonth(year, 3, DateTime.sunday, 2); // 2nd Sunday in March
    final dstEnd =
        _nthDayOfMonth(year, 11, DateTime.sunday, 1); // 1st Sunday in November
    final isDst = nowUtc.isAfter(dstStart) && nowUtc.isBefore(dstEnd);
    final etOffset =
        isDst ? const Duration(hours: -4) : const Duration(hours: -5);
    final nowEt = nowUtc.add(etOffset);

    final currentMinutes = nowEt.hour * 60 + nowEt.minute;
    final startParts = sleepStart.split(':');
    final endParts = sleepEnd.split(':');
    final startMinutes =
        int.parse(startParts[0]) * 60 + int.parse(startParts[1]);
    final endMinutes = int.parse(endParts[0]) * 60 + int.parse(endParts[1]);

    if (startMinutes <= endMinutes) {
      // Same day window (e.g. 01:00 to 06:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight window (e.g. 23:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  /// Get the nth occurrence of a weekday in a given month (for DST calculation).
  DateTime _nthDayOfMonth(int year, int month, int weekday, int n) {
    var date = DateTime.utc(year, month, 1);
    int count = 0;
    while (count < n) {
      if (date.weekday == weekday) count++;
      if (count < n) date = date.add(const Duration(days: 1));
    }
    // DST transitions happen at 2:00 AM local, so use 7:00 UTC (2AM ET + 5)
    return DateTime.utc(year, date.month, date.day, 7);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: DyneTheme.landingGradient),
        child: SafeArea(
          child: StreamBuilder<Map<String, dynamic>>(
            stream: _draftService.streamDraftState(),
            builder: (context, stateSnap) {
              if (stateSnap.hasError) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.error_outline,
                          size: 40, color: colorScheme.error),
                      const SizedBox(height: 12),
                      Text(
                        'Failed to load draft state',
                        style: TextStyle(color: colorScheme.onSurface),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${stateSnap.error}',
                        style: TextStyle(
                          fontSize: 11,
                          color:
                              colorScheme.onSurface.withValues(alpha: 0.5),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                );
              }

              if (!stateSnap.hasData) {
                return const DyneLoading(message: 'Loading draft room...');
              }

              final draftState = stateSnap.data!;

              // Draft not initialized yet
              if (draftState.isEmpty || draftState['status'] == null) {
                return _buildStartDraftView(colorScheme);
              }

              final currentPick = draftState['currentPick'] ?? 1;
              final totalPicks = draftState['totalPicks'] ?? 0;
              final teamIds = List<String>.from(draftState['teamIds'] ?? []);
              final draftedIds =
                  List<String>.from(draftState['draftedPlayerIds'] ?? []);
              final pickTimerSeconds = draftState['pickTimerSeconds'] ?? 120;
              final status = draftState['status'] ?? 'active';

              // Check sleep mode
              final isSleeping =
                  _sleepModeEnabled && _isInSleepWindow(_sleepStart, _sleepEnd);

              // Handle timer
              if (status == 'paused') {
                _timer?.cancel();
                // Show the frozen time remaining from when it was paused
                final pausedElapsed =
                    draftState['pausedElapsedSeconds'] as int? ?? 0;
                final totalTimer = pickTimerSeconds as int;
                _secondsLeft =
                    (totalTimer - pausedElapsed).clamp(0, totalTimer);
              } else if (isSleeping && status == 'active') {
                // Sleep mode: pause the clock but draft stays active for manual picks
                _timer?.cancel();
              } else if (stateSnap.data!['pickStartedAt'] != null &&
                  status == 'active') {
                final pickStartedAt =
                    (stateSnap.data!['pickStartedAt'] as dynamic).toDate()
                        as DateTime;
                _startTimer(pickTimerSeconds as int, pickStartedAt);
              }

              return StreamBuilder<List<DraftPick>>(
                stream: _draftService.streamPicks(),
                builder: (context, picksSnap) {
                  if (picksSnap.hasError) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.error_outline,
                              size: 40,
                              color: colorScheme.error),
                          const SizedBox(height: 12),
                          Text(
                            'Failed to load draft picks',
                            style: TextStyle(color: colorScheme.onSurface),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${picksSnap.error}',
                            style: TextStyle(
                              fontSize: 11,
                              color: colorScheme.onSurface
                                  .withValues(alpha: 0.5),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    );
                  }

                  if (!picksSnap.hasData) {
                    return const DyneLoading(message: 'Loading picks...');
                  }

                  if (picksSnap.data!.isEmpty) {
                    // Picks collection empty — draft state exists but picks
                    // were never written (failed batch). Let user re-initialize.
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(40),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.warning_amber_rounded,
                                size: 40,
                                color: colorScheme.primary
                                    .withValues(alpha: 0.6)),
                            const SizedBox(height: 16),
                            Text(
                              'Draft order not found',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: colorScheme.onSurface,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'The draft picks may not have been created properly. Tap below to regenerate.',
                              style: TextStyle(
                                fontSize: 13,
                                color: colorScheme.onSurface
                                    .withValues(alpha: 0.5),
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 24),
                            ElevatedButton.icon(
                              onPressed: () => _regeneratePicks(draftState),
                              icon: const Icon(Icons.refresh),
                              label: const Text('Regenerate Picks'),
                            ),
                            const SizedBox(height: 12),
                            GestureDetector(
                              onTap: () => Navigator.pop(context),
                              child: Text(
                                'Go Back',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: colorScheme.onSurface
                                      .withValues(alpha: 0.4),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  final picks = picksSnap.data!;
                  final currentPickData = currentPick <= picks.length
                      ? picks[currentPick - 1]
                      : null;
                  final isMyPick = currentPickData?.teamId == _currentUserId;
                  final isDraftOver =
                      status == 'completed' || currentPick > totalPicks;

                  // Auto-pick for AI teams or users with autopick enabled
                  if (!isDraftOver &&
                      currentPickData != null &&
                      status == 'active') {
                    _checkAiAutoPick(
                        currentPickData.teamId, currentPick, draftedIds);
                    if (isMyPick) {
                      _checkUserAutoPick(currentPick, draftedIds);
                    }
                  }

                  return Column(
                    children: [
                      _buildDraftHeader(
                        colorScheme,
                        currentPick: currentPick as int,
                        totalPicks: totalPicks as int,
                        currentPickData: currentPickData,
                        isMyPick: isMyPick,
                        isDraftOver: isDraftOver,
                        teamIds: teamIds,
                        status: status as String,
                      ),
                      if (!isDraftOver && status != 'paused')
                        _buildTimerBar(colorScheme, pickTimerSeconds as int),
                      Expanded(
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            _buildHomeTab(
                              colorScheme,
                              currentPickData: currentPickData,
                              isMyPick: isMyPick,
                              isDraftOver: isDraftOver,
                              teamIds: teamIds,
                              pickTimerSeconds: pickTimerSeconds as int,
                              picks: picks,
                              currentPickNum: currentPick,
                            ),
                            _buildPlayersTab(
                                colorScheme, draftedIds, isMyPick, currentPick),
                            _buildPicksTab(colorScheme, picks, teamIds),
                            _buildChatTab(colorScheme),
                          ],
                        ),
                      ),
                      _buildTabBar(colorScheme),
                    ],
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }

  // ─── Start Draft View ──────────────────────────────────────────────

  Widget _buildStartDraftView(ColorScheme colorScheme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colorScheme.primary.withValues(alpha: 0.15),
              ),
              child: Icon(Icons.sports_football,
                  size: 40, color: colorScheme.primary),
            ),
            const SizedBox(height: 24),
            Text(
              'DRAFT ROOM',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                letterSpacing: 3,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'The draft hasn\'t started yet.',
              style: TextStyle(
                fontSize: 14,
                color: colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(height: 32),
            FutureBuilder<DocumentSnapshot>(
              future: FirebaseFirestore.instance
                  .collection('leagues')
                  .doc(widget.leagueId)
                  .get(),
              builder: (context, snap) {
                if (!snap.hasData) return const SizedBox.shrink();
                final data = snap.data!.data() as Map<String, dynamic>? ?? {};
                final isCommissioner = data['commissionerId'] == _currentUserId;

                if (!isCommissioner) {
                  return Text(
                    'Waiting for the commissioner to start the draft...',
                    style: TextStyle(
                      fontSize: 13,
                      color: colorScheme.onSurface.withValues(alpha: 0.4),
                    ),
                    textAlign: TextAlign.center,
                  );
                }

                return SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: () => _initializeDraft(data),
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: const Text(
                      'Start Draft',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Text(
                'Go Back',
                style: TextStyle(
                  fontSize: 13,
                  color: colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _initializeDraft(Map<String, dynamic> leagueData) async {
    final memberIds = List<String>.from(leagueData['memberIds'] ?? []);
    final maxMembers = leagueData['maxMembers'] as int? ?? 12;
    final draftType = leagueData['draftType'] as String? ?? 'Snake';
    final roundMode = leagueData['roundMode'] as String? ?? 'Fill Roster';
    final rosterSlots = Map<String, int>.from(leagueData['rosterSlots'] ?? {});
    final roundCount = leagueData['roundCount'] as int? ?? 15;

    // Block draft start until all slots are filled
    if (memberIds.length < maxMembers) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Cannot start draft. Need ${maxMembers - memberIds.length} more members (${memberIds.length}/$maxMembers).'),
          ),
        );
      }
      return;
    }

    int totalRounds;
    if (roundMode == 'Fill Roster' && rosterSlots.isNotEmpty) {
      totalRounds = rosterSlots.values.fold(0, (a, b) => a + b);
    } else {
      totalRounds = roundCount;
    }

    // Safety: ensure we have at least some rounds
    if (totalRounds <= 0) totalRounds = 15;

    await _draftService.initializeDraft(
      teamIds: memberIds,
      draftType: draftType,
      rounds: totalRounds,
      pickTimerSeconds: 120,
    );
  }

  Future<void> _regeneratePicks(Map<String, dynamic> draftState) async {
    // Show a loading indicator
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Regenerating picks...'),
          duration: Duration(seconds: 2),
        ),
      );
    }

    try {
      // Always read from the league doc for reliable data
      final leagueDoc = await FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .get();
      final leagueData = leagueDoc.data() ?? {};

      // Also delete the broken draft state so initializeDraft can start fresh
      await FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('draft')
          .doc('state')
          .delete();

      await _initializeDraft(leagueData);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Draft initialized successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  // ─── Home Tab ─────────────────────────────────────────────────────

  Widget _buildHomeTab(
    ColorScheme colorScheme, {
    required DraftPick? currentPickData,
    required bool isMyPick,
    required bool isDraftOver,
    required List<String> teamIds,
    required int pickTimerSeconds,
    required List<DraftPick> picks,
    required int currentPickNum,
  }) {
    if (isDraftOver) {
      return Center(
        child: Text(
          'DRAFT COMPLETE',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w900,
            letterSpacing: 3,
            color: colorScheme.primary,
          ),
        ),
      );
    }

    if (currentPickData == null) {
      return const DyneLoading(message: 'Preparing draft...');
    }

    final onClockTeamId = currentPickData.teamId;

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('teams')
          .doc(onClockTeamId)
          .snapshots(),
      builder: (context, teamSnap) {
        final teamData = teamSnap.data?.data() as Map<String, dynamic>? ?? {};
        final teamName = teamData['name'] as String? ??
            'Team ${teamIds.indexOf(onClockTeamId) + 1}';
        final primaryColor = teamData['primaryColor'] != null
            ? Color(teamData['primaryColor'] as int)
            : colorScheme.primary;
        final secondaryColor = teamData['secondaryColor'] != null
            ? Color(teamData['secondaryColor'] as int)
            : const Color(0xFF0B0E1A);
        final iconIndex = teamData['iconIndex'] as int? ?? 0;

        final iconOptions = TeamDefaults.iconOptions;

        final minutes = _secondsLeft ~/ 60;
        final seconds = _secondsLeft % 60;
        final isLow = _secondsLeft <= 15;

        return Container(
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                primaryColor.withValues(alpha: 0.3),
                secondaryColor.withValues(alpha: 0.8),
                const Color(0xFF0B0E1A),
              ],
            ),
          ),
          child: Stack(
            children: [
              // Background team icon
              Positioned(
                right: -30,
                bottom: -30,
                child: Icon(
                  iconOptions[iconIndex.clamp(0, iconOptions.length - 1)],
                  size: 220,
                  color: primaryColor.withValues(alpha: 0.08),
                ),
              ),
              // Content
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Team icon
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [
                            primaryColor,
                            primaryColor.withValues(alpha: 0.6)
                          ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: primaryColor.withValues(alpha: 0.4),
                            blurRadius: 20,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: Icon(
                        iconOptions[iconIndex.clamp(0, iconOptions.length - 1)],
                        color: Colors.white,
                        size: 36,
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Team name
                    Text(
                      teamName,
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        color: colorScheme.onSurface,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 10),
                    // ON THE CLOCK
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        color: primaryColor.withValues(alpha: 0.2),
                        border: Border.all(
                            color: primaryColor.withValues(alpha: 0.6)),
                        boxShadow: [
                          BoxShadow(
                            color: primaryColor.withValues(alpha: 0.3),
                            blurRadius: 12,
                          ),
                        ],
                      ),
                      child: Text(
                        isMyPick ? '🔥 YOU\'RE ON THE CLOCK' : 'ON THE CLOCK',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 2,
                          color: primaryColor,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Round ${currentPickData.round} • Pick ${currentPickData.pick}',
                      style: TextStyle(
                        fontSize: 12,
                        color: colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                    const SizedBox(height: 30),
                    // Timer
                    Text(
                      '$minutes:${seconds.toString().padLeft(2, '0')}',
                      style: TextStyle(
                        fontSize: 64,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                        color: isLow
                            ? const Color(0xFFFF2D55)
                            : colorScheme.onSurface,
                        shadows: isLow
                            ? [
                                Shadow(
                                  color: const Color(0xFFFF2D55)
                                      .withValues(alpha: 0.5),
                                  blurRadius: 20,
                                ),
                              ]
                            : null,
                      ),
                    ),
                    Text(
                      'TIME REMAINING',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 2,
                        color: colorScheme.onSurface.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ),
              ),
              // Draft order strip at bottom
              Positioned(
                left: 0,
                right: 0,
                bottom: 12,
                child: _buildDraftOrderStrip(
                  colorScheme,
                  picks: picks,
                  currentPickNum: currentPickNum,
                  teamIds: teamIds,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  final ScrollController _draftStripScrollController = ScrollController();

  Widget _buildDraftOrderStrip(
    ColorScheme colorScheme, {
    required List<DraftPick> picks,
    required int currentPickNum,
    required List<String> teamIds,
  }) {
    if (picks.isEmpty) return const SizedBox.shrink();

    // Build complete list of ALL picks for scrollable carousel
    final items = <_DraftOrderItem>[];

    for (var i = 0; i < picks.length; i++) {
      final pickNum = i + 1;
      _DraftOrderType type;
      if (pickNum < currentPickNum) {
        type = _DraftOrderType.previous;
      } else if (pickNum == currentPickNum) {
        type = _DraftOrderType.current;
      } else {
        type = _DraftOrderType.upcoming;
      }
      items.add(_DraftOrderItem(
          picks[i].teamId, type, pickNum, picks[i].round, picks[i].pick));
    }

    // Scroll so the current pick is the first visible icon (left edge)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_draftStripScrollController.hasClients) {
        final currentIndex = currentPickNum - 1;
        const itemWidth = 74.0; // icon size + margins
        final targetOffset = currentIndex * itemWidth;
        _draftStripScrollController.animateTo(
          targetOffset.clamp(
              0.0, _draftStripScrollController.position.maxScrollExtent),
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeOutCubic,
        );
      }
    });

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .snapshots(),
      builder: (context, leagueSnap) {
        final leagueData =
            leagueSnap.data?.data() as Map<String, dynamic>? ?? {};
        final aiTeams = List<String>.from(leagueData['aiTeams'] ?? []);

        return SizedBox(
          height: 90,
          child: ListView.builder(
            controller: _draftStripScrollController,
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              final isAi = aiTeams.contains(item.teamId);

              return StreamBuilder<DocumentSnapshot>(
                stream: FirebaseFirestore.instance
                    .collection('leagues')
                    .doc(widget.leagueId)
                    .collection('teams')
                    .doc(item.teamId)
                    .snapshots(),
                builder: (context, snap) {
                  final data = snap.data?.data() as Map<String, dynamic>? ?? {};
                  final primaryColor = data['primaryColor'] != null
                      ? Color(data['primaryColor'] as int)
                      : colorScheme.primary;
                  final iconIndex = data['iconIndex'] as int? ?? 0;
                  final abbreviation = data['abbreviation'] as String? ?? '';

                  final iconOptions = TeamDefaults.iconOptions;

                  final isCurrent = item.type == _DraftOrderType.current;
                  final isPrevious = item.type == _DraftOrderType.previous;
                  final size = isCurrent ? 56.0 : 48.0;

                  return Container(
                    width: 74,
                    alignment: Alignment.center,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Round.Pick label above
                        Text(
                          '${item.round}.${item.pickInRound}',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight:
                                isCurrent ? FontWeight.w800 : FontWeight.w500,
                            color: isCurrent
                                ? primaryColor
                                : isPrevious
                                    ? Colors.grey.withValues(alpha: 0.5)
                                    : primaryColor.withValues(alpha: 0.6),
                          ),
                        ),
                        const SizedBox(height: 3),
                        // Team icon with AI badge
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: size,
                              height: size,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isPrevious
                                    ? Colors.grey.withValues(alpha: 0.2)
                                    : isCurrent
                                        ? primaryColor.withValues(alpha: 0.3)
                                        : primaryColor.withValues(alpha: 0.12),
                                border: Border.all(
                                  color: isPrevious
                                      ? Colors.grey.withValues(alpha: 0.3)
                                      : isCurrent
                                          ? primaryColor
                                          : primaryColor.withValues(alpha: 0.4),
                                  width: isCurrent ? 2.5 : 1.5,
                                ),
                                boxShadow: isCurrent
                                    ? [
                                        BoxShadow(
                                          color: primaryColor.withValues(
                                              alpha: 0.5),
                                          blurRadius: 12,
                                          spreadRadius: 2,
                                        ),
                                      ]
                                    : null,
                              ),
                              child: Icon(
                                iconOptions[
                                    iconIndex.clamp(0, iconOptions.length - 1)],
                                size: isCurrent ? 28 : 24,
                                color: isPrevious
                                    ? Colors.grey.withValues(alpha: 0.4)
                                    : isCurrent
                                        ? primaryColor
                                        : primaryColor.withValues(alpha: 0.7),
                              ),
                            ),
                            // AI badge
                            if (isAi)
                              Positioned(
                                right: -2,
                                bottom: -2,
                                child: Container(
                                  width: 16,
                                  height: 16,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: const Color(0xFF7C4DFF),
                                    border: Border.all(
                                      color: const Color(0xFF0B0E1A),
                                      width: 1.5,
                                    ),
                                  ),
                                  child: const Icon(
                                    Icons.smart_toy,
                                    size: 9,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            // Completed checkmark for previous picks
                            if (isPrevious &&
                                item.pickNumber <= picks.length &&
                                picks[item.pickNumber - 1].isComplete)
                              Positioned(
                                left: -2,
                                top: -2,
                                child: Container(
                                  width: 14,
                                  height: 14,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: const Color(0xFF00E676),
                                    border: Border.all(
                                      color: const Color(0xFF0B0E1A),
                                      width: 1.5,
                                    ),
                                  ),
                                  child: const Icon(
                                    Icons.check,
                                    size: 8,
                                    color: Colors.black,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        // Team abbreviation below
                        Text(
                          abbreviation,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight:
                                isCurrent ? FontWeight.w800 : FontWeight.w600,
                            letterSpacing: 0.5,
                            color: isCurrent
                                ? primaryColor
                                : isPrevious
                                    ? Colors.grey.withValues(alpha: 0.5)
                                    : primaryColor.withValues(alpha: 0.7),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        );
      },
    );
  }

  // ─── Header ──────────────────────────────────────────────────────

  Widget _buildDraftHeader(
    ColorScheme colorScheme, {
    required int currentPick,
    required int totalPicks,
    required DraftPick? currentPickData,
    required bool isMyPick,
    required bool isDraftOver,
    required List<String> teamIds,
    required String status,
  }) {
    final isPaused = status == 'paused';

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      decoration: BoxDecoration(
        color: isPaused
            ? const Color(0xFFFF8F00).withValues(alpha: 0.08)
            : isMyPick
                ? const Color(0xFF00E676).withValues(alpha: 0.08)
                : Colors.transparent,
        border: Border(
          bottom: BorderSide(
            color: colorScheme.primary.withValues(alpha: 0.1),
          ),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Icon(Icons.arrow_back,
                    color: colorScheme.onSurface, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  isDraftOver
                      ? 'DRAFT COMPLETE'
                      : isPaused
                          ? 'DRAFT PAUSED'
                          : 'LIVE DRAFT',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                    color: isDraftOver
                        ? colorScheme.primary
                        : isPaused
                            ? const Color(0xFFFF8F00)
                            : isMyPick
                                ? const Color(0xFF00E676)
                                : colorScheme.onSurface,
                  ),
                ),
              ),
              if (!isDraftOver)
                FutureBuilder<DocumentSnapshot>(
                  future: FirebaseFirestore.instance
                      .collection('leagues')
                      .doc(widget.leagueId)
                      .get(),
                  builder: (context, snap) {
                    final data =
                        snap.data?.data() as Map<String, dynamic>? ?? {};
                    final isCommissioner =
                        data['commissionerId'] == _currentUserId;
                    final sleepModeEnabled =
                        data['sleepModeEnabled'] as bool? ?? false;
                    final sleepStart =
                        data['sleepModeStart'] as String? ?? '23:00';
                    final sleepEnd = data['sleepModeEnd'] as String? ?? '08:00';
                    final isSleeping = sleepModeEnabled &&
                        _isInSleepWindow(sleepStart, sleepEnd);

                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Sleep mode indicator
                        if (isSleeping)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 5),
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              color: const Color(0xFF7C4DFF)
                                  .withValues(alpha: 0.15),
                              border: Border.all(
                                color: const Color(0xFF7C4DFF)
                                    .withValues(alpha: 0.4),
                              ),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.nightlight_round,
                                  size: 12,
                                  color: Color(0xFF7C4DFF),
                                ),
                                SizedBox(width: 4),
                                Text(
                                  'Sleep',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF7C4DFF),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        // Pause/Resume button (commissioner only)
                        if (isCommissioner)
                          GestureDetector(
                            onTap: () {
                              if (isPaused) {
                                _draftService.resumeDraft();
                              } else {
                                _draftService.pauseDraft();
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(8),
                                color: isPaused
                                    ? const Color(0xFF00E676)
                                        .withValues(alpha: 0.15)
                                    : const Color(0xFFFF8F00)
                                        .withValues(alpha: 0.15),
                                border: Border.all(
                                  color: isPaused
                                      ? const Color(0xFF00E676)
                                          .withValues(alpha: 0.4)
                                      : const Color(0xFFFF8F00)
                                          .withValues(alpha: 0.4),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    isPaused ? Icons.play_arrow : Icons.pause,
                                    size: 14,
                                    color: isPaused
                                        ? const Color(0xFF00E676)
                                        : const Color(0xFFFF8F00),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    isPaused ? 'Resume' : 'Pause',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: isPaused
                                          ? const Color(0xFF00E676)
                                          : const Color(0xFFFF8F00),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              const SizedBox(width: 10),
              Text(
                '$currentPick/$totalPicks',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
          if (!isDraftOver && currentPickData != null) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: isMyPick
                    ? const Color(0xFF00E676).withValues(alpha: 0.15)
                    : const Color(0xFF141829),
                border: Border.all(
                  color: isMyPick
                      ? const Color(0xFF00E676).withValues(alpha: 0.4)
                      : colorScheme.primary.withValues(alpha: 0.1),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    isMyPick ? Icons.front_hand : Icons.hourglass_top,
                    size: 16,
                    color: isMyPick
                        ? const Color(0xFF00E676)
                        : colorScheme.onSurface.withValues(alpha: 0.5),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isMyPick
                        ? 'YOU\'RE ON THE CLOCK!'
                        : 'Team ${teamIds.indexOf(currentPickData.teamId) + 1} is picking...',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: isMyPick
                          ? const Color(0xFF00E676)
                          : colorScheme.onSurface.withValues(alpha: 0.7),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Rd ${currentPickData.round} Pick ${currentPickData.pick}',
                    style: TextStyle(
                      fontSize: 11,
                      color: colorScheme.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ─── Timer Bar ───────────────────────────────────────────────────

  Widget _buildTimerBar(ColorScheme colorScheme, int totalSeconds) {
    final progress = totalSeconds > 0 ? _secondsLeft / totalSeconds : 0.0;
    final isLow = _secondsLeft <= 15;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          Icon(
            Icons.timer,
            size: 14,
            color: isLow
                ? const Color(0xFFFF2D55)
                : colorScheme.onSurface.withValues(alpha: 0.5),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: colorScheme.primary.withValues(alpha: 0.1),
                valueColor: AlwaysStoppedAnimation(
                  isLow ? const Color(0xFFFF2D55) : colorScheme.primary,
                ),
                minHeight: 4,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${(_secondsLeft ~/ 60)}:${(_secondsLeft % 60).toString().padLeft(2, '0')}',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isLow ? const Color(0xFFFF2D55) : colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Tab Bar ─────────────────────────────────────────────────────

  Widget _buildTabBar(ColorScheme colorScheme) {
    return Container(
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: colorScheme.primary.withValues(alpha: 0.1)),
        ),
      ),
      child: TabBar(
        controller: _tabController,
        indicatorColor: colorScheme.primary,
        labelColor: colorScheme.primary,
        unselectedLabelColor: colorScheme.onSurface.withValues(alpha: 0.4),
        labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        tabs: [
          const Tab(icon: Icon(Icons.home_rounded, size: 20), text: 'Home'),
          const Tab(icon: Icon(Icons.person_search, size: 20), text: 'Players'),
          const Tab(icon: Icon(Icons.list_alt, size: 20), text: 'Picks'),
          Tab(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.chat_bubble_outline, size: 20),
                    SizedBox(height: 2),
                    Text('Chat', style: TextStyle(fontSize: 12)),
                  ],
                ),
                if (_hasUnreadChat)
                  Positioned(
                    right: -4,
                    top: 2,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0xFFFF2D55),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Players Tab ─────────────────────────────────────────────────

  Widget _buildPlayersTab(ColorScheme colorScheme, List<String> draftedIds,
      bool isMyPick, int currentPick) {
    final available = PlayerPool.players
        .where((p) => !draftedIds.contains(p.id))
        .where((p) => _positionFilter == 'All' || p.position == _positionFilter)
        .where((p) =>
            _searchQuery.isEmpty ||
            p.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            p.team.toLowerCase().contains(_searchQuery.toLowerCase()))
        .toList()
      ..sort((a, b) => a.rank.compareTo(b.rank));

    // Get queued players that are still available
    final queuedPlayers = _queue
        .map((id) => PlayerPool.players.where((p) => p.id == id).firstOrNull)
        .where((p) => p != null && !draftedIds.contains(p.id))
        .cast<Player>()
        .toList();

    return Column(
      children: [
        _buildSearchAndFilter(colorScheme),
        // Available players list
        Expanded(
          flex: 3,
          child: Stack(
            children: [
              ListView.builder(
                controller: _playersScrollController,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: available.length,
                itemBuilder: (context, index) {
                  final player = available[index];
                  final isQueued = _queue.contains(player.id);
                  return _buildPlayerRow(
                      player, colorScheme, isMyPick, currentPick, isQueued);
                },
              ),
              // Scroll to top button
              if (_showScrollToTop)
                Positioned(
                  right: 12,
                  bottom: 12,
                  child: GestureDetector(
                    onTap: () => _playersScrollController.animateTo(
                      0,
                      duration: const Duration(milliseconds: 400),
                      curve: Curves.easeOutCubic,
                    ),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: colorScheme.primary.withValues(alpha: 0.9),
                        boxShadow: [
                          BoxShadow(
                            color: colorScheme.primary.withValues(alpha: 0.3),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                      child: const Icon(Icons.arrow_upward,
                          size: 18, color: Colors.black),
                    ),
                  ),
                ),
            ],
          ),
        ),
        // Queue section
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF0B0E1A),
            border: Border(
              top: BorderSide(
                  color: colorScheme.primary.withValues(alpha: 0.15)),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
                child: Row(
                  children: [
                    Icon(Icons.queue_rounded,
                        size: 16, color: colorScheme.primary),
                    const SizedBox(width: 8),
                    Text(
                      'My Queue',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        color: colorScheme.primary.withValues(alpha: 0.15),
                      ),
                      child: Text(
                        '${queuedPlayers.length}',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: colorScheme.primary,
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (_queue.isNotEmpty)
                      GestureDetector(
                        onTap: () async {
                          setState(() => _queue.clear());
                          await _draftService.updateQueue([]);
                        },
                        child: Text(
                          'Clear',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color:
                                const Color(0xFFFF2D55).withValues(alpha: 0.7),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              // Autopick controls
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 2, 14, 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.flash_auto,
                      size: 14,
                      color: _autopickMode != 'never'
                          ? const Color(0xFF00E676)
                          : colorScheme.onSurface.withValues(alpha: 0.3),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Auto-pick:',
                      style: TextStyle(
                        fontSize: 11,
                        color: colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ..._buildAutopickChips(colorScheme),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Queue list
        Container(
          color: const Color(0xFF0B0E1A),
          child: SizedBox(
            height: 140,
            child: queuedPlayers.isEmpty
                ? Center(
                    child: Text(
                      'Tap the bookmark icon to add players to your queue',
                      style: TextStyle(
                        fontSize: 11,
                        color: colorScheme.onSurface.withValues(alpha: 0.3),
                      ),
                    ),
                  )
                : ReorderableListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: queuedPlayers.length,
                    onReorderItem: (oldIndex, newIndex) {
                      setState(() {
                        final item = _queue.removeAt(oldIndex);
                        _queue.insert(newIndex, item);
                      });
                      _draftService.updateQueue(_queue);
                    },
                    itemBuilder: (context, index) {
                      final player = queuedPlayers[index];
                      return Container(
                        key: ValueKey(player.id),
                        margin: const EdgeInsets.only(bottom: 4),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          color: const Color(0xFF141829),
                          border: Border.all(
                            color: colorScheme.primary.withValues(alpha: 0.08),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.drag_handle,
                                size: 16,
                                color: colorScheme.onSurface
                                    .withValues(alpha: 0.3)),
                            const SizedBox(width: 8),
                            Text(
                              '${index + 1}',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: colorScheme.primary,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 5, vertical: 2),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(4),
                                color: _positionColor(player.position)
                                    .withValues(alpha: 0.15),
                              ),
                              child: Text(
                                player.position,
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  color: _positionColor(player.position),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                player.name,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurface,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Text(
                              '${player.team} • #${player.rank}',
                              style: TextStyle(
                                fontSize: 10,
                                color: colorScheme.onSurface
                                    .withValues(alpha: 0.4),
                              ),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () async {
                                setState(() => _queue.remove(player.id));
                                await _draftService.updateQueue(_queue);
                              },
                              child: Icon(Icons.close,
                                  size: 14,
                                  color: colorScheme.onSurface
                                      .withValues(alpha: 0.4)),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }

  List<Widget> _buildAutopickChips(ColorScheme colorScheme) {
    const options = [
      ('Off', 'never'),
      ('Next', 'next1'),
      ('Next 2', 'next2'),
      ('Next 3', 'next3'),
      ('Next 5', 'next5'),
      ('Always', 'always'),
    ];

    return options.map((option) {
      final isSelected = _autopickMode == option.$2;
      final isActive = option.$2 != 'never';
      return Padding(
        padding: const EdgeInsets.only(right: 4),
        child: GestureDetector(
          onTap: () async {
            setState(() => _autopickMode = option.$2);
            await _draftService.updateAutopickPreference(
                _currentUserId, option.$2);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              color: isSelected
                  ? (isActive
                      ? const Color(0xFF00E676).withValues(alpha: 0.2)
                      : colorScheme.onSurface.withValues(alpha: 0.1))
                  : Colors.transparent,
              border: Border.all(
                color: isSelected
                    ? (isActive
                        ? const Color(0xFF00E676).withValues(alpha: 0.6)
                        : colorScheme.onSurface.withValues(alpha: 0.2))
                    : colorScheme.onSurface.withValues(alpha: 0.1),
              ),
            ),
            child: Text(
              option.$1,
              style: TextStyle(
                fontSize: 9,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected
                    ? (isActive
                        ? const Color(0xFF00E676)
                        : colorScheme.onSurface)
                    : colorScheme.onSurface.withValues(alpha: 0.4),
              ),
            ),
          ),
        ),
      );
    }).toList();
  }

  Widget _buildSearchAndFilter(ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Column(
        children: [
          TextField(
            controller: _searchController,
            onChanged: (v) => setState(() => _searchQuery = v),
            decoration: InputDecoration(
              hintText: 'Search players...',
              hintStyle: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.3)),
              filled: true,
              fillColor: const Color(0xFF141829),
              prefixIcon:
                  Icon(Icons.search, color: colorScheme.primary, size: 20),
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
            ),
            style: TextStyle(color: colorScheme.onSurface, fontSize: 13),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: ['All', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((pos) {
                final selected = _positionFilter == pos;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: GestureDetector(
                    onTap: () => setState(() => _positionFilter = pos),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        color: selected
                            ? colorScheme.primary.withValues(alpha: 0.2)
                            : const Color(0xFF141829),
                        border: Border.all(
                          color: selected
                              ? colorScheme.primary
                              : colorScheme.primary.withValues(alpha: 0.15),
                        ),
                      ),
                      child: Text(
                        pos,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight:
                              selected ? FontWeight.w700 : FontWeight.normal,
                          color: selected
                              ? colorScheme.primary
                              : colorScheme.onSurface.withValues(alpha: 0.6),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerRow(Player player, ColorScheme colorScheme, bool isMyPick,
      int currentPick, bool isQueued) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: const Color(0xFF141829),
        border: Border.all(color: colorScheme.primary.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              color: _positionColor(player.position).withValues(alpha: 0.2),
            ),
            child: Center(
              child: Text(
                player.position,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  color: _positionColor(player.position),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  player.name,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface,
                  ),
                ),
                Text(
                  '${player.team} • Rank #${player.rank} • Bye ${player.byeWeek}',
                  style: TextStyle(
                    fontSize: 10,
                    color: colorScheme.onSurface.withValues(alpha: 0.4),
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () async {
              setState(() {
                if (isQueued) {
                  _queue.remove(player.id);
                } else {
                  _queue.add(player.id);
                }
              });
              await _draftService.updateQueue(_queue);
            },
            child: Icon(
              isQueued ? Icons.bookmark : Icons.bookmark_border,
              size: 20,
              color: isQueued
                  ? colorScheme.primary
                  : colorScheme.onSurface.withValues(alpha: 0.3),
            ),
          ),
          if (isMyPick) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => _draftService.makePick(currentPick, player),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: const Color(0xFF00E676),
                ),
                child: const Text(
                  'DRAFT',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Colors.black,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color _positionColor(String position) {
    switch (position) {
      case 'QB':
        return const Color(0xFFFF2D55);
      case 'RB':
        return const Color(0xFF00E676);
      case 'WR':
        return const Color(0xFF2979FF);
      case 'TE':
        return const Color(0xFFFF8F00);
      case 'K':
        return const Color(0xFF5E35B1);
      case 'DEF':
        return const Color(0xFF00897B);
      default:
        return const Color(0xFF90A4AE);
    }
  }

  // ─── Picks Tab ───────────────────────────────────────────────────

  Widget _buildPicksTab(
      ColorScheme colorScheme, List<DraftPick> picks, List<String> teamIds) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          TabBar(
            indicatorColor: colorScheme.primary,
            labelColor: colorScheme.primary,
            unselectedLabelColor: colorScheme.onSurface.withValues(alpha: 0.4),
            labelStyle:
                const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
            indicatorWeight: 2,
            tabs: const [
              Tab(text: 'List'),
              Tab(text: 'Board'),
              Tab(text: 'Roster'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildPicksListView(colorScheme, picks, teamIds),
                _buildDraftBoardView(colorScheme, picks, teamIds),
                _buildPicksRosterView(colorScheme, picks),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPicksListView(
      ColorScheme colorScheme, List<DraftPick> picks, List<String> teamIds) {
    // Show all picks in order (completed with player info, pending as upcoming)
    final allPicks = List<DraftPick>.from(picks);

    // Get total rounds for jump chips
    final totalRounds = allPicks.isNotEmpty ? allPicks.last.round : 0;

    // Build items with round dividers and track round positions
    final items = <_PicksListItem>[];
    final roundIndices = <int, int>{}; // round -> index in items list
    int lastRound = 0;
    for (final pick in allPicks) {
      if (pick.round != lastRound) {
        roundIndices[pick.round] = items.length;
        items.add(_PicksListItem.divider(pick.round));
        lastRound = pick.round;
      }
      items.add(_PicksListItem.pick(pick));
    }

    // Find current pick index for scroll-to-current
    final currentPickIndex = items.indexWhere((item) =>
        !item.isDivider && item.pick != null && !item.pick!.isComplete);

    return Column(
      children: [
        // Jump-to-round chips
        Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
          child: SizedBox(
            height: 30,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              itemCount: totalRounds,
              itemBuilder: (context, index) {
                final round = index + 1;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: GestureDetector(
                    onTap: () {
                      final targetIndex = roundIndices[round];
                      if (targetIndex != null &&
                          _picksScrollController.hasClients) {
                        // Estimate position (each item ~62px, dividers ~40px)
                        final estimatedOffset = targetIndex * 58.0;
                        _picksScrollController.animateTo(
                          estimatedOffset.clamp(0.0,
                              _picksScrollController.position.maxScrollExtent),
                          duration: const Duration(milliseconds: 400),
                          curve: Curves.easeOutCubic,
                        );
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        color: colorScheme.primary.withValues(alpha: 0.1),
                        border: Border.all(
                          color: colorScheme.primary.withValues(alpha: 0.25),
                        ),
                      ),
                      child: Text(
                        'Rd $round',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.primary,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        // Picks list
        Expanded(
          child: Stack(
            children: [
              ListView.builder(
                controller: _picksScrollController,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                itemCount: items.length,
                itemBuilder: (context, index) {
                  final item = items[index];

                  if (item.isDivider) {
                    return Container(
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Container(
                              height: 1,
                              color:
                                  colorScheme.primary.withValues(alpha: 0.15),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text(
                              'ROUND ${item.round}',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 2,
                                color:
                                    colorScheme.primary.withValues(alpha: 0.5),
                              ),
                            ),
                          ),
                          Expanded(
                            child: Container(
                              height: 1,
                              color:
                                  colorScheme.primary.withValues(alpha: 0.15),
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  final pick = item.pick!;
                  final isMyPick = pick.teamId == _currentUserId;

                  return StreamBuilder<DocumentSnapshot>(
                    stream: FirebaseFirestore.instance
                        .collection('leagues')
                        .doc(widget.leagueId)
                        .collection('teams')
                        .doc(pick.teamId)
                        .snapshots(),
                    builder: (context, teamSnap) {
                      final teamData =
                          teamSnap.data?.data() as Map<String, dynamic>? ?? {};
                      final teamName = teamData['name'] as String? ??
                          'Team ${teamIds.indexOf(pick.teamId) + 1}';
                      final teamAbbrev =
                          teamData['abbreviation'] as String? ?? '';
                      final teamColor = teamData['primaryColor'] != null
                          ? Color(teamData['primaryColor'] as int)
                          : colorScheme.primary;
                      final teamIconIndex = teamData['iconIndex'] as int? ?? 0;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 4),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 9),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          color: pick.isComplete
                              ? const Color(0xFF141829)
                              : const Color(0xFF0F1220),
                          border: Border.all(
                            color: isMyPick
                                ? teamColor.withValues(alpha: 0.3)
                                : colorScheme.primary.withValues(alpha: 0.06),
                          ),
                          gradient: isMyPick
                              ? LinearGradient(
                                  colors: [
                                    teamColor.withValues(alpha: 0.08),
                                    Colors.transparent,
                                  ],
                                )
                              : null,
                        ),
                        child: Row(
                          children: [
                            // Team icon
                            SizedBox(
                              width: 40,
                              child: Column(
                                children: [
                                  Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: teamColor.withValues(alpha: 0.15),
                                      border: Border.all(
                                        color: teamColor.withValues(alpha: 0.4),
                                      ),
                                    ),
                                    child: Icon(
                                      TeamDefaults.iconOptions[
                                          teamIconIndex.clamp(
                                              0,
                                              TeamDefaults.iconOptions.length -
                                                  1)],
                                      size: 12,
                                      color: teamColor,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    teamAbbrev,
                                    style: TextStyle(
                                      fontSize: 7,
                                      fontWeight: FontWeight.w700,
                                      color: teamColor.withValues(alpha: 0.7),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            // Player info
                            Expanded(
                              child: pick.isComplete
                                  ? Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          pick.playerName ?? '',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                            color: colorScheme.onSurface,
                                          ),
                                        ),
                                        Row(
                                          children: [
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 4,
                                                      vertical: 1),
                                              decoration: BoxDecoration(
                                                borderRadius:
                                                    BorderRadius.circular(3),
                                                color: _positionColor(
                                                        pick.playerPosition ??
                                                            '')
                                                    .withValues(alpha: 0.15),
                                              ),
                                              child: Text(
                                                pick.playerPosition ?? '',
                                                style: TextStyle(
                                                  fontSize: 8,
                                                  fontWeight: FontWeight.w800,
                                                  color: _positionColor(
                                                      pick.playerPosition ??
                                                          ''),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 5),
                                            Text(
                                              '${pick.playerTeam} • $teamName',
                                              style: TextStyle(
                                                fontSize: 10,
                                                color: colorScheme.onSurface
                                                    .withValues(alpha: 0.4),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    )
                                  : Text(
                                      teamName,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w500,
                                        color: colorScheme.onSurface
                                            .withValues(alpha: 0.3),
                                      ),
                                    ),
                            ),
                            // Pick number
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 5, vertical: 2),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(4),
                                color: pick.isComplete
                                    ? colorScheme.primary.withValues(alpha: 0.1)
                                    : colorScheme.onSurface
                                        .withValues(alpha: 0.04),
                              ),
                              child: Text(
                                '${pick.round}.${pick.pick}',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: pick.isComplete
                                      ? colorScheme.primary
                                      : colorScheme.onSurface
                                          .withValues(alpha: 0.3),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
              // Scroll to current pick button
              if (currentPickIndex > 0)
                Positioned(
                  right: 12,
                  bottom: 12,
                  child: GestureDetector(
                    onTap: () {
                      if (_picksScrollController.hasClients) {
                        final estimatedOffset = currentPickIndex * 58.0;
                        _picksScrollController.animateTo(
                          estimatedOffset.clamp(0.0,
                              _picksScrollController.position.maxScrollExtent),
                          duration: const Duration(milliseconds: 400),
                          curve: Curves.easeOutCubic,
                        );
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        color: colorScheme.primary.withValues(alpha: 0.9),
                        boxShadow: [
                          BoxShadow(
                            color: colorScheme.primary.withValues(alpha: 0.3),
                            blurRadius: 10,
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.my_location,
                              size: 14, color: Colors.black),
                          SizedBox(width: 4),
                          Text(
                            'Current',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.black,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDraftBoardView(
      ColorScheme colorScheme, List<DraftPick> picks, List<String> teamIds) {
    if (picks.isEmpty || teamIds.isEmpty) {
      return Center(
          child: Text('No picks yet',
              style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.3))));
    }

    final teamCount = teamIds.length;
    final totalRounds = picks.last.round;

    // Find the current pick to center on
    final currentPick = picks.where((p) => !p.isComplete).firstOrNull;
    final currentRound = currentPick?.round ?? 1;

    return _DraftBoard(
      leagueId: widget.leagueId,
      picks: picks,
      teamIds: teamIds,
      teamCount: teamCount,
      totalRounds: totalRounds,
      currentRound: currentRound,
      currentUserId: _currentUserId,
    );
  }

  Widget _buildPicksRosterView(ColorScheme colorScheme, List<DraftPick> picks) {
    final myPicks =
        picks.where((p) => p.teamId == _currentUserId && p.isComplete).toList();

    return FutureBuilder<DocumentSnapshot>(
      future: FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .get(),
      builder: (context, leagueSnap) {
        final leagueData =
            leagueSnap.data?.data() as Map<String, dynamic>? ?? {};
        final rosterSlots =
            Map<String, int>.from(leagueData['rosterSlots'] ?? {});
        final rosterAssignments = _assignToRoster(rosterSlots, myPicks);

        return ListView.builder(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          itemCount: rosterAssignments.length,
          itemBuilder: (context, index) {
            final slot = rosterAssignments[index];
            if (slot.isHeader) {
              return _buildRosterSectionHeader(slot.position, colorScheme);
            }
            return _buildRosterSlotRow(slot, colorScheme);
          },
        );
      },
    );
  }

  List<_RosterSlot> _assignToRoster(
      Map<String, int> rosterSlots, List<DraftPick> myPicks) {
    final slots = <_RosterSlot>[];
    final unassigned = List<DraftPick>.from(myPicks);

    const offensePositions = [
      'Quarterback',
      'Running Back',
      'Wide Receiver',
      'Tight End',
      'Flex',
      'Left Tackle',
      'Left Guard',
      'Center',
      'Right Guard',
      'Right Tackle'
    ];
    const defensePositions = [
      'Defensive End',
      'Defensive Tackle',
      'Outside Linebacker',
      'Middle Linebacker',
      'Linebacker',
      'Cornerback',
      'Strong Safety',
      'Free Safety',
      'Defensive Back',
      'IDP Flex',
      'Defense'
    ];
    const specialTeamsPositions = ['Kicker', 'Punter'];

    String posToPlayerPos(String pos) {
      switch (pos) {
        case 'Quarterback':
          return 'QB';
        case 'Running Back':
          return 'RB';
        case 'Wide Receiver':
          return 'WR';
        case 'Tight End':
          return 'TE';
        case 'Kicker':
          return 'K';
        case 'Defense':
          return 'DEF';
        case 'Punter':
          return 'P';
        default:
          return pos;
      }
    }

    void fillSlots(List<String> positions, String category) {
      bool hasAny = false;
      for (final pos in positions) {
        if ((rosterSlots[pos] ?? 0) > 0) hasAny = true;
      }
      if (!hasAny) return;
      slots.add(_RosterSlot(position: category, isHeader: true));
      for (final pos in positions) {
        final count = rosterSlots[pos] ?? 0;
        for (var i = 0; i < count; i++) {
          DraftPick? match;
          if (pos == 'Flex') {
            match = unassigned
                .where((p) =>
                    p.playerPosition == 'RB' ||
                    p.playerPosition == 'WR' ||
                    p.playerPosition == 'TE')
                .firstOrNull;
          } else if (pos == 'IDP Flex') {
            match = unassigned
                .where((p) =>
                    p.playerPosition == 'LB' ||
                    p.playerPosition == 'DL' ||
                    p.playerPosition == 'DB')
                .firstOrNull;
          } else {
            final abbrev = posToPlayerPos(pos);
            match =
                unassigned.where((p) => p.playerPosition == abbrev).firstOrNull;
          }
          if (match != null) unassigned.remove(match);
          slots.add(_RosterSlot(position: pos, pick: match));
        }
      }
    }

    fillSlots(offensePositions, 'OFFENSE');
    fillSlots(defensePositions, 'DEFENSE');
    fillSlots(specialTeamsPositions, 'SPECIAL TEAMS');

    final benchCount = rosterSlots['Bench'] ?? 0;
    if (benchCount > 0) {
      slots.add(_RosterSlot(position: 'BENCH', isHeader: true));
      for (var i = 0; i < benchCount; i++) {
        final match = unassigned.isNotEmpty ? unassigned.removeAt(0) : null;
        slots.add(_RosterSlot(position: 'Bench', pick: match));
      }
    }
    return slots;
  }

  String _posAbbrev(String position) {
    switch (position) {
      case 'Quarterback':
        return 'QB';
      case 'Running Back':
        return 'RB';
      case 'Wide Receiver':
        return 'WR';
      case 'Tight End':
        return 'TE';
      case 'Flex':
        return 'FLEX';
      case 'Kicker':
        return 'K';
      case 'Punter':
        return 'P';
      case 'Defense':
        return 'DEF';
      case 'Bench':
        return 'BN';
      case 'Left Tackle':
        return 'LT';
      case 'Left Guard':
        return 'LG';
      case 'Center':
        return 'C';
      case 'Right Guard':
        return 'RG';
      case 'Right Tackle':
        return 'RT';
      case 'Defensive End':
        return 'DE';
      case 'Defensive Tackle':
        return 'DT';
      case 'Outside Linebacker':
        return 'OLB';
      case 'Middle Linebacker':
        return 'MLB';
      case 'Linebacker':
        return 'LB';
      case 'Cornerback':
        return 'CB';
      case 'Free Safety':
        return 'FS';
      case 'Strong Safety':
        return 'SS';
      case 'Defensive Back':
        return 'DB';
      case 'IDP Flex':
        return 'IDP';
      default:
        return position;
    }
  }

  Color _rosterPosColor(String position) {
    switch (position) {
      case 'Quarterback':
        return const Color(0xFFFF2D55);
      case 'Running Back':
        return const Color(0xFF43A047);
      case 'Wide Receiver':
        return const Color(0xFF1E88E5);
      case 'Tight End':
        return const Color(0xFFFF8F00);
      case 'Flex':
        return const Color(0xFFAB47BC);
      case 'Kicker':
      case 'Punter':
        return const Color(0xFF5E35B1);
      case 'Defense':
        return const Color(0xFF00897B);
      case 'Bench':
        return const Color(0xFF78909C);
      case 'Left Tackle':
      case 'Right Tackle':
        return const Color(0xFFF48FB1);
      case 'Left Guard':
      case 'Right Guard':
        return const Color(0xFFAB47BC);
      case 'Center':
        return const Color(0xFF26C6DA);
      case 'Defensive Tackle':
      case 'Defensive End':
        return const Color(0xFFFFD600);
      case 'Outside Linebacker':
      case 'Middle Linebacker':
      case 'Linebacker':
        return const Color(0xFF5C6BC0);
      case 'Cornerback':
      case 'Defensive Back':
        return const Color(0xFFC62200);
      case 'Free Safety':
      case 'Strong Safety':
      case 'IDP Flex':
        return const Color(0xFF00897B);
      default:
        return const Color(0xFF90A4AE);
    }
  }

  Widget _buildRosterSectionHeader(String title, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 6),
      child: Row(children: [
        Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                color: colorScheme.primary)),
        const SizedBox(width: 8),
        Text(title,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.5,
                color: colorScheme.onSurface.withValues(alpha: 0.5))),
      ]),
    );
  }

  Widget _buildRosterSlotRow(_RosterSlot slot, ColorScheme colorScheme) {
    final hasPlayer = slot.pick != null;
    final posColor = _rosterPosColor(slot.position);
    final abbrev = _posAbbrev(slot.position);

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: hasPlayer ? const Color(0xFF141829) : const Color(0xFF0B0E1A),
        border: Border.all(
            color: hasPlayer
                ? posColor.withValues(alpha: 0.15)
                : colorScheme.onSurface.withValues(alpha: 0.05)),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 36,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            gradient: LinearGradient(colors: [
              posColor.withValues(alpha: hasPlayer ? 0.35 : 0.12),
              posColor.withValues(alpha: hasPlayer ? 0.15 : 0.04)
            ]),
            border: Border.all(
                color: posColor.withValues(alpha: hasPlayer ? 0.6 : 0.2),
                width: 1.5),
          ),
          child: Center(
              child: Text(abbrev,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: hasPlayer
                          ? posColor
                          : posColor.withValues(alpha: 0.5)))),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: hasPlayer
              ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(slot.pick!.playerName ?? '',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.onSurface)),
                  Text(
                      '${slot.pick!.playerPosition} • ${slot.pick!.playerTeam}',
                      style: TextStyle(
                          fontSize: 10,
                          color: colorScheme.onSurface.withValues(alpha: 0.4))),
                ])
              : Text('Empty',
                  style: TextStyle(
                      fontSize: 12,
                      color: colorScheme.onSurface.withValues(alpha: 0.2))),
        ),
        if (hasPlayer)
          Text('Rd ${slot.pick!.round}.${slot.pick!.pick}',
              style: TextStyle(
                  fontSize: 10,
                  color: colorScheme.onSurface.withValues(alpha: 0.3))),
      ]),
    );
  }

  // ─── Chat Tab ────────────────────────────────────────────────────

  Widget _buildChatTab(ColorScheme colorScheme) {
    return Column(
      children: [
        // Toggle bar
        Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Row(
            children: [
              _buildChatToggle('All', !_chatShowUsersOnly, colorScheme, () {
                setState(() => _chatShowUsersOnly = false);
              }),
              const SizedBox(width: 8),
              _buildChatToggle('Users Only', _chatShowUsersOnly, colorScheme,
                  () {
                setState(() => _chatShowUsersOnly = true);
              }),
            ],
          ),
        ),
        Expanded(
          child: StreamBuilder<List<Map<String, dynamic>>>(
            stream: _draftService.streamChat(),
            builder: (context, snapshot) {
              var messages = snapshot.data ?? [];

              if (_chatShowUsersOnly) {
                messages = messages
                    .where((m) =>
                        m['isSystem'] != true && m['senderId'] != 'system')
                    .toList();
              }

              return ListView.builder(
                reverse: true,
                padding: const EdgeInsets.all(12),
                itemCount: messages.length,
                itemBuilder: (context, index) {
                  final msg = messages[messages.length - 1 - index];
                  final isMe = msg['senderId'] == _currentUserId;
                  final isSystem = msg['isSystem'] == true;
                  final senderName = msg['senderName'] as String? ?? '';

                  if (isSystem) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        color: colorScheme.primary.withValues(alpha: 0.08),
                        border: Border.all(
                          color: colorScheme.primary.withValues(alpha: 0.15),
                        ),
                      ),
                      child: Text(
                        msg['text'] ?? '',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.primary.withValues(alpha: 0.8),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    );
                  }

                  return Align(
                    alignment:
                        isMe ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.of(context).size.width * 0.75,
                      ),
                      child: Column(
                        crossAxisAlignment: isMe
                            ? CrossAxisAlignment.end
                            : CrossAxisAlignment.start,
                        children: [
                          if (!isMe && senderName.isNotEmpty)
                            Padding(
                              padding:
                                  const EdgeInsets.only(left: 4, bottom: 2),
                              child: Text(
                                senderName,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurface
                                      .withValues(alpha: 0.4),
                                ),
                              ),
                            ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              color: isMe
                                  ? colorScheme.primary.withValues(alpha: 0.2)
                                  : const Color(0xFF141829),
                            ),
                            child: Text(
                              msg['text'] ?? '',
                              style: TextStyle(
                                fontSize: 13,
                                color: colorScheme.onSurface,
                              ),
                            ),
                          ),
                        ],
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
              top:
                  BorderSide(color: colorScheme.primary.withValues(alpha: 0.1)),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatController,
                  decoration: InputDecoration(
                    hintText: 'Trash talk...',
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
                  style: TextStyle(color: colorScheme.onSurface, fontSize: 13),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () {
                  final text = _chatController.text.trim();
                  if (text.isNotEmpty) {
                    _draftService.sendMessage(text);
                    _chatController.clear();
                  }
                },
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colorScheme.primary,
                  ),
                  child: const Icon(Icons.send, size: 16, color: Colors.black),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildChatToggle(String label, bool isSelected,
      ColorScheme colorScheme, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: isSelected
              ? colorScheme.primary.withValues(alpha: 0.2)
              : const Color(0xFF141829),
          border: Border.all(
            color: isSelected
                ? colorScheme.primary.withValues(alpha: 0.5)
                : colorScheme.onSurface.withValues(alpha: 0.1),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected
                ? colorScheme.primary
                : colorScheme.onSurface.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }
}

class _DraftBoard extends StatefulWidget {
  const _DraftBoard({
    required this.leagueId,
    required this.picks,
    required this.teamIds,
    required this.teamCount,
    required this.totalRounds,
    required this.currentRound,
    required this.currentUserId,
  });

  final String leagueId;
  final List<DraftPick> picks;
  final List<String> teamIds;
  final int teamCount;
  final int totalRounds;
  final int currentRound;
  final String currentUserId;

  @override
  State<_DraftBoard> createState() => _DraftBoardState();
}

class _DraftBoardState extends State<_DraftBoard> {
  late final ScrollController _hScroll;
  late final ScrollController _vScroll;
  bool _hasScrolled = false;
  bool _didInitialScroll = false;

  static const _cellWidth = 90.0;
  static const _cellHeight = 56.0;
  static const _headerHeight = 44.0;

  @override
  void initState() {
    super.initState();
    _hScroll = ScrollController()..addListener(_onScroll);
    _vScroll = ScrollController()..addListener(_onScroll);
  }

  @override
  void dispose() {
    _hScroll.dispose();
    _vScroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_hasScrolled && (_hScroll.offset > 5 || _vScroll.offset > 5)) {
      setState(() => _hasScrolled = true);
    }
  }

  void _scrollToCurrentPick() {
    // Find the current (first incomplete) pick
    final currentPick = widget.picks.where((p) => !p.isComplete).firstOrNull;
    if (currentPick == null) return;

    // Scroll vertically to the current round
    final row = currentPick.round - 1;
    final viewportHeight = _vScroll.position.viewportDimension;
    final targetV = (row * _cellHeight) - (viewportHeight / 2) + (_cellHeight / 2);
    _vScroll.animateTo(
      targetV.clamp(0.0, _vScroll.position.maxScrollExtent),
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
    );

    // Scroll horizontally to the team on the clock
    final col = widget.teamIds.indexOf(currentPick.teamId);
    if (col >= 0 && _hScroll.hasClients) {
      final viewportWidth = _hScroll.position.viewportDimension;
      final targetH = (col * _cellWidth + 50) - (viewportWidth / 2) + (_cellWidth / 2);
      _hScroll.animateTo(
        targetH.clamp(0.0, _hScroll.position.maxScrollExtent),
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
    }

    setState(() => _hasScrolled = false);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    // Auto-scroll to current pick on first build
    if (!_didInitialScroll) {
      _didInitialScroll = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_vScroll.hasClients) _scrollToCurrentPick();
      });
    }

    return Stack(
      children: [
        SingleChildScrollView(
          controller: _hScroll,
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: SizedBox(
            width: widget.teamCount * _cellWidth +
                50, // +50 for round label column
            child: Column(
              children: [
                // Header row
                SizedBox(
                  height: _headerHeight,
                  child: Row(
                    children: [
                      // Round label header
                      Container(
                        width: 50,
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0B0E1A),
                          border: Border(
                              bottom: BorderSide(
                                  color: colorScheme.primary
                                      .withValues(alpha: 0.15))),
                        ),
                        child: Center(
                            child: Text('RD',
                                style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.3)))),
                      ),
                      ...List.generate(widget.teamCount, (col) {
                        return StreamBuilder<DocumentSnapshot>(
                          stream: FirebaseFirestore.instance
                              .collection('leagues')
                              .doc(widget.leagueId)
                              .collection('teams')
                              .doc(widget.teamIds[col])
                              .snapshots(),
                          builder: (context, snap) {
                            final data =
                                snap.data?.data() as Map<String, dynamic>? ??
                                    {};
                            final abbrev =
                                data['abbreviation'] as String? ?? '';
                            final teamColor = data['primaryColor'] != null
                                ? Color(data['primaryColor'] as int)
                                : colorScheme.primary;
                            final isMe =
                                widget.teamIds[col] == widget.currentUserId;

                            return Container(
                              width: _cellWidth,
                              height: _headerHeight,
                              decoration: BoxDecoration(
                                color: isMe
                                    ? teamColor.withValues(alpha: 0.15)
                                    : teamColor.withValues(alpha: 0.06),
                                border: Border(
                                  bottom: BorderSide(
                                      color: teamColor.withValues(alpha: 0.3),
                                      width: isMe ? 2 : 1),
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  abbrev,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                    color: teamColor,
                                  ),
                                ),
                              ),
                            );
                          },
                        );
                      }),
                    ],
                  ),
                ),
                // Board grid
                Expanded(
                  child: ListView.builder(
                    controller: _vScroll,
                    physics: const BouncingScrollPhysics(),
                    itemCount: widget.totalRounds,
                    itemExtent: _cellHeight,
                    itemBuilder: (context, round) {
                      final isCurrentRound = round + 1 == widget.currentRound;

                      return Row(
                        children: [
                          // Round number label
                          Container(
                            width: 50,
                            height: _cellHeight,
                            decoration: BoxDecoration(
                              color: isCurrentRound
                                  ? colorScheme.primary.withValues(alpha: 0.08)
                                  : Colors.transparent,
                              border: Border(
                                right: BorderSide(
                                    color: colorScheme.primary
                                        .withValues(alpha: 0.08)),
                                bottom: BorderSide(
                                    color: colorScheme.primary
                                        .withValues(alpha: 0.04)),
                              ),
                            ),
                            child: Center(
                              child: Text(
                                '${round + 1}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: isCurrentRound
                                      ? FontWeight.w900
                                      : FontWeight.w600,
                                  color: isCurrentRound
                                      ? colorScheme.primary
                                      : colorScheme.onSurface
                                          .withValues(alpha: 0.3),
                                ),
                              ),
                            ),
                          ),
                          // Cells for each team
                          ...List.generate(widget.teamCount, (col) {
                            final pick = widget.picks
                                .where((p) =>
                                    p.round == round + 1 &&
                                    p.teamId == widget.teamIds[col])
                                .firstOrNull;

                            if (pick == null) {
                              return Container(
                                width: _cellWidth,
                                height: _cellHeight,
                                decoration: BoxDecoration(
                                  border: Border(
                                    right: BorderSide(
                                        color: colorScheme.primary
                                            .withValues(alpha: 0.04)),
                                    bottom: BorderSide(
                                        color: colorScheme.primary
                                            .withValues(alpha: 0.04)),
                                  ),
                                ),
                                child: Center(
                                    child: Text('-',
                                        style: TextStyle(
                                            color: colorScheme.onSurface
                                                .withValues(alpha: 0.1)))),
                              );
                            }

                            final isCurrent = !pick.isComplete &&
                                pick.overallPick ==
                                    (widget.picks
                                            .where((p) => !p.isComplete)
                                            .firstOrNull
                                            ?.overallPick ??
                                        -1);
                            final isMyPick =
                                pick.teamId == widget.currentUserId;
                            final posColor = pick.isComplete
                                ? _boardPosColor(pick.playerPosition ?? '')
                                : Colors.transparent;

                            return Container(
                              width: _cellWidth,
                              height: _cellHeight,
                              decoration: BoxDecoration(
                                color: isCurrent
                                    ? colorScheme.primary
                                        .withValues(alpha: 0.12)
                                    : isMyPick && pick.isComplete
                                        ? colorScheme.primary
                                            .withValues(alpha: 0.04)
                                        : Colors.transparent,
                                border: Border(
                                  right: BorderSide(
                                      color: colorScheme.primary
                                          .withValues(alpha: 0.04)),
                                  bottom: BorderSide(
                                      color: colorScheme.primary
                                          .withValues(alpha: 0.04)),
                                  top: isCurrent
                                      ? BorderSide(
                                          color: colorScheme.primary,
                                          width: 1.5)
                                      : BorderSide.none,
                                  left: isCurrent
                                      ? BorderSide(
                                          color: colorScheme.primary,
                                          width: 1.5)
                                      : BorderSide.none,
                                ),
                              ),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 4, vertical: 4),
                              child: pick.isComplete
                                  ? Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 4, vertical: 1),
                                          decoration: BoxDecoration(
                                            borderRadius:
                                                BorderRadius.circular(3),
                                            color:
                                                posColor.withValues(alpha: 0.2),
                                          ),
                                          child: Text(
                                            pick.playerPosition ?? '',
                                            style: TextStyle(
                                                fontSize: 8,
                                                fontWeight: FontWeight.w800,
                                                color: posColor),
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          pick.playerName ?? '',
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w600,
                                            color: colorScheme.onSurface,
                                          ),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          textAlign: TextAlign.center,
                                        ),
                                      ],
                                    )
                                  : Center(
                                      child: Text(
                                        '#${pick.overallPick}',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: isCurrent
                                              ? FontWeight.w800
                                              : FontWeight.w500,
                                          color: isCurrent
                                              ? colorScheme.primary
                                              : colorScheme.onSurface
                                                  .withValues(alpha: 0.15),
                                        ),
                                      ),
                                    ),
                            );
                          }),
                        ],
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
        // Center button
        if (_hasScrolled)
          Positioned(
            right: 12,
            bottom: 12,
            child: GestureDetector(
              onTap: _scrollToCurrentPick,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  color: colorScheme.primary.withValues(alpha: 0.9),
                  boxShadow: [
                    BoxShadow(
                        color: colorScheme.primary.withValues(alpha: 0.3),
                        blurRadius: 10)
                  ],
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.my_location, size: 14, color: Colors.black),
                    SizedBox(width: 4),
                    Text('Center',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.black)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Color _boardPosColor(String pos) {
    switch (pos) {
      case 'QB':
        return const Color(0xFFFF2D55);
      case 'RB':
        return const Color(0xFF43A047);
      case 'WR':
        return const Color(0xFF1E88E5);
      case 'TE':
        return const Color(0xFFFF8F00);
      case 'K':
        return const Color(0xFF5E35B1);
      case 'DEF':
        return const Color(0xFF00897B);
      default:
        return const Color(0xFF90A4AE);
    }
  }
}

enum _DraftOrderType { previous, current, upcoming }

class _DraftOrderItem {
  const _DraftOrderItem(
      this.teamId, this.type, this.pickNumber, this.round, this.pickInRound);
  final String teamId;
  final _DraftOrderType type;
  final int pickNumber;
  final int round;
  final int pickInRound;
}

class _PicksListItem {
  const _PicksListItem._({this.pick, this.round, this.isDivider = false});

  factory _PicksListItem.pick(DraftPick pick) => _PicksListItem._(pick: pick);
  factory _PicksListItem.divider(int round) =>
      _PicksListItem._(round: round, isDivider: true);

  final DraftPick? pick;
  final int? round;
  final bool isDivider;
}

class _RosterSlot {
  const _RosterSlot({required this.position, this.pick, this.isHeader = false});
  final String position;
  final DraftPick? pick;
  final bool isHeader;
}
