import { act, renderHook } from '@testing-library/react'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { usePagination } from '../../shared/usePagination'
import { PREVIEW_MAX_LENGTH, type ConversationSummary } from './chatService'
import { displayName, previewText, sortConversations } from './conversationList'

const RUNS = { numRuns: 100 }

const isoArb = fc
  .date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z'), noInvalidDate: true })
  .map((d) => d.toISOString())

const conversationArb: fc.Arbitrary<ConversationSummary> = fc.record({
  id: fc.uuid(),
  kind: fc.constantFrom('personal' as const, 'group' as const),
  name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  createdAt: isoArb,
  otherUserName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  latestMessageText: fc.option(fc.string({ maxLength: 30 }), { nil: null }),
  latestMessageAt: fc.option(isoArb, { nil: null }),
  unread: fc.option(fc.nat({ max: 200 }), { nil: null }),
})

const listArb = fc.uniqueArray(conversationArb, { selector: (c) => c.id, maxLength: 40 })

describe('conversationList properties', () => {
  // Feature: chat-messaging, Property 3: Conversation list ordering
  // **Validates: Requirements 2.2**
  it('Property 3: sorted output is a permutation, messages first, newest first', () => {
    fc.assert(
      fc.property(listArb, (list) => {
        const sorted = sortConversations(list)
        expect([...sorted].map((c) => c.id).sort()).toEqual(list.map((c) => c.id).sort())

        const firstEmpty = sorted.findIndex((c) => c.latestMessageAt === null)
        if (firstEmpty !== -1) {
          expect(sorted.slice(firstEmpty).every((c) => c.latestMessageAt === null)).toBe(true)
        }
        for (let i = 1; i < sorted.length; i++) {
          const a = sorted[i - 1]
          const b = sorted[i]
          if (a.latestMessageAt !== null && b.latestMessageAt !== null) {
            expect(Date.parse(a.latestMessageAt)).toBeGreaterThanOrEqual(Date.parse(b.latestMessageAt))
          } else if (a.latestMessageAt === null && b.latestMessageAt === null) {
            expect(Date.parse(a.createdAt)).toBeGreaterThanOrEqual(Date.parse(b.createdAt))
          }
        }
      }),
      RUNS,
    )
  })

  // Feature: chat-messaging, Property 4: Conversation entry content
  // **Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.12**
  it('Property 4: display name follows conversation kind', () => {
    fc.assert(
      fc.property(conversationArb, fc.uuid(), (c, viewer) => {
        const expected = c.kind === 'group' ? c.name : c.otherUserName
        expect(displayName(c, viewer)).toBe(expected ?? '')
      }),
      RUNS,
    )
  })

  // Feature: chat-messaging, Property 4: Conversation entry content
  // **Validates: Requirements 2.5, 2.6, 2.12**
  it('Property 4: preview is single-line, capped, and ellipsized only when cut', () => {
    const textArb = fc.oneof(
      fc.constant(null),
      fc.string({ unit: 'binary', maxLength: 300 }),
      fc.array(fc.constantFrom('a', 'b', ' ', '\n', '\r\n', '\t', '😀'), { maxLength: 300 }).map((a) => a.join('')),
    )
    fc.assert(
      fc.property(textArb, (text) => {
        const preview = previewText(text)
        expect(preview).not.toMatch(/[\r\n]/)
        const normalized = (text ?? '').replace(/\s+/g, ' ').trim()
        const normalizedLen = Array.from(normalized).length
        const exceeded = normalizedLen > PREVIEW_MAX_LENGTH
        expect(preview.endsWith('…') && exceeded).toBe(exceeded)
        if (exceeded) {
          expect(Array.from(preview).length).toBe(PREVIEW_MAX_LENGTH + 1)
        } else {
          expect(preview).toBe(normalized)
        }
        if (text === null || text === '') expect(preview).toBe('')
      }),
      RUNS,
    )
  })

  // Feature: chat-messaging, Property 5: Pagination preserves order and page size
  // **Validates: Requirements 2.11**
  it('Property 5: concatenated pages equal the list and no page exceeds the page size', () => {
    fc.assert(
      fc.property(listArb, fc.integer({ min: 1, max: 15 }), (list, perPage) => {
        const sorted = sortConversations(list)
        const { result } = renderHook(() => usePagination(sorted, perPage))
        const pageCount = result.current.pageCount
        const all: ConversationSummary[] = []
        for (let p = 0; p < pageCount; p++) {
          act(() => result.current.setPage(p))
          expect(result.current.visible.length).toBeLessThanOrEqual(perPage)
          all.push(...result.current.visible)
        }
        expect(all).toEqual(sorted)
      }),
      RUNS,
    )
  })
})
