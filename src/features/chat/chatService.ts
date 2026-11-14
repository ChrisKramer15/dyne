export const MAX_MESSAGE_LENGTH = 2000
export const MAX_GROUP_SIZE = 50
export const MAX_GROUP_NAME_LENGTH = 60
export const MIN_OTHER_GROUP_MEMBERS = 2
export const MESSAGE_PAGE_SIZE = 50
export const PREVIEW_MAX_LENGTH = 100
export const USER_SEARCH_MAX_RESULTS = 20
export const USER_SEARCH_MAX_QUERY = 50
export const RECONNECT_INTERVAL_MS = 5_000
export const READ_RETRY_COUNT = 3
export const READ_RETRY_INTERVAL_MS = 5_000
export const UNREAD_LOAD_RETRY_COUNT = 3
export const UNREAD_LOAD_RETRY_INTERVAL_MS = 5_000
export const ALERT_CAP = 99

export type ConversationKind = 'personal' | 'group'

export interface ConversationSummary {
  id: string
  kind: ConversationKind
  /** Group name; null for personal conversations. */
  name: string | null
  /** ISO timestamp. */
  createdAt: string
  /** Other participant's username; personal conversations only. */
  otherUserName: string | null
  latestMessageText: string | null
  latestMessageAt: string | null
  /** null when the count could not be retrieved. */
  unread: number | null
}

export interface ChatMessage {
  /** Client-generated uuid. */
  id: string
  conversationId: string
  senderId: string
  senderName: string
  text: string
  /** Server-assigned ISO timestamp. */
  createdAt: string
  /** Server-assigned storage order. */
  seq: number
}

export interface ConversationEvent {
  id: string
  conversationId: string
  kind: 'joined' | 'left'
  userId: string
  userName: string
  createdAt: string
}

export type MessageCursor = { createdAt: string; seq: number }

export interface UserSummary {
  userId: string
  username: string
}

export interface UnreadEntry {
  conversationId: string
  unread: number
  lastReadAt: string
}

export type Unsubscribe = () => void

export type ListConversationsResult =
  | { ok: true; conversations: ConversationSummary[] }
  | { ok: false; error: 'unavailable' }

export type GetConversationResult =
  | { ok: true; conversation: ConversationSummary }
  | { ok: false; error: 'not_found' | 'unavailable' }

export type LoadMessagesResult =
  | { ok: true; messages: ChatMessage[]; hasMore: boolean }
  | { ok: false; error: 'not_found' | 'unavailable' }

export type LoadEventsResult =
  | { ok: true; events: ConversationEvent[] }
  | { ok: false; error: 'not_found' | 'unavailable' }

export type SendResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; error: 'not_participant' | 'invalid' | 'unavailable' }

export type MarkReadResult =
  | { ok: true; lastReadAt: string; unread: number }
  | { ok: false; error: 'unavailable' }

export type SearchUsersResult =
  | { ok: true; users: UserSummary[] }
  | { ok: false; error: 'unavailable' }

export type OpenPersonalResult =
  | { ok: true; conversationId: string }
  | { ok: false; error: 'self' | 'unavailable' }

export type CreateGroupResult =
  | { ok: true; conversationId: string }
  | { ok: false; error: 'invalid' | 'unavailable' }

export type LeaveGroupResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'unavailable' }

export type UnreadTotalResult =
  | { ok: true; entries: UnreadEntry[] }
  | { ok: false; error: 'unavailable' }

export interface ChatEventHandlers {
  /** messages INSERT. */
  onMessage(m: ChatMessage): void
  /** conversation_events INSERT. */
  onEvent(e: ConversationEvent): void
  /** Own conversation_participants row changed (read marker or membership). */
  onOwnParticipantChange(conversationId: string): void
  onStatus(status: 'connected' | 'disconnected'): void
}

export interface ChatService {
  listConversations(): Promise<ListConversationsResult>
  getConversation(id: string): Promise<GetConversationResult>
  loadMessages(i: {
    conversationId: string
    before?: MessageCursor
    limit: number
  }): Promise<LoadMessagesResult>
  loadEvents(conversationId: string): Promise<LoadEventsResult>
  sendMessage(i: { id: string; conversationId: string; text: string }): Promise<SendResult>
  markRead(i: { conversationId: string; upTo: string }): Promise<MarkReadResult>
  searchUsers(query: string): Promise<SearchUsersResult>
  openPersonalConversation(otherUserId: string): Promise<OpenPersonalResult>
  createGroup(i: { name: string; memberIds: string[] }): Promise<CreateGroupResult>
  leaveGroup(conversationId: string): Promise<LeaveGroupResult>
  loadUnreadTotal(): Promise<UnreadTotalResult>
  subscribe(handlers: ChatEventHandlers): Unsubscribe
}
