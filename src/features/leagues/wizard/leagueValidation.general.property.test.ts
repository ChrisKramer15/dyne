import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { initialDraft } from './leagueDraft'
import {
  validateStep,
  MAX_NAME_LENGTH,
  NAME_REQUIRED_MESSAGE,
  NAME_TOO_LONG_MESSAGE,
} from './leagueValidation'

const WS = [' ', '\t', '\n', '\u00a0', '\u2003']
const wsArb = fc.array(fc.constantFrom(...WS), { maxLength: 5 }).map((a) => a.join(''))
// Non-whitespace core, including astral code points (emoji).
const coreArb = fc.array(fc.constantFrom('a', 'Z', '7', '\u00e9', '\u{1F600}', '\u6f22'), { maxLength: 120 })
const textArb = fc
  .tuple(wsArb, coreArb, wsArb)
  .map(([lead, core, trail]) => ({ raw: lead + core.join('') + trail, len: core.length }))

describe('General validation oracle', () => {
  it('name errors match the trimmed code point length oracle', () => {
    fc.assert(
      fc.property(textArb, ({ raw: name, len }) => {
        const errors = validateStep({ ...initialDraft('Redraft'), name }, 'general')
        const expected =
          len === 0 ? NAME_REQUIRED_MESSAGE : len > MAX_NAME_LENGTH ? NAME_TOO_LONG_MESSAGE : undefined
        expect(errors.name).toBe(expected)
        expect(Object.keys(errors).every((k) => k === 'name' || k === 'teamCount')).toBe(true)
      }),
      { numRuns: 200 },
    )
  })
})
