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
  updateEmail: vi.fn(),
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

  it('shows days, friends and blocked as three cards in one row', () => {
    localStorage.clear()
    renderProfile(serviceWith(vi.fn()), {
      status: 'authenticated',
      userMetadata: { username: 'Ada' },
      userId: 'stats-empty',
      createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    } as AuthState)
    const cards = screen.getByRole('region', { name: 'Your stats' }).querySelectorAll('li')
    expect(cards).toHaveLength(3)
    expect(cards[0].textContent).toBe('3days on Dyne')
    expect(cards[1].textContent).toBe('0Friends')
    expect(cards[2].textContent).toBe('0Blocked')
    expect(screen.queryByText('Your journey')).toBeNull()
    expect(screen.queryByText(/weeks in the game/)).toBeNull()
  })

  it('keeps the lists hidden until a card is clicked, then shows them in a modal', async () => {
    localStorage.clear()
    localStorage.setItem('dyne:favorites:lists-user', JSON.stringify([{ userId: 'u1', username: 'Grace' }]))
    localStorage.setItem('dyne:blocked:lists-user', JSON.stringify([{ userId: 'u2', username: 'Linus' }]))
    const user = userEvent.setup()
    renderProfile(serviceWith(vi.fn()), { ...authed, userId: 'lists-user' } as AuthState)
    expect(screen.queryByText('Grace')).toBeNull()
    expect(screen.queryByText('Linus')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Friends/ }))
    const favorites = screen.getByRole('dialog', { name: 'Friends' })
    expect(within(favorites).getByText('Grace')).toBeTruthy()
    expect(within(favorites).queryByText('Linus')).toBeNull()
    await user.click(within(favorites).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: /Blocked/ }))
    const blocked = screen.getByRole('dialog', { name: 'Blocked users' })
    expect(within(blocked).getByText('Linus')).toBeTruthy()
    expect(within(blocked).queryByText('Grace')).toBeNull()
  })

  it('the x next to a person removes them and updates the count and saved list', async () => {
    localStorage.clear()
    localStorage.setItem(
      'dyne:favorites:remove-user',
      JSON.stringify([
        { userId: 'u1', username: 'Grace' },
        { userId: 'u2', username: 'Linus' },
      ]),
    )
    const user = userEvent.setup()
    renderProfile(serviceWith(vi.fn()), { ...authed, userId: 'remove-user' } as AuthState)
    await user.click(screen.getByRole('button', { name: /Friends/ }))
    const dialog = screen.getByRole('dialog', { name: 'Friends' })
    await user.click(within(dialog).getByRole('button', { name: 'Remove Grace from friends' }))
    expect(within(dialog).queryByText('Grace')).toBeNull()
    expect(within(dialog).getByText('Linus')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('dyne:favorites:remove-user')!)).toEqual([
      { userId: 'u2', username: 'Linus' },
    ])
    await user.click(within(dialog).getByRole('button', { name: 'Remove Linus from friends' }))
    expect(within(dialog).getByText('No friends yet.')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('button', { name: /Friends/ }).textContent).toBe('0Friends')
  })
  it('has no greeting line', () => {
    renderProfile(serviceWith(vi.fn()))
    expect(screen.queryByText(/good (morning|afternoon|evening)|midnight oil/i)).toBeNull()
  })

  it('offers 50 avatars, saves the pick, and can go back to initials', async () => {
    localStorage.clear()
    const user = userEvent.setup()
    renderProfile(serviceWith(vi.fn()), { ...authed, userId: 'avatar-user' } as AuthState)
    const card = screen.getByRole('region', { name: 'Player card' })
    expect(card.querySelector('.profile-avatar')?.textContent).toBe('A')

    await user.click(screen.getByRole('button', { name: 'Change avatar' }))
    const dialog = screen.getByRole('dialog', { name: 'Choose an avatar' })
    expect(within(dialog).getAllByRole('button', { pressed: false })).toHaveLength(50)

    await user.click(within(dialog).getByRole('button', { name: 'Fox' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(card.querySelector('.profile-avatar')?.textContent).toBe('🦊')
    expect(localStorage.getItem('dyne:avatar:avatar-user')).toBe('fox')

    await user.click(screen.getByRole('button', { name: 'Change avatar' }))
    expect(screen.getByRole('button', { name: 'Fox' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Use my initials' }))
    expect(card.querySelector('.profile-avatar')?.textContent).toBe('A')
    expect(localStorage.getItem('dyne:avatar:avatar-user')).toBeNull()
  })

  it('places the avatar button before the avatar and the edit button after it', () => {
    renderProfile(serviceWith(vi.fn()))
    const row = screen.getByRole('region', { name: 'Player card' }).querySelector('.profile-avatar-row')!
    const kids = Array.from(row.children)
    expect(kids[0].getAttribute('aria-label')).toBe('Change avatar')
    expect(kids[1].classList.contains('profile-avatar')).toBe(true)
    expect(kids[2].getAttribute('aria-label')).toMatch(/^Edit profile/)
  })

  describe('edit profile', () => {
    const withEmail = (id: string): AuthState =>
      ({ status: 'authenticated', userMetadata: { username: 'Ada' }, userId: id, email: 'ada@example.com' }) as AuthState

    async function openEdit(service: AuthService, id: string) {
      const user = userEvent.setup()
      renderProfile(service, withEmail(id))
      await user.click(screen.getByRole('button', { name: 'Edit profile' }))
      return { user, dialog: screen.getByRole('dialog', { name: 'Edit profile' }) }
    }

    it('requests an email change and says to check the inbox', async () => {
      const updateEmail = vi.fn().mockResolvedValue({ ok: true })
      const { user, dialog } = await openEdit({ ...serviceWith(vi.fn()), updateEmail }, 'edit-1')
      const save = within(dialog).getByRole('button', { name: 'Save email' }) as HTMLButtonElement
      expect(save.disabled).toBe(true)
      const input = within(dialog).getByLabelText('Email')
      await user.clear(input)
      await user.type(input, 'new@example.com')
      await user.click(save)
      expect(updateEmail).toHaveBeenCalledWith('new@example.com')
      expect((await within(dialog).findByRole('status')).textContent).toMatch(/new@example\.com/)
    })

    it('rejects an invalid email without calling the service', async () => {
      const updateEmail = vi.fn()
      const { user, dialog } = await openEdit({ ...serviceWith(vi.fn()), updateEmail }, 'edit-2')
      const input = within(dialog).getByLabelText('Email')
      await user.clear(input)
      await user.type(input, 'nope')
      await user.click(within(dialog).getByRole('button', { name: 'Save email' }))
      expect((await within(dialog).findByRole('alert')).textContent).toMatch(/valid email/i)
      expect(updateEmail).not.toHaveBeenCalled()
    })

    it('shows an error when the email is taken or the service fails', async () => {
      const updateEmail = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, error: 'email_taken' })
        .mockResolvedValueOnce({ ok: false, error: 'update_unavailable' })
      const { user, dialog } = await openEdit({ ...serviceWith(vi.fn()), updateEmail }, 'edit-3')
      const input = within(dialog).getByLabelText('Email')
      await user.clear(input)
      await user.type(input, 'taken@example.com')
      await user.click(within(dialog).getByRole('button', { name: 'Save email' }))
      expect((await within(dialog).findByRole('alert')).textContent).toMatch(/already in use/i)
      await user.click(within(dialog).getByRole('button', { name: 'Save email' }))
      await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toMatch(/couldn.t update/i))
    })

    it('offers 15 neon colors; picking one recolours the page and saves it', async () => {
      localStorage.clear()
      const { user, dialog } = await openEdit(serviceWith(vi.fn()), 'color-user')
      const swatches = within(dialog).getAllByRole('button', { pressed: false })
      expect(swatches.filter((b) => b.classList.contains('color-swatch'))).toHaveLength(15)
      await user.click(within(dialog).getByRole('button', { name: 'Green' }))
      expect(within(dialog).getByRole('button', { name: 'Green' }).getAttribute('aria-pressed')).toBe('true')
      expect(localStorage.getItem('dyne:accent:color-user')).toBe('green')
      expect(document.querySelector<HTMLElement>('.app-shell')!.style.getPropertyValue('--hue')).toBe('130')
      expect(document.querySelector<HTMLElement>('.bottom-nav')!.style.getPropertyValue('--nav-accent')).toBe(
        'hsl(130 100% 62%)',
      )
    })
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
