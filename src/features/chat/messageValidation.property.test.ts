import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MAX_MESSAGE_LENGTH } from './chatService'
import { validateMessage } from './messageValidation'

const RUNS = { numRuns: 100 }

const whitespaceArb = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r', '\u00a0', '\u2003', '\u3000'), { maxLength: 50 })
  .map((a) => a.join(''))

const visibleCharArb = fc.constantFrom('a', 'Z', '7', '!', 'é', '漢', '😀', '👩‍💻')

const singleCodePointArb = fc.constantFrom('a', 'Z', '7', '!', 'é', '漢', '😀')

const lengthOf = (s: string) => Array.from(s).length

// Text with at least one non-whitespace code point and at most MAX_MESSAGE_LENGTH code points.
const validTextArb = fc
  .tuple(
    whitespaceArb,
    visibleCharArb,
    fc.array(fc.oneof(visibleCharArb, fc.constant(' ')), { maxLength: 100 }).map((a) => a.join('')),
    whitespaceArb,
  )
  .map(([pre, c, mid, post]) => pre + c + mid + post)
  .filter((s) => lengthOf(s) <= MAX_MESSAGE_LENGTH)

describe('messageValidation properties', () => {
  // Feature: chat-messaging, Property 7: Message validation
  // **Validates: Requirements 5.1, 5.3, 5.4**
  it('Property 7: rejects blank text as empty', () => {
    fc.assert(
      fc.property(whitespaceArb, (text) => {
        expect(validateMessage(text)).toEqual({ ok: false, error: 'empty' })
      }),
      RUNS,
    )
  })

  // Feature: chat-messaging, Property 7: Message validation
  it('Property 7: rejects text over the code point limit as too_long', () => {
    fc.assert(
      fc.property(
        singleCodePointArb,
        fc.integer({ min: MAX_MESSAGE_LENGTH + 1, max: MAX_MESSAGE_LENGTH + 200 }),
        (c, n) => {
          expect(validateMessage(c.repeat(n))).toEqual({ ok: false, error: 'too_long' })
        },
      ),
      RUNS,
    )
  })

  // Feature: chat-messaging, Property 7: Message validation
  it('Property 7: accepts non-blank text within the limit, returned unchanged', () => {
    fc.assert(
      fc.property(validTextArb, (text) => {
        expect(validateMessage(text)).toEqual({ ok: true, text })
      }),
      RUNS,
    )
  })

  // Feature: chat-messaging, Property 7: Message validation
  it('Property 7: boundary at exactly MAX_MESSAGE_LENGTH code points', () => {
    fc.assert(
      fc.property(singleCodePointArb, (c) => {
        expect(validateMessage(c.repeat(MAX_MESSAGE_LENGTH)).ok).toBe(true)
        expect(validateMessage(c.repeat(MAX_MESSAGE_LENGTH + 1))).toEqual({
          ok: false,
          error: 'too_long',
        })
      }),
      RUNS,
    )
  })
})
