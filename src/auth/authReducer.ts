export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; userMetadata: unknown }
  // Reached only via a password-reset link. A session exists, but the user has
  // not proved they know a password yet, so the app must prompt for a new one
  // rather than treat them as fully signed in.
  | { status: 'recovering'; userMetadata: unknown }

export interface AuthSessionLike {
  user: { user_metadata?: unknown }
}

export type AuthAction =
  | { type: 'SESSION_RESOLVED'; session: AuthSessionLike | null }
  | { type: 'SESSION_FAILED' } // error or timeout
  | { type: 'AUTH_EVENT'; event: string; session: AuthSessionLike | null }

function fromSession(session: AuthSessionLike | null): AuthState {
  return session
    ? { status: 'authenticated', userMetadata: session.user?.user_metadata }
    : { status: 'unauthenticated' }
}

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SESSION_RESOLVED':
      return fromSession(action.session)
    case 'AUTH_EVENT':
      // A recovery link yields a session, but it means "prove a new password",
      // not "signed in". Keep it separate so the UI can prompt for one.
      if (action.event === 'PASSWORD_RECOVERY' && action.session) {
        return { status: 'recovering', userMetadata: action.session.user?.user_metadata }
      }
      // Stay in recovery until the password is actually updated. Supabase emits
      // a USER_UPDATED event on success, which moves us on to authenticated.
      if (state.status === 'recovering' && action.event !== 'USER_UPDATED') {
        return state
      }
      return fromSession(action.session)
    case 'SESSION_FAILED':
      // A late failure (e.g. a timeout firing after resolution) must not
      // override a state that was already determined.
      return state.status === 'loading' ? { status: 'unauthenticated' } : state
  }
}
