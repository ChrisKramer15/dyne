import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { firstInvalidStep } from './leagueValidation'
import { createInitialState, wizardReducer } from './leagueWizardReducer'
import type { WizardState } from './leagueWizardReducer'


const draftPatchArb = fc.record({
  format: fc.oneof(fc.constantFrom('Redraft', 'Dynasty', 'Guillotine'), fc.string({ maxLength: 10 })),
  name: fc.oneof(fc.string({ maxLength: 60 }), fc.constantFrom('My League', 'ab', '  ')),
  description: fc.string({ maxLength: 300 }),
  teamCount: fc.oneof(fc.string({ maxLength: 5 }), fc.constantFrom('4', '8', '10', '12', '16', '0')),
  visibility: fc.constantFrom('private' as const, 'public' as const),
})

const validPatchArb = fc.record({
  format: fc.constantFrom('Redraft', 'Dynasty', 'Guillotine'),
  name: fc.constantFrom('My League', 'Sunday Funday'),
  description: fc.constantFrom('', 'A fun league'),
  teamCount: fc.constantFrom('4', '8', '10', '12', '16'),
  visibility: fc.constantFrom('private' as const, 'public' as const),
})

describe('Property 13: Submit is gated on whole-draft validity', () => {
  /**
   * **Validates: Requirements 8.1, 8.2**
   */
  it('submits only when every step is valid; otherwise returns to the first invalid step with its errors shown', () => {
    fc.assert(
      fc.property(fc.oneof(draftPatchArb, validPatchArb), (patch) => {
        const base = createInitialState('Redraft')
        const start: WizardState = { ...base, step: 'review', draft: { ...base.draft, ...patch } }
        const invalid = firstInvalidStep(start.draft)
        const next = wizardReducer(start, { type: 'SUBMIT' })

        if (invalid === null) {
          expect(next.phase).toBe('submitting')
          expect(next.step).toBe('review')
        } else {
          expect(next.phase).toBe('editing')
          expect(next.step).toBe(invalid)
          expect(next.attempted.has(invalid)).toBe(true)
        }
        expect(next.draft).toEqual(start.draft)
      }),
    )
  })
})
