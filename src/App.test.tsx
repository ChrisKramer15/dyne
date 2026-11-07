import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import type { AuthSessionLike } from './auth/authReducer'

type Callback = (event: string, session: AuthSessionLike | null) => void
type SessionResult = { data: { session: AuthSessionLike | null }; error: unknown }

// Fake auth client standing in for Supabase; each test sets the *Impl hooks.
const fake = vi.hoisted(() => ({
  callback: (() => {}) as Callback,
  getSessionImpl: (() => Promise.resolve({ data: { session: null }, error: null })) as () => PromiseLike<SessionResult>,
  signOutImpl: (() => Promise.resolve({ error: null })) as () => PromiseLike<{ error: unknown }>,
}))

vi.mock('./supabase', () => ({
  authStorage: { clearAll() {} },
  supabase: {
    auth: {
      getSession: () => fake.getSessionImpl(),
      onAuthStateChange: (cb: Callback) => {
        fake.callback = cb
        return { data: { subscription: { unsubscribe() {} } } }
      },
      signOut: () => fake.signOutImpl(),
    },
  },
}))

import App from './App'
import { appRoutes } from './routing/routes'

const session: AuthSessionLike = { user: { user_metadata: { username: 'Ada' } } }
const resolveWith = (s: AuthSessionLike | null) => () =>
  Promise.resolve({ data: { session: s }, error: null })

async function settle() {
  await act(async () => {})
}
const emit = (event: string, s: AuthSessionLike | null) => act(() => fake.callback(event, s))

// Mount App through an injected memory router so location can be asserted.
function mount(path = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<App router={router} />)
  return router
}
const pathOf = (r: ReturnType<typeof mount>) => r.state.location.pathname

const hasRegister = () => screen.queryByRole('button', { name: 'Register' }) !== null
const hasHomepage = () => screen.queryByRole('button', { name: 'Profile' }) !== null
const hasDialog = () => screen.queryByRole('dialog') !== null

beforeEach(() => {
  fake.callback = () => {}
  fake.getSessionImpl = resolveWith(null)
  fake.signOutImpl = () => Promise.resolve({ error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('App integration', () => {
  it('shows only a status indicator while loading', () => {
    fake.getSessionImpl = () => new Promise<SessionResult>(() => {})
    const router = mount()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(hasRegister()).toBe(false)
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull()
    expect(hasHomepage()).toBe(false)
    expect(pathOf(router)).toBe('/')
  })

  it('shows the Homepage at /home with no dialog for a restored session', async () => {
    fake.getSessionImpl = resolveWith(session)
    const router = mount()
    await settle()
    expect(hasHomepage()).toBe(true)
    expect(hasRegister()).toBe(false)
    expect(hasDialog()).toBe(false)
    expect(screen.queryByRole('status')).toBeNull()
    expect(pathOf(router)).toBe('/home')
  })

  it('shows Landing at / with a closed modal and no error when there is no session', async () => {
    const router = mount()
    await settle()
    expect(hasRegister()).toBe(true)
    expect(hasHomepage()).toBe(false)
    expect(hasDialog()).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(pathOf(router)).toBe('/')
  })

  it('shows Landing with no error when the session lookup errors', async () => {
    fake.getSessionImpl = () => Promise.reject(new Error('boom'))
    const router = mount()
    await settle()
    expect(hasRegister()).toBe(true)
    expect(hasDialog()).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(pathOf(router)).toBe('/')
  })

  it('shows Landing with no error when the session lookup times out', async () => {
    vi.useFakeTimers()
    fake.getSessionImpl = () => new Promise<SessionResult>(() => {})
    const router = mount()
    expect(screen.getByRole('status')).toBeTruthy()
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(hasRegister()).toBe(true)
    expect(hasHomepage()).toBe(false)
    expect(hasDialog()).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(pathOf(router)).toBe('/')
  })

  it('moves / to /home on SIGNED_IN, and back to / on SIGNED_OUT', async () => {
    const router = mount()
    await settle()
    expect(hasRegister()).toBe(true)

    await emit('SIGNED_IN', session)
    expect(hasHomepage()).toBe(true)
    expect(hasRegister()).toBe(false)
    expect(hasDialog()).toBe(false)
    expect(pathOf(router)).toBe('/home')

    await emit('SIGNED_OUT', null)
    expect(hasRegister()).toBe(true)
    expect(hasHomepage()).toBe(false)
    expect(hasDialog()).toBe(false)
    expect(pathOf(router)).toBe('/')
  })

  it('shows the update-password modal on PASSWORD_RECOVERY, then /home on USER_UPDATED', async () => {
    const router = mount()
    await settle()

    await emit('PASSWORD_RECOVERY', session)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Choose a new password')).toBeTruthy()
    expect(hasHomepage()).toBe(false)
    expect(pathOf(router)).toBe('/')

    await emit('USER_UPDATED', session)
    expect(hasHomepage()).toBe(true)
    expect(hasDialog()).toBe(false)
    expect(hasRegister()).toBe(false)
    expect(pathOf(router)).toBe('/home')
  })

  it('withholds the Homepage and moves /home to / while recovering', async () => {
    fake.getSessionImpl = resolveWith(session)
    const router = mount('/home')
    await settle()
    expect(pathOf(router)).toBe('/home')

    await emit('PASSWORD_RECOVERY', session)
    expect(hasHomepage()).toBe(false)
    expect(pathOf(router)).toBe('/')
    expect(screen.getByText('Choose a new password')).toBeTruthy()
  })
})
