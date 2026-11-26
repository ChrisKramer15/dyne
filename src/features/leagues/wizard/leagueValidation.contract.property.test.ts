import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ROSTER_POSITIONS } from './leagueCategories'
import { STEPS } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'
import { rosterArb, scoringArb } from './draftArbitraries.testutil'
import { fieldsFor, validateStep } from './leagueValidation'
import type { FieldName } from './leagueValidation'

const draftArb: fc.Arbitrary<LeagueDraft> = fc.record({
  format: fc.oneof(fc.constantFrom('Guillotine', 'Redraft', 'Dynasty'), fc.string({ maxLength: 10 })),
  name: fc.oneof(fc.string({ maxLength: 70 }), fc.string({ unit: 'binary', maxLength: 60 })),
  teamCount: fc.oneof(
    fc.integer({ min: -5, max: 40 }).map(String),
    fc.string({ maxLength: 6 }),
    fc.constantFrom('', ' 8 ', '7.5', 'abc', '1e1'),
  ),
  roster: rosterArb,
  scoring: scoringArb,
})

const stepArb = fc.constantFrom(...STEPS.map((s) => s.id as StepId))

const len = (s: string) => Array.from(s.trim()).length
const validSlots = (v: string) => /^\d+$/.test(v.trim()) && Number(v.trim()) <= 10
const validPoints = (v: string) => /^-?\d+(\.\d+)?$/.test(v.trim()) && Math.abs(Number(v.trim())) <= 100

/** Independent oracle: is the field invalid under the spec rules? */
function isInvalid(field: FieldName, d: LeagueDraft): boolean {
  if (field === 'name') return len(d.name) === 0 || len(d.name) > 50
  if (field === 'teamCount') {
    const t = d.teamCount.trim()
    if (!/^\d+$/.test(t)) return true
    const min = d.format === 'Guillotine' ? 6 : 4
    return Number(t) < min || Number(t) > 32
  }
  if (field.startsWith('roster.')) {
    const key = field.slice('roster.'.length)
    if (!validSlots(d.roster[key])) return true
    const allValid = ROSTER_POSITIONS.every((p) => validSlots(d.roster[p.key]))
    const total = ROSTER_POSITIONS.reduce((n, p) => n + Number(d.roster[p.key].trim()), 0)
    return field === `roster.${ROSTER_POSITIONS[0].key}` && allValid && total === 0
  }
  return !validPoints(d.scoring[field.slice('scoring.'.length)])
}

describe('leagueValidation contract properties', () => {
  it('is deterministic, non-mutating, and reports only invalid fields of the step', () => {
    fc.assert(
      fc.property(draftArb, stepArb, (draft, step) => {
        const before = structuredClone(draft)
        const first = validateStep(draft, step)
        const second = validateStep(draft, step)
        expect(draft).toEqual(before)
        expect(second).toEqual(first)
        const stepFields = fieldsFor(step)
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
