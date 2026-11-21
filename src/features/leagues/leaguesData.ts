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

export function ordinal(n: number): string {
  const s = n % 100
  if (s >= 11 && s <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}
