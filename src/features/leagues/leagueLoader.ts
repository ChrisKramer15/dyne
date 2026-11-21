import type { SupabaseClient } from '@supabase/supabase-js'
import { withTimeout } from '../../auth/authService'
import { SPORTS } from '../home/homeData'
import { LEAGUE_TYPE_ACCENT, type League, type LeagueType } from './leaguesData'

export type LoadLeaguesResult = { ok: true; leagues: League[] } | { ok: false; reason: string }

export interface LeagueLoader {
  /** The signed-in user's leagues, newest first. Never rejects. */
  loadMyLeagues(): Promise<LoadLeaguesResult>
}

export const LOAD_FAILURE_MESSAGE = 'Your leagues could not be loaded.'

interface LeagueRow {
  id: string
  name: string
  format: string
  team_count: number
  created_at: string
}

interface MemberRow {
  leagues: LeagueRow | LeagueRow[] | null
}

function isLeagueType(v: string): v is LeagueType {
  return v in LEAGUE_TYPE_ACCENT
}

/** A new league: 0-0, first place, no matchup yet. */
function toLeague(r: LeagueRow): League | null {
  if (!isLeagueType(r.format)) return null
  const sport = SPORTS.find((s) => s.formats.some((f) => f.name === r.format)) ?? SPORTS[0]
  return {
    id: r.id,
    name: r.name,
    sport: sport.name,
    emoji: sport.emoji,
    leagueType: r.format,
    record: '0-0',
    rank: 1,
    teams: r.team_count,
    matchup: { opponent: 'TBD', status: 'upcoming', myScore: null, theirScore: null, note: 'Season not started' },
  }
}

export function createLeagueLoader(client: SupabaseClient): LeagueLoader {
  return {
    async loadMyLeagues() {
      try {
        const { data: session } = await withTimeout(client.auth.getSession())
        const userId = session.session?.user.id
        if (!userId) return { ok: false, reason: LOAD_FAILURE_MESSAGE }

        const { data, error } = await withTimeout(
          Promise.resolve(
            client
              .from('league_members')
              .select('leagues(id, name, format, team_count, created_at)')
              .eq('user_id', userId),
          ),
        )
        if (error) return { ok: false, reason: LOAD_FAILURE_MESSAGE }

        const rows: LeagueRow[] = []
        for (const m of (data ?? []) as unknown as MemberRow[]) {
          const l = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues
          if (l) rows.push(l)
        }
        rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        const leagues = rows.map(toLeague).filter((l): l is League => l !== null)
        return { ok: true, leagues }
      } catch {
        return { ok: false, reason: LOAD_FAILURE_MESSAGE }
      }
    },
  }
}

let instance: LeagueLoader | null = null

/** App-wide loader; the Supabase client is imported on first use so importing needs no env vars. */
export function getDefaultLeagueLoader(): LeagueLoader {
  instance ??= {
    async loadMyLeagues() {
      try {
        const { supabase } = await import('../../supabase')
        return await createLeagueLoader(supabase).loadMyLeagues()
      } catch {
        return { ok: false, reason: LOAD_FAILURE_MESSAGE }
      }
    },
  }
  return instance
}
