import type { UnreadEntry } from './chatService'

export type UnreadCount = number | 'unknown'

export interface UnreadState {
  counts: Record<string, UnreadCount>
  /** Read_Marker per conversation, ISO timestamp. */
  markers: Record<string, string>
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

export const initialUnreadState: UnreadState = { counts: {}, markers: {}, status: 'idle' }

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
      for (const e of action.entries) {
        counts[e.conversationId] = e.unread
        markers[e.conversationId] = e.lastReadAt
      }
      return { counts, markers, status: 'loaded' }
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
      delete counts[id]
      delete markers[id]
      return { ...state, counts, markers }
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
