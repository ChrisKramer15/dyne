import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { AuthState } from './authReducer'
import { useAuthState } from './useAuthState'
import type { AuthClientLike } from './useAuthState'

export const AuthContext = createContext<AuthState | null>(null)

/** The only caller of `useAuthState`; exposes Auth_State via context. */
export function AuthProvider({
  client,
  children,
}: {
  client?: AuthClientLike
  children: ReactNode
}) {
  const state = useAuthState(client)
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext)
  if (state === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return state
}
