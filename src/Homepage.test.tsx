import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fc from 'fast-check'
import Homepage from './Homepage'
import { formatWelcome, getDisplayName } from './auth/displayName'
import type { AuthService } from './auth/authService'

const fakeService = {
  signOut: async () => {},
} as unknown as AuthService

function renderWelcome(metadata: unknown): string {
  const { container } = render(<Homepage userMetadata={metadata} authService={fakeService} />)
  const text = container.querySelector('.welcome')?.textContent ?? ''
  cleanup()
  return text
}

describe('Homepage', () => {
  describe('welcome text (Property 3)', () => {
    // Feature: authenticated-homepage, Property 3: Homepage welcome reflects metadata without leaking null or undefined
    // **Validates: Requirements 1.5, 1.6**
    it('equals formatWelcome(metadata) for arbitrary metadata and never leaks null/undefined', () => {
      fc.assert(
        fc.property(fc.anything(), (metadata) => {
          const text = renderWelcome(metadata)
          expect(text).toBe(formatWelcome(metadata))
          if (getDisplayName(metadata) === '') {
            expect(text).toBe('Welcome Back')
          }
          expect(text.startsWith('Welcome Back')).toBe(true)
        }),
        { numRuns: 100 },
      )
    })

    // **Validates: Requirements 1.5, 1.6**
    it('reflects username metadata, including non-string and blank usernames', () => {
      const usernames = fc.oneof(
        fc.string(),
        fc.constant(undefined),
        fc.constant(null),
        fc.integer(),
        fc.boolean(),
        fc.array(fc.string()),
        fc.constant('   '),
      )
      fc.assert(
        fc.property(usernames, fc.dictionary(fc.string(), fc.anything()), (username, extra) => {
          const metadata = { ...extra, username }
          const text = renderWelcome(metadata)
          expect(text).toBe(formatWelcome(metadata))
          if (typeof username !== 'string' || username.trim() === '') {
            expect(text).toBe('Welcome Back')
            expect(text).not.toMatch(/undefined|null/)
          }
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('repeated sign-out activation (Property 4)', () => {
    // Feature: authenticated-homepage, Property 4: Repeated activation sends exactly one sign-out request
    // **Validates: Requirements 4.2, 4.3**
    it('sends exactly one signOut request however many times the button is activated while pending', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 20 }), async (clicks) => {
          let calls = 0
          let resolve!: () => void
          const deferred = new Promise<void>((r) => {
            resolve = r
          })
          const service = {
            signOut: () => {
              calls += 1
              return deferred
            },
          } as unknown as AuthService

          render(<Homepage userMetadata={{}} authService={service} />)
          const button = screen.getByRole('button') as HTMLButtonElement
          for (let i = 0; i < clicks; i++) fireEvent.click(button)

          await waitFor(() => expect(calls).toBe(1))
          expect(button.disabled).toBe(true)
          for (let i = 0; i < clicks; i++) fireEvent.click(button)
          await Promise.resolve()
          expect(calls).toBe(1)

          resolve()
          await waitFor(() => expect(button.disabled).toBe(false))
          expect(calls).toBe(1)
          cleanup()
        }),
        { numRuns: 50 },
      )
    })
  })
})

describe('Homepage structure and accessibility', () => {
  afterEach(() => cleanup())

  // **Validates: Requirements 1.4**
  it('renders exactly one level-one heading named Homepage', () => {
    render(<Homepage userMetadata={{}} authService={fakeService} />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0].textContent).toBe('Homepage')
  })

  // **Validates: Requirements 1.7**
  it('renders exactly one main landmark', () => {
    render(<Homepage userMetadata={{}} authService={fakeService} />)
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  // **Validates: Requirements 4.1, 8.8**
  it('gives every interactive control a non-empty accessible name', () => {
    render(<Homepage userMetadata={{}} authService={fakeService} />)
    const controls = screen.getAllByRole('button')
    expect(controls.length).toBeGreaterThan(0)
    for (const c of controls) {
      expect(c.getAttribute('aria-label') ?? c.textContent?.trim()).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  // **Validates: Requirements 8.5**
  it('reaches the Sign out button with Tab, in order, and it is the only tab stop', async () => {
    const user = userEvent.setup()
    render(<Homepage userMetadata={{}} authService={fakeService} />)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sign out' }))
    await user.tab()
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Sign out' }))
  })

  // **Validates: Requirements 4.7**
  it('removes the previous alert before sending a retry', async () => {
    let call = 0
    let alertDuringRetry: boolean | undefined
    let finish!: () => void
    const service = {
      signOut: () => {
        call += 1
        if (call === 1) return Promise.reject(new Error('fail'))
        alertDuringRetry = screen.queryByRole('alert') !== null
        return new Promise<void>((r) => {
          finish = r
        })
      },
    } as unknown as AuthService

    render(<Homepage userMetadata={{}} authService={service} />)
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('alert')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(call).toBe(2))
    expect(alertDuringRetry).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => finish())
  })
})

describe('Homepage sign-out failure recovery (Property 5)', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const failure = fc.oneof(
    fc.constant<'reject-error'>('reject-error'),
    fc.constant<'reject-value'>('reject-value'),
    fc.constant<'throw'>('throw'),
    fc.constant<'timeout'>('timeout'),
  )

  // Feature: authenticated-homepage, Property 5: Sign-out failure is recoverable
  // **Validates: Requirements 4.5, 4.6**
  it('shows the alert and re-enables the Sign out button after any rejection or timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        failure,
        fc.integer({ min: 1, max: 60_000 }),
        fc.string(),
        async (kind, timeoutMs, reason) => {
          vi.useFakeTimers()
          const service = {
            signOut: () => {
              if (kind === 'reject-error') return Promise.reject(new Error(reason))
              if (kind === 'reject-value') return Promise.reject(reason)
              if (kind === 'throw') throw new Error(reason)
              return new Promise<void>(() => {}) // never settles
            },
          } as unknown as AuthService

          render(
            <Homepage userMetadata={{}} authService={service} signOutTimeoutMs={timeoutMs} />,
          )
          const button = screen.getByRole('button') as HTMLButtonElement
          fireEvent.click(button)

          await act(async () => {
            await vi.advanceTimersByTimeAsync(kind === 'timeout' ? timeoutMs : 0)
          })

          const alert = screen.getByRole('alert')
          expect(alert.textContent).toBe('Sign out failed. Please try again.')
          expect(button.disabled).toBe(false)
          expect(button.textContent).toBe('Sign out')

          cleanup()
          vi.useRealTimers()
        },
      ),
      { numRuns: 50 },
    )
  })
})
