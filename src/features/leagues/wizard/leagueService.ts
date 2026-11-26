import type { SupabaseClient } from '@supabase/supabase-js'
import { withTimeout } from '../../../auth/authService'

/** Everything the wizard collects, validated and ready to save. */
export interface CreateLeagueInput {
  /** League format name, e.g. 'Dynasty'. */
  format: string
  name: string
  /** Id from LEAGUE_AVATARS. */
  avatarId: string
  /** Whole number, 4 to 32. */
  teamCount: number
  /** Points per stat, keyed by ScoringStat.key. */
  scoring: Record<string, number>
}

export type CreateLeagueResult = { ok: true; id: string } | { ok: false; reason: string }

export interface LeagueService {
  /** Creates the league and makes the signed-in user its owner. Never rejects. */
  createLeague(input: CreateLeagueInput): Promise<CreateLeagueResult>
}

export const CREATE_FAILURE_MESSAGE = 'Your league could not be created. Please try again.'
export const NOT_SIGNED_IN_MESSAGE = 'Your session has expired. Please sign in again.'

export function createLeagueService(client: SupabaseClient): LeagueService {
  return {
    async createLeague(input) {
      try {
        const { data, error } = await withTimeout(
          client.rpc('create_league', {
            p_name: input.name,
            p_format: input.format,
            p_avatar_id: input.avatarId,
            p_team_count: input.teamCount,
            p_scoring: input.scoring,
          }),
        )
        if (error) {
          return { ok: false, reason: error.message.includes('not_authenticated') ? NOT_SIGNED_IN_MESSAGE : CREATE_FAILURE_MESSAGE }
        }
        if (typeof data !== 'string') return { ok: false, reason: CREATE_FAILURE_MESSAGE }
        return { ok: true, id: data }
      } catch {
        return { ok: false, reason: CREATE_FAILURE_MESSAGE }
      }
    },
  }
}

let instance: LeagueService | null = null

/** App-wide service; the Supabase client is imported on first use so importing needs no env vars. */
export function getDefaultLeagueService(): LeagueService {
  instance ??= {
    async createLeague(input) {
      try {
        const { supabase } = await import('../../../supabase')
        return await createLeagueService(supabase).createLeague(input)
      } catch {
        return { ok: false, reason: CREATE_FAILURE_MESSAGE }
      }
    },
  }
  return instance
}
