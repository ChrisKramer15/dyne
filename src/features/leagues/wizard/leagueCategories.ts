/** Roster positions and scoring categories offered by the create-league wizard. */

export interface RosterPosition {
  key: string
  label: string
  /** Default number of starting slots, as input text. */
  defaultSlots: string
}

export const ROSTER_POSITIONS: readonly RosterPosition[] = [
  { key: 'SP', label: 'Starting Pitcher', defaultSlots: '4' },
  { key: 'RP', label: 'Relief Pitcher', defaultSlots: '2' },
  { key: 'CP', label: 'Closing Pitcher', defaultSlots: '1' },
  { key: 'C', label: 'Catcher', defaultSlots: '1' },
  { key: '1B', label: 'First Base', defaultSlots: '1' },
  { key: '2B', label: 'Second Base', defaultSlots: '1' },
  { key: 'SS', label: 'Shortstop', defaultSlots: '1' },
  { key: '3B', label: 'Third Base', defaultSlots: '1' },
  { key: 'LF', label: 'Left Fielder', defaultSlots: '1' },
  { key: 'CF', label: 'Center Fielder', defaultSlots: '1' },
  { key: 'RF', label: 'Right Fielder', defaultSlots: '1' },
]

export type ScoringGroup = 'Hitting' | 'Pitching' | 'Fielding'

export const SCORING_GROUPS: readonly ScoringGroup[] = ['Hitting', 'Pitching', 'Fielding']

export interface ScoringCategory {
  /** Unique across all groups; used as the field key and in the stored scoring map. */
  key: string
  group: ScoringGroup
  label: string
  abbr: string
  /** Default points per unit, as input text. */
  defaultPoints: string
}

function cat(
  group: ScoringGroup,
  prefix: string,
  abbr: string,
  label: string,
  defaultPoints: string,
): ScoringCategory {
  return { key: `${prefix}_${abbr.toLowerCase()}`, group, label, abbr, defaultPoints }
}

const hit = (abbr: string, label: string, pts: string) => cat('Hitting', 'bat', abbr, label, pts)
const pit = (abbr: string, label: string, pts: string) => cat('Pitching', 'pit', abbr, label, pts)
const fld = (abbr: string, label: string, pts: string) => cat('Fielding', 'fld', abbr, label, pts)

export const SCORING_CATEGORIES: readonly ScoringCategory[] = [
  hit('1B', 'Singles', '1'),
  hit('2B', 'Doubles', '2'),
  hit('3B', 'Triples', '3'),
  hit('HR', 'Home Runs', '4'),
  hit('R', 'Runs', '1'),
  hit('RBI', 'Runs Batted In', '1'),
  hit('BB', 'Walks', '1'),
  hit('IBB', 'Intentional Walks', '0'),
  hit('HBP', 'Hit By Pitch', '1'),
  hit('SB', 'Stolen Bases', '2'),
  hit('CS', 'Caught Stealing', '-1'),
  hit('K', 'Batter Strikeouts', '-0.5'),
  hit('GIDP', 'Grounded Into Double Play', '-0.5'),
  hit('SF', 'Sacrifice Flies', '0'),
  hit('SH', 'Sacrifice Bunts', '0'),
  hit('H', 'Hits', '0'),
  hit('TB', 'Total Bases', '0'),
  hit('AB', 'At Bats', '0'),
  hit('PA', 'Plate Appearances', '0'),
  hit('G', 'Games Played', '0'),
  hit('CYC', 'Hitting for the Cycle', '0'),

  pit('IP', 'Innings Pitched', '3'),
  pit('W', 'Wins', '5'),
  pit('L', 'Losses', '-3'),
  pit('SV', 'Saves', '5'),
  pit('HLD', 'Holds', '2'),
  pit('BS', 'Blown Saves', '-2'),
  pit('QS', 'Quality Starts', '3'),
  pit('CG', 'Complete Games', '3'),
  pit('SHO', 'Shutouts', '3'),
  pit('NH', 'No-Hitters', '5'),
  pit('PG', 'Perfect Games', '10'),
  pit('K', 'Pitcher Strikeouts', '1'),
  pit('H', 'Hits Allowed', '-1'),
  pit('R', 'Runs Allowed', '-1'),
  pit('ER', 'Earned Runs', '-2'),
  pit('BB', 'Walks Allowed', '-1'),
  pit('HBP', 'Hit Batters', '-1'),
  pit('HR', 'Home Runs Allowed', '-1'),
  pit('WP', 'Wild Pitches', '-1'),
  pit('BK', 'Balks', '-1'),
  pit('PK', 'Pickoffs', '1'),
  pit('G', 'Games Pitched', '0'),
  pit('GS', 'Games Started', '0'),

  fld('PO', 'Putouts', '0'),
  fld('A', 'Assists', '0'),
  fld('E', 'Errors', '-1'),
  fld('DP', 'Double Plays Turned', '0'),
  fld('TP', 'Triple Plays Turned', '0'),
  fld('OFA', 'Outfield Assists', '1'),
  fld('PB', 'Passed Balls', '-1'),
  fld('SBA', 'Stolen Bases Allowed (Catcher)', '0'),
  fld('CSB', 'Runners Caught Stealing (Catcher)', '0'),
  fld('TC', 'Total Chances', '0'),
  fld('G', 'Games Played in the Field', '0'),
]

export function categoriesFor(group: ScoringGroup): ScoringCategory[] {
  return SCORING_CATEGORIES.filter((c) => c.group === group)
}

export const ROSTER_FIELD_PREFIX = 'roster.'
export const SCORING_FIELD_PREFIX = 'scoring.'

export function defaultRoster(): Record<string, string> {
  return Object.fromEntries(ROSTER_POSITIONS.map((p) => [p.key, p.defaultSlots]))
}

export function defaultScoring(): Record<string, string> {
  return Object.fromEntries(SCORING_CATEGORIES.map((c) => [c.key, c.defaultPoints]))
}
