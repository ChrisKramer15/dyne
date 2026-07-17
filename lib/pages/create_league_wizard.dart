import 'package:flutter/material.dart';

import '../services/league_service.dart';
import '../services/seed_league_data.dart';
import '../theme/dyne_theme.dart';
import '../utils/env_config.dart';
import 'league_dashboard_page.dart';

/// Multi-step wizard for creating a new league.
class CreateLeagueWizard extends StatefulWidget {
  const CreateLeagueWizard({super.key});

  @override
  State<CreateLeagueWizard> createState() => _CreateLeagueWizardState();
}

class _CreateLeagueWizardState extends State<CreateLeagueWizard> {
  final _pageController = PageController();
  int _currentStep = 0;
  bool _isCreating = false;

  // Step 1: League Info
  final _nameController = TextEditingController();
  String _leagueType = 'Redraft';
  int _teamCount = 10;
  bool _salariesEnabled = false;
  bool _contractsEnabled = false;
  bool _contractsBeforeDisable = false;
  bool _practiceSquadEnabled = false;
  bool _practiceSquadBeforeDisable = false;
  int _practiceSquadSize = 10;

  // Step 2: Scoring
  String _scoringFormat = 'PPR';
  late Map<String, double> _scoringValues;
  late Map<String, bool> _scoringEnabled;

  static const List<String> _offensePlaymakersStats = [
    'Passing Yards',
    'Passing TDs',
    'Interceptions Thrown',
    'Rushing Yards',
    'Rushing TDs',
    'Receptions',
    'Receiving Yards',
    'Receiving TDs',
    'Fumbles Lost',
    '2-Point Conversions',
    'Passing 2-Point Conversions',
    '40+ Yard Pass Completions',
    '40+ Yard Rushing TDs',
    '40+ Yard Receiving TDs',
    '100+ Yard Rushing Game',
    '100+ Yard Receiving Game',
    '300+ Yard Passing Game',
  ];

  static const List<String> _offenseProtectionStats = [
    'Sacks Allowed',
    'Pancake Blocks',
  ];

  static const List<String> _defenseManToManStats = [
    'Tackles',
    'Assisted Tackles',
    'Sacks',
    'Forced Fumbles',
    'Fumble Recoveries',
    'Interceptions',
    'Passes Defended',
    'Defensive TDs',
    'Stuffs (TFL)',
    'QB Hits',
    'Safeties',
  ];

  static const List<String> _defenseZoneStats = [
    'Yards Allowed (0-99)',
    'Yards Allowed (100-199)',
    'Yards Allowed (200-299)',
    'Yards Allowed (300-349)',
    'Yards Allowed (350-399)',
    'Yards Allowed (400-449)',
    'Yards Allowed (450-499)',
    'Yards Allowed (500+)',
    'Points Allowed (0)',
    'Points Allowed (1-6)',
    'Points Allowed (7-13)',
    'Points Allowed (14-20)',
    'Points Allowed (21-27)',
    'Points Allowed (28-34)',
    'Points Allowed (35+)',
    'Turnover',
    'Return TD',
  ];

  static const List<String> _specialTeamsStats = [
    'FG Made (0-39)',
    'FG Made (40-49)',
    'FG Made (50-59)',
    'FG Made (60+)',
    'FG Missed',
    'Extra Points Made',
    'Extra Points Missed',
    'Punt Return TDs',
    'Kick Return TDs',
    'Punt Yards',
    'Punts Inside 20',
  ];

  static const Map<String, double> _pprDefaults = {
    'Passing Yards': 0.04,
    'Passing TDs': 4.0,
    'Interceptions Thrown': -2.0,
    'Rushing Yards': 0.1,
    'Rushing TDs': 6.0,
    'Receptions': 1.0,
    'Receiving Yards': 0.1,
    'Receiving TDs': 6.0,
    'Fumbles Lost': -2.0,
    '2-Point Conversions': 2.0,
    'Passing 2-Point Conversions': 2.0,
    '40+ Yard Pass Completions': 2.0,
    '40+ Yard Rushing TDs': 2.0,
    '40+ Yard Receiving TDs': 2.0,
    '100+ Yard Rushing Game': 3.0,
    '100+ Yard Receiving Game': 3.0,
    '300+ Yard Passing Game': 3.0,
    'Sacks Allowed': -1.0,
    'Pancake Blocks': 1.0,
    'Tackles': 1.0,
    'Assisted Tackles': 0.5,
    'Sacks': 2.0,
    'Forced Fumbles': 2.0,
    'Fumble Recoveries': 2.0,
    'Interceptions': 3.0,
    'Passes Defended': 1.0,
    'Defensive TDs': 6.0,
    'Stuffs (TFL)': 1.0,
    'QB Hits': 1.0,
    'Safeties': 2.0,
    'Yards Allowed (0-99)': 5.0,
    'Yards Allowed (100-199)': 3.0,
    'Yards Allowed (200-299)': 2.0,
    'Yards Allowed (300-349)': 0.0,
    'Yards Allowed (350-399)': -1.0,
    'Yards Allowed (400-449)': -3.0,
    'Yards Allowed (450-499)': -5.0,
    'Yards Allowed (500+)': -7.0,
    'Points Allowed (0)': 10.0,
    'Points Allowed (1-6)': 7.0,
    'Points Allowed (7-13)': 4.0,
    'Points Allowed (14-20)': 1.0,
    'Points Allowed (21-27)': 0.0,
    'Points Allowed (28-34)': -1.0,
    'Points Allowed (35+)': -4.0,
    'Turnover': 2.0,
    'Return TD': 6.0,
    'FG Made (0-39)': 3.0,
    'FG Made (40-49)': 4.0,
    'FG Made (50-59)': 5.0,
    'FG Made (60+)': 6.0,
    'FG Missed': -1.0,
    'Extra Points Made': 1.0,
    'Extra Points Missed': -1.0,
    'Punt Return TDs': 6.0,
    'Kick Return TDs': 6.0,
    'Punt Yards': 0.01,
    'Punts Inside 20': 1.0,
  };

  static const Map<String, double> _halfPprDefaults = {
    'Passing Yards': 0.04,
    'Passing TDs': 4.0,
    'Interceptions Thrown': -2.0,
    'Rushing Yards': 0.1,
    'Rushing TDs': 6.0,
    'Receptions': 0.5,
    'Receiving Yards': 0.1,
    'Receiving TDs': 6.0,
    'Fumbles Lost': -2.0,
    '2-Point Conversions': 2.0,
    'Passing 2-Point Conversions': 2.0,
    '40+ Yard Pass Completions': 2.0,
    '40+ Yard Rushing TDs': 2.0,
    '40+ Yard Receiving TDs': 2.0,
    '100+ Yard Rushing Game': 3.0,
    '100+ Yard Receiving Game': 3.0,
    '300+ Yard Passing Game': 3.0,
    'Sacks Allowed': -1.0,
    'Pancake Blocks': 1.0,
    'Tackles': 1.0,
    'Assisted Tackles': 0.5,
    'Sacks': 2.0,
    'Forced Fumbles': 2.0,
    'Fumble Recoveries': 2.0,
    'Interceptions': 3.0,
    'Passes Defended': 1.0,
    'Defensive TDs': 6.0,
    'Stuffs (TFL)': 1.0,
    'QB Hits': 1.0,
    'Safeties': 2.0,
    'Yards Allowed (0-99)': 5.0,
    'Yards Allowed (100-199)': 3.0,
    'Yards Allowed (200-299)': 2.0,
    'Yards Allowed (300-349)': 0.0,
    'Yards Allowed (350-399)': -1.0,
    'Yards Allowed (400-449)': -3.0,
    'Yards Allowed (450-499)': -5.0,
    'Yards Allowed (500+)': -7.0,
    'Points Allowed (0)': 10.0,
    'Points Allowed (1-6)': 7.0,
    'Points Allowed (7-13)': 4.0,
    'Points Allowed (14-20)': 1.0,
    'Points Allowed (21-27)': 0.0,
    'Points Allowed (28-34)': -1.0,
    'Points Allowed (35+)': -4.0,
    'Turnover': 2.0,
    'Return TD': 6.0,
    'FG Made (0-39)': 3.0,
    'FG Made (40-49)': 4.0,
    'FG Made (50-59)': 5.0,
    'FG Made (60+)': 6.0,
    'FG Missed': -1.0,
    'Extra Points Made': 1.0,
    'Extra Points Missed': -1.0,
    'Punt Return TDs': 6.0,
    'Kick Return TDs': 6.0,
    'Punt Yards': 0.01,
    'Punts Inside 20': 1.0,
  };

  static const Map<String, double> _standardDefaults = {
    'Passing Yards': 0.04,
    'Passing TDs': 4.0,
    'Interceptions Thrown': -2.0,
    'Rushing Yards': 0.1,
    'Rushing TDs': 6.0,
    'Receptions': 0.0,
    'Receiving Yards': 0.1,
    'Receiving TDs': 6.0,
    'Fumbles Lost': -2.0,
    '2-Point Conversions': 2.0,
    'Passing 2-Point Conversions': 2.0,
    '40+ Yard Pass Completions': 2.0,
    '40+ Yard Rushing TDs': 2.0,
    '40+ Yard Receiving TDs': 2.0,
    '100+ Yard Rushing Game': 3.0,
    '100+ Yard Receiving Game': 3.0,
    '300+ Yard Passing Game': 3.0,
    'Sacks Allowed': -1.0,
    'Pancake Blocks': 1.0,
    'Tackles': 1.0,
    'Assisted Tackles': 0.5,
    'Sacks': 2.0,
    'Forced Fumbles': 2.0,
    'Fumble Recoveries': 2.0,
    'Interceptions': 3.0,
    'Passes Defended': 1.0,
    'Defensive TDs': 6.0,
    'Stuffs (TFL)': 1.0,
    'QB Hits': 1.0,
    'Safeties': 2.0,
    'Yards Allowed (0-99)': 5.0,
    'Yards Allowed (100-199)': 3.0,
    'Yards Allowed (200-299)': 2.0,
    'Yards Allowed (300-349)': 0.0,
    'Yards Allowed (350-399)': -1.0,
    'Yards Allowed (400-449)': -3.0,
    'Yards Allowed (450-499)': -5.0,
    'Yards Allowed (500+)': -7.0,
    'Points Allowed (0)': 10.0,
    'Points Allowed (1-6)': 7.0,
    'Points Allowed (7-13)': 4.0,
    'Points Allowed (14-20)': 1.0,
    'Points Allowed (21-27)': 0.0,
    'Points Allowed (28-34)': -1.0,
    'Points Allowed (35+)': -4.0,
    'Turnover': 2.0,
    'Return TD': 6.0,
    'FG Made (0-39)': 3.0,
    'FG Made (40-49)': 4.0,
    'FG Made (50-59)': 5.0,
    'FG Made (60+)': 6.0,
    'FG Missed': -1.0,
    'Extra Points Made': 1.0,
    'Extra Points Missed': -1.0,
    'Punt Return TDs': 6.0,
    'Kick Return TDs': 6.0,
    'Punt Yards': 0.01,
    'Punts Inside 20': 1.0,
  };

  static const Map<String, double> _stepSizes = {
    'Passing Yards': 0.01,
    'Passing TDs': 1.0,
    'Interceptions Thrown': 1.0,
    'Rushing Yards': 0.01,
    'Rushing TDs': 1.0,
    'Receptions': 0.25,
    'Receiving Yards': 0.01,
    'Receiving TDs': 1.0,
    'Fumbles Lost': 1.0,
    '2-Point Conversions': 1.0,
    'Passing 2-Point Conversions': 1.0,
    '40+ Yard Pass Completions': 1.0,
    '40+ Yard Rushing TDs': 1.0,
    '40+ Yard Receiving TDs': 1.0,
    '100+ Yard Rushing Game': 1.0,
    '100+ Yard Receiving Game': 1.0,
    '300+ Yard Passing Game': 1.0,
    'Sacks Allowed': 0.5,
    'Pancake Blocks': 0.5,
    'Tackles': 0.5,
    'Assisted Tackles': 0.25,
    'Sacks': 0.5,
    'Forced Fumbles': 1.0,
    'Fumble Recoveries': 1.0,
    'Interceptions': 1.0,
    'Passes Defended': 0.5,
    'Defensive TDs': 1.0,
    'Stuffs (TFL)': 0.5,
    'QB Hits': 0.5,
    'Safeties': 1.0,
    'Yards Allowed (0-99)': 1.0,
    'Yards Allowed (100-199)': 1.0,
    'Yards Allowed (200-299)': 1.0,
    'Yards Allowed (300-349)': 1.0,
    'Yards Allowed (350-399)': 1.0,
    'Yards Allowed (400-449)': 1.0,
    'Yards Allowed (450-499)': 1.0,
    'Yards Allowed (500+)': 1.0,
    'Points Allowed (0)': 1.0,
    'Points Allowed (1-6)': 1.0,
    'Points Allowed (7-13)': 1.0,
    'Points Allowed (14-20)': 1.0,
    'Points Allowed (21-27)': 1.0,
    'Points Allowed (28-34)': 1.0,
    'Points Allowed (35+)': 1.0,
    'Turnover': 1.0,
    'Return TD': 1.0,
    'FG Made (0-39)': 1.0,
    'FG Made (40-49)': 1.0,
    'FG Made (50-59)': 1.0,
    'FG Made (60+)': 1.0,
    'FG Missed': 1.0,
    'Extra Points Made': 1.0,
    'Extra Points Missed': 1.0,
    'Punt Return TDs': 1.0,
    'Kick Return TDs': 1.0,
    'Punt Yards': 0.01,
    'Punts Inside 20': 0.5,
  };

  static const Map<String, double> _teamworkDefaults = {
    // Offensive Playmakers — reduced to bring QB/RB/WR down
    'Passing Yards': 0.02,
    'Passing TDs': 3.0,
    'Interceptions Thrown': -2.0,
    'Rushing Yards': 0.08,
    'Rushing TDs': 5.0,
    'Receptions': 0.5,
    'Receiving Yards': 0.08,
    'Receiving TDs': 5.0,
    'Fumbles Lost': -2.0,
    '2-Point Conversions': 2.0,
    'Passing 2-Point Conversions': 2.0,
    '40+ Yard Pass Completions': 1.0,
    '40+ Yard Rushing TDs': 1.0,
    '40+ Yard Receiving TDs': 1.0,
    '100+ Yard Rushing Game': 2.0,
    '100+ Yard Receiving Game': 2.0,
    '300+ Yard Passing Game': 2.0,
    // Offensive Protection — boosted to make OL relevant
    'Sacks Allowed': -3.0,
    'Pancake Blocks': 3.0,
    // Defensive Man-to-Man — boosted individual stats
    'Tackles': 1.5,
    'Assisted Tackles': 0.75,
    'Sacks': 4.0,
    'Forced Fumbles': 4.0,
    'Fumble Recoveries': 4.0,
    'Interceptions': 5.0,
    'Passes Defended': 2.0,
    'Defensive TDs': 6.0,
    'Stuffs (TFL)': 2.0,
    'QB Hits': 2.0,
    'Safeties': 4.0,
    // Defensive Zone — moderate team defense scoring
    'Yards Allowed (0-99)': 5.0,
    'Yards Allowed (100-199)': 3.0,
    'Yards Allowed (200-299)': 2.0,
    'Yards Allowed (300-349)': 0.0,
    'Yards Allowed (350-399)': -1.0,
    'Yards Allowed (400-449)': -3.0,
    'Yards Allowed (450-499)': -5.0,
    'Yards Allowed (500+)': -7.0,
    'Points Allowed (0)': 10.0,
    'Points Allowed (1-6)': 7.0,
    'Points Allowed (7-13)': 4.0,
    'Points Allowed (14-20)': 1.0,
    'Points Allowed (21-27)': 0.0,
    'Points Allowed (28-34)': -1.0,
    'Points Allowed (35+)': -4.0,
    'Turnover': 2.0,
    'Return TD': 6.0,
    // Special Teams — boosted to make K/P competitive
    'FG Made (0-39)': 4.0,
    'FG Made (40-49)': 5.0,
    'FG Made (50-59)': 6.0,
    'FG Made (60+)': 8.0,
    'FG Missed': -2.0,
    'Extra Points Made': 2.0,
    'Extra Points Missed': -2.0,
    'Punt Return TDs': 6.0,
    'Kick Return TDs': 6.0,
    'Punt Yards': 0.03,
    'Punts Inside 20': 3.0,
  };

  // Step 3: Roster
  String _rosterPreset = 'Classic';
  late Map<String, int> _rosterSlots;
  bool _schemesEnabled = false;

  static const Map<String, int> _classicRoster = {
    'Quarterback': 1,
    'Running Back': 2,
    'Wide Receiver': 2,
    'Tight End': 1,
    'Flex': 1,
    'Kicker': 1,
    'Defense': 1,
    'Bench': 6,
  };

  static const Map<String, int> _idpRoster = {
    'Quarterback': 1,
    'Running Back': 2,
    'Wide Receiver': 2,
    'Tight End': 1,
    'Flex': 1,
    'Kicker': 1,
    'Defensive Tackle': 1,
    'Defensive End': 1,
    'Linebacker': 2,
    'Defensive Back': 2,
    'IDP Flex': 1,
    'Bench': 6,
  };

  static const Map<String, int> _advancedRoster = {
    'Quarterback': 1,
    'Running Back': 1,
    'Wide Receiver': 3,
    'Tight End': 1,
    'Kicker': 1,
    'Punter': 1,
    'Left Tackle': 1,
    'Left Guard': 1,
    'Center': 1,
    'Right Guard': 1,
    'Right Tackle': 1,
    'Defensive End': 2,
    'Defensive Tackle': 2,
    'Outside Linebacker': 2,
    'Middle Linebacker': 1,
    'Cornerback': 2,
    'Strong Safety': 1,
    'Free Safety': 1,
    'Bench': 29,
  };

  // Step 4: Draft Settings
  String _draftType = 'Snake';
  String _roundMode = 'Fill Roster';
  int _roundCount = 15;

  // Step 5: Season Settings
  int _playoffTeams = 4;
  int _regularSeasonWeeks = 14;
  String _tradeDeadline = 'Week 10';

  // Step 6: Final Touches
  String _waiverFormat = 'Rolling';
  final _faabController = TextEditingController(text: '100');
  bool _practiceSquadStealing = false;
  int _minimumRosterSize = 10;
  bool _scoutCollegePlayers = false;
  bool _contractNegotiations = false;

  static const _totalSteps = 6;

  @override
  void initState() {
    super.initState();
    _scoringValues = Map.of(_pprDefaults);
    _scoringEnabled = {for (final key in _pprDefaults.keys) key: true};
    _rosterSlots = Map.of(_classicRoster);
  }

  @override
  void dispose() {
    _pageController.dispose();
    _nameController.dispose();
    _faabController.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (_currentStep == 0 && _nameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a league name.')),
      );
      return;
    }

    if (_currentStep < _totalSteps - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
      setState(() => _currentStep++);
    } else {
      _createLeague();
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
      setState(() => _currentStep--);
    } else {
      Navigator.pop(context);
    }
  }

  Future<void> _createLeague() async {
    setState(() => _isCreating = true);
    try {
      final league = await LeagueService().createLeague(
        name: _nameController.text.trim(),
        maxMembers: _teamCount,
        leagueType: _leagueType,
        salariesEnabled: _salariesEnabled,
        contractsEnabled: _contractsEnabled,
        schemesEnabled: _schemesEnabled,
        practiceSquadEnabled: _practiceSquadEnabled,
        practiceSquadSize: _practiceSquadSize,
        scoringFormat: _scoringFormat,
        scoringValues: Map.of(_scoringValues),
        scoringEnabled: Map.of(_scoringEnabled),
        rosterPreset: _rosterPreset,
        rosterSlots: Map.of(_rosterSlots),
        draftType: _draftType,
        roundMode: _roundMode,
        roundCount: _roundCount,
        regularSeasonWeeks: _regularSeasonWeeks,
        playoffTeams: _playoffTeams,
        tradeDeadline: _tradeDeadline,
        waiverFormat: _waiverFormat,
        faabBudget: int.tryParse(_faabController.text.trim()) ?? 100,
        practiceSquadStealing: _practiceSquadStealing,
        minimumRosterSize: _minimumRosterSize,
        scoutCollegePlayers: _scoutCollegePlayers,
        contractNegotiations: _contractNegotiations,
      );

      // Seed bot teams only in dev builds; production leagues start with just the commissioner
      if (EnvConfig.isDev) {
        await SeedLeagueData.seed(league.id, teamCount: _teamCount);
      }

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => LeagueDashboardPage(leagueId: league.id),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create league: $e')),
        );
        setState(() => _isCreating = false);
      }
    }
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
              _buildHeader(colorScheme),
              _buildProgressBar(colorScheme),
              Expanded(
                child: PageView(
                  controller: _pageController,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _buildLeagueInfoStep(colorScheme),
                    _buildSizeFormatStep(colorScheme),
                    _buildRosterStep(colorScheme),
                    _buildDraftSettingsStep(colorScheme),
                    _buildSeasonSettingsStep(colorScheme),
                    _buildFinalTouchesStep(colorScheme),
                  ],
                ),
              ),
              _buildBottomBar(colorScheme),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(ColorScheme colorScheme) {
    final titles = [
      'League Info',
      'Scoring',
      'Roster',
      'Draft Settings',
      'Season Settings',
      'Final Touches',
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          IconButton(
            onPressed: _previousStep,
            icon: Icon(
              _currentStep == 0 ? Icons.close : Icons.arrow_back,
              color: colorScheme.onSurface,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Create League',
                  style: TextStyle(
                    fontSize: 12,
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                  ),
                ),
                Text(
                  titles[_currentStep],
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '${_currentStep + 1}/$_totalSteps',
            style: TextStyle(
              fontSize: 14,
              color: colorScheme.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressBar(ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: List.generate(_totalSteps, (index) {
          return Expanded(
            child: Container(
              height: 3,
              margin: const EdgeInsets.only(right: 4),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                color: index <= _currentStep
                    ? colorScheme.primary
                    : colorScheme.primary.withValues(alpha: 0.15),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildBottomBar(ColorScheme colorScheme) {
    final isLast = _currentStep == _totalSteps - 1;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: _isCreating ? null : _nextStep,
          child: _isCreating
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(
                  isLast ? 'Create League' : 'Continue',
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600),
                ),
        ),
      ),
    );
  }

  // ─── Step 1: League Info ─────────────────────────────────────────

  Widget _buildLeagueInfoStep(ColorScheme colorScheme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          _buildLabel('League Name', colorScheme),
          const SizedBox(height: 8),
          TextField(
            controller: _nameController,
            maxLength: 30,
            decoration: _inputDecoration(
              hint: 'e.g. Sunday Night Ballers',
              icon: Icons.sports_football,
              colorScheme: colorScheme,
            ),
            style: TextStyle(color: colorScheme.onSurface),
          ),
          const SizedBox(height: 24),
          _buildLabel('League Type', colorScheme),
          const SizedBox(height: 12),
          _buildOptionChips(
            options: ['Redraft', 'Keeper', 'Dynasty', 'Best Ball', 'Guillotine'],
            selected: _leagueType,
            onSelected: (v) => setState(() {
              _leagueType = v;
              if (v == 'Redraft' || v == 'Guillotine' || v == 'Best Ball') {
                _contractsBeforeDisable = _contractsEnabled;
                _contractsEnabled = false;
                _practiceSquadBeforeDisable = _practiceSquadEnabled;
                _practiceSquadEnabled = false;
              } else {
                _contractsEnabled = _contractsBeforeDisable;
                _practiceSquadEnabled = _practiceSquadBeforeDisable;
              }
            }),
            colorScheme: colorScheme,
          ),
          const SizedBox(height: 24),
          _buildLabel('Number of Teams', colorScheme),
          const SizedBox(height: 12),
          _buildTeamCountStepper(colorScheme),
          const SizedBox(height: 24),
          _buildSalariesToggle(colorScheme),
          if (_leagueType == 'Keeper' || _leagueType == 'Dynasty') ...[
            const SizedBox(height: 12),
            _buildContractsToggle(colorScheme),
            const SizedBox(height: 12),
            _buildPracticeSquadToggle(colorScheme),
          ],
          const SizedBox(height: 12),
          _buildSchemesToggle(colorScheme),
        ],
      ),
    );
  }

  // ─── Step 2: Scoring ──────────────────────────────────────────

  Widget _buildSizeFormatStep(ColorScheme colorScheme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          _buildLabel('Scoring Preset', colorScheme),
          const SizedBox(height: 12),
          _buildOptionChips(
            options: ['Standard', 'Half PPR', 'PPR', 'TE Premium', 'Teamwork'],
            selected: _scoringFormat,
            onSelected: (v) => setState(() {
              _scoringFormat = v;
              _applyScoringPreset(v);
            }),
            colorScheme: colorScheme,
          ),
          const SizedBox(height: 16),
          _buildInfoTile(
            _scoringFormatDescription(_scoringFormat),
            colorScheme,
          ),
          const SizedBox(height: 24),
          _buildScoringSection('Offensive Playmakers', _offensePlaymakersStats, colorScheme),
          const SizedBox(height: 16),
          _buildScoringSection('Offensive Protection', _offenseProtectionStats, colorScheme),
          const SizedBox(height: 16),
          _buildScoringSection('Defensive Man-to-Man', _defenseManToManStats, colorScheme),
          const SizedBox(height: 16),
          _buildScoringSection('Defensive Zone', _defenseZoneStats, colorScheme),
          const SizedBox(height: 16),
          _buildScoringSection('Special Teams', _specialTeamsStats, colorScheme),
        ],
      ),
    );
  }

  Widget _buildScoringSection(String title, List<String> stats, ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.toUpperCase(),
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: colorScheme.onSurface.withValues(alpha: 0.5),
          ),
        ),
        const SizedBox(height: 8),
        ...stats.map((stat) => _buildScoringRow(stat, colorScheme)),
      ],
    );
  }

  void _applyScoringPreset(String preset) {
    switch (preset) {
      case 'Standard':
        _scoringValues = Map.of(_standardDefaults);
        _scoringEnabled = {for (final key in _standardDefaults.keys) key: true};
        break;
      case 'Half PPR':
        _scoringValues = Map.of(_halfPprDefaults);
        _scoringEnabled = {
          for (final key in _halfPprDefaults.keys) key: true
        };
        break;
      case 'PPR':
        _scoringValues = Map.of(_pprDefaults);
        _scoringEnabled = {for (final key in _pprDefaults.keys) key: true};
        break;
      case 'Teamwork':
        _scoringValues = Map.of(_teamworkDefaults);
        _scoringEnabled = {for (final key in _teamworkDefaults.keys) key: true};
        break;
      case 'TE Premium':
        _scoringValues = Map.of(_pprDefaults);
        _scoringValues['Reception (TE)'] = 1.5;
        _scoringEnabled = {for (final key in _scoringValues.keys) key: true};
        break;
    }
  }

  String _scoringFormatDescription(String format) {
    switch (format) {
      case 'Standard':
        return 'No points per reception. Rewards touchdowns and yardage.';
      case 'Half PPR':
        return '0.5 points per reception. Balanced between rushers and receivers.';
      case 'PPR':
        return '1 point per reception. Heavily rewards pass-catching players.';
      case 'TE Premium':
        return '1.5 points per TE reception, 1 for others. Elevates tight ends to elite value.';
      case 'Teamwork':
        return 'Balanced scoring across all positions. Every roster spot matters equally.';
      default:
        return '';
    }
  }

  Widget _buildScoringRow(String category, ColorScheme colorScheme) {
    final enabled = _scoringEnabled[category] ?? true;
    final value = _scoringValues[category] ?? 0.0;
    final step = _stepSizes[category] ?? 0.01;

    return Opacity(
      opacity: enabled ? 1.0 : 0.4,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: const Color(0xFF141829),
          border: Border.all(
            color: colorScheme.primary.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          children: [
            GestureDetector(
              onTap: () => setState(() {
                _scoringEnabled[category] = !enabled;
              }),
              child: Icon(
                enabled
                    ? Icons.check_circle
                    : Icons.remove_circle_outline,
                color: enabled
                    ? colorScheme.primary
                    : colorScheme.onSurface.withValues(alpha: 0.3),
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                category,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: colorScheme.onSurface.withValues(alpha: 0.8),
                ),
              ),
            ),
            GestureDetector(
              onTap: enabled
                  ? () => setState(() {
                        _scoringValues[category] = double.parse(
                            (value - step).toStringAsFixed(2));
                      })
                  : null,
              child: Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colorScheme.primary.withValues(alpha: 0.1),
                ),
                child: Icon(Icons.remove, size: 16,
                    color: colorScheme.primary),
              ),
            ),
            Container(
              width: 56,
              alignment: Alignment.center,
              child: Text(
                value.toStringAsFixed(value.truncateToDouble() == value ? 0 : 2),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
            ),
            GestureDetector(
              onTap: enabled
                  ? () => setState(() {
                        _scoringValues[category] = double.parse(
                            (value + step).toStringAsFixed(2));
                      })
                  : null,
              child: Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colorScheme.primary.withValues(alpha: 0.1),
                ),
                child: Icon(Icons.add, size: 16,
                    color: colorScheme.primary),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Step 3: Roster ───────────────────────────────────────────────

  // Neon color assignments per position category
  static const Color _colorQB = Color(0xFFFF2D55);       // neon red
  static const Color _colorRB = Color(0xFF43A047);       // kelly green
  static const Color _colorWR = Color(0xFF1E88E5);       // royal blue
  static const Color _colorTE = Color(0xFFFF8F00);       // amber gold
  static const Color _colorKP = Color(0xFF5E35B1);       // medium purple
  static const Color _colorLT = Color(0xFFAB47BC);       // orchid purple
  static const Color _colorLG = Color(0xFFAB47BC);       // orchid purple
  static const Color _colorC = Color(0xFF26C6DA);        // turquoise
  static const Color _colorRG = Color(0xFFF48FB1);       // soft pink
  static const Color _colorRT = Color(0xFFF48FB1);       // soft pink
  static const Color _colorDT = Color(0xFFFFD600);       // sunflower yellow
  static const Color _colorDE = Color(0xFFFFD600);       // sunflower yellow
  static const Color _colorLB = Color(0xFF5C6BC0);       // indigo
  static const Color _colorCB = Color(0xFFC62200);       // dark vermillion
  static const Color _colorS = Color(0xFF00897B);        // deep teal

  Color _positionColor(String position) {
    switch (position) {
      case 'Quarterback':
        return _colorQB;
      case 'Running Back':
        return _colorRB;
      case 'Wide Receiver':
        return _colorWR;
      case 'Tight End':
        return _colorTE;
      case 'Kicker':
      case 'Punter':
        return _colorKP;
      case 'Flex':
      case 'Left Tackle':
        return _colorLT;
      case 'Right Tackle':
        return _colorRT;
      case 'Left Guard':
        return _colorLG;
      case 'Right Guard':
        return _colorRG;
      case 'Center':
        return _colorC;
      case 'Defensive Tackle':
        return _colorDT;
      case 'Defensive End':
        return _colorDE;
      case 'Outside Linebacker':
      case 'Middle Linebacker':
      case 'Linebacker':
        return _colorLB;
      case 'Defensive Back':
      case 'Cornerback':
        return _colorCB;
      case 'Free Safety':
      case 'Strong Safety':
      case 'IDP Flex':
      case 'Defense':
        return _colorS;
      default:
        return const Color(0xFF90A4AE);
    }
  }

  static const _offensePositions = {
    'Quarterback', 'Running Back', 'Wide Receiver', 'Tight End',
    'Flex', 'Left Tackle', 'Left Guard', 'Center', 'Right Guard', 'Right Tackle',
  };

  static const _defensePositions = {
    'Defensive End', 'Defensive Tackle', 'Outside Linebacker',
    'Middle Linebacker', 'Linebacker', 'Cornerback', 'Strong Safety',
    'Free Safety', 'Defensive Back', 'IDP Flex', 'Defense',
  };

  static const _specialTeamsPositions = {'Kicker', 'Punter'};

  Widget _buildRosterStep(ColorScheme colorScheme) {
    final offense = <String>[];
    final defense = <String>[];
    final specialTeams = <String>[];
    final other = <String>[];

    for (final pos in _rosterSlots.keys) {
      if (_offensePositions.contains(pos)) {
        offense.add(pos);
      } else if (_defensePositions.contains(pos)) {
        defense.add(pos);
      } else if (_specialTeamsPositions.contains(pos)) {
        specialTeams.add(pos);
      } else {
        other.add(pos);
      }
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          _buildLabel('Roster Style', colorScheme),
          const SizedBox(height: 12),
          _buildOptionChips(
            options: ['Classic', 'IDP', 'Advanced'],
            selected: _rosterPreset,
            onSelected: (v) => setState(() {
              _rosterPreset = v;
              _applyRosterPreset(v);
            }),
            colorScheme: colorScheme,
          ),
          const SizedBox(height: 24),
          if (offense.isNotEmpty) ...[
            _buildGroupHeader('Offense', colorScheme),
            const SizedBox(height: 8),
            ...offense.map((p) => _buildRosterRow(p, colorScheme)),
            const SizedBox(height: 16),
          ],
          if (defense.isNotEmpty) ...[
            _buildGroupHeader('Defense', colorScheme),
            const SizedBox(height: 8),
            ...defense.map((p) => _buildRosterRow(p, colorScheme)),
            const SizedBox(height: 16),
          ],
          if (specialTeams.isNotEmpty) ...[
            _buildGroupHeader('Special Teams', colorScheme),
            const SizedBox(height: 8),
            ...specialTeams.map((p) => _buildRosterRow(p, colorScheme)),
            const SizedBox(height: 16),
          ],
          if (other.isNotEmpty) ...[
            ...other.map((p) => _buildRosterRow(p, colorScheme)),
            const SizedBox(height: 16),
          ],
          _buildInfoTile(
            'Total roster size: ${_rosterSlots.values.reduce((a, b) => a + b)}',
            colorScheme,
          ),
          if (_practiceSquadEnabled) ...[
            const SizedBox(height: 24),
            _buildLabel('Practice Squad Size', colorScheme),
            const SizedBox(height: 12),
            _buildOptionChips(
              options: ['5', '10', '15'],
              selected: '$_practiceSquadSize',
              onSelected: (v) => setState(() => _practiceSquadSize = int.parse(v)),
              colorScheme: colorScheme,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSchemesToggle(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141829),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.schema_outlined, color: colorScheme.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Schemes',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface.withValues(alpha: 0.8),
                  ),
                ),
                Text(
                  'Allow teams to select offensive & defensive schemes',
                  style: TextStyle(
                    fontSize: 11,
                    color: colorScheme.onSurface.withValues(alpha: 0.4),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: _schemesEnabled,
            activeThumbColor: colorScheme.primary,
            onChanged: (v) => setState(() => _schemesEnabled = v),
          ),
        ],
      ),
    );
  }

  Widget _buildPracticeSquadToggle(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141829),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.groups_outlined, color: colorScheme.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Practice Squad',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface.withValues(alpha: 0.8),
                  ),
                ),
                Text(
                  'Teams can stash developing players on a practice squad',
                  style: TextStyle(
                    fontSize: 11,
                    color: colorScheme.onSurface.withValues(alpha: 0.4),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: _practiceSquadEnabled,
            activeThumbColor: colorScheme.primary,
            onChanged: (v) => setState(() => _practiceSquadEnabled = v),
          ),
        ],
      ),
    );
  }

  Widget _buildGroupHeader(String title, ColorScheme colorScheme) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final leftMargin = constraints.maxWidth * 0.12;
        return Padding(
          padding: EdgeInsets.only(left: leftMargin),
          child: Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.5,
              fontStyle: FontStyle.italic,
              color: colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
        );
      },
    );
  }

  void _applyRosterPreset(String preset) {
    switch (preset) {
      case 'Classic':
        _rosterSlots = Map.of(_classicRoster);
        break;
      case 'IDP':
        _rosterSlots = Map.of(_idpRoster);
        break;
      case 'Advanced':
        _rosterSlots = Map.of(_advancedRoster);
        break;
    }
  }

  Widget _buildRosterRow(String position, ColorScheme colorScheme) {
    final count = _rosterSlots[position] ?? 0;
    final neonColor = _positionColor(position);

    final boxDecoration = BoxDecoration(
      borderRadius: BorderRadius.circular(10),
      color: neonColor.withValues(alpha: 0.35),
      border: Border.all(
        color: neonColor.withValues(alpha: 0.8),
        width: 1.5,
      ),
      boxShadow: [
        BoxShadow(
          color: neonColor.withValues(alpha: 0.3),
          blurRadius: 8,
          spreadRadius: 0,
        ),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth;
        final leftMargin = availableWidth * 0.12;
        final nameBoxWidth = availableWidth * 0.45;
        final gap = availableWidth * 0.06;

        return Padding(
          padding: EdgeInsets.only(bottom: 10, left: leftMargin),
          child: Row(
            children: [
              Container(
                width: nameBoxWidth,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                decoration: boxDecoration,
                alignment: Alignment.center,
                child: Text(
                  position,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface,
                  ),
                ),
              ),
              SizedBox(width: gap),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
                decoration: boxDecoration,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    GestureDetector(
                      onTap: count > 0
                          ? () => setState(() => _rosterSlots[position] = count - 1)
                          : null,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: neonColor.withValues(alpha: 0.25),
                        ),
                        child: Icon(Icons.remove, size: 14,
                            color: count > 0
                                ? colorScheme.onSurface
                                : colorScheme.onSurface.withValues(alpha: 0.3)),
                      ),
                    ),
                    Container(
                      width: 32,
                      alignment: Alignment.center,
                      child: Text(
                        '$count',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: colorScheme.onSurface,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() => _rosterSlots[position] = count + 1),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: neonColor.withValues(alpha: 0.25),
                        ),
                        child: Icon(Icons.add, size: 14, color: colorScheme.onSurface),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── Step 4: Draft Settings ──────────────────────────────────────

  Widget _buildDraftSettingsStep(ColorScheme colorScheme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          _buildLabel('Draft Type', colorScheme),
          const SizedBox(height: 12),
          _buildOptionChips(
            options: ['Snake', 'Auction', 'Linear'],
            selected: _draftType,
            onSelected: (v) => setState(() => _draftType = v),
            colorScheme: colorScheme,
          ),
          const SizedBox(height: 16),
          _buildInfoTile(
            _draftTypeDescription(_draftType),
            colorScheme,
          ),
          const SizedBox(height: 24),
          _buildLabel('Rounds', colorScheme),
          const SizedBox(height: 12),
          _buildOptionChips(
            options: ['Fill Roster', 'Custom'],
            selected: _roundMode,
            onSelected: (v) => setState(() => _roundMode = v),
            colorScheme: colorScheme,
          ),
          if (_roundMode == 'Fill Roster') ...[
            const SizedBox(height: 12),
            _buildInfoTile(
              'Draft rounds will match total roster size ($_rosterSlotTotal rounds).',
              colorScheme,
            ),
          ] else ...[
            const SizedBox(height: 12),
            _buildRoundCountStepper(colorScheme),
          ],
        ],
      ),
    );
  }

  int get _rosterSlotTotal => _rosterSlots.values.reduce((a, b) => a + b);

  List<String> get _playoffTeamOptions {
    final max = _teamCount < 14 ? _teamCount : 14;
    final options = <String>[];
    for (int i = 2; i <= max; i += 2) {
      options.add('$i');
    }
    return options;
  }

  int get _activeRosterSlots {
    final bench = _rosterSlots['Bench'] ?? 0;
    return _rosterSlotTotal - bench;
  }

  Widget _buildRoundCountStepper(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141829),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildStepperButton(
            icon: Icons.remove,
            onTap: _roundCount > 1
                ? () => setState(() => _roundCount--)
                : null,
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 24),
          Column(
            children: [
              Text(
                '$_roundCount',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
              Text(
                'rounds',
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
          const SizedBox(width: 24),
          _buildStepperButton(
            icon: Icons.add,
            onTap: _roundCount < 100
                ? () => setState(() => _roundCount++)
                : null,
            colorScheme: colorScheme,
          ),
        ],
      ),
    );
  }

  String _draftTypeDescription(String type) {
    switch (type) {
      case 'Snake':
        return 'Pick order reverses each round. Most common format.';
      case 'Auction':
        return 'Each manager gets a budget to bid on players.';
      case 'Linear':
        return 'Same pick order every round. First pick always picks first.';
      default:
        return '';
    }
  }

  // ─── Step 4: Season Settings ─────────────────────────────────────

  Widget _buildSeasonSettingsStep(ColorScheme colorScheme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          _buildLabel('Regular Season Weeks', colorScheme),
          const SizedBox(height: 12),
          _buildOptionChips(
            options: ['13', '14', '15'],
            selected: '$_regularSeasonWeeks',
            onSelected: (v) =>
                setState(() => _regularSeasonWeeks = int.parse(v)),
            colorScheme: colorScheme,
          ),
          const SizedBox(height: 24),
          _buildLabel('Playoff Teams', colorScheme),
          const SizedBox(height: 12),
          _buildOptionChips(
            options: _playoffTeamOptions,
            selected: '$_playoffTeams',
            onSelected: (v) => setState(() => _playoffTeams = int.parse(v)),
            colorScheme: colorScheme,
          ),
          const SizedBox(height: 24),
          _buildLabel('Trade Deadline', colorScheme),
          const SizedBox(height: 12),
          _buildOptionChips(
            options: ['Week 8', 'Week 10', 'Week 12', 'None'],
            selected: _tradeDeadline,
            onSelected: (v) => setState(() => _tradeDeadline = v),
            colorScheme: colorScheme,
          ),
        ],
      ),
    );
  }

  // ─── Step 6: Final Touches ───────────────────────────────────────

  Widget _buildFinalTouchesStep(ColorScheme colorScheme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          _buildLabel('Waiver Wire Format', colorScheme),
          const SizedBox(height: 12),
          _buildOptionChips(
            options: ['Rolling', 'FAAB', 'Reverse Standings'],
            selected: _waiverFormat,
            onSelected: (v) => setState(() => _waiverFormat = v),
            colorScheme: colorScheme,
          ),
          const SizedBox(height: 12),
          _buildInfoTile(
            _waiverFormatDescription(_waiverFormat),
            colorScheme,
          ),
          if (_waiverFormat == 'FAAB') ...[
            const SizedBox(height: 16),
            _buildLabel('FAAB Budget (\$)', colorScheme),
            const SizedBox(height: 12),
            TextField(
              controller: _faabController,
              keyboardType: TextInputType.number,
              decoration: _inputDecoration(
                hint: 'Enter budget amount',
                icon: Icons.attach_money,
                colorScheme: colorScheme,
              ),
              style: TextStyle(color: colorScheme.onSurface),
            ),
          ],
          const SizedBox(height: 24),
          _buildLabel('Minimum Roster Size', colorScheme),
          const SizedBox(height: 12),
          _buildMinRosterStepper(colorScheme),
          const SizedBox(height: 24),
          _buildFinalTouchesToggle(
            icon: Icons.swap_horiz,
            title: 'Practice Squad Stealing',
            subtitle: 'Teams can poach players from other practice squads',
            value: _practiceSquadStealing,
            onChanged: (v) => setState(() => _practiceSquadStealing = v),
            colorScheme: colorScheme,
          ),
          const SizedBox(height: 12),
          _buildFinalTouchesToggle(
            icon: Icons.school_outlined,
            title: 'Scout College Players',
            subtitle: 'Draft and stash college prospects before they enter the NFL',
            value: _scoutCollegePlayers,
            onChanged: (v) => setState(() => _scoutCollegePlayers = v),
            colorScheme: colorScheme,
          ),
          const SizedBox(height: 12),
          _buildFinalTouchesToggle(
            icon: Icons.handshake_outlined,
            title: 'Contract Negotiations',
            subtitle: 'Managers can negotiate extensions and restructure deals. Players will also negotiate on their behalf via AI.',
            value: _contractNegotiations,
            onChanged: (v) => setState(() => _contractNegotiations = v),
            colorScheme: colorScheme,
          ),
        ],
      ),
    );
  }

  Widget _buildMinRosterStepper(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141829),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildStepperButton(
            icon: Icons.remove,
            onTap: _minimumRosterSize > _activeRosterSlots
                ? () => setState(() => _minimumRosterSize--)
                : null,
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 24),
          Column(
            children: [
              Text(
                '$_minimumRosterSize',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
              Text(
                'players',
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
          const SizedBox(width: 24),
          _buildStepperButton(
            icon: Icons.add,
            onTap: _minimumRosterSize < _rosterSlotTotal
                ? () => setState(() => _minimumRosterSize++)
                : null,
            colorScheme: colorScheme,
          ),
        ],
      ),
    );
  }

  String _waiverFormatDescription(String format) {
    switch (format) {
      case 'Rolling':
        return 'Waiver priority rolls to the back after a successful claim.';
      case 'FAAB':
        return 'Free Agent Acquisition Budget. Blind bid on players with a set budget.';
      case 'Reverse Standings':
        return 'Worst record gets first waiver priority each week.';
      default:
        return '';
    }
  }

  Widget _buildFinalTouchesToggle({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
    required ColorScheme colorScheme,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141829),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(icon, color: colorScheme.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface.withValues(alpha: 0.8),
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11,
                    color: colorScheme.onSurface.withValues(alpha: 0.4),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            activeThumbColor: colorScheme.primary,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  // ─── Salaries Toggle ───────────────────────────────────────────

  Widget _buildSalariesToggle(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141829),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.attach_money, color: colorScheme.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Salaries',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: colorScheme.onSurface.withValues(alpha: 0.8),
              ),
            ),
          ),
          Switch(
            value: _salariesEnabled,
            activeThumbColor: colorScheme.primary,
            onChanged: (v) => setState(() => _salariesEnabled = v),
          ),
        ],
      ),
    );
  }

  // ─── Contracts Toggle ─────────────────────────────────────────

  Widget _buildContractsToggle(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141829),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.description_outlined,
              color: colorScheme.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Contracts',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: colorScheme.onSurface.withValues(alpha: 0.8),
              ),
            ),
          ),
          Switch(
            value: _contractsEnabled,
            activeThumbColor: colorScheme.primary,
            onChanged: (v) => setState(() => _contractsEnabled = v),
          ),
        ],
      ),
    );
  }

  // ─── Team Count Stepper ────────────────────────────────────────

  Widget _buildTeamCountStepper(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFF141829),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildStepperButton(
            icon: Icons.remove,
            onTap: _teamCount > 2
                ? () => setState(() => _teamCount -= 2)
                : null,
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 24),
          Column(
            children: [
              Icon(Icons.group, color: colorScheme.primary, size: 20),
              const SizedBox(height: 4),
              Text(
                '$_teamCount',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
              Text(
                'teams',
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
          const SizedBox(width: 24),
          _buildStepperButton(
            icon: Icons.add,
            onTap: _teamCount < 32
                ? () => setState(() => _teamCount += 2)
                : null,
            colorScheme: colorScheme,
          ),
        ],
      ),
    );
  }

  Widget _buildStepperButton({
    required IconData icon,
    required VoidCallback? onTap,
    required ColorScheme colorScheme,
  }) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: enabled
              ? colorScheme.primary.withValues(alpha: 0.15)
              : colorScheme.primary.withValues(alpha: 0.05),
          border: Border.all(
            color: enabled
                ? colorScheme.primary
                : colorScheme.primary.withValues(alpha: 0.15),
          ),
        ),
        child: Icon(
          icon,
          color: enabled
              ? colorScheme.primary
              : colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
    );
  }

  // ─── Shared Widgets ──────────────────────────────────────────────

  Widget _buildLabel(String text, ColorScheme colorScheme) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: colorScheme.onSurface.withValues(alpha: 0.8),
      ),
    );
  }

  Widget _buildOptionChips({
    required List<String> options,
    required String selected,
    required ValueChanged<String> onSelected,
    required ColorScheme colorScheme,
  }) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((option) {
        final isSelected = option == selected;
        return GestureDetector(
          onTap: () => onSelected(option),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: isSelected
                  ? colorScheme.primary.withValues(alpha: 0.15)
                  : const Color(0xFF141829),
              border: Border.all(
                color: isSelected
                    ? colorScheme.primary
                    : colorScheme.primary.withValues(alpha: 0.15),
              ),
            ),
            child: Text(
              option,
              style: TextStyle(
                fontSize: 14,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                color: isSelected
                    ? colorScheme.primary
                    : colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildInfoTile(String text, ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: colorScheme.primary.withValues(alpha: 0.05),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.1),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.info_outline,
            size: 16,
            color: colorScheme.primary.withValues(alpha: 0.7),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12,
                color: colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String hint,
    required IconData icon,
    required ColorScheme colorScheme,
  }) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(
        color: colorScheme.onSurface.withValues(alpha: 0.3),
      ),
      filled: true,
      fillColor: const Color(0xFF141829),
      prefixIcon: Icon(icon, color: colorScheme.primary),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
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
    );
  }
}
