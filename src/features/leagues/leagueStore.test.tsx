import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import {
  LEAGUE_STORAGE_KEY,
  addLeague,
  getSnapshot,
  resetLeagueStore,
  subscribe,
  useLeagues,
} from './leagueStore'
import { LEAGUES, type League } from './leaguesData'
import { getDefaultLeagueService } from './wizard/defaultLeagueService'

const make = (id: string, over: Partial<League> = {}): League => ({
  id,
  name: `League ${id}`,
  sport: 'Baseball',
  emoji: '⚾',
  leagueType: 'Redraft',
  record: '0-0',
  rank: 1,
  teams: 10,
  matchup: { opponent: 'TBD', status: 'upcoming', myScore: null, theirScore: null, note: 'x' },
  ...over,
})

beforeEach(resetLeagueStore)
afterEach(() => {
  cleanup()
  resetLeagueStore()
})

describe('leagueStore', () => {
  it('starts empty and keeps the snapshot reference stable between changes', () => {
    expect(getSnapshot()).toHaveLength(0)
    expect(getSnapshot()).toBe(getSnapshot())
  })

  it('adds newest first, notifies subscribers and persists', () => {
    let calls = 0
    const unsub = subscribe(() => calls++)
    addLeague(make('a'))
    addLeague(make('b'))
    unsub()
    addLeague(make('c'))
    expect(calls).toBe(2)
    expect(getSnapshot().map((l) => l.id)).toEqual(['c', 'b', 'a'])
    expect(JSON.parse(localStorage.getItem(LEAGUE_STORAGE_KEY) ?? '[]')).toHaveLength(3)
  })

  it.each(['{not json', '{"a":1}', '[1,"x",null]'])('tolerates corrupt storage %s', (raw) => {
    localStorage.setItem(LEAGUE_STORAGE_KEY, raw)
    // Force a reload from storage by resetting only the memory copy.
    resetLeagueStore()
    localStorage.setItem(LEAGUE_STORAGE_KEY, raw)
    expect(getSnapshot()).toHaveLength(0)
  })

  it('loads valid stored leagues', () => {
    resetLeagueStore()
    localStorage.setItem(LEAGUE_STORAGE_KEY, JSON.stringify([make('z'), { bad: true }]))
    expect(getSnapshot().map((l) => l.id)).toEqual(['z'])
  })

  it('useLeagues returns created leagues before built-in ones', () => {
    const { result } = renderHook(() => useLeagues())
    expect(result.current).toHaveLength(LEAGUES.length)
    act(() => addLeague(make('new')))
    expect(result.current[0].id).toBe('new')
    expect(result.current).toHaveLength(LEAGUES.length + 1)
  })
})

describe('default league service', () => {
  it('builds a league from the new league and adds it to the store before resolving', async () => {
    const res = await getDefaultLeagueService().createLeague({
      format: 'Guillotine',
      name: 'My League',
      description: '',
      teamCount: 8,
      visibility: 'private',
    })
    expect(res.ok).toBe(true)
    const league = getSnapshot()[0]
    expect(res.ok && res.leagueId).toBe(league.id)
    expect(league).toMatchObject({
      name: 'My League',
      sport: 'Baseball',
      emoji: '⚾',
      leagueType: 'Guillotine',
      record: '0-0',
      rank: 1,
      teams: 8,
    })
    expect(league.matchup.status).toBe('upcoming')
  })
})
