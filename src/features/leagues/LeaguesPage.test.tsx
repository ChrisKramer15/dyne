import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
// testUtils must be imported before routes (it installs the Supabase mock).
import { renderApp } from '../../routing/testUtils'
import LeaguesPage from './LeaguesPage'
import type { FavoriteService } from './favoriteService'
import type { LeagueService } from './wizard/leagueService'
import { SPORTS } from '../home/homeData'
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

  it('shows "No leagues yet." when the user has none', async () => {
    renderLeagues()
    expect((await screen.findByText('No leagues yet.')).textContent).toBe('No leagues yet.')
    expect(cards()).toHaveLength(0)
    expect(screen.getByText(/^0 leagues/)).toBeTruthy()
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

  it('filters by sport and offers only sports from loaded leagues', async () => {
    const user = userEvent.setup()
    const leagues = [mk('a', 'Diamond', 'Baseball'), mk('b', 'Gridiron', 'Football'), mk('c', 'Pitch', 'Baseball')]
    renderLeagues(loaderOf({ ok: true, leagues }))
    await screen.findByRole('article', { name: 'Diamond' })
    const options = within(screen.getByLabelText('Sport')).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['All sports', 'Baseball', 'Football'])
    await user.selectOptions(screen.getByLabelText('Sport'), 'Baseball')
    expect(cards()).toHaveLength(2)
    for (const c of cards()) expect(c.textContent).toContain('Baseball')
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
  it('shows one card per league format, with only Dynasty enabled', () => {
    renderLeagues()
    const region = screen.getByRole('region', { name: 'Create league' })
    const names = SPORTS[0].formats.map((f) => f.name)
    expect(within(region).getAllByRole('button')).toHaveLength(names.length)
    for (const f of SPORTS[0].formats) {
      const button = within(region).getByRole('button', { name: `Create a ${f.name} Baseball league` })
      if (f.name === 'Dynasty') expect(button).toBeEnabled()
      else expect(button).toBeDisabled()
    }
  })

  it('opens the themed wizard for an enabled format and closes it on Cancel', async () => {
    const user = userEvent.setup()
    const { container } = renderLeagues()
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Create a Dynasty Baseball league' }))
    expect(screen.getByRole('dialog', { name: 'General Settings' })).toBeTruthy()
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
