import { describe, it, expect } from 'vitest'
import { mergeMessages, mergeTimeline, oldestCursor } from './messageState'
import type { ChatMessage, ConversationEvent } from './chatService'

const T0 = '2024-01-01T00:00:00.000Z'
const T1 = '2024-01-01T00:00:01.000Z'

function msg(id: string, createdAt: string, seq: number): ChatMessage {
  return { id, conversationId: 'c1', senderId: 'u1', senderName: 'ann', text: id, createdAt, seq }
}

function evt(id: string, kind: 'joined' | 'left', createdAt: string): ConversationEvent {
  return { id, conversationId: 'c1', kind, userId: 'u2', userName: 'bob', createdAt }
}

describe('mergeMessages', () => {
  it('orders equal timestamps by seq', () => {
    const merged = mergeMessages([msg('a', T0, 3)], [msg('b', T0, 1), msg('c', T0, 2)])
    expect(merged.map((m) => m.id)).toEqual(['b', 'c', 'a'])
  })

  it('drops duplicate ids', () => {
    const merged = mergeMessages([msg('a', T0, 1)], [msg('a', T0, 1), msg('b', T1, 2)])
    expect(merged.map((m) => m.id)).toEqual(['a', 'b'])
  })
})

describe('oldestCursor', () => {
  it('returns undefined for an empty list', () => {
    expect(oldestCursor([])).toBeUndefined()
  })

  it('returns the cursor of the oldest message, using seq to break ties', () => {
    expect(oldestCursor([msg('a', T1, 1), msg('b', T0, 5), msg('c', T0, 4)])).toEqual({
      createdAt: T0,
      seq: 4,
    })
  })
})

describe('mergeTimeline', () => {
  it('interleaves joined and left notices chronologically with messages', () => {
    const items = mergeTimeline(
      [msg('m1', T0, 1), msg('m2', T1, 2)],
      [evt('e1', 'joined', T0), evt('e2', 'left', T1)],
    )
    expect(items.map((i) => `${i.type}:${i.id}`)).toEqual([
      'event:e1',
      'message:m1',
      'event:e2',
      'message:m2',
    ])
    const kinds = items.flatMap((i) => (i.type === 'event' ? [i.event.kind] : []))
    expect(kinds).toEqual(['joined', 'left'])
  })

  it('drops duplicate events and messages', () => {
    const items = mergeTimeline(
      [msg('m1', T0, 1), msg('m1', T0, 1)],
      [evt('e1', 'joined', T0), evt('e1', 'joined', T0)],
    )
    expect(items).toHaveLength(2)
  })
})
