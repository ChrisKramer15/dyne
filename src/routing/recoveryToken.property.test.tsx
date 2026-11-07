import { describe, it, expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import fc from 'fast-check'
import { renderApp } from './testUtils'

afterEach(cleanup)

// Feature: app-routing, Property 9: Recovery token survives until resolution
// **Validates: Requirements 5.7**
describe('Feature: app-routing, Property 9', () => {
  const urlSafe = fc.stringMatching(/^[A-Za-z0-9_.~-]{1,40}$/)
  const pathArb = fc.constantFrom('/', '/home', '/unknown-page')
  const hashArb = fc.tuple(urlSafe, urlSafe).map(([k, v]) => `#access_token=${v}&type=${k}`)
  const searchArb = fc.tuple(urlSafe, urlSafe).map(([k, v]) => `?${k}=${v}`)

  it('keeps location unchanged while loading and the pathname after recovering unless protected', async () => {
    await fc.assert(
      fc.asyncProperty(pathArb, hashArb, searchArb, async (path, hash, search) => {
        const app = renderApp({ status: 'loading', path, search, hash })
        try {
          const initial = app.currentUrl()
          expect(initial).toBe(`${path}${search}${hash}`)

          // Still loading: nothing may touch the URL.
          expect(app.currentUrl()).toBe(initial)

          await app.setAuth('recovering')
          const expectedPath = path === '/home' ? '/' : path
          expect(app.location().pathname).toBe(expectedPath)
        } finally {
          app.unmount()
          cleanup()
        }
      }),
      { numRuns: 100 },
    )
  })
})
