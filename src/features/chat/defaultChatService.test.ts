import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SERVICE_TIMEOUT_MS } from '../../auth/authService'
import { createChatService } from './defaultChatService'

type Result = { data: unknown; error: unknown }
const ok = (data: unknown): Result => ({ data, error: null })
const fail = (error: unknown): Result => ({ data: null, error })

/** Chainable, thenable stand-in for a Supabase query builder. */
function builder(result: Result | Promise<Result>) {
  const calls: { method: string; args: unknown[] }[] = []
  const b: Record<string, unknown> = {
    calls,
    then: (res: (v: Result) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej),
  }
  for (const m of [
    'select',
    'eq',
    'or',
    'order',
    'limit',
    'insert',
    'single',
    'maybeSingle',
  ]) {
    b[m] = (...args: unknown[]) => {
      calls.push({ method: m, args })
      return b
    }
  }
  return b as typeof b & { calls: typeof calls }
}

type Handler = (payload: { new?: unknown; old?: unknown }) => void

function makeClient(opts: {
  userId?: string | null
  from?: Record<string, Result[]>
  rpc?: Record<string, Result | Promise<Result>>
}) {
  const userId = opts.userId === undefined ? 'me' : opts.userId
  const queues = Object.fromEntries(
    Object.entries(opts.from ?? {}).map(([k, v]) => [k, [...v]]),
  )
  const builders: ReturnType<typeof builder>[] = []
  const listeners: { filter: { table: string; filter?: string }; cb: Handler }[] = []
  let statusCb: ((s: string) => void) | undefined
  const channel: Record<string, unknown> = {
    on: vi.fn((_t: string, filter: { table: string; filter?: string }, cb: Handler) => {
      listeners.push({ filter, cb })
      return channel
    }),
    subscribe: vi.fn((cb: (s: string) => void) => {
      statusCb = cb
      return channel
    }),
  }
  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: userId ? { user: { id: userId } } : null },
      })),
    },
    from: vi.fn((table: string) => {
      const next = queues[table]?.shift() ?? ok(null)
      const b = builder(next)
      builders.push(b)
      return b
    }),
    rpc: vi.fn((name: string) => builder(opts.rpc?.[name] ?? ok(null))),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
  }
  return {
    client: client as unknown as SupabaseClient,
    raw: client,
    builders,
    listeners,
    status: (s: string) => statusCb?.(s),
  }
}

const msgRow = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  conversation_id: 'c1',
  sender_id: 'me',
  text: 'hi',
  created_at: '2024-01-01T00:00:00Z',
  seq: '5',
  ...over,
})
const members = ok([
  { user_id: 'me', username: 'alice' },
  { user_id: 'u2', username: 'bob' },
])

afterEach(() => {
  vi.useRealTimers()
})

describe('result mapping', () => {
  it('maps conversation rows, converting unread to number and keeping null', async () => {
    const { client } = makeClient({
      rpc: {
        list_conversations: ok([
          {
            conversation_id: 'c1',
            kind: 'personal',
            name: null,
            created_at: 't0',
            other_user_name: 'bob',
            latest_message_text: 'yo',
            latest_message_at: 't1',
            unread: '3',
            last_read_at: 't0',
          },
          {
            conversation_id: 'c2',
            kind: 'group',
            name: 'G',
            created_at: 't0',
            other_user_name: null,
            latest_message_text: null,
            latest_message_at: null,
            unread: null,
            last_read_at: 't0',
          },
        ]),
      },
    })
    const r = await createChatService(client).listConversations()
    expect(r).toEqual({
      ok: true,
      conversations: [
        {
          id: 'c1',
          kind: 'personal',
          name: null,
          createdAt: 't0',
          otherUserName: 'bob',
          latestMessageText: 'yo',
          latestMessageAt: 't1',
          unread: 3,
        },
        expect.objectContaining({ id: 'c2', name: 'G', unread: null }),
      ],
    })
  })

  it('returns unavailable on an rpc error', async () => {
    const { client } = makeClient({ rpc: { list_conversations: fail({ message: 'x' }) } })
    expect(await createChatService(client).listConversations()).toEqual({
      ok: false,
      error: 'unavailable',
    })
  })

  it('getConversation returns not_found when absent', async () => {
    const { client } = makeClient({ rpc: { list_conversations: ok([]) } })
    expect(await createChatService(client).getConversation('zz')).toEqual({
      ok: false,
      error: 'not_found',
    })
  })

  it('maps message rows with sender names and numeric seq', async () => {
    const { client } = makeClient({
      from: { messages: [ok([msgRow({ sender_id: 'u2' })])] },
      rpc: { conversation_members: members },
    })
    const r = await createChatService(client).loadMessages({ conversationId: 'c1', limit: 50 })
    expect(r).toEqual({
      ok: true,
      hasMore: false,
      messages: [
        {
          id: 'm1',
          conversationId: 'c1',
          senderId: 'u2',
          senderName: 'bob',
          text: 'hi',
          createdAt: '2024-01-01T00:00:00Z',
          seq: 5,
        },
      ],
    })
  })

  it('falls back to a placeholder name when members cannot be loaded', async () => {
    const { client } = makeClient({
      from: { messages: [ok([msgRow({ sender_id: 'ghost' })])] },
      rpc: { conversation_members: fail({ message: 'x' }) },
    })
    const r = await createChatService(client).loadMessages({ conversationId: 'c1', limit: 50 })
    expect(r.ok && r.messages[0].senderName).toBe('Former member')
  })

  it('maps rpc errors for personal conversations, groups and leaving', async () => {
    const svc = (name: string, message: string) =>
      createChatService(makeClient({ rpc: { [name]: fail({ message }) } }).client)
    expect(
      await svc('get_or_create_personal_conversation', 'self_conversation').openPersonalConversation('x'),
    ).toEqual({ ok: false, error: 'self' })
    expect(
      await svc('create_group_conversation', 'too_few_members').createGroup({ name: 'g', memberIds: [] }),
    ).toEqual({ ok: false, error: 'invalid' })
    expect(await svc('leave_group_conversation', 'not_participant').leaveGroup('c')).toEqual({
      ok: false,
      error: 'not_found',
    })
  })

  it('maps send errors by SQLSTATE', async () => {
    const send = async (code: string) => {
      const { client } = makeClient({ from: { messages: [fail({ code })] } })
      return createChatService(client).sendMessage({ id: 'm1', conversationId: 'c1', text: 'a' })
    }
    expect(await send('42501')).toEqual({ ok: false, error: 'not_participant' })
    expect(await send('23514')).toEqual({ ok: false, error: 'invalid' })
    expect(await send('XX000')).toEqual({ ok: false, error: 'unavailable' })
  })

  it('markRead maps the first returned row', async () => {
    const { client } = makeClient({
      rpc: { mark_conversation_read: ok([{ last_read_at: 't9', unread: '2' }]) },
    })
    expect(await createChatService(client).markRead({ conversationId: 'c1', upTo: 't9' })).toEqual({
      ok: true,
      lastReadAt: 't9',
      unread: 2,
    })
  })
})

describe('timeouts', () => {
  it('reports unavailable when the request never settles', async () => {
    vi.useFakeTimers()
    const { client } = makeClient({ rpc: { list_conversations: new Promise<Result>(() => {}) } })
    const p = createChatService(client).listConversations()
    await vi.advanceTimersByTimeAsync(SERVICE_TIMEOUT_MS + 1)
    expect(await p).toEqual({ ok: false, error: 'unavailable' })
  })

  it('sendMessage reports unavailable on timeout', async () => {
    vi.useFakeTimers()
    const { client, raw } = makeClient({})
    raw.from.mockImplementation(() => builder(new Promise<Result>(() => {})))
    const p = createChatService(client).sendMessage({ id: 'm1', conversationId: 'c1', text: 'a' })
    await vi.advanceTimersByTimeAsync(SERVICE_TIMEOUT_MS + 1)
    expect(await p).toEqual({ ok: false, error: 'unavailable' })
  })
})

describe('retry after a lost response', () => {
  it('treats a primary-key conflict as success and returns the stored message', async () => {
    const { client, raw } = makeClient({
      from: { messages: [fail({ code: '23505' }), ok(msgRow())] },
      rpc: { conversation_members: members },
    })
    const r = await createChatService(client).sendMessage({
      id: 'm1',
      conversationId: 'c1',
      text: 'hi',
    })
    expect(r).toEqual({
      ok: true,
      message: expect.objectContaining({ id: 'm1', senderName: 'alice', seq: 5 }),
    })
    expect(raw.from).toHaveBeenCalledTimes(2)
  })

  it('reports unavailable when a conflicting row cannot be read back', async () => {
    const { client } = makeClient({
      from: { messages: [fail({ code: '23505' }), ok(null)] },
    })
    expect(
      await createChatService(client).sendMessage({ id: 'm1', conversationId: 'c1', text: 'a' }),
    ).toEqual({ ok: false, error: 'unavailable' })
  })

  it('reports unavailable without a session', async () => {
    const { client } = makeClient({ userId: null })
    expect(
      await createChatService(client).sendMessage({ id: 'm1', conversationId: 'c1', text: 'a' }),
    ).toEqual({ ok: false, error: 'unavailable' })
  })
})

describe('pagination cursor', () => {
  it('requests limit+1 rows, reports hasMore and returns the page oldest-first', async () => {
    const rows = [3, 2, 1].map((n) =>
      msgRow({ id: `m${n}`, seq: n, created_at: `2024-01-0${n}T00:00:00Z` }),
    )
    const { client, builders } = makeClient({
      from: { messages: [ok(rows)] },
      rpc: { conversation_members: members },
    })
    const r = await createChatService(client).loadMessages({ conversationId: 'c1', limit: 2 })
    expect(r.ok && r.hasMore).toBe(true)
    expect(r.ok && r.messages.map((m) => m.id)).toEqual(['m2', 'm3'])
    const calls = builders[0].calls
    expect(calls).toContainEqual({ method: 'limit', args: [3] })
    expect(calls).toContainEqual({ method: 'order', args: ['created_at', { ascending: false }] })
    expect(calls).toContainEqual({ method: 'order', args: ['seq', { ascending: false }] })
    expect(calls.some((c) => c.method === 'or')).toBe(false)
  })

  it('applies a keyset filter strictly older than the cursor', async () => {
    const { client, builders } = makeClient({
      from: { messages: [ok([msgRow()])] },
      rpc: { conversation_members: members },
    })
    await createChatService(client).loadMessages({
      conversationId: 'c1',
      limit: 50,
      before: { createdAt: '2024-01-02T00:00:00Z', seq: 7 },
    })
    const or = builders[0].calls.find((c) => c.method === 'or')
    expect(or?.args[0]).toBe(
      'created_at.lt."2024-01-02T00:00:00Z",and(created_at.eq."2024-01-02T00:00:00Z",seq.lt.7)',
    )
  })

  it('returns not_found for an empty page on an invisible conversation', async () => {
    const { client } = makeClient({
      from: { messages: [ok([])], conversations: [ok(null)] },
    })
    expect(
      await createChatService(client).loadMessages({ conversationId: 'c1', limit: 50 }),
    ).toEqual({ ok: false, error: 'not_found' })
  })

  it('returns an empty page for a visible conversation without messages', async () => {
    const { client } = makeClient({
      from: { messages: [ok([])], conversations: [ok({ id: 'c1' })] },
    })
    expect(
      await createChatService(client).loadMessages({ conversationId: 'c1', limit: 50 }),
    ).toEqual({ ok: true, messages: [], hasMore: false })
  })
})

describe('subscribe', () => {
  const flush = () => vi.waitFor(() => expect(true).toBe(true))

  function handlers() {
    return {
      onMessage: vi.fn(),
      onEvent: vi.fn(),
      onOwnParticipantChange: vi.fn(),
      onStatus: vi.fn(),
    }
  }

  it('wires three postgres_changes listeners, filtering participants by own user id', async () => {
    const t = makeClient({})
    createChatService(t.client).subscribe(handlers())
    await vi.waitFor(() => expect(t.listeners).toHaveLength(3))
    expect(t.listeners.map((l) => l.filter.table)).toEqual([
      'messages',
      'conversation_events',
      'conversation_participants',
    ])
    expect(t.listeners[2].filter.filter).toBe('user_id=eq.me')
  })

  it('delivers mapped messages, events and participant changes, and reports status', async () => {
    const t = makeClient({ rpc: { conversation_members: members } })
    const h = handlers()
    createChatService(t.client).subscribe(h)
    await vi.waitFor(() => expect(t.listeners).toHaveLength(3))

    t.listeners[0].cb({ new: msgRow({ sender_id: 'u2' }) })
    await vi.waitFor(() =>
      expect(h.onMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm1', senderName: 'bob', seq: 5 }),
      ),
    )

    t.listeners[1].cb({
      new: { id: 'e1', conversation_id: 'c1', kind: 'left', user_id: 'u2', created_at: 't' },
    })
    await vi.waitFor(() =>
      expect(h.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'e1', kind: 'left', userName: 'bob' }),
      ),
    )

    t.listeners[2].cb({ new: { conversation_id: 'c1' } })
    t.listeners[2].cb({ old: { conversation_id: 'c2' } })
    expect(h.onOwnParticipantChange.mock.calls).toEqual([['c1'], ['c2']])

    t.status('SUBSCRIBED')
    t.status('CHANNEL_ERROR')
    expect(h.onStatus.mock.calls).toEqual([['connected'], ['disconnected']])
  })

  it('reports disconnected and opens no channel without a session', async () => {
    const t = makeClient({ userId: null })
    const h = handlers()
    createChatService(t.client).subscribe(h)
    await vi.waitFor(() => expect(h.onStatus).toHaveBeenCalledWith('disconnected'))
    expect(t.raw.channel).not.toHaveBeenCalled()
  })

  it('removes the channel and stops delivering after unsubscribe', async () => {
    const t = makeClient({ rpc: { conversation_members: members } })
    const h = handlers()
    const unsub = createChatService(t.client).subscribe(h)
    await vi.waitFor(() => expect(t.listeners).toHaveLength(3))
    unsub()
    expect(t.raw.removeChannel).toHaveBeenCalledTimes(1)
    t.listeners[0].cb({ new: msgRow() })
    t.status('SUBSCRIBED')
    await flush()
    expect(h.onMessage).not.toHaveBeenCalled()
    expect(h.onStatus).not.toHaveBeenCalled()
  })

  it('does not open a channel when unsubscribed before the session resolves', async () => {
    const t = makeClient({})
    const unsub = createChatService(t.client).subscribe(handlers())
    unsub()
    await flush()
    await new Promise((r) => setTimeout(r, 0))
    expect(t.raw.channel).not.toHaveBeenCalled()
  })
})
