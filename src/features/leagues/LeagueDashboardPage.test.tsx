import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import LeagueDashboardPage from './LeagueDashboardPage'

afterEach(cleanup)

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/leagues/l1']}>
      <LeagueDashboardPage leagueId="l1" />
    </MemoryRouter>,
  )

describe('LeagueDashboardPage', () => {
  it('shows only the league navigation', () => {
    const { container } = renderPage()
    expect(container.querySelector('main')).toBeNull()
    const nav = screen.getByRole('navigation', { name: 'League' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Overview', 'Chat', 'Back to Home'])
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
  })

  it('links Overview to the league, Chat to its chat and Back to Home to the leagues list', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('href')).toBe('/leagues/l1')
    expect(screen.getByRole('link', { name: 'Chat' }).getAttribute('href')).toBe('/leagues/l1/chat')
    expect(screen.getByRole('link', { name: 'Back to Home' }).getAttribute('href')).toBe('/leagues')
  })

  it('marks Overview as the current page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe('page')
  })
})
