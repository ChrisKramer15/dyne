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
import { getDefaultLeagueService } from './defaultLeagueService'

const league: NewLeague = {
  format: 'Guillotine',
  name: 'My League',
  description: '',
  teamCount: 10,
  visibility: 'private',
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

  it('resolves ok with a non-empty leagueId', async () => {
    const result = await getDefaultLeagueService().createLeague(league)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.leagueId).not.toBe('')
  })

  it('creates the instance lazily on first use, not at import', async () => {
    vi.resetModules()
    const mod = await import('./defaultLeagueService')
    const first = mod.getDefaultLeagueService()
    expect(mod.getDefaultLeagueService()).toBe(first)
  })
})
