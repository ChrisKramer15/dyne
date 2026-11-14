import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { validateGroup } from './groupValidation'
import { MAX_GROUP_NAME_LENGTH, MAX_GROUP_SIZE, MIN_OTHER_GROUP_MEMBERS } from './chatService'

const CREATOR = 'creator'

const nameArb = fc.oneof(
  fc.constant(''),
  fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 5 }).map((a) => a.join('')),
  fc.string({ unit: 'binary', maxLength: 90 }),
  fc.integer({ min: 55, max: 66 }).chain((n) => fc.constant('😀'.repeat(n))),
  fc.integer({ min: 58, max: 62 }).chain((n) => fc.constant('a'.repeat(n))),
)

const memberPool = [CREATOR, ...Array.from({ length: 70 }, (_, i) => `u${i}`)]
const membersArb = fc.oneof(
  fc.array(fc.constantFrom(...memberPool), { maxLength: 120 }),
  fc.shuffledSubarray(memberPool, { minLength: 45, maxLength: 71 }),
)

describe('groupValidation properties', () => {
  // Feature: chat-messaging, Property 6: Group validation
  // **Validates: Requirements 4.3, 4.4, 4.5, 4.6**
  it('accepts exactly when name and distinct other-member count satisfy the rules, with ordered errors', () => {
    fc.assert(
      fc.property(nameArb, membersArb, (name, members) => {
        const others = new Set(members)
        others.delete(CREATOR)
        const nameLen = Array.from(name).length

        let expected: string
        if (name.trim() === '') expected = 'name_required'
        else if (nameLen > MAX_GROUP_NAME_LENGTH) expected = 'name_too_long'
        else if (others.size < MIN_OTHER_GROUP_MEMBERS) expected = 'too_few_members'
        else if (others.size + 1 > MAX_GROUP_SIZE) expected = 'too_many_members'
        else expected = 'ok'

        const result = validateGroup(name, members, CREATOR)
        expect(result.ok ? 'ok' : result.error).toBe(expected)
      }),
      { numRuns: 200 },
    )
  })

  // Feature: chat-messaging, Property 6: Group validation
  // **Validates: Requirements 4.5, 4.6**
  it('ignores duplicates and the creator when counting members', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(memberPool.slice(1), { minLength: 2, maxLength: 49 }), (others) => {
        const padded = [...others, ...others, CREATOR, CREATOR]
        expect(validateGroup('Team', padded, CREATOR)).toEqual({ ok: true })
      }),
      { numRuns: 100 },
    )
  })
})
