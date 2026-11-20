import type { LeagueVisibility, NewLeague } from './leagueService'

export type StepId = 'format' | 'details' | 'settings' | 'review'

/** Wizard steps in order; index + 1 is the step number. */
export const STEPS: readonly { id: StepId; title: string }[] = [
  { id: 'format', title: 'Format' },
  { id: 'details', title: 'Details' },
  { id: 'settings', title: 'Settings' },
  { id: 'review', title: 'Review' },
]

export const TOTAL_STEPS = 4

export interface LeagueDraft {
  format: string | null
  name: string
  description: string
  /** Raw input so empty and non-numeric values can be kept and reported. */
  teamCount: string
  visibility: LeagueVisibility
}

export const DEFAULT_TEAM_COUNT = '10'

export function initialDraft(format: string | null): LeagueDraft {
  return {
    format,
    name: '',
    description: '',
    teamCount: DEFAULT_TEAM_COUNT,
    visibility: 'private',
  }
}

/** Trims the text fields. Returns a new object and never mutates the input. */
export function normalizeDraft(d: LeagueDraft): LeagueDraft {
  return {
    ...d,
    name: d.name.trim(),
    description: d.description.trim(),
    teamCount: d.teamCount.trim(),
  }
}

/** True when any field differs from the initial draft. */
export function isDirty(draft: LeagueDraft, initial: LeagueDraft): boolean {
  return (
    draft.format !== initial.format ||
    draft.name !== initial.name ||
    draft.description !== initial.description ||
    draft.teamCount !== initial.teamCount ||
    draft.visibility !== initial.visibility
  )
}

/** Call only with a draft that passed validation (after `normalizeDraft`). */
export function toNewLeague(d: LeagueDraft): NewLeague {
  return {
    format: d.format ?? '',
    name: d.name,
    description: d.description,
    teamCount: Number(d.teamCount),
    visibility: d.visibility,
  }
}
