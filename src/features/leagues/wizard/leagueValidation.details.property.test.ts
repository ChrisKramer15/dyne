import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { initialDraft } from './leagueDraft'
import {
  validateStep,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  NAME_REQUIRED_MESSAGE,
  NAME_TOO_LONG_MESSAGE,
  DESCRIPTION_TOO_LONG_MESSAGE,
} from './leagueValidation'

const WS = [' ', '\t', '\n', '\u00a0', '\u2003']
const wsArb = fc.array(fc.constantFrom(...WS), { maxLength: 5 }).map((a) => a.join(''))
// Non-whitespace-bearing core, including astral code points (emoji).
const coreArb = fc.array(fc.constantFrom('a', 'Z', '7', 'é', '😀', '漢'), { maxLength: 300 })

const textArb = fc
  .tuple(wsArb, coreArb, wsArb)
  .map(([lead, core, trail]) => ({ raw: lead + core.join('') + trail, len: core.length }))

describe('Property 2: Details validation oracle', () => {
  /** **Validates: Requirements 4.2, 4.3, 4.4, 11.4, 11.5** */
  it('name and description errors match the trimmed code point length oracle', () => {
    fc.assert(
      fc.property(textArb, textArb, ({ raw: name, len: nameLen }, { raw: description, len: descLen }) => {
        const errors = validateStep({ ...initialDraft('Redraft'), name, description }, 'details')

        const expectedName =
          nameLen === 0
            ? NAME_REQUIRED_MESSAGE
            : nameLen > MAX_NAME_LENGTH
              ? NAME_TOO_LONG_MESSAGE
              : undefined
        const expectedDesc = descLen > MAX_DESCRIPTION_LENGTH ? DESCRIPTION_TOO_LONG_MESSAGE : undefined

        expect(errors.name).toBe(expectedName)
        expect(errors.description).toBe(expectedDesc)
        expect(Object.keys(errors).every((k) => k === 'name' || k === 'description')).toBe(true)
      }),
      { numRuns: 200 },
    )
  })
})
