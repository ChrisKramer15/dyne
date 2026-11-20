import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { STEPS } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'
import { createInitialState, wizardReducer } from './leagueWizardReducer'
import type { WizardAction, WizardState } from './leagueWizardReducer'

const stepArb = fc.constantFrom(...STEPS.map((s) => s.id))
const num = (id: StepId) => STEPS.findIndex((s) => s.id === id)

/** Drafts that pass validation on every step, so NEXT always advances. */
const validDraftArb: fc.Arbitrary<LeagueDraft> = fc.record({
  format: fc.constantFrom('Guillotine', 'Redraft'),
  name: fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{0,30}$/),
  description: fc.string({ maxLength: 60 }),
  teamCount: fc.integer({ min: 6, max: 20 }).map(String),
  visibility: fc.constantFrom('private' as const, 'public' as const),
})

const forwardActionArb: fc.Arbitrary<WizardAction> = fc.oneof(
  fc.constant<WizardAction>({ type: 'NEXT' }),
  stepArb.map<WizardAction>((step) => ({ type: 'GO_TO', step })),
  stepArb.map<WizardAction>((step) => ({ type: 'EDIT_GROUP', step })),
  fc.constant<WizardAction>({ type: 'BACK' }),
)

describe('leagueWizardReducer navigation round trip', () => {
  // Feature: create-league-wizard-modal, Property 9: Navigation round trip preserves the draft
  /** **Validates: Requirements 6.5, 11.3** */
  it('navigating away and returning to the original step leaves the draft deeply equal', () => {
    fc.assert(
      fc.property(
        validDraftArb,
        stepArb,
        fc.array(forwardActionArb, { maxLength: 12 }),
        (draft, start, actions) => {
          const base = createInitialState('Guillotine')
          let s: WizardState = { ...base, draft, initial: draft, step: start }
          const original = structuredClone(draft)

          for (const a of actions) s = wizardReducer(s, a)

          // Return to the original step with BACK or GO_TO.
          if (num(s.step) > num(start)) {
            s = wizardReducer(s, { type: 'GO_TO', step: start })
          } else {
            while (num(s.step) < num(start)) s = wizardReducer(s, { type: 'NEXT' })
          }

          expect(s.step).toBe(start)
          expect(s.draft).toEqual(original)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: create-league-wizard-modal, Property 9: Navigation round trip preserves the draft
  /** **Validates: Requirements 6.5, 11.3** */
  it('forward then BACK returns to the original step with the same draft', () => {
    fc.assert(
      fc.property(validDraftArb, fc.constantFrom<StepId>('format', 'details', 'settings'), (draft, start) => {
        const base = createInitialState('Guillotine')
        const s0: WizardState = { ...base, draft, initial: draft, step: start }
        const forward = wizardReducer(s0, { type: 'NEXT' })
        expect(num(forward.step)).toBe(num(start) + 1)
        const back = wizardReducer(forward, { type: 'BACK' })
        expect(back.step).toBe(start)
        expect(back.draft).toEqual(draft)
      }),
      { numRuns: 100 },
    )
  })
})
