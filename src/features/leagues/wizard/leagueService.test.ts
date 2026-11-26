import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GENERIC_FAILURE_MESSAGE,
  LEAGUE_SUBMIT_TIMEOUT_MS,
  TIMEOUT_MESSAGE,
  submitLeague,
  type CreateLeagueResult,
  type LeagueService,
  type NewLeague,
} from './leagueService'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLeagueService, getDefaultLeagueService } from './defaultLeagueService'

const league: NewLeague = {
  format: 'Guillotine',
  name: 'My League',
  teamCount: 10,
  roster: { SP: 4, C: 1 },
  scoring: { bat_hr: 4, pit_w: 5 },
}

const serviceReturning = (result: CreateLeagueResult): LeagueService => ({
  createLeague: () => Promise.resolve(result),
})

describe('submitLeague', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns ok with the league id and passes the league to the service', async () => {
    const createLeague = vi.fn().mockResolvedValue({ ok: true, leagueId: 'abc' })
    const result = await submitLeague({ createLeague }, league)
    expect(result).toEqual({ ok: true, leagueId: 'abc' })
    expect(createLeague).toHaveBeenCalledWith(league)
  })

  it('returns the service reason as the message', async () => {
    const result = await submitLeague(serviceReturning({ ok: false, reason: 'Name taken' }), league)
    expect(result).toEqual({ ok: false, message: 'Name taken' })
  })

  it.each([undefined, '', '   '])('uses the generic message for blank reason %j', async (reason) => {
    const result = await submitLeague(serviceReturning({ ok: false, reason }), league)
    expect(result).toEqual({ ok: false, message: GENERIC_FAILURE_MESSAGE })
  })

  it('maps a rejection to the generic message without rejecting', async () => {
    const service: LeagueService = { createLeague: () => Promise.reject(new Error('boom')) }
    await expect(submitLeague(service, league)).resolves.toEqual({
      ok: false,
      message: GENERIC_FAILURE_MESSAGE,
    })
  })

  it('maps a synchronous throw to the generic message', async () => {
    const service: LeagueService = {
      createLeague: () => {
        throw new Error('sync')
      },
    }
    await expect(submitLeague(service, league)).resolves.toEqual({
      ok: false,
      message: GENERIC_FAILURE_MESSAGE,
    })
  })

  it('times out with the timeout message and ignores a late response', async () => {
    let resolveLate!: (r: CreateLeagueResult) => void
    const service: LeagueService = {
      createLeague: () => new Promise<CreateLeagueResult>((res) => (resolveLate = res)),
    }
    const pending = submitLeague(service, league)
    await vi.advanceTimersByTimeAsync(LEAGUE_SUBMIT_TIMEOUT_MS)
    await expect(pending).resolves.toEqual({ ok: false, message: TIMEOUT_MESSAGE })

    resolveLate({ ok: true, leagueId: 'late' })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toEqual({ ok: false, message: TIMEOUT_MESSAGE })
  })

  it('honours a custom timeout', async () => {
    const service: LeagueService = { createLeague: () => new Promise<CreateLeagueResult>(() => {}) }
    const pending = submitLeague(service, league, 50)
    await vi.advanceTimersByTimeAsync(50)
    await expect(pending).resolves.toEqual({ ok: false, message: TIMEOUT_MESSAGE })
  })
})

describe('getDefaultLeagueService', () => {
  it('returns the same instance on every call', () => {
    expect(getDefaultLeagueService()).toBe(getDefaultLeagueService())
  })

  it('calls create_league with the league fields and returns the new id', async () => {
    const calls: { fn: string; args: unknown }[] = []
    const client = {
      rpc: (fn: string, args: unknown) => {
        calls.push({ fn, args })
        return Promise.resolve({ data: 'id-1', error: null })
      },
    } as unknown as SupabaseClient
    const result = await createLeagueService(client).createLeague(league)
    expect(result).toEqual({ ok: true, leagueId: 'id-1' })
    expect(calls).toEqual([
      {
        fn: 'create_league',
        args: {
          p_name: league.name,
          p_format: league.format,
          p_team_count: league.teamCount,
          p_roster: league.roster,
          p_scoring: league.scoring,
        },
      },
    ])
  })

  it.each([
    [{ message: 'not_authenticated' }, 'Sign in to create a league.'],
    [{ code: '23514', message: 'violates check constraint' }, 'The league details were not accepted. Check them and try again.'],
    [{ code: '500', message: 'boom' }, 'The league could not be created. Try again.'],
  ])('maps database error %j to a reason', async (error, reason) => {
    const client = { rpc: () => Promise.resolve({ data: null, error }) } as unknown as SupabaseClient
    expect(await createLeagueService(client).createLeague(league)).toEqual({ ok: false, reason })
  })

  it('creates the instance lazily on first use, not at import', async () => {
    vi.resetModules()
    const mod = await import('./defaultLeagueService')
    const first = mod.getDefaultLeagueService()
    expect(mod.getDefaultLeagueService()).toBe(first)
  })
})
