import { useSyncExternalStore } from 'react'

export interface AccentColor {
  id: string
  label: string
  /** HSL hue (0-359); saturation and lightness are fixed so every option is a neon. */
  hue: number
}

/** The 15 neon colors a player can choose from. Ids are stored, so never reorder or reuse them. */
export const ACCENT_COLORS: readonly AccentColor[] = [
  { id: 'red', label: 'Red', hue: 0 },
  { id: 'coral', label: 'Coral', hue: 12 },
  { id: 'orange', label: 'Orange', hue: 25 },
  { id: 'amber', label: 'Amber', hue: 40 },
  { id: 'yellow', label: 'Yellow', hue: 55 },
  { id: 'lime', label: 'Lime', hue: 85 },
  { id: 'green', label: 'Green', hue: 130 },
  { id: 'mint', label: 'Mint', hue: 155 },
  { id: 'teal', label: 'Teal', hue: 170 },
  { id: 'cyan', label: 'Cyan', hue: 188 },
  { id: 'sky', label: 'Sky', hue: 205 },
  { id: 'blue', label: 'Blue', hue: 222 },
  { id: 'violet', label: 'Violet', hue: 265 },
  { id: 'magenta', label: 'Magenta', hue: 315 },
  { id: 'pink', label: 'Pink', hue: 337 },
]

/** The swatch and accent color for a hue. Lightness 62% keeps text readable on the dark background. */
export const accentCss = (hue: number): string => `hsl(${hue} 100% 62%)`

const storageKey = (ownerId: string) => `dyne:accent:${ownerId}`

// Fallback for when localStorage is unavailable (private mode, quota): the
// choice then lasts for this visit only.
const memory = new Map<string, string | null>()
const listeners = new Set<() => void>()

function readId(ownerId: string | undefined): string | null {
  if (!ownerId) return null
  const key = storageKey(ownerId)
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * The signed-in player's chosen accent color (or null for the default), shared
 * between the profile page and the bottom nav so both update at once.
 */
export function useAccentColor(ownerId: string | undefined) {
  const id = useSyncExternalStore(
    subscribe,
    () => readId(ownerId),
    () => null,
  )
  const accent = ACCENT_COLORS.find((c) => c.id === id) ?? null
  const setAccent = (next: string) => {
    if (!ownerId || !ACCENT_COLORS.some((c) => c.id === next)) return
    const key = storageKey(ownerId)
    try {
      localStorage.setItem(key, next)
      memory.delete(key)
    } catch {
      memory.set(key, next)
    }
    for (const l of [...listeners]) l()
  }
  return { accent, setAccent }
}
