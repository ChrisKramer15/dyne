import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { normalizeDraft, type LeagueDraft } from './leagueDraft'
import { validateDraft } from './leagueValidation'
import { rosterArb, scoringArb } from './draftArbitraries.testutil'

const paddedArb = fc.oneof(
  fc.string({ maxLength: 60 }),
  fc
    .tuple(
      fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 4 }),
      fc.string({ maxLength: 30 }),
      fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 4 }),
    )
    .map(([a, s, b]) => a.join('') + s + b.join('')),
)

const draftArb: fc.Arbitrary<LeagueDraft> = fc.record({
  format: fc.constantFrom('Guillotine', 'Redraft', 'Unknown'),
  name: paddedArb,
  teamCount: fc.oneof(paddedArb, fc.integer({ min: 0, max: 30 }).map((n) => ` ${n} `)),
  roster: rosterArb,
  scoring: scoringArb,
})

describe('leagueDraft properties', () => {
  // Feature: create-league-wizard-modal, Property 5: Normalization is idempotent and preserves validity
  /** **Validates: Requirements 11.2** */
  it('normalizeDraft is idempotent, pure, and preserves validity', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        const snapshot = { ...draft }
        const once = normalizeDraft(draft)
        expect(draft).toEqual(snapshot)
        expect(normalizeDraft(once)).toEqual(once)
        expect(once.format).toBe(draft.format)
        expect(validateDraft(once)).toEqual(validateDraft(draft))
      }),
      { numRuns: 100 },
    )
  })
})
