import { SPORTS } from '../../home/homeData'
import { normalizeDraft, STEPS } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'

export type FieldName = 'format' | 'name' | 'description' | 'teamCount' | 'visibility'
export type FieldErrors = Partial<Record<FieldName, string>>

export const MAX_NAME_LENGTH = 50
export const MAX_DESCRIPTION_LENGTH = 280
export const MIN_TEAMS = 4
export const GUILLOTINE_MIN_TEAMS = 6
export const MAX_TEAMS = 20
export const GUILLOTINE_FORMAT = 'Guillotine'

export const FORMAT_REQUIRED_MESSAGE = 'Choose a league format'
export const NAME_REQUIRED_MESSAGE = 'Enter a league name'
export const NAME_TOO_LONG_MESSAGE = `League name must be ${MAX_NAME_LENGTH} characters or fewer`
export const DESCRIPTION_TOO_LONG_MESSAGE = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`
export const VISIBILITY_MESSAGE = 'Choose Private or Public'

export function teamCountMessage(min: number): string {
  return `Team count must be a whole number from ${min} to ${MAX_TEAMS}`
}

export const FIELD_STEP: Record<FieldName, StepId> = {
  format: 'format',
  name: 'details',
  description: 'details',
  teamCount: 'settings',
  visibility: 'settings',
}

/** Fields of each step in visual order (top to bottom), used for focus. */
export const FIELD_ORDER: Record<StepId, FieldName[]> = {
  format: ['format'],
  details: ['name', 'description'],
  settings: ['teamCount', 'visibility'],
  review: [],
}

const DEFAULT_FORMATS: readonly string[] = SPORTS.flatMap((s) => s.formats.map((f) => f.name))

function codePoints(s: string): number {
  return Array.from(s).length
}

function minTeams(format: string | null): number {
  return format === GUILLOTINE_FORMAT ? GUILLOTINE_MIN_TEAMS : MIN_TEAMS
}

function validateField(
  field: FieldName,
  d: LeagueDraft,
  formats: readonly string[],
): string | undefined {
  switch (field) {
    case 'format':
      return d.format === null || !formats.includes(d.format) ? FORMAT_REQUIRED_MESSAGE : undefined
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
  formats: readonly string[] = DEFAULT_FORMATS,
): FieldErrors {
  const d = normalizeDraft(draft)
  const errors: FieldErrors = {}
  for (const field of FIELD_ORDER[step]) {
    const message = validateField(field, d, formats)
    if (message) errors[field] = message
  }
  return errors
}

/** Pure. Validates every step. */
export function validateDraft(
  draft: LeagueDraft,
  formats: readonly string[] = DEFAULT_FORMATS,
): FieldErrors {
  const errors: FieldErrors = {}
  for (const { id } of STEPS) Object.assign(errors, validateStep(draft, id, formats))
  return errors
}

/** First step in step order with an invalid field, or null when the draft is valid. */
export function firstInvalidStep(
  draft: LeagueDraft,
  formats: readonly string[] = DEFAULT_FORMATS,
): StepId | null {
  for (const { id } of STEPS) {
    if (Object.keys(validateStep(draft, id, formats)).length > 0) return id
  }
  return null
}
