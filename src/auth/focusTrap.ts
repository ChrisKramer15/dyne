import { useEffect, type RefObject } from 'react'

/**
 * Index of the element that should receive focus after Tab (or Shift+Tab)
 * among `count` focusable elements, wrapping at both ends.
 * Returns -1 when there is nothing to focus. A `current` outside [0, count)
 * (focus is not on a listed element) lands on the first element for Tab and
 * the last for Shift+Tab.
 */
export function nextFocusIndex(count: number, current: number, shift: boolean): number {
  if (count < 1) return -1
  if (!Number.isInteger(current) || current < 0 || current >= count) {
    return shift ? count - 1 : 0
  }
  return shift ? (current - 1 + count) % count : (current + 1) % count
}

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  )
}

/**
 * Keeps Tab and Shift+Tab focus inside `containerRef` while `active` is true,
 * wrapping from the last focusable element to the first and back.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = getFocusable(container)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const current = items.indexOf(document.activeElement as HTMLElement)
      const next = nextFocusIndex(items.length, current, e.shiftKey)
      // Only intercept when the browser's default move would leave the dialog.
      const leaving = current === -1 || (e.shiftKey ? current === 0 : current === items.length - 1)
      if (leaving) {
        e.preventDefault()
        items[next].focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [containerRef, active])
}
