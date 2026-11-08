import type { Field, FieldError } from '../validation'

// Human-readable copy for each field error code. Kept deliberately vague for
// login so lengths/credentials never leak.
const FIELD_MESSAGES: Record<string, string> = {
  'username:required': 'Enter your username.',
  'username:format': 'Use 3–20 letters, numbers or underscores.',
  'username:taken': 'Pick a different username.',
  'email:required': 'Enter your email.',
  'email:invalid': 'Enter a valid email address.',
  'email:taken': 'Use a different email address.',
  'password:required': 'Enter your password.',
  'password:too_short': 'Use at least 8 characters.',
  'confirmPassword:required': 'Re-enter your password.',
  'confirmPassword:mismatch': 'Passwords do not match.',
  'identifier:required': 'Enter your username or email.',
  'newPassword:required': 'Enter a new password.',
  'newPassword:too_short': 'Use at least 8 characters.',
}

export function messageFor(err: FieldError): string {
  return FIELD_MESSAGES[`${err.field}:${err.code}`] ?? 'Check this field.'
}

export function errorFor(errors: FieldError[], field: Field): FieldError | undefined {
  return errors.find((e) => e.field === field)
}
