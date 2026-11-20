import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { buildReviewSummary, NO_DESCRIPTION_PLACEHOLDER } from './reviewSummary'
import type { LeagueDraft } from './leagueDraft'

/**
 * Property 11: Review summary shows every draft value
 * **Validates: Requirements 7.1, 7.2, 7.4**
 */
const formatsArb = fc.uniqueArray(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  { minLength: 1, maxLength: 5 },
)

const nameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0)

const blankArb = fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 10 }).map((a) => a.join(''))

const descriptionArb = fc.oneof(fc.string({ maxLength: 280 }), blankArb)

function validDraftArb(formats: readonly string[]): fc.Arbitrary<LeagueDraft> {
  return fc.record({
    format: fc.constantFrom(...formats),
    name: nameArb,
    description: descriptionArb,
    teamCount: fc.integer({ min: 6, max: 20 }).map(String),
    visibility: fc.constantFrom('private' as const, 'public' as const),
  })
}

const scenarioArb = formatsArb.chain((formats) =>
  fc.record({
    formats: fc.constant(formats),
    first: validDraftArb(formats),
    second: validDraftArb(formats),
  }),
)

function byField(groups: ReturnType<typeof buildReviewSummary>) {
  return Object.fromEntries(groups.map((g) => [g.field, g.value]))
}

function expectMatches(draft: LeagueDraft) {
  const groups = buildReviewSummary(draft)
  expect(groups.map((g) => g.field)).toEqual([
    'format',
    'name',
    'description',
    'teamCount',
    'visibility',
  ])
  const v = byField(groups)
  expect(v.format).toBe(draft.format)
  expect(v.name).toBe(draft.name.trim())
  expect(v.description).toBe(
    draft.description.trim() === '' ? NO_DESCRIPTION_PLACEHOLDER : draft.description.trim(),
  )
  expect(v.teamCount).toBe(draft.teamCount.trim())
  expect(v.visibility).toBe(draft.visibility === 'public' ? 'Public' : 'Private')
  expect(groups.every((g) => !g.invalid)).toBe(true)
}

describe('Property 11: review summary shows every draft value', () => {
  it('has one group per field whose value matches the draft', () => {
    fc.assert(
      fc.property(scenarioArb, ({ first }) => {
        expectMatches(first)
      }),
    )
  })

  it('uses the placeholder for empty or whitespace-only descriptions', () => {
    fc.assert(
      fc.property(scenarioArb, blankArb, ({ first }, blank) => {
        const groups = buildReviewSummary({ ...first, description: blank })
        expect(groups.find((g) => g.field === 'description')?.value).toBe(
          NO_DESCRIPTION_PLACEHOLDER,
        )
      }),
    )
  })

  it('reflects the latest draft after an edit', () => {
    fc.assert(
      fc.property(scenarioArb, ({ first, second }) => {
        buildReviewSummary(first)
        expectMatches(second)
        expect(buildReviewSummary(second)).toEqual(buildReviewSummary({ ...second }))
      }),
    )
  })
})
