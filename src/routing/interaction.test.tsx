import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderApp, type RenderAppResult } from './testUtils'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.title = ''
  document.body.innerHTML = ''
})

const h1 = () => document.querySelector('main h1')
const dialog = () => document.querySelector('[role="dialog"]')

/** Records every element that receives .focus(). */
function spyOnFocus() {
  const targets: HTMLElement[] = []
  const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement) {
    targets.push(this)
  })
  return { targets, spy }
}

/** Counts router state updates (navigations) after this call. */
function countNavigations(app: RenderAppResult) {
  const seen = { count: 0 }
  app.router.subscribe(() => {
    seen.count += 1
  })
  return seen
}

describe('Auth modal does not touch the URL or history (Req 6.1, 6.2)', () => {
  it.each([
    ['Register', 'register'],
    ['Login', 'login'],
  ])('opening and closing the %s dialog leaves location and history unchanged', async (label) => {
    const app = renderApp({ status: 'unauthenticated', path: '/' })
    await waitFor(() => expect(h1()).not.toBeNull())
    const before = app.location()
    const navigations = countNavigations(app)

    fireEvent.click(screen.getByRole('button', { name: label }))
    await waitFor(() => expect(dialog()).not.toBeNull())
    expect(app.location()).toBe(before)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(dialog()).toBeNull())

    expect(app.location()).toBe(before)
    expect(app.currentUrl()).toBe('/')
    expect(navigations.count).toBe(0)

    // History length unchanged: going back has nowhere to go.
    await act(async () => {
      await app.router.navigate(-1)
    })
    expect(app.currentUrl()).toBe('/')
  })
})

describe('Focus management (Req 10.3, 10.5, 10.7, 10.8)', () => {
  it('does not move focus or set the title while auth is pending (10.5)', async () => {
    const { targets } = spyOnFocus()
    document.title = 'untouched'
    const app = renderApp({ status: 'loading', path: '/' })

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
    expect(targets).toHaveLength(0)
    expect(document.title).toBe('untouched')

    await app.setAuth('unauthenticated')
    await waitFor(() => expect(targets).toContain(h1()))
  })

  it('focuses only the final heading after a redirect (10.3)', async () => {
    const { targets } = spyOnFocus()
    const app = renderApp({ status: 'authenticated', path: '/' })

    await waitFor(() => expect(app.currentUrl()).toBe('/home'))
    await waitFor(() => expect(targets.length).toBeGreaterThan(0))

    const finalHeading = h1()
    expect(finalHeading).not.toBeNull()
    expect(targets.every((el) => el === finalHeading)).toBe(true)
    expect(document.title).toBe('Home – Dyne')
  })

  it('does not refocus on same-path navigation (10.7)', async () => {
    const { targets } = spyOnFocus()
    const app = renderApp({ status: 'authenticated', path: '/home' })
    await waitFor(() => expect(targets.length).toBeGreaterThan(0))
    const callsBefore = targets.length

    await act(async () => {
      await app.router.navigate('/home')
    })
    await act(async () => {
      await app.router.navigate('/home')
    })

    expect(app.currentUrl()).toBe('/home')
    expect(targets).toHaveLength(callsBefore)
  })

  it('applies title and focus on Back and Forward (10.8)', async () => {
    const { targets } = spyOnFocus()
    const app = renderApp({ status: 'unauthenticated', path: '/' })
    await waitFor(() => expect(document.title).toBe('Dyne'))

    await act(async () => {
      await app.router.navigate('/nowhere')
    })
    await waitFor(() => expect(document.title).toBe('Page not found – Dyne'))
    await waitFor(() => expect(targets.at(-1)).toBe(h1()))

    await act(async () => {
      await app.router.navigate(-1)
    })
    await waitFor(() => expect(app.currentUrl()).toBe('/'))
    await waitFor(() => expect(document.title).toBe('Dyne'))
    await waitFor(() => expect(targets.at(-1)).toBe(h1()))
    expect(h1()?.textContent).toBe('Dyne')

    await act(async () => {
      await app.router.navigate(1)
    })
    await waitFor(() => expect(app.currentUrl()).toBe('/nowhere'))
    await waitFor(() => expect(document.title).toBe('Page not found – Dyne'))
    await waitFor(() => expect(targets.at(-1)).toBe(h1()))
    expect(h1()?.textContent).not.toBe('Dyne')
  })
})

describe('Recovery dialog (Req 5.6)', () => {
  it('stays open on Escape, Close and backdrop click', async () => {
    renderApp({ status: 'recovering', path: '/' })
    await waitFor(() => expect(dialog()).not.toBeNull())

    fireEvent.keyDown(dialog()!, { key: 'Escape' })
    expect(dialog()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(dialog()).not.toBeNull()

    // Backdrop is the dialog's parent; clicking it directly must not dismiss.
    fireEvent.click(dialog()!.parentElement!)
    expect(dialog()).not.toBeNull()
  })
})
