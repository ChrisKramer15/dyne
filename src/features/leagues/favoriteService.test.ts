import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FAVORITE_FAILURE_MESSAGE, TOO_MANY_FAVORITES_MESSAGE, createFavoriteService } from './favoriteService'

function fakeClient(result: { error: { message: string } | null } | 'throw') {
  const calls: [string, unknown][] = []
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push([fn, args])
      return result === 'throw' ? Promise.reject(new Error('boom')) : Promise.resolve(result)
    },
  } as unknown as SupabaseClient
  return { client, calls }
}

describe('createFavoriteService', () => {
  it('calls set_league_favorite with the league and flag', async () => {
    const { client, calls } = fakeClient({ error: null })
    expect(await createFavoriteService(client).setFavorite('l1', true)).toEqual({ ok: true })
    expect(calls).toEqual([['set_league_favorite', { p_league_id: 'l1', p_favorite: true }]])
  })

  it('explains the limit when the database rejects a fourth favorite', async () => {
    const { client } = fakeClient({ error: { message: 'too_many_favorites' } })
    expect(await createFavoriteService(client).setFavorite('l1', true)).toEqual({
      ok: false,
      reason: TOO_MANY_FAVORITES_MESSAGE,
    })
  })

  it('returns a generic failure on other errors and on exceptions', async () => {
    for (const r of [{ error: { message: 'x' } }, 'throw'] as const) {
      const { client } = fakeClient(r)
      expect(await createFavoriteService(client).setFavorite('l1', false)).toEqual({
        ok: false,
        reason: FAVORITE_FAILURE_MESSAGE,
      })
    }
  })
})
