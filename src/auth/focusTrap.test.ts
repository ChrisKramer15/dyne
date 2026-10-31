import { describe, it } from 'vitest'
import fc from 'fast-check'
import { nextFocusIndex } from './focusTrap'

const RUNS = { numRuns: 100 }

describe('focusTrap', () => {
  // Feature: auth-modal, Property 4: Focus wraps within the dialog
  // **Validates: Requirements 1.7, 7.3, 7.4**
  it('Feature: auth-modal, Property 4: focus wraps within the dialog', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.boolean(),
        fc.nat(),
        (count, shift, seed) => {
          const current = seed % count
          const next = nextFocusIndex(count, current, shift)

          // Always lands on a valid element inside the dialog.
          if (next < 0 || next >= count) return false

          if (!shift && current === count - 1) return next === 0 // Tab on last -> first
          if (shift && current === 0) return next === count - 1 // Shift+Tab on first -> last
          return next === (shift ? current - 1 : current + 1)
        },
      ),
      RUNS,
    )
  })

  it('Feature: auth-modal, Property 4: focus outside the list enters the dialog', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.boolean(),
        fc.oneof(fc.integer({ min: -100, max: -1 }), fc.integer({ min: 50, max: 200 })),
        (count, shift, current) => {
          const next = nextFocusIndex(count, current, shift)
          return next === (shift ? count - 1 : 0)
        },
      ),
      RUNS,
    )
  })
})
