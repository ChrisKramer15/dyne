/** Router `location.state` shape used to remember where a logged-out user was heading. */
export interface ReturnState {
  from: string
}

/**
 * Reads a safe in-app return path from router state. Anything that is not a
 * plain same-origin path (absolute URLs, protocol-relative `//host`, backslash
 * tricks) or that points back at the landing page is rejected, so the value can
 * never be used as an open redirect or cause a redirect loop.
 */
export function readReturnPath(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null
  const from = (state as Partial<ReturnState>).from
  if (typeof from !== 'string') return null
  if (!from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return null
  if (from === '/' || from.startsWith('/?') || from.startsWith('/#')) return null
  return from
}
