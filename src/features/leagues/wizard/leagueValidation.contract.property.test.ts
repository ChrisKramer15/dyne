import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { STEPS } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'
import { FIELD_ORDER, validateStep } from './leagueValidation'
import type { FieldName } from './leagueValidation'

const FORMATS = ['Guillotine', 'Redraft', 'Dynasty']

const draftArb: fc.Arbitrary<LeagueDraft> = fc.record({
  format: fc.oneof(fc.constant(null), fc.constantFrom(...FORMATS), fc.string({ maxLength: 10 })),
  name: fc.oneof(fc.string({ maxLength: 70 }), fc.string({ unit: 'binary', maxLength: 60 })),
  description: fc.string({ maxLength: 320 }),
  teamCount: fc.oneof(
    fc.integer({ min: -5, max: 30 }).map(String),
    fc.string({ maxLength: 6 }),
    fc.constantFrom('', ' 8 ', '7.5', 'abc', '1e1'),
  ),
  visibility: fc.constantFrom('private' as const, 'public' as const),
})

const stepArb = fc.constantFrom(...STEPS.map((s) => s.id as StepId))

const len = (s: string) => Array.from(s.trim()).length

/** Independent oracle: is the field invalid under the spec rules? */
function isInvalid(field: FieldName, d: LeagueDraft): boolean {
  switch (field) {
    case 'format':
      return d.format === null || !FORMATS.includes(d.format)
    case 'name':
      return len(d.name) === 0 || len(d.name) > 50
    case 'description':
      return len(d.description) > 280
    case 'teamCount': {
      const t = d.teamCount.trim()
      if (!/^\d+$/.test(t)) return true
      const min = d.format === 'Guillotine' ? 6 : 4
      return Number(t) < min || Number(t) > 20
    }
    case 'visibility':
      return d.visibility !== 'private' && d.visibility !== 'public'
  }
}

describe('leagueValidation contract properties', () => {
  /**
   * Property 1: Validator contract
   * **Validates: Requirements 11.1, 11.6**
   */
  it('is deterministic, non-mutating, and reports only invalid fields of the step', () => {
    fc.assert(
      fc.property(draftArb, stepArb, (draft, step) => {
        const before = structuredClone(draft)
        const first = validateStep(draft, step, FORMATS)
        const second = validateStep(draft, step, FORMATS)

        expect(draft).toEqual(before)
        expect(second).toEqual(first)

        const stepFields = FIELD_ORDER[step]
        for (const key of Object.keys(first) as FieldName[]) {
          expect(stepFields).toContain(key)
        }
        for (const field of stepFields) {
          const message = first[field]
          if (isInvalid(field, draft)) {
            expect(typeof message).toBe('string')
            expect((message as string).length).toBeGreaterThan(0)
          } else {
            expect(message).toBeUndefined()
            expect(field in first).toBe(false)
          }
        }
      }),
      { numRuns: 200 },
    )
  })
})
