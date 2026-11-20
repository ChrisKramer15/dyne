import type { LeagueService } from './leagueService'

let instance: LeagueService | null = null

function generateLeagueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `league-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * The app-wide league service, created on first use. Backend creation is out
 * of scope, so this stub resolves successfully with a generated id and does
 * not persist anything.
 */
export function getDefaultLeagueService(): LeagueService {
  instance ??= {
    createLeague: () => Promise.resolve({ ok: true, leagueId: generateLeagueId() }),
  }
  return instance
}
