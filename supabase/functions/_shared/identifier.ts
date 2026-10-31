// Pure helpers shared by the login-with-username and request-password-reset
// Edge Functions. No Deno imports, so vitest can load this file.

export type Identifier = { kind: 'email' | 'username'; value: string }

/** Classify a raw identifier. Contains '@' => email, otherwise username. Null when blank. */
export function classifyIdentifier(raw: string): Identifier | null {
  const value = (raw ?? '').trim()
  if (value === '') return null
  return { kind: value.includes('@') ? 'email' : 'username', value }
}

/**
 * Return the email of the account matching the identifier (case-insensitive),
 * or null. Identifiers with '@' match on email only; others on username only.
 */
export function resolveResetTarget(
  raw: string,
  accounts: { username: string; email: string }[],
): string | null {
  const id = classifyIdentifier(raw)
  if (!id) return null
  const needle = id.value.toLowerCase()
  const match = accounts.find((a) =>
    id.kind === 'email'
      ? a.email.toLowerCase() === needle
      : a.username.toLowerCase() === needle,
  )
  return match ? match.email : null
}

export const GENERIC_LOGIN_FAILURE = {
  status: 401,
  body: { error: 'invalid_credentials' },
}

export const RESET_ACCEPTED = { status: 202, body: { ok: true } }

export const DUMMY_EMAIL = 'no-such-user@dyne.invalid'

/** Unknown user and wrong password yield the identical response. */
export function buildLoginResponse(
  outcome: 'success' | 'unknown_user' | 'wrong_password',
  session?: unknown,
): { status: number; body: unknown } {
  if (outcome === 'success') {
    const s = (session ?? {}) as { access_token?: string; refresh_token?: string }
    return {
      status: 200,
      body: { access_token: s.access_token, refresh_token: s.refresh_token },
    }
  }
  return { status: GENERIC_LOGIN_FAILURE.status, body: { ...GENERIC_LOGIN_FAILURE.body } }
}
