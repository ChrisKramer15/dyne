import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import fc from 'fast-check'
import type { AuthState } from './auth/authReducer'

const mocks = vi.hoisted(() => ({ state: { status: 'loading' } as AuthState }))

vi.mock('./auth/useAuthState', () => ({
  useAuthState: () => mocks.state,
}))

import LandingPage from './LandingPage'
import { formatWelcome } from './auth/displayName'

afterEach(cleanup)

// Feature: landing-page, Property 3: Display name is rendered as plain text
describe('LandingPage plain-text rendering', () => {
  it('renders any username as plain text with no child elements', () => {
    // **Validates: Requirements 5.5**
    const markup = fc.constantFrom(
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<b>bold</b>',
      '&amp; &lt;',
      '"quoted" \'single\'',
    )
    const username = fc.oneof(
      fc.string(),
      fc.string({ unit: 'binary' }),
      fc.tuple(fc.string(), markup, fc.string()).map(([a, m, b]) => a + m + b),
    )

    fc.assert(
      fc.property(username, (name) => {
        const metadata = { username: name }
        mocks.state = { status: 'authenticated', userMetadata: metadata }
        const { container, unmount } = render(<LandingPage />)
        const welcome = container.querySelector('.welcome')
        expect(welcome).not.toBeNull()
        expect(welcome!.textContent).toBe(formatWelcome(metadata))
        expect(welcome!.children.length).toBe(0)
        expect(container.querySelector('main script, main img')).toBeNull()
        unmount()
      }),
      { numRuns: 100 },
    )
  })
})
