import type { ReactElement, ReactNode } from 'react'
import { act, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../auth/authContext'
import type { AuthState } from '../../auth/authReducer'
import LandingPage, { LandingView } from './LandingPage'

// The default LandingPage export reads auth via useAuth(), so render it inside
// an AuthContext provider holding an unauthenticated state.
const auth: AuthState = { status: 'unauthenticated' }
function Wrapper({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper })
}

const BASES = [
  ['Own Draft Day', /live rankings/i],
  ['Every Pitch, Live', /real time/i],
  ['Work the Wire', /waivers/i],
  ['Claim the Crown', /standings/i],
] as const

const TAGLINE = 'Fantasy baseball, played every pitch.'

describe('LandingPage', () => {
  it('renders the landing page with no Vite starter content (1.1, 1.4)', () => {
    const { container } = render(<LandingPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Dyne')
    expect(screen.queryByText(/get started/i)).toBeNull()
    expect(screen.queryByText(/count is/i)).toBeNull()
    expect(screen.queryByAltText(/vite logo|react logo/i)).toBeNull()
    expect(container.querySelector('.counter, .hero, #next-steps')).toBeNull()
  })

  // Validates: Requirements 6.1, 6.3, 6.4
  it('unauthenticated view has exactly one Register and one Login button, no welcome or Sign out', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <LandingView
        auth={{ status: 'unauthenticated' }}
        authService={{
          signIn: vi.fn(),
          signUp: vi.fn(),
          requestPasswordReset: vi.fn(),
          updatePassword: vi.fn(),
          signOut: vi.fn(),
        }}
      />,
    )
    expect(screen.getAllByRole('button', { name: 'Register' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Login' })).toHaveLength(1)
    expect(screen.queryByText(/welcome/i)).toBeNull()
    expect(container.querySelector('.welcome')).toBeNull()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeTruthy()
  })

  // The Register/Login buttons now open the auth modal. A stub service keeps
  // these tests off the network.
  const stubService = () => ({
    signIn: vi.fn(),
    signUp: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
  })

  it('Login opens the auth modal in login mode', async () => {
    const user = userEvent.setup()
    render(<LandingPage authService={stubService()} />)
    await user.click(screen.getByRole('button', { name: 'Login' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeTruthy()
  })

  it('Register opens the auth modal in register mode', async () => {
    const user = userEvent.setup()
    render(<LandingPage authService={stubService()} />)
    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy()
  })

  it.each([
    ['Login', '{Enter}'],
    ['Login', ' '],
    ['Register', '{Enter}'],
    ['Register', ' '],
  ])('%s opens the modal on keyboard %j', async (name, key) => {
    const user = userEvent.setup()
    render(<LandingPage authService={stubService()} />)
    screen.getByRole('button', { name }).focus()
    await user.keyboard(key)
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  it('closing the modal returns focus to the page and removes the dialog', async () => {
    const user = userEvent.setup()
    render(<LandingPage authService={stubService()} />)
    await user.click(screen.getByRole('button', { name: 'Login' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('places the four features on the bases in run order: first, second, third, home', () => {
    const { container } = render(<LandingPage />)
    const bases = Array.from(container.querySelectorAll('.base'))
    expect(bases.map((b) => b.className.match(/base-(first|second|third|home)/)?.[1])).toEqual([
      'first',
      'second',
      'third',
      'home',
    ])
    expect(bases.map((b) => b.querySelector('.base-label')?.textContent)).toEqual(
      BASES.map(([title]) => title),
    )
  })

  it.each(BASES)('base "%s" exposes its description to assistive tech', (title, desc) => {
    render(<LandingPage />)
    expect(screen.getByRole('button', { name: title })).toHaveAccessibleDescription(desc)
  })

  it('shows the tagline until a base is selected', () => {
    const { container } = render(<LandingPage />)
    expect(container.querySelector('.pitch')?.textContent).toBe(TAGLINE)
    expect(container.querySelector('.base.is-active')).toBeNull()
  })

  it.each(BASES)('focusing "%s" shows its description, blurring restores the tagline', (title, desc) => {
    const { container } = render(<LandingPage />)
    const btn = screen.getByRole('button', { name: title })
    act(() => btn.focus())
    expect(container.querySelector('.pitch')?.textContent).toMatch(desc)
    expect(btn.closest('.base')).toHaveClass('is-active')
    act(() => btn.blur())
    expect(container.querySelector('.pitch')?.textContent).toBe(TAGLINE)
    expect(container.querySelector('.base.is-active')).toBeNull()
  })

  it('mouse hover previews a base and leaving restores the tagline', () => {
    const { container } = render(<LandingPage />)
    const btn = screen.getByRole('button', { name: 'Work the Wire' })
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
    expect(container.querySelector('.pitch')?.textContent).toMatch(/waivers/i)
    fireEvent.pointerLeave(btn, { pointerType: 'mouse' })
    expect(container.querySelector('.pitch')?.textContent).toBe(TAGLINE)
  })

  it('touch pointer events do not clear a tapped base', () => {
    const { container } = render(<LandingPage />)
    const btn = screen.getByRole('button', { name: 'Own Draft Day' })
    fireEvent.click(btn)
    fireEvent.pointerLeave(btn, { pointerType: 'touch' })
    expect(container.querySelector('.pitch')?.textContent).toMatch(/live rankings/i)
  })

  it('selecting a base never opens the auth dialog', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)
    for (const [title] of BASES) await user.click(screen.getByRole('button', { name: title }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('tab order follows reading order: bases around the diamond, then Register, then Login (7.6)', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    for (const name of [...BASES.map(([title]) => title), 'Register', 'Login']) {
      await user.tab()
      expect(document.activeElement).toBe(screen.getByRole('button', { name }))
    }
  })
})
