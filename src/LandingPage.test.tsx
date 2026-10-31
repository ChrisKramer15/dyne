import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from './auth/authReducer'

const authMock = vi.hoisted(() => ({ state: { status: 'unauthenticated' } as unknown }))

vi.mock('./auth/useAuthState', () => ({
  useAuthState: () => authMock.state as AuthState,
}))

import LandingPage from './LandingPage'

function setAuth(state: AuthState) {
  authMock.state = state
}

beforeEach(() => {
  setAuth({ status: 'unauthenticated' })
})

const BASES = [
  ['Own Draft Day', /live rankings/i],
  ['Every Pitch, Live', /real time/i],
  ['Work the Wire', /waivers/i],
  ['Claim the Crown', /standings/i],
] as const

const TAGLINE = 'Fantasy baseball, played every pitch.'

describe('LandingPage', () => {
  it('renders the landing page with no Vite starter content (1.1, 1.4)', () => {
    const { container } = render(<LandingPage onNavigate={vi.fn()} />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Dyne')
    expect(screen.queryByText(/get started/i)).toBeNull()
    expect(screen.queryByText(/count is/i)).toBeNull()
    expect(screen.queryByAltText(/vite logo|react logo/i)).toBeNull()
    expect(container.querySelector('.counter, .hero, #next-steps')).toBeNull()
  })

  it('retains an active session and shows the greeting (1.2)', () => {
    setAuth({ status: 'authenticated', userMetadata: { username: 'Ada' } })
    const onNavigate = vi.fn()
    render(<LandingPage onNavigate={onNavigate} />)
    expect(screen.getByText(/Welcome Back, Ada/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Register' })).toBeNull()
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it.each([
    ['Login', 'login', 'Hello, Again!'],
    ['Register', 'register', 'Create account'],
  ])('%s navigates on click and opens the modal (4.4, 4.5, 8.3)', async (name, target, dialogName) => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<LandingPage onNavigate={onNavigate} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith(target)
    expect(screen.getByRole('dialog', { name: dialogName })).toBeTruthy()
  })

  it.each([
    ['Login', 'login', 'Hello, Again!', '{Enter}'],
    ['Login', 'login', 'Hello, Again!', ' '],
    ['Register', 'register', 'Create account', '{Enter}'],
    ['Register', 'register', 'Create account', ' '],
  ])('%s navigates on keyboard %j and opens the modal (4.4, 4.5, 7.6, 8.3)', async (name, target, dialogName, key) => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<LandingPage onNavigate={onNavigate} />)
    screen.getByRole('button', { name }).focus()
    await user.keyboard(key)
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith(target)
    expect(screen.getByRole('dialog', { name: dialogName })).toBeTruthy()
  })

  it('shows an alert message when navigation throws and stays on the page (4.6)', async () => {
    const onNavigate = vi.fn(() => {
      throw new Error('boom')
    })
    const user = userEvent.setup()
    const { container } = render(<LandingPage onNavigate={onNavigate} />)
    // The modal adds its own alert regions once open, so scope to the page.
    const pageAlert = () => container.querySelector('.landing [role="alert"]')
    expect(pageAlert()?.textContent).toBe('')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(pageAlert()?.textContent).toMatch(/could not open/i)
    expect(within(container).getByRole('button', { name: 'Login', hidden: true })).toBeTruthy()
    // A navigation failure does not stop the modal from opening (8.4).
    expect(screen.getByRole('dialog', { name: 'Hello, Again!' })).toBeTruthy()
  })

  it.each([
    ['Login', 'Hello, Again!'],
    ['Register', 'Create account'],
  ])('%s without onNavigate opens the modal without error or page change (8.5)', async (name, dialogName) => {
    const user = userEvent.setup()
    const before = window.location.href
    const { container } = render(<LandingPage />)
    await user.click(screen.getByRole('button', { name }))
    expect(screen.getByRole('dialog', { name: dialogName })).toBeTruthy()
    expect(container.querySelector('.landing [role="alert"]')?.textContent).toBe('')
    expect(window.location.href).toBe(before)
  })

  it('places the four features on the bases in run order: first, second, third, home', () => {
    const { container } = render(<LandingPage onNavigate={vi.fn()} />)
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
    render(<LandingPage onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: title })).toHaveAccessibleDescription(desc)
  })

  it('shows the tagline until a base is selected', () => {
    const { container } = render(<LandingPage onNavigate={vi.fn()} />)
    expect(container.querySelector('.pitch')?.textContent).toBe(TAGLINE)
    expect(container.querySelector('.base.is-active')).toBeNull()
  })

  it.each(BASES)('focusing "%s" shows its description, blurring restores the tagline', (title, desc) => {
    const { container } = render(<LandingPage onNavigate={vi.fn()} />)
    const btn = screen.getByRole('button', { name: title })
    act(() => btn.focus())
    expect(container.querySelector('.pitch')?.textContent).toMatch(desc)
    expect(btn.closest('.base')).toHaveClass('is-active')
    act(() => btn.blur())
    expect(container.querySelector('.pitch')?.textContent).toBe(TAGLINE)
    expect(container.querySelector('.base.is-active')).toBeNull()
  })

  it('mouse hover previews a base and leaving restores the tagline', () => {
    const { container } = render(<LandingPage onNavigate={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Work the Wire' })
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
    expect(container.querySelector('.pitch')?.textContent).toMatch(/waivers/i)
    fireEvent.pointerLeave(btn, { pointerType: 'mouse' })
    expect(container.querySelector('.pitch')?.textContent).toBe(TAGLINE)
  })

  it('touch pointer events do not clear a tapped base', () => {
    const { container } = render(<LandingPage onNavigate={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Own Draft Day' })
    fireEvent.click(btn)
    fireEvent.pointerLeave(btn, { pointerType: 'touch' })
    expect(container.querySelector('.pitch')?.textContent).toMatch(/live rankings/i)
  })

  it('selecting a base never navigates', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<LandingPage onNavigate={onNavigate} />)
    for (const [title] of BASES) await user.click(screen.getByRole('button', { name: title }))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('tab order follows reading order: bases around the diamond, then Register, then Login (7.6)', async () => {
    const user = userEvent.setup()
    render(<LandingPage onNavigate={vi.fn()} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    for (const name of [...BASES.map(([title]) => title), 'Register', 'Login']) {
      await user.tab()
      expect(document.activeElement).toBe(screen.getByRole('button', { name }))
    }
  })
})
