import { normalizeDraft } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'
import { FIELD_STEP, validateDraft } from './leagueValidation'
import type { FieldName } from './leagueValidation'

export interface ReviewGroup {
  field: FieldName
  label: string
  value: string
  /** Step that owns the field; the Review "Edit" control returns here. */
  step: StepId
  invalid: boolean
  error?: string
}

export const NO_DESCRIPTION_PLACEHOLDER = 'No description provided'

const GROUPS: readonly { field: FieldName; label: string }[] = [
  { field: 'format', label: 'Format' },
  { field: 'name', label: 'Name' },
  { field: 'description', label: 'Description' },
  { field: 'teamCount', label: 'Team count' },
  { field: 'visibility', label: 'Visibility' },
]

function displayValue(field: FieldName, d: LeagueDraft): string {
  switch (field) {
    case 'format':
      return d.format ?? ''
    case 'name':
      return d.name
    case 'description':
      return d.description === '' ? NO_DESCRIPTION_PLACEHOLDER : d.description
    case 'teamCount':
      return d.teamCount
    case 'visibility':
      return d.visibility === 'public' ? 'Public' : 'Private'
  }
}

/** Pure. Builds the review groups in display order from the normalized draft. */
export function buildReviewSummary(draft: LeagueDraft, formats?: readonly string[]): ReviewGroup[] {
  const d = normalizeDraft(draft)
  const errors = validateDraft(draft, formats)
  return GROUPS.map(({ field, label }) => {
    const error = errors[field]
    const group: ReviewGroup = {
      field,
      label,
      value: displayValue(field, d),
      step: FIELD_STEP[field],
      invalid: error !== undefined,
    }
    if (error !== undefined) group.error = error
    return group
  })
}
