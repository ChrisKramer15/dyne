import type { AuthState } from '../auth/authReducer'

export interface RouteAccess {
  access: 'public' | 'protected'
  /** Public route that authenticated users are sent away from (Landing). */
  redirectAuthenticated?: boolean
}

export interface DyneRouteHandle extends RouteAccess {
  /** Used to build document.title. */
  title: string
}

export type RouteDecision =
  | { kind: 'pending' }
  | { kind: 'render' }
  | { kind: 'recovery' }
  | { kind: 'redirect'; to: '/' | '/home' }

/**
 * Pure routing decision from auth status and a route's access declaration.
 * Any status outside the four known values is treated as `unauthenticated`.
 */
export function decideRoute(
  status: AuthState['status'] | string,
  route: RouteAccess,
): RouteDecision {
  const isProtected = route.access === 'protected'

  switch (status) {
    case 'loading':
      return { kind: 'pending' }
    case 'recovering':
      return isProtected ? { kind: 'redirect', to: '/' } : { kind: 'recovery' }
    case 'authenticated':
      if (!isProtected && route.redirectAuthenticated) {
        return { kind: 'redirect', to: '/home' }
      }
      return { kind: 'render' }
    default:
      return isProtected ? { kind: 'redirect', to: '/' } : { kind: 'render' }
  }
}
