import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { initialDraft } from './leagueDraft'
import { validateStep, validateDraft, FORMAT_REQUIRED_MESSAGE } from './leagueValidation'

const FORMATS = ['Redraft', 'Dynasty', 'Guillotine']

const otherFieldsArb = fc.record({
  name: fc.string({ maxLength: 60 }),
  description: fc.string({ maxLength: 300 }),
  teamCount: fc.string({ maxLength: 5 }),
  visibility: fc.constantFrom('private' as const, 'public' as const),
})

// Strings that are not in the catalogue.
const unknownFormatArb = fc.string({ maxLength: 20 }).filter((s) => !FORMATS.includes(s))

describe('Property 3: Format is required', () => {
  /**
   * **Validates: Requirements 3.4**
   */
  it('reports a format error when format is null, regardless of other fields', () => {
    fc.assert(
      fc.property(otherFieldsArb, (rest) => {
        const draft = { ...initialDraft(null), ...rest }
        expect(validateStep(draft, 'format', FORMATS).format).toBe(FORMAT_REQUIRED_MESSAGE)
        expect(validateDraft(draft, FORMATS).format).toBe(FORMAT_REQUIRED_MESSAGE)
      }),
    )
  })

  it('reports a format error when format is not in the catalogue', () => {
    fc.assert(
      fc.property(unknownFormatArb, otherFieldsArb, (format, rest) => {
        const draft = { ...initialDraft(format), ...rest }
        expect(validateStep(draft, 'format', FORMATS).format).toBe(FORMAT_REQUIRED_MESSAGE)
      }),
    )
  })

  it('reports no format error for any catalogue format', () => {
    fc.assert(
      fc.property(fc.constantFrom(...FORMATS), otherFieldsArb, (format, rest) => {
        const draft = { ...initialDraft(format), ...rest }
        expect(validateStep(draft, 'format', FORMATS).format).toBeUndefined()
      }),
    )
  })
})
