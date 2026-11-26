export interface ScoringStat {
  /** Stable key, unique across all categories. Safe to store. */
  key: string
  label: string
  /** Short form shown next to the label, e.g. "HR". */
  abbr: string
  /** Points per occurrence, as the starting value. */
  defaultValue: number
  /** Extra clarification shown under the label. */
  note?: string
}

export interface ScoringCategory {
  id: 'hitting' | 'pitching' | 'fielding'
  title: string
  stats: readonly ScoringStat[]
}

/** Typical head-to-head points values. Every one can be changed in the wizard. */
export const SCORING_CATEGORIES: readonly ScoringCategory[] = [
  {
    id: 'hitting',
    title: 'Hitting',
    stats: [
      { key: 'h_runs', label: 'Runs scored', abbr: 'R', defaultValue: 1 },
      { key: 'h_singles', label: 'Singles', abbr: '1B', defaultValue: 1 },
      { key: 'h_doubles', label: 'Doubles', abbr: '2B', defaultValue: 2 },
      { key: 'h_triples', label: 'Triples', abbr: '3B', defaultValue: 3 },
      { key: 'h_homeRuns', label: 'Home runs', abbr: 'HR', defaultValue: 4 },
      { key: 'h_rbi', label: 'Runs batted in', abbr: 'RBI', defaultValue: 1 },
      { key: 'h_walks', label: 'Walks', abbr: 'BB', defaultValue: 1 },
      { key: 'h_intentionalWalks', label: 'Intentional walks', abbr: 'IBB', defaultValue: 1 },
      { key: 'h_hitByPitch', label: 'Hit by pitch', abbr: 'HBP', defaultValue: 1 },
      { key: 'h_stolenBases', label: 'Stolen bases', abbr: 'SB', defaultValue: 2 },
      { key: 'h_caughtStealing', label: 'Caught stealing', abbr: 'CS', defaultValue: -1 },
      { key: 'h_strikeouts', label: 'Strikeouts', abbr: 'K', defaultValue: -0.5 },
      { key: 'h_gidp', label: 'Grounded into double play', abbr: 'GIDP', defaultValue: -0.5 },
      { key: 'h_sacFlies', label: 'Sacrifice flies', abbr: 'SF', defaultValue: 0.5 },
      { key: 'h_sacBunts', label: 'Sacrifice bunts', abbr: 'SH', defaultValue: 0.5 },
      { key: 'h_cycle', label: 'Hit for the cycle', abbr: 'CYC', defaultValue: 5, note: 'Bonus' },
    ],
  },
  {
    id: 'pitching',
    title: 'Pitching',
    stats: [
      { key: 'p_inningsPitched', label: 'Innings pitched', abbr: 'IP', defaultValue: 3, note: 'Per full inning' },
      { key: 'p_wins', label: 'Wins', abbr: 'W', defaultValue: 5 },
      { key: 'p_losses', label: 'Losses', abbr: 'L', defaultValue: -3 },
      { key: 'p_saves', label: 'Saves', abbr: 'SV', defaultValue: 5 },
      { key: 'p_holds', label: 'Holds', abbr: 'HLD', defaultValue: 3 },
      { key: 'p_blownSaves', label: 'Blown saves', abbr: 'BS', defaultValue: -2 },
      { key: 'p_qualityStarts', label: 'Quality starts', abbr: 'QS', defaultValue: 3 },
      { key: 'p_completeGames', label: 'Complete games', abbr: 'CG', defaultValue: 3 },
      { key: 'p_shutouts', label: 'Complete game shutouts', abbr: 'ShO', defaultValue: 3, note: 'Bonus' },
      { key: 'p_noHitters', label: 'No-hitters', abbr: 'NH', defaultValue: 5, note: 'Bonus' },
      { key: 'p_perfectGames', label: 'Perfect games', abbr: 'PG', defaultValue: 5, note: 'Bonus' },
      { key: 'p_strikeouts', label: 'Strikeouts', abbr: 'K', defaultValue: 1 },
      { key: 'p_hitsAllowed', label: 'Hits allowed', abbr: 'H', defaultValue: -1 },
      { key: 'p_earnedRuns', label: 'Earned runs', abbr: 'ER', defaultValue: -2 },
      { key: 'p_walksAllowed', label: 'Walks allowed', abbr: 'BB', defaultValue: -1 },
      { key: 'p_hitBatters', label: 'Hit batters', abbr: 'HBP', defaultValue: -1 },
      { key: 'p_homeRunsAllowed', label: 'Home runs allowed', abbr: 'HR', defaultValue: -1 },
      { key: 'p_wildPitches', label: 'Wild pitches', abbr: 'WP', defaultValue: -1 },
      { key: 'p_balks', label: 'Balks', abbr: 'BK', defaultValue: -1 },
      { key: 'p_pickoffs', label: 'Pickoffs', abbr: 'PKO', defaultValue: 1 },
    ],
  },
  {
    id: 'fielding',
    title: 'Fielding',
    stats: [
      { key: 'f_putouts', label: 'Putouts', abbr: 'PO', defaultValue: 0.25 },
      { key: 'f_assists', label: 'Assists', abbr: 'A', defaultValue: 0.5 },
      { key: 'f_errors', label: 'Errors', abbr: 'E', defaultValue: -1 },
      { key: 'f_doublePlays', label: 'Double plays turned', abbr: 'DP', defaultValue: 1 },
      { key: 'f_passedBalls', label: 'Passed balls', abbr: 'PB', defaultValue: -1, note: 'Catchers' },
      { key: 'f_catcherCaughtStealing', label: 'Runners caught stealing', abbr: 'CS', defaultValue: 1, note: 'Catchers' },
    ],
  },
]

export const ALL_SCORING_STATS: readonly ScoringStat[] = SCORING_CATEGORIES.flatMap((c) => c.stats)

export const SCORING_LIMIT = 100

/** Raw text from the inputs, keyed by ScoringStat.key. Text so "-" and "0." can be typed. */
export type ScoringValues = Record<string, string>
export type ScoringErrors = Record<string, string>

export function defaultScoring(): ScoringValues {
  return Object.fromEntries(ALL_SCORING_STATS.map((s) => [s.key, String(s.defaultValue)]))
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/

export function parseScoringValue(raw: string): number | null {
  const t = raw.trim()
  if (!NUMBER.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Returns an error message per invalid stat key. Empty when everything is valid. */
export function validateScoring(values: ScoringValues): ScoringErrors {
  const errors: ScoringErrors = {}
  for (const s of ALL_SCORING_STATS) {
    const n = parseScoringValue(values[s.key] ?? '')
    if (n === null) errors[s.key] = 'Enter a number.'
    else if (Math.abs(n) > SCORING_LIMIT) errors[s.key] = `Use ${-SCORING_LIMIT} to ${SCORING_LIMIT}.`
  }
  return errors
}

/** Converts validated text values to numbers. Call only after validateScoring returns no errors. */
export function scoringToNumbers(values: ScoringValues): Record<string, number> {
  return Object.fromEntries(ALL_SCORING_STATS.map((s) => [s.key, parseScoringValue(values[s.key]) ?? s.defaultValue]))
}
