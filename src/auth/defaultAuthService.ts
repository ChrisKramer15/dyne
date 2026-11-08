import { authStorage, supabase } from '../supabase'
import { createAuthService, type AuthService } from './authService'

let instance: AuthService | null = null

/**
 * The app-wide Supabase-backed auth service, created on first use so merely
 * importing a component does not build one. Components accept an injectable
 * `authService` prop for tests and fall back to this.
 */
export function getDefaultAuthService(): AuthService {
  instance ??= createAuthService(supabase, authStorage)
  return instance
}
