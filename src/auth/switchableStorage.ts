export interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

export interface SwitchableStorage extends StorageLike {
  setMode(m: 'local' | 'session'): void
  readonly degraded: boolean
  clearAll(): void
}

export const PERSIST_MAX_MS = 30 * 24 * 60 * 60 * 1000

const PERSISTED_AT_KEY = 'dyne.persistedAt'

/** Run fn, returning true on success and false if it throws. */
function attempt(fn: () => void): boolean {
  try {
    fn()
    return true
  } catch {
    return false
  }
}

function safeRemove(store: StorageLike, key: string): void {
  attempt(() => store.removeItem(key))
}

function safeGet(store: StorageLike, key: string): string | null {
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

export function createSwitchableStorage(
  local: StorageLike,
  session: StorageLike,
  now: () => number = Date.now,
): SwitchableStorage {
  const memory = new Map<string, string>()
  const knownKeys = new Set<string>()
  let mode: 'local' | 'session' = 'session'
  let degraded = false

  const removeEverywhere = (key: string): void => {
    safeRemove(local, key)
    safeRemove(session, key)
    memory.delete(key)
  }

  const writeLocal = (key: string, value: string): boolean =>
    attempt(() => {
      if (safeGet(local, PERSISTED_AT_KEY) === null) {
        local.setItem(PERSISTED_AT_KEY, String(now()))
      }
      local.setItem(key, value)
    })

  const writeSession = (key: string, value: string): boolean =>
    attempt(() => session.setItem(key, value))

  return {
    setMode(m) {
      mode = m
    },

    get degraded() {
      return degraded
    },

    getItem(key) {
      knownKeys.add(key)

      const localValue = safeGet(local, key)
      if (localValue !== null) {
        const raw = safeGet(local, PERSISTED_AT_KEY)
        const at = raw === null || raw.trim() === '' ? NaN : Number(raw)
        if (!Number.isFinite(at) || now() - at > PERSIST_MAX_MS) {
          safeRemove(local, key)
          safeRemove(local, PERSISTED_AT_KEY)
          return null
        }
        mode = 'local'
        return localValue
      }

      const sessionValue = safeGet(session, key)
      if (sessionValue !== null) {
        mode = 'session'
        return sessionValue
      }

      return memory.get(key) ?? null
    },

    setItem(key, value) {
      knownKeys.add(key)

      if (mode === 'local') {
        if (writeLocal(key, value)) {
          safeRemove(session, key)
          memory.delete(key)
          return
        }
        // Local failed: drop any partial marker so it cannot outlive the session.
        safeRemove(local, PERSISTED_AT_KEY)
        safeRemove(local, key)
        degraded = true
      }

      if (writeSession(key, value)) {
        safeRemove(local, key)
        if (mode === 'session') safeRemove(local, PERSISTED_AT_KEY)
        memory.delete(key)
        return
      }

      degraded = true
      safeRemove(local, key)
      safeRemove(session, key)
      memory.set(key, value)
    },

    removeItem(key) {
      removeEverywhere(key)
      // The marker is shared by all persisted keys. Supabase removes auxiliary
      // keys (e.g. "-user", "-code-verifier") during sign-in; dropping the marker
      // then would invalidate the session key and silently defeat "remember me".
      const stillPersisted = [...knownKeys].some((k) => safeGet(local, k) !== null)
      if (!stillPersisted) safeRemove(local, PERSISTED_AT_KEY)
    },

    clearAll() {
      for (const key of knownKeys) removeEverywhere(key)
      safeRemove(local, PERSISTED_AT_KEY)
      memory.clear()
    },
  }
}
