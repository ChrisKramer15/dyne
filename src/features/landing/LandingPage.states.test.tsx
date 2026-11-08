import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import { AuthContext } from '../../auth/authContext'
import type { AuthState } from '../../auth/authReducer'
import LandingPage from './LandingPage'

const authStateArb: fc.Arbitrary<AuthState> = fc.oneof(
  fc.constant<AuthState>({ status: 'loading' }),
  fc.constant<AuthState>({ status: 'unauthenticated' }),
)

describe('LandingPage states', () => {
  // Feature: landing-page, Property 5: Controls are exclusive to auth state
  // **Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2, 6.2, 7.3**
  it('shows exactly the controls for the current auth state', () => {
    fc.assert(
      fc.property(authStateArb, (state) => {
        const { container, unmount } = render(
          <AuthContext.Provider value={state}>
            <LandingPage />
          </AuthContext.Provider>,
        )
        try {
          // Auth controls live in the call-to-action slot; the four base
          // buttons on the diamond are feature previews, shown in every state.
          const buttons = Array.from(container.querySelectorAll('.cta button')).map(
            (b) => b.textContent,
          )
          expect(container.querySelectorAll('.base-btn')).toHaveLength(4)
          const welcome = container.querySelector('.welcome')
          const loading = container.querySelector('[role="status"]')

          expect(container.querySelectorAll('h1')).toHaveLength(1)

          if (state.status === 'loading') {
            expect(loading).not.toBeNull()
            expect(welcome).toBeNull()
            expect(buttons).toEqual([])
          } else {
            expect(buttons).toEqual(['Play Ball'])
            expect(welcome).toBeNull()
            expect(loading).toBeNull()
          }
        } finally {
          unmount()
        }
      }),
      { numRuns: 100 },
    )
  })
})
