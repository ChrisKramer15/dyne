/**
 * TEMPORARY diagnostic for the mobile "keep me logged in" bug. Remove this
 * file and its imports (supabase.ts, authService.ts, main.tsx) once fixed.
 *
 * Records storage writes/removals (key names only, never token values), page
 * loads and tab closes into localStorage so the history survives a reopen.
 * View it at /dyne/?authdebug.
 */

const LOG_KEY = 'dyne.authdebug.log'
const MAX_ENTRIES = 150

interface StoreLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

function rawLocal(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function stamp(): string {
  return new Date().toISOString().slice(11, 23)
}

export function readAuthDebugLog(): string[] {
  try {
    const raw = rawLocal()?.getItem(LOG_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return ['(log unreadable)']
  }
}

export function clearAuthDebugLog(): void {
  try {
    rawLocal()?.removeItem(LOG_KEY)
  } catch {
    // ignore
  }
}

export function debugLog(message: string): void {
  try {
    const store = rawLocal()
    if (!store) return
    const entries = readAuthDebugLog()
    entries.push(`${new Date().toISOString().slice(0, 10)} ${stamp()} ${message}`)
    store.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // Diagnostics must never break the app.
  }
}

/** Describe a stored value without revealing secrets. */
function describe(key: string, value: string | null): string {
  if (value === null) return 'null'
  if (key === 'dyne.persistedAt') {
    const n = Number(value)
    return Number.isFinite(n) ? `${value} (${new Date(n).toISOString()})` : `"${value}" (not a number)`
  }
  if (key.endsWith('-auth-token')) {
    try {
      const s = JSON.parse(value) as { expires_at?: number }
      const exp = s.expires_at ? new Date(s.expires_at * 1000).toISOString() : '?'
      return `<token ${value.length} chars, expires ${exp}>`
    } catch {
      return `<${value.length} chars, not JSON>`
    }
  }
  return `<${value.length} chars>`
}

function listStore(name: 'localStorage' | 'sessionStorage'): string[] {
  try {
    const store = window[name]
    const lines: string[] = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key === null || key === LOG_KEY) continue
      lines.push(`  ${key} = ${describe(key, store.getItem(key))}`)
    }
    return lines.length > 0 ? lines : ['  (empty)']
  } catch (e) {
    return [`  (unavailable: ${String(e)})`]
  }
}

/** Storage contents at the moment this module first ran, before Supabase touched anything. */
export const loadSnapshot: string = (() => {
  if (typeof window === 'undefined') return ''
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  return [
    `time: ${new Date().toISOString()}`,
    `url: ${location.href}`,
    `standalone: ${standalone}`,
    `userAgent: ${navigator.userAgent}`,
    'localStorage:',
    ...listStore('localStorage'),
    'sessionStorage:',
    ...listStore('sessionStorage'),
  ].join('\n')
})()

if (typeof window !== 'undefined') {
  const localKeys = listStore('localStorage').map((l) => l.trim().split(' = ')[0])
  debugLog(`PAGE LOAD ${location.pathname}${location.search} localStorage keys: ${localKeys.join(', ')}`)
  window.addEventListener('pagehide', (e) => debugLog(`pagehide (persisted=${e.persisted})`))
  document.addEventListener('visibilitychange', () => debugLog(`visibility ${document.visibilityState}`))
}

/** Wrap a browser store so every write and removal is logged. */
export function withDebugLog(name: 'local' | 'session', store: StoreLike): StoreLike {
  return {
    getItem: (k) => store.getItem(k),
    setItem(k, v) {
      try {
        store.setItem(k, v)
        debugLog(`${name}.set ${k} = ${describe(k, v)}`)
      } catch (e) {
        debugLog(`${name}.set ${k} FAILED: ${String(e)}`)
        throw e
      }
    },
    removeItem(k) {
      const had = (() => {
        try {
          return store.getItem(k) !== null
        } catch {
          return false
        }
      })()
      store.removeItem(k)
      // Only log removals that actually deleted something, to keep the log readable.
      if (had) debugLog(`${name}.remove ${k}`)
    },
  }
}
