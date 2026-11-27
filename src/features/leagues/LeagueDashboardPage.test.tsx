import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import LeagueDashboardPage from './LeagueDashboardPage'
import type { LeagueDetail, LeagueDetailLoader, LoadLeagueResult } from './leagueDetailLoader'

afterEach(cleanup)

const league: LeagueDetail = {
  id: 'l1',
  name: 'Sandlot',
  sport: 'Baseball',
  emoji: 'x',
  leagueType: 'Dynasty',
  teamCount: 12,
  memberCount: 1,
  isCommissioner: true,
  scoring: { h_homeRuns: 4, h_strikeouts: -0.5 },
  createdAt: '2025-03-01T00:00:00Z',
}
const loaderOf = (res: LoadLeagueResult): LeagueDetailLoader => ({ loadLeague: () => Promise.resolve(res) })
const renderPage = (res: LoadLeagueResult) =>
  render(
    <MemoryRouter>
      <LeagueDashboardPage leagueId="l1" loader={loaderOf(res)} />
    </MemoryRouter>,
  )

describe('LeagueDashboardPage', () => {
  it('shows the league name as the only h1, with the overview selected', async () => {
    renderPage({ ok: true, league })
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Sandlot')
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Season status' })).toBeTruthy()
  })

  it('lists open spots in the full standings tab', async () => {
    renderPage({ ok: true, league })
    await userEvent.click(await screen.findByRole('tab', { name: 'Standings' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getAllByText('Open spot')).toHaveLength(11)
  })

  it('shows saved scoring values on the settings tab', async () => {
    renderPage({ ok: true, league })
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('+4')).toBeTruthy()
    expect(within(panel).getByText('-0.5')).toBeTruthy()
  })

  it('moves between tabs with the arrow keys', async () => {
    renderPage({ ok: true, league })
    const first = await screen.findByRole('tab', { name: 'Overview' })
    first.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'My team' }).getAttribute('aria-selected')).toBe('true')
  })

  it('shows an alert on load failure', async () => {
    renderPage({ ok: false, reason: 'error', message: 'This league could not be loaded.' })
    expect((await screen.findByRole('alert')).textContent).toBe('This league could not be loaded.')
  })

  it('shows the not-found page for an unknown league', async () => {
    renderPage({ ok: false, reason: 'not_found', message: 'League not found.' })
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  })
})
