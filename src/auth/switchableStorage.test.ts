import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  createSwitchableStorage,
  PERSIST_MAX_MS,
  type StorageLike,
} from './switchableStorage'

const RUNS = { numRuns: 100 }
const PERSISTED_AT_KEY = 'dyne.persistedAt'

class FakeStorage implements StorageLike {
  readonly data = new Map<string, string>()
  getItem(k: string): string | null {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v)
  }
  removeItem(k: string): void {
    this.data.delete(k)
  }
}

const keyArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((k) => k !== PERSISTED_AT_KEY)
const valueArb = fc.string({ maxLength: 50 })
const modeArb = fc.constantFrom<'local' | 'session'>('local', 'session')

describe('switchableStorage', () => {
  // Feature: auth-modal, Property 9: Storage mode determines where a session is stored
  describe('Feature: auth-modal, Property 9', () => {
    it('writes only to the store for the active mode and reads it back', () => {
      // **Validates: Requirements 4.2, 4.3**
      fc.assert(
        fc.property(
          keyArb,
          valueArb,
          valueArb,
          modeArb,
          fc.nat(),
          (key, value, stale, mode, t) => {
            const local = new FakeStorage()
            const session = new FakeStorage()
            // Stale copy in the other store must be removed.
            const other = mode === 'local' ? session : local
            other.setItem(key, stale)

            const storage = createSwitchableStorage(local, session, () => t)
            storage.setMode(mode)
            storage.setItem(key, value)

            const active = mode === 'local' ? local : session
            const inactive = mode === 'local' ? session : local
            expect(active.getItem(key)).toBe(value)
            expect(inactive.getItem(key)).toBeNull()
            expect(storage.getItem(key)).toBe(value)

            if (mode === 'session') {
              expect(local.getItem(key)).toBeNull()
              expect(local.getItem(PERSISTED_AT_KEY)).toBeNull()
            } else {
              expect(local.getItem(PERSISTED_AT_KEY)).toBe(String(t))
            }
            expect(storage.degraded).toBe(false)
          },
        ),
        RUNS,
      )
    })
  })

  // Feature: auth-modal, Property 10: Persisted sessions expire after 30 days
  describe('Feature: auth-modal, Property 10', () => {
    const nonNumericArb = fc
      .string({ maxLength: 20 })
      .filter((s) => s.trim() === '' || !Number.isFinite(Number(s)))

    it('returns null and clears expired, missing or non-numeric markers; keeps fresh ones', () => {
      // **Validates: Requirements 4.2, 4.6**
      fc.assert(
        fc.property(
          keyArb,
          valueArb,
          fc.nat({ max: 2 * PERSIST_MAX_MS }),
          fc.constantFrom('valid', 'missing', 'nonNumeric'),
          nonNumericArb,
          (key, value, age, kind, garbage) => {
            const now = 10 * PERSIST_MAX_MS
            const local = new FakeStorage()
            const session = new FakeStorage()
            local.setItem(key, value)
            if (kind === 'valid') local.setItem(PERSISTED_AT_KEY, String(now - age))
            if (kind === 'nonNumeric') local.setItem(PERSISTED_AT_KEY, garbage)

            const storage = createSwitchableStorage(local, session, () => now)
            const result = storage.getItem(key)

            const fresh = kind === 'valid' && age <= PERSIST_MAX_MS
            if (fresh) {
              expect(result).toBe(value)
              expect(local.getItem(key)).toBe(value)
            } else {
              expect(result).toBeNull()
              expect(local.getItem(key)).toBeNull()
              expect(local.getItem(PERSISTED_AT_KEY)).toBeNull()
            }
          },
        ),
        RUNS,
      )
    })
  })

  // Feature: auth-modal, Property 11: Removal clears every store
  describe('Feature: auth-modal, Property 11', () => {
    const seed = (key: string, value: string) => {
      const local = new FakeStorage()
      const session = new FakeStorage()
      local.setItem(key, value)
      local.setItem(PERSISTED_AT_KEY, '1')
      session.setItem(key, value)
      return { local, session }
    }

    it('removeItem clears the key from local, session and the marker', () => {
      // **Validates: Requirements 4.4**
      fc.assert(
        fc.property(keyArb, valueArb, modeArb, (key, value, mode) => {
          const { local, session } = seed(key, value)
          const storage = createSwitchableStorage(local, session, () => 1)
          storage.setMode(mode)
          storage.removeItem(key)

          expect(local.getItem(key)).toBeNull()
          expect(session.getItem(key)).toBeNull()
          expect(local.getItem(PERSISTED_AT_KEY)).toBeNull()
          expect(storage.getItem(key)).toBeNull()
        }),
        RUNS,
      )
    })

    it('clearAll removes every known key from all stores, memory and the marker', () => {
      // **Validates: Requirements 4.4**
      fc.assert(
        fc.property(
          fc.uniqueArray(keyArb, { minLength: 1, maxLength: 5 }),
          valueArb,
          modeArb,
          (keys, value, mode) => {
            const local = new FakeStorage()
            const session = new FakeStorage()
            const storage = createSwitchableStorage(local, session, () => 1)
            storage.setMode(mode)
            for (const k of keys) storage.setItem(k, value)
            // Also a key present only in a backing store, made known via getItem.
            local.setItem(PERSISTED_AT_KEY, '1')

            storage.clearAll()

            for (const k of keys) {
              expect(local.getItem(k)).toBeNull()
              expect(session.getItem(k)).toBeNull()
              expect(storage.getItem(k)).toBeNull()
            }
            expect(local.getItem(PERSISTED_AT_KEY)).toBeNull()
          },
        ),
        RUNS,
      )
    })
  })
})

class ThrowingWriteStorage extends FakeStorage {
  setItem(): void {
    throw new Error('QuotaExceededError')
  }
}

// Feature: auth-modal, Property 12: Storage failure degrades without losing the session
describe('Feature: auth-modal, Property 12', () => {
  it('keeps the session readable and flags degraded when writes throw', () => {
    // **Validates: Requirements 4.5**
    fc.assert(
      fc.property(
        keyArb,
        valueArb,
        modeArb,
        fc.constantFrom('local', 'session', 'both'),
        (key, value, mode, failing) => {
          const local =
            failing === 'session' ? new FakeStorage() : new ThrowingWriteStorage()
          const session =
            failing === 'local' ? new FakeStorage() : new ThrowingWriteStorage()
          const storage = createSwitchableStorage(local, session, () => 1)
          storage.setMode(mode)

          expect(() => storage.setItem(key, value)).not.toThrow()

          // Only degraded when the active store (or its fallback) failed.
          const activeFails = mode === 'local' ? failing !== 'session' : failing !== 'local'
          if (activeFails) expect(storage.degraded).toBe(true)

          // Session is never lost in this tab.
          expect(storage.getItem(key)).toBe(value)
          // No dangling persistence marker for a session that was not persisted.
          if (failing !== 'session') {
            expect(local.getItem(PERSISTED_AT_KEY)).toBeNull()
          }
        },
      ),
      RUNS,
    )
  })
})
