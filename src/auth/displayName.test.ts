import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { formatWelcome, getDisplayName, MAX_NAME_LENGTH } from './displayName'

const RUNS = { numRuns: 100 }

const whitespace = fc.stringMatching(/^[ \t\n\r]{0,5}$/)

// Names with no leading/trailing whitespace; may be empty.
const trimmedName = fc
  .string({ unit: 'binary', maxLength: 120 })
  .map((s) => s.trim())

const nonEmptyTrimmedName = trimmedName.filter((s) => s.length > 0)

// Arbitrary metadata values, including malformed ones.
const anyMetadata = fc.oneof(
  fc.anything(),
  fc.constant(null),
  fc.constant(undefined),
  fc.record({ username: fc.anything() }),
  fc.record({ username: fc.string({ unit: 'binary', maxLength: 120 }) }),
  fc.record({ other: fc.string() }),
)

function expectedName(metadata: unknown): string {
  if (typeof metadata !== 'object' || metadata === null) return ''
  const u = (metadata as Record<string, unknown>).username
  return typeof u === 'string' ? u.trim() : ''
}

describe('displayName properties', () => {
  // Feature: landing-page, Property 1: Display name derivation
  // **Validates: Requirements 5.3, 5.4**
  it('Property 1: getDisplayName returns trimmed username or empty string', () => {
    fc.assert(
      fc.property(nonEmptyTrimmedName, whitespace, whitespace, (name, pre, post) => {
        expect(getDisplayName({ username: `${pre}${name}${post}` })).toBe(name)
      }),
      RUNS,
    )
    fc.assert(
      fc.property(anyMetadata, (metadata) => {
        expect(getDisplayName(metadata)).toBe(expectedName(metadata))
      }),
      RUNS,
    )
    fc.assert(
      fc.property(whitespace, (blank) => {
        expect(getDisplayName({ username: blank })).toBe('')
      }),
      RUNS,
    )
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.array(fc.string())),
        (username) => {
          expect(getDisplayName({ username })).toBe('')
        },
      ),
      RUNS,
    )
    for (const m of [null, undefined, 'str', 42, true, {}]) {
      expect(getDisplayName(m)).toBe('')
    }
  })

  // Feature: landing-page, Property 2: Welcome message formatting
  // **Validates: Requirements 5.1, 5.4, 5.6**
  it('Property 2: formatWelcome formats, truncates, and handles empty names', () => {
    fc.assert(
      fc.property(anyMetadata, (metadata) => {
        const name = expectedName(metadata)
        const result = formatWelcome(metadata)
        if (name === '') {
          expect(result).toBe('Welcome Back')
          return
        }
        const points = Array.from(name)
        const shown =
          points.length <= MAX_NAME_LENGTH
            ? name
            : points.slice(0, MAX_NAME_LENGTH).join('') + '…'
        expect(result).toBe(`Welcome Back, ${shown}`)
      }),
      RUNS,
    )
    // Long names are always truncated to 50 code points plus an ellipsis.
    fc.assert(
      fc.property(
        fc
          .string({ unit: 'binary', minLength: MAX_NAME_LENGTH + 1, maxLength: 150 })
          .filter((s) => Array.from(s.trim()).length > MAX_NAME_LENGTH),
        (long) => {
          const result = formatWelcome({ username: long })
          const suffix = result.slice('Welcome Back, '.length)
          expect(Array.from(suffix)).toHaveLength(MAX_NAME_LENGTH + 1)
          expect(suffix.endsWith('…')).toBe(true)
        },
      ),
      RUNS,
    )
  })
})
