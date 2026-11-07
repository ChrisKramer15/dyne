import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, act, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router'
import { RouteEffects } from './RouteEffects'

let settledKey = 'a'

function Layout() {
  return (
    <>
      <RouteEffects settledKey={settledKey} />
      <button>other</button>
      <Outlet />
    </>
  )
}

function page(heading: string) {
  return (
    <main>
      <h1 tabIndex={-1}>{heading}</h1>
    </main>
  )
}

function makeRouter(initial: string) {
  return createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/', element: page('Welcome'), handle: { access: 'public', title: 'Dyne' } },
          { path: '/home', element: page('Home'), handle: { access: 'authenticated', title: 'Home' } },
          { path: '/other', element: page('Other'), handle: { access: 'authenticated', title: 'Other' } },
        ],
      },
    ],
    { initialEntries: [initial] },
  )
}

afterEach(() => {
  cleanup()
  document.title = ''
  document.body.innerHTML = ''
  settledKey = 'a'
})

describe('RouteEffects', () => {
  it('focuses the main h1 at first settle', () => {
    render(<RouterProvider router={makeRouter('/home')} />)
    const h1 = document.querySelector('main h1')
    expect(document.activeElement).toBe(h1)
  })

  it('sets the title to "<title> – Dyne" for titled views', () => {
    render(<RouterProvider router={makeRouter('/home')} />)
    expect(document.title).toBe('Home – Dyne')
  })

  it('sets the title to "Dyne" for the landing view', () => {
    render(<RouterProvider router={makeRouter('/')} />)
    expect(document.title).toBe('Dyne')
  })

  it('sets the title to "Dyne" for the recovery key', () => {
    settledKey = 'recovery'
    render(<RouterProvider router={makeRouter('/home')} />)
    expect(document.title).toBe('Dyne')
  })

  it('does not refocus or retitle when the settled key is unchanged', async () => {
    const router = makeRouter('/home')
    render(<RouterProvider router={router} />)
    const button = document.querySelector('button') as HTMLButtonElement
    button.focus()
    await act(async () => {
      await router.navigate('/other')
    })
    expect(document.activeElement).toBe(button)
    expect(document.title).toBe('Home – Dyne')
  })

  it('defers focus while a dialog is open and applies it after it closes', async () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)

    render(<RouterProvider router={makeRouter('/home')} />)
    const h1 = document.querySelector('main h1')
    expect(document.activeElement).not.toBe(h1)
    expect(document.title).not.toBe('Home – Dyne')

    await act(async () => {
      dialog.remove()
    })
    await waitFor(() => expect(document.activeElement).toBe(h1))
    expect(document.title).toBe('Home – Dyne')
  })
})
