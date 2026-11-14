import { createBrowserRouter, type RouteObject } from 'react-router'
import type { DyneRouteHandle } from './decideRoute'
import NotFoundView from './NotFoundView'
import {
  ChatConversationRoute,
  ChatListRoute,
  HomeRoute,
  LandingRoute,
  LeaguesRoute,
  ProfileRoute,
} from './RouteViews'
import { RouteGuard } from './RouteGuard'

// No route exists for any Auth_Modal mode: the modal is state-driven.
export const appRoutes: RouteObject[] = [
  {
    element: <RouteGuard />,
    // Catches URLs the router can't match at all (e.g. malformed percent
    // encoding), which would otherwise show React Router's default error page.
    errorElement: <NotFoundView />,
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
        path: '/leagues',
        element: <LeaguesRoute />,
        handle: { access: 'protected', title: 'Leagues' } satisfies DyneRouteHandle,
      },
      {
        path: '/profile',
        element: <ProfileRoute />,
        handle: { access: 'protected', title: 'Profile' } satisfies DyneRouteHandle,
      },
      {
        path: '/chat',
        element: <ChatListRoute />,
        handle: { access: 'protected', title: 'Chat' } satisfies DyneRouteHandle,
      },
      {
        path: '/chat/:conversationId',
        element: <ChatConversationRoute />,
        handle: { access: 'protected', title: 'Conversation' } satisfies DyneRouteHandle,
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
