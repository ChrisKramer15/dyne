import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { LeagueDraft } from './leagueDraft'
import { FIELD_STEP, validateDraft } from './leagueValidation'
import { buildReviewSummary } from './reviewSummary'

/**
 * Property 12: Review marks exactly the invalid groups and edit returns to the owning step
 * **Validates: Requirements 7.3, 7.5**
 */

const draftArb: fc.Arbitrary<LeagueDraft> = fc.record({
  format: fc.oneof(fc.constantFrom('Redraft', 'Guillotine', 'Dynasty'), fc.string({ maxLength: 8 })),
  name: fc.oneof(fc.string({ maxLength: 60 }), fc.string({ minLength: 51, maxLength: 70 })),
  description: fc.oneof(fc.string({ maxLength: 20 }), fc.string({ minLength: 281, maxLength: 300 })),
  teamCount: fc.oneof(
    fc.integer({ min: -2, max: 25 }).map(String),
    fc.string({ maxLength: 4 }),
  ),
  visibility: fc.constantFrom('private' as const, 'public' as const),
})

describe('Property 12: review groups', () => {
  it('flags exactly the invalid fields, each with an error message', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        const errors = validateDraft(draft)
        const groups = buildReviewSummary(draft)
        for (const g of groups) {
          const error = g.field === 'format' ? undefined : errors[g.field]
          expect(g.invalid).toBe(error !== undefined)
          if (g.invalid) expect(g.error).toBe(error)
          else expect(g.error).toBeUndefined()
        }
      }),
      { numRuns: 200 },
    )
  })

  it('maps every group to the step owning its field', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        for (const g of buildReviewSummary(draft)) {
          expect(g.step).toBe(g.field === 'format' ? null : FIELD_STEP[g.field])
        }
      }),
      { numRuns: 200 },
    )
  })
})
