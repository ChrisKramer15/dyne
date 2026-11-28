import { createClient } from '@supabase/supabase-js'
import { createSwitchableStorage, type StorageLike } from './auth/switchableStorage'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.',
  )
}

/** Stand-in for a browser store that is unavailable; every call throws so the adapter degrades to memory. */
const unavailableStore: StorageLike = {
  getItem() {
    throw new Error('Storage unavailable')
  },
  setItem() {
    throw new Error('Storage unavailable')
  },
  removeItem() {
    throw new Error('Storage unavailable')
  },
}

function getBrowserStore(name: 'localStorage' | 'sessionStorage'): StorageLike {
  try {
    return window[name] ?? unavailableStore
  } catch {
    return unavailableStore
  }
}

export const authStorage = createSwitchableStorage(
  getBrowserStore('localStorage'),
  getBrowserStore('sessionStorage'),
)

export const supabase = createClient(url, anonKey, {
  auth: { storage: authStorage, persistSession: true },
})
