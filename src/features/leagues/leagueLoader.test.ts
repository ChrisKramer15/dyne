import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LOAD_FAILURE_MESSAGE, createLeagueLoader } from './leagueLoader'

const row = (id: string, created_at: string, format = 'Guillotine', is_favorite = false, avatar_id: string | null = null) => ({
  is_favorite,
  leagues: { id, name: `League ${id}`, format, avatar_id, team_count: 8, created_at },
})

function fakeClient(opts: { userId?: string | null; data?: unknown; error?: unknown }) {
  const filters: [string, unknown][] = []
  const client = {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: opts.userId === null ? null : { user: { id: opts.userId ?? 'u1' } } } }),
    },
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (col: string, val: unknown) => {
          filters.push([`${table}:${cols}`, null], [col, val])
          return Promise.resolve({ data: opts.data ?? [], error: opts.error ?? null })
        },
      }),
    }),
  } as unknown as SupabaseClient
  return { client, filters }
}

describe('createLeagueLoader', () => {
  it('maps member rows to leagues, newest first, filtered to the signed-in user', async () => {
    const { client, filters } = fakeClient({
      data: [row('old', '2025-01-01T00:00:00Z'), row('new', '2025-03-01T00:00:00Z'), row('bad', '2025-04-01T00:00:00Z', 'Nope')],
    })
    const res = await createLeagueLoader(client).loadMyLeagues()
    expect(filters).toContainEqual(['user_id', 'u1'])
    expect(res.ok && res.leagues.map((l) => l.id)).toEqual(['new', 'old'])
    expect(res.ok && res.leagues[0]).toMatchObject({
      name: 'League new',
      sport: 'Baseball',
      emoji: '⚾',
      leagueType: 'Guillotine',
      record: '0-0',
      rank: 1,
      teams: 8,
      matchup: { status: 'upcoming' },
    })
  })

  it('uses the league avatar as the emoji and carries the favorite flag', async () => {
    const { client } = fakeClient({
      data: [
        row('a', '2025-03-01T00:00:00Z', 'Dynasty', true, 'avatar-021'),
        row('b', '2025-02-01T00:00:00Z', 'Dynasty', false, null),
      ],
    })
    const res = await createLeagueLoader(client).loadMyLeagues()
    expect(res.ok && res.leagues.map((l) => [l.emoji, l.isFavorite])).toEqual([
      ['🦁', true],
      ['⚾', false],
    ])
  })
  it('returns a failure reason on a database error', async () => {
    const { client } = fakeClient({ error: { message: 'x' } })
    expect(await createLeagueLoader(client).loadMyLeagues()).toEqual({ ok: false, reason: LOAD_FAILURE_MESSAGE })
  })

  it('returns a failure reason when signed out', async () => {
    const { client } = fakeClient({ userId: null })
    expect(await createLeagueLoader(client).loadMyLeagues()).toEqual({ ok: false, reason: LOAD_FAILURE_MESSAGE })
  })
})
