import type { FieldError } from './validation'

export type ModalView = 'login' | 'register' | 'forgot'
export type ServiceError =
  | 'invalid_credentials'
  | 'unavailable'
  | 'username_taken'
  | 'email_taken'
  | 'reset_unavailable'

export type AuthModalState =
  | { open: false }
  | {
      open: true
      view: ModalView
      username: string
      email: string
      password: string
      confirmPassword: string
      identifier: string
      remember: boolean
      pending: boolean
      fieldErrors: FieldError[]
      serviceError: ServiceError | null
      notice: 'confirm_email' | 'reset_sent' | null
    }

export type AuthModalAction =
  | { type: 'OPEN'; view: 'login' | 'register' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'FORGOT' }
  | { type: 'BACK_TO_LOGIN' }
  | {
      type: 'CHANGE'
      field: 'username' | 'email' | 'password' | 'confirmPassword' | 'identifier'
      value: string
    }
  | { type: 'SET_REMEMBER'; value: boolean }
  | { type: 'SUBMIT_INVALID'; errors: FieldError[] }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_FAILED'; error: ServiceError }
  | { type: 'RESET_SENT' }
  | { type: 'CONFIRM_EMAIL' }
  | { type: 'SESSION_CHANGED'; authenticated: boolean }

export const CLOSED_STATE: AuthModalState = { open: false }

function freshOpen(view: ModalView): AuthModalState {
  return {
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
  }
}

export function authModalReducer(
  state: AuthModalState,
  action: AuthModalAction,
): AuthModalState {
  if (action.type === 'OPEN') return freshOpen(action.view)

  // Every other action is meaningless while the modal is closed.
  if (!state.open) return state

  switch (action.type) {
    case 'CLOSE':
      return { open: false }

    case 'SESSION_CHANGED':
      return action.authenticated ? { open: false } : state

    case 'TOGGLE':
      if (state.pending || state.view === 'forgot') return state
      return {
        ...state,
        view: state.view === 'login' ? 'register' : 'login',
        password: '',
        confirmPassword: '',
        fieldErrors: [],
        serviceError: null,
        notice: null,
      }

    case 'FORGOT':
      if (state.pending) return state
      return {
        ...state,
        view: 'forgot',
        fieldErrors: [],
        serviceError: null,
        notice: null,
      }

    case 'BACK_TO_LOGIN':
      return {
        ...state,
        view: 'login',
        fieldErrors: [],
        serviceError: null,
        notice: null,
      }

    case 'CHANGE':
      return { ...state, [action.field]: action.value }

    case 'SET_REMEMBER':
      return { ...state, remember: action.value }

    case 'SUBMIT_INVALID':
      return {
        ...state,
        pending: false,
        fieldErrors: action.errors,
        serviceError: null,
        notice: null,
      }

    case 'SUBMIT_START':
      if (state.pending) return state
      return {
        ...state,
        pending: true,
        fieldErrors: [],
        serviceError: null,
        notice: null,
      }

    case 'SUBMIT_FAILED':
      if (action.error === 'invalid_credentials') {
        return {
          ...state,
          pending: false,
          password: '',
          remember: false,
          fieldErrors: [],
          serviceError: 'invalid_credentials',
          notice: null,
        }
      }
      return {
        ...state,
        pending: false,
        fieldErrors: [],
        serviceError: action.error,
        notice: null,
      }

    case 'RESET_SENT':
      return {
        ...state,
        pending: false,
        fieldErrors: [],
        serviceError: null,
        notice: 'reset_sent',
      }

    case 'CONFIRM_EMAIL':
      return {
        ...state,
        pending: false,
        password: '',
        confirmPassword: '',
        fieldErrors: [],
        serviceError: null,
        notice: 'confirm_email',
      }
  }
}
