import { describe, it, expect, vi } from 'vitest'
import fc from 'fast-check'
import { createNavigationGuard } from './useNavigationGuard'

describe('createNavigationGuard', () => {
  /**
   * Property 6: Rapid activations produce one navigation
   * **Validates: Requirements 4.7**
   */
  it('calls navigate exactly once for activations within 1000 ms of the first', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('login' as const, 'register' as const),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(fc.integer({ min: 0, max: 999 }), { minLength: 1 }),
        (target, start, offsets) => {
          // Timestamps are monotonic; the first activation is at `start`.
          const times = [0, ...offsets].sort((a, b) => a - b).map((o) => start + o)
          let i = 0
          const navigate = vi.fn()
          const guard = createNavigationGuard(navigate, 1000, () => times[i])
          for (i = 0; i < times.length; i++) guard(target)
          expect(navigate).toHaveBeenCalledTimes(1)
          expect(navigate).toHaveBeenCalledWith(target)
        },
      ),
      { numRuns: 100 },
    )
  })
})
