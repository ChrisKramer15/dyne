export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; userMetadata: unknown }

export interface AuthSessionLike {
  user: { user_metadata?: unknown }
}

export type AuthAction =
  | { type: 'SESSION_RESOLVED'; session: AuthSessionLike | null }
  | { type: 'SESSION_FAILED' } // error or timeout
  | { type: 'AUTH_EVENT'; session: AuthSessionLike | null }

function fromSession(session: AuthSessionLike | null): AuthState {
  return session
    ? { status: 'authenticated', userMetadata: session.user?.user_metadata }
    : { status: 'unauthenticated' }
}

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SESSION_RESOLVED':
    case 'AUTH_EVENT':
      return fromSession(action.session)
    case 'SESSION_FAILED':
      // A late failure (e.g. a timeout firing after resolution) must not
      // override a state that was already determined.
      return state.status === 'loading' ? { status: 'unauthenticated' } : state
  }
}
