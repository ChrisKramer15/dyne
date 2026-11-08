import { vi } from 'vitest'
import { render, act, type RenderResult } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthContext } from '../auth/authContext'
import type { AuthState } from '../auth/authReducer'
import { appRoutes } from './routes'

// Keep the real Supabase client (and its env-var check) from ever being
// created. LandingView only builds an authService when a modal is open, and it
// reads these two exports from the module; the stub below is inert.
vi.mock('../supabase', () => ({
  authStorage: { clearAll() {} },
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: () => Promise.resolve({ error: null }),
      // Used by the update-password form; always fails so tests can check the error path.
      updateUser: () => Promise.resolve({ error: { message: 'update failed' } }),
    },
  },
}))

type AppRouter = ReturnType<typeof createMemoryRouter>

export type AuthStatus = AuthState['status']

/** Build an AuthState for a status; metadata is only used by Homepage. */
export function authStateFor(status: AuthStatus, userMetadata: unknown = { username: 'Ada' }): AuthState {
  switch (status) {
    case 'authenticated':
    case 'recovering':
      return { status, userMetadata }
    default:
      return { status } as AuthState
  }
}

export interface RenderAppOptions {
  /** Auth status to start with. Ignored when `authState` is given. Default 'unauthenticated'. */
  status?: AuthStatus
  /** Full auth state, for tests that need specific metadata. */
  authState?: AuthState
  path?: string
  search?: string
  hash?: string
}

export interface RenderAppResult extends RenderResult {
  /** The memory router; use `router.state.location` and `router.navigate(-1)`. */
  router: AppRouter
  /** Change the auth state while mounted (wrapped in act). */
  setAuth: (next: AuthStatus | AuthState) => Promise<void>
  /** Current pathname + search + hash, for assertions. */
  currentUrl: () => string
  /** Current router location (history length is not exposed; use `router.navigate(-1)`). */
  location: () => AppRouter['state']['location']
}

/**
 * Mounts the production route table in a memory router inside an AuthContext
 * provider with a fixed, replaceable auth state. Supabase is never touched.
 */
export function renderApp(options: RenderAppOptions = {}): RenderAppResult {
  const { status = 'unauthenticated', path = '/', search = '', hash = '' } = options
  let auth: AuthState = options.authState ?? authStateFor(status)

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [{ pathname: path, search, hash }],
  })

  const tree = () => (
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
  )

  const result = render(tree())

  return {
    ...result,
    router,
    setAuth: async (next) => {
      auth = typeof next === 'string' ? authStateFor(next) : next
      await act(async () => {
        result.rerender(tree())
      })
    },
    currentUrl: () => {
      const l = router.state.location
      return `${l.pathname}${l.search}${l.hash}`
    },
    location: () => router.state.location,
  }
}
