import { cleanup, screen } from '@testing-library/react'
import fc from 'fast-check'
import { afterEach, describe, it } from 'vitest'
import { renderApp, type AuthStatus } from './testUtils'

afterEach(cleanup)

// Paths that match a known route (ignoring trailing slashes / case) are excluded.
const unknownPath = fc.webPath().filter((p) => {
  const normalized = p.replace(/\/+$/, '').toLowerCase()
  return normalized !== '' && normalized !== '/home'
})

async function snapshot(status: AuthStatus, path: string) {
  const { container, unmount } = renderApp({ status, path })
  const heading = await screen.findByRole('heading', { level: 1, name: 'Page not found' })
  const link = screen.getByRole('link', { name: 'Go to Dyne' })
  const result = {
    heading: heading.textContent,
    linkText: link.textContent,
    linkHref: link.getAttribute('href'),
    html: container.innerHTML,
  }
  unmount()
  return result
}

describe('Feature: app-routing, Property 8: Unknown paths render the same Not_Found_View', () => {
  /** **Validates: Requirements 7.1, 7.6** */
  it('renders identical Not_Found_View content for authenticated and unauthenticated users', async () => {
    await fc.assert(
      fc.asyncProperty(unknownPath, async (path) => {
        const anon = await snapshot('unauthenticated', path)
        const authed = await snapshot('authenticated', path)
        return (
          anon.heading === 'Page not found' &&
          anon.linkText === 'Go to Dyne' &&
          anon.html === authed.html &&
          anon.heading === authed.heading &&
          anon.linkText === authed.linkText &&
          anon.linkHref === authed.linkHref
        )
      }),
      { numRuns: 100 },
    )
  })
})
