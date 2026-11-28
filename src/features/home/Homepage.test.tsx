import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import Homepage from './Homepage'
import { ALERTS_PER_PAGE } from './homeData'
import type { LeagueLoader, LoadLeaguesResult } from '../leagues/leagueLoader'
import { MAX_TOP_LEAGUES, type League } from '../leagues/leaguesData'

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
    expect(items).toEqual(['Home', 'Leagues', 'Messages', 'Profile'])
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
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Messages' }))
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

  it('no longer shows the Create league section', () => {
    renderHome()
    expect(screen.queryByRole('region', { name: 'Create league' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Create a/ })).toBeNull()
  })
})

const league = (id: string, name: string, emoji: string, isFavorite: boolean): League => ({
  id,
  name,
  sport: 'Baseball',
  emoji,
  leagueType: 'Dynasty',
  isFavorite,
  record: '0-0',
  rank: 1,
  teams: 12,
  matchup: { opponent: 'TBD', status: 'upcoming', myScore: null, theirScore: null, note: 'Season not started' },
})
const loaderOf = (res: LoadLeaguesResult): LeagueLoader => ({ loadMyLeagues: () => Promise.resolve(res) })
const renderWith = (loader: LeagueLoader) =>
  render(
    <MemoryRouter initialEntries={['/home']}>
      <Homepage loader={loader} />
    </MemoryRouter>,
  )
const topRegion = () => screen.getByRole('region', { name: 'Top leagues' })

describe('Homepage Top leagues', () => {
  afterEach(() => cleanup())

  it('shows only starred leagues, each as an avatar bubble with its title, linking to the league', async () => {
    renderWith(
      loaderOf({
        ok: true,
        leagues: [league('a', 'Alpha', '🦁', true), league('b', 'Bravo', '🚀', false), league('c', 'Charlie', '🏆', true)],
      }),
    )
    await within(topRegion()).findByRole('link', { name: /Alpha/ })
    const links = within(topRegion()).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['🦁Alpha', '🏆Charlie'])
    expect(links[0].getAttribute('href')).toBe('/leagues/a')
    expect(within(topRegion()).queryByText('Bravo')).toBeNull()
  })

  it('shows at most 5 leagues', async () => {
    const leagues = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => league(id, `League ${id}`, '⚾', true))
    renderWith(loaderOf({ ok: true, leagues }))
    await within(topRegion()).findByRole('link', { name: /League a/ })
    expect(within(topRegion()).getAllByRole('listitem')).toHaveLength(MAX_TOP_LEAGUES)
  })

  it('tells the user how to add favorites when none are starred', async () => {
    renderWith(loaderOf({ ok: true, leagues: [league('a', 'Alpha', '🦁', false)] }))
    expect(await within(topRegion()).findByText(/Add a league to your favorites from the/)).toBeTruthy()
    expect(within(topRegion()).getByRole('link', { name: 'Leagues page' }).getAttribute('href')).toBe('/leagues')
    expect(within(topRegion()).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('shows an error when leagues cannot be loaded', async () => {
    renderWith(loaderOf({ ok: false, reason: 'Your leagues could not be loaded.' }))
    expect((await within(topRegion()).findByRole('alert')).textContent).toBe('Your leagues could not be loaded.')
  })
})