import { createBrowserRouter, type RouteObject } from 'react-router'
import type { DyneRouteHandle } from './decideRoute'
import NotFoundView from './NotFoundView'
import { HomeRoute, LandingRoute } from './RouteViews'
import { RouteGuard } from './RouteGuard'

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
