import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { STEPS } from './leagueDraft'
import type { StepId } from './leagueDraft'
import { validateStep, FIELD_ORDER } from './leagueValidation'
import { createInitialState, wizardReducer } from './leagueWizardReducer'
import type { WizardState } from './leagueWizardReducer'

const FORMATS = ['Redraft', 'Dynasty', 'Guillotine']

const draftPatchArb = fc.record({
  format: fc.oneof(fc.constantFrom(...FORMATS), fc.constant(null), fc.string({ maxLength: 10 })),
  name: fc.oneof(fc.string({ maxLength: 60 }), fc.constantFrom('My League', 'ab', '  ')),
  description: fc.string({ maxLength: 300 }),
  teamCount: fc.oneof(fc.string({ maxLength: 5 }), fc.constantFrom('4', '8', '10', '12', '16', '0')),
  visibility: fc.constantFrom('private' as const, 'public' as const),
})

const stepArb = fc.constantFrom(...STEPS.map((s) => s.id).filter((id) => id !== 'review')) as fc.Arbitrary<StepId>

describe('Property 7: Next advances exactly when the step is valid', () => {
  /**
   * **Validates: Requirements 2.6, 4.7, 6.1, 6.2**
   */
  it('advances one step iff the current step has no errors; otherwise stays, marks attempted, focuses first invalid field', () => {
    fc.assert(
      fc.property(draftPatchArb, stepArb, (patch, step) => {
        const base = createInitialState('Redraft')
        const start: WizardState = { ...base, step, draft: { ...base.draft, ...patch } }
        const errors = validateStep(start.draft, step, FORMATS)
        const next = wizardReducer(start, { type: 'NEXT' }, FORMATS)
        const idx = STEPS.findIndex((s) => s.id === step)

        if (Object.keys(errors).length === 0) {
          expect(next.step).toBe(STEPS[idx + 1].id)
          expect(next.attempted.has(step)).toBe(false)
          expect(next.focusTarget).toEqual({ kind: 'heading' })
        } else {
          expect(next.step).toBe(step)
          expect(next.attempted.has(step)).toBe(true)
          const first = FIELD_ORDER[step].find((f) => errors[f] !== undefined)
          expect(next.focusTarget).toEqual({ kind: 'field', field: first })
        }
        expect(next.draft).toEqual(start.draft)
      }),
    )
  })
})
