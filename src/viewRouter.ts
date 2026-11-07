import type { AuthState } from './auth/authReducer'

export type View = 'loading' | 'home' | 'landing'

/**
 * Pure mapping from auth state to the top-level view.
 * Any status other than 'authenticated' or 'loading' (including unknown
 * or recovering) falls back to the landing page.
 */
export function selectView(state: Pick<AuthState, 'status'>): View {
  switch (state.status) {
    case 'authenticated':
      return 'home'
    case 'loading':
      return 'loading'
    default:
      return 'landing'
  }
}
