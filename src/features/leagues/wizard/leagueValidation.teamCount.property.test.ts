import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { initialDraft } from './leagueDraft'
import {
  GUILLOTINE_FORMAT,
  GUILLOTINE_MIN_TEAMS,
  MAX_TEAMS,
  MIN_TEAMS,
  teamCountMessage,
  validateStep,
} from './leagueValidation'

/**
 * Property 4: Team count validation depends on the current format
 * **Validates: Requirements 5.3, 5.4, 5.5, 5.6**
 */

const otherFormatArb = fc.oneof(
  fc.string({ maxLength: 20 }).filter((s) => s !== GUILLOTINE_FORMAT),
  fc.constantFrom('Redraft', 'Dynasty', 'Keeper'),
)
const formatArb = fc.oneof(fc.constant(GUILLOTINE_FORMAT), otherFormatArb)

const digitsArb = fc.nat({ max: 999 }).map(String)
const teamCountArb = fc.oneof(
  fc.integer({ min: -5, max: 30 }).map(String),
  digitsArb,
  fc.string({ maxLength: 6 }),
  fc.constantFrom('', ' ', '4.5', '1e1', '-6', '+8', 'abc', '0x10', ' 8 ', '08'),
)

function oracle(format: string, raw: string): boolean {
  const min = format === GUILLOTINE_FORMAT ? GUILLOTINE_MIN_TEAMS : MIN_TEAMS
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return false
  const n = Number(t)
  return n >= min && n <= MAX_TEAMS
}

const teamErrors = (format: string, teamCount: string) =>
  validateStep({ ...initialDraft(format), teamCount }, 'general').teamCount

describe('Property 4: team count validation depends on the current format', () => {
  it('reports an error exactly when the count is outside the format range', () => {
    fc.assert(
      fc.property(formatArb, teamCountArb, (format, teamCount) => {
        const err = teamErrors(format, teamCount)
        expect(err === undefined).toBe(oracle(format, teamCount))
        if (err !== undefined) {
          const min = format === GUILLOTINE_FORMAT ? GUILLOTINE_MIN_TEAMS : MIN_TEAMS
          expect(err).toBe(teamCountMessage(min))
        }
      }),
      { numRuns: 200 },
    )
  })

  it('accepts 4 and 5 for non-Guillotine formats and rejects them for Guillotine', () => {
    fc.assert(
      fc.property(otherFormatArb, fc.constantFrom('4', '5'), (format, teamCount) => {
        expect(teamErrors(format, teamCount)).toBeUndefined()
        expect(teamErrors(GUILLOTINE_FORMAT, teamCount)).toBe(teamCountMessage(GUILLOTINE_MIN_TEAMS))
      }),
    )
  })

  it('switching format re-evaluates the same count under the new format', () => {
    fc.assert(
      fc.property(formatArb, formatArb, teamCountArb, (a, b, teamCount) => {
        expect(teamErrors(a, teamCount) === undefined).toBe(oracle(a, teamCount))
        expect(teamErrors(b, teamCount) === undefined).toBe(oracle(b, teamCount))
      }),
    )
  })
})
