import { TimeoutError, withTimeout } from '../../../auth/authService'

export interface NewLeague {
  /** League_Format name, e.g. 'Guillotine'. */
  format: string
  /** Trimmed. */
  name: string
  teamCount: number
  /** Starting slots per position key (see leagueCategories). */
  roster: Record<string, number>
  /** Points per unit per scoring category key. */
  scoring: Record<string, number>
}

export type CreateLeagueResult = { ok: true; leagueId: string } | { ok: false; reason?: string }

export interface LeagueService {
  createLeague(league: NewLeague): Promise<CreateLeagueResult>
}

export const LEAGUE_SUBMIT_TIMEOUT_MS = 15_000
export const TIMEOUT_MESSAGE = 'Request timed out. Try again.'
export const GENERIC_FAILURE_MESSAGE = 'The league could not be created.'

/** Never rejects. Maps rejection, timeout and blank reasons to a message. */
export async function submitLeague(
  service: LeagueService,
  league: NewLeague,
  timeoutMs: number = LEAGUE_SUBMIT_TIMEOUT_MS,
): Promise<{ ok: true; leagueId: string } | { ok: false; message: string }> {
  try {
    const result = await withTimeout(
      Promise.resolve().then(() => service.createLeague(league)),
      timeoutMs,
    )
    if (result.ok) return { ok: true, leagueId: result.leagueId }
    const reason = typeof result.reason === 'string' ? result.reason : ''
    return { ok: false, message: reason.trim() === '' ? GENERIC_FAILURE_MESSAGE : reason }
  } catch (err) {
    return { ok: false, message: err instanceof TimeoutError ? TIMEOUT_MESSAGE : GENERIC_FAILURE_MESSAGE }
  }
}
