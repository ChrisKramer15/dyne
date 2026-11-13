// Sample data until leagues are wired to a backend.

export type MatchupStatus = 'live' | 'upcoming' | 'final'

export type LeagueType = 'Bestball' | 'Dynasty' | 'Guillotine' | 'Keeper' | 'Redraft'

/** Card colour per league type; matches the accents on the home page formats. */
export const LEAGUE_TYPE_ACCENT: Record<LeagueType, 'blue' | 'purple' | 'magenta' | 'green' | 'orange'> = {
  Bestball: 'orange',
  Dynasty: 'green',
  Guillotine: 'magenta',
  Keeper: 'purple',
  Redraft: 'blue',
}

export interface League {
  id: string
  name: string
  sport: string
  emoji: string
  leagueType: LeagueType
  record: string
  rank: number
  teams: number
  matchup: {
    opponent: string
    status: MatchupStatus
    /** Scores are null until the matchup starts. */
    myScore: number | null
    theirScore: number | null
    /** e.g. "Week 12" or "Starts Sun 1:00 PM" */
    note: string
  }
}

/** Leagues shown per page; more than this turns on pagination. */
export const LEAGUES_PER_PAGE = 5

export const LEAGUES: readonly League[] = [
  {
    id: 'sunday-slugger',
    name: 'Sunday Slugger',
    sport: 'Baseball',
    emoji: '⚾',
    leagueType: 'Redraft',
    record: '8-4',
    rank: 2,
    teams: 12,
    matchup: { opponent: 'Bronx Bombers', status: 'live', myScore: 84.5, theirScore: 71.2, note: 'Week 12' },
  },
  {
    id: 'gridiron-gang',
    name: 'Gridiron Gang',
    sport: 'Football',
    emoji: '🏈',
    leagueType: 'Keeper',
    record: '6-6',
    rank: 5,
    teams: 10,
    matchup: { opponent: 'Blitz Kings', status: 'upcoming', myScore: null, theirScore: null, note: 'Starts Sun 1:00 PM' },
  },
  {
    id: 'ice-cold',
    name: 'Ice Cold League',
    sport: 'Hockey',
    emoji: '🏒',
    leagueType: 'Guillotine',
    record: '9-3',
    rank: 1,
    teams: 8,
    matchup: { opponent: 'Puck Dynasty', status: 'final', myScore: 102.3, theirScore: 96.8, note: 'Week 11' },
  },
  {
    id: 'hardwood-heroes',
    name: 'Hardwood Heroes',
    sport: 'Basketball',
    emoji: '🏀',
    leagueType: 'Bestball',
    record: '4-8',
    rank: 9,
    teams: 12,
    matchup: { opponent: 'Fast Breakers', status: 'live', myScore: 61.0, theirScore: 77.4, note: 'Week 12' },
  },
  {
    id: 'pit-crew',
    name: 'Pit Crew Fantasy',
    sport: 'NASCAR',
    emoji: '🏎️',
    leagueType: 'Redraft',
    record: '3-2',
    rank: 3,
    teams: 6,
    matchup: { opponent: 'Pole Position', status: 'upcoming', myScore: null, theirScore: null, note: 'Race day Sun' },
  },
  {
    id: 'diamond-dynasty',
    name: 'Diamond Dynasty',
    sport: 'Baseball',
    emoji: '⚾',
    leagueType: 'Dynasty',
    record: '7-5',
    rank: 4,
    teams: 12,
    matchup: { opponent: 'Bleacher Creatures', status: 'live', myScore: 66.0, theirScore: 66.0, note: 'Week 12' },
  },
  {
    id: 'bullpen-brawl',
    name: 'Bullpen Brawl',
    sport: 'Baseball',
    emoji: '⚾',
    leagueType: 'Guillotine',
    record: '10-2',
    rank: 1,
    teams: 10,
    matchup: { opponent: 'Cleanup Crew', status: 'final', myScore: 91.4, theirScore: 58.9, note: 'Week 11' },
  },
  {
    id: 'grand-slam-club',
    name: 'Grand Slam Club',
    sport: 'Baseball',
    emoji: '⚾',
    leagueType: 'Keeper',
    record: '5-7',
    rank: 8,
    teams: 12,
    matchup: { opponent: 'Walk-Off Wonders', status: 'upcoming', myScore: null, theirScore: null, note: 'Starts Mon 7:05 PM' },
  },
  {
    id: 'pennant-chase',
    name: 'Pennant Chase',
    sport: 'Baseball',
    emoji: '⚾',
    leagueType: 'Bestball',
    record: '6-6',
    rank: 6,
    teams: 14,
    matchup: { opponent: 'Seventh Inning Stretch', status: 'final', myScore: 70.2, theirScore: 88.6, note: 'Week 11' },
  },
]

export function ordinal(n: number): string {
  const s = n % 100
  if (s >= 11 && s <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}
