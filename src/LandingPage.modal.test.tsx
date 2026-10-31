import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthSessionLike } from './auth/authReducer'

// Fake AuthClientLike seam: LandingPage reads the client from './supabase', both
// for useAuthState and for the auth service, so one fake drives the whole page.
const fake = vi.hoisted(() => {
  type Listener = (event: string, session: unknown) => void
  const f = {
    listeners: new Set<Listener>(),
    initialSession: null as unknown,
    invokeResult: { data: null, error: null } as { data: unknown; error: unknown },
    emit(event: string, session: unknown) {
      for (const l of Array.from(f.listeners)) l(event, session)
    },
    storage: {
      degraded: false,
      setMode: () => {},
      clearAll: () => {},
    },
    client: null as unknown,
  }
  f.client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: f.initialSession }, error: null }),
      onAuthStateChange: (cb: Listener) => {
        f.listeners.add(cb)
        return { data: { subscription: { unsubscribe: () => f.listeners.delete(cb) } } }
      },
      // Like the real client, a successful setSession announces SIGNED_IN.
      setSession: (tokens: { access_token: string }) => {
        f.emit('SIGNED_IN', { user: { user_metadata: { username: 'slugger' } }, tokens })
        return Promise.resolve({ error: null })
      },
      signUp: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    functions: { invoke: () => Promise.resolve(f.invokeResult) },
    rpc: () => Promise.resolve({ data: true, error: null }),
  }
  return f
})

vi.mock('./supabase', () => ({ supabase: fake.client, authStorage: fake.storage }))

import LandingPage from './LandingPage'

const session: AuthSessionLike = { user: { user_metadata: { username: 'slugger' } } }
const tokens = { access_token: 'a', refresh_token: 'r' }

async function renderUnauthenticated() {
  const user = userEvent.setup()
  const result = render(<LandingPage />)
  await screen.findByRole('button', { name: 'Login' })
  return { user, ...result }
}

const wrapper = (container: HTMLElement) => container.querySelector('div.landing') as HTMLElement

describe('LandingPage auth modal integration', () => {
  beforeEach(() => {
    fake.listeners.clear()
    fake.initialSession = null
    fake.invokeResult = { data: tokens, error: null }
    fake.storage.degraded = false
  })

  it('sets inert on the landing wrapper while open and clears it on close', async () => {
    const { user, container } = await renderUnauthenticated()
    expect(wrapper(container)).not.toHaveAttribute('inert')

    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(wrapper(container)).toHaveAttribute('inert')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(wrapper(container)).not.toHaveAttribute('inert')
  })

  it('returns focus to the opener after closing, for either button', async () => {
    const { user } = await renderUnauthenticated()
    for (const name of ['Login', 'Register']) {
      const opener = screen.getByRole('button', { name })
      await user.click(opener)
      await screen.findByRole('dialog')
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(opener).toHaveFocus()
    }
  })

  it('closes on an authenticated session event, removes the buttons and focuses the heading', async () => {
    const { user, container } = await renderUnauthenticated()
    await user.click(screen.getByRole('button', { name: 'Register' }))
    await screen.findByRole('dialog')

    act(() => fake.emit('SIGNED_IN', session))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Register' })).toBeNull()
    expect(container.querySelector('.welcome')).not.toBeNull()
    expect(wrapper(container)).not.toHaveAttribute('inert')
    // The opener is gone, so focus falls back to the page heading.
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  it('renders the authenticated state without buttons when a session already exists', async () => {
    fake.initialSession = session
    const { container } = render(<LandingPage />)
    await waitFor(() => expect(container.querySelector('.welcome')).not.toBeNull())
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Register' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the modal and entered values on unauthenticated events', async () => {
    const { user } = await renderUnauthenticated()
    await user.click(screen.getByRole('button', { name: 'Login' }))
    await user.type(await screen.findByLabelText('Username'), 'slugger')
    await user.type(screen.getByLabelText('Password'), 'hunter22')

    act(() => {
      fake.emit('SIGNED_OUT', null)
      fake.emit('TOKEN_REFRESHED', null)
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveValue('slugger')
    expect(screen.getByLabelText('Password')).toHaveValue('hunter22')
  })

  it('keeps the modal and username after a failed sign-in', async () => {
    fake.invokeResult = { data: null, error: { context: { status: 401 } } }
    const { user } = await renderUnauthenticated()
    await user.click(screen.getByRole('button', { name: 'Login' }))
    await user.type(await screen.findByLabelText('Username'), 'slugger')
    await user.type(screen.getByLabelText('Password'), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: 'Log in', hidden: false }))

    expect(await screen.findByText('Invalid username or password.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveValue('slugger')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('keeps the modal open when the service is unavailable', async () => {
    fake.invokeResult = { data: null, error: { message: 'network' } }
    const { user } = await renderUnauthenticated()
    await user.click(screen.getByRole('button', { name: 'Login' }))
    await user.type(await screen.findByLabelText('Username'), 'slugger')
    await user.type(screen.getByLabelText('Password'), 'pw-12345')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveValue('slugger')
  })

  it('shows no remember-failed notice after a normal sign-in', async () => {
    const { user } = await renderUnauthenticated()
    await user.click(screen.getByRole('button', { name: 'Login' }))
    await user.type(await screen.findByLabelText('Username'), 'slugger')
    await user.type(screen.getByLabelText('Password'), 'pw-12345')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByText(/could not remember this login/i)).toBeNull()
  })

  it('shows the remember-failed notice when storage degraded during sign-in', async () => {
    fake.storage.degraded = true
    const { user } = await renderUnauthenticated()
    await user.click(screen.getByRole('button', { name: 'Login' }))
    await user.type(await screen.findByLabelText('Username'), 'slugger')
    await user.type(screen.getByLabelText('Password'), 'pw-12345')
    await user.click(screen.getByRole('checkbox', { name: 'Remember me' }))
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status')).toHaveTextContent(/could not remember this login/i)
  })
})
