import { describe, it, expect, afterEach } from 'vitest'
import { screen, cleanup, waitFor } from '@testing-library/react'
import fc from 'fast-check'
// testUtils must be imported before routes (it installs the Supabase mock).
import { renderApp, authStateFor, type AuthStatus } from './testUtils'

type View = 'pending' | 'home' | 'landing' | 'notFound' | 'none'

const STATUSES = ['loading', 'unauthenticated', 'authenticated', 'recovering'] as const

const statusArb = fc.constantFrom<AuthStatus>(...STATUSES)

const normalize = (p: string) => p.replace(/\/+$/, '').toLowerCase()
const unknownPathArb = fc
  .webPath()
  .map((p) => (p.startsWith('/') ? p : `/${p}`))
  .filter((p) => !['', '/home', '/leagues', '/profile'].includes(normalize(p)))
const pathArb = fc.oneof(fc.constant('/'), fc.constant('/home'), unknownPathArb)

/**
 * True once the view has stopped changing on its own. `pending` is only final
 * while auth is loading; for other statuses it is the Suspense fallback shown
 * while a lazy-loaded page downloads.
 */
function isSettled(status: AuthStatus): boolean {
  const view = currentView()
  return status === 'loading' ? view !== 'none' : view !== 'none' && view !== 'pending'
}

function currentView(): View {
  if (screen.queryByRole('heading', { level: 2, name: 'Alerts' })) return 'home'
  if (screen.queryByRole('heading', { name: 'Page not found' })) return 'notFound'
  if (screen.queryByRole('heading', { name: 'Dyne' })) return 'landing'
  if (screen.queryByRole('status') && screen.queryAllByRole('heading').length === 0) return 'pending'
  return 'none'
}

const hasUpdatePasswordDialog = () =>
  !!screen.queryByRole('dialog') &&
  !!screen.queryByRole('heading', { name: 'Choose a new password' })

const runs = { numRuns: 100 }

afterEach(() => cleanup())

describe('router properties (app-routing)', () => {
  it('Property 1: loading keeps the location and renders only the pending view', async () => {
    // **Validates: Requirements 2.2, 3.6, 4.3, 11.2**
    await fc.assert(
      fc.asyncProperty(pathArb, async (path) => {
        const app = renderApp({ status: 'loading', path })
        try {
          expect(app.currentUrl()).toBe(path)
          expect(currentView()).toBe('pending')
          expect(screen.queryByRole('heading')).toBeNull()
          expect(screen.queryByRole('dialog')).toBeNull()
        } finally {
          app.unmount()
        }
      }),
      runs,
    )
  })

  it('Property 2: Homepage content appears iff authenticated and at /home', async () => {
    // **Validates: Requirements 3.1, 3.2, 3.3, 5.1, 11.3**
    await fc.assert(
      fc.asyncProperty(statusArb, pathArb, async (status, path) => {
        const app = renderApp({ status, path })
        try {
          await waitFor(() => expect(isSettled(status)).toBe(true))
          const homeShown = currentView() === 'home'
          expect(homeShown).toBe(status === 'authenticated' && app.location().pathname === '/home')
          // Authenticated at "/" is redirected to /home, so Home shows there too.
          expect(homeShown).toBe(
            status === 'authenticated' && (path === '/home' || path === '/'),
          )
        } finally {
          app.unmount()
        }
      }),
      runs,
    )
  })

  it('Property 3: recovering shows Landing with the update-password dialog and no Homepage', async () => {
    // **Validates: Requirements 4.1, 8.8, 11.4**
    await fc.assert(
      fc.asyncProperty(pathArb, async (path) => {
        const app = renderApp({ status: 'recovering', path })
        try {
          await waitFor(() => expect(currentView()).toBe('landing'))
          expect(hasUpdatePasswordDialog()).toBe(true)
          expect(screen.queryByRole('heading', { level: 2, name: 'Alerts' })).toBeNull()
        } finally {
          app.unmount()
        }
      }),
      runs,
    )
  })

  it('Property 4: an unknown status behaves as unauthenticated', async () => {
    // **Validates: Requirements 3.6, 7.4, 7.5**
    await fc.assert(
      fc.asyncProperty(pathArb, async (path) => {
        const unknown = renderApp({
          authState: { status: 'bogus' } as unknown as ReturnType<typeof authStateFor>,
          path,
        })
        const unknownView = await waitFor(() => {
          expect(currentView()).not.toBe('none')
          return currentView()
        })
        const unknownUrl = unknown.currentUrl()
        unknown.unmount()

        const baseline = renderApp({ status: 'unauthenticated', path })
        try {
          await waitFor(() => expect(currentView()).not.toBe('none'))
          expect(unknownView).toBe(currentView())
          expect(unknownUrl).toBe(baseline.currentUrl())
          expect(screen.queryByRole('heading', { level: 2, name: 'Alerts' })).toBeNull()
        } finally {
          baseline.unmount()
        }
      }),
      runs,
    )
  })

  it('Property 5: authenticated at / ends at /home and never renders Landing', async () => {
    // **Validates: Requirements 5.1, 5.3**
    await fc.assert(
      fc.asyncProperty(fc.constant('/'), async (path) => {
        const app = renderApp({ status: 'authenticated', path })
        try {
          await waitFor(() => expect(app.location().pathname).toBe('/home'))
          await waitFor(() => expect(currentView()).toBe('home'))
          expect(screen.queryByRole('button', { name: 'Play Ball' })).toBeNull()
        } finally {
          app.unmount()
        }
      }),
      { numRuns: 100 },
    )
  })

  it('Property 6: mounting twice gives the same view and final location', async () => {
    // **Validates: Requirements 2.2, 7.4**
    await fc.assert(
      fc.asyncProperty(statusArb, pathArb, async (status, path) => {
        const results: Array<{ view: View; url: string; dialog: boolean }> = []
        for (let i = 0; i < 2; i++) {
          const app = renderApp({ status, path })
          try {
            await waitFor(() => expect(isSettled(status)).toBe(true))
            results.push({
              view: currentView(),
              url: app.currentUrl(),
              dialog: hasUpdatePasswordDialog(),
            })
          } finally {
            app.unmount()
          }
        }
        expect(results[1]).toEqual(results[0])
      }),
      runs,
    )
  })
})
