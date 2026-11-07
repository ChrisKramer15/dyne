import { createBrowserRouter, type RouteObject } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import Homepage from '../Homepage'
import LandingPage from '../LandingPage'
import type { RouteAccess } from './decideRoute'
import NotFoundView from './NotFoundView'
import { RouteGuard } from './RouteGuard'

export interface DyneRouteHandle extends RouteAccess {
  /** Used to build document.title. */
  title: string
}

export function LandingRoute() {
  return <LandingPage />
}

export function HomeRoute() {
  const auth = useAuth()
  // The guard already prevents any other status; this narrows the type.
  if (auth.status !== 'authenticated') return null
  return <Homepage userMetadata={auth.userMetadata} />
}

// No route exists for any Auth_Modal mode: the modal is state-driven.
export const appRoutes: RouteObject[] = [
  {
    element: <RouteGuard />,
    children: [
      {
        path: '/',
        element: <LandingRoute />,
        handle: {
          access: 'public',
          redirectAuthenticated: true,
          title: 'Dyne',
        } satisfies DyneRouteHandle,
      },
      {
        path: '/home',
        element: <HomeRoute />,
        handle: { access: 'protected', title: 'Home' } satisfies DyneRouteHandle,
      },
      {
        path: '*',
        element: <NotFoundView />,
        handle: { access: 'public', title: 'Page not found' } satisfies DyneRouteHandle,
      },
    ],
  },
]

export function createAppRouter(opts?: Parameters<typeof createBrowserRouter>[1]) {
  return createBrowserRouter(appRoutes, { basename: import.meta.env.BASE_URL, ...opts })
}
