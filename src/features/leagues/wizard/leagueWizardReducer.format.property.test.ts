import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createInitialState, wizardReducer } from './leagueWizardReducer'
import type { LeagueDraft } from './leagueDraft'

const formatArb = fc.constantFrom('Guillotine', 'Redraft', 'Dynasty')

const draftArb: fc.Arbitrary<LeagueDraft> = fc.record({
  format: fc.oneof(fc.constant(null), formatArb),
  name: fc.string({ maxLength: 40 }),
  description: fc.string({ maxLength: 40 }),
  teamCount: fc.string({ maxLength: 5 }),
  visibility: fc.constantFrom('private' as const, 'public' as const),
})

describe('leagueWizardReducer format selection properties', () => {
  // Feature: create-league-wizard-modal, Property 6: Format selection leaves exactly one format and keeps other fields
  /** **Validates: Requirements 1.1, 3.2, 3.3, 5.1, 5.2, 5.6** */
  it('SELECT_FORMAT sets the format and preserves every other field', () => {
    fc.assert(
      fc.property(formatArb, draftArb, formatArb, (initialFormat, draft, selected) => {
        const base = createInitialState(initialFormat)
        const state = { ...base, draft }
        const next = wizardReducer(state, { type: 'SELECT_FORMAT', format: selected })

        expect(next.draft.format).toBe(selected)
        expect({ ...next.draft, format: null }).toEqual({ ...draft, format: null })
        expect(next.step).toBe(state.step)
        expect(next.phase).toBe(state.phase)
        expect(next.initial).toEqual(state.initial)
        // Pure: the input state is untouched.
        expect(state.draft).toEqual(draft)
      }),
      { numRuns: 100 },
    )
  })

  it('selecting formats in sequence leaves only the last one selected', () => {
    fc.assert(
      fc.property(formatArb, fc.array(formatArb, { minLength: 1, maxLength: 8 }), (init, picks) => {
        const final = picks.reduce(
          (s, format) => wizardReducer(s, { type: 'SELECT_FORMAT', format }),
          createInitialState(init),
        )
        expect(final.draft.format).toBe(picks[picks.length - 1])
      }),
      { numRuns: 100 },
    )
  })
})
