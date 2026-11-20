import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { STEPS } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'
import { wizardReducer } from './leagueWizardReducer'
import type { WizardPhase, WizardState } from './leagueWizardReducer'

const stepArb = fc.constantFrom(...STEPS.map((s) => s.id))

const draftArb: fc.Arbitrary<LeagueDraft> = fc.record({
  format: fc.oneof(fc.constant(null), fc.constantFrom('Guillotine', 'Redraft', 'Unknown')),
  name: fc.string({ maxLength: 60 }),
  description: fc.string({ maxLength: 60 }),
  teamCount: fc.oneof(fc.string({ maxLength: 6 }), fc.integer({ min: 0, max: 30 }).map(String)),
  visibility: fc.constantFrom('private' as const, 'public' as const),
})

const stateWith = (phase: WizardPhase): fc.Arbitrary<WizardState> =>
  fc
    .record({
      step: stepArb,
      draft: draftArb,
      initial: draftArb,
      sameAsInitial: fc.boolean(),
      attempted: fc.uniqueArray(stepArb),
      message: fc.oneof(fc.constant(null), fc.string()),
    })
    .map((r) => ({
      step: r.step,
      draft: r.sameAsInitial ? { ...r.initial } : r.draft,
      initial: r.initial,
      attempted: new Set<StepId>(r.attempted),
      phase,
      message: r.message,
      focusTarget: null,
    }))

const equalDrafts = (a: LeagueDraft, b: LeagueDraft) =>
  JSON.stringify(a) === JSON.stringify(b)

describe('leagueWizardReducer close properties', () => {
  // Feature: create-league-wizard-modal, Property 15: Close requests respect submission and dirtiness
  /** **Validates: Requirements 8.3, 9.4** */
  it('REQUEST_CLOSE while submitting leaves the state unchanged', () => {
    fc.assert(
      fc.property(stateWith('submitting'), (s) => {
        expect(wizardReducer(s, { type: 'REQUEST_CLOSE' })).toEqual(s)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: create-league-wizard-modal, Property 15: Close requests respect submission and dirtiness
  /** **Validates: Requirements 9.5, 9.6** */
  it('REQUEST_CLOSE while editing closes iff the draft equals the initial draft', () => {
    fc.assert(
      fc.property(stateWith('editing'), (s) => {
        const next = wizardReducer(s, { type: 'REQUEST_CLOSE' })
        const clean = equalDrafts(s.draft, s.initial)
        expect(next.phase).toBe(clean ? 'closed' : 'confirming-close')
        expect(next.draft).toEqual(s.draft)
        expect(next.step).toBe(s.step)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: create-league-wizard-modal, Property 15: Close requests respect submission and dirtiness
  /** **Validates: Requirements 9.7** */
  it('KEEP_EDITING resumes editing and DISCARD closes from confirming-close', () => {
    fc.assert(
      fc.property(stateWith('confirming-close'), (s) => {
        const kept = wizardReducer(s, { type: 'KEEP_EDITING' })
        expect(kept.phase).toBe('editing')
        expect(kept.step).toBe(s.step)
        expect(kept.draft).toEqual(s.draft)
        expect(wizardReducer(s, { type: 'DISCARD' }).phase).toBe('closed')
      }),
      { numRuns: 100 },
    )
  })
})
