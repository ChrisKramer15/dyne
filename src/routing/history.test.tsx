import { describe, it, expect, afterEach } from 'vitest'
import { screen, cleanup, act, waitFor } from '@testing-library/react'
// testUtils must be imported before routes (it installs the Supabase mock).
import { renderApp, type RenderAppResult } from './testUtils'

afterEach(cleanup)

const homepage = () => screen.queryByRole('heading', { level: 2, name: 'Alerts' })
const landing = () => (homepage() ? null : screen.queryByRole('heading', { name: 'Dyne' }))
const pending = () => screen.queryByRole('status') && screen.queryAllByRole('heading').length === 0

async function back(app: RenderAppResult) {
  await act(async () => {
    await app.router.navigate(-1)
  })
}

async function forward(app: RenderAppResult) {
  await act(async () => {
    await app.router.navigate(1)
  })
}

describe('history behaviour', () => {
  it('Back after redirecting an authenticated user away from "/" does not show the Landing_Page (8.1)', async () => {
    const app = renderApp({ status: 'authenticated', path: '/' })
    await waitFor(() => expect(app.location().pathname).toBe('/home'))
    expect(homepage()).not.toBeNull()

    await back(app)
    expect(app.location().pathname).toBe('/home')
    expect(landing()).toBeNull()
    expect(homepage()).not.toBeNull()

    // A pushed "/" is also redirected with replace, so Back never reveals it.
    await act(async () => {
      await app.router.navigate('/')
    })
    await waitFor(() => expect(app.location().pathname).toBe('/home'))
    await back(app)
    expect(app.location().pathname).toBe('/home')
    expect(landing()).toBeNull()
    app.router.dispose()
  })

  it('sign-out replaces the /home entry so Back does not show the Homepage (8.3)', async () => {
    const app = renderApp({ status: 'unauthenticated', path: '/' })
    await waitFor(() => expect(landing()).not.toBeNull())

    await app.setAuth('authenticated')
    await waitFor(() => expect(app.location().pathname).toBe('/home'))

    await app.setAuth('unauthenticated')
    await waitFor(() => expect(app.location().pathname).toBe('/'))
    expect(landing()).not.toBeNull()

    await back(app)
    expect(app.location().pathname).toBe('/')
    expect(homepage()).toBeNull()
    expect(landing()).not.toBeNull()
    app.router.dispose()
  })

  it('Forward onto /home while unauthenticated redirects (8.4)', async () => {
    const app = renderApp({ status: 'authenticated', path: '/nowhere' })
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeNull())

    await act(async () => {
      await app.router.navigate('/home')
    })
    expect(homepage()).not.toBeNull()

    await back(app)
    expect(app.location().pathname).toBe('/nowhere')

    await app.setAuth('unauthenticated')
    await forward(app)
    await waitFor(() => expect(app.location().pathname).toBe('/'))
    expect(homepage()).toBeNull()
    expect(landing()).not.toBeNull()
    app.router.dispose()
  })

  describe('refresh shows the Pending_View first, then the correct view (8.5, 8.6, 8.7)', () => {
    it('/home as an authenticated user', async () => {
      const app = renderApp({ status: 'loading', path: '/home' })
      expect(pending()).toBeTruthy()
      expect(homepage()).toBeNull()
      expect(app.currentUrl()).toBe('/home')

      await app.setAuth('authenticated')
      await waitFor(() => expect(homepage()).not.toBeNull())
      expect(app.location().pathname).toBe('/home')
      app.router.dispose()
    })

    it('/home as an unauthenticated user', async () => {
      const app = renderApp({ status: 'loading', path: '/home' })
      expect(pending()).toBeTruthy()
      expect(homepage()).toBeNull()

      await app.setAuth('unauthenticated')
      await waitFor(() => expect(landing()).not.toBeNull())
      expect(app.location().pathname).toBe('/')
      expect(homepage()).toBeNull()
      app.router.dispose()
    })

    it('/ as an authenticated user', async () => {
      const app = renderApp({ status: 'loading', path: '/' })
      expect(pending()).toBeTruthy()
      expect(landing()).toBeNull()
      expect(app.currentUrl()).toBe('/')

      await app.setAuth('authenticated')
      await waitFor(() => expect(homepage()).not.toBeNull())
      expect(app.location().pathname).toBe('/home')
      expect(landing()).toBeNull()
      app.router.dispose()
    })

    it('/ as an unauthenticated user', async () => {
      const app = renderApp({ status: 'loading', path: '/' })
      expect(pending()).toBeTruthy()

      await app.setAuth('unauthenticated')
      await waitFor(() => expect(landing()).not.toBeNull())
      expect(app.location().pathname).toBe('/')
      app.router.dispose()
    })
  })
})
