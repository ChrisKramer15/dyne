import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { authReducer, type AuthAction, type AuthState } from './authReducer'

// Feature: landing-page, Property 4: Latest auth event determines state
// **Validates: Requirements 5.7, 6.3, 6.4, 6.5, 6.6**

const sessionArb = fc.option(
  fc.record({ user: fc.record({ user_metadata: fc.anything() }) }),
  { nil: null },
)

const initialArb: fc.Arbitrary<AuthAction> = fc.oneof(
  sessionArb.map((session): AuthAction => ({ type: 'SESSION_RESOLVED', session })),
  fc.constant<AuthAction>({ type: 'SESSION_FAILED' }),
)

const laterArb: fc.Arbitrary<AuthAction> = fc.oneof(
  initialArb,
  // Ordinary (non-recovery) events: the "latest session wins" property holds
  // for these. PASSWORD_RECOVERY has its own dedicated tests below.
  sessionArb.map((session): AuthAction => ({ type: 'AUTH_EVENT', event: 'SIGNED_IN', session })),
)

const run = (actions: AuthAction[]): AuthState =>
  actions.reduce(authReducer, { status: 'loading' } as AuthState)

describe('authReducer Property 4: latest auth event determines state', () => {
  it('state follows the last session-bearing action, regardless of history', () => {
    fc.assert(
      fc.property(initialArb, fc.array(laterArb, { maxLength: 20 }), (first, rest) => {
        const actions = [first, ...rest]
        const final = run(actions)
        // Session-bearing actions: everything except SESSION_FAILED
        const bearing = [...actions].reverse().find((a) => a.type !== 'SESSION_FAILED')
        if (!bearing) {
          expect(final).toEqual({ status: 'unauthenticated' })
        } else if (bearing.session) {
          expect(final).toEqual({
            status: 'authenticated',
            userMetadata: bearing.session.user.user_metadata,
          })
        } else {
          expect(final).toEqual({ status: 'unauthenticated' })
        }
      }),
      { numRuns: 100 },
    )
  })

  it('a late SESSION_FAILED is ignored once state has left loading', () => {
    fc.assert(
      fc.property(
        sessionArb,
        fc.array(laterArb, { maxLength: 10 }),
        fc.integer({ min: 1, max: 5 }),
        (session, rest, failures) => {
          const before = run([{ type: 'SESSION_RESOLVED', session }, ...rest])
          const after = Array.from({ length: failures }).reduce<AuthState>(
            (s) => authReducer(s, { type: 'SESSION_FAILED' }),
            before,
          )
          expect(after).toBe(before)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('SESSION_FAILED while loading yields unauthenticated', () => {
    expect(authReducer({ status: 'loading' }, { type: 'SESSION_FAILED' })).toEqual({
      status: 'unauthenticated',
    })
  })
})

describe('authReducer password recovery', () => {
  const session = { user: { user_metadata: { username: 'Ada' } } }
  const recovering: AuthState = { status: 'recovering', userMetadata: { username: 'Ada' } }

  it('PASSWORD_RECOVERY with a session enters recovering', () => {
    expect(
      authReducer({ status: 'loading' }, { type: 'AUTH_EVENT', event: 'PASSWORD_RECOVERY', session }),
    ).toEqual(recovering)
  })

  it('a late SESSION_RESOLVED does not downgrade recovering to authenticated', () => {
    expect(authReducer(recovering, { type: 'SESSION_RESOLVED', session })).toBe(recovering)
    expect(authReducer(recovering, { type: 'SESSION_RESOLVED', session: null })).toBe(recovering)
  })

  it('other auth events keep recovering', () => {
    for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION']) {
      expect(authReducer(recovering, { type: 'AUTH_EVENT', event, session })).toBe(recovering)
    }
  })

  it('USER_UPDATED completes recovery as authenticated', () => {
    expect(authReducer(recovering, { type: 'AUTH_EVENT', event: 'USER_UPDATED', session })).toEqual({
      status: 'authenticated',
      userMetadata: { username: 'Ada' },
    })
  })

  it('SIGNED_OUT leaves recovery so the user is not stuck', () => {
    expect(authReducer(recovering, { type: 'AUTH_EVENT', event: 'SIGNED_OUT', session: null })).toEqual({
      status: 'unauthenticated',
    })
  })

  it('a late SESSION_FAILED is ignored while recovering', () => {
    expect(authReducer(recovering, { type: 'SESSION_FAILED' })).toBe(recovering)
  })
})
