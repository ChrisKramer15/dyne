export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
export const LIMITS = {
  loginUsername: 64,
  loginPassword: 128,
  email: 254,
  minPassword: 8,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type Field = 'username' | 'email' | 'password' | 'confirmPassword' | 'identifier'
export type FieldError =
  | { field: Field; code: 'required' }
  | { field: 'username'; code: 'format' }
  | { field: 'email'; code: 'invalid' }
  | { field: 'password'; code: 'too_short' }
  | { field: 'confirmPassword'; code: 'mismatch' }

/** True when the value is empty or whitespace only. */
export const isBlank = (s: string): boolean => s.trim() === ''

/**
 * Login only reports blank fields. Over-length values are handled by the
 * generic invalid-credentials path so lengths leak nothing.
 * Passwords are never trimmed.
 */
export function validateLogin(i: { username: string; password: string }): FieldError[] {
  const errors: FieldError[] = []
  if (isBlank(i.username)) errors.push({ field: 'username', code: 'required' })
  if (isBlank(i.password)) errors.push({ field: 'password', code: 'required' })
  return errors
}

export function validateRegister(i: {
  username: string
  email: string
  password: string
  confirmPassword: string
}): FieldError[] {
  const errors: FieldError[] = []

  if (isBlank(i.username)) errors.push({ field: 'username', code: 'required' })
  else if (!USERNAME_RE.test(i.username)) errors.push({ field: 'username', code: 'format' })

  if (isBlank(i.email)) errors.push({ field: 'email', code: 'required' })
  else if (i.email.length > LIMITS.email || !EMAIL_RE.test(i.email)) {
    errors.push({ field: 'email', code: 'invalid' })
  }

  if (isBlank(i.password)) errors.push({ field: 'password', code: 'required' })
  else if (i.password.length < LIMITS.minPassword) {
    errors.push({ field: 'password', code: 'too_short' })
  }

  if (isBlank(i.confirmPassword)) errors.push({ field: 'confirmPassword', code: 'required' })
  else if (i.confirmPassword !== i.password) {
    errors.push({ field: 'confirmPassword', code: 'mismatch' })
  }

  return errors
}

export function validateIdentifier(identifier: string): FieldError[] {
  return isBlank(identifier) ? [{ field: 'identifier', code: 'required' }] : []
}
