import { useMemo, useSyncExternalStore } from 'react'
import { LEAGUES, LEAGUE_TYPE_ACCENT, type League } from './leaguesData'

export const LEAGUE_STORAGE_KEY = 'dyne.leagues.v1'

type Listener = () => void

const EMPTY: readonly League[] = Object.freeze([])
const listeners = new Set<Listener>()
let created: readonly League[] | null = null

function isLeague(v: unknown): v is League {
  if (typeof v !== 'object' || v === null) return false
  const l = v as Record<string, unknown>
  const m = l.matchup as Record<string, unknown> | null | undefined
  return (
    typeof l.id === 'string' &&
    typeof l.name === 'string' &&
    typeof l.sport === 'string' &&
    typeof l.emoji === 'string' &&
    typeof l.leagueType === 'string' &&
    l.leagueType in LEAGUE_TYPE_ACCENT &&
    typeof l.record === 'string' &&
    typeof l.rank === 'number' &&
    typeof l.teams === 'number' &&
    typeof m === 'object' &&
    m !== null &&
    typeof m.opponent === 'string' &&
    typeof m.status === 'string' &&
    typeof m.note === 'string'
  )
}

function load(): readonly League[] {
  try {
    const raw = localStorage.getItem(LEAGUE_STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY
    return parsed.filter(isLeague)
  } catch {
    return EMPTY
  }
}

function persist(list: readonly League[]): void {
  try {
    localStorage.setItem(LEAGUE_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Storage unavailable or full: keep the in-memory list.
  }
}

/** Created leagues, newest first. The reference changes only when the list changes. */
export function getSnapshot(): readonly League[] {
  created ??= load()
  return created
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function addLeague(league: League): void {
  created = [league, ...getSnapshot()]
  persist(created)
  listeners.forEach((l) => l())
}

/** Test helper: forget in-memory state and stored data. */
export function resetLeagueStore(): void {
  created = null
  try {
    localStorage.removeItem(LEAGUE_STORAGE_KEY)
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

/** Built-in leagues plus created ones, newest created first. */
export function useLeagues(): readonly League[] {
  const createdLeagues = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return useMemo(() => [...createdLeagues, ...LEAGUES], [createdLeagues])
}
