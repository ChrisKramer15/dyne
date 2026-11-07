import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { AuthSessionLike } from './auth/authReducer'

type Callback = (event: string, session: AuthSessionLike | null) => void
type SessionResult = { data: { session: AuthSessionLike | null }; error: unknown }

// Fake auth client standing in for Supabase; each test sets `getSessionImpl`.
const fake = vi.hoisted(() => ({
  callback: (() => {}) as Callback,
  getSessionImpl: (() => Promise.resolve({ data: { session: null }, error: null })) as () => PromiseLike<SessionResult>,
}))

vi.mock('./supabase', () => ({
  authStorage: {},
  supabase: {
    auth: {
      getSession: () => fake.getSessionImpl(),
      onAuthStateChange: (cb: Callback) => {
        fake.callback = cb
        return { data: { subscription: { unsubscribe() {} } } }
      },
      signOut: () => Promise.resolve({ error: null }),
    },
  },
}))

import App from './App'

const session: AuthSessionLike = { user: { user_metadata: { username: 'Ada' } } }
const resolveWith = (s: AuthSessionLike | null) => () =>
  Promise.resolve({ data: { session: s }, error: null })

async function settle() {
  await act(async () => {})
}
const emit = (event: string, s: AuthSessionLike | null) => act(() => fake.callback(event, s))

const hasRegister = () => screen.queryByRole('button', { name: 'Register' }) !== null
const hasHomepage = () => screen.queryByRole('button', { name: 'Sign out' }) !== null
const hasDialog = () => screen.queryByRole('dialog') !== null

beforeEach(() => {
  fake.callback = () => {}
  fake.getSessionImpl = resolveWith(null)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('App integration', () => {
  it('shows only a status indicator while loading', () => {
    fake.getSessionImpl = () => new Promise<SessionResult>(() => {})
    render(<App />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(hasRegister()).toBe(false)
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull()
    expect(hasHomepage()).toBe(false)
  })

  it('shows the Homepage with no dialog for a restored session', async () => {
    fake.getSessionImpl = resolveWith(session)
    render(<App />)
    await settle()
    expect(hasHomepage()).toBe(true)
    expect(screen.getByText(/Ada/)).toBeTruthy()
    expect(hasRegister()).toBe(false)
    expect(hasDialog()).toBe(false)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows Landing with a closed modal and no error when there is no session', async () => {
    render(<App />)
    await settle()
    expect(hasRegister()).toBe(true)
    expect(hasHomepage()).toBe(false)
    expect(hasDialog()).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows Landing with no error when the session lookup errors', async () => {
    fake.getSessionImpl = () => Promise.reject(new Error('boom'))
    render(<App />)
    await settle()
    expect(hasRegister()).toBe(true)
    expect(hasDialog()).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows Landing with no error when the session lookup times out', async () => {
    vi.useFakeTimers()
    fake.getSessionImpl = () => new Promise<SessionResult>(() => {})
    render(<App />)
    expect(screen.getByRole('status')).toBeTruthy()
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(hasRegister()).toBe(true)
    expect(hasHomepage()).toBe(false)
    expect(hasDialog()).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('swaps Landing and modal for the Homepage on SIGNED_IN, and back on SIGNED_OUT', async () => {
    render(<App />)
    await settle()
    expect(hasRegister()).toBe(true)

    await emit('SIGNED_IN', session)
    expect(hasHomepage()).toBe(true)
    expect(hasRegister()).toBe(false)
    expect(hasDialog()).toBe(false)

    await emit('SIGNED_OUT', null)
    expect(hasRegister()).toBe(true)
    expect(hasHomepage()).toBe(false)
    expect(hasDialog()).toBe(false)
  })

  it('shows the update-password modal on PASSWORD_RECOVERY, then Homepage on USER_UPDATED', async () => {
    render(<App />)
    await settle()

    await emit('PASSWORD_RECOVERY', session)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Choose a new password')).toBeTruthy()
    expect(hasHomepage()).toBe(false)

    await emit('USER_UPDATED', session)
    expect(hasHomepage()).toBe(true)
    expect(hasDialog()).toBe(false)
    expect(hasRegister()).toBe(false)
  })
})
