import type { SupabaseClient } from '@supabase/supabase-js'
import { withTimeout } from '../../auth/authService'
import { MAX_TOP_LEAGUES } from './leaguesData'

export type SetFavoriteResult = { ok: true } | { ok: false; reason: string }

export interface FavoriteService {
  /** Stars or unstars a league for the signed-in user. Never rejects. */
  setFavorite(leagueId: string, favorite: boolean): Promise<SetFavoriteResult>
}

export const FAVORITE_FAILURE_MESSAGE = 'Your top leagues could not be updated. Please try again.'
export const TOO_MANY_FAVORITES_MESSAGE = `You can pick up to ${MAX_TOP_LEAGUES} top leagues. Remove one first.`

export function createFavoriteService(client: SupabaseClient): FavoriteService {
  return {
    async setFavorite(leagueId, favorite) {
      try {
        const { error } = await withTimeout(
          client.rpc('set_league_favorite', { p_league_id: leagueId, p_favorite: favorite }),
        )
        if (error) {
          return {
            ok: false,
            reason: error.message.includes('too_many_favorites') ? TOO_MANY_FAVORITES_MESSAGE : FAVORITE_FAILURE_MESSAGE,
          }
        }
        return { ok: true }
      } catch {
        return { ok: false, reason: FAVORITE_FAILURE_MESSAGE }
      }
    },
  }
}

let instance: FavoriteService | null = null

/** App-wide service; the Supabase client is imported on first use so importing needs no env vars. */
export function getDefaultFavoriteService(): FavoriteService {
  instance ??= {
    async setFavorite(leagueId, favorite) {
      try {
        const { supabase } = await import('../../supabase')
        return await createFavoriteService(supabase).setFavorite(leagueId, favorite)
      } catch {
        return { ok: false, reason: FAVORITE_FAILURE_MESSAGE }
      }
    },
  }
  return instance
}
