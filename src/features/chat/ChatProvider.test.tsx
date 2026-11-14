import { act, render } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../auth/authContext'
import type { AuthState } from '../../auth/authReducer'
import { ChatProvider } from './ChatProvider'
import { useChat } from './chatContext'
import type { ChatContextValue } from './chatContext'
import {
  READ_RETRY_COUNT,
  READ_RETRY_INTERVAL_MS,
  RECONNECT_INTERVAL_MS,
  UNREAD_LOAD_RETRY_COUNT,
  UNREAD_LOAD_RETRY_INTERVAL_MS,
} from './chatService'
import type {
  ChatEventHandlers,
  ChatMessage,
  ChatService,
  MarkReadResult,
  UnreadTotalResult,
} from './chatService'

const SELF = 'me'
const OTHER = 'them'
const M0 = '2024-01-01T10:00:00.000Z'
const M1 = '2024-01-01T11:00:00.000Z'
const M2 = '2024-01-01T12:00:00.000Z'

const authed: AuthState = { status: 'authenticated', userMetadata: {}, userId: SELF }
const signedOut: AuthState = { status: 'unauthenticated' }

const unavailable = { ok: false, error: 'unavailable' } as const

interface Fake {
  service: ChatService
  loadUnreadTotal: ReturnType<typeof vi.fn>
  markRead: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
  handlers(): ChatEventHandlers
}

function entries(unread: number, lastReadAt = M0): UnreadTotalResult {
  return { ok: true, entries: [{ conversationId: 'c1', unread, lastReadAt }] }
}

function makeFake(
  load: () => Promise<UnreadTotalResult> = async () => entries(3),
  mark: () => Promise<MarkReadResult> = async () => ({ ok: true, lastReadAt: M1, unread: 0 }),
): Fake {
  const loadUnreadTotal = vi.fn(load)
  const markRead = vi.fn(mark)
  let current: ChatEventHandlers | null = null
  const unsubscribe = vi.fn()
  const subscribe = vi.fn((h: ChatEventHandlers) => {
    current = h
    return unsubscribe
  })
  const service = {
    loadUnreadTotal,
    markRead,
    subscribe,
    leaveGroup: async () => ({ ok: true }),
  } as unknown as ChatService
  return {
    service,
    loadUnreadTotal,
    markRead,
    subscribe,
    unsubscribe,
    handlers: () => {
      if (!current) throw new Error('not subscribed')
      return current
    },
  }
}

function msg(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm',
    conversationId: 'c1',
    senderId: OTHER,
    senderName: 'Them',
    text: 'hi',
    createdAt: M2,
    seq: 1,
    ...over,
  }
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

let chat: ChatContextValue

function Probe() {
  const value = useChat()
  useLayoutEffect(() => {
    chat = value
  })
  return null
}

function tree(auth: AuthState, service: ChatService): ReactNode {
  return (
    <AuthContext.Provider value={auth}>
      <ChatProvider service={service}>
        <Probe />
      </ChatProvider>
    </AuthContext.Provider>
  )
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

async function mount(fake: Fake, auth: AuthState = authed) {
  const utils = render(tree(auth, fake.service))
  await flush()
  return utils
}

beforeEach(() => {
  vi.useFakeTimers()
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
  setVisibility('visible')
})

describe('ChatProvider read marker persistence', () => {
  it('advances optimistically and confirms with the server result', async () => {
    const fake = makeFake()
    await mount(fake)
    expect(chat.total).toBe(3)

    await act(async () => {
      await chat.markRead('c1', M1)
    })
    expect(fake.markRead).toHaveBeenCalledWith({ conversationId: 'c1', upTo: M1 })
    expect(chat.unreadFor('c1')).toBe(0)
    expect(chat.total).toBe(0)
  })

  it('ignores a timestamp earlier than the current marker (7.9 guard)', async () => {
    const fake = makeFake(async () => entries(3, M1))
    await mount(fake)
    await act(async () => {
      await chat.markRead('c1', M0)
    })
    expect(fake.markRead).not.toHaveBeenCalled()
    expect(chat.unreadFor('c1')).toBe(3)
  })

  it('rolls back to the pre-failure count and retries 3 times at 5 s intervals (7.8)', async () => {
    const fake = makeFake(undefined, async () => unavailable)
    await mount(fake)

    let done = false
    act(() => {
      void chat.markRead('c1', M1).then(() => {
        done = true
      })
    })
    await flush()
    expect(fake.markRead).toHaveBeenCalledTimes(1)
    expect(chat.unreadFor('c1')).toBe(3)

    await advance(READ_RETRY_INTERVAL_MS - 1)
    expect(fake.markRead).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(fake.markRead).toHaveBeenCalledTimes(2)
    expect(chat.unreadFor('c1')).toBe(3)

    await advance(READ_RETRY_INTERVAL_MS * (READ_RETRY_COUNT - 1))
    expect(fake.markRead).toHaveBeenCalledTimes(1 + READ_RETRY_COUNT)
    expect(chat.unreadFor('c1')).toBe(3)
    expect(done).toBe(true)

    await advance(READ_RETRY_INTERVAL_MS * 5)
    expect(fake.markRead).toHaveBeenCalledTimes(1 + READ_RETRY_COUNT)
    expect(chat.total).toBe(3)
  })

  it('confirms when a retry succeeds', async () => {
    let calls = 0
    const fake = makeFake(undefined, async () =>
      ++calls < 2 ? unavailable : { ok: true, lastReadAt: M1, unread: 0 },
    )
    await mount(fake)
    act(() => {
      void chat.markRead('c1', M1)
    })
    await flush()
    expect(chat.unreadFor('c1')).toBe(3)
    await advance(READ_RETRY_INTERVAL_MS)
    expect(fake.markRead).toHaveBeenCalledTimes(2)
    expect(chat.unreadFor('c1')).toBe(0)
  })
})

describe('ChatProvider unread load', () => {
  it('shows no count while loading fails, retries 3 times at 5 s, then stops (8.9, 8.10)', async () => {
    const fake = makeFake(async () => unavailable)
    await mount(fake)
    expect(fake.loadUnreadTotal).toHaveBeenCalledTimes(1)
    expect(chat.total).toBe(0)

    await advance(UNREAD_LOAD_RETRY_INTERVAL_MS - 1)
    expect(fake.loadUnreadTotal).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(fake.loadUnreadTotal).toHaveBeenCalledTimes(2)

    await advance(UNREAD_LOAD_RETRY_INTERVAL_MS * (UNREAD_LOAD_RETRY_COUNT - 1))
    expect(fake.loadUnreadTotal).toHaveBeenCalledTimes(1 + UNREAD_LOAD_RETRY_COUNT)

    await advance(UNREAD_LOAD_RETRY_INTERVAL_MS * 10)
    expect(fake.loadUnreadTotal).toHaveBeenCalledTimes(1 + UNREAD_LOAD_RETRY_COUNT)
    expect(chat.total).toBe(0)
  })

  it('stops retrying after a success', async () => {
    let calls = 0
    const fake = makeFake(async () => (++calls < 2 ? unavailable : entries(4)))
    await mount(fake)
    await advance(UNREAD_LOAD_RETRY_INTERVAL_MS)
    expect(chat.total).toBe(4)
    await advance(UNREAD_LOAD_RETRY_INTERVAL_MS * 10)
    expect(fake.loadUnreadTotal).toHaveBeenCalledTimes(2)
  })

  it('retries again after the next sign-in', async () => {
    const fake = makeFake(async () => unavailable)
    const { rerender } = await mount(fake)
    await advance(UNREAD_LOAD_RETRY_INTERVAL_MS * 10)
    const before = fake.loadUnreadTotal.mock.calls.length

    rerender(tree(signedOut, fake.service))
    await flush()
    rerender(tree(authed, fake.service))
    await flush()
    expect(fake.loadUnreadTotal.mock.calls.length).toBe(before + 1)
  })
})

describe('ChatProvider sign-out', () => {
  it('resets the total to zero and unsubscribes (8.8)', async () => {
    const fake = makeFake()
    const { rerender } = await mount(fake)
    expect(chat.total).toBe(3)

    rerender(tree(signedOut, fake.service))
    await flush()
    expect(chat.total).toBe(0)
    expect(chat.unreadFor('c1')).toBe(0)
    expect(fake.unsubscribe).toHaveBeenCalled()
  })

  it('cancels pending read-marker retries and load retries', async () => {
    const fake = makeFake(undefined, async () => unavailable)
    const { rerender } = await mount(fake)
    act(() => {
      void chat.markRead('c1', M1)
    })
    await flush()
    expect(fake.markRead).toHaveBeenCalledTimes(1)

    rerender(tree(signedOut, fake.service))
    await flush()
    await advance(READ_RETRY_INTERVAL_MS * 10)
    expect(fake.markRead).toHaveBeenCalledTimes(1)
    expect(chat.total).toBe(0)
  })

  it('does not apply a load result that resolves after sign-out', async () => {
    let resolve!: (r: UnreadTotalResult) => void
    const fake = makeFake(() => new Promise((r) => (resolve = r)))
    const { rerender } = await mount(fake)
    rerender(tree(signedOut, fake.service))
    await flush()
    await act(async () => {
      resolve(entries(5))
    })
    expect(chat.total).toBe(0)
  })
})

describe('ChatProvider visibility handling', () => {
  it('marks read up to the latest message when opened with a reported latest (7.3)', async () => {
    const fake = makeFake()
    await mount(fake)
    act(() => {
      chat.openConversation('c1')
    })
    await act(async () => {
      await chat.markRead('c1', M1)
    })
    expect(fake.markRead).toHaveBeenCalledWith({ conversationId: 'c1', upTo: M1 })
    expect(chat.unreadFor('c1')).toBe(0)
  })

  it('marks an arriving message read while open and visible (7.4)', async () => {
    const fake = makeFake(async () => entries(0))
    await mount(fake)
    act(() => {
      chat.openConversation('c1')
    })
    await act(async () => {
      fake.handlers().onMessage(msg({ createdAt: M2 }))
    })
    await flush()
    expect(fake.markRead).toHaveBeenCalledWith({ conversationId: 'c1', upTo: M2 })
    expect(chat.unreadFor('c1')).toBe(0)
  })

  it('leaves the marker and increments the count while hidden (7.5)', async () => {
    const fake = makeFake(async () => entries(0))
    await mount(fake)
    act(() => {
      chat.openConversation('c1')
    })
    setVisibility('hidden')
    await act(async () => {
      fake.handlers().onMessage(msg({ createdAt: M2 }))
    })
    await flush()
    expect(fake.markRead).not.toHaveBeenCalled()
    expect(chat.unreadFor('c1')).toBe(1)
    expect(chat.total).toBe(1)
  })

  it('increments for a conversation that is not open, but not for own messages', async () => {
    const fake = makeFake(async () => entries(0))
    await mount(fake)
    await act(async () => {
      fake.handlers().onMessage(msg({ createdAt: M2, senderId: SELF }))
    })
    expect(chat.total).toBe(0)
    await act(async () => {
      fake.handlers().onMessage(msg({ createdAt: M2 }))
    })
    expect(chat.total).toBe(1)
    expect(fake.markRead).not.toHaveBeenCalled()
  })

  it('marks read up to the latest message when the tab becomes visible (7.6)', async () => {
    const fake = makeFake(async () => entries(0))
    await mount(fake)
    act(() => {
      chat.openConversation('c1')
    })
    setVisibility('hidden')
    await act(async () => {
      fake.handlers().onMessage(msg({ createdAt: M2 }))
    })
    expect(chat.unreadFor('c1')).toBe(1)
    act(() => {
      chat.reportLatest('c1', M2)
    })

    setVisibility('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await flush()
    expect(fake.markRead).toHaveBeenCalledWith({ conversationId: 'c1', upTo: M2 })
    expect(chat.unreadFor('c1')).toBe(0)
  })

  it('does nothing on becoming hidden or when no conversation is open', async () => {
    const fake = makeFake()
    await mount(fake)
    act(() => {
      chat.reportLatest('c1', M2)
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => {
      chat.openConversation('c1')
    })
    setVisibility('hidden')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(fake.markRead).not.toHaveBeenCalled()
  })

  it('stops handling visibility for a closed conversation', async () => {
    const fake = makeFake()
    await mount(fake)
    act(() => {
      chat.openConversation('c1')
      chat.reportLatest('c1', M2)
      chat.closeConversation('c1')
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(fake.markRead).not.toHaveBeenCalled()
  })
})

describe('ChatProvider reconnect', () => {
  it('re-subscribes every 5 s while disconnected, then refreshes and notifies listeners once connected', async () => {
    const fake = makeFake()
    await mount(fake)
    const onReconnect = vi.fn()
    act(() => {
      chat.addListener({ onReconnect })
    })
    expect(fake.subscribe).toHaveBeenCalledTimes(1)
    expect(fake.loadUnreadTotal).toHaveBeenCalledTimes(1)

    await act(async () => {
      fake.handlers().onStatus('disconnected')
    })
    await advance(RECONNECT_INTERVAL_MS)
    expect(fake.subscribe).toHaveBeenCalledTimes(2)
    await advance(RECONNECT_INTERVAL_MS)
    expect(fake.subscribe).toHaveBeenCalledTimes(3)
    expect(onReconnect).not.toHaveBeenCalled()

    await act(async () => {
      fake.handlers().onStatus('connected')
    })
    await flush()
    expect(onReconnect).toHaveBeenCalledTimes(1)
    expect(fake.loadUnreadTotal).toHaveBeenCalledTimes(2)

    await advance(RECONNECT_INTERVAL_MS * 3)
    expect(fake.subscribe).toHaveBeenCalledTimes(3)
  })

  it('does not refresh on a connected status without a prior outage', async () => {
    const fake = makeFake()
    await mount(fake)
    const onReconnect = vi.fn()
    act(() => {
      chat.addListener({ onReconnect })
    })
    await act(async () => {
      fake.handlers().onStatus('connected')
    })
    await flush()
    expect(onReconnect).not.toHaveBeenCalled()
    expect(fake.loadUnreadTotal).toHaveBeenCalledTimes(1)
  })

  it('refreshed counts replace stale ones after reconnect', async () => {
    let n = 3
    const fake = makeFake(async () => entries(n))
    await mount(fake)
    n = 7
    await act(async () => {
      fake.handlers().onStatus('disconnected')
    })
    await act(async () => {
      fake.handlers().onStatus('connected')
    })
    await flush()
    expect(chat.total).toBe(7)
  })
})
