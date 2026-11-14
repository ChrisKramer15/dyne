import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import { MemoryRouter } from 'react-router'
import { AuthContext } from '../../auth/authContext'
import type { AuthState } from '../../auth/authReducer'
import ConversationListPage from './ConversationListPage'
import { ChatProvider } from './ChatProvider'
import { CONVERSATIONS_PER_PAGE } from './conversationList'
import { badgeText, conversationLabel } from './unreadBadge'
import type { ChatService, ConversationSummary } from './chatService'

const RUNS = { numRuns: 100 }
const BASE = Date.UTC(2024, 0, 1)
const M0 = '2024-01-01T00:00:00.000Z'
const authed: AuthState = { status: 'authenticated', userMetadata: {}, userId: 'me' }

const rowsArb = fc.array(
  fc.record({
    name: fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{2,10}$/),
    preview: fc.stringMatching(/^[A-Za-z0-9]{1,20}$/),
    unread: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 300 })),
    group: fc.boolean(),
  }),
  { minLength: 1, maxLength: CONVERSATIONS_PER_PAGE },
)

function makeService(conversations: ConversationSummary[]): ChatService {
  return {
    listConversations: async () => ({ ok: true, conversations }),
    loadUnreadTotal: async () => ({
      ok: true,
      entries: conversations.map((c) => ({
        conversationId: c.id,
        unread: c.unread ?? 0,
        lastReadAt: M0,
      })),
    }),
    subscribe: () => () => {},
  } as unknown as ChatService
}

describe('Property 16: Unread entries follow the unread count in emphasis', () => {
  // Feature: chat-messaging, Property 16: Unread entries follow the unread count in emphasis
  // **Validates: Requirements 9.5, 9.9**
  it('emphasises exactly the entries with a positive unread count and shows the capped badge', async () => {
    await fc.assert(
      fc.asyncProperty(rowsArb, async (rows) => {
        const conversations: ConversationSummary[] = rows.map((r, i) => ({
          id: `c${i}`,
          kind: r.group ? 'group' : 'personal',
          name: r.group ? r.name : null,
          createdAt: new Date(BASE - i * 1000).toISOString(),
          otherUserName: r.group ? null : r.name,
          latestMessageText: r.preview,
          // Descending times keep the rendered order equal to the input order.
          latestMessageAt: new Date(BASE + (rows.length - i) * 60_000).toISOString(),
          unread: r.unread,
        }))
        const { container, unmount } = render(
          <MemoryRouter>
            <AuthContext.Provider value={authed}>
              <ChatProvider service={makeService(conversations)}>
                <ConversationListPage />
              </ChatProvider>
            </AuthContext.Provider>
          </MemoryRouter>,
        )
        try {
          await waitFor(() => {
            expect(container.querySelectorAll('li.conversation-item').length).toBe(rows.length)
            // Wait until the provider's counts are loaded.
            const unreadRows = rows.filter((r) => r.unread > 0).length
            expect(container.querySelectorAll('a.is-unread').length).toBe(unreadRows)
          })
          const items = container.querySelectorAll('li.conversation-item')
          rows.forEach((r, i) => {
            const link = items[i].querySelector('a')!
            const name = items[i].querySelector('.conversation-name') as HTMLElement
            const preview = items[i].querySelector('.conversation-preview') as HTMLElement
            const unread = r.unread > 0
            expect(link.classList.contains('is-unread')).toBe(unread)
            expect(name.style.fontWeight).toBe(unread ? '700' : '400')
            expect(preview.style.fontWeight).toBe(unread ? '700' : '400')
            expect(link.getAttribute('aria-label')).toBe(conversationLabel(r.name, r.unread))
            const badge = items[i].querySelector('.unread-alert')
            if (unread) {
              expect(badge?.textContent).toBe(badgeText(r.unread))
              expect(badge?.getAttribute('aria-hidden')).toBe('true')
            } else {
              expect(badge).toBeNull()
            }
          })
        } finally {
          unmount()
        }
      }),
      RUNS,
    )
  }, 60_000)
})
