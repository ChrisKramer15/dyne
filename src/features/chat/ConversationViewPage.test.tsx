import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../auth/authContext'
import type { AuthState } from '../../auth/authReducer'
import { ChatProvider } from './ChatProvider'
import { ConversationView } from './ConversationViewPage'
import { RECONNECT_INTERVAL_MS } from './chatService'
import type {
  ChatEventHandlers,
  ChatMessage,
  ChatService,
  ConversationSummary,
  LeaveGroupResult,
  LoadMessagesResult,
  SendResult,
} from './chatService'

const SELF = 'me'
const authed: AuthState = { status: 'authenticated', userMetadata: {}, userId: SELF }
const unavailable = { ok: false, error: 'unavailable' } as const

function msg(i: number, over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m${i}`,
    conversationId: 'c1',
    senderId: 'them',
    senderName: 'Them',
    text: `text ${i}`,
    createdAt: new Date(Date.UTC(2024, 0, 1, 10, i)).toISOString(),
    seq: i,
    ...over,
  }
}

function conv(over: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: 'c1',
    kind: 'personal',
    name: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    otherUserName: 'Them',
    latestMessageText: null,
    latestMessageAt: null,
    unread: 0,
    ...over,
  }
}

interface Overrides {
  conversation?: ConversationSummary
  loadMessages?: ReturnType<typeof vi.fn>
  sendMessage?: ReturnType<typeof vi.fn>
  leaveGroup?: ReturnType<typeof vi.fn>
}

function setup(o: Overrides = {}) {
  let current: ChatEventHandlers | null = null
  const subscribe = vi.fn((h: ChatEventHandlers) => {
    current = h
    return () => {}
  })
  const loadMessages =
    o.loadMessages ??
    vi.fn(async (): Promise<LoadMessagesResult> => ({ ok: true, messages: [msg(1)], hasMore: false }))
  const sendMessage =
    o.sendMessage ??
    vi.fn(
      async (i: { id: string; text: string }): Promise<SendResult> => ({
        ok: true,
        message: msg(9, { id: i.id, text: i.text, senderId: SELF, senderName: 'Me' }),
      }),
    )
  const leaveGroup = o.leaveGroup ?? vi.fn(async (): Promise<LeaveGroupResult> => ({ ok: true }))
  const service = {
    getConversation: async () => ({ ok: true, conversation: o.conversation ?? conv() }),
    loadMessages,
    loadEvents: async () => ({ ok: true, events: [] }),
    sendMessage,
    markRead: async () => ({ ok: true, lastReadAt: msg(1).createdAt, unread: 0 }),
    loadUnreadTotal: async () => ({ ok: true, entries: [] }),
    leaveGroup,
    subscribe,
  } as unknown as ChatService
  const utils = render(
    <MemoryRouter initialEntries={['/chat/c1']}>
      <AuthContext.Provider value={authed}>
        <ChatProvider service={service}>
          <Routes>
            <Route path="/chat" element={<p>Chat list</p>} />
            <Route path="/chat/:id" element={<ConversationView conversationId="c1" />} />
          </Routes>
        </ChatProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  return {
    ...utils,
    subscribe,
    loadMessages,
    sendMessage,
    leaveGroup,
    handlers: () => {
      if (!current) throw new Error('not subscribed')
      return current
    },
  }
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function mount(o: Overrides = {}) {
  const r = setup(o)
  await flush()
  return r
}

function composer(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement
}

function type(text: string) {
  fireEvent.change(composer(), { target: { value: text } })
}

function liveRegion(): HTMLElement {
  return document.querySelector('.visually-hidden[aria-live="polite"]') as HTMLElement
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ConversationView composer keys', () => {
  it('Enter submits the message and clears the composer (5.7, 5.6)', async () => {
    const { sendMessage } = await mount()
    type('hello')
    const notPrevented = fireEvent.keyDown(composer(), { key: 'Enter' })
    await flush()
    expect(notPrevented).toBe(false)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'c1', text: 'hello' }),
    )
    expect(composer().value).toBe('')
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('Shift+Enter does not submit and is left to insert a line break (5.8)', async () => {
    const { sendMessage } = await mount()
    type('hello')
    const notPrevented = fireEvent.keyDown(composer(), { key: 'Enter', shiftKey: true })
    await flush()
    expect(notPrevented).toBe(true)
    expect(sendMessage).not.toHaveBeenCalled()
    expect(composer().value).toBe('hello')
  })
})

describe('ConversationView send failure and retry', () => {
  it('marks the message failed, keeps the text, and retry resubmits the same id and text (5.5)', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(unavailable)
      .mockImplementation(async (i: { id: string; text: string }) => ({
        ok: true,
        message: msg(9, { id: i.id, text: i.text, senderId: SELF, senderName: 'Me' }),
      }))
    await mount({ sendMessage })
    type('hello')
    fireEvent.keyDown(composer(), { key: 'Enter' })
    await flush()

    expect(composer().value).toBe('hello')
    const failed = screen.getByText('Failed to send.')
    expect(failed).toHaveAttribute('role', 'alert')
    expect(screen.getByText('The message could not be sent.')).toBeInTheDocument()

    fireEvent.click(within(failed).getByRole('button', { name: 'Retry' }))
    await flush()

    expect(sendMessage).toHaveBeenCalledTimes(2)
    const [first, second] = sendMessage.mock.calls.map((c) => c[0])
    expect(second).toEqual(first)
    expect(screen.queryByText('Failed to send.')).not.toBeInTheDocument()
    expect(screen.queryByText('The message could not be sent.')).not.toBeInTheDocument()
    expect(composer().value).toBe('')
    expect(document.querySelectorAll('.message-text')).toHaveLength(2)
    expect(screen.getByText('hello', { selector: '.message-text' })).toBeInTheDocument()
  })

  it('ignores a submit made while the previous one is awaiting its result (5.9)', async () => {
    let resolve!: (r: SendResult) => void
    const sendMessage = vi.fn(() => new Promise<SendResult>((r) => (resolve = r)))
    await mount({ sendMessage })
    type('hello')
    fireEvent.keyDown(composer(), { key: 'Enter' })
    fireEvent.keyDown(composer(), { key: 'Enter' })
    await flush()
    expect(sendMessage).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ ok: false, error: 'unavailable' }))
  })
})

describe('ConversationView load errors', () => {
  it('shows an error with retry when the first load fails, then loads on retry (6.9, 6.10)', async () => {
    const loadMessages = vi
      .fn()
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValue({ ok: true, messages: [msg(1)], hasMore: false })
    await mount({ loadMessages })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Messages could not be loaded.')

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await flush()
    expect(loadMessages).toHaveBeenCalledTimes(2)
    expect(screen.getByText('text 1')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('retains displayed messages when loading earlier ones fails, and retry loads them (6.9, 6.10)', async () => {
    const loadMessages = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, messages: [msg(2), msg(3)], hasMore: true })
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce({ ok: true, messages: [msg(1)], hasMore: false })
    await mount({ loadMessages })

    fireEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }))
    await flush()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Messages could not be loaded.')
    expect(screen.getByText('text 2')).toBeInTheDocument()
    expect(screen.getByText('text 3')).toBeInTheDocument()

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await flush()
    expect(loadMessages.mock.calls[2][0]).toEqual(
      expect.objectContaining({ before: { createdAt: msg(2).createdAt, seq: 2 } }),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const texts = [...document.querySelectorAll('.message-text')].map((e) => e.textContent)
    expect(texts).toEqual(['text 1', 'text 2', 'text 3'])
  })
})

describe('ConversationView live region and focus', () => {
  it('announces another participant\'s message in the open conversation without moving focus (11.2)', async () => {
    const { handlers } = await mount()
    expect(liveRegion()).toHaveAttribute('role', 'status')
    expect(composer()).toHaveFocus()

    act(() => handlers().onMessage(msg(2, { text: 'news' })))
    expect(liveRegion()).toHaveTextContent('Them: news')
    expect(composer()).toHaveFocus()
  })

  it('does not announce messages of other conversations or own messages (11.9)', async () => {
    const { handlers } = await mount()
    act(() => handlers().onMessage(msg(2, { conversationId: 'other', text: 'elsewhere' })))
    expect(liveRegion()).toBeEmptyDOMElement()
    expect(screen.queryByText('text 2')).not.toBeInTheDocument()

    act(() => handlers().onMessage(msg(3, { senderId: SELF, senderName: 'Me', text: 'mine' })))
    expect(liveRegion()).toBeEmptyDOMElement()
  })

  it('does not announce once the conversation view is closed (11.9)', async () => {
    const { handlers, unmount } = await mount()
    unmount()
    act(() => handlers().onMessage(msg(2, { text: 'late' })))
    expect(document.querySelector('[aria-live]')).toBeNull()
  })

  it('moves focus to the composer when opened (11.3)', async () => {
    await mount()
    await advance(300)
    expect(composer()).toHaveFocus()
  })
})

describe('ConversationView jump to latest', () => {
  function stubScroll(el: HTMLElement) {
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: 0 })
  }

  it('keeps scroll position and shows the control when scrolled away; activating it scrolls, hides it and focuses the composer (11.5, 11.6)', async () => {
    const { handlers } = await mount()
    const list = screen.getByRole('region', { name: 'Messages' })
    stubScroll(list)
    fireEvent.scroll(list)
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()

    act(() => handlers().onMessage(msg(2)))
    expect(list.scrollTop).toBe(0)
    const jump = screen.getByRole('button', { name: 'Jump to latest' })

    composer().blur()
    fireEvent.click(jump)
    expect(list.scrollTop).toBe(1000)
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
    expect(composer()).toHaveFocus()
  })

  it('does not show the control when near the bottom (11.5)', async () => {
    const { handlers } = await mount()
    const list = screen.getByRole('region', { name: 'Messages' })
    stubScroll(list)
    list.scrollTop = 880
    fireEvent.scroll(list)
    act(() => handlers().onMessage(msg(2)))
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
  })
})

describe('ConversationView leave group', () => {
  const group = conv({ kind: 'group', name: 'Team', otherUserName: null })

  it('is offered only for groups', async () => {
    await mount()
    expect(screen.queryByRole('button', { name: 'Leave group' })).not.toBeInTheDocument()
  })

  it('leaves the group and returns to the list (4.7)', async () => {
    const { leaveGroup } = await mount({ conversation: group })
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }))
    await flush()
    expect(leaveGroup).toHaveBeenCalledWith('c1')
    expect(screen.getByText('Chat list')).toBeInTheDocument()
  })

  it('shows an error and stays when leaving fails, and ignores double activation (4.7)', async () => {
    const leaveGroup = vi.fn(async (): Promise<LeaveGroupResult> => unavailable)
    await mount({ conversation: group, leaveGroup })
    const button = screen.getByRole('button', { name: 'Leave group' })
    fireEvent.click(button)
    fireEvent.click(button)
    await flush()
    expect(leaveGroup).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent('You could not leave this group')
    expect(screen.queryByText('Chat list')).not.toBeInTheDocument()
  })
})

describe('ConversationView timed updates', () => {
  it('reconnects every 5 s after an outage and backfills without duplicates', async () => {
    const loadMessages = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, messages: [msg(1)], hasMore: false })
      .mockResolvedValue({ ok: true, messages: [msg(1), msg(2)], hasMore: false })
    const { handlers, subscribe } = await mount({ loadMessages })
    expect(subscribe).toHaveBeenCalledTimes(1)

    act(() => handlers().onStatus('disconnected'))
    await advance(RECONNECT_INTERVAL_MS - 1)
    expect(subscribe).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(subscribe).toHaveBeenCalledTimes(2)

    act(() => handlers().onStatus('connected'))
    await flush()
    expect(loadMessages).toHaveBeenCalledTimes(2)
    const texts = [...document.querySelectorAll('.message-text')].map((e) => e.textContent)
    expect(texts).toEqual(['text 1', 'text 2'])
  })
})
