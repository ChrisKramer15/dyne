import { describe, it, expect, afterEach } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
// testUtils must be imported before routes (it installs the Supabase mock).
import { renderApp } from './testUtils'

afterEach(cleanup)

describe('return to the page a logged-out user was heading for', () => {
  it('lands on the requested protected page after login, keeping search and hash', async () => {
    const app = renderApp({ status: 'unauthenticated', path: '/leagues', search: '?x=1', hash: '#top' })
    await waitFor(() => expect(app.location().pathname).toBe('/'))
    expect(app.location().state).toEqual({ from: '/leagues?x=1#top' })

    await app.setAuth('authenticated')
    await waitFor(() => expect(app.currentUrl()).toBe('/leagues?x=1#top'))
  })

  it('goes to /home after login when the user came straight to /', async () => {
    const app = renderApp({ status: 'unauthenticated', path: '/' })
    await app.setAuth('authenticated')
    await waitFor(() => expect(app.location().pathname).toBe('/home'))
  })

  it('does not remember the page after signing out', async () => {
    const app = renderApp({ status: 'authenticated', path: '/profile' })
    await waitFor(() => expect(app.location().pathname).toBe('/profile'))

    await app.setAuth('unauthenticated')
    await waitFor(() => expect(app.location().pathname).toBe('/'))
    expect(app.location().state).toBeNull()

    await app.setAuth('authenticated')
    await waitFor(() => expect(app.location().pathname).toBe('/home'))
  })

  it('remembers a protected page visited after a previous sign-out', async () => {
    const app = renderApp({ status: 'authenticated', path: '/profile' })
    await waitFor(() => expect(app.location().pathname).toBe('/profile'))
    await app.setAuth('unauthenticated')
    await waitFor(() => expect(app.location().pathname).toBe('/'))

    await act(async () => {
      await app.router.navigate('/leagues')
    })
    await waitFor(() => expect(app.location().pathname).toBe('/'))
    expect(app.location().state).toEqual({ from: '/leagues' })
  })

  it('ignores an unsafe return path', async () => {
    const app = renderApp({ status: 'unauthenticated', path: '/' })
    await app.router.navigate('/', { state: { from: '//evil.test' }, replace: true })
    await app.setAuth('authenticated')
    await waitFor(() => expect(app.location().pathname).toBe('/home'))
  })
})
