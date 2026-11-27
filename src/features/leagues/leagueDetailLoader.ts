import type { SupabaseClient } from '@supabase/supabase-js'
import { withTimeout } from '../../auth/authService'
import { SPORTS } from '../home/homeData'
import { LEAGUE_TYPE_ACCENT, type LeagueType } from './leaguesData'
import { findAvatar } from './wizard/leagueAvatars'

/** One league as shown on its dashboard. */
export interface LeagueDetail {
  id: string
  name: string
  sport: string
  /** The league's own avatar, or the sport emoji when none was saved. */
  emoji: string
  leagueType: LeagueType
  teamCount: number
  /** Teams that have joined so far (always at least the commissioner). */
  memberCount: number
  /** True when the signed-in user is the league owner (commissioner). */
  isCommissioner: boolean
  /** Points per stat, keyed by ScoringStat.key. */
  scoring: Record<string, number>
  createdAt: string
}

export type LoadLeagueResult =
  | { ok: true; league: LeagueDetail }
  | { ok: false; reason: 'not_found' | 'error'; message: string }

export interface LeagueDetailLoader {
  /** One league the signed-in user belongs to. Never rejects. */
  loadLeague(id: string): Promise<LoadLeagueResult>
}

export const DETAIL_FAILURE_MESSAGE = 'This league could not be loaded.'
const NOT_FOUND_MESSAGE = 'League not found.'

interface LeagueRow {
  id: string
  owner_id: string
  name: string
  format: string
  avatar_id: string | null
  team_count: number
  scoring: unknown
  created_at: string
}

function isLeagueType(v: string): v is LeagueType {
  return v in LEAGUE_TYPE_ACCENT
}

/** Keeps only finite numeric values; the column is free-form jsonb. */
function toScoring(raw: unknown): Record<string, number> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  return out
}

const failure = (): LoadLeagueResult => ({ ok: false, reason: 'error', message: DETAIL_FAILURE_MESSAGE })

export function createLeagueDetailLoader(client: SupabaseClient): LeagueDetailLoader {
  return {
    async loadLeague(id) {
      try {
        const { data: session } = await withTimeout(client.auth.getSession())
        const userId = session.session?.user.id
        if (!userId) return failure()

        // Row-level security only returns leagues the user belongs to.
        const { data, error } = await withTimeout(
          Promise.resolve(
            client
              .from('leagues')
              .select('id, owner_id, name, format, avatar_id, team_count, scoring, created_at')
              .eq('id', id)
              .maybeSingle(),
          ),
        )
        if (error) return failure()
        const row = data as LeagueRow | null
        if (!row || !isLeagueType(row.format)) {
          return { ok: false, reason: 'not_found', message: NOT_FOUND_MESSAGE }
        }

        const { count, error: countError } = await withTimeout(
          Promise.resolve(
            client.from('league_members').select('user_id', { count: 'exact', head: true }).eq('league_id', id),
          ),
        )
        if (countError) return failure()

        const sport = SPORTS.find((s) => s.formats.some((f) => f.name === row.format)) ?? SPORTS[0]
        return {
          ok: true,
          league: {
            id: row.id,
            name: row.name,
            sport: sport.name,
            emoji: findAvatar(row.avatar_id)?.emoji ?? sport.emoji,
            leagueType: row.format,
            teamCount: row.team_count,
            memberCount: Math.max(1, count ?? 1),
            isCommissioner: row.owner_id === userId,
            scoring: toScoring(row.scoring),
            createdAt: row.created_at,
          },
        }
      } catch {
        return failure()
      }
    },
  }
}

let instance: LeagueDetailLoader | null = null

/** App-wide loader; the Supabase client is imported on first use so importing needs no env vars. */
export function getDefaultLeagueDetailLoader(): LeagueDetailLoader {
  instance ??= {
    async loadLeague(id) {
      try {
        const { supabase } = await import('../../supabase')
        return await createLeagueDetailLoader(supabase).loadLeague(id)
      } catch {
        return failure()
      }
    },
  }
  return instance
}
