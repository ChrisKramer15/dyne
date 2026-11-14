import { PREVIEW_MAX_LENGTH, type ConversationSummary } from './chatService'

function timeOf(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** Newest first. Equal instants fall back to string order of the raw timestamp, descending. */
function compareDesc(a: string, b: string): number {
  const diff = timeOf(b) - timeOf(a)
  if (diff !== 0) return diff
  return a === b ? 0 : a < b ? 1 : -1
}

function compareConversations(a: ConversationSummary, b: ConversationSummary): number {
  const aHas = a.latestMessageAt !== null
  const bHas = b.latestMessageAt !== null
  if (aHas !== bHas) return aHas ? -1 : 1
  const byTime = aHas
    ? compareDesc(a.latestMessageAt as string, b.latestMessageAt as string)
    : compareDesc(a.createdAt, b.createdAt)
  if (byTime !== 0) return byTime
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1
}

/**
 * Conversations with messages first by latest message time (newest first),
 * then those without messages by creation time (newest first). Ties are
 * broken by id so the order is deterministic across pages. Does not mutate.
 */
export function sortConversations(c: readonly ConversationSummary[]): ConversationSummary[] {
  return [...c].sort(compareConversations)
}

/** Other participant's username for personal conversations, group name for groups. */
export function displayName(c: ConversationSummary, _selfId?: string): string {
  const name = c.kind === 'group' ? c.name : c.otherUserName
  return name ?? ''
}

/**
 * Single-line preview: whitespace runs collapse to one space, then the text is
 * cut to PREVIEW_MAX_LENGTH code points with a trailing '…' only when cut.
 */
export function previewText(text: string | null): string {
  if (text === null) return ''
  const normalized = text.replace(/\s+/g, ' ').trim()
  const points = Array.from(normalized)
  if (points.length <= PREVIEW_MAX_LENGTH) return normalized
  return `${points.slice(0, PREVIEW_MAX_LENGTH).join('')}…`
}

/** Conversations per Conversation_List page (matches the other Pager consumers). */
export const CONVERSATIONS_PER_PAGE = 5
