import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider } from './AuthProvider'
import { AuthContext, useAuth } from './authContext'
import type { AuthStateClient } from './useAuthState'
import type { AuthState } from './authReducer'

function makeClient() {
  const getSession = vi.fn(() =>
    Promise.resolve({ data: { session: { user: { user_metadata: { name: 'Ada' } } } }, error: null }),
  )
  const client = {
    auth: {
      getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  } as unknown as AuthStateClient
  return { client, getSession }
}

function Consumer({ id = 'status' }: { id?: string }) {
  return <span data-testid={id}>{useAuth().status}</span>
}

describe('AuthProvider / useAuth', () => {
  it('useAuth throws outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow(/within an AuthProvider/)
    spy.mockRestore()
  })

  it('children read the provided state', async () => {
    const { client } = makeClient()
    render(
      <AuthProvider client={client}>
        <Consumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('loading')
    await act(async () => {})
    expect(screen.getByTestId('status').textContent).toBe('authenticated')
  })

  it('runs useAuthState once when several consumers mount', async () => {
    const { client, getSession } = makeClient()
    render(
      <AuthProvider client={client}>
        <Consumer id="a" />
        <Consumer id="b" />
        <Consumer id="c" />
      </AuthProvider>,
    )
    await act(async () => {})
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('c').textContent).toBe('authenticated')
  })

  it('reads a supplied AuthContext.Provider value without Supabase', () => {
    const value: AuthState = { status: 'unauthenticated' }
    render(
      <AuthContext.Provider value={value}>
        <Consumer />
      </AuthContext.Provider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated')
  })
})
