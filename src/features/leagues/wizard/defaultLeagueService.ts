import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeagueService } from './leagueService'

interface DbError {
  code?: string
  message?: string
}

const NOT_SIGNED_IN = 'Sign in to create a league.'
const NOT_ACCEPTED = 'The league details were not accepted. Check them and try again.'
const UNAVAILABLE = 'The league could not be created. Try again.'

/** Maps the database's errors to a message the wizard can show. */
function failureReason(e: DbError): string {
  const text = e.message ?? ''
  if (text.includes('not_authenticated') || e.code === '42501') return NOT_SIGNED_IN
  // Check-constraint and not-null violations from the leagues table.
  if (e.code === '23514' || e.code === '23502' || e.code === '22023') return NOT_ACCEPTED
  return UNAVAILABLE
}

/**
 * Builds a LeagueService that calls the `create_league` RPC. Failures come
 * back as `{ ok: false, reason }`; the caller (submitLeague) adds the timeout.
 */
export function createLeagueService(client: SupabaseClient): LeagueService {
  return {
    async createLeague(league) {
      const { data, error } = await client.rpc('create_league', {
        p_name: league.name,
        p_description: league.description,
        p_format: league.format,
        p_team_count: league.teamCount,
        p_visibility: league.visibility,
      })
      if (error) return { ok: false, reason: failureReason(error) }
      if (typeof data !== 'string' || data === '') return { ok: false, reason: UNAVAILABLE }
      return { ok: true, leagueId: data }
    },
  }
}

let instance: LeagueService | null = null

/**
 * The app-wide league service, created on first use. The Supabase client is
 * imported on the first call so importing this module needs no env vars.
 */
export function getDefaultLeagueService(): LeagueService {
  instance ??= {
    async createLeague(league) {
      const { supabase } = await import('../../../supabase')
      return createLeagueService(supabase).createLeague(league)
    },
  }
  return instance
}
