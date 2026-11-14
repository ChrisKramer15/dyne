import { createContext, useContext } from 'react'
import type { ChatMessage, ChatService, ConversationEvent, LeaveGroupResult } from './chatService'

/** Listener for realtime activity, used by pages that show a live conversation. */
export interface ChatListener {
  onMessage?(m: ChatMessage): void
  onEvent?(e: ConversationEvent): void
  /** Realtime connection came back after an outage; pages should backfill. */
  onReconnect?(): void
}

export interface ChatContextValue {
  service: ChatService
  /** Total_Unread_Count (unknown counts contribute 0). */
  total: number
  /** Unread count for one conversation; null when it could not be retrieved. */
  unreadFor(conversationId: string): number | null
  /**
   * Advance the Read_Marker optimistically, persist it, roll back and retry
   * (3 times, 5 s apart) on failure.
   */
  markRead(conversationId: string, upTo: string): Promise<void>
  /** Declare which conversation is open; pass null-safe via closeConversation. */
  openConversation(conversationId: string): void
  closeConversation(conversationId: string): void
  /** The page reports the timestamp of the latest message it displays. */
  reportLatest(conversationId: string, createdAt: string): void
  /** Reload all unread entries. */
  refresh(): Promise<void>
  /** Leave a group; drops it from unread state on success. */
  leaveGroup(conversationId: string): Promise<LeaveGroupResult>
  addListener(listener: ChatListener): () => void
}

export const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext)
  if (value === null) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return value
}

/** Safe outside a ChatProvider: reports no unread messages. */
export function useChatUnread(): { total: number } {
  const value = useContext(ChatContext)
  return { total: value?.total ?? 0 }
}
