import { Suspense, useState } from 'react'
import { Navigate, Outlet, useLocation, useMatches } from 'react-router'
import { useAuth } from '../auth/authContext'
import { LandingView } from '../features/landing/LandingPage'
import { decideRoute, type RouteAccess } from './decideRoute'
import { LoadingView } from './LoadingView'
import { RouteEffects } from './RouteEffects'
import { readReturnPath, type ReturnState } from './returnPath'

const DEFAULT_ACCESS: RouteAccess = { access: 'protected' }

/**
 * Pathless layout route that wraps every route. Reads the matched route's
 * `handle` and the auth state, then applies `decideRoute`.
 *
 * A logged-out visit to a protected route is sent to `/` carrying the original
 * path, and the redirect that follows a successful login honours it. Signing
 * out (authenticated -> unauthenticated) deliberately does not remember the
 * page, so the next login lands on the default home page.
 */
export function RouteGuard() {
  const auth = useAuth()
  const matches = useMatches()
  const location = useLocation()
  const last = matches.at(-1)
  const route = (last?.handle as RouteAccess | undefined) ?? DEFAULT_ACCESS
  const decision = decideRoute(auth.status, route)

  // Detect "was authenticated, now isn't" and pin it to the location that was
  // showing at that moment. Any later navigation has a new key, so only the
  // redirect caused by signing out is treated as a sign-out.
  const [tracked, setTracked] = useState<{ status: string; signedOutKey: string | null }>({
    status: auth.status,
    signedOutKey: null,
  })
  if (tracked.status !== auth.status) {
    setTracked({
      status: auth.status,
      signedOutKey: tracked.status === 'authenticated' ? location.key : null,
    })
  }
  const justSignedOut = tracked.signedOutKey === location.key

  switch (decision.kind) {
    case 'pending':
      return <LoadingView />
    case 'redirect': {
      if (decision.to === '/home') {
        return <Navigate to={readReturnPath(location.state) ?? '/home'} replace />
      }
      const remember = auth.status === 'unauthenticated' && !justSignedOut
      const state: ReturnState | undefined = remember
        ? { from: `${location.pathname}${location.search}${location.hash}` }
        : undefined
      return <Navigate to="/" replace state={state} />
    }
    case 'recovery':
      return (
        <>
          <LandingView auth={auth} />
          <RouteEffects settledKey="recovery" />
        </>
      )
    case 'render':
      // RouteEffects sits inside the boundary so title and focus are applied
      // only once a lazily loaded page has actually rendered.
      return (
        <Suspense fallback={<LoadingView />}>
          <Outlet />
          <RouteEffects settledKey={last?.id ?? 'unknown'} />
        </Suspense>
      )
  }
}

export default RouteGuard
