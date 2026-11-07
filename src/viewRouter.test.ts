import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { selectView } from './viewRouter'
import type { AuthState } from './auth/authReducer'

describe('selectView properties', () => {
  /**
   * Feature: authenticated-homepage, Property 1: View selection is total and Homepage appears only when authenticated
   * **Validates: Requirements 1.1, 5.2, 6.2, 7.1, 7.2, 7.5, 7.6**
   */
  it('is total and returns home iff authenticated, loading iff loading, else landing', () => {
    const statusArb = fc.oneof(
      fc.constantFrom('loading', 'unauthenticated', 'authenticated', 'recovering'),
      fc.string(),
    )
    fc.assert(
      fc.property(statusArb, (status) => {
        const view = selectView({ status } as unknown as Pick<AuthState, 'status'>)
        expect(['loading', 'landing', 'home']).toContain(view)
        expect(view === 'home').toBe(status === 'authenticated')
        expect(view === 'loading').toBe(status === 'loading')
        if (status !== 'authenticated' && status !== 'loading') {
          expect(view).toBe('landing')
        }
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Feature: authenticated-homepage, Property 2: View selection is idempotent
   * **Validates: Requirements 7.4**
   */
  it('returns the same view for the same state on repeated calls', () => {
    const statusArb = fc.oneof(
      fc.constantFrom('loading', 'unauthenticated', 'authenticated', 'recovering'),
      fc.string(),
    )
    fc.assert(
      fc.property(statusArb, (status) => {
        const state = { status } as unknown as Pick<AuthState, 'status'>
        const first = selectView(state)
        expect(selectView(state)).toBe(first)
        expect(selectView({ ...state })).toBe(first)
      }),
      { numRuns: 100 },
    )
  })
})
