import { afterEach, describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import {
  createAuthService,
  mapSignUpError,
  SERVICE_TIMEOUT_MS,
  TimeoutError,
  withTimeout,
  type AuthClientLike,
} from './authService'
import { authModalReducer, CLOSED_STATE, type AuthModalState } from './authModalReducer'
import type { SwitchableStorage } from './switchableStorage'

const RUNS = { numRuns: 100 }

const username = fc.string({ minLength: 1, maxLength: 20 })
const email = fc.emailAddress()
const password = fc.string({ minLength: 8, maxLength: 20 })

const storage = { degraded: false, setMode() {}, clearAll() {} } as unknown as SwitchableStorage

type SignUpReply = Awaited<ReturnType<AuthClientLike['auth']['signUp']>>

function makeClient(opts: { available: boolean; signUp: SignUpReply }): AuthClientLike {
  return {
    auth: {
      setSession: async () => ({ error: null }),
      signUp: async () => opts.signUp,
      signOut: async () => ({ error: null }),
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
    rpc: async () => ({ data: opts.available, error: null }),
  }
}

// Replays a failed sign-up through the modal reducer.
function failedRegisterState(u: string, e: string, error: 'username_taken' | 'email_taken') {
  let s: AuthModalState = authModalReducer(CLOSED_STATE, { type: 'OPEN', view: 'register' })
  s = authModalReducer(s, { type: 'CHANGE', field: 'username', value: u })
  s = authModalReducer(s, { type: 'CHANGE', field: 'email', value: e })
  s = authModalReducer(s, { type: 'SUBMIT_START' })
  return authModalReducer(s, { type: 'SUBMIT_FAILED', error })
}

function expectKept(s: AuthModalState, u: string, e: string, error: string) {
  if (!s.open) throw new Error('modal closed')
  expect(s.username).toBe(u)
  expect(s.email).toBe(e)
  expect(s.serviceError).toBe(error)
  expect(s.pending).toBe(false)
}

// Feature: auth-modal, Property 17: Sign-up failures identify the conflicting value
describe('Feature: auth-modal, Property 17: sign-up failures identify the conflicting value', () => {
  /** **Validates: Requirements 6.10** */
  it('taken username yields username_taken and the form keeps username and email', async () => {
    await fc.assert(
      fc.asyncProperty(username, email, password, async (u, e, p) => {
        const svc = createAuthService(
          makeClient({ available: false, signUp: { data: { session: null, user: null }, error: null } }),
          storage,
        )
        const r = await svc.signUp({ username: u, email: e, password: p })
        expect(r).toEqual({ ok: false, error: 'username_taken' })
        if (!r.ok) expectKept(failedRegisterState(u, e, r.error as 'username_taken'), u, e, 'username_taken')
      }),
      RUNS,
    )
  })

  /** **Validates: Requirements 6.10** */
  it('taken email (error code or empty identities) yields email_taken and the form keeps values', async () => {
    const emailTakenReply = fc.oneof(
      fc.constantFrom('user_already_exists', 'email_exists').map(
        (code): SignUpReply => ({ data: { session: null, user: null }, error: { code, message: 'x' } }),
      ),
      fc.constant<SignUpReply>({ data: { session: null, user: { identities: [] } }, error: null }),
    )
    await fc.assert(
      fc.asyncProperty(username, email, password, emailTakenReply, async (u, e, p, reply) => {
        const svc = createAuthService(makeClient({ available: true, signUp: reply }), storage)
        const r = await svc.signUp({ username: u, email: e, password: p })
        expect(r).toEqual({ ok: false, error: 'email_taken' })
        if (!r.ok) expectKept(failedRegisterState(u, e, r.error as 'email_taken'), u, e, 'email_taken')
      }),
      RUNS,
    )
  })

  /** **Validates: Requirements 6.10** */
  it('mapSignUpError classifies uniqueness violations by the conflicting value', () => {
    fc.assert(
      fc.property(fc.constantFrom('unique_violation', '23505'), (code) => {
        expect(mapSignUpError({ code, message: 'whatever' })).toBe('username_taken')
      }),
      RUNS,
    )
    fc.assert(
      fc.property(fc.constantFrom('user_already_exists', 'email_exists'), (code) => {
        expect(mapSignUpError({ code })).toBe('email_taken')
      }),
      RUNS,
    )
  })
})

// ---------------------------------------------------------------------------
// Unit tests: timeouts, error mapping, confirmation, rememberFailed, signOut
// ---------------------------------------------------------------------------

function makeStorage(degraded = false) {
  return {
    degraded,
    setMode: vi.fn(),
    clearAll: vi.fn(),
  } as unknown as SwitchableStorage & { setMode: ReturnType<typeof vi.fn>; clearAll: ReturnType<typeof vi.fn> }
}

function makeUnitClient(over: {
  invoke?: AuthClientLike['functions']['invoke']
  setSession?: AuthClientLike['auth']['setSession']
  signUp?: AuthClientLike['auth']['signUp']
  signOut?: AuthClientLike['auth']['signOut']
  rpc?: AuthClientLike['rpc']
}): AuthClientLike {
  return {
    auth: {
      setSession: over.setSession ?? (async () => ({ error: null })),
      signUp: over.signUp ?? (async () => ({ data: { session: null, user: null }, error: null })),
      signOut: over.signOut ?? (async () => ({ error: null })),
    },
    functions: { invoke: over.invoke ?? (async () => ({ data: null, error: null })) },
    rpc: over.rpc ?? (async () => ({ data: true, error: null })),
  }
}

const tokens = { access_token: 'a', refresh_token: 'r' }
const creds = { username: 'alice', password: 'pw', remember: false }

describe('auth service unit tests', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('withTimeout', () => {
    it('rejects with TimeoutError after 10 s and ignores a late response', async () => {
      vi.useFakeTimers()
      let resolveLate!: (v: string) => void
      const pending = new Promise<string>((r) => {
        resolveLate = r
      })
      const result = withTimeout(pending)
      const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError)

      await vi.advanceTimersByTimeAsync(SERVICE_TIMEOUT_MS - 1)
      let settled = false
      result.catch(() => {
        settled = true
      })
      await Promise.resolve()
      expect(settled).toBe(false)

      await vi.advanceTimersByTimeAsync(1)
      await assertion
      resolveLate('late') // must not throw or change the outcome
      await Promise.resolve()
    })

    it('resolves with the value when the promise settles in time', async () => {
      await expect(withTimeout(Promise.resolve(42))).resolves.toBe(42)
    })
  })

  describe('signIn', () => {
    it('maps a 401 from the function to invalid_credentials', async () => {
      const svc = createAuthService(
        makeUnitClient({ invoke: async () => ({ data: null, error: { context: { status: 401 } } }) }),
        makeStorage(),
      )
      expect(await svc.signIn(creds)).toEqual({ ok: false, error: 'invalid_credentials' })
    })

    it('maps 5xx responses to unavailable', async () => {
      for (const status of [500, 502, 503]) {
        const svc = createAuthService(
          makeUnitClient({ invoke: async () => ({ data: null, error: { context: { status } } }) }),
          makeStorage(),
        )
        expect(await svc.signIn(creds)).toEqual({ ok: false, error: 'unavailable' })
      }
    })

    it('maps a network error (no status, or thrown) to unavailable', async () => {
      const noStatus = createAuthService(
        makeUnitClient({ invoke: async () => ({ data: null, error: new Error('Failed to fetch') }) }),
        makeStorage(),
      )
      expect(await noStatus.signIn(creds)).toEqual({ ok: false, error: 'unavailable' })

      const thrown = createAuthService(
        makeUnitClient({
          invoke: async () => {
            throw new TypeError('network down')
          },
        }),
        makeStorage(),
      )
      expect(await thrown.signIn(creds)).toEqual({ ok: false, error: 'unavailable' })
    })

    it('maps a request exceeding 10 s to unavailable', async () => {
      vi.useFakeTimers()
      const svc = createAuthService(
        makeUnitClient({ invoke: () => new Promise(() => {}) }),
        makeStorage(),
      )
      const p = svc.signIn(creds)
      await vi.advanceTimersByTimeAsync(SERVICE_TIMEOUT_MS)
      expect(await p).toEqual({ ok: false, error: 'unavailable' })
    })

    it('reports rememberFailed when storage is degraded and sets the mode from remember', async () => {
      const degraded = makeStorage(true)
      const svc = createAuthService(
        makeUnitClient({ invoke: async () => ({ data: tokens, error: null }) }),
        degraded,
      )
      expect(await svc.signIn({ ...creds, remember: true })).toEqual({ ok: true, rememberFailed: true })
      expect(degraded.setMode).toHaveBeenCalledWith('local')

      const healthy = makeStorage(false)
      const svc2 = createAuthService(
        makeUnitClient({ invoke: async () => ({ data: tokens, error: null }) }),
        healthy,
      )
      expect(await svc2.signIn(creds)).toEqual({ ok: true, rememberFailed: false })
      expect(healthy.setMode).toHaveBeenCalledWith('session')
    })
  })

  describe('signUp', () => {
    it('maps confirmationRequired from the presence of a session', async () => {
      const noSession = createAuthService(
        makeUnitClient({
          signUp: async () => ({ data: { session: null, user: { identities: [{}] } }, error: null }),
        }),
        makeStorage(),
      )
      expect(await noSession.signUp({ username: 'u', email: 'e@x.io', password: 'password1' })).toEqual({
        ok: true,
        confirmationRequired: true,
      })

      const withSession = createAuthService(
        makeUnitClient({
          signUp: async () => ({ data: { session: { t: 1 }, user: { identities: [{}] } }, error: null }),
        }),
        makeStorage(),
      )
      expect(await withSession.signUp({ username: 'u', email: 'e@x.io', password: 'password1' })).toEqual({
        ok: true,
        confirmationRequired: false,
      })
    })

    it('maps a request exceeding 10 s to unavailable', async () => {
      vi.useFakeTimers()
      const svc = createAuthService(makeUnitClient({ rpc: () => new Promise(() => {}) }), makeStorage())
      const p = svc.signUp({ username: 'u', email: 'e@x.io', password: 'password1' })
      await vi.advanceTimersByTimeAsync(SERVICE_TIMEOUT_MS)
      expect(await p).toEqual({ ok: false, error: 'unavailable' })
    })
  })

  describe('requestPasswordReset', () => {
    it('maps errors and timeouts to reset_unavailable', async () => {
      const failing = createAuthService(
        makeUnitClient({ invoke: async () => ({ data: null, error: { context: { status: 503 } } }) }),
        makeStorage(),
      )
      expect(await failing.requestPasswordReset('alice')).toEqual({ ok: false, error: 'reset_unavailable' })

      vi.useFakeTimers()
      const hanging = createAuthService(makeUnitClient({ invoke: () => new Promise(() => {}) }), makeStorage())
      const p = hanging.requestPasswordReset('alice')
      await vi.advanceTimersByTimeAsync(SERVICE_TIMEOUT_MS)
      expect(await p).toEqual({ ok: false, error: 'reset_unavailable' })
    })

    it('returns ok on success', async () => {
      const svc = createAuthService(makeUnitClient({}), makeStorage())
      expect(await svc.requestPasswordReset('alice')).toEqual({ ok: true })
    })
  })

  describe('signOut', () => {
    it('clears storage after a successful sign-out with local scope', async () => {
      const st = makeStorage()
      const signOut = vi.fn(async () => ({ error: null }))
      await createAuthService(makeUnitClient({ signOut }), st).signOut()
      expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(st.clearAll).toHaveBeenCalledTimes(1)
    })

    it('clears storage even when the network call rejects', async () => {
      const st = makeStorage()
      const svc = createAuthService(
        makeUnitClient({
          signOut: async () => {
            throw new TypeError('network down')
          },
        }),
        st,
      )
      await expect(svc.signOut()).resolves.toBeUndefined()
      expect(st.clearAll).toHaveBeenCalledTimes(1)
    })

    it('clears storage even when the network call hangs past 10 s', async () => {
      vi.useFakeTimers()
      const st = makeStorage()
      const svc = createAuthService(makeUnitClient({ signOut: () => new Promise(() => {}) }), st)
      const p = svc.signOut()
      await vi.advanceTimersByTimeAsync(SERVICE_TIMEOUT_MS)
      await p
      expect(st.clearAll).toHaveBeenCalledTimes(1)
    })
  })
})
