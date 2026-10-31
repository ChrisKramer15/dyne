import { render, screen } from '@testing-library/react'
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
    ['Login', 'login'],
    ['Register', 'register'],
  ])('%s navigates on click (4.4, 4.5)', async (name, target) => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<LandingPage onNavigate={onNavigate} />)
    await user.click(screen.getByRole('button', { name }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith(target)
  })

  it.each([
    ['Login', 'login', '{Enter}'],
    ['Login', 'login', ' '],
    ['Register', 'register', '{Enter}'],
    ['Register', 'register', ' '],
  ])('%s navigates on keyboard %j (4.4, 4.5, 7.6)', async (name, target, key) => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<LandingPage onNavigate={onNavigate} />)
    screen.getByRole('button', { name }).focus()
    await user.keyboard(key)
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith(target)
  })

  it('shows an alert message when navigation throws and stays on the page (4.6)', async () => {
    const onNavigate = vi.fn(() => {
      throw new Error('boom')
    })
    const user = userEvent.setup()
    render(<LandingPage onNavigate={onNavigate} />)
    expect(screen.getByRole('alert').textContent).toBe('')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(screen.getByRole('alert').textContent).toMatch(/could not open/i)
    expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy()
  })

  it('attribution links point to Unsplash and open safely in a new tab (3.6, 3.7)', () => {
    render(<LandingPage onNavigate={vi.fn()} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(new URL(link.getAttribute('href')!).hostname).toBe('unsplash.com')
      expect(link.getAttribute('target')).toBe('_blank')
      const rel = (link.getAttribute('rel') ?? '').split(/\s+/)
      expect(rel).toContain('noopener')
      expect(rel).toContain('noreferrer')
    }
    expect(screen.getByRole('link', { name: 'Unsplash' })).toBeTruthy()
  })

  it('tab order follows reading order (7.6)', async () => {
    const user = userEvent.setup()
    render(<LandingPage onNavigate={vi.fn()} />)
    const links = screen.getAllByRole('link')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Login' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Register' }))
    await user.tab()
    expect(document.activeElement).toBe(links[0])
    await user.tab()
    expect(document.activeElement).toBe(links[1])
  })
})
