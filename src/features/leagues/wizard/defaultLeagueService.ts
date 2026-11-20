import { SPORTS } from '../../home/homeData'
import { addLeague } from '../leagueStore'
import type { League, LeagueType } from '../leaguesData'
import type { LeagueService, NewLeague } from './leagueService'

let instance: LeagueService | null = null

function generateLeagueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `league-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function buildLeague(id: string, n: NewLeague): League {
  const sport = SPORTS.find((s) => s.formats.some((f) => f.name === n.format)) ?? SPORTS[0]
  return {
    id,
    name: n.name,
    sport: sport.name,
    emoji: sport.emoji,
    leagueType: n.format as LeagueType,
    record: '0-0',
    rank: 1,
    teams: n.teamCount,
    matchup: { opponent: 'TBD', status: 'upcoming', myScore: null, theirScore: null, note: 'Season not started' },
  }
}

/**
 * The app-wide league service, created on first use. Backend creation is out
 * of scope, so this adds the league to the local league store and resolves
 * with a generated id.
 */
export function getDefaultLeagueService(): LeagueService {
  instance ??= {
    createLeague: (league) => {
      const id = generateLeagueId()
      addLeague(buildLeague(id, league))
      return Promise.resolve({ ok: true, leagueId: id })
    },
  }
  return instance
}
