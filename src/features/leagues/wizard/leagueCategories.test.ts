import { describe, expect, it } from 'vitest'
import {
  categoriesFor,
  defaultRoster,
  defaultScoring,
  ROSTER_POSITIONS,
  SCORING_CATEGORIES,
  SCORING_GROUPS,
} from './leagueCategories'
import { initialDraft } from './leagueDraft'
import { validateDraft } from './leagueValidation'

describe('league categories', () => {
  it('lists the eleven roster positions in order', () => {
    expect(ROSTER_POSITIONS.map((p) => p.label)).toEqual([
      'Starting Pitcher',
      'Relief Pitcher',
      'Closing Pitcher',
      'Catcher',
      'First Base',
      'Second Base',
      'Shortstop',
      'Third Base',
      'Left Fielder',
      'Center Fielder',
      'Right Fielder',
    ])
  })

  it('has unique keys and labels, and every group is populated', () => {
    const keys = SCORING_CATEGORIES.map((c) => c.key)
    const labels = SCORING_CATEGORIES.map((c) => `${c.label} (${c.abbr})`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(labels).size).toBe(labels.length)
    for (const g of SCORING_GROUPS) expect(categoriesFor(g).length).toBeGreaterThan(0)
  })

  it('provides defaults for every position and category that pass validation', () => {
    expect(Object.keys(defaultRoster())).toHaveLength(ROSTER_POSITIONS.length)
    expect(Object.keys(defaultScoring())).toHaveLength(SCORING_CATEGORIES.length)
    expect(validateDraft({ ...initialDraft('Redraft'), name: 'My League' })).toEqual({})
  })
})
