import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
// testUtils must be imported before routes (it installs the Supabase mock).
import { renderApp } from '../../routing/testUtils'
import LeaguesPage from './LeaguesPage'
import type { FavoriteService } from './favoriteService'
import type { LeagueService } from './wizard/leagueService'
import type { LeagueLoader, LoadLeaguesResult } from './leagueLoader'
import { LEAGUES_PER_PAGE, MAX_TOP_LEAGUES, ordinal, type League } from './leaguesData'

afterEach(cleanup)

const loaderOf = (res: LoadLeaguesResult): LeagueLoader => ({ loadMyLeagues: () => Promise.resolve(res) })
const none = loaderOf({ ok: true, leagues: [] })

const renderLeagues = (loader: LeagueLoader = none, extra: { favoriteService?: FavoriteService; wizardService?: LeagueService } = {}) =>
  render(
    <MemoryRouter initialEntries={['/leagues']}>
      <LeaguesPage loader={loader} {...extra} />
    </MemoryRouter>,
  )

const mk = (id: string, name: string, sport = 'Baseball'): League => ({
  id,
  name,
  sport,
  emoji: '⚾',
  leagueType: 'Dynasty',
  isFavorite: false,
  record: '0-0',
  rank: 1,
  teams: 12,
  matchup: { opponent: 'TBD', status: 'upcoming', myScore: null, theirScore: null, note: 'Season not started' },
})

const cards = () =>
  within(screen.getByRole('region', { name: 'My leagues' })).queryAllByRole('article')

describe('LeaguesPage', () => {
  it('renders one level-one heading named Leagues and one main landmark', () => {
    renderLeagues()
    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toBe('Leagues')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  const fakeLeagues = (n: number, sport = 'Baseball') =>
    Array.from({ length: n }, (_, i) => mk(`id${i}`, `League ${String(i).padStart(2, '0')}`, sport))

  it('shows a card for each loaded league with record, rank and opponent', async () => {
    const leagues = fakeLeagues(3)
    renderLeagues(loaderOf({ ok: true, leagues }))
    await screen.findByRole('article', { name: 'League 00' })
    expect(cards()).toHaveLength(3)
    for (const l of leagues) {
      const card = screen.getByRole('article', { name: l.name })
      expect(card.textContent).toContain(l.record)
      expect(card.textContent).toContain(`${ordinal(l.rank)} of ${l.teams}`)
      expect(card.textContent).toContain(`vs ${l.matchup.opponent}`)
    }
  })

  it('keeps the loader order (newest first) instead of sorting by name', async () => {
    renderLeagues(loaderOf({ ok: true, leagues: [mk('n', 'Zed New'), mk('o', 'Alpha Old')] }))
    await screen.findByRole('article', { name: 'Zed New' })
    expect(cards().map((c) => c.querySelector('h3')?.textContent)).toEqual(['Zed New', 'Alpha Old'])
  })

  it('shows "No baseball leagues yet." when the user has none', async () => {
    renderLeagues()
    expect((await screen.findByText('No baseball leagues yet.')).textContent).toBe('No baseball leagues yet.')
    expect(cards()).toHaveLength(0)
  })

  it('shows a loading state, then removes it', async () => {
    renderLeagues()
    expect(screen.getByRole('status').textContent).toContain('Loading')
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('shows an error and no leagues when loading fails', async () => {
    renderLeagues(loaderOf({ ok: false, reason: 'Your leagues could not be loaded.' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Your leagues could not be loaded.')
    expect(cards()).toHaveLength(0)
  })

  it('paginates when there are more leagues than fit on a page', async () => {
    const user = userEvent.setup()
    renderLeagues(loaderOf({ ok: true, leagues: fakeLeagues(LEAGUES_PER_PAGE + 2) }))
    await screen.findByRole('article', { name: 'League 00' })
    expect(cards()).toHaveLength(LEAGUES_PER_PAGE)
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(cards()).toHaveLength(2)
  })

  it('shows only the leagues for the selected sport', async () => {
    const leagues = [mk('a', 'Diamond', 'Baseball'), mk('b', 'Gridiron', 'Football'), mk('c', 'Pitch', 'Baseball')]
    renderLeagues(loaderOf({ ok: true, leagues }))
    await screen.findByRole('article', { name: 'Diamond' })
    expect(cards().map((c) => c.querySelector('h3')?.textContent)).toEqual(['Diamond', 'Pitch'])
  })
  it('orders sections Sport Category, My leagues', () => {
    renderLeagues()
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(names).toEqual(['Sport Category', 'My leagues'])
  })
  it('offers a card for baseball, football, basketball and hockey, with baseball selected', () => {
    renderLeagues()
    const region = screen.getByRole('region', { name: 'Sport Category' })
    const buttons = within(region).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['\u26BEBaseball', '\u{1F3C8}Football', '\u{1F3C0}Basketball', '\u{1F3D2}Hockey'])
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false'])
    expect(screen.queryByText(/coming soon/i)).toBeNull()
  })
  it('shows a coming soon banner and hides My leagues for sports that are not set up', async () => {
    const user = userEvent.setup()
    renderLeagues()
    for (const name of ['Football', 'Basketball', 'Hockey']) {
      await user.click(screen.getByRole('button', { name: new RegExp(name) }))
      expect(screen.getByRole('status').textContent).toBe('Coming Soon!')
      expect(screen.queryByRole('region', { name: 'My leagues' })).toBeNull()
    }
    await user.click(screen.getByRole('button', { name: /Baseball/ }))
    expect(screen.queryByText(/coming soon/i)).toBeNull()
    expect(screen.getByRole('region', { name: 'My leagues' })).toBeTruthy()
  })

  it('marks Leagues as the current page in the bottom nav', () => {
    renderLeagues()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).getByRole('link', { name: 'Leagues' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull()
  })

  it('ordinal formats ranks', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd',
    ])
  })
})

describe('LeaguesPage Create league', () => {
  it('has a Create league button in the My leagues section and no Create league section', () => {
    renderLeagues()
    const region = screen.getByRole('region', { name: 'My leagues' })
    expect(within(region).getByRole('button', { name: /Create league/ })).toBeEnabled()
    expect(screen.queryByRole('region', { name: 'Create league' })).toBeNull()
  })
  it('hides the button along with My leagues for sports that are not set up yet', async () => {
    const user = userEvent.setup()
    renderLeagues()
    await user.click(screen.getByRole('button', { name: /Hockey/ }))
    expect(screen.queryByRole('button', { name: /Create league/ })).toBeNull()
  })
  it('opens the wizard for the selected sport and closes it on Cancel', async () => {
    const user = userEvent.setup()
    const { container } = renderLeagues()
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Create league/ }))
    expect(screen.getByRole('dialog', { name: 'General Settings' })).toBeTruthy()
    expect(screen.getByText(/New Dynasty Baseball league/)).toBeTruthy()
    expect(container.querySelector('.league-wizard')?.classList.contains('accent-green')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('LeaguesPage top league stars', () => {
  const withFav = (id: string, name: string, isFavorite: boolean): League => ({ ...mk(id, name), isFavorite })
  const fav = (res: { ok: true } | { ok: false; reason: string } = { ok: true }) => {
    const calls: [string, boolean][] = []
    const service: FavoriteService = {
      setFavorite: (id, favorite) => {
        calls.push([id, favorite])
        return Promise.resolve(res)
      },
    }
    return { calls, service }
  }

  it('shows a pressed star on starred leagues and an unpressed one on the rest', async () => {
    renderLeagues(loaderOf({ ok: true, leagues: [withFav('a', 'Alpha', true), withFav('b', 'Bravo', false)] }))
    expect((await screen.findByRole('button', { name: 'Remove Alpha from top leagues' })).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Add Bravo to top leagues' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('stars a league through the service and updates the card', async () => {
    const user = userEvent.setup()
    const { calls, service } = fav()
    renderLeagues(loaderOf({ ok: true, leagues: [withFav('a', 'Alpha', false)] }), { favoriteService: service })
    await user.click(await screen.findByRole('button', { name: 'Add Alpha to top leagues' }))
    expect(calls).toEqual([['a', true]])
    expect(await screen.findByRole('button', { name: 'Remove Alpha from top leagues' })).toBeTruthy()
  })

  it('unstars a league', async () => {
    const user = userEvent.setup()
    const { calls, service } = fav()
    renderLeagues(loaderOf({ ok: true, leagues: [withFav('a', 'Alpha', true)] }), { favoriteService: service })
    await user.click(await screen.findByRole('button', { name: 'Remove Alpha from top leagues' }))
    expect(calls).toEqual([['a', false]])
    expect(await screen.findByRole('button', { name: 'Add Alpha to top leagues' })).toBeTruthy()
  })

  it('blocks a star over the limit without calling the service', async () => {
    const user = userEvent.setup()
    const { calls, service } = fav()
    const leagues = [withFav('x', 'Extra', false), ...Array.from({ length: MAX_TOP_LEAGUES }, (_, i) => withFav(`f${i}`, `Fav ${i}`, true))]
    renderLeagues(loaderOf({ ok: true, leagues }), { favoriteService: service })
    await user.click(await screen.findByRole('button', { name: 'Add Extra to top leagues' }))
    expect((await screen.findByRole('alert')).textContent).toContain(`up to ${MAX_TOP_LEAGUES}`)
    expect(calls).toEqual([])
    expect(screen.getByRole('button', { name: 'Add Extra to top leagues' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('keeps the star unchanged and shows the reason when saving fails', async () => {
    const user = userEvent.setup()
    const { service } = fav({ ok: false, reason: 'Nope.' })
    renderLeagues(loaderOf({ ok: true, leagues: [withFav('a', 'Alpha', false)] }), { favoriteService: service })
    await user.click(await screen.findByRole('button', { name: 'Add Alpha to top leagues' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Nope.')
    expect(screen.getByRole('button', { name: 'Add Alpha to top leagues' }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('Leagues routing', () => {
  it('the Leagues nav icon opens /leagues and Home brings you back', async () => {
    const user = userEvent.setup()
    const app = renderApp({ status: 'authenticated', path: '/home' })
    await screen.findByRole('heading', { level: 2, name: 'Alerts' })

    await user.click(screen.getByRole('link', { name: 'Leagues' }))
    await waitFor(() => expect(app.location().pathname).toBe('/leagues'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Leagues' })).toBeTruthy()
    await waitFor(() => expect(document.title).toBe('Leagues – Dyne'))

    await user.click(screen.getByRole('link', { name: 'Home' }))
    await waitFor(() => expect(app.location().pathname).toBe('/home'))
  })

  it('/leagues is protected: signed-out users are sent to /', async () => {
    const app = renderApp({ status: 'unauthenticated', path: '/leagues' })
    await waitFor(() => expect(app.location().pathname).toBe('/'))
    expect(screen.queryByRole('heading', { level: 1, name: 'Leagues' })).toBeNull()
  })
})
