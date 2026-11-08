export interface PagerProps {
  /** Accessible name of the navigation landmark, e.g. "Alerts pages". */
  label: string
  /** Zero-based current page. */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

/** Previous / Next controls. Renders nothing when everything fits on one page. */
export function Pager({ label, page, pageCount, onPageChange }: PagerProps) {
  if (pageCount <= 1) return null
  return (
    <nav className="pager" aria-label={label}>
      <button
        type="button"
        className="pager-btn"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="pager-status" aria-live="polite">
        Page {page + 1} of {pageCount}
      </span>
      <button
        type="button"
        className="pager-btn"
        disabled={page === pageCount - 1}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  )
}
