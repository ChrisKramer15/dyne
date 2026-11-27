import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DETAIL_FAILURE_MESSAGE, createLeagueDetailLoader } from './leagueDetailLoader'

const leagueRow = {
  id: 'l1',
  owner_id: 'u1',
  name: 'Sandlot',
  format: 'Dynasty',
  avatar_id: 'avatar-001',
  team_count: 12,
  scoring: { h_homeRuns: 4, bad: 'x' },
  created_at: '2025-03-01T00:00:00Z',
}

function fakeClient(opts: { userId?: string | null; league?: unknown; leagueError?: unknown; count?: number | null; countError?: unknown }) {
  return {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: opts.userId === null ? null : { user: { id: opts.userId ?? 'u1' } } } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === 'leagues'
            ? { maybeSingle: () => Promise.resolve({ data: opts.league ?? null, error: opts.leagueError ?? null }) }
            : Promise.resolve({ count: opts.count ?? 1, error: opts.countError ?? null }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('createLeagueDetailLoader', () => {
  it('maps the row, member count and commissioner flag', async () => {
    const res = await createLeagueDetailLoader(fakeClient({ league: leagueRow, count: 3 })).loadLeague('l1')
    expect(res.ok && res.league).toMatchObject({
      id: 'l1',
      name: 'Sandlot',
      sport: 'Baseball',
      leagueType: 'Dynasty',
      teamCount: 12,
      memberCount: 3,
      isCommissioner: true,
      scoring: { h_homeRuns: 4 },
    })
  })

  it('is not commissioner when another user owns the league', async () => {
    const res = await createLeagueDetailLoader(fakeClient({ userId: 'u2', league: leagueRow })).loadLeague('l1')
    expect(res.ok && res.league.isCommissioner).toBe(false)
  })

  it('reports not_found when no row is visible or the format is unknown', async () => {
    const none = await createLeagueDetailLoader(fakeClient({})).loadLeague('l1')
    expect(none).toMatchObject({ ok: false, reason: 'not_found' })
    const bad = await createLeagueDetailLoader(fakeClient({ league: { ...leagueRow, format: 'Nope' } })).loadLeague('l1')
    expect(bad).toMatchObject({ ok: false, reason: 'not_found' })
  })

  it('reports a generic error for query failures and a missing session', async () => {
    const msg = { ok: false, reason: 'error', message: DETAIL_FAILURE_MESSAGE }
    expect(await createLeagueDetailLoader(fakeClient({ leagueError: { message: 'x' } })).loadLeague('l1')).toEqual(msg)
    expect(await createLeagueDetailLoader(fakeClient({ league: leagueRow, countError: { message: 'x' } })).loadLeague('l1')).toEqual(msg)
    expect(await createLeagueDetailLoader(fakeClient({ userId: null })).loadLeague('l1')).toEqual(msg)
  })
})
