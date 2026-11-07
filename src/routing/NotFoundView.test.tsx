import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import NotFoundView from './NotFoundView'

afterEach(cleanup)

function Path() {
  return <div data-testid="path">{useLocation().pathname}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Path />
      <Routes>
        <Route path="*" element={<NotFoundView />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotFoundView', () => {
  it('renders exactly one h1 "Page not found"', () => {
    renderAt('/nope')
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0].textContent).toBe('Page not found')
  })

  it('has a "Go to Dyne" link to "/"', () => {
    renderAt('/nope')
    expect(screen.getByRole('link', { name: 'Go to Dyne' }).getAttribute('href')).toBe('/')
  })

  it('navigates to "/" when the link is clicked', async () => {
    renderAt('/nope')
    expect(screen.getByTestId('path').textContent).toBe('/nope')
    await userEvent.click(screen.getByRole('link', { name: 'Go to Dyne' }))
    expect(screen.getByTestId('path').textContent).toBe('/')
  })
})
