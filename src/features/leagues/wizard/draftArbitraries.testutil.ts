import fc from 'fast-check'
import { defaultRoster, defaultScoring } from './leagueCategories'

/** Roster and scoring maps: mostly valid, sometimes with one bad or padded value. */
export const rosterArb: fc.Arbitrary<Record<string, string>> = fc.oneof(
  fc.constant(defaultRoster()),
  fc.constant({ ...defaultRoster(), SP: ' 3 ' }),
  fc.constant({ ...defaultRoster(), C: 'x' }),
  fc.constant({ ...defaultRoster(), CF: '11' }),
  fc.constant(Object.fromEntries(Object.keys(defaultRoster()).map((k) => [k, '0']))),
)

export const scoringArb: fc.Arbitrary<Record<string, string>> = fc.oneof(
  fc.constant(defaultScoring()),
  fc.constant({ ...defaultScoring(), bat_hr: ' 4.5 ' }),
  fc.constant({ ...defaultScoring(), pit_w: 'abc' }),
  fc.constant({ ...defaultScoring(), fld_e: '-101' }),
)

/** Roster and scoring maps that always validate. */
export const validRosterArb: fc.Arbitrary<Record<string, string>> = fc.constantFrom(
  defaultRoster(),
  { ...defaultRoster(), SP: '5', RP: '0' },
)

export const validScoringArb: fc.Arbitrary<Record<string, string>> = fc.constantFrom(
  defaultScoring(),
  { ...defaultScoring(), bat_hr: '6', pit_k: '-0.25' },
)
