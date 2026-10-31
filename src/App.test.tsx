import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./auth/useAuthState', () => ({
  useAuthState: () => ({ status: 'unauthenticated' }),
}))

import App from './App'

describe('App', () => {
  it('renders the landing page and no starter content', () => {
    const { container } = render(<App />)
    expect(screen.getByRole('heading', { name: 'Dyne' })).toBeTruthy()
    expect(container.querySelector('.landing')).not.toBeNull()
    expect(screen.queryByText(/Vite \+ React/i)).toBeNull()
    expect(screen.queryByText(/count is/i)).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})
