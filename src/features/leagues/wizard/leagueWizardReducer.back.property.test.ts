import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { STEPS } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'
import { rosterArb, scoringArb } from './draftArbitraries.testutil'
import { wizardReducer } from './leagueWizardReducer'
import type { WizardState } from './leagueWizardReducer'

const stepArb = fc.constantFrom(...STEPS.map((s) => s.id))

const draftArb: fc.Arbitrary<LeagueDraft> = fc.record({
  format: fc.constantFrom('Guillotine', 'Redraft', 'Unknown'),
  name: fc.string({ maxLength: 60 }),
  teamCount: fc.oneof(fc.string({ maxLength: 6 }), fc.integer({ min: 0, max: 30 }).map(String)),
  roster: rosterArb,
  scoring: scoringArb,
})

const stateArb: fc.Arbitrary<WizardState> = fc
  .record({
    step: stepArb,
    draft: draftArb,
    initial: draftArb,
    attempted: fc.uniqueArray(stepArb),
  })
  .map((r) => ({
    ...r,
    attempted: new Set<StepId>(r.attempted),
    phase: 'editing' as const,
    message: null,
    focusTarget: null,
  }))

const num = (id: StepId) => STEPS.findIndex((s) => s.id === id) + 1

describe('leagueWizardReducer back/indicator properties', () => {
  // Feature: create-league-wizard-modal, Property 8: Back and Indicator navigation never validate or alter the draft
  /** **Validates: Requirements 6.3, 6.6, 6.8** */
  it('BACK moves to the previous step and never alters the draft', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        const draftBefore = structuredClone(s.draft)
        const next = wizardReducer(s, { type: 'BACK' })
        const expected = Math.max(1, num(s.step) - 1)
        expect(num(next.step)).toBe(expected)
        expect(next.draft).toEqual(draftBefore)
        expect(next.attempted).toEqual(s.attempted)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: create-league-wizard-modal, Property 8: Back and Indicator navigation never validate or alter the draft
  /** **Validates: Requirements 6.3, 6.6, 6.8** */
  it('GO_TO moves only to lower-numbered steps, otherwise no-op, and never alters the draft', () => {
    fc.assert(
      fc.property(stateArb, stepArb, (s, target) => {
        const draftBefore = structuredClone(s.draft)
        const next = wizardReducer(s, { type: 'GO_TO', step: target })
        const expected = num(target) < num(s.step) ? target : s.step
        expect(next.step).toBe(expected)
        expect(next.draft).toEqual(draftBefore)
        if (num(target) >= num(s.step)) expect(next).toEqual(s)
      }),
      { numRuns: 100 },
    )
  })
})
