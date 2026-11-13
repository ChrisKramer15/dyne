/** Up to two initials from a display name; '?' when there is nothing to use. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = Array.from(words[0])[0]
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : ''
  return (first + last).toUpperCase()
}

/** Stable hue (0-359) derived from a seed, so each player gets their own colour. */
export function hueFromSeed(seed: string): number {
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return hash % 360
}

/** "March 2026", or '' when the date is missing or invalid. */
export function formatMemberSince(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Whole days since the date (never negative); null when missing or invalid. */
export function daysSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
}

/** Time-of-day greeting for the player card. */
export function greetingFor(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
