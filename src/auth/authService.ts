import type { SwitchableStorage } from './switchableStorage'

export type SignInResult =
  | { ok: true; rememberFailed: boolean }
  | { ok: false; error: 'invalid_credentials' | 'unavailable' }

export type SignUpResult =
  | { ok: true; confirmationRequired: boolean; rememberFailed?: never }
  | { ok: false; error: 'username_taken' | 'email_taken' | 'unavailable' }

export type ResetResult = { ok: true } | { ok: false; error: 'reset_unavailable' }

export type UpdatePasswordResult =
  | { ok: true }
  | { ok: false; error: 'update_unavailable' }

export interface AuthService {
  signIn(i: { username: string; password: string; remember: boolean }): Promise<SignInResult>
  signUp(i: { username: string; email: string; password: string }): Promise<SignUpResult>
  requestPasswordReset(identifier: string): Promise<ResetResult>
  updatePassword(newPassword: string): Promise<UpdatePasswordResult>
  signOut(): Promise<void>
}

export const SERVICE_TIMEOUT_MS = 10_000

export class TimeoutError extends Error {
  constructor() {
    super('Request timed out')
    this.name = 'TimeoutError'
  }
}

/**
 * Race a promise against a timer. On timeout the returned promise rejects with
 * TimeoutError; any later settlement of `p` is swallowed and ignored.
 */
export function withTimeout<T>(p: PromiseLike<T>, ms: number = SERVICE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new TimeoutError())
    }, ms)

    Promise.resolve(p).then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function field(err: unknown, key: string): unknown {
  return typeof err === 'object' && err !== null ? (err as Record<string, unknown>)[key] : undefined
}

export function mapSignUpError(err: unknown): 'username_taken' | 'email_taken' | 'unavailable' {
  const code = String(field(err, 'code') ?? '')
  const message = String(field(err, 'message') ?? '')

  if (code === 'user_already_exists' || code === 'email_exists') return 'email_taken'
  if (
    code === 'unique_violation' ||
    code === '23505' ||
    /username|profiles|duplicate key|database error saving new user/i.test(message)
  ) {
    return 'username_taken'
  }
  if (/already (been )?registered|already exists/i.test(message)) return 'email_taken'
  return 'unavailable'
}

export function mapSignUpData(data: {
  session: unknown
  user: { identities?: unknown[] } | null
}): { confirmationRequired: boolean } | { error: 'email_taken' } {
  const identities = data.user?.identities
  if (Array.isArray(identities) && identities.length === 0) return { error: 'email_taken' }
  return { confirmationRequired: data.session == null }
}

/** Structural subset of SupabaseClient used by the service. */
export interface AuthClientLike {
  auth: {
    setSession(tokens: { access_token: string; refresh_token: string }): PromiseLike<{ error: unknown }>
    signUp(args: {
      email: string
      password: string
      options?: { data?: Record<string, unknown> }
    }): PromiseLike<{
      data: { session: unknown; user: { identities?: unknown[] } | null }
      error: unknown
    }>
    updateUser(args: { password: string }): PromiseLike<{ error: unknown }>
    signOut(args?: { scope?: 'global' | 'local' | 'others' }): PromiseLike<{ error: unknown }>
  }
  functions: {
    invoke(name: string, opts?: { body?: unknown }): PromiseLike<{ data: unknown; error: unknown }>
  }
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

function httpStatus(err: unknown): number | undefined {
  const status = field(field(err, 'context'), 'status')
  return typeof status === 'number' ? status : undefined
}

export function createAuthService(client: AuthClientLike, storage: SwitchableStorage): AuthService {
  return {
    async signIn({ username, password, remember }) {
      storage.setMode(remember ? 'local' : 'session')
      try {
        const { data, error } = await withTimeout(
          client.functions.invoke('login-with-username', { body: { username, password } }),
        )
        if (error) {
          return { ok: false, error: httpStatus(error) === 401 ? 'invalid_credentials' : 'unavailable' }
        }
        const tokens = data as { access_token?: unknown; refresh_token?: unknown } | null
        if (!tokens || typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') {
          return { ok: false, error: 'unavailable' }
        }
        const { error: sessionError } = await withTimeout(
          client.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          }),
        )
        if (sessionError) return { ok: false, error: 'unavailable' }
        return { ok: true, rememberFailed: storage.degraded }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async signUp({ username, email, password }) {
      try {
        const { data: available, error: rpcError } = await withTimeout(
          client.rpc('username_available', { u: username }),
        )
        if (rpcError) return { ok: false, error: 'unavailable' }
        if (available === false) return { ok: false, error: 'username_taken' }

        const { data, error } = await withTimeout(
          client.auth.signUp({ email, password, options: { data: { username } } }),
        )
        if (error) return { ok: false, error: mapSignUpError(error) }

        const mapped = mapSignUpData(data)
        if ('error' in mapped) return { ok: false, error: mapped.error }
        return { ok: true, confirmationRequired: mapped.confirmationRequired }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async requestPasswordReset(identifier) {
      try {
        const { error } = await withTimeout(
          client.functions.invoke('request-password-reset', { body: { identifier } }),
        )
        if (error) return { ok: false, error: 'reset_unavailable' }
        return { ok: true }
      } catch {
        return { ok: false, error: 'reset_unavailable' }
      }
    },

    async updatePassword(newPassword) {
      try {
        const { error } = await withTimeout(client.auth.updateUser({ password: newPassword }))
        if (error) return { ok: false, error: 'update_unavailable' }
        return { ok: true }
      } catch {
        return { ok: false, error: 'update_unavailable' }
      }
    },

    async signOut() {
      try {
        const { error } = await withTimeout(client.auth.signOut({ scope: 'local' }))
        if (error) throw error
      } finally {
        // Persisted data is cleared even when sign-out fails; the error still propagates.
        storage.clearAll()
      }
    },
  }
}
