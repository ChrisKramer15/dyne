export const MAX_NAME_LENGTH = 50

/** Reads user_metadata.username; returns trimmed string, or '' if absent/non-string/blank. */
export function getDisplayName(metadata: unknown): string {
  if (typeof metadata !== 'object' || metadata === null) return ''
  const username = (metadata as { username?: unknown }).username
  return typeof username === 'string' ? username.trim() : ''
}

/** Truncates to first 50 characters (by code point) plus '…' when longer. */
export function truncateName(name: string): string {
  const codePoints = Array.from(name)
  if (codePoints.length <= MAX_NAME_LENGTH) return name
  return codePoints.slice(0, MAX_NAME_LENGTH).join('') + '…'
}

/** "Welcome Back, <name>" or "Welcome Back" when name is empty. */
export function formatWelcome(metadata: unknown): string {
  const name = getDisplayName(metadata)
  return name === '' ? 'Welcome Back' : `Welcome Back, ${truncateName(name)}`
}
