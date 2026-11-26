import {
  ROSTER_FIELD_PREFIX,
  ROSTER_POSITIONS,
  SCORING_CATEGORIES,
  SCORING_FIELD_PREFIX,
} from './leagueCategories'
import { normalizeDraft, STEPS } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'

export type FieldName =
  | 'name'
  | 'teamCount'
  | `${typeof ROSTER_FIELD_PREFIX}${string}`
  | `${typeof SCORING_FIELD_PREFIX}${string}`
export type FieldErrors = Partial<Record<FieldName, string>>

export const MAX_NAME_LENGTH = 50
export const MIN_TEAMS = 4
export const GUILLOTINE_MIN_TEAMS = 6
export const MAX_TEAMS = 32
export const MAX_SLOTS_PER_POSITION = 10
export const MAX_POINTS = 100
export const GUILLOTINE_FORMAT = 'Guillotine'

export const NAME_REQUIRED_MESSAGE = 'Enter a league name'
export const NAME_TOO_LONG_MESSAGE = `League name must be ${MAX_NAME_LENGTH} characters or fewer`
export const SLOTS_MESSAGE = `Enter a whole number from 0 to ${MAX_SLOTS_PER_POSITION}`
export const ROSTER_EMPTY_MESSAGE = 'Fill at least one roster slot'
export const POINTS_MESSAGE = `Enter a number from -${MAX_POINTS} to ${MAX_POINTS}`

export function teamCountMessage(min: number): string {
  return `Team count must be a whole number from ${min} to ${MAX_TEAMS}`
}

export const rosterField = (key: string): FieldName => `${ROSTER_FIELD_PREFIX}${key}`
export const scoringField = (key: string): FieldName => `${SCORING_FIELD_PREFIX}${key}`

const GENERAL_FIELDS: FieldName[] = ['name', 'teamCount']
const ROSTER_FIELDS: FieldName[] = ROSTER_POSITIONS.map((p) => rosterField(p.key))
const SCORING_FIELDS: FieldName[] = SCORING_CATEGORIES.map((c) => scoringField(c.key))

/** Fields of a step in visual order (top to bottom), used for focus. */
export function fieldsFor(step: StepId): FieldName[] {
  switch (step) {
    case 'general':
      return GENERAL_FIELDS
    case 'roster':
      return ROSTER_FIELDS
    case 'scoring':
      return SCORING_FIELDS
  }
}

function codePoints(s: string): number {
  return Array.from(s).length
}

export function minTeams(format: string): number {
  return format === GUILLOTINE_FORMAT ? GUILLOTINE_MIN_TEAMS : MIN_TEAMS
}

function isSlotCount(v: string | undefined): v is string {
  return v !== undefined && /^\d+$/.test(v) && Number(v) <= MAX_SLOTS_PER_POSITION
}

function isPoints(v: string | undefined): v is string {
  return v !== undefined && /^-?\d+(\.\d+)?$/.test(v) && Math.abs(Number(v)) <= MAX_POINTS
}

function validateField(field: FieldName, d: LeagueDraft): string | undefined {
  if (field === 'name') {
    const len = codePoints(d.name)
    if (len === 0) return NAME_REQUIRED_MESSAGE
    return len > MAX_NAME_LENGTH ? NAME_TOO_LONG_MESSAGE : undefined
  }
  if (field === 'teamCount') {
    const min = minTeams(d.format)
    const n = /^\d+$/.test(d.teamCount) ? Number(d.teamCount) : NaN
    return Number.isInteger(n) && n >= min && n <= MAX_TEAMS ? undefined : teamCountMessage(min)
  }
  if (field.startsWith(ROSTER_FIELD_PREFIX)) {
    const value = d.roster[field.slice(ROSTER_FIELD_PREFIX.length)]
    if (!isSlotCount(value)) return SLOTS_MESSAGE
    // Reported on the first roster field, and only once every field is a valid count.
    if (field === ROSTER_FIELDS[0] && rosterIsEmpty(d)) return ROSTER_EMPTY_MESSAGE
    return undefined
  }
  const value = d.scoring[field.slice(SCORING_FIELD_PREFIX.length)]
  return isPoints(value) ? undefined : POINTS_MESSAGE
}

function rosterIsEmpty(d: LeagueDraft): boolean {
  let total = 0
  for (const p of ROSTER_POSITIONS) {
    const v = d.roster[p.key]
    if (!isSlotCount(v)) return false
    total += Number(v)
  }
  return total === 0
}

/** Pure. Validates the fields of one step on the normalized draft. */
export function validateStep(draft: LeagueDraft, step: StepId): FieldErrors {
  const d = normalizeDraft(draft)
  const errors: FieldErrors = {}
  for (const field of fieldsFor(step)) {
    const message = validateField(field, d)
    if (message) errors[field] = message
  }
  return errors
}

/** Pure. Validates every step. */
export function validateDraft(draft: LeagueDraft): FieldErrors {
  const errors: FieldErrors = {}
  for (const { id } of STEPS) Object.assign(errors, validateStep(draft, id))
  return errors
}

/** First step in step order with an invalid field, or null when the draft is valid. */
export function firstInvalidStep(draft: LeagueDraft): StepId | null {
  for (const { id } of STEPS) {
    if (Object.keys(validateStep(draft, id)).length > 0) return id
  }
  return null
}
