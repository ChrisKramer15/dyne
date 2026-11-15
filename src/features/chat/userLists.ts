import { useSyncExternalStore } from 'react'

export interface ListedUser {
  userId: string
  username: string
}

export type UserListKind = 'favorites' | 'blocked'

const storageKey = (kind: UserListKind, ownerId: string) => `dyne:${kind}:${ownerId}`

function read(key: string): ListedUser[] {
  try {
    const raw = localStorage.getItem(key)
    const data: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(data)) return []
    return data.filter(
      (u): u is ListedUser =>
        typeof u === 'object' &&
        u !== null &&
        typeof (u as ListedUser).userId === 'string' &&
        typeof (u as ListedUser).username === 'string',
    )
  } catch {
    return []
  }
}

// A tiny shared store so the chat page, chat list, and unread counts all see
// the same lists the moment one of them changes.
const EMPTY: ListedUser[] = []
const cache = new Map<string, ListedUser[]>()
const listeners = new Set<() => void>()

function getList(key: string): ListedUser[] {
  let list = cache.get(key)
  if (!list) {
    list = read(key)
    cache.set(key, list)
  }
  return list
}

function setList(key: string, list: ListedUser[]) {
  cache.set(key, list)
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // Storage unavailable (private mode, quota): keep the in-memory list.
  }
  for (const l of [...listeners]) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  // Another tab changed a list: drop the cache so the next read is fresh.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith('dyne:')) {
      cache.clear()
      cb()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * A per-user list of people (favorites or blocked), kept in localStorage.
 * This is device-local for now; the profile page can read the same key later.
 */
export function useUserList(kind: UserListKind, ownerId: string | undefined) {
  const key = ownerId ? storageKey(kind, ownerId) : null
  const list = useSyncExternalStore(
    subscribe,
    () => (key ? getList(key) : EMPTY),
    () => EMPTY,
  )
  const has = (userId: string) => list.some((u) => u.userId === userId)
  const add = (user: ListedUser) => {
    if (key && !has(user.userId)) setList(key, [...list, user])
  }
  const remove = (userId: string) => {
    if (key) setList(key, list.filter((u) => u.userId !== userId))
  }
  return { list, has, add, remove }
}