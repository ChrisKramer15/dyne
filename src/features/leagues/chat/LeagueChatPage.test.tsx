import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../../auth/authContext'
import type { AuthState } from '../../../auth/authReducer'
import { ChatProvider } from '../../chat/ChatProvider'
import type { ChatService, ConversationSummary, LeagueChatResult } from '../../chat/chatService'
import LeagueChatPage from './LeagueChatPage'

afterEach(cleanup)

const LEAGUE = 'league-1'
const OTHER_LEAGUE = 'league-2'
const authed: AuthState = { status: 'authenticated', userMetadata: {}, userId: 'me' }

function conv(over: Partial<ConversationSummary>): ConversationSummary {
  return {
    id: 'x',
    kind: 'personal',
    name: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    otherUserName: null,
    latestMessageText: null,
    latestMessageAt: null,
    unread: 0,
    leagueId: null,
    ...over,
  }
}

const leagueChat = conv({ id: 'chat', kind: 'group', name: 'Sandlot', leagueId: LEAGUE, latestMessageText: 'Welcome' })
const dmInLeague = conv({ id: 'dm1', otherUserName: 'alice', leagueId: LEAGUE })
const dmInOtherLeague = conv({ id: 'dm2', otherUserName: 'bob', leagueId: OTHER_LEAGUE })
const dmOutsideLeague = conv({ id: 'dm3', otherUserName: 'carol' })

function setup(over: Partial<ChatService> = {}, conversations = [leagueChat, dmInLeague, dmInOtherLeague, dmOutsideLeague]) {
  const openLeagueDm = vi.fn(async () => ({ ok: true, conversationId: 'dm-new' }) as const)
  const service = {
    getOrCreateLeagueChat: async (): Promise<LeagueChatResult> => ({ ok: true, conversationId: 'chat' }),
    listConversations: async () => ({ ok: true, conversations }),
    listLeagueMembers: async () => ({
      ok: true,
      members: [
        { userId: 'me', username: 'me-user' },
        { userId: 'u2', username: 'dave' },
      ],
    }),
    openLeagueDm,
    loadUnreadTotal: async () => ({ ok: true, entries: [] }),
    markRead: async () => ({ ok: true, lastReadAt: '', unread: 0 }),
    subscribe: () => () => {},
    ...over,
  } as unknown as ChatService
  render(
    <MemoryRouter initialEntries={[`/leagues/${LEAGUE}/chat`]}>
      <AuthContext.Provider value={authed}>
        <ChatProvider service={service}>
          <Routes>
            <Route path="/leagues/:id/chat" element={<LeagueChatPage leagueId={LEAGUE} />} />
            <Route path="/leagues/:id/chat/:cid" element={<p>Conversation opened</p>} />
          </Routes>
        </ChatProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  return { openLeagueDm }
}

describe('LeagueChatPage', () => {
  it('links the league chat inside the league', async () => {
    setup()
    const link = await screen.findByRole('link', { name: /Sandlot/ })
    expect(link.getAttribute('href')).toBe(`/leagues/${LEAGUE}/chat/chat`)
  })

  it('lists only private messages that belong to this league', async () => {
    setup()
    const section = await screen.findByRole('region', { name: 'Private messages' })
    const links = within(section).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual([`/leagues/${LEAGUE}/chat/dm1`])
    expect(screen.queryByText('bob')).toBeNull()
    expect(screen.queryByText('carol')).toBeNull()
  })

  it('shows an empty state with no private messages', async () => {
    setup({}, [leagueChat])
    expect(await screen.findByText('No private messages yet.')).toBeTruthy()
  })

  it('starts a private message with another league member, not with yourself', async () => {
    const { openLeagueDm } = setup()
    await userEvent.click(await screen.findByRole('button', { name: 'New message' }))
    expect(await screen.findByRole('button', { name: 'Message dave' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Message me-user' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Message dave' }))
    expect(openLeagueDm).toHaveBeenCalledWith({ leagueId: LEAGUE, otherUserId: 'u2' })
    expect(await screen.findByText('Conversation opened')).toBeTruthy()
  })

  it('shows not-found to someone who is not in the league', async () => {
    setup({ getOrCreateLeagueChat: async () => ({ ok: false, error: 'not_member' }) })
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  })

  it('shows a retryable error when the chat cannot be loaded', async () => {
    setup({ getOrCreateLeagueChat: async () => ({ ok: false, error: 'unavailable' }) })
    expect((await screen.findByRole('alert')).textContent).toContain('Chat could not be loaded.')
  })
})
