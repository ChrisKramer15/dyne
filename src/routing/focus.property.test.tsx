import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import { renderApp, type AuthStatus } from './testUtils'

// Feature: app-routing, Property 10: Settled views take focus and set the title
// **Validates: Requirements 10.1, 10.2, 10.4**

const settledStatuses: AuthStatus[] = ['unauthenticated', 'authenticated', 'recovering']

const unknownPath = fc
  .stringMatching(/^[a-z0-9]{1,12}$/)
  .filter((s) => s !== 'home' && s !== 'leagues')
  .map((s) => `/${s}`)

const paths = fc.oneof(fc.constant('/'), fc.constant('/home'), unknownPath)

afterEach(() => {
  cleanup()
  document.title = ''
  document.body.innerHTML = ''
})

/** Expected title for the view a (status, path) pair settles on. */
function expectedTitle(status: AuthStatus, path: string): string {
  // Recovery always shows the landing view; authenticated users leave '/'.
  if (status === 'recovering') return 'Dyne'
  if (path === '/' || path === '/home') return status === 'authenticated' ? 'Home – Dyne' : 'Dyne'
  return 'Page not found – Dyne'
}

describe('Property 10: settled views take focus and set the title', () => {
  it('focuses the h1 and sets a Dyne title for every settled view', async () => {
    const hits = { deferred: 0, applied: 0 }
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...settledStatuses), paths, async (status, path) => {
        cleanup()
        document.title = ''
        const app = renderApp({ status, path })

        // Recovery opens the reset dialog, and RouteEffects defers focus and
        // title while any [role="dialog"] is in the document. Actual behavior:
        // nothing is applied until the dialog closes, so only the non-dialog
        // contract (below) is asserted for views without a dialog.
        const dialogOpen = () => document.querySelector('[role="dialog"]') !== null

        await waitFor(() => {
          expect(document.querySelector('main h1')).not.toBeNull()
        })

        if (status === 'recovering' && dialogOpen()) {
          // Deferred: effects must not have moved focus onto the h1 yet.
          expect(document.activeElement).not.toBe(document.querySelector('main h1'))
          hits.deferred += 1
          app.unmount()
          return
        }

        const want = expectedTitle(status, path)
        await waitFor(() => {
          expect(document.activeElement).toBe(document.querySelector('main h1'))
          expect(document.title).toBe(want)
        })
        expect(document.title).toContain('Dyne')
        hits.applied += 1
        app.unmount()
      }),
      { numRuns: 100 },
    )
    // Both branches must actually be exercised, not just one.
    expect(hits.deferred).toBeGreaterThan(0)
    expect(hits.applied).toBeGreaterThan(0)
  })
})
