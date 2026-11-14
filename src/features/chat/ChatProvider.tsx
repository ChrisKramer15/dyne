import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/authContext'
import {
  RECONNECT_INTERVAL_MS,
  READ_RETRY_COUNT,
  READ_RETRY_INTERVAL_MS,
  UNREAD_LOAD_RETRY_COUNT,
  UNREAD_LOAD_RETRY_INTERVAL_MS,
} from './chatService'
import type { ChatService, LeaveGroupResult } from './chatService'
import { getDefaultChatService } from './defaultChatService'
import { ChatContext } from './chatContext'
import type { ChatContextValue, ChatListener } from './chatContext'
import { initialUnreadState, totalUnread, unreadReducer } from './unreadReducer'
import type { UnreadState } from './unreadReducer'

function compareTime(a: string, b: string): number {
  const x = Date.parse(a)
  const y = Date.parse(b)
  if (Number.isNaN(x) || Number.isNaN(y)) return a < b ? -1 : a > b ? 1 : 0
  return x - y
}

export function ChatProvider({
  service,
  children,
}: {
  service?: ChatService
  children: ReactNode
}) {
  const auth = useAuth()
  const userId = auth.status === 'authenticated' ? auth.userId : undefined
  const svc = useMemo(() => service ?? getDefaultChatService(), [service])

  const [state, dispatch] = useReducer(unreadReducer, initialUnreadState)
  const stateRef = useRef<UnreadState>(state)
  const userIdRef = useRef(userId)
  const svcRef = useRef(svc)
  // Keep latest-value refs current after each commit, before any passive effect runs.
  useLayoutEffect(() => {
    stateRef.current = state
    userIdRef.current = userId
    svcRef.current = svc
  })

  const openRef = useRef<string | null>(null)
  const latestRef = useRef<Record<string, string>>({})
  const listenersRef = useRef(new Set<ChatListener>())
  // Bumped whenever the session (user) changes, to cancel in-flight work.
  const epochRef = useRef({ value: 0 })
  const readTokenRef = useRef<Record<string, number>>({})
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        timersRef.current.delete(t)
        resolve()
      }, ms)
      timersRef.current.add(t)
    })
  }, [])

  const refresh = useCallback(async () => {
    const epoch = epochRef.current.value
    const result = await svcRef.current.loadUnreadTotal()
    if (epoch !== epochRef.current.value || !userIdRef.current) return
    if (result.ok) dispatch({ type: 'LOADED', entries: result.entries })
  }, [])

  const markRead = useCallback(
    async (conversationId: string, upTo: string) => {
      if (!userIdRef.current) return
      const epoch = epochRef.current.value
      const before = stateRef.current
      const prevMarker = before.markers[conversationId]
      const prevCount = before.counts[conversationId]
      if (prevMarker !== undefined && compareTime(upTo, prevMarker) <= 0) return

      const token = (readTokenRef.current[conversationId] ?? 0) + 1
      readTokenRef.current[conversationId] = token
      const superseded = () =>
        epoch !== epochRef.current.value || readTokenRef.current[conversationId] !== token

      dispatch({ type: 'MARK_READ', conversationId, upTo })

      for (let attempt = 0; attempt <= READ_RETRY_COUNT; attempt++) {
        const result = await svcRef.current.markRead({ conversationId, upTo })
        if (superseded()) return
        if (result.ok) {
          dispatch({
            type: 'MARKER_CONFIRMED',
            conversationId,
            lastReadAt: result.lastReadAt,
            unread: result.unread,
          })
          return
        }
        // Persist failed: restore the previous marker and count.
        if (prevMarker !== undefined && typeof prevCount === 'number') {
          dispatch({
            type: 'MARKER_CONFIRMED',
            conversationId,
            lastReadAt: prevMarker,
            unread: prevCount,
          })
        } else if (prevMarker === undefined && prevCount === undefined) {
          dispatch({ type: 'CONVERSATION_REMOVED', conversationId })
        }
        if (attempt === READ_RETRY_COUNT) return
        await sleep(READ_RETRY_INTERVAL_MS)
        if (superseded()) return
      }
    },
    [sleep],
  )
  const markReadRef = useRef(markRead)
  useLayoutEffect(() => {
    markReadRef.current = markRead
  })

  // Session lifecycle: load unread, subscribe, reset on sign-out / user change.
  useEffect(() => {
    if (!userId) return
    const epochBox = epochRef.current
    const timers = timersRef.current
    const readTokens = readTokenRef.current
    const epoch = ++epochBox.value
    const active = () => epoch === epochRef.current.value
    let unsubscribe: (() => void) | null = null
    let reconnectTimer: ReturnType<typeof setInterval> | null = null
    let wasDisconnected = false

    const stopReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearInterval(reconnectTimer)
        reconnectTimer = null
      }
    }

    const connect = () => {
      unsubscribe?.()
      unsubscribe = svcRef.current.subscribe({
        onMessage(m) {
          if (!active()) return
          const isSelf = m.senderId === userId
          if (!isSelf) {
            if (openRef.current === m.conversationId && document.visibilityState === 'visible') {
              latestRef.current[m.conversationId] = m.createdAt
              void markReadRef.current(m.conversationId, m.createdAt)
            } else {
              dispatch({
                type: 'MESSAGE_RECEIVED',
                conversationId: m.conversationId,
                senderId: m.senderId,
                selfId: userId,
                createdAt: m.createdAt,
              })
            }
          }
          for (const l of [...listenersRef.current]) l.onMessage?.(m)
        },
        onEvent(e) {
          if (!active()) return
          for (const l of [...listenersRef.current]) l.onEvent?.(e)
        },
        onOwnParticipantChange() {
          if (!active()) return
          // One call returns every conversation; a missing entry means we left it.
          void svcRef.current.loadUnreadTotal().then((result) => {
            if (!active() || !result.ok) return
            dispatch({ type: 'LOADED', entries: result.entries })
          })
        },
        onStatus(status) {
          if (!active()) return
          if (status === 'disconnected') {
            wasDisconnected = true
            if (reconnectTimer === null) {
              reconnectTimer = setInterval(() => {
                if (active()) connect()
              }, RECONNECT_INTERVAL_MS)
            }
            return
          }
          stopReconnectTimer()
          if (!wasDisconnected) return
          wasDisconnected = false
          void refresh()
          for (const l of [...listenersRef.current]) l.onReconnect?.()
        },
      })
    }

    connect()

    // Initial load: 1 attempt plus UNREAD_LOAD_RETRY_COUNT retries, then stop
    // until userId changes (a new effect run).
    void (async () => {
      for (let attempt = 0; attempt <= UNREAD_LOAD_RETRY_COUNT; attempt++) {
        const result = await svcRef.current.loadUnreadTotal()
        if (!active()) return
        if (result.ok) {
          dispatch({ type: 'LOADED', entries: result.entries })
          return
        }
        dispatch({ type: 'LOAD_FAILED' })
        if (attempt === UNREAD_LOAD_RETRY_COUNT) return
        await sleep(UNREAD_LOAD_RETRY_INTERVAL_MS)
        if (!active()) return
      }
    })()

    return () => {
      epochBox.value++
      stopReconnectTimer()
      unsubscribe?.()
      unsubscribe = null
      for (const t of timers) clearTimeout(t)
      timers.clear()
      for (const k of Object.keys(readTokens)) delete readTokens[k]
      dispatch({ type: 'RESET' })
    }
  }, [userId, refresh, sleep])

  const openConversation = useCallback((conversationId: string) => {
    openRef.current = conversationId
  }, [])
  const closeConversation = useCallback((conversationId: string) => {
    if (openRef.current === conversationId) openRef.current = null
  }, [])
  const reportLatest = useCallback((conversationId: string, createdAt: string) => {
    const current = latestRef.current[conversationId]
    if (current === undefined || compareTime(createdAt, current) > 0) {
      latestRef.current[conversationId] = createdAt
    }
  }, [])

  // Tab becomes visible while a conversation is open: mark read up to the latest message.
  useEffect(() => {
    if (!userId) return
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const open = openRef.current
      if (open === null) return
      const latest = latestRef.current[open]
      if (latest !== undefined) void markReadRef.current(open, latest)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [userId])

  const leaveGroup = useCallback(async (conversationId: string): Promise<LeaveGroupResult> => {
    const result = await svcRef.current.leaveGroup(conversationId)
    if (result.ok) dispatch({ type: 'CONVERSATION_REMOVED', conversationId })
    return result
  }, [])

  const addListener = useCallback((listener: ChatListener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const unreadFor = useCallback(
    (conversationId: string): number | null => {
      const c = state.counts[conversationId]
      if (c === 'unknown') return null
      if (c === undefined) return state.status === 'failed' ? null : 0
      return c
    },
    [state.counts, state.status],
  )

  const total = totalUnread(state)

  const value = useMemo<ChatContextValue>(
    () => ({
      service: svc,
      total,
      unreadFor,
      markRead,
      openConversation,
      closeConversation,
      reportLatest,
      refresh,
      leaveGroup,
      addListener,
    }),
    [
      svc,
      total,
      unreadFor,
      markRead,
      openConversation,
      closeConversation,
      reportLatest,
      refresh,
      leaveGroup,
      addListener,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
