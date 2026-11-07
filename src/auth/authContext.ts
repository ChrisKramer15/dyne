import { createContext, useContext } from 'react'
import type { AuthState } from './authReducer'

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const state = useContext(AuthContext)
  if (state === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return state
}
