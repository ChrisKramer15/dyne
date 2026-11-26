import { defaultRoster, defaultScoring } from './leagueCategories'
import type { NewLeague } from './leagueService'

export type StepId = 'general' | 'roster' | 'scoring'

/** Wizard steps in order; index + 1 is the step number. */
export const STEPS: readonly { id: StepId; title: string }[] = [
  { id: 'general', title: 'General' },
  { id: 'roster', title: 'Roster' },
  { id: 'scoring', title: 'Scoring' },
]

export const TOTAL_STEPS = 3

export interface LeagueDraft {
  format: string
  name: string
  /** Raw input so empty and non-numeric values can be kept and reported. */
  teamCount: string
  /** Starting slots per position key, as raw input. */
  roster: Record<string, string>
  /** Points per unit per scoring category key, as raw input. */
  scoring: Record<string, string>
}

export const DEFAULT_TEAM_COUNT = '10'

export function initialDraft(format: string): LeagueDraft {
  return {
    format,
    name: '',
    teamCount: DEFAULT_TEAM_COUNT,
    roster: defaultRoster(),
    scoring: defaultScoring(),
  }
}

function trimValues(r: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.trim()]))
}

/** Trims the text fields. Returns a new object and never mutates the input. */
export function normalizeDraft(d: LeagueDraft): LeagueDraft {
  return {
    ...d,
    name: d.name.trim(),
    teamCount: d.teamCount.trim(),
    roster: trimValues(d.roster),
    scoring: trimValues(d.scoring),
  }
}

function sameRecord(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) if (a[k] !== b[k]) return false
  return true
}

/** True when any field differs from the initial draft. */
export function isDirty(draft: LeagueDraft, initial: LeagueDraft): boolean {
  return (
    draft.format !== initial.format ||
    draft.name !== initial.name ||
    draft.teamCount !== initial.teamCount ||
    !sameRecord(draft.roster, initial.roster) ||
    !sameRecord(draft.scoring, initial.scoring)
  )
}

function toNumbers(r: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)]))
}

/** Call only with a draft that passed validation (after `normalizeDraft`). */
export function toNewLeague(d: LeagueDraft): NewLeague {
  return {
    format: d.format,
    name: d.name,
    teamCount: Number(d.teamCount),
    roster: toNumbers(d.roster),
    scoring: toNumbers(d.scoring),
  }
}
