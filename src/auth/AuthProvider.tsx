import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import { useAuthState } from './useAuthState'
import type { AuthClientLike } from './useAuthState'

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
