import { describe, it, expect, afterEach } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pager } from './Pager'
import { usePagination } from './usePagination'

afterEach(cleanup)

describe('usePagination', () => {
  const items = [1, 2, 3, 4, 5]

  it('slices the list into pages', () => {
    const { result } = renderHook(() => usePagination(items, 2))
    expect(result.current.pageCount).toBe(3)
    expect(result.current.visible).toEqual([1, 2])
    act(() => result.current.setPage(2))
    expect(result.current.visible).toEqual([5])
  })

  it('reports one page for an empty list', () => {
    const { result } = renderHook(() => usePagination([], 3))
    expect(result.current.pageCount).toBe(1)
    expect(result.current.visible).toEqual([])
  })

  it('clamps the page when the list shrinks', () => {
    const { result, rerender } = renderHook(({ list }) => usePagination(list, 2), {
      initialProps: { list: items },
    })
    act(() => result.current.setPage(2))
    rerender({ list: [1, 2, 3] })
    expect(result.current.page).toBe(1)
    expect(result.current.visible).toEqual([3])
  })
})

describe('Pager', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pager label="Things pages" page={0} pageCount={1} onPageChange={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('disables Previous on the first page and Next on the last', () => {
    const { rerender } = render(<Pager label="Things pages" page={0} pageCount={3} onPageChange={() => {}} />)
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)
    rerender(<Pager label="Things pages" page={2} pageCount={3} onPageChange={() => {}} />)
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Page 3 of 3')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Things pages' })).toBeTruthy()
  })

  it('asks for the neighbouring page', async () => {
    const seen: number[] = []
    const user = userEvent.setup()
    render(<Pager label="Things pages" page={1} pageCount={3} onPageChange={(p) => seen.push(p)} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(seen).toEqual([2, 0])
  })
})
