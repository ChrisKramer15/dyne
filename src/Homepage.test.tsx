import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Homepage from './Homepage'
import { ALERTS_PER_PAGE, SPORTS } from './homeData'

describe('Homepage structure and accessibility', () => {
  afterEach(() => cleanup())

  it('renders exactly one level-one heading named Dyne', () => {
    render(<Homepage />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0].textContent).toBe('Dyne')
  })

  it('renders exactly one main landmark', () => {
    render(<Homepage />)
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('gives every interactive control a non-empty accessible name', () => {
    render(<Homepage />)
    const controls = screen.getAllByRole('button')
    expect(controls.length).toBeGreaterThan(0)
    for (const c of controls) {
      expect(c.getAttribute('aria-label') ?? c.textContent?.trim()).toBeTruthy()
    }
  })

  it('has no Sign out button (it moves to the profile page)', () => {
    render(<Homepage />)
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  it('has a bottom nav with Home, Leagues, Chat and Profile, in order', () => {
    render(<Homepage />)
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const buttons = within(nav).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Home', 'Leagues', 'Chat', 'Profile'])
    expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
  })

  it('nav buttons are keyboard focusable', async () => {
    const user = userEvent.setup()
    render(<Homepage />)
    const profile = screen.getByRole('button', { name: 'Profile' })
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(profile)
  })
  it('has no top-right icon buttons', () => {
    render(<Homepage />)
    expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
  })
  it('shows no username and no leagues section', () => {
    render(<Homepage />)
    expect(screen.queryByText(/welcome back/i)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Your leagues' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Alerts' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Needs your attention' })).toBeNull()
  })

  it('caps alerts at 5 per page and paginates the rest', async () => {
    const user = userEvent.setup()
    render(<Homepage />)
    const list = () => within(screen.getByRole('region', { name: 'Alerts' })).getAllByRole('listitem')
    expect(list()).toHaveLength(ALERTS_PER_PAGE)
    expect(ALERTS_PER_PAGE).toBe(3)
    expect(screen.getByText('Page 1 of 3')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Page 2 of 3')).toBeTruthy()
    expect(list()).toHaveLength(ALERTS_PER_PAGE)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Page 3 of 3')).toBeTruthy()
    expect(list()).toHaveLength(1)
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Previous' }))

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(list()).toHaveLength(ALERTS_PER_PAGE)
  })

  it('has no season summary strip', () => {
    render(<Homepage />)
    expect(screen.queryByText(/wallet/i)).toBeNull()
    expect(screen.queryByText(/active contests/i)).toBeNull()
    expect(screen.queryByText(/season points/i)).toBeNull()
  })

  it('shows a Create or join a league card for each of 10 sports', () => {
    render(<Homepage />)
    const region = screen.getByRole('region', { name: 'Create or join a league' })
    const cards = within(region).getAllByRole('button')
    expect(SPORTS).toHaveLength(10)
    expect(cards).toHaveLength(10)
    for (const s of SPORTS) {
      expect(within(region).getByRole('button', { name: `Create or join a ${s.name} league` })).toBeTruthy()
    }
  })
})