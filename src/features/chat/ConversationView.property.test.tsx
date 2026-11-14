import { describe, it, expect } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import { MessageList } from './MessageList'
import { Suspense } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ChatConversationRoute } from '../../routing/RouteViews'
import { AuthContext } from '../../auth/authContext'
import { ChatProvider } from './ChatProvider'
import { ConversationView } from './ConversationViewPage'
import type { ChatMessage, ChatService, SendResult } from './chatService'

const RUNS = { numRuns: 100 }
const BASE = Date.UTC(2024, 0, 1)

const htmlFragment = fc.constantFrom(
  '<b>bold</b>',
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<a href="http://x">link</a>',
  '</p><div>',
  '&amp; &lt;i&gt;',
  '<!-- c -->',
)

const textArb = fc
  .array(fc.oneof(fc.string({ maxLength: 20 }), htmlFragment), { minLength: 1, maxLength: 6 })
  .map((parts) => parts.join(' '))
  .filter((s) => s.trim().length > 0)

const messagesArb: fc.Arbitrary<ChatMessage[]> = fc
  .array(
    fc.record({
      name: fc.stringMatching(/^[A-Za-z0-9_]{3,12}$/),
      text: textArb,
      offset: fc.integer({ min: 0, max: 10_000_000 }),
    }),
    { minLength: 1, maxLength: 8 },
  )
  .map((rows) =>
    rows.map((r, i) => ({
      id: `m${i}`,
      conversationId: 'c1',
      senderId: `u${i}`,
      senderName: r.name,
      text: r.text,
      createdAt: new Date(BASE + r.offset * 1000).toISOString(),
      seq: i + 1,
    })),
  )

function expectedTime(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

describe('Property 9: Message rendering is complete and plain text', () => {
  // Feature: chat-messaging, Property 9: Message rendering is complete and plain text
  // **Validates: Requirements 6.2, 10.13**
  it('renders sender, text and timestamp for every message, with text never parsed as HTML', () => {
    fc.assert(
      fc.property(messagesArb, (messages) => {
        const { container, unmount } = render(<MessageList messages={messages} events={[]} />)
        try {
          const items = container.querySelectorAll('li.message-item')
          expect(items.length).toBe(messages.length)
          for (const m of messages) {
            const item = [...items].find(
              (li) => li.querySelector('time')?.getAttribute('datetime') === m.createdAt &&
                li.querySelector('.message-text')?.textContent === m.text,
            )
            expect(item).toBeDefined()
            expect(item!.querySelector('.message-sender')?.textContent).toBe(m.senderName)
            expect(item!.querySelector('time')?.textContent).toBe(expectedTime(m.createdAt))
            const textEl = item!.querySelector('.message-text')!
            expect(textEl.children.length).toBe(0)
          }
          // No elements injected anywhere from message text.
          expect(container.querySelectorAll('script, img, a, b, i').length).toBe(0)
        } finally {
          unmount()
        }
      }),
      RUNS,
    )
  })
})

describe('Property 17: Duplicate submissions store one message', () => {
  // Feature: chat-messaging, Property 17: Duplicate submissions store one message
  // **Validates: Requirements 5.5, 5.9**
  const submitArb = fc.array(fc.constantFrom('enter', 'button'), { minLength: 1, maxLength: 8 })
  const validText = fc.stringMatching(/^[A-Za-z0-9]{1,30}$/)

  function makeService() {
    const calls: { id: string; conversationId: string; text: string }[] = []
    const resolvers: ((r: SendResult) => void)[] = []
    const service = {
      getConversation: async () => ({
        ok: true,
        conversation: {
          id: 'c1',
          kind: 'personal',
          name: null,
          createdAt: new Date(BASE).toISOString(),
          otherUserName: 'Them',
          latestMessageText: null,
          latestMessageAt: null,
          unread: 0,
        },
      }),
      loadMessages: async () => ({ ok: true, messages: [], hasMore: false }),
      loadEvents: async () => ({ ok: true, events: [] }),
      loadUnreadTotal: async () => ({ ok: true, entries: [] }),
      markRead: async () => ({ ok: true, lastReadAt: new Date(BASE).toISOString(), unread: 0 }),
      subscribe: () => () => {},
      sendMessage: (i: { id: string; conversationId: string; text: string }) => {
        calls.push(i)
        return new Promise<SendResult>((resolve) => resolvers.push(resolve))
      },
    } as unknown as ChatService
    return { service, calls, resolvers }
  }

  it('calls sendMessage once for k submits while pending, and a retry reuses id and text', async () => {
    await fc.assert(
      fc.asyncProperty(validText, submitArb, async (text, submits) => {
        const { service, calls, resolvers } = makeService()
        const { unmount } = render(
          <AuthContext.Provider
            value={{ status: 'authenticated', userMetadata: {}, userId: 'me' }}
          >
            <ChatProvider service={service}>
              <MemoryRouter>
                <ConversationView conversationId="c1" />
              </MemoryRouter>
            </ChatProvider>
          </AuthContext.Provider>,
        )
        try {
          const box = (await screen.findByLabelText('Message')) as HTMLTextAreaElement
          fireEvent.change(box, { target: { value: text } })
          const submitAll = () => {
            for (const how of submits) {
              if (how === 'enter') fireEvent.keyDown(box, { key: 'Enter' })
              else fireEvent.click(screen.getByRole('button', { name: 'Send' }))
            }
          }
          submitAll()
          await waitFor(() => expect(calls.length).toBe(1))
          expect(calls.length).toBe(1)

          // Failure: the text is kept and the next submit reuses id and text.
          resolvers[0]({ ok: false, error: 'unavailable' })
          await screen.findByText(/Failed to send/)
          expect(box.value).toBe(text)
          submitAll()
          await waitFor(() => expect(calls.length).toBe(2))
          expect(calls.length).toBe(2)
          expect(calls[1].id).toBe(calls[0].id)
          expect(calls[1].text).toBe(calls[0].text)
        } finally {
          unmount()
        }
      }),
      { numRuns: 100 },
    )
  }, 60_000)
})

describe('Property 2: Inaccessible and nonexistent conversations are indistinguishable', () => {
  // Feature: chat-messaging, Property 2: Inaccessible and nonexistent conversations are indistinguishable
  // **Validates: Requirements 1.5, 6.7**
  const notFoundSubset = fc
    .record({ conv: fc.boolean(), msgs: fc.boolean(), events: fc.boolean() })
    .filter((s) => s.conv || s.msgs || s.events)

  function notFoundService(s: { conv: boolean; msgs: boolean; events: boolean }) {
    return {
      getConversation: async () =>
        s.conv
          ? { ok: false, error: 'not_found' }
          : {
              ok: true,
              conversation: {
                id: 'x',
                kind: 'personal',
                name: null,
                createdAt: new Date(BASE).toISOString(),
                otherUserName: 'Them',
                latestMessageText: null,
                latestMessageAt: null,
                unread: 0,
              },
            },
      loadMessages: async () =>
        s.msgs ? { ok: false, error: 'not_found' } : { ok: true, messages: [], hasMore: false },
      loadEvents: async () => (s.events ? { ok: false, error: 'not_found' } : { ok: true, events: [] }),
      loadUnreadTotal: async () => ({ ok: true, entries: [] }),
      markRead: async () => ({ ok: true, lastReadAt: new Date(BASE).toISOString(), unread: 0 }),
      subscribe: () => () => {},
      sendMessage: async () => ({ ok: false, error: 'not_participant' }),
    } as unknown as ChatService
  }

  async function renderAt(id: string, service: ChatService): Promise<string> {
    const { container, unmount } = render(
      <AuthContext.Provider value={{ status: 'authenticated', userMetadata: {}, userId: 'me' }}>
        <ChatProvider service={service}>
          <MemoryRouter initialEntries={[`/chat/${id}`]}>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/chat/:conversationId" element={<ChatConversationRoute />} />
              </Routes>
            </Suspense>
          </MemoryRouter>
        </ChatProvider>
      </AuthContext.Provider>,
    )
    try {
      await screen.findByRole('heading', { name: 'Page not found' })
      return container.innerHTML
    } finally {
      unmount()
    }
  }

  it('renders identical output for any uuid, any not_found source, and non-uuid ids', async () => {
    const reference = await renderAt(
      '00000000-0000-4000-8000-000000000000',
      notFoundService({ conv: true, msgs: true, events: true }),
    )
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        notFoundSubset,
        fc.oneof(fc.uuid(), fc.stringMatching(/^[A-Za-z0-9_-]{1,40}$/)),
        async (uuid, subset, anyId) => {
          expect(await renderAt(uuid, notFoundService(subset))).toBe(reference)
          expect(await renderAt(anyId, notFoundService(subset))).toBe(reference)
        },
      ),
      { numRuns: 100 },
    )
  }, 120_000)
})
