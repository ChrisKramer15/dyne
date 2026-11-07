import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, act, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import { renderApp } from './testUtils'

afterEach(cleanup)

// Feature: app-routing, Property 7: Redirects replace history
// **Validates: Requirements 2.5, 8.1, 8.3**
describe('Feature: app-routing, Property 7: Redirects replace history', () => {
  const cases = [
    { status: 'unauthenticated', from: '/home', to: '/' },
    { status: 'recovering', from: '/home', to: '/' },
    { status: 'authenticated', from: '/', to: '/home' },
  ] as const

  const suffix = fc.stringMatching(/^[a-z0-9]{0,8}$/)

  it('replaces the redirecting entry instead of pushing it', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...cases),
        suffix,
        suffix,
        async ({ status, from, to }, q, h) => {
          const search = q ? `?${q}` : ''
          const hash = h ? `#${h}` : ''
          const app = renderApp({ status, path: from, search, hash })
          try {
            await waitFor(() => expect(app.location().pathname).toBe(to))

            // Single-entry stack: going back must not reveal the redirecting path.
            await act(async () => {
              await app.router.navigate(-1)
            })
            expect(app.location().pathname).toBe(to)
            expect(app.location().pathname).not.toBe(from)
          } finally {
            app.unmount()
            app.router.dispose()
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('keeps the previous entry as the only one behind a redirected push', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('unauthenticated', 'recovering'), async (status) => {
        const app = renderApp({ status, path: '/' })
        try {
          await waitFor(() => expect(app.location().pathname).toBe('/'))
          const visited: string[] = []
          const unsubscribe = app.router.subscribe((s) => visited.push(s.location.pathname))

          await act(async () => {
            await app.router.navigate('/home')
          })
          await waitFor(() => expect(app.location().pathname).toBe('/'))

          // Back once more must not land on /home.
          await act(async () => {
            await app.router.navigate(-1)
          })
          unsubscribe()
          expect(app.location().pathname).toBe('/')
          expect(visited.at(-1)).toBe('/')
        } finally {
          app.unmount()
          app.router.dispose()
        }
      }),
      { numRuns: 100 },
    )
  })
})
