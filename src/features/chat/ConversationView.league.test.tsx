import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthContext } from '../../auth/authContext'
import type { AuthState } from '../../auth/authReducer'
import { ChatProvider } from './ChatProvider'
import { ConversationView } from './ConversationViewPage'
import type { ChatService, ConversationSummary } from './chatService'

afterEach(cleanup)

const authed: AuthState = { status: 'authenticated', userMetadata: {}, userId: 'me' }

function renderView(leagueOfConversation: string | null, props: { leagueId?: string }) {
  const conversation: ConversationSummary = {
    id: 'c1',
    kind: 'personal',
    name: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    otherUserName: 'alice',
    latestMessageText: null,
    latestMessageAt: null,
    unread: 0,
    leagueId: leagueOfConversation,
  }
  const service = {
    getConversation: async () => ({ ok: true, conversation }),
    loadMessages: async () => ({ ok: true, messages: [], hasMore: false }),
    loadEvents: async () => ({ ok: true, events: [] }),
    loadUnreadTotal: async () => ({ ok: true, entries: [] }),
    markRead: async () => ({ ok: true, lastReadAt: '', unread: 0 }),
    subscribe: () => () => {},
  } as unknown as ChatService
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authed}>
        <ChatProvider service={service}>
          <ConversationView conversationId="c1" {...props} />
        </ChatProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('ConversationView and leagues', () => {
  it('opens a league conversation inside its league', async () => {
    renderView('L1', { leagueId: 'L1', backTo: '/leagues/L1/chat' } as { leagueId: string })
    expect(await screen.findByRole('heading', { name: 'alice' })).toBeTruthy()
  })

  it('does not open a league conversation outside leagues', async () => {
    renderView('L1', {})
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  })

  it('does not open a conversation from another league', async () => {
    renderView('L1', { leagueId: 'L2' })
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  })

  it('does not open a non-league conversation inside a league', async () => {
    renderView(null, { leagueId: 'L1' })
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  })
})
