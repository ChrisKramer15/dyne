// League types and display helpers. Leagues themselves are loaded from the backend (see leagueLoader.ts).

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

/** Sports shown as cards at the top of the Leagues page. Only available ones can create leagues; the rest show "coming soon". */
export const LEAGUE_SPORTS = [
  { name: 'Baseball', emoji: '\u26BE', accent: 'green', available: true },
  { name: 'Football', emoji: '\u{1F3C8}', accent: 'magenta', available: false },
  { name: 'Basketball', emoji: '\u{1F3C0}', accent: 'orange', available: false },
  { name: 'Hockey', emoji: '\u{1F3D2}', accent: 'blue', available: false },
] as const

export interface League {
  id: string
  name: string
  sport: string
  /** The avatar picked when the league was created, or the sport emoji when none was saved. */
  emoji: string
  leagueType: LeagueType
  /** True when the signed-in user starred this league as one of their top leagues. */
  isFavorite: boolean
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

/** Most leagues a user can star; the home page shows them as Top leagues. Also enforced in set_league_favorite(). */
export const MAX_TOP_LEAGUES = 5

/** Leagues shown per page; more than this turns on pagination. */
export const LEAGUES_PER_PAGE = 5

export function ordinal(n: number): string {
  const s = n % 100
  if (s >= 11 && s <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}
