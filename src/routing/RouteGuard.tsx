import { Navigate, Outlet, useMatches } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { LandingView } from '../LandingPage'
import { decideRoute, type RouteAccess } from './decideRoute'
import { LoadingView } from './LoadingView'
import { RouteEffects } from './RouteEffects'

const DEFAULT_ACCESS: RouteAccess = { access: 'protected' }

/**
 * Pathless layout route that wraps every route. Reads the matched route's
 * `handle` and the auth state, then applies `decideRoute`.
 */
export function RouteGuard() {
  const auth = useAuth()
  const matches = useMatches()
  const last = matches.at(-1)
  const route = (last?.handle as RouteAccess | undefined) ?? DEFAULT_ACCESS
  const decision = decideRoute(auth.status, route)

  switch (decision.kind) {
    case 'pending':
      return <LoadingView />
    case 'redirect':
      return <Navigate to={decision.to} replace />
    case 'recovery':
      return (
        <>
          <LandingView auth={auth} />
          <RouteEffects settledKey="recovery" />
        </>
      )
    case 'render':
      return (
        <>
          <Outlet />
          <RouteEffects settledKey={last?.id ?? 'unknown'} />
        </>
      )
  }
}

export default RouteGuard
