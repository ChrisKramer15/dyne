import { describe, expect, it } from 'vitest'
import { initialUnreadState, totalUnread, unreadReducer, type UnreadState } from './unreadReducer'

const T1 = '2024-01-01T00:00:00.000Z'
const T2 = '2024-01-01T00:00:01.000Z'
const T3 = '2024-01-01T00:00:02.000Z'

const loaded = (): UnreadState =>
  unreadReducer(initialUnreadState, {
    type: 'LOADED',
    entries: [{ conversationId: 'a', unread: 2, lastReadAt: T2 }],
  })

const received = (senderId: string, createdAt: string) =>
  ({ type: 'MESSAGE_RECEIVED', conversationId: 'a', senderId, selfId: 'me', createdAt }) as const

describe('unreadReducer', () => {
  it('loads entries and totals them', () => {
    expect(totalUnread(loaded())).toBe(2)
    expect(loaded().status).toBe('loaded')
  })

  it('ignores own messages and messages at or before the marker', () => {
    const s = loaded()
    expect(unreadReducer(s, received('me', T3))).toBe(s)
    expect(unreadReducer(s, received('x', T2))).toBe(s)
    expect(unreadReducer(s, received('x', T1))).toBe(s)
  })

  it('counts newer messages from others', () => {
    expect(totalUnread(unreadReducer(loaded(), received('x', T3)))).toBe(3)
  })

  it('MARK_READ advances, zeroes, and never moves backwards', () => {
    const s = unreadReducer(loaded(), { type: 'MARK_READ', conversationId: 'a', upTo: T3 })
    expect(totalUnread(s)).toBe(0)
    expect(s.markers.a).toBe(T3)
    expect(unreadReducer(s, { type: 'MARK_READ', conversationId: 'a', upTo: T3 })).toBe(s)
    expect(unreadReducer(s, { type: 'MARK_READ', conversationId: 'a', upTo: T1 })).toBe(s)
  })

  it('treats unknown counts as 0', () => {
    const s: UnreadState = { ...loaded(), counts: { a: 'unknown', b: 4 } }
    expect(totalUnread(s)).toBe(4)
  })

  it('confirms, removes, resets and records failure', () => {
    const c = unreadReducer(loaded(), {
      type: 'MARKER_CONFIRMED',
      conversationId: 'a',
      lastReadAt: T3,
      unread: 1,
    })
    expect(c.counts.a).toBe(1)
    expect(c.markers.a).toBe(T3)
    expect(totalUnread(unreadReducer(c, { type: 'CONVERSATION_REMOVED', conversationId: 'a' }))).toBe(0)
    expect(unreadReducer(c, { type: 'RESET' })).toBe(initialUnreadState)
    expect(unreadReducer(initialUnreadState, { type: 'LOAD_FAILED' }).status).toBe('failed')
  })
})

describe('unreadReducer extended', () => {
  it('LOADED replaces prior state and records markers per conversation', () => {
    const s = unreadReducer(loaded(), {
      type: 'LOADED',
      entries: [
        { conversationId: 'b', unread: 5, lastReadAt: T1 },
        { conversationId: 'c', unread: 0, lastReadAt: T3 },
      ],
    })
    expect(s.counts).toEqual({ b: 5, c: 0 })
    expect(s.markers).toEqual({ b: T1, c: T3 })
    expect(s.status).toBe('loaded')
  })

  it('LOAD_FAILED keeps existing data, sets failed, and is idempotent', () => {
    const s = unreadReducer(loaded(), { type: 'LOAD_FAILED' })
    expect(s.status).toBe('failed')
    expect(s.counts).toEqual({ a: 2 })
    expect(unreadReducer(s, { type: 'LOAD_FAILED' })).toBe(s)
  })

  it('MARKER_CONFIRMED stores the server marker and count for a new conversation', () => {
    const s = unreadReducer(initialUnreadState, {
      type: 'MARKER_CONFIRMED',
      conversationId: 'z',
      lastReadAt: T2,
      unread: 3,
    })
    expect(s.counts.z).toBe(3)
    expect(s.markers.z).toBe(T2)
  })

  it('CONVERSATION_REMOVED drops only that conversation and ignores unknown ids', () => {
    const base = unreadReducer(loaded(), {
      type: 'MARKER_CONFIRMED',
      conversationId: 'b',
      lastReadAt: T1,
      unread: 4,
    })
    const s = unreadReducer(base, { type: 'CONVERSATION_REMOVED', conversationId: 'a' })
    expect(s.counts).toEqual({ b: 4 })
    expect(s.markers).toEqual({ b: T1 })
    expect(unreadReducer(s, { type: 'CONVERSATION_REMOVED', conversationId: 'nope' })).toBe(s)
  })

  it('rolls back to the previous marker and count when the server confirms it', () => {
    const before = loaded()
    const optimistic = unreadReducer(before, { type: 'MARK_READ', conversationId: 'a', upTo: T3 })
    expect(optimistic.markers.a).toBe(T3)
    const rolledBack = unreadReducer(optimistic, {
      type: 'MARKER_CONFIRMED',
      conversationId: 'a',
      lastReadAt: before.markers.a,
      unread: 2,
    })
    expect(rolledBack.markers.a).toBe(T2)
    expect(rolledBack.counts.a).toBe(2)
    expect(totalUnread(rolledBack)).toBe(2)
  })
})
