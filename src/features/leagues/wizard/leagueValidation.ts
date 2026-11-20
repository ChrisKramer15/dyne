import { normalizeDraft, STEPS } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'

export type FieldName = 'name' | 'description' | 'teamCount' | 'visibility'
export type FieldErrors = Partial<Record<FieldName, string>>

export const MAX_NAME_LENGTH = 50
export const MAX_DESCRIPTION_LENGTH = 280
export const MIN_TEAMS = 4
export const GUILLOTINE_MIN_TEAMS = 6
export const MAX_TEAMS = 20
export const GUILLOTINE_FORMAT = 'Guillotine'

export const NAME_REQUIRED_MESSAGE = 'Enter a league name'
export const NAME_TOO_LONG_MESSAGE = `League name must be ${MAX_NAME_LENGTH} characters or fewer`
export const DESCRIPTION_TOO_LONG_MESSAGE = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`
export const VISIBILITY_MESSAGE = 'Choose Private or Public'

export function teamCountMessage(min: number): string {
  return `Team count must be a whole number from ${min} to ${MAX_TEAMS}`
}

export const FIELD_STEP: Record<FieldName, StepId> = {
  name: 'details',
  description: 'details',
  teamCount: 'settings',
  visibility: 'settings',
}

/** Fields of each step in visual order (top to bottom), used for focus. */
export const FIELD_ORDER: Record<StepId, FieldName[]> = {
  details: ['name', 'description'],
  settings: ['teamCount', 'visibility'],
  review: [],
}

function codePoints(s: string): number {
  return Array.from(s).length
}

function minTeams(format: string): number {
  return format === GUILLOTINE_FORMAT ? GUILLOTINE_MIN_TEAMS : MIN_TEAMS
}

function validateField(
  field: FieldName,
  d: LeagueDraft,
): string | undefined {
  switch (field) {
    case 'name': {
      const len = codePoints(d.name)
      if (len === 0) return NAME_REQUIRED_MESSAGE
      return len > MAX_NAME_LENGTH ? NAME_TOO_LONG_MESSAGE : undefined
    }
    case 'description':
      return codePoints(d.description) > MAX_DESCRIPTION_LENGTH
        ? DESCRIPTION_TOO_LONG_MESSAGE
        : undefined
    case 'teamCount': {
      const min = minTeams(d.format)
      const n = /^\d+$/.test(d.teamCount) ? Number(d.teamCount) : NaN
      return Number.isInteger(n) && n >= min && n <= MAX_TEAMS ? undefined : teamCountMessage(min)
    }
    case 'visibility':
      return d.visibility === 'private' || d.visibility === 'public' ? undefined : VISIBILITY_MESSAGE
  }
}

/** Pure. Validates the fields of one step on the normalized draft. */
export function validateStep(
  draft: LeagueDraft,
  step: StepId,
): FieldErrors {
  const d = normalizeDraft(draft)
  const errors: FieldErrors = {}
  for (const field of FIELD_ORDER[step]) {
    const message = validateField(field, d)
    if (message) errors[field] = message
  }
  return errors
}

/** Pure. Validates every step. */
export function validateDraft(
  draft: LeagueDraft,
): FieldErrors {
  const errors: FieldErrors = {}
  for (const { id } of STEPS) Object.assign(errors, validateStep(draft, id))
  return errors
}

/** First step in step order with an invalid field, or null when the draft is valid. */
export function firstInvalidStep(
  draft: LeagueDraft,
): StepId | null {
  for (const { id } of STEPS) {
    if (Object.keys(validateStep(draft, id)).length > 0) return id
  }
  return null
}
