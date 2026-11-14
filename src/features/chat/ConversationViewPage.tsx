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
import { MessageComposer } from './MessageComposer'
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
  const [storedByRetry, setStoredByRetry] = useState<{ text: string } | null>(null)

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

  return (
    <div className="app-shell">
      <main className="home-main conversation-view">
        <header className="home-header conversation-view-header">
          <Link to="/chat" className="conversation-back">
            Back to chat
          </Link>
          <h1 className="page-title" tabIndex={-1}>
            {title}
          </h1>
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
            messages={messages}
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
