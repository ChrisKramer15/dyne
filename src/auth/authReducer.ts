export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; userMetadata: unknown; email?: string; createdAt?: string }
  // Reached only via a password-reset link. A session exists, but the user has
  // not proved they know a password yet, so the app must prompt for a new one
  // rather than treat them as fully signed in.
  | { status: 'recovering'; userMetadata: unknown }

export interface AuthSessionLike {
  user: { user_metadata?: unknown; email?: string; created_at?: string }
}

export type AuthAction =
  | { type: 'SESSION_RESOLVED'; session: AuthSessionLike | null }
  | { type: 'SESSION_FAILED' } // error or timeout
  | { type: 'AUTH_EVENT'; event: string; session: AuthSessionLike | null }

function fromSession(session: AuthSessionLike | null): AuthState {
  return session
    ? {
        status: 'authenticated',
        userMetadata: session.user?.user_metadata,
        ...(session.user?.email ? { email: session.user.email } : {}),
        ...(session.user?.created_at ? { createdAt: session.user.created_at } : {}),
      }
    : { status: 'unauthenticated' }
}

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SESSION_RESOLVED':
      // getSession() and PASSWORD_RECOVERY race on page load. If the recovery
      // event landed first, the initial lookup must not downgrade it to a
      // normal signed-in session (that would skip the new-password prompt).
      if (state.status === 'recovering') return state
      return fromSession(action.session)
    case 'AUTH_EVENT':
      // A recovery link yields a session, but it means "prove a new password",
      // not "signed in". Keep it separate so the UI can prompt for one.
      if (action.event === 'PASSWORD_RECOVERY' && action.session) {
        return { status: 'recovering', userMetadata: action.session.user?.user_metadata }
      }
      // Stay in recovery until the password is actually updated (USER_UPDATED
      // moves us on to authenticated) or the session ends (SIGNED_OUT, e.g. the
      // recovery token expired), which must not leave the user stuck.
      if (
        state.status === 'recovering' &&
        action.event !== 'USER_UPDATED' &&
        action.event !== 'SIGNED_OUT'
      ) {
        return state
      }
      return fromSession(action.session)
    case 'SESSION_FAILED':
      // A late failure (e.g. a timeout firing after resolution) must not
      // override a state that was already determined.
      return state.status === 'loading' ? { status: 'unauthenticated' } : state
  }
}
