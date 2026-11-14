import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuthState, type AuthStateClient } from './useAuthState'
import type { AuthSessionLike } from './authReducer'

type Callback = (event: string, session: AuthSessionLike | null) => void
type SessionResult = Awaited<ReturnType<AuthStateClient['auth']['getSession']>>

function makeClient(getSession: () => PromiseLike<SessionResult>) {
  const unsubscribe = vi.fn()
  let callback: Callback = () => {}
  const getSessionMock = vi.fn(getSession)
  const client: AuthStateClient = {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: (cb) => {
        callback = cb
        return { data: { subscription: { unsubscribe } } }
      },
    },
  }
  return { client, getSession: getSessionMock, unsubscribe, emit: (e: string, s: AuthSessionLike | null) => callback(e, s) }
}

const session: AuthSessionLike = { user: { id: 'user-1', user_metadata: { name: 'Ada' } } }
const ok = (s: AuthSessionLike | null): Promise<SessionResult> =>
  Promise.resolve({ data: { session: s }, error: null })

afterEach(() => {
  vi.useRealTimers()
})

describe('useAuthState', () => {
  it('starts loading and calls getSession exactly once, then authenticates', async () => {
    const { client, getSession } = makeClient(() => ok(session))
    const { result, rerender } = renderHook(() => useAuthState(client))
    expect(result.current).toEqual({ status: 'loading' })
    await act(async () => {})
    rerender()
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({
      status: 'authenticated',
      userMetadata: { name: 'Ada' },
      userId: 'user-1',
    })
  })

  it('resolves to unauthenticated when there is no session', async () => {
    const { client } = makeClient(() => ok(null))
    const { result } = renderHook(() => useAuthState(client))
    await act(async () => {})
    expect(result.current).toEqual({ status: 'unauthenticated' })
  })

  it('resolves to unauthenticated when getSession rejects', async () => {
    const { client } = makeClient(() => Promise.reject(new Error('boom')))
    const { result } = renderHook(() => useAuthState(client))
    await act(async () => {})
    expect(result.current).toEqual({ status: 'unauthenticated' })
  })

  it('resolves to unauthenticated when getSession returns an error result', async () => {
    const { client } = makeClient(() =>
      Promise.resolve({ data: { session }, error: new Error('bad') }),
    )
    const { result } = renderHook(() => useAuthState(client))
    await act(async () => {})
    expect(result.current).toEqual({ status: 'unauthenticated' })
  })

  it('resolves to unauthenticated after the timeout when getSession never settles', async () => {
    vi.useFakeTimers()
    const { client } = makeClient(() => new Promise<SessionResult>(() => {}))
    const { result } = renderHook(() => useAuthState(client, 5000))
    expect(result.current).toEqual({ status: 'loading' })
    await act(async () => {
      vi.advanceTimersByTime(4999)
    })
    expect(result.current).toEqual({ status: 'loading' })
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toEqual({ status: 'unauthenticated' })
  })

  it('applies auth events: sign in, then sign out', async () => {
    const { client, emit } = makeClient(() => ok(null))
    const { result } = renderHook(() => useAuthState(client))
    await act(async () => {})
    expect(result.current.status).toBe('unauthenticated')
    act(() => emit('SIGNED_IN', session))
    expect(result.current).toEqual({
      status: 'authenticated',
      userMetadata: { name: 'Ada' },
      userId: 'user-1',
    })
    act(() => emit('SIGNED_OUT', null))
    expect(result.current).toEqual({ status: 'unauthenticated' })
  })

  it('unsubscribes on unmount and ignores late results', async () => {
    let resolve!: (r: SessionResult) => void
    const { client, unsubscribe, emit } = makeClient(
      () => new Promise<SessionResult>((r) => (resolve = r)),
    )
    const { result, unmount } = renderHook(() => useAuthState(client))
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolve({ data: { session }, error: null })
      emit('SIGNED_IN', session)
    })
    expect(result.current).toEqual({ status: 'loading' })
  })
})
