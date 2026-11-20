import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { LeagueDraft } from './leagueDraft'
import { FIELD_STEP, validateDraft } from './leagueValidation'
import { buildReviewSummary } from './reviewSummary'

/**
 * Property 12: Review marks exactly the invalid groups and edit returns to the owning step
 * **Validates: Requirements 7.3, 7.5**
 */
const FORMATS = ['Redraft', 'Guillotine', 'Dynasty'] as const

const draftArb: fc.Arbitrary<LeagueDraft> = fc.record({
  format: fc.option(fc.oneof(fc.constantFrom(...FORMATS), fc.string({ maxLength: 8 })), {
    nil: null,
  }),
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
        const errors = validateDraft(draft, FORMATS)
        const groups = buildReviewSummary(draft, FORMATS)
        for (const g of groups) {
          expect(g.invalid).toBe(errors[g.field] !== undefined)
          if (g.invalid) expect(g.error).toBe(errors[g.field])
          else expect(g.error).toBeUndefined()
        }
      }),
      { numRuns: 200 },
    )
  })

  it('maps every group to the step owning its field', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        for (const g of buildReviewSummary(draft, FORMATS)) {
          expect(g.step).toBe(FIELD_STEP[g.field])
        }
      }),
      { numRuns: 200 },
    )
  })
})
