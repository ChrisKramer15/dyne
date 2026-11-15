import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import '../../App.css'
import { useAuth } from '../../auth/authContext'
import BottomNav from '../../shared/BottomNav'
import NotFoundView from '../../routing/NotFoundView'
import { useChat } from './chatContext'
import { MESSAGE_PAGE_SIZE } from './chatService'
import type { ChatMessage, ConversationEvent, ConversationSummary } from './chatService'
import { displayName } from './conversationList'
import { DirectActions, GroupActions } from './ConversationActions'
import { MessageComposer } from './MessageComposer'
import { useUserList } from './userLists'
import type { GroupMember } from './ConversationActions'
import type { GroupRole } from './chatService'
import { MessageList } from './MessageList'
import type { PendingMessage } from './MessageList'
import { mergeMessages, oldestCursor } from './messageState'

type LoadStatus = 'loading' | 'loaded' | 'error' | 'not_found'

function mergeEvents(
  existing: readonly ConversationEvent[],
  incoming: readonly ConversationEvent[],
): ConversationEvent[] {
  const byId = new Map<string, ConversationEvent>()
  for (const e of existing) byId.set(e.id, e)
  for (const e of incoming) if (!byId.has(e.id)) byId.set(e.id, e)
  return [...byId.values()]
}

function newMessageId(): string {
  return crypto.randomUUID()
}

export interface ConversationViewProps {
  conversationId: string
}

/** The conversation view for one conversation id. Exported for tests. */
export function ConversationView({ conversationId }: ConversationViewProps) {
  const chat = useChat()
  const { service, openConversation, closeConversation, reportLatest, markRead, addListener } = chat
  const auth = useAuth()
  const selfId = auth.status === 'authenticated' ? auth.userId : undefined
  const navigate = useNavigate()

  const [status, setStatus] = useState<LoadStatus>('loading')
  const [errorKind, setErrorKind] = useState<'initial' | 'earlier' | null>(null)
  const [conversation, setConversation] = useState<ConversationSummary | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [events, setEvents] = useState<ConversationEvent[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [pending, setPending] = useState<PendingMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [members, setMembers] = useState<GroupMember[]>([])
  const [storedByRetry, setStoredByRetry] = useState<{ text: string } | null>(null)

  const favorites = useUserList('favorites', selfId)
  const blocked = useUserList('blocked', selfId)
  const mountedRef = useRef(true)
  const requestRef = useRef({ value: 0 })
  const messagesRef = useRef<ChatMessage[]>([])
  const pendingRef = useRef<PendingMessage[]>([])
  const inFlightIds = useRef(new Set<string>())
  const sendingRef = useRef(false)
  const leavingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    messagesRef.current = messages
    pendingRef.current = pending
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /** Report the newest displayed message and, when the tab is visible, mark it read. */
  const markLatestRead = useCallback(
    (list: readonly ChatMessage[]) => {
      const latest = list[list.length - 1]
      if (!latest) return
      reportLatest(conversationId, latest.createdAt)
      if (document.visibilityState === 'visible') {
        void markRead(conversationId, latest.createdAt)
      }
    },
    [conversationId, reportLatest, markRead],
  )

  const loadInitial = useCallback(async () => {
    const request = ++requestRef.current.value
    setStatus((s) => (s === 'loaded' ? s : 'loading'))
    setErrorKind(null)
    const [conv, msgs, evts] = await Promise.all([
      service.getConversation(conversationId),
      service.loadMessages({ conversationId, limit: MESSAGE_PAGE_SIZE }),
      service.loadEvents(conversationId),
    ])
    if (!mountedRef.current || request !== requestRef.current.value) return
    if (
      (!conv.ok && conv.error === 'not_found') ||
      (!msgs.ok && msgs.error === 'not_found') ||
      (!evts.ok && evts.error === 'not_found')
    ) {
      setStatus('not_found')
      return
    }
    if (conv.ok) setConversation(conv.conversation)
    if (evts.ok) setEvents((prev) => mergeEvents(prev, evts.events))
    if (msgs.ok) {
      const merged = mergeMessages(messagesRef.current, msgs.messages)
      setMessages(merged)
      // Only the first page decides "has earlier"; keep a known true when
      // earlier pages are already displayed.
      setHasMore((prev) => (messagesRef.current.length > 0 ? prev || msgs.hasMore : msgs.hasMore))
      markLatestRead(merged)
    }
    if (conv.ok && msgs.ok && evts.ok) {
      setStatus('loaded')
    } else {
      setErrorKind('initial')
      setStatus((s) => (s === 'loaded' || conv.ok ? 'loaded' : 'error'))
    }
  }, [service, conversationId, markLatestRead])

  // Who can be tagged. Failure just turns tagging off.
  const loadMembers = useCallback(async () => {
    const r = await service.listMembers?.(conversationId)
    if (r?.ok && mountedRef.current) setMembers(r.members)
  }, [service, conversationId])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- fetch on mount/conversation change
    void loadMembers()
  }, [loadMembers])

  const manageMessage = (error: string): string =>
    error === 'not_allowed'
      ? 'You do not have permission to do that.'
      : error === 'last_admin'
        ? 'A group needs at least one admin. Make someone else an admin first.'
        : error === 'not_a_member'
          ? 'That person is no longer in the group.'
          : error === 'already_member'
            ? 'That person is already in the group.'
            : error === 'group_full'
              ? 'This group is full.'
              : 'That did not work. Try again.'

  const setRole = async (userId: string, role: GroupRole): Promise<string | null> => {
    const r = await service.setMemberRole?.({ conversationId, userId, role })
    await loadMembers()
    return !r || r.ok ? null : manageMessage(r.error)
  }

  const addMember = async (userId: string): Promise<string | null> => {
    const r = await service.addMember?.({ conversationId, userId })
    await loadMembers()
    return !r || r.ok ? null : manageMessage(r.error)
  }

  const removeMember = async (userId: string): Promise<string | null> => {
    const r = await service.removeMember?.({ conversationId, userId })
    await loadMembers()
    return !r || r.ok ? null : manageMessage(r.error)
  }

  // Load and register as the open conversation.
  useEffect(() => {
    const requestBox = requestRef.current
    openConversation(conversationId)
    // oxlint-disable-next-line react/set-state-in-effect -- initial fetch must start on mount/conversation change; loadInitial sets the loading status
    void loadInitial()
    return () => {
      requestBox.value++
      closeConversation(conversationId)
    }
  }, [conversationId, openConversation, closeConversation, loadInitial])

  // Realtime: merge incoming messages and events; backfill after reconnect.
  useEffect(() => {
    return addListener({
      onMessage(m) {
        if (m.conversationId !== conversationId) return
        setMessages((prev) => mergeMessages(prev, [m]))
        if (m.senderId !== selfId) setAnnouncement(`${m.senderName}: ${m.text}`)
      },
      onEvent(e) {
        if (e.conversationId !== conversationId) return
        setEvents((prev) => mergeEvents(prev, [e]))
      },
      onReconnect() {
        void (async () => {
          const [msgs, evts] = await Promise.all([
            service.loadMessages({ conversationId, limit: MESSAGE_PAGE_SIZE }),
            service.loadEvents(conversationId),
          ])
          if (!mountedRef.current) return
          if (msgs.ok) {
            const merged = mergeMessages(messagesRef.current, msgs.messages)
            setMessages(merged)
            markLatestRead(merged)
          }
          if (evts.ok) setEvents((prev) => mergeEvents(prev, evts.events))
        })()
      },
    })
  }, [addListener, conversationId, selfId, service, markLatestRead])

  // Keep the provider's idea of the latest displayed message current.
  useEffect(() => {
    const latest = messages[messages.length - 1]
    if (latest) reportLatest(conversationId, latest.createdAt)
  }, [messages, conversationId, reportLatest])

  async function loadEarlier() {
    const cursor = oldestCursor(messagesRef.current)
    if (!cursor || loadingEarlier) return
    setLoadingEarlier(true)
    setErrorKind(null)
    const result = await service.loadMessages({
      conversationId,
      before: cursor,
      limit: MESSAGE_PAGE_SIZE,
    })
    if (!mountedRef.current) return
    setLoadingEarlier(false)
    if (result.ok) {
      setMessages((prev) => mergeMessages(prev, result.messages))
      setHasMore(result.hasMore)
    } else if (result.error === 'not_found') {
      setStatus('not_found')
    } else {
      setErrorKind('earlier')
    }
  }

  function retryLoad() {
    if (errorKind === 'earlier') void loadEarlier()
    else void loadInitial()
  }

  /** Sends one message under a fixed id. Resolves true when it was stored. */
  const sendWithId = useCallback(
    async (id: string, text: string): Promise<boolean> => {
      if (inFlightIds.current.has(id)) return false
      inFlightIds.current.add(id)
      setSendError(null)
      setPending((prev) =>
        prev.some((p) => p.id === id)
          ? prev.map((p) => (p.id === id ? { ...p, status: 'sending' } : p))
          : [...prev, { id, text, status: 'sending', createdAt: new Date().toISOString() }],
      )
      try {
        const result = await service.sendMessage({ id, conversationId, text })
        if (!mountedRef.current) return result.ok
        if (result.ok) {
          setMessages((prev) => mergeMessages(prev, [result.message]))
          setPending((prev) => prev.filter((p) => p.id !== id))
          return true
        }
        setPending((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'failed' } : p)))
        setSendError(
          result.error === 'not_participant'
            ? 'You are not a participant of this conversation. The message was not sent.'
            : 'The message could not be sent.',
        )
        return false
      } finally {
        inFlightIds.current.delete(id)
      }
    },
    [service, conversationId],
  )

  const handleSend = useCallback(
    async (text: string): Promise<boolean> => {
      if (sendingRef.current) return false
      sendingRef.current = true
      try {
        // Resubmitting the text of a failed message reuses its id, so a lost
        // response cannot store the text twice.
        const failed = pendingRef.current.find((p) => p.status === 'failed' && p.text === text)
        return await sendWithId(failed?.id ?? newMessageId(), text)
      } finally {
        sendingRef.current = false
      }
    },
    [sendWithId],
  )

  function handleRetry(id: string) {
    const item = pendingRef.current.find((p) => p.id === id)
    if (!item) return
    void sendWithId(id, item.text).then((stored) => {
      // The composer kept the failed text; clear it so it is not sent twice.
      if (stored && mountedRef.current) setStoredByRetry({ text: item.text })
    })
  }

  async function handleLeave() {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    setLeaveError(null)
    const result = await chat.leaveGroup(conversationId)
    leavingRef.current = false
    if (!mountedRef.current) return
    setLeaving(false)
    if (result.ok) navigate('/chat')
    else setLeaveError('You could not leave this group. Try again.')
  }

  if (status === 'not_found') return <NotFoundView />

  const title = conversation ? displayName(conversation) : 'Conversation'
  const other = members.find((m) => m.userId !== selfId) ?? null
  // A DM with a blocked person doesn't exist as far as the user is concerned.
  const dmBlocked =
    conversation?.kind === 'personal' &&
    blocked.list.some((u) => u.username.toLowerCase() === (conversation.otherUserName ?? '').toLowerCase())
  if (dmBlocked) return <NotFoundView />
  // In groups, messages from blocked people are hidden and they can't be tagged.
  const visibleMessages = messages.filter((m) => !blocked.has(m.senderId))

  return (
    <div
      className={`app-shell conversation-shell chat-tab-${conversation?.kind === 'group' ? 'group' : 'personal'}`}
    >
      <main className="home-main conversation-view">
        <header className="conversation-view-header">
          <div className="conversation-actions">
            <Link to="/chat" className="conversation-back">
              Back to chat
            </Link>
            {conversation?.kind === 'group' && (
              <button
                type="button"
                className="conversation-leave"
                onClick={() => void handleLeave()}
                aria-disabled={leaving || undefined}
              >
                Leave group
              </button>
            )}
          </div>
          <div className="conversation-title">
            <span className="conversation-avatar" aria-hidden="true">
              {Array.from(title.trim())[0]?.toUpperCase() ?? '?'}
            </span>
            <h1 className="page-title" tabIndex={-1}>
              {title}
            </h1>
            {conversation?.kind === 'personal' && (
              <DirectActions
                other={other}
                isFavorite={other !== null && favorites.has(other.userId)}
                onToggleFavorite={() => {
                  if (!other) return
                  if (favorites.has(other.userId)) favorites.remove(other.userId)
                  else favorites.add(other)
                }}
                onBlock={() => {
                  if (!other) return
                  blocked.add(other)
                  navigate('/chat')
                }}
              />
            )}
            {conversation?.kind === 'group' && (
              <GroupActions
                groupName={title}
                members={members}
                selfId={selfId}
                onOpen={() => void loadMembers()}
                onSetRole={service.setMemberRole ? setRole : undefined}
                onAdd={service.addMember ? addMember : undefined}
                onSearch={async (q) => {
                  const r = await service.searchUsers(q)
                  return r.ok ? r.users : null
                }}
                blockedIds={new Set(blocked.list.map((u) => u.userId))}
                onRemove={service.removeMember ? removeMember : undefined}
              />
            )}
          </div>
        </header>

        {leaveError && (
          <p role="alert" className="conversation-error">
            {leaveError}
          </p>
        )}

        <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>

        {status === 'loading' && (
          <p className="loading" role="status">
            Loading…
          </p>
        )}
        {errorKind !== null && (
          <div role="alert" className="conversation-error">
            <p>Messages could not be loaded.</p>
            <button type="button" onClick={retryLoad}>
              Retry
            </button>
          </div>
        )}

        {(status === 'loaded' || messages.length > 0) && (
          <MessageList
            selfId={selfId}
            showSenderNames={conversation?.kind === 'group'}
            memberNames={members.map((m) => m.username)}
            messages={visibleMessages}
            events={events}
            pending={pending}
            hasMore={hasMore}
            loadingEarlier={loadingEarlier}
            onLoadEarlier={() => void loadEarlier()}
            onRetry={handleRetry}
            onJumpToLatest={() => textareaRef.current?.focus()}
          />
        )}

        {sendError && (
          <p role="alert" className="chat-send-error">
            {sendError}
          </p>
        )}

        {conversation && (
          <MessageComposer onSend={handleSend} autoFocus
            textareaRef={textareaRef}
            storedElsewhere={storedByRetry}
            members={members.filter((m) => m.userId !== selfId && !blocked.has(m.userId))}
          />
        )}
      </main>
      <BottomNav />
    </div>
  )
}

/** Route component: reads `:conversationId` unless one is passed. */
export default function ConversationViewPage({ conversationId }: { conversationId?: string }) {
  const params = useParams()
  const id = conversationId ?? params.conversationId
  if (!id) return <NotFoundView />
  return <ConversationView key={id} conversationId={id} />
}
