import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
// testUtils must be imported before routes (it installs the Supabase mock).
import { renderApp } from '../../routing/testUtils'
import LeaguesPage from './LeaguesPage'
import { LEAGUES, LEAGUES_PER_PAGE, ordinal } from './leaguesData'

afterEach(cleanup)

const renderLeagues = () =>
  render(
    <MemoryRouter initialEntries={['/leagues']}>
      <LeaguesPage />
    </MemoryRouter>,
  )

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

  it('shows a card for every league with record, rank and opponent', () => {
    renderLeagues()
    const firstPage = LEAGUES.slice(0, LEAGUES_PER_PAGE)
    expect(cards()).toHaveLength(firstPage.length)
    for (const l of firstPage) {
      const card = screen.getByRole('article', { name: l.name })
      expect(card.textContent).toContain(l.record)
      expect(card.textContent).toContain(`${ordinal(l.rank)} of ${l.teams}`)
      expect(card.textContent).toContain(`vs ${l.matchup.opponent}`)
    }
  })

  it('has no sport filter', () => {
    renderLeagues()
    expect(screen.queryByRole('group', { name: 'Filter by sport' })).toBeNull()
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
