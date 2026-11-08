import { useEffect, useRef } from 'react'

/** Ref for the form's first input; it receives focus when the form mounts. */
export function useFocusOnMount() {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return ref
}
