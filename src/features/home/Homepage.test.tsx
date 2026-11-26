import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import Homepage from './Homepage'
import { ALERTS_PER_PAGE, SPORTS } from './homeData'
import type { LeagueService } from '../leagues/wizard/leagueService'

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/home']}>
      <Homepage />
    </MemoryRouter>,
  )

describe('Homepage structure and accessibility', () => {
  afterEach(() => cleanup())

  it('renders exactly one level-one heading named Dyne', () => {
    renderHome()
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0].textContent).toBe('Dyne')
  })

  it('renders exactly one main landmark', () => {
    renderHome()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('gives every interactive control a non-empty accessible name', () => {
    renderHome()
    const controls = screen.getAllByRole('button')
    expect(controls.length).toBeGreaterThan(0)
    for (const c of controls) {
      expect(c.getAttribute('aria-label') ?? c.textContent?.trim()).toBeTruthy()
    }
  })

  it('has no Sign out button (it moves to the profile page)', () => {
    renderHome()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  it('has a bottom nav with Home, Leagues, Chat and Profile, in order', () => {
    renderHome()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const items = within(nav).getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['Home', 'Leagues', 'Chat', 'Profile'])
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Leagues' }).getAttribute('href')).toBe('/leagues')
    expect(within(nav).getByRole('link', { name: 'Leagues' }).getAttribute('aria-current')).toBeNull()
  })

  it('nav items are keyboard focusable', async () => {
    const user = userEvent.setup()
    renderHome()
    const profile = screen.getByRole('link', { name: 'Profile' })
    expect(profile.getAttribute('href')).toBe('/profile')
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(profile)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Chat' }))
  })
  it('has no top-right icon buttons', () => {
    renderHome()
    expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
  })
  it('shows no username and no leagues section', () => {
    renderHome()
    expect(screen.queryByText(/welcome back/i)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Your leagues' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Alerts' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Needs your attention' })).toBeNull()
  })

  it('caps alerts at 5 per page and paginates the rest', async () => {
    const user = userEvent.setup()
    renderHome()
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
    renderHome()
    expect(screen.queryByText(/wallet/i)).toBeNull()
    expect(screen.queryByText(/active contests/i)).toBeNull()
    expect(screen.queryByText(/season points/i)).toBeNull()
  })

  it('shows a Create league header with one card per league format', () => {
    renderHome()
    const region = screen.getByRole('region', { name: 'Create league' })
    expect(SPORTS).toHaveLength(1)
    expect(within(region).getByRole('heading', { name: 'Create league' })).toBeTruthy()
    expect(within(region).queryByRole('heading', { name: /Baseball/ })).toBeNull()
    const names = SPORTS[0].formats.map((f) => f.name)
    expect(names).toEqual(['Bestball', 'Dynasty', 'Guillotine', 'Keeper', 'Redraft'])
    expect(within(region).getAllByRole('button')).toHaveLength(names.length)
    for (const n of names) {
      expect(within(region).getByRole('button', { name: `Create a ${n} Baseball league` })).toBeTruthy()
    }
  })
})
describe('Homepage create league wizard', () => {
  afterEach(() => cleanup())

  const card = (format: string) => screen.getByRole('button', { name: `Create a ${format} Baseball league` })
  const dialog = () => screen.queryByRole('dialog', { name: /^Create a .+ league$/ })

  it.each([
    ['click', async (u: ReturnType<typeof userEvent.setup>) => u.click(card('Guillotine'))],
    ['Enter', async (u: ReturnType<typeof userEvent.setup>) => { card('Guillotine').focus(); await u.keyboard('{Enter}') }],
    ['Space', async (u: ReturnType<typeof userEvent.setup>) => { card('Guillotine').focus(); await u.keyboard(' ') }],
  ])('%s opens the wizard with the card format (1.1, 1.3)', async (_label, act) => {
    const user = userEvent.setup()
    renderHome()
    expect(dialog()).toBeNull()
    await act(user)
    expect(dialog()).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Create a Guillotine league' })).toBeTruthy()
    expect(screen.getByText('Step 1 of 3: General')).toBeTruthy()
    expect(screen.queryAllByRole('radio', { name: /Keeper|Redraft/ })).toHaveLength(0)
  })

  it('returns focus to the card when the wizard closes (1.4)', async () => {
    const user = userEvent.setup()
    renderHome()
    await user.click(card('Keeper'))
    expect(dialog()).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(card('Keeper'))
  })

  it('focuses the Create league heading when the card is gone (1.4)', async () => {
    const user = userEvent.setup()
    renderHome()
    const opener = card('Redraft')
    await user.click(opener)
    opener.remove()
    await user.keyboard('{Escape}')
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(document.getElementById('dash-join'))
  })

  it('navigates to /leagues after a successful creation (8.4)', async () => {
    const user = userEvent.setup()
    const leagueService: LeagueService = {
      createLeague: vi.fn(async () => ({ ok: true as const, leagueId: 'l1' })),
    }
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<Homepage leagueService={leagueService} />} />
          <Route path="/leagues" element={<p>Leagues page</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(card('Dynasty'))
    await user.type(screen.getByLabelText('League name'), 'Sandlot Kings')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Next' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Create league' }))
    expect(await screen.findByText('Leagues page')).toBeTruthy()
    expect(leagueService.createLeague).toHaveBeenCalledTimes(1)
    expect(dialog()).toBeNull()
  })
})