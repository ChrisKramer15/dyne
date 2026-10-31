import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  authModalReducer,
  CLOSED_STATE,
  type AuthModalState,
  type ModalView,
  type ServiceError,
} from './authModalReducer'
import type { FieldError } from './validation'

// ---- Reusable generators (shared by later property tests in this file) ----

export const viewArb: fc.Arbitrary<ModalView> = fc.constantFrom('login', 'register', 'forgot')

export const serviceErrorArb: fc.Arbitrary<ServiceError> = fc.constantFrom(
  'invalid_credentials',
  'unavailable',
  'username_taken',
  'email_taken',
  'reset_unavailable',
)

export const fieldErrorArb: fc.Arbitrary<FieldError> = fc.oneof(
  fc.constantFrom<FieldError['field']>(
    'username',
    'email',
    'password',
    'confirmPassword',
    'identifier',
  ).map((field): FieldError => ({ field, code: 'required' })),
  fc.constant<FieldError>({ field: 'username', code: 'format' }),
  fc.constant<FieldError>({ field: 'email', code: 'invalid' }),
  fc.constant<FieldError>({ field: 'password', code: 'too_short' }),
  fc.constant<FieldError>({ field: 'confirmPassword', code: 'mismatch' }),
)

type OpenState = Extract<AuthModalState, { open: true }>

/** Arbitrary open state in any view, with arbitrary form contents and status. */
export const openStateArb: fc.Arbitrary<OpenState> = fc.record({
  open: fc.constant(true as const),
  view: viewArb,
  username: fc.string(),
  email: fc.string(),
  password: fc.string(),
  confirmPassword: fc.string(),
  identifier: fc.string(),
  remember: fc.boolean(),
  pending: fc.boolean(),
  fieldErrors: fc.array(fieldErrorArb, { maxLength: 5 }),
  serviceError: fc.option(serviceErrorArb, { nil: null }),
  notice: fc.option(fc.constantFrom('confirm_email' as const, 'reset_sent' as const), {
    nil: null,
  }),
})

// Feature: auth-modal, Property 1: Closing discards all form state
// **Validates: Requirements 1.6, 4.1**
describe('authModalReducer Property 1: closing discards all form state', () => {
  it('CLOSE from any open state yields the closed state with no retained data', () => {
    fc.assert(
      fc.property(openStateArb, (state) => {
        const next = authModalReducer(state, { type: 'CLOSE' })
        expect(next).toEqual(CLOSED_STATE)
        expect(Object.keys(next)).toEqual(['open'])
      }),
      { numRuns: 100 },
    )
  })

  it('reopening after CLOSE starts blank in every view', () => {
    fc.assert(
      fc.property(openStateArb, fc.constantFrom('login', 'register'), (state, view) => {
        const closed = authModalReducer(state, { type: 'CLOSE' })
        const reopened = authModalReducer(closed, { type: 'OPEN', view })
        expect(reopened).toEqual({
          open: true,
          view,
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          identifier: '',
          remember: false,
          pending: false,
          fieldErrors: [],
          serviceError: null,
          notice: null,
        })
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: auth-modal, Property 2: Toggle preserves username and clears sensitive state
// **Validates: Requirements 2.3, 2.4, 2.5**
describe('authModalReducer Property 2: toggle preserves username and clears sensitive state', () => {
  const toggleableArb = openStateArb.filter(
    (s) => !s.pending && (s.view === 'login' || s.view === 'register'),
  )

  it('TOGGLE flips view, keeps username, clears password/confirmPassword/errors/notice', () => {
    fc.assert(
      fc.property(toggleableArb, (state) => {
        const next = authModalReducer(state, { type: 'TOGGLE' })
        if (!next.open) throw new Error('expected modal to stay open')
        expect(next.view).toBe(state.view === 'login' ? 'register' : 'login')
        expect(next.username).toBe(state.username)
        expect(next.password).toBe('')
        expect(next.confirmPassword).toBe('')
        expect(next.fieldErrors).toEqual([])
        expect(next.serviceError).toBeNull()
        expect(next.notice).toBeNull()
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: auth-modal, Property 3: Pending state blocks toggling and resubmission
// **Validates: Requirements 2.7, 5.8**
describe('authModalReducer Property 3: pending state blocks toggling and resubmission', () => {
  const pendingStateArb = openStateArb.map((s): OpenState => ({ ...s, pending: true }))

  it('TOGGLE, FORGOT and SUBMIT_START leave a pending state unchanged', () => {
    fc.assert(
      fc.property(
        pendingStateArb,
        fc.constantFrom('TOGGLE', 'FORGOT', 'SUBMIT_START'),
        (state, type) => {
          const next = authModalReducer(state, { type } as { type: 'TOGGLE' })
          expect(next).toEqual(state)
          if (next.open) expect(next.pending).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// Feature: auth-modal, Property 7: Credential failure keeps the username and clears the password
// **Validates: Requirements 3.5, 4.1**
describe('authModalReducer Property 7: credential failure keeps username and clears password', () => {
  const pendingLoginArb = openStateArb.map(
    (s): OpenState => ({ ...s, view: 'login', pending: true }),
  )

  it('SUBMIT_FAILED invalid_credentials keeps username, clears password, ends pending, stays open on login', () => {
    fc.assert(
      fc.property(pendingLoginArb, (state) => {
        const next = authModalReducer(state, { type: 'SUBMIT_FAILED', error: 'invalid_credentials' })
        if (!next.open) throw new Error('expected modal to stay open')
        expect(next.view).toBe('login')
        expect(next.username).toBe(state.username)
        expect(next.password).toBe('')
        expect(next.pending).toBe(false)
        expect(next.serviceError).toBe('invalid_credentials')
        expect(next.fieldErrors).toEqual([])
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: auth-modal, Property 15: Returning from forgot-password restores a clean login view
// **Validates: Requirements 5.7**
describe('authModalReducer Property 15: returning from forgot-password restores a clean login view', () => {
  const forgotStateArb = openStateArb.map((s): OpenState => ({ ...s, view: 'forgot' }))

  it('BACK_TO_LOGIN from forgot shows login with no errors or notice', () => {
    fc.assert(
      fc.property(forgotStateArb, (state) => {
        const next = authModalReducer(state, { type: 'BACK_TO_LOGIN' })
        if (!next.open) throw new Error('expected modal to stay open')
        expect(next.view).toBe('login')
        expect(next.fieldErrors).toEqual([])
        expect(next.serviceError).toBeNull()
        expect(next.notice).toBeNull()
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: auth-modal, Property 18: Unauthenticated session events leave the modal untouched
// **Validates: Requirements 8.6**
describe('authModalReducer Property 18: unauthenticated session events leave the modal untouched', () => {
  const anyStateArb: fc.Arbitrary<AuthModalState> = fc.oneof(
    openStateArb,
    fc.constant<AuthModalState>(CLOSED_STATE),
  )

  it('SESSION_CHANGED with authenticated false returns the same state reference', () => {
    fc.assert(
      fc.property(anyStateArb, (state) => {
        const next = authModalReducer(state, { type: 'SESSION_CHANGED', authenticated: false })
        expect(next).toBe(state)
      }),
      { numRuns: 100 },
    )
  })
})
