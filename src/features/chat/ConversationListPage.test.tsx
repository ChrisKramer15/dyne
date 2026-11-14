import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../auth/authContext'
import type { AuthState } from '../../auth/authReducer'
import { ChatProvider } from './ChatProvider'
import ConversationListPage from './ConversationListPage'
import { CONVERSATIONS_PER_PAGE } from './conversationList'
import type { ConversationSummary, ListConversationsResult } from './chatService'

const authed: AuthState = { status: 'authenticated', userMetadata: {}, userId: 'me' }

function conv(i: number, over: Partial<ConversationSummary> = {}): ConversationSummary {
  const hour = String(i % 24).padStart(2, '0')
  return {
    id: `c${i}`,
    kind: 'personal',
    name: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    otherUserName: `User${i}`,
    latestMessageText: `hello ${i}`,
    latestMessageAt: `2024-01-02T${hour}:00:00.000Z`,
    unread: 0,
    ...over,
  }
}

function setup(list: () => Promise<ListConversationsResult>) {
  const listConversations = vi.fn(list)
  const service = {
    listConversations,
    loadUnreadTotal: async () => ({ ok: true, entries: [] }),
    subscribe: () => () => {},
    searchUsers: async () => ({ ok: true, users: [] }),
  } as never
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authed}>
        <ChatProvider service={service}>
          <ConversationListPage />
        </ChatProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  return { listConversations }
}

const ok = (conversations: ConversationSummary[]): ListConversationsResult => ({
  ok: true,
  conversations,
})
const failed: ListConversationsResult = { ok: false, error: 'unavailable' }

describe('ConversationListPage', () => {
  it('shows a loading indicator until the load resolves (2.8)', async () => {
    let resolve!: (r: ListConversationsResult) => void
    setup(() => new Promise((r) => (resolve = r)))
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    resolve(ok([conv(1)]))
    expect(await screen.findByText('User1')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('replaces the loading indicator with an error and retry control (2.9)', async () => {
    setup(async () => failed)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Conversations could not be loaded.')
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('retry reloads, shows loading, then the list (2.10)', async () => {
    let calls = 0
    let resolve!: (r: ListConversationsResult) => void
    const { listConversations } = setup(() =>
      ++calls === 1 ? Promise.resolve(failed) : new Promise((r) => (resolve = r)),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(listConversations).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    resolve(ok([conv(1)]))
    expect(await screen.findByText('User1')).toBeInTheDocument()
  })

  it('retry can fail again and shows the error again (2.10)', async () => {
    setup(async () => failed)
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  })

  it('shows an empty state with a control to start a conversation (2.7)', async () => {
    setup(async () => ok([]))
    expect(await screen.findByText('No conversations yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start a conversation' }))
    expect(screen.getByRole('region', { name: 'New conversation' })).toBeInTheDocument()
  })

  it('paginates with the Pager, preserving order across pages (2.11)', async () => {
    const total = CONVERSATIONS_PER_PAGE + 2
    // Higher index = later latest message = earlier in the list.
    setup(async () => ok(Array.from({ length: total }, (_, i) => conv(i + 1))))
    await screen.findByText(`User${total}`)
    const items = async () =>
      within(screen.getByRole('region', { name: 'Conversations' }))
        .getAllByRole('listitem')
        .filter((li) => li.classList.contains('conversation-item'))
    let page = await items()
    expect(page).toHaveLength(CONVERSATIONS_PER_PAGE)
    expect(page[0]).toHaveTextContent(`User${total}`)
    expect(screen.getByText(`Page 1 of 2`)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    page = await items()
    expect(page).toHaveLength(2)
    expect(page[0]).toHaveTextContent(`User${total - CONVERSATIONS_PER_PAGE}`)
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('does not show a Pager when everything fits on one page', async () => {
    setup(async () => ok([conv(1), conv(2)]))
    await screen.findByText('User1')
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Conversations pages' })).toBeNull())
  })
})
