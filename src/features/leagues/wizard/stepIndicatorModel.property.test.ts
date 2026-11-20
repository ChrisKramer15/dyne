import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { STEPS, TOTAL_STEPS } from './leagueDraft'
import { stepIndicatorModel, statusText } from './stepIndicatorModel'

/**
 * Property 10: Step indicator model
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */
const stepArb = fc.integer({ min: 1, max: TOTAL_STEPS })

describe('Property 10: step indicator model', () => {
  it('has one item per step, in order, with titles', () => {
    fc.assert(
      fc.property(stepArb, (current) => {
        const items = stepIndicatorModel(current)
        expect(items).toHaveLength(TOTAL_STEPS)
        items.forEach((item, i) => {
          expect(item.number).toBe(i + 1)
          expect(item.title).toBe(STEPS[i].title)
        })
      }),
    )
  })

  it('marks earlier steps completed and clickable, exactly one current, later steps neither', () => {
    fc.assert(
      fc.property(stepArb, (current) => {
        const items = stepIndicatorModel(current)
        expect(items.filter((i) => i.current)).toHaveLength(1)
        for (const item of items) {
          expect(item.completed).toBe(item.number < current)
          expect(item.current).toBe(item.number === current)
          expect(item.clickable).toBe(item.number < current)
        }
      }),
    )
  })

  it('status text names the step number, total and title', () => {
    fc.assert(
      fc.property(stepArb, (current) => {
        expect(statusText(current)).toBe(
          `Step ${current} of ${TOTAL_STEPS}: ${STEPS[current - 1].title}`,
        )
      }),
    )
  })
})
