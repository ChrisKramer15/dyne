import type { ConversationKind, UnreadEntry } from './chatService'

export type UnreadCount = number | 'unknown'

export interface UnreadState {
  counts: Record<string, UnreadCount>
  /** Read_Marker per conversation, ISO timestamp. */
  markers: Record<string, string>
  /** Conversation kind per id, from the last full load. */
  kinds: Record<string, ConversationKind>
  /** DM partner's username per id (null for groups). */
  others: Record<string, string | null>
  status: 'idle' | 'loaded' | 'failed'
}

export type UnreadAction =
  | { type: 'LOADED'; entries: readonly UnreadEntry[] }
  | { type: 'LOAD_FAILED' }
  | {
      type: 'MESSAGE_RECEIVED'
      conversationId: string
      senderId: string
      selfId: string
      createdAt: string
    }
  | { type: 'MARK_READ'; conversationId: string; upTo: string }
  | { type: 'MARKER_CONFIRMED'; conversationId: string; lastReadAt: string; unread: number }
  | { type: 'CONVERSATION_REMOVED'; conversationId: string }
  | { type: 'RESET' }

export const initialUnreadState: UnreadState = { counts: {}, markers: {}, kinds: {}, others: {}, status: 'idle' }

/** Compares two ISO timestamps by instant; falls back to string order if unparsable. */
function compareTime(a: string, b: string): number {
  const x = Date.parse(a)
  const y = Date.parse(b)
  if (Number.isNaN(x) || Number.isNaN(y)) return a < b ? -1 : a > b ? 1 : 0
  return x - y
}

export function unreadReducer(state: UnreadState, action: UnreadAction): UnreadState {
  switch (action.type) {
    case 'LOADED': {
      const counts: Record<string, UnreadCount> = {}
      const markers: Record<string, string> = {}
      const kinds: Record<string, ConversationKind> = {}
      const others: Record<string, string | null> = {}
      for (const e of action.entries) {
        counts[e.conversationId] = e.unread
        markers[e.conversationId] = e.lastReadAt
        kinds[e.conversationId] = e.kind ?? 'personal'
        others[e.conversationId] = e.otherUserName ?? null
      }
      return { counts, markers, kinds, others, status: 'loaded' }
    }
    case 'LOAD_FAILED':
      return state.status === 'failed' ? state : { ...state, status: 'failed' }
    case 'MESSAGE_RECEIVED': {
      if (action.senderId === action.selfId) return state
      const marker = state.markers[action.conversationId]
      if (marker !== undefined && compareTime(action.createdAt, marker) <= 0) return state
      const current = state.counts[action.conversationId]
      // An unknown count stays unknown; it cannot be incremented reliably.
      if (current === 'unknown') return state
      return {
        ...state,
        counts: { ...state.counts, [action.conversationId]: (current ?? 0) + 1 },
      }
    }
    case 'MARK_READ': {
      const marker = state.markers[action.conversationId]
      if (marker !== undefined && compareTime(action.upTo, marker) <= 0) return state
      return {
        ...state,
        counts: { ...state.counts, [action.conversationId]: 0 },
        markers: { ...state.markers, [action.conversationId]: action.upTo },
      }
    }
    case 'MARKER_CONFIRMED':
      return {
        ...state,
        counts: { ...state.counts, [action.conversationId]: action.unread },
        markers: { ...state.markers, [action.conversationId]: action.lastReadAt },
      }
    case 'CONVERSATION_REMOVED': {
      const id = action.conversationId
      if (!(id in state.counts) && !(id in state.markers)) return state
      const counts = { ...state.counts }
      const markers = { ...state.markers }
      const kinds = { ...state.kinds }
      const others = { ...state.others }
      delete counts[id]
      delete markers[id]
      delete kinds[id]
      delete others[id]
      return { ...state, counts, markers, kinds, others }
    }
    case 'RESET':
      return initialUnreadState
  }
}

/** Sum of known counts; unknown counts contribute 0. */
export function totalUnread(state: UnreadState): number {
  let total = 0
  for (const c of Object.values(state.counts)) {
    if (typeof c === 'number') total += c
  }
  return total
}

/** Sum of known unread counts for one conversation kind, skipping excluded ids. Entries with no known kind count as DMs. */
export function unreadByKind(
  state: UnreadState,
  kind: ConversationKind,
  exclude?: ReadonlySet<string>,
): number {
  let total = 0
  for (const [id, c] of Object.entries(state.counts)) {
    if (typeof c !== 'number' || exclude?.has(id)) continue
    if ((state.kinds[id] ?? 'personal') === kind) total += c
  }
  return total
}

/** DM conversation ids whose other person is in blockedNames (lowercase usernames). */
export function blockedDmIds(state: UnreadState, blockedNames: ReadonlySet<string>): Set<string> {
  const ids = new Set<string>()
  if (blockedNames.size === 0) return ids
  for (const [id, name] of Object.entries(state.others)) {
    if (state.kinds[id] !== 'group' && name && blockedNames.has(name.toLowerCase())) ids.add(id)
  }
  return ids
}
