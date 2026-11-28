import { useCallback, useEffect, useState } from 'react'
import { getDefaultLeagueLoader, type LeagueLoader } from './leagueLoader'
import type { League } from './leaguesData'

export type MyLeagues =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; leagues: readonly League[] }

/** Loads the signed-in user's leagues on every mount, so a new league shows up right away. */
export function useMyLeagues(loader: LeagueLoader | undefined): {
  state: MyLeagues
  /** Loads again, e.g. after a league is created. */
  reload: () => void
  /** Updates one loaded league in place without a reload. */
  patchLeague: (id: string, patch: Partial<League>) => void
} {
  const [state, setState] = useState<MyLeagues>({ status: 'loading' })
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (loader ?? getDefaultLeagueLoader()).loadMyLeagues().then((res) => {
      if (cancelled) return
      setState(res.ok ? { status: 'ready', leagues: res.leagues } : { status: 'error', message: res.reason })
    })
    return () => {
      cancelled = true
    }
  }, [loader, reloads])

  const reload = useCallback(() => setReloads((n) => n + 1), [])
  const patchLeague = useCallback((id: string, patch: Partial<League>) => {
    setState((s) =>
      s.status === 'ready' ? { status: 'ready', leagues: s.leagues.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : s,
    )
  }, [])

  return { state, reload, patchLeague }
}
