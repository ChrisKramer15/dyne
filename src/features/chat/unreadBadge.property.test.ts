import fc from 'fast-check'
import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { badgeText, chatNavLabel, conversationLabel } from './unreadBadge'

const RUNS = { numRuns: 100 }

describe('unreadBadge properties', () => {
  // Feature: chat-messaging, Property 14: Badge text
  // **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4**
  it('Property 14: badge text is empty for 0, exact count for 1..99, "99+" above', () => {
    fc.assert(
      fc.property(fc.nat({ max: 1_000_000 }), (n) => {
        const text = badgeText(n)
        if (n === 0) expect(text).toBe('')
        else if (n <= 99) expect(text).toBe(String(n))
        else expect(text).toBe('99+')
      }),
      RUNS,
    )
  })

  // Feature: chat-messaging, Property 15: Accessible names carry the exact count
  // **Validates: Requirements 8.6, 8.7, 9.8**
  it('Property 15: accessible names carry the exact uncapped count', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (n, name) => {
          const noun = n === 1 ? 'message' : 'messages'
          expect(chatNavLabel(n)).toBe(n === 0 ? 'Chat' : `Chat, ${n} unread ${noun}`)
          expect(conversationLabel(name, n)).toBe(
            n === 0 ? `${name}, no unread messages` : `${name}, ${n} unread ${noun}`,
          )
          expect(conversationLabel(name, null)).toBe(name)
        },
      ),
      RUNS,
    )
  })
})
