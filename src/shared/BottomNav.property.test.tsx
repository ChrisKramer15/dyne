import { cleanup, render, screen } from '@testing-library/react'
import fc from 'fast-check'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { ChatContext, type ChatContextValue } from '../features/chat/chatContext'
import BottomNav from './BottomNav'

afterEach(cleanup)

function renderAt(path: string, chat?: Partial<ChatContextValue>) {
  const nav = (
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>
  )
  return render(
    chat ? <ChatContext.Provider value={chat as ChatContextValue}>{nav}</ChatContext.Provider> : nav,
  )
}

function currentLinks(): HTMLElement[] {
  return screen
    .getAllByRole('link')
    .filter((a) => a.getAttribute('aria-current') === 'page')
}

const exactPaths = [
  ['/home', 'Home'],
  ['/leagues', 'Leagues'],
  ['/chat', 'Chat'],
  ['/profile', 'Profile'],
] as const

describe('BottomNav current item', () => {
  // Feature: chat-messaging, Property 1: Exactly one nav item is current
  // **Validates: Requirements 1.4**
  it('marks exactly one item current for any section path, and Chat for every /chat/* path', () => {
    const sectionPath = fc.oneof(
      fc.constantFrom(...exactPaths).map(([p, label]) => ({ path: p as string, label: label as string })),
      fc.uuid().map((id) => ({ path: `/chat/${id}`, label: 'Chat' })),
      fc.uuid().map((id) => ({ path: `/chat/${id}/`, label: 'Chat' })),
    )
    fc.assert(
      fc.property(sectionPath, ({ path, label }) => {
        const { unmount } = renderAt(path)
        const current = currentLinks()
        expect(current).toHaveLength(1)
        expect(current[0].textContent).toContain(label)
        unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('never marks more than one item current for arbitrary paths', () => {
    const segment = fc.stringMatching(/^[a-z0-9-]{1,8}$/)
    const anyPath = fc
      .array(segment, { minLength: 0, maxLength: 3 })
      .map((segs) => '/' + segs.join('/'))
    fc.assert(
      fc.property(anyPath, (path) => {
        const { unmount } = renderAt(path)
        expect(currentLinks().length).toBeLessThanOrEqual(1)
        unmount()
      }),
      { numRuns: 100 },
    )
  })
})

describe('BottomNav Chat item', () => {
  it('links to /chat', () => {
    renderAt('/home')
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/chat')
  })

  it('shows no badge outside a ChatProvider', () => {
    const { container } = renderAt('/home')
    expect(container.querySelector('.unread-alert')).toBeNull()
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument()
  })
})
