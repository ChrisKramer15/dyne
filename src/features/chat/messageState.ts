import type { ChatMessage, ConversationEvent, MessageCursor } from './chatService'

export type TimelineItem =
  | { type: 'message'; id: string; createdAt: string; message: ChatMessage }
  | { type: 'event'; id: string; createdAt: string; event: ConversationEvent }

function time(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Orders by (createdAt, seq); id is a final tie-breaker so ordering is total. */
export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  return (
    time(a.createdAt) - time(b.createdAt) ||
    a.seq - b.seq ||
    compareText(a.createdAt, b.createdAt) ||
    compareText(a.id, b.id)
  )
}

/** De-duplicates by id and sorts ascending by (createdAt, seq). Inputs are not mutated. */
export function mergeMessages(
  existing: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>()
  for (const m of existing) if (!byId.has(m.id)) byId.set(m.id, m)
  for (const m of incoming) if (!byId.has(m.id)) byId.set(m.id, m)
  return [...byId.values()].sort(compareMessages)
}

/** Cursor of the oldest message in the list, or undefined when empty. */
export function oldestCursor(messages: readonly ChatMessage[]): MessageCursor | undefined {
  let oldest: ChatMessage | undefined
  for (const m of messages) {
    if (!oldest || compareMessages(m, oldest) < 0) oldest = m
  }
  return oldest ? { createdAt: oldest.createdAt, seq: oldest.seq } : undefined
}

/**
 * Interleaves messages and joined/left events chronologically. At equal
 * timestamps events come first, then messages ordered by seq.
 */
export function mergeTimeline(
  messages: readonly ChatMessage[],
  events: readonly ConversationEvent[],
): TimelineItem[] {
  const items: TimelineItem[] = []
  const seenEvents = new Set<string>()
  for (const message of mergeMessages([], messages)) {
    items.push({ type: 'message', id: message.id, createdAt: message.createdAt, message })
  }
  for (const event of events) {
    if (seenEvents.has(event.id)) continue
    seenEvents.add(event.id)
    items.push({ type: 'event', id: event.id, createdAt: event.createdAt, event })
  }
  const rank = (i: TimelineItem) => (i.type === 'event' ? 0 : 1)
  return items.sort((a, b) => {
    const t = time(a.createdAt) - time(b.createdAt)
    if (t) return t
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (a.type === 'message' && b.type === 'message') return compareMessages(a.message, b.message)
    return compareText(a.id, b.id)
  })
}
