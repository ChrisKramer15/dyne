import { useState } from 'react'

/**
 * Client-side pagination over an in-memory list. The page index is clamped, so
 * it stays valid if the list shrinks while a later page is showing.
 */
export function usePagination<T>(items: readonly T[], perPage: number) {
  const [requested, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / perPage))
  const page = Math.min(requested, pageCount - 1)
  const visible = items.slice(page * perPage, (page + 1) * perPage)
  return { page, pageCount, visible, setPage }
}
