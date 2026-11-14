import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { mergeMessages, compareMessages } from './messageState'
import type { ChatMessage } from './chatService'

const RUNS = { numRuns: 100 }
const BASE = Date.UTC(2024, 0, 1)

// Small timestamp range so ties on createdAt are common.
const poolArb: fc.Arbitrary<ChatMessage[]> = fc
  .array(
    fc.record({
      t: fc.integer({ min: 0, max: 5 }),
      seq: fc.integer({ min: 1, max: 1000 }),
    }),
    { maxLength: 30 },
  )
  .map((rows) =>
    rows.map((r, i) => ({
      id: `m${i}`,
      conversationId: 'c1',
      senderId: 'u1',
      senderName: 'user',
      text: `t${i}`,
      createdAt: new Date(BASE + r.t * 1000).toISOString(),
      seq: r.seq,
    })),
  )

/** A pool plus two (possibly overlapping, shuffled, duplicated) selections from it. */
const scenarioArb = poolArb.chain((pool) => {
  const pick = pool.length
    ? fc.array(fc.constantFrom(...pool), { maxLength: 40 })
    : fc.constant([] as ChatMessage[])
  return fc.tuple(fc.constant(pool), pick, pick)
})

describe('messageState properties', () => {
  // Feature: chat-messaging, Property 8: Message merge is ordered, unique, and idempotent
  // **Validates: Requirements 5.2, 6.1, 6.3, 6.6, 6.11**
  it('merge result is sorted by (createdAt, seq), has unique ids, contains every input id, and is idempotent', () => {
    fc.assert(
      fc.property(scenarioArb, ([, a, b]) => {
        const merged = mergeMessages(a, b)

        const ids = merged.map((m) => m.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(new Set(ids)).toEqual(new Set([...a, ...b].map((m) => m.id)))

        for (let i = 1; i < merged.length; i++) {
          const prev = merged[i - 1]
          const cur = merged[i]
          const pt = Date.parse(prev.createdAt)
          const ct = Date.parse(cur.createdAt)
          expect(pt < ct || (pt === ct && prev.seq <= cur.seq)).toBe(true)
          expect(compareMessages(prev, cur)).toBeLessThanOrEqual(0)
        }

        // Idempotent and independent of argument order.
        expect(mergeMessages(merged, b)).toEqual(merged)
        expect(mergeMessages(merged, merged)).toEqual(merged)
        expect(mergeMessages(merged, [])).toEqual(merged)
        expect(mergeMessages(b, a)).toEqual(merged)
      }),
      RUNS,
    )
  })
})
