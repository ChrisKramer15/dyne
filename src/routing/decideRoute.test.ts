import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { decideRoute, type RouteAccess } from './decideRoute'

const routeAccessArb: fc.Arbitrary<RouteAccess> = fc.record(
  {
    access: fc.constantFrom('public' as const, 'protected' as const),
    redirectAuthenticated: fc.boolean(),
  },
  { requiredKeys: ['access'] },
)

describe('decideRoute properties', () => {
  // Feature: app-routing, Property 1: Loading never redirects
  it('Property 1: loading never redirects', () => {
    // **Validates: Requirements 4.1, 4.3, 7.4**
    fc.assert(
      fc.property(routeAccessArb, (route) => {
        expect(decideRoute('loading', route)).toEqual({ kind: 'pending' })
      }),
      { numRuns: 100 },
    )
  })
})

describe('decideRoute protected content', () => {
  // Feature: app-routing, Property 2: Protected content only for authenticated users
  it('Property 2: protected routes render iff authenticated; otherwise redirect to /', () => {
    // **Validates: Requirements 3.1, 3.2, 3.3, 5.3, 11.4**
    const protectedArb = fc.record(
      { access: fc.constant('protected' as const), redirectAuthenticated: fc.boolean() },
      { requiredKeys: ['access'] },
    )
    fc.assert(
      fc.property(
        protectedArb,
        fc.constantFrom('authenticated', 'recovering', 'unauthenticated'),
        (route, status) => {
          const decision = decideRoute(status, route)
          if (status === 'authenticated') {
            expect(decision).toEqual({ kind: 'render' })
          } else {
            expect(decision).toEqual({ kind: 'redirect', to: '/' })
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('decideRoute recovery precedence', () => {
  // Feature: app-routing, Property 3: Recovery precedence
  it('Property 3: recovering never redirects to /home and never renders a protected route', () => {
    // **Validates: Requirements 5.1, 5.2, 5.3, 7.5**
    fc.assert(
      fc.property(routeAccessArb, (route) => {
        const decision = decideRoute('recovering', route)
        expect(decision).not.toEqual({ kind: 'redirect', to: '/home' })
        if (route.access === 'protected') {
          expect(decision.kind).not.toBe('render')
        }
      }),
      { numRuns: 100 },
    )
  })
})

describe('decideRoute unknown statuses', () => {
  // Feature: app-routing, Property 4: Unknown statuses behave as unauthenticated
  it('Property 4: unknown statuses behave exactly as unauthenticated', () => {
    // **Validates: Requirements 3.6**
    const known = ['loading', 'recovering', 'authenticated', 'unauthenticated']
    const unknownArb = fc.string().filter((s) => !known.includes(s))
    fc.assert(
      fc.property(unknownArb, routeAccessArb, (status, route) => {
        expect(decideRoute(status, route)).toEqual(decideRoute('unauthenticated', route))
      }),
      { numRuns: 100 },
    )
  })
})

describe('decideRoute authenticated users leaving the Landing_Page', () => {
  // Feature: app-routing, Property 5: Authenticated users leave the Landing_Page
  it('Property 5: authenticated public routes redirect to /home iff redirectAuthenticated', () => {
    // **Validates: Requirements 1.5, 2.2**
    const publicArb = fc.record(
      { access: fc.constant('public' as const), redirectAuthenticated: fc.boolean() },
      { requiredKeys: ['access'] },
    )
    fc.assert(
      fc.property(publicArb, (route) => {
        const decision = decideRoute('authenticated', route)
        if (route.redirectAuthenticated) {
          expect(decision).toEqual({ kind: 'redirect', to: '/home' })
        } else {
          expect(decision).toEqual({ kind: 'render' })
        }
      }),
      { numRuns: 100 },
    )
  })
})

describe('decideRoute determinism and loop freedom', () => {
  // Feature: app-routing, Property 6: Determinism and loop freedom
  it('Property 6: repeated evaluation is equal and redirects never lead to another redirect', () => {
    // **Validates: Requirements 3.5, 8.8, 11.3**
    const landing: RouteAccess = { access: 'public', redirectAuthenticated: true }
    const home: RouteAccess = { access: 'protected' }
    const statusArb = fc.oneof(
      fc.constantFrom('authenticated', 'recovering', 'unauthenticated'),
      fc.string(),
    )
    fc.assert(
      fc.property(statusArb, routeAccessArb, (status, route) => {
        const first = decideRoute(status, route)
        expect(decideRoute(status, route)).toEqual(first)

        if (first.kind === 'redirect') {
          const target = first.to === '/' ? landing : home
          const next = decideRoute(status, target)
          expect(['render', 'recovery']).toContain(next.kind)
        }
      }),
      { numRuns: 100 },
    )
  })
})
