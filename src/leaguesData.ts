// Sample data until leagues are wired to a backend.

export type MatchupStatus = 'live' | 'upcoming' | 'final'

export interface League {
  id: string
  name: string
  sport: string
  emoji: string
  accent: 'cyan' | 'green' | 'magenta' | 'purple'
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

export const LEAGUES: readonly League[] = [
  {
    id: 'sunday-slugger',
    name: 'Sunday Slugger',
    sport: 'Baseball',
    emoji: '⚾',
    accent: 'cyan',
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
    accent: 'green',
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
    accent: 'magenta',
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
    accent: 'purple',
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
    accent: 'cyan',
    record: '3-2',
    rank: 3,
    teams: 6,
    matchup: { opponent: 'Pole Position', status: 'upcoming', myScore: null, theirScore: null, note: 'Race day Sun' },
  },
]

export function ordinal(n: number): string {
  const s = n % 100
  if (s >= 11 && s <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}
