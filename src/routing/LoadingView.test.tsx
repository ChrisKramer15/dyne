import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import LoadingView from './LoadingView'

afterEach(cleanup)

describe('LoadingView', () => {
  it('renders a status element with "Loading…"', () => {
    render(<LoadingView />)
    expect(screen.getByRole('status').textContent).toBe('Loading…')
  })

  it('renders no buttons', () => {
    render(<LoadingView />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
