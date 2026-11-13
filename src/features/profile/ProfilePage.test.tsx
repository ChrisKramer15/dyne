import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
// testUtils must be imported before routes (it installs the Supabase mock).
import { renderApp, authStateFor } from '../../routing/testUtils'
import { AuthContext } from '../../auth/authContext'
import type { AuthState } from '../../auth/authReducer'
import type { AuthService } from '../../auth/authService'
import ProfilePage from './ProfilePage'

afterEach(cleanup)

const serviceWith = (signOut: AuthService['signOut']): AuthService => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  signOut,
})

const authed: AuthState = { status: 'authenticated', userMetadata: { username: 'Ada' } }

const renderProfile = (service: AuthService, auth: AuthState = authed) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage authService={service} />
      </MemoryRouter>
    </AuthContext.Provider>,
  )

describe('ProfilePage', () => {
  it('renders one level-one heading named Profile and one main landmark', () => {
    renderProfile(serviceWith(vi.fn()))
    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toBe('Profile')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('shows the username when known and omits it otherwise', () => {
    renderProfile(serviceWith(vi.fn()))
    // Shown on the player card and in the account details.
    expect(within(screen.getByRole('region', { name: 'Player card' })).getByText('Ada')).toBeTruthy()
    expect(screen.getByText('Username').nextElementSibling?.textContent).toBe('Ada')
    cleanup()
    renderProfile(serviceWith(vi.fn()), { status: 'authenticated', userMetadata: {} })
    expect(screen.queryByText('Username')).toBeNull()
  })

  it('marks Profile as the current page in the bottom nav', () => {
    renderProfile(serviceWith(vi.fn()))
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).getByRole('link', { name: 'Profile' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull()
  })

  it('Sign out calls the service once', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderProfile(serviceWith(signOut))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Sign out' }) as HTMLButtonElement).disabled).toBe(false),
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('is disabled while signing out so it cannot be double-submitted', async () => {
    let finish!: () => void
    const signOut = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    renderProfile(serviceWith(signOut))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    const busy = screen.getByRole('button', { name: 'Signing out…' }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    finish()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy())
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('shows an error and stays signed in when sign out fails', async () => {
    const signOut = vi.fn().mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    renderProfile(serviceWith(signOut))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn.t sign out/i)
    expect((screen.getByRole('button', { name: 'Sign out' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('Profile routing', () => {
  it('the Profile nav icon opens /profile, and Home brings you back', async () => {
    const user = userEvent.setup()
    const app = renderApp({ status: 'authenticated', path: '/home' })
    await screen.findByRole('heading', { level: 2, name: 'Alerts' })

    await user.click(screen.getByRole('link', { name: 'Profile' }))
    await waitFor(() => expect(app.location().pathname).toBe('/profile'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
    await waitFor(() => expect(document.title).toBe('Profile – Dyne'))

    await user.click(screen.getByRole('link', { name: 'Home' }))
    await waitFor(() => expect(app.location().pathname).toBe('/home'))
  })

  it('/profile is protected: signed-out users are sent to /', async () => {
    const app = renderApp({ status: 'unauthenticated', path: '/profile' })
    await waitFor(() => expect(app.location().pathname).toBe('/'))
    expect(screen.queryByRole('heading', { level: 1, name: 'Profile' })).toBeNull()
  })

  it('signing out from the profile page returns the user to the landing page', async () => {
    const user = userEvent.setup()
    const app = renderApp({ authState: authStateFor('authenticated'), path: '/profile' })
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    // The mocked client signs out successfully; the real client's SIGNED_OUT event
    // is simulated by swapping the auth state.
    await app.setAuth('unauthenticated')
    await waitFor(() => expect(app.location().pathname).toBe('/'))
    expect(screen.getByRole('button', { name: 'Play Ball' })).toBeTruthy()
  })
})
