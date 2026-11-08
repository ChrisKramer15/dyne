import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './testUtils'

afterEach(cleanup)

describe('auth transitions while mounted', () => {
  // Requirement 4.5
  it('loading -> authenticated at /home stays on /home and renders the Homepage', async () => {
    const app = renderApp({ status: 'loading', path: '/home' })
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')

    await app.setAuth('authenticated')

    expect(app.currentUrl()).toBe('/home')
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play Ball' })).not.toBeInTheDocument()
    app.router.dispose()
  })

  // Requirement 4.6
  it('loading -> unauthenticated at /home redirects to / with the modal closed', async () => {
    const app = renderApp({ status: 'loading', path: '/home' })

    await app.setAuth('unauthenticated')

    await waitFor(() => expect(app.currentUrl()).toBe('/'))
    expect(screen.getByRole('button', { name: 'Play Ball' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    app.router.dispose()
  })

  // Requirements 2.4, 6.4, 8.2
  it('unauthenticated -> authenticated on / goes to /home with the modal closed and one /home entry', async () => {
    const app = renderApp({ status: 'unauthenticated', path: '/' })
    await userEvent.click(screen.getByRole('button', { name: 'Play Ball' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const visited: string[] = []
    const unsubscribe = app.router.subscribe((s) => visited.push(s.location.pathname))

    await app.setAuth('authenticated')
    await waitFor(() => expect(app.currentUrl()).toBe('/home'))
    unsubscribe()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play Ball' })).not.toBeInTheDocument()
    expect(visited.filter((p) => p === '/home')).toHaveLength(1)

    // Back must not reveal the Landing_Page.
    await act(async () => {
      await app.router.navigate(-1)
    })
    expect(app.currentUrl()).toBe('/home')
    app.router.dispose()
  })

  // Requirement 3.4
  it('authenticated -> unauthenticated on /home redirects to /', async () => {
    const app = renderApp({ status: 'authenticated', path: '/home' })
    expect(app.currentUrl()).toBe('/home')

    await app.setAuth('unauthenticated')

    await waitFor(() => expect(app.currentUrl()).toBe('/'))
    expect(screen.getByRole('button', { name: 'Play Ball' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    app.router.dispose()
  })

  // Requirement 5.4
  it('recovering -> authenticated goes to /home and closes the dialog', async () => {
    const app = renderApp({ status: 'recovering', path: '/' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await app.setAuth('authenticated')

    await waitFor(() => expect(app.currentUrl()).toBe('/home'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    app.router.dispose()
  })

  // Requirement 5.5
  it('a failed password update keeps the update-password dialog open on /', async () => {
    const app = renderApp({ status: 'recovering', path: '/' })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Choose a new password')

    await userEvent.type(screen.getByLabelText('New password'), 'new-password-1')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-password-1')
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('Choose a new password')
    expect(app.currentUrl()).toBe('/')
    app.router.dispose()
  })
})
