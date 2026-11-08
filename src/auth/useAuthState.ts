import { useEffect, useReducer } from 'react'
import { supabase } from '../supabase'
import { authReducer } from './authReducer'
import type { AuthSessionLike, AuthState } from './authReducer'

/** Minimal slice of the Supabase client used by the hook (injectable for tests). */
export interface AuthStateClient {
  auth: {
    getSession(): PromiseLike<{
      data: { session: AuthSessionLike | null }
      error: unknown
    }>
    onAuthStateChange(
      callback: (event: string, session: AuthSessionLike | null) => void,
    ): { data: { subscription: { unsubscribe(): void } } }
  }
}

export const DEFAULT_AUTH_TIMEOUT_MS = 5_000

const initialState: AuthState = { status: 'loading' }

export function useAuthState(
  client: AuthStateClient = supabase,
  timeoutMs: number = DEFAULT_AUTH_TIMEOUT_MS,
): AuthState {
  const [state, dispatch] = useReducer(authReducer, initialState)

  useEffect(() => {
    let cancelled = false

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!cancelled) dispatch({ type: 'AUTH_EVENT', event, session })
    })

    const timer = setTimeout(() => {
      if (!cancelled) dispatch({ type: 'SESSION_FAILED' })
    }, timeoutMs)

    Promise.resolve(client.auth.getSession()).then(
      ({ data: result, error }) => {
        if (cancelled) return
        clearTimeout(timer)
        if (error) dispatch({ type: 'SESSION_FAILED' })
        else dispatch({ type: 'SESSION_RESOLVED', session: result?.session ?? null })
      },
      () => {
        if (cancelled) return
        clearTimeout(timer)
        dispatch({ type: 'SESSION_FAILED' })
      },
    )

    return () => {
      cancelled = true
      clearTimeout(timer)
      data.subscription.unsubscribe()
    }
  }, [client, timeoutMs])

  return state
}
