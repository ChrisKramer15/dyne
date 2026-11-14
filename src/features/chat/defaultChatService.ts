import type { SupabaseClient } from '@supabase/supabase-js'
import { withTimeout } from '../../auth/authService'
import { supabase } from '../../supabase'
import type {
  ChatEventHandlers,
  ChatMessage,
  ChatService,
  ConversationEvent,
  ConversationSummary,
  MessageCursor,
} from './chatService'

const UNKNOWN_NAME = 'Former member'
const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, text, created_at, seq'
const EVENT_COLUMNS = 'id, conversation_id, kind, user_id, created_at'

interface DbError {
  code?: string
  message?: string
}

interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  created_at: string
  seq: number | string
}

interface EventRow {
  id: string
  conversation_id: string
  kind: 'joined' | 'left'
  user_id: string
  created_at: string
}

interface ConversationRow {
  conversation_id: string
  kind: 'personal' | 'group'
  name: string | null
  created_at: string
  other_user_name: string | null
  latest_message_text: string | null
  latest_message_at: string | null
  unread: number | string | null
  last_read_at: string
}

function toSummary(r: ConversationRow): ConversationSummary {
  return {
    id: r.conversation_id,
    kind: r.kind,
    name: r.name,
    createdAt: r.created_at,
    otherUserName: r.other_user_name,
    latestMessageText: r.latest_message_text,
    latestMessageAt: r.latest_message_at,
    unread: r.unread === null || r.unread === undefined ? null : Number(r.unread),
  }
}

function errorText(e: DbError | null | undefined): string {
  return e?.message ?? ''
}

/**
 * Builds a Supabase-backed ChatService. Every call is bounded by `withTimeout`
 * and failures come back as `{ ok: false, error }` instead of throwing.
 */
export function createChatService(client: SupabaseClient): ChatService {
  /** userId -> username, filled from conversation_members (profiles are not readable directly). */
  const names = new Map<string, string>()

  async function currentUserId(): Promise<string | null> {
    const { data } = await withTimeout(client.auth.getSession())
    return data.session?.user.id ?? null
  }

  async function refreshMembers(conversationId: string): Promise<void> {
    try {
      const { data, error } = await withTimeout(
        client.rpc('conversation_members', { conv: conversationId }),
      )
      if (error) return
      for (const m of (data ?? []) as { user_id: string; username: string }[]) {
        names.set(m.user_id, m.username)
      }
    } catch {
      // Names fall back to a placeholder; never fail the caller for this.
    }
  }

  async function ensureNames(conversationId: string, userIds: Iterable<string>): Promise<void> {
    for (const id of userIds) {
      if (!names.has(id)) {
        await refreshMembers(conversationId)
        return
      }
    }
  }

  const nameOf = (id: string) => names.get(id) ?? UNKNOWN_NAME

  function toMessage(r: MessageRow): ChatMessage {
    return {
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      senderName: nameOf(r.sender_id),
      text: r.text,
      createdAt: r.created_at,
      seq: Number(r.seq),
    }
  }

  function toEvent(r: EventRow): ConversationEvent {
    return {
      id: r.id,
      conversationId: r.conversation_id,
      kind: r.kind,
      userId: r.user_id,
      userName: nameOf(r.user_id),
      createdAt: r.created_at,
    }
  }

  /** RLS makes a missing and a non-participant conversation look identical. */
  async function conversationVisible(conversationId: string): Promise<boolean> {
    const { data, error } = await withTimeout(
      client.from('conversations').select('id').eq('id', conversationId).maybeSingle(),
    )
    if (error) throw error
    return data !== null
  }

  async function fetchMessageById(id: string): Promise<ChatMessage | null> {
    const { data, error } = await withTimeout(
      client.from('messages').select(MESSAGE_COLUMNS).eq('id', id).maybeSingle(),
    )
    if (error || !data) return null
    const row = data as MessageRow
    await ensureNames(row.conversation_id, [row.sender_id])
    return toMessage(row)
  }

  async function fetchConversations(): Promise<ConversationRow[] | null> {
    const { data, error } = await withTimeout(client.rpc('list_conversations'))
    if (error) return null
    return (data ?? []) as ConversationRow[]
  }

  return {
    async listConversations() {
      try {
        const rows = await fetchConversations()
        if (!rows) return { ok: false, error: 'unavailable' }
        return { ok: true, conversations: rows.map(toSummary) }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async getConversation(id) {
      try {
        const rows = await fetchConversations()
        if (!rows) return { ok: false, error: 'unavailable' }
        const row = rows.find((r) => r.conversation_id === id)
        if (!row) return { ok: false, error: 'not_found' }
        return { ok: true, conversation: toSummary(row) }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async loadMessages({ conversationId, before, limit }) {
      try {
        let query = client
          .from('messages')
          .select(MESSAGE_COLUMNS)
          .eq('conversation_id', conversationId)
        if (before) query = query.or(keysetFilter(before))
        const { data, error } = await withTimeout(
          query
            .order('created_at', { ascending: false })
            .order('seq', { ascending: false })
            .limit(limit + 1),
        )
        if (error) return { ok: false, error: 'unavailable' }
        const rows = (data ?? []) as MessageRow[]

        if (rows.length === 0 && !(await conversationVisible(conversationId))) {
          return { ok: false, error: 'not_found' }
        }

        const hasMore = rows.length > limit
        const page = rows.slice(0, limit).reverse()
        await ensureNames(conversationId, page.map((r) => r.sender_id))
        return { ok: true, messages: page.map(toMessage), hasMore }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async loadEvents(conversationId) {
      try {
        const { data, error } = await withTimeout(
          client
            .from('conversation_events')
            .select(EVENT_COLUMNS)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true }),
        )
        if (error) return { ok: false, error: 'unavailable' }
        const rows = (data ?? []) as EventRow[]

        if (rows.length === 0 && !(await conversationVisible(conversationId))) {
          return { ok: false, error: 'not_found' }
        }

        await ensureNames(conversationId, rows.map((r) => r.user_id))
        return { ok: true, events: rows.map(toEvent) }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async sendMessage({ id, conversationId, text }) {
      try {
        const senderId = await currentUserId()
        if (!senderId) return { ok: false, error: 'unavailable' }

        const { data, error } = await withTimeout(
          client
            .from('messages')
            .insert({ id, conversation_id: conversationId, sender_id: senderId, text })
            .select(MESSAGE_COLUMNS)
            .single(),
        )

        if (error) {
          // Retry after a lost response: the row is already stored under this id.
          if (error.code === '23505') {
            const stored = await fetchMessageById(id)
            return stored
              ? { ok: true, message: stored }
              : { ok: false, error: 'unavailable' }
          }
          if (error.code === '42501') return { ok: false, error: 'not_participant' }
          if (error.code === '23514' || error.code === '22P02' || error.code === '23503') {
            return { ok: false, error: 'invalid' }
          }
          return { ok: false, error: 'unavailable' }
        }

        const row = data as MessageRow
        await ensureNames(conversationId, [row.sender_id])
        return { ok: true, message: toMessage(row) }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async markRead({ conversationId, upTo }) {
      try {
        const { data, error } = await withTimeout(
          client.rpc('mark_conversation_read', { conv: conversationId, up_to: upTo }),
        )
        if (error) return { ok: false, error: 'unavailable' }
        const row = ((data ?? []) as { last_read_at: string; unread: number | string }[])[0]
        if (!row) return { ok: false, error: 'unavailable' }
        return { ok: true, lastReadAt: row.last_read_at, unread: Number(row.unread) }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async searchUsers(query) {
      try {
        const { data, error } = await withTimeout(client.rpc('search_users', { q: query }))
        if (error) return { ok: false, error: 'unavailable' }
        const rows = (data ?? []) as { user_id: string; username: string }[]
        for (const r of rows) names.set(r.user_id, r.username)
        return { ok: true, users: rows.map((r) => ({ userId: r.user_id, username: r.username })) }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async openPersonalConversation(otherUserId) {
      try {
        const { data, error } = await withTimeout(
          client.rpc('get_or_create_personal_conversation', { other: otherUserId }),
        )
        if (error) {
          return errorText(error).includes('self_conversation')
            ? { ok: false, error: 'self' }
            : { ok: false, error: 'unavailable' }
        }
        return { ok: true, conversationId: data as string }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async createGroup({ name, memberIds }) {
      try {
        const { data, error } = await withTimeout(
          client.rpc('create_group_conversation', { name, members: memberIds }),
        )
        if (error) {
          return /name_required|name_too_long|too_few_members|too_many_members|unknown_member/.test(
            errorText(error),
          )
            ? { ok: false, error: 'invalid' }
            : { ok: false, error: 'unavailable' }
        }
        return { ok: true, conversationId: data as string }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async leaveGroup(conversationId) {
      try {
        const { error } = await withTimeout(
          client.rpc('leave_group_conversation', { conv: conversationId }),
        )
        if (error) {
          return /not_participant|not_group/.test(errorText(error))
            ? { ok: false, error: 'not_found' }
            : { ok: false, error: 'unavailable' }
        }
        return { ok: true }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async loadUnreadTotal() {
      try {
        const rows = await fetchConversations()
        if (!rows) return { ok: false, error: 'unavailable' }
        return {
          ok: true,
          entries: rows.map((r) => ({
            conversationId: r.conversation_id,
            unread: Number(r.unread ?? 0),
            lastReadAt: r.last_read_at,
          })),
        }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    subscribe(handlers: ChatEventHandlers) {
      let cancelled = false
      let channel: ReturnType<SupabaseClient['channel']> | null = null

      void (async () => {
        let userId: string | null = null
        try {
          userId = await currentUserId()
        } catch {
          userId = null
        }
        if (cancelled) return
        if (!userId) {
          handlers.onStatus('disconnected')
          return
        }

        channel = client
          .channel(`chat-${userId}-${Math.random().toString(36).slice(2)}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
              const row = payload.new as MessageRow
              void ensureNames(row.conversation_id, [row.sender_id]).then(() => {
                if (!cancelled) handlers.onMessage(toMessage(row))
              })
            },
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'conversation_events' },
            (payload) => {
              const row = payload.new as EventRow
              void ensureNames(row.conversation_id, [row.user_id]).then(() => {
                if (!cancelled) handlers.onEvent(toEvent(row))
              })
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'conversation_participants',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              const row = (payload.new as { conversation_id?: string } | undefined)?.conversation_id
                ? (payload.new as { conversation_id: string })
                : (payload.old as { conversation_id?: string } | undefined)
              if (row?.conversation_id) handlers.onOwnParticipantChange(row.conversation_id)
            },
          )
          .subscribe((status) => {
            if (cancelled) return
            handlers.onStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected')
          })
      })()

      return () => {
        cancelled = true
        if (channel) {
          void client.removeChannel(channel)
          channel = null
        }
      }
    },
  }
}

/** Keyset condition for "strictly older than the cursor" under (created_at, seq) ordering. */
function keysetFilter(c: MessageCursor): string {
  const t = `"${c.createdAt}"`
  return `created_at.lt.${t},and(created_at.eq.${t},seq.lt.${c.seq})`
}

let instance: ChatService | null = null

/** App-wide Supabase-backed chat service, created on first use. */
export function getDefaultChatService(): ChatService {
  instance ??= createChatService(supabase)
  return instance
}
