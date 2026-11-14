import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { unreadReducer, totalUnread, initialUnreadState } from './unreadReducer'
import type { UnreadState, UnreadCount } from './unreadReducer'

const RUNS = { numRuns: 100 }
const ids = ['c1', 'c2', 'c3', 'c4']
const BASE = Date.UTC(2024, 0, 1)
const timeArb = fc.integer({ min: 0, max: 1_000_000 }).map((s) => new Date(BASE + s * 1000).toISOString())
const countArb: fc.Arbitrary<UnreadCount> = fc.oneof(
  fc.integer({ min: 0, max: 500 }),
  fc.constant('unknown' as const),
)

const stateArb: fc.Arbitrary<UnreadState> = fc
  .tuple(
    fc.dictionary(fc.constantFrom(...ids), countArb),
    fc.dictionary(fc.constantFrom(...ids), timeArb),
    fc.constantFrom('idle', 'loaded', 'failed' as const),
  )
  .map(([counts, markers, status]) => ({ counts, markers, status }) as UnreadState)

describe('unreadReducer properties', () => {
  // Feature: chat-messaging, Property 10: Received messages change unread counts correctly
  // **Validates: Requirements 6.4, 7.1, 7.2, 9.6**
  it('MESSAGE_RECEIVED is a no-op for self/old messages, otherwise +1 on that conversation only', () => {
    fc.assert(
      fc.property(
        stateArb,
        fc.constantFrom(...ids),
        fc.constantFrom('me', 'other'),
        timeArb,
        (state, conversationId, senderId, createdAt) => {
          const next = unreadReducer(state, {
            type: 'MESSAGE_RECEIVED',
            conversationId,
            senderId,
            selfId: 'me',
            createdAt,
          })
          const marker = state.markers[conversationId]
          const stale = marker !== undefined && Date.parse(createdAt) <= Date.parse(marker)
          const cur = state.counts[conversationId]
          if (senderId === 'me' || stale || cur === 'unknown') {
            expect(next).toEqual(state)
            return
          }
          expect(next.counts[conversationId]).toBe((cur ?? 0) + 1)
          for (const id of ids) {
            if (id !== conversationId) expect(next.counts[id]).toEqual(state.counts[id])
          }
          expect(next.markers).toEqual(state.markers)
        },
      ),
      RUNS,
    )
  })

  // Feature: chat-messaging, Property 11: Mark-read is monotonic and idempotent
  // **Validates: Requirements 7.9, 7.10, 9.6**
  it('MARK_READ never moves a marker backwards and is idempotent', () => {
    fc.assert(
      fc.property(stateArb, fc.constantFrom(...ids), timeArb, (state, conversationId, upTo) => {
        const action = { type: 'MARK_READ' as const, conversationId, upTo }
        const once = unreadReducer(state, action)
        const marker = state.markers[conversationId]
        if (marker !== undefined && Date.parse(upTo) <= Date.parse(marker)) {
          expect(once.markers[conversationId]).toBe(marker)
          expect(once.counts[conversationId]).toEqual(state.counts[conversationId])
        } else {
          expect(once.markers[conversationId]).toBe(upTo)
          expect(once.counts[conversationId]).toBe(0)
        }
        const newMarker = once.markers[conversationId]
        if (marker !== undefined) {
          expect(Date.parse(newMarker)).toBeGreaterThanOrEqual(Date.parse(marker))
        }
        expect(unreadReducer(once, action)).toEqual(once)
      }),
      RUNS,
    )
  })

  // Feature: chat-messaging, Property 12: Total unread is the uncapped sum
  // **Validates: Requirements 9.7, 9.9**
  it('totalUnread sums numeric counts without a cap, treating unknown as 0', () => {
    fc.assert(
      fc.property(
        stateArb,
        fc.constantFrom(...ids),
        (state, id) => {
          let expected = 0
          for (const c of Object.values(state.counts)) if (typeof c === 'number') expected += c
          expect(totalUnread(state)).toBe(expected)
          // Marking one count unknown leaves the others untouched.
          const marked: UnreadState = { ...state, counts: { ...state.counts, [id]: 'unknown' } }
          for (const other of ids) {
            if (other !== id) expect(marked.counts[other]).toEqual(state.counts[other])
          }
          const own = state.counts[id]
          expect(totalUnread(marked)).toBe(expected - (typeof own === 'number' ? own : 0))
        },
      ),
      RUNS,
    )
    // Explicit uncapped case.
    expect(totalUnread({ ...initialUnreadState, counts: { a: 99, b: 50 } })).toBe(149)
  })

  // Feature: chat-messaging, Property 13: Sign-out clears unread
  // **Validates: Requirements 8.8**
  it('RESET yields a state with zero total unread', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const next = unreadReducer(state, { type: 'RESET' })
        expect(totalUnread(next)).toBe(0)
      }),
      RUNS,
    )
  })
})
